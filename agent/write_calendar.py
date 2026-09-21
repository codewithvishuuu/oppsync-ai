from __future__ import annotations

import json
import subprocess
import shutil
import os
from typing import Optional

from agent.config import SWYTCHCODE_CWD
from agent.models import Opportunity
from agent.calendar import (
    get_primary_calendar_id,
    prepare_calendar_event,
    check_calendar_duplicate,
)


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


def write_calendar(
    opp: Opportunity,
    calendar_id: Optional[str] = None,
    existing_events: Optional[list[dict]] = None,
) -> dict:
    """Write to Calendar. Accepts pre-fetched calendar_id and events to avoid redundant queries."""
    if not opp.deadline:
        return {"status": "skipped", "reason": "no_deadline"}

    if calendar_id is None:
        calendar_id = get_primary_calendar_id()
    if not calendar_id:
        return {"status": "skipped", "reason": "no_calendar_found"}

    summary = f"{opp.name} - Application Deadline" if opp.name else "Opportunity Deadline"
    if check_calendar_duplicate(summary, opp.deadline, calendar_id, existing_events):
        return {"status": "skipped", "reason": "duplicate_event"}

    cal_payload = prepare_calendar_event(opp, calendar_id)
    event_data = cal_payload["event"]

    try:
        data = _run_swycmd([
            "exec", "calendar.event.quickAdd.create",
            "--input", f"calendarId={calendar_id}",
            "--input", f"text={summary} on {opp.deadline}",
            "--json",
        ])
        event_id = data.get("data", {}).get("id", "unknown")
        return {"status": "created", "event_id": event_id}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
