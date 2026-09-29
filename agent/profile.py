"""Student profile loading.

The profile is a plain JSON file at the project root (``student_profile.json``).
This deliberately avoids a ``state.db`` migration and any new dependency.

If the file is absent or malformed, ``load_profile`` returns ``None`` and the
eligibility layer reports an ``unknown`` state. It never raises and never
blocks scanning.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

_PROJECT_ROOT = Path(__file__).parent.parent
PROFILE_PATH = _PROJECT_ROOT / "student_profile.json"


class StudentProfile(BaseModel):
    """What the student brings to the comparison.

    Every field is optional. A missing field is treated as "unknown" during
    scoring -- it is never assumed to satisfy a requirement.
    """

    degree: Optional[str] = None
    year: Optional[int] = None
    graduation_year: Optional[int] = None
    skills: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    location: Optional[str] = None
    cgpa: Optional[float] = None


def load_profile(path: Optional[os.PathLike] = None) -> Optional[StudentProfile]:
    """Load the student profile, or return ``None`` if unavailable.

    Never raises. Missing file, unreadable file, invalid JSON, or a schema
    mismatch all yield ``None`` so that scanning continues unaffected.
    """
    target = Path(path) if path is not None else PROFILE_PATH
    try:
        if not target.is_file():
            return None
        raw = target.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            return None
        return StudentProfile(**data)
    except Exception:
        return None


def profile_exists(path: Optional[os.PathLike] = None) -> bool:
    target = Path(path) if path is not None else PROFILE_PATH
    try:
        return target.is_file()
    except Exception:
        return False
