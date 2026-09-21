from __future__ import annotations

from typing import Optional

from agent.notion import check_duplicate, check_duplicate_fallback
from agent.calendar import check_calendar_duplicate


def is_duplicate(
    email_id: str,
    name: Optional[str] = None,
    organization: Optional[str] = None,
    deadline: Optional[str] = None,
    existing_notion: Optional[list[dict]] = None,
    existing_calendar: Optional[list[dict]] = None,
) -> dict:
    notion_dup = check_duplicate(email_id, existing_notion)
    notion_fallback = False
    if not notion_dup and name:
        notion_fallback = check_duplicate_fallback(
            name, organization, deadline, existing_notion
        )
    calendar_dup = False
    if name and deadline:
        calendar_dup = check_calendar_duplicate(
            name, deadline, existing_events=existing_calendar
        )
    return {
        "is_duplicate": notion_dup or notion_fallback or calendar_dup,
        "notion_exact_match": notion_dup,
        "notion_fallback_match": notion_fallback,
        "calendar_match": calendar_dup,
    }
