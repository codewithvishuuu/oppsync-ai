from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from agent.models import Opportunity
from agent.validation import validate_opportunity
from agent.dedup import is_duplicate
from agent.notion import query_existing
from agent.write_notion import write_notion
from agent.calendar import get_primary_calendar_id, query_calendar_events
from agent.write_calendar import write_calendar
from agent.audit import (
    log_approval,
    log_validation,
    log_dedup,
    log_notion_write,
    log_calendar_write,
    log_workflow_result,
)
from agent.state import mark_processed

_inflight: dict[str, bool] = {}
_lock = threading.Lock()


def process_approval(opp: Opportunity) -> dict:
    email_id = opp.source_email_id or "unknown"
    t0 = time.time()

    with _lock:
        if email_id in _inflight and _inflight[email_id]:
            return {
                "status": "error",
                "error": "Operation already in progress for this email",
                "notion": "skipped",
                "calendar": "skipped",
            }
        _inflight[email_id] = True

    try:
        log_approval(email_id, opp.name or "Unknown")

        validation = validate_opportunity(opp)
        log_validation(email_id, validation)
        if not validation["valid"]:
            return {
                "status": "error",
                "error": f"Validation failed: {'; '.join(validation['errors'])}",
                "notion": "skipped",
                "calendar": "skipped",
            }

        # Query Notion and Calendar IN PARALLEL (they are independent)
        t_query_start = time.time()

        def do_notion_query():
            return query_existing()

        def do_calendar_query():
            cal_id = None
            cal_events = None
            if opp.deadline:
                cal_id = get_primary_calendar_id()
                if cal_id:
                    cal_events = query_calendar_events(cal_id, opp.deadline)
            return cal_id, cal_events

        with ThreadPoolExecutor(max_workers=2) as executor:
            notion_future = executor.submit(do_notion_query)
            calendar_future = executor.submit(do_calendar_query)
            existing_notion = notion_future.result()
            calendar_id, existing_calendar_events = calendar_future.result()

        t_query_done = time.time()
        print(f"[writer] Parallel queries: {t_query_done - t_query_start:.1f}s (notion={len(existing_notion)} pages, calendar_id={calendar_id})")

        # Dedup with pre-fetched data (no new subprocess calls)
        dedup_result = is_duplicate(
            email_id=email_id,
            name=opp.name,
            organization=opp.organization,
            deadline=opp.deadline,
            existing_notion=existing_notion,
            existing_calendar=existing_calendar_events,
        )
        log_dedup(email_id, dedup_result)
        if dedup_result["is_duplicate"]:
            return {
                "status": "skipped",
                "reason": "duplicate",
                "dedup": dedup_result,
                "notion": "skipped",
                "calendar": "skipped",
            }

        # Write Notion and Calendar IN PARALLEL (they are independent after dedup)
        t_write_start = time.time()

        def do_notion_write():
            return write_notion(opp, existing=existing_notion)

        def do_calendar_write():
            if opp.deadline:
                return write_calendar(
                    opp,
                    calendar_id=calendar_id,
                    existing_events=existing_calendar_events,
                )
            return {"status": "skipped", "reason": "no_deadline"}

        with ThreadPoolExecutor(max_workers=2) as executor:
            notion_future = executor.submit(do_notion_write)
            calendar_future = executor.submit(do_calendar_write)
            notion_result = notion_future.result()
            calendar_result = calendar_future.result()

        t_write_done = time.time()
        print(f"[writer] Parallel writes: {t_write_done - t_write_start:.1f}s (notion={notion_result.get('status')}, calendar={calendar_result.get('status')})")
        log_notion_write(email_id, notion_result.get("status", "unknown"), notion_result.get("error"))
        log_calendar_write(email_id, calendar_result.get("status", "unknown"), calendar_result.get("error"))

        notion_ok = notion_result.get("status") == "created"
        calendar_ok = calendar_result.get("status") == "created"
        notion_skipped = notion_result.get("status") == "skipped"
        calendar_skipped = calendar_result.get("status") == "skipped"

        if notion_ok and (calendar_ok or calendar_skipped):
            status = "success"
        elif notion_ok and calendar_result.get("status") == "failed":
            status = "partial_success"
        elif notion_result.get("status") == "failed" and calendar_ok:
            status = "partial_success"
        elif notion_result.get("status") == "failed" and calendar_result.get("status") == "failed":
            status = "failed"
        elif notion_skipped and calendar_skipped:
            status = "skipped"
        else:
            status = "partial_success"

        result = {
            "status": status,
            "notion": notion_result,
            "calendar": calendar_result,
        }
        log_workflow_result(email_id, status, result)

        # Persist processed state only on full success (both external writes
        # succeeded or were legitimately skipped). Do NOT mark on partial_success
        # or failed — this preserves the ability to retry the missing side effect.
        if status == "success":
            notion_page_id = notion_result.get("page_id")
            mark_processed(email_id, "approved", opp.name, notion_page_id)

        t_total = time.time() - t0
        print(f"[writer] APPROVE {email_id} total: {t_total:.1f}s status={status}")
        return result

    finally:
        with _lock:
            _inflight.pop(email_id, None)


def process_rejection(opp: Opportunity) -> dict:
    email_id = opp.source_email_id or "unknown"
    mark_processed(email_id, "rejected", opp.name)
    return {
        "status": "rejected",
        "message": "No external changes made",
    }
