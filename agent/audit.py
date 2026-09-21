from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


def _write_log(entry: dict) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%d")
    log_file = LOG_DIR / f"audit_{ts}.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, default=str) + "\n")


def log_approval(email_id: str, opportunity_name: str) -> None:
    _write_log({
        "event": "approval_received",
        "email_id": email_id,
        "opportunity_name": opportunity_name,
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_validation(email_id: str, result: dict) -> None:
    _write_log({
        "event": "validation_result",
        "email_id": email_id,
        "valid": result.get("valid", False),
        "errors": result.get("errors", []),
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_dedup(email_id: str, result: dict) -> None:
    _write_log({
        "event": "deduplication_result",
        "email_id": email_id,
        "is_duplicate": result.get("is_duplicate", False),
        "notion_exact": result.get("notion_exact_match", False),
        "notion_fallback": result.get("notion_fallback_match", False),
        "calendar_match": result.get("calendar_match", False),
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_notion_write(email_id: str, result: str, error: Optional[str] = None) -> None:
    _write_log({
        "event": "notion_write",
        "email_id": email_id,
        "result": result,
        "error": error,
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_calendar_write(email_id: str, result: str, error: Optional[str] = None) -> None:
    _write_log({
        "event": "calendar_write",
        "email_id": email_id,
        "result": result,
        "error": error,
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_workflow_result(email_id: str, status: str, details: dict) -> None:
    _write_log({
        "event": "workflow_result",
        "email_id": email_id,
        "status": status,
        "details": details,
        "timestamp": datetime.utcnow().isoformat(),
    })


def log_rejection(email_id: str, opportunity_name: str) -> None:
    _write_log({
        "event": "rejection",
        "email_id": email_id,
        "opportunity_name": opportunity_name,
        "timestamp": datetime.utcnow().isoformat(),
    })
