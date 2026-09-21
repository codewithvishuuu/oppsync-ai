from __future__ import annotations

import re
from typing import Optional

from agent.config import VALID_OPPORTUNITY_TYPES
from agent.models import Opportunity


def validate_opportunity(opp: Opportunity) -> dict:
    errors = []

    if not opp.source_email_id:
        errors.append("source_email_id is required")

    if not opp.name or not opp.name.strip():
        errors.append("name is required and must be non-empty")

    if opp.type is not None and opp.type not in VALID_OPPORTUNITY_TYPES:
        errors.append(f"type must be one of {VALID_OPPORTUNITY_TYPES}, got '{opp.type}'")

    if opp.deadline is not None:
        from datetime import datetime
        try:
            datetime.fromisoformat(opp.deadline.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                datetime.strptime(opp.deadline, "%Y-%m-%d")
            except ValueError:
                errors.append(f"deadline format invalid: '{opp.deadline}'")

    if opp.url is not None:
        if not opp.url.strip():
            errors.append("url must not be empty string")
        elif not opp.url.startswith(("http://", "https://")):
            errors.append(f"url must start with http:// or https://, got '{opp.url}'")

    if opp.confidence < 0.0 or opp.confidence > 1.0:
        errors.append(f"confidence must be 0.0-1.0, got {opp.confidence}")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }
