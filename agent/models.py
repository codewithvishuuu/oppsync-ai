from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from agent.config import VALID_OPPORTUNITY_TYPES


class Opportunity(BaseModel):
    is_opportunity: bool
    name: Optional[str] = None
    organization: Optional[str] = None
    type: Optional[str] = None
    deadline: Optional[str] = None
    url: Optional[str] = None
    summary: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    source_email_id: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_OPPORTUNITY_TYPES:
            raise ValueError(
                f"type must be one of {VALID_OPPORTUNITY_TYPES}, got '{v}'"
            )
        return v

    @field_validator("deadline")
    @classmethod
    def validate_deadline(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                datetime.fromisoformat(v.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                try:
                    datetime.strptime(v, "%Y-%m-%d")
                except ValueError:
                    raise ValueError(
                        f"deadline must be ISO format or YYYY-MM-DD, got '{v}'"
                    )
        return v


class EmailMessage(BaseModel):
    id: str
    thread_id: str
    subject: str = ""
    snippet: str = ""
    from_address: str = ""
    date: str = ""
    labels: list[str] = Field(default_factory=list)


class ScanResult(BaseModel):
    opportunities: list[Opportunity]
    emails_scanned: int
    scan_timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat()
    )
    ai_quota_exhausted: bool = False
    ai_unavailable: bool = False
    ai_error: Optional[str] = None


class ConfirmationRequest(BaseModel):
    opportunity_index: int
    approved: bool
