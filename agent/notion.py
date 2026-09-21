from __future__ import annotations

import json
import subprocess
from typing import Optional

import shutil
import os

from agent.config import SWYTCHCODE_CWD, NOTION_DATABASE_ID, NOTION_DATA_SOURCE_ID
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


def query_existing(database_id: str = NOTION_DATA_SOURCE_ID) -> list[dict]:
    try:
        data = _run_swycmd([
            "exec", "notion.query.create",
            "--input", f"data_source_id={database_id}",
            "--body", json.dumps({"page_size": 100}),
            "--json",
        ])
        # Check for Notion API errors even if HTTP 200
        api_error = data.get("data", {}).get("code")
        if api_error and api_error != "ok":
            error_msg = data.get("data", {}).get("message", "Unknown Notion error")
            print(f"[notion] Database query error: {error_msg}")
            return []
        return data.get("data", {}).get("results", [])
    except Exception as e:
        print(f"[notion] Database query exception: {e}")
        return []


def check_duplicate(
    email_id: str,
    existing: Optional[list[dict]] = None,
) -> bool:
    if existing is None:
        existing = query_existing()
    for page in existing:
        props = page.get("properties", {})
        source_field = props.get("Source Email ID", {})
        rich_text = source_field.get("rich_text", [])
        if rich_text and rich_text[0].get("plain_text") == email_id:
            return True
    return False


def check_duplicate_fallback(
    name: str,
    organization: Optional[str],
    deadline: Optional[str],
    existing: Optional[list[dict]] = None,
) -> bool:
    if existing is None:
        existing = query_existing()
    for page in existing:
        props = page.get("properties", {})
        name_field = props.get("Name", {})
        title_arr = name_field.get("title", [])
        page_name = title_arr[0].get("plain_text", "") if title_arr else ""
        if page_name.lower() != (name or "").lower():
            continue
        org_field = props.get("Organization", {})
        org_rich = org_field.get("rich_text", [])
        page_org = org_rich[0].get("plain_text", "") if org_rich else ""
        if page_org.lower() != (organization or "").lower():
            continue
        if deadline:
            dl_field = props.get("Deadline", {})
            page_dl = dl_field.get("date", {})
            page_dl_str = page_dl.get("start", "") if page_dl else ""
            if page_dl_str == deadline:
                return True
    return False


def build_notion_properties(opp: Opportunity) -> dict:
    props = {
        "Name": {
            "title": [{"text": {"content": opp.name or "Unknown Opportunity"}}]
        },
        "Organization": {
            "rich_text": [{"text": {"content": opp.organization or ""}}]
        },
        "Type": {
            "select": {"name": opp.type} if opp.type else None
        },
        "Status": {
            "select": {"name": "New"}
        },
        "Source Email ID": {
            "rich_text": [{"text": {"content": opp.source_email_id or ""}}]
        },
    }
    if opp.deadline:
        props["Deadline"] = {"date": {"start": opp.deadline}}
    if opp.url:
        props["URL"] = {"url": opp.url}
    return props


def prepare_notion_payload(opp: Opportunity) -> dict:
    return {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": build_notion_properties(opp),
    }
