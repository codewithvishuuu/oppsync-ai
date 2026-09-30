"""Deterministic deadline intelligence.

Pure, dependency-free functions. No Gemini, no Gmail, no Notion, no Calendar,
no I/O, no UI. ``Opportunity.deadline`` remains the single source of truth and
is never modified here -- this module only *reads* it and derives urgency.

Date semantics
--------------
Opportunity deadlines are stored date-only (``YYYY-MM-DD``) and are written
straight into Notion/Google Calendar as date values, so all arithmetic is done
on :class:`datetime.date`. No time-of-day and no timezone is involved, which
keeps results identical on every machine and in every timezone.

Status ladder (deterministic, mutually exclusive, ordered by urgency)
----------------------------------------------------------------------
======================  =========================  ====================
``deadline_status``     condition                  ``urgency``
======================  =========================  ====================
``no_deadline``         no usable deadline         ``unknown``
``expired``             days_remaining < 0         ``expired``
``today``               days_remaining == 0        ``critical``
``critical``            1 <= days_remaining <= 3   ``critical``
``urgent``              4 <= days_remaining <= 7   ``urgent``
``upcoming``            8 <= days_remaining <= 14  ``upcoming``
``normal``              days_remaining >= 15       ``normal``
======================  =========================  ====================

``is_expired`` is True only when the deadline is strictly before the reference
date. A deadline falling today is *not* expired; it is simply the most urgent
non-expired state.

Malformed input
---------------
A deadline that cannot be parsed degrades to the same safe result as a missing
deadline (``no_deadline`` / ``unknown`` / ``is_expired=False``), matching the
``"reason": "no_deadline"`` convention already used in ``agent/writer.py`` and
``agent/write_calendar.py``. A bad deadline must never take down a scan.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from agent.models import DeadlineIntelligence

# Urgency thresholds, in whole days remaining.
CRITICAL_MAX_DAYS = 3
URGENT_MAX_DAYS = 7
UPCOMING_MAX_DAYS = 14

STATUS_NO_DEADLINE = "no_deadline"
STATUS_EXPIRED = "expired"
STATUS_TODAY = "today"
STATUS_CRITICAL = "critical"
STATUS_URGENT = "urgent"
STATUS_UPCOMING = "upcoming"
STATUS_NORMAL = "normal"

URGENCY_UNKNOWN = "unknown"
URGENCY_EXPIRED = "expired"
URGENCY_CRITICAL = "critical"
URGENCY_URGENT = "urgent"
URGENCY_UPCOMING = "upcoming"
URGENCY_NORMAL = "normal"

#: Every ``deadline_status`` this module can emit.
DEADLINE_STATUSES = (
    STATUS_NO_DEADLINE,
    STATUS_EXPIRED,
    STATUS_TODAY,
    STATUS_CRITICAL,
    STATUS_URGENT,
    STATUS_UPCOMING,
    STATUS_NORMAL,
)

#: Every ``urgency`` this module can emit.
URGENCIES = (
    URGENCY_UNKNOWN,
    URGENCY_EXPIRED,
    URGENCY_CRITICAL,
    URGENCY_URGENT,
    URGENCY_UPCOMING,
    URGENCY_NORMAL,
)


def parse_deadline(value) -> Optional[date]:
    """Parse a stored deadline into a :class:`datetime.date`.

    Accepts ``YYYY-MM-DD`` and ISO-8601 forms (with or without a time part and
    with or without a trailing ``Z``), which is exactly the set that
    ``Opportunity.validate_deadline`` accepts. Returns ``None`` for anything
    unparseable, including wrong types. Never raises.
    """
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    # Date-only first: the common case, and unambiguous.
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        pass

    # ISO with a time component; take the calendar date only.
    iso_candidate = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        return datetime.fromisoformat(iso_candidate).date()
    except (ValueError, AttributeError):
        return None


def resolve_reference_date(today=None) -> date:
    """Resolve the reference date. Accepts a date, a ``YYYY-MM-DD`` string, or
    nothing (which means today). Never raises."""
    if today is None:
        return date.today()
    if isinstance(today, datetime):
        return today.date()
    if isinstance(today, date):
        return today
    if isinstance(today, str):
        parsed = parse_deadline(today)
        if parsed is not None:
            return parsed
    return date.today()


def _no_deadline() -> DeadlineIntelligence:
    return DeadlineIntelligence(
        days_remaining=None,
        deadline_status=STATUS_NO_DEADLINE,
        urgency=URGENCY_UNKNOWN,
        is_expired=False,
    )


def calculate_deadline_intelligence(deadline, today=None) -> DeadlineIntelligence:
    """Derive urgency from an opportunity deadline. Pure and total.

    Never raises: any unparseable or missing deadline yields the safe
    ``no_deadline`` result.
    """
    target = parse_deadline(deadline)
    if target is None:
        return _no_deadline()

    reference = resolve_reference_date(today)
    days = (target - reference).days

    if days < 0:
        return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_EXPIRED, urgency=URGENCY_EXPIRED, is_expired=True)
    if days == 0:
        return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_TODAY, urgency=URGENCY_CRITICAL, is_expired=False)
    if days <= CRITICAL_MAX_DAYS:
        return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_CRITICAL, urgency=URGENCY_CRITICAL, is_expired=False)
    if days <= URGENT_MAX_DAYS:
        return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_URGENT, urgency=URGENCY_URGENT, is_expired=False)
    if days <= UPCOMING_MAX_DAYS:
        return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_UPCOMING, urgency=URGENCY_UPCOMING, is_expired=False)
    return DeadlineIntelligence(days_remaining=days, deadline_status=STATUS_NORMAL, urgency=URGENCY_NORMAL, is_expired=False)


def analyze_opportunity(opp, today=None) -> DeadlineIntelligence:
    """Convenience wrapper: derive intelligence from an Opportunity's deadline."""
    return calculate_deadline_intelligence(getattr(opp, "deadline", None), today=today)
