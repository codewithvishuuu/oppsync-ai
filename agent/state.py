"""Lightweight SQLite state store for tracking processed opportunities.

Tracks which emails have been approved or rejected so that future scans
can skip them before calling Gemini, saving API costs.

Uses Python built-in sqlite3 only. No new dependencies.
"""

from __future__ import annotations

import sqlite3
import os
from datetime import datetime, timezone
from typing import Optional

_DB_PATH: Optional[str] = None


def _get_db_path() -> str:
    global _DB_PATH
    if _DB_PATH is None:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        _DB_PATH = os.path.join(project_root, "state.db")
    return _DB_PATH


def _get_connection() -> sqlite3.Connection:
    db_path = _get_db_path()
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS processed (
            email_id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            name TEXT,
            timestamp TEXT NOT NULL,
            notion_page_id TEXT
        )
    """)
    conn.commit()
    return conn


def mark_processed(
    email_id: str,
    action: str,
    name: Optional[str] = None,
    notion_page_id: Optional[str] = None,
) -> None:
    """Record that an email has been processed (approved or rejected).

    Uses atomic UPSERT: inserts if new, updates if existing.
    Preserves existing notion_page_id when the new value is None.
    """
    try:
        conn = _get_connection()
        conn.execute(
            """
            INSERT INTO processed (email_id, action, name, timestamp, notion_page_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email_id) DO UPDATE SET
                action = excluded.action,
                timestamp = excluded.timestamp,
                name = COALESCE(excluded.name, processed.name),
                notion_page_id = COALESCE(excluded.notion_page_id, processed.notion_page_id)
            """,
            (
                email_id,
                action,
                name,
                datetime.now(timezone.utc).isoformat(),
                notion_page_id,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[state] Warning: failed to mark {email_id} as {action}: {e}")


def is_processed(email_id: str) -> bool:
    """Check if an email has already been processed (approved or rejected)."""
    try:
        conn = _get_connection()
        cursor = conn.execute(
            "SELECT 1 FROM processed WHERE email_id = ?", (email_id,)
        )
        result = cursor.fetchone() is not None
        conn.close()
        return result
    except Exception as e:
        print(f"[state] Warning: failed to check processed state for {email_id}: {e}")
        return False


def get_action(email_id: str) -> Optional[str]:
    """Get the action taken on an email ('approved' or 'rejected'), or None."""
    try:
        conn = _get_connection()
        cursor = conn.execute(
            "SELECT action FROM processed WHERE email_id = ?", (email_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        print(f"[state] Warning: failed to get action for {email_id}: {e}")
        return None
