from __future__ import annotations

import json
import subprocess
from typing import Optional

import shutil
import os

from agent.config import SWYTCHCODE_CWD
from agent.models import Opportunity


def _find_node() -> str:
    path = shutil.which("node")
    if path:
        return path
    raise FileNotFoundError("node not found in PATH")


def _find_swytchcode_js() -> str:
    npm_dir = r"C:\Users\VISHAL KUMAR\AppData\Roaming\npm"
    candidates = [
        os.path.join(npm_dir, "node_modules", "swytchcode", "bin", "swytchcode.js"),
        os.path.join(npm_dir, "node_modules", "swytchcode", "dist", "index.js"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError("swytchcode.js not found")


def _run_swycmd(args: list[str]) -> dict:
    node = _find_node()
    swy_js = _find_swytchcode_js()
    result = subprocess.run(
        [node, swy_js] + args,
        cwd=SWYTCHCODE_CWD,
        capture_output=True,
        timeout=30,
    )
    stdout = result.stdout.decode("utf-8", errors="replace")
    stderr = result.stderr.decode("utf-8", errors="replace")
    if result.returncode != 0:
        raise RuntimeError(
            f"swy {' '.join(args)} failed: {stderr.strip()}"
        )
    raw = stdout.strip()
    for line in raw.split("\n"):
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    return {"raw": raw}


def get_primary_calendar_id() -> Optional[str]:
    try:
        data = _run_swycmd([
            "exec", "calendar.me.calendarList.list",
            "--json",
        ])
        items = data.get("data", {}).get("items", [])
        for item in items:
            if item.get("primary"):
                return item.get("id")
        if items:
            return items[0].get("id")
    except Exception:
        pass
    return None


def query_calendar_events(
    calendar_id: str,
    date: Optional[str] = None,
) -> list[dict]:
    """Fetch calendar events for a given date. Returns items list or empty list."""
    try:
        args = [
            "exec", "calendar.event.get",
            "--input", f"calendarId={calendar_id}",
            "--input", "maxResults=50",
            "--input", "singleEvents=true",
        ]
        if date:
            args.extend(["--input", f"timeMin={date}T00:00:00Z"])
            args.extend(["--input", f"timeMax={date}T23:59:59Z"])
        args.append("--json")
        data = _run_swycmd(args)
        return data.get("data", {}).get("items", [])
    except Exception:
        return []


def check_calendar_duplicate(
    summary: str,
    date: Optional[str],
    calendar_id: Optional[str] = None,
    existing_events: Optional[list[dict]] = None,
) -> bool:
    if existing_events is not None:
        items = existing_events
    else:
        if not calendar_id:
            calendar_id = get_primary_calendar_id()
        if not calendar_id:
            return False
        items = query_calendar_events(calendar_id, date)
    for item in items:
        if item.get("summary", "").lower() == summary.lower():
            return True
    return False


def prepare_calendar_event(opp: Opportunity, calendar_id: Optional[str] = None) -> dict:
    if not calendar_id:
        calendar_id = get_primary_calendar_id() or "primary"
    summary = f"{opp.name} - Application Deadline" if opp.name else "Opportunity Deadline"
    event = {
        "summary": summary,
        "description": f"Opportunity: {opp.name}\nOrganization: {opp.organization or 'N/A'}\nType: {opp.type or 'N/A'}\nURL: {opp.url or 'N/A'}\n\n{opp.summary or ''}",
    }
    if opp.deadline:
        event["start"] = {"date": opp.deadline}
        event["end"] = {"date": opp.deadline}
    else:
        from datetime import datetime, timedelta
        tomorrow = datetime.utcnow() + timedelta(days=1)
        event["start"] = {"date": tomorrow.strftime("%Y-%m-%d")}
        event["end"] = {"date": tomorrow.strftime("%Y-%m-%d")}
    return {
        "calendar_id": calendar_id,
        "event": event,
    }
