from __future__ import annotations

import json
import subprocess
import shutil
import os
from typing import Optional

from agent.config import SWYTCHCODE_CWD, NOTION_DATABASE_ID
from agent.models import Opportunity
from agent.notion import (
    prepare_notion_payload,
    query_existing,
    check_duplicate,
    check_duplicate_fallback,
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


def write_notion(
    opp: Opportunity,
    existing: Optional[list[dict]] = None,
) -> dict:
    """Write to Notion. Accepts pre-fetched existing pages to avoid redundant queries."""
    email_id = opp.source_email_id or ""

    if existing is None:
        existing = query_existing()

    if check_duplicate(email_id, existing):
        return {"status": "skipped", "reason": "duplicate_email_id"}
    if opp.name and check_duplicate_fallback(opp.name, opp.organization, opp.deadline, existing):
        return {"status": "skipped", "reason": "duplicate_fallback"}

    payload = prepare_notion_payload(opp)
    try:
        data = _run_swycmd([
            "exec", "notion.page.create",
            "--body", json.dumps(payload),
            "--json",
        ])
        status_code = data.get("status_code", 200)

        # Check for Notion API errors (even if HTTP 200, the response may contain errors)
        api_error = data.get("data", {}).get("code")
        if api_error and api_error != "ok":
            error_msg = data.get("data", {}).get("message", f"Notion API error: {api_error}")
            return {"status": "failed", "error": error_msg}

        if status_code >= 400:
            error_msg = data.get("data", {}).get("message", f"HTTP {status_code}")
            return {"status": "failed", "error": error_msg}

        page_id = data.get("id") or data.get("data", {}).get("id") or "unknown"

        # Verify the page was created in the correct database (not as standalone page)
        parent = data.get("data", {}).get("parent", {})
        parent_type = parent.get("type", "")
        parent_db_id = parent.get("database_id", "")
        # Notion API may return type as "database_id" or "data_source_id" — both are valid
        if parent_type not in ("database_id", "data_source_id"):
            return {"status": "failed", "error": "Page created as standalone page, not in database. Ensure the database is shared with the Swytchcode integration."}
        if parent_db_id != NOTION_DATABASE_ID:
            return {"status": "failed", "error": f"Page created in wrong database (expected {NOTION_DATABASE_ID}, got {parent_db_id})"}

        return {"status": "created", "page_id": page_id}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
