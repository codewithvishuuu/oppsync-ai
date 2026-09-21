from __future__ import annotations

import json
import time
from typing import Optional

from agent.config import DEFAULT_SCAN_LIMIT
from agent.models import Opportunity, ScanResult, EmailMessage
from agent.gmail import fetch_recent_emails, _run_swycmd, _run_swycmd_stdin
from agent.gemini import extract_opportunity, GeminiUnavailable
from agent.dedup import is_duplicate
from agent.notion import query_existing
from agent.state import is_processed


OPPORTUNITY_SIGNALS = [
    "internship", "hackathon", "scholarship", "competition", "fellowship",
    "job", "workshop", "certification", "opportunity", "apply", "application",
    "applications open", "registration", "deadline", "hiring", "recruit",
    "position", "vacancy", "opening", "enroll", "enrollment", "contest",
    "prize", "award", "grant", "funding", "mentor", "mentorship",
]


def _fetch_email_detail_and_body(msg_id: str) -> tuple[dict, str]:
    from agent.gmail import _extract_text
    try:
        detail = _run_swycmd_stdin({
            "tool": "gmail.user.messages.get1",
            "args": {
                "userId": "me",
                "id": msg_id,
                "format": "full",
                "metadataHeaders": ["Subject", "From", "Date"],
            },
        })
        payload = detail.get("data", {}).get("payload", {})
        body = _extract_text(payload)
        return detail, body
    except Exception:
        return {}, ""


def _is_relevant(subject: str, snippet: str) -> bool:
    text = (subject + " " + snippet).lower()
    for signal in OPPORTUNITY_SIGNALS:
        if signal in text:
            return True
    return False


def scan_emails(limit: int = DEFAULT_SCAN_LIMIT) -> ScanResult:
    t_start = time.time()
    print(f"[STAGE] SCAN_START limit={limit}", flush=True)

    t0 = time.time()
    emails = fetch_recent_emails(limit=limit)
    print(f"[STAGE] GMAIL_LIST_DONE {time.time()-t0:.1f}s count={len(emails)}", flush=True)

    t_notion = time.time()
    existing_notion = query_existing()
    print(f"[STAGE] NOTION_DONE {time.time()-t_notion:.1f}s records={len(existing_notion)}", flush=True)

    t_cal = time.time()
    existing_calendar = []
    print(f"[STAGE] CALENDAR_DONE {time.time()-t_cal:.1f}s events={len(existing_calendar)} (skipped, dedup handled at approval time)", flush=True)

    opportunities = []
    ai_unavailable = False
    ai_rate_limited = False
    ai_error_msg = None
    gemini_requests = 0
    locally_filtered = 0

    processed_count = 0

    for i, email in enumerate(emails):
        # Check if this email was already approved or rejected
        if is_processed(email.id):
            processed_count += 1
            opp = Opportunity(is_opportunity=False, confidence=0.0, source_email_id=email.id)
            print(f"[STAGE] EXTRACT_SKIP {i+1}/{len(emails)} reason=already_processed", flush=True)
            opportunities.append(opp)
            continue

        t1 = time.time()
        detail, body = _fetch_email_detail_and_body(email.id)
        try:
            payload = detail.get("data", {}).get("payload", {})
            headers = {h.get("name", ""): h.get("value", "") for h in payload.get("headers", [])}
            email.subject = headers.get("Subject", "")
            email.from_address = headers.get("From", "")
            email.date = headers.get("Date", "")
            email.snippet = detail.get("data", {}).get("snippet", "")
        except Exception:
            pass
        print(f"[STAGE] EMAIL_DETAIL {i+1}/{len(emails)} id={email.id[:16]} {time.time()-t1:.1f}s body_len={len(body)}", flush=True)

        if ai_unavailable or ai_rate_limited:
            opp = Opportunity(is_opportunity=False, confidence=0.0, source_email_id=email.id)
            print(f"[STAGE] EXTRACT_SKIP {i+1}/{len(emails)} reason=ai_stop", flush=True)
        elif not _is_relevant(email.subject, email.snippet):
            opp = Opportunity(is_opportunity=False, confidence=0.0, source_email_id=email.id)
            locally_filtered += 1
            print(f"[STAGE] EXTRACT_SKIP {i+1}/{len(emails)} reason=local_filter", flush=True)
        else:
            gemini_requests += 1
            t3 = time.time()
            try:
                opp = extract_opportunity(
                    subject=email.subject, snippet=email.snippet, body=body, email_id=email.id,
                )
                print(f"[STAGE] GEMINI_OK {i+1}/{len(emails)} req={gemini_requests} {time.time()-t3:.1f}s is_opp={opp.is_opportunity}", flush=True)
            except GeminiUnavailable as e:
                elapsed = time.time() - t3
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower() or "daily" in err_str.lower():
                    ai_rate_limited = True
                    ai_error_msg = "Gemini daily quota exhausted"
                    print(f"[STAGE] GEMINI_429 {i+1}/{len(emails)} {elapsed:.1f}s STOPPING_EXTRACTION", flush=True)
                elif "401" in err_str or "403" in err_str or "auth" in err_str.lower():
                    ai_unavailable = True
                    ai_error_msg = err_str
                    print(f"[STAGE] GEMINI_AUTH_ERROR {i+1}/{len(emails)} {elapsed:.1f}s", flush=True)
                else:
                    ai_unavailable = True
                    ai_error_msg = err_str
                    print(f"[STAGE] GEMINI_ERROR {i+1}/{len(emails)} {elapsed:.1f}s err={err_str[:80]}", flush=True)
                opp = Opportunity(is_opportunity=False, confidence=0.0, source_email_id=email.id)

        if opp.is_opportunity and opp.confidence >= 0.5:
            t4 = time.time()
            dup = is_duplicate(
                email_id=opp.source_email_id or email.id,
                name=opp.name,
                organization=opp.organization,
                deadline=opp.deadline,
                existing_notion=existing_notion,
                existing_calendar=existing_calendar,
            )
            print(f"[STAGE] DEDUP {i+1}/{len(emails)} {time.time()-t4:.1f}s", flush=True)
            opp.is_opportunity = not dup["is_duplicate"]
        opportunities.append(opp)

    total = time.time() - t_start
    opps_found = len([o for o in opportunities if o.is_opportunity])
    print(f"[STAGE] SCAN_DONE {total:.1f}s scanned={len(emails)} processed={processed_count} filtered={locally_filtered} gemini_reqs={gemini_requests} opps={opps_found}", flush=True)
    return ScanResult(
        opportunities=[o for o in opportunities if o.is_opportunity],
        emails_scanned=len(emails),
        ai_quota_exhausted=ai_rate_limited,
        ai_unavailable=ai_unavailable,
        ai_error=ai_error_msg,
    )


def get_pending_confirmations(scan_result: ScanResult) -> list[dict]:
    results = []
    for i, opp in enumerate(scan_result.opportunities):
        results.append({
            "index": i,
            "is_opportunity": True,
            "name": opp.name,
            "organization": opp.organization,
            "type": opp.type,
            "deadline": opp.deadline,
            "url": opp.url,
            "summary": opp.summary,
            "confidence": opp.confidence,
            "source_email_id": opp.source_email_id,
        })
    return results
