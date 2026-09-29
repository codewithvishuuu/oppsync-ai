from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import BaseModel, Field, field_validator

from agent.config import VALID_OPPORTUNITY_TYPES


class OpportunityRequirements(BaseModel):
    """Eligibility criteria EXPLICITLY stated in the opportunity email.

    Every field is optional and defaults to ``None``. ``None`` means "the email
    did not state this requirement" -- it must never be interpreted as "no
    requirement" or as a satisfied requirement.

    Year semantics are deliberately two separate fields:
    ``eligible_years`` is a CLOSED list ("2nd year only" -> ``[2]``), while
    ``min_eligible_year`` is an inclusive lower bound ("2nd year or above" ->
    ``2``). They are never interchangeable, and a single-element
    ``eligible_years`` is never treated as an open range.
    """

    eligible_degrees: Optional[list[str]] = None
    eligible_years: Optional[list[int]] = None
    min_eligible_year: Optional[int] = None
    min_cgpa: Optional[float] = None
    max_cgpa: Optional[float] = None
    min_graduation_year: Optional[int] = None
    max_graduation_year: Optional[int] = None
    required_skills: Optional[list[str]] = None
    preferred_skills: Optional[list[str]] = None
    allowed_locations: Optional[list[str]] = None
    other_requirements: Optional[list[str]] = None
    source_quote: Optional[str] = None

    #: Fields that represent an actual eligibility criterion. ``source_quote``
    #: is provenance metadata, not something a student can match against.
    CRITERION_FIELDS: ClassVar[tuple[str, ...]] = (
        "eligible_degrees",
        "eligible_years",
        "min_eligible_year",
        "min_cgpa",
        "max_cgpa",
        "min_graduation_year",
        "max_graduation_year",
        "required_skills",
        "preferred_skills",
        "allowed_locations",
        "other_requirements",
    )

    def stated_criteria(self) -> list[str]:
        """Names of criteria the email explicitly mentions."""
        return [f for f in self.CRITERION_FIELDS if getattr(self, f, None) is not None]

    def is_empty(self) -> bool:
        return not self.stated_criteria()


class CriterionResult(BaseModel):
    """Outcome of comparing one requirement against the student profile."""

    criterion: str
    status: str  # "match" | "mismatch" | "unknown"
    detail: str


class EligibilityResult(BaseModel):
    """Deterministic match outcome. Never produced by an LLM directly."""

    match_score: Optional[int] = None
    eligibility: str = "unknown"
    matching_factors: list[str] = Field(default_factory=list)
    potential_gaps: list[str] = Field(default_factory=list)
    unknown_requirements: list[str] = Field(default_factory=list)
    signals: list[CriterionResult] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)


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

    # Additive eligibility layer. Both default to None so every existing
    # payload (Notion/Calendar/frontend round-trips) stays valid.
    requirements: Optional[OpportunityRequirements] = None
    eligibility: Optional[EligibilityResult] = None

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
