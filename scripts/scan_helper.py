#!/usr/bin/env python3
"""Scan endpoint helper - called by Next.js API route."""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.agent import scan_emails, get_pending_confirmations

limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10

result = scan_emails(limit=limit)
pending = get_pending_confirmations(result)

is_rate_limited = result.ai_quota_exhausted

output = {
    "status": "ai_rate_limited" if is_rate_limited else "ok",
    "emails_scanned": result.emails_scanned,
    "opportunities_found": len(result.opportunities),
    "opportunities": pending,
    "scan_timestamp": result.scan_timestamp,
}
if is_rate_limited:
    output["message"] = "Gemini daily quota reached. Try again after the quota resets."
if result.ai_quota_exhausted:
    output["ai_quota_exhausted"] = True
    output["ai_error"] = result.ai_error or "AI quota exhausted"
if result.ai_unavailable:
    output["ai_unavailable"] = True
    output["ai_error"] = result.ai_error or "AI is temporarily unavailable"
print(json.dumps(output))
