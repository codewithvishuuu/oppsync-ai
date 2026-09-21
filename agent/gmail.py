from __future__ import annotations

import json
import os
import subprocess
from typing import Optional

import shutil

from agent.config import SWYTCHCODE_CWD, DEFAULT_SCAN_LIMIT
from agent.models import EmailMessage


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
    raise FileNotFoundError("swytchcode.js not found in npm global directory")


def _run_swycmd(args: list[str]) -> dict:
    import time
    node = _find_node()
    swy_js = _find_swytchcode_js()
    t0 = time.time()
    result = subprocess.run(
        [node, swy_js] + args,
        cwd=SWYTCHCODE_CWD,
        capture_output=True,
        timeout=30,
    )
    elapsed = time.time() - t0
    tool_name = args[1] if len(args) > 1 else "unknown"
    print(f"[TIMING] swy {tool_name}: {elapsed:.1f}s", flush=True)
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


def _run_swycmd_stdin(payload: dict) -> dict:
    import time
    node = _find_node()
    swy_js = _find_swytchcode_js()
    stdin_json = json.dumps(payload)
    t0 = time.time()
    proc = subprocess.Popen(
        [node, swy_js, "exec", "--json"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=SWYTCHCODE_CWD,
    )
    try:
        stdout_bytes, stderr_bytes = proc.communicate(
            input=stdin_json.encode("utf-8"),
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        raise RuntimeError("swy exec (stdin) timed out after 30s")
    elapsed = time.time() - t0
    print(f"[TIMING] swy exec (stdin) {payload.get('tool','?')}: {elapsed:.1f}s", flush=True)
    stdout = stdout_bytes.decode("utf-8", errors="replace")
    stderr = stderr_bytes.decode("utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(
            f"swy exec (stdin) failed: {stderr.strip()}"
        )
    raw = stdout.strip()
    for line in raw.split("\n"):
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    return {"raw": raw}


def fetch_recent_emails(limit: int = DEFAULT_SCAN_LIMIT) -> list[EmailMessage]:
    import time
    limit = int(limit)
    t0 = time.time()
    data = _run_swycmd_stdin({
        "tool": "gmail.user.messages.get",
        "args": {"userId": "me", "maxResults": limit},
    })
    print(f"[TIMING] messages.list: {time.time()-t0:.1f}s", flush=True)

    messages_raw = data.get("data", {}).get("messages", [])
    emails = []
    for msg_ref in messages_raw[:limit]:
        msg_id = msg_ref.get("id", "")
        if not msg_id:
            continue
        emails.append(EmailMessage(
            id=msg_id,
            thread_id=msg_ref.get("threadId", ""),
            subject="",
            snippet="",
            from_address="",
            date="",
            labels=[],
        ))
    return emails


def fetch_email_body(msg_id: str) -> str:
    try:
        detail = _run_swycmd([
            "exec", "gmail.user.messages.get1",
            "--input", "userId=me",
            "--input", f"id={msg_id}",
            "--input", "format=full",
            "--json",
        ])
        payload = detail.get("data", {}).get("payload", {})
        return _extract_text(payload)
    except Exception:
        return ""


def _extract_text(payload: dict) -> str:
    parts = payload.get("parts", [])
    if parts:
        texts = []
        for part in parts:
            if part.get("mimeType") == "text/plain":
                import base64
                data = part.get("body", {}).get("data", "")
                if data:
                    texts.append(base64.urlsafe_b64decode(data).decode("utf-8", errors="replace"))
            elif part.get("mimeType") == "text/html":
                import base64
                data = part.get("body", {}).get("data", "")
                if data and not texts:
                    html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                    import re
                    texts.append(re.sub(r"<[^>]+>", " ", html))
        return "\n".join(texts).strip()
    else:
        import base64
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    return ""
