"""Deterministic eligibility + match scoring.

This module contains NO AI calls. It compares *structured requirements* that
were explicitly extracted from an opportunity email against a StudentProfile
and produces a transparent, reproducible result.

Scoring contract
----------------
1. Only criteria the opportunity **explicitly stated** are scored. A criterion
   the email never mentioned is reported as ``unknown`` -- it never silently
   becomes a match.
2. A criterion is ``unknown`` (not ``match``) when the *student* is missing the
   corresponding profile field, or when the requirement cannot be evaluated
   from structured data (e.g. free-text requirements).
3. ``match_score`` is ``100 * (weight of matched criteria / weight of evaluated
   criteria)``. Unknown criteria are excluded from the denominator but reduce
   ``confidence``, which is simply the fraction of stated weight that could be
   evaluated.
4. ``match_score`` is ``None`` (not 0) when nothing could be evaluated, so the
   UI can say "unknown" instead of showing a misleading 0%.

Hard requirements (cgpa, degree, year, required skills, location) can produce an
``unlikely_eligible`` verdict. Soft preferences never do.

Year requirements come in two non-interchangeable shapes:

* ``eligible_years``   -- closed set. ``[2]`` means "2nd year ONLY".
* ``min_eligible_year`` -- inclusive lower bound. ``2`` means "2nd year OR ABOVE".

A single-element ``eligible_years`` is never silently promoted to a range; the
extraction layer decides which field to populate based on the email's wording.
"""

from __future__ import annotations

import re
from typing import Optional

from agent.models import CriterionResult, EligibilityResult, OpportunityRequirements
from agent.profile import StudentProfile

# --------------------------------------------------------------------------
# Scoring weights. Only weights for criteria the opportunity actually stated
# are used; the score is normalised over evaluated weight.
# --------------------------------------------------------------------------
WEIGHTS = {
    "min_cgpa": 0.30,
    "max_cgpa": 0.10,
    "eligible_degrees": 0.25,
    "eligible_years": 0.15,
    # Same weight as eligible_years: it is the same criterion expressed as an
    # inclusive lower bound instead of a closed list.
    "min_eligible_year": 0.15,
    "min_graduation_year": 0.08,
    "max_graduation_year": 0.08,
    "required_skills": 0.15,
    "preferred_skills": 0.05,
    "allowed_locations": 0.05,
    # Free-text requirements are never machine-checkable, so they can never be
    # a match or a mismatch. The weight exists ONLY to lower confidence
    # coverage -- match_score still sums match/mismatch criteria only.
    "other_requirement": 0.10,
}

HARD_CRITERIA = {
    "min_cgpa",
    "max_cgpa",
    "eligible_degrees",
    "eligible_years",
    "min_eligible_year",
    "required_skills",
    "allowed_locations",
    "min_graduation_year",
    "max_graduation_year",
}

UNDERGRAD_COMPACT = {
    "bca", "bsc", "ba", "bcom", "btech", "be", "bba", "bms", "bdes", "bfa",
    "bs", "ballb", "bcait", "bscit", "bedtech", "btechcse",
}
POSTGRAD_COMPACT = {
    "mca", "msc", "mt", "mtech", "me", "mba", "ma", "ms", "phd", "mbbs",
    "mds", "mcom", "mba", "msw",
}

GENERIC_DEGREE_TOKENS = {
    "undergraduate": "undergraduate",
    "undergrad": "undergraduate",
    "ug": "undergraduate",
    "undergraduate students": "undergraduate",
    "undergraduates": "undergraduate",
    "graduate": "graduate",
    "graduates": "graduate",
    "postgraduate": "postgraduate",
    "postgrad": "postgraduate",
    "pg": "postgraduate",
    "phd": "postgraduate",
    "any": "any",
    "any degree": "any",
    "any student": "any",
    "any students": "any",
    "all students": "any",
    "all": "any",
    "everyone": "any",
    "no restriction": "any",
    "open to all": "any",
}

SKILL_SYNONYMS = [
    {"aws", "amazonwebservices"},
    {"gcp", "googlecloud", "googlecloudplatform"},
    {"azure"},
    {"cloud", "cloudcomputing", "cloudnative"},
    {"ml", "machinelearning"},
    {"ai", "artificialintelligence"},
    {"devops", "devopsengineer"},
    {"js", "javascript"},
    {"ts", "typescript"},
    {"py", "python"},
    {"react", "reactjs"},
    {"node", "nodejs", "nodejs"},
    {"sql", "mysql", "postgresql", "postgres"},
    {"k8s", "kubernetes"},
    {"rest", "restapi"},
    {"ds", "datascience"},
]


# --------------------------------------------------------------------------
# Normalisation helpers
# --------------------------------------------------------------------------
def _norm(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9 ]+", " ", str(value).lower()).strip()


def _compact(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


def _norm_list(values: Optional[list[str]]) -> list[str]:
    return [v for v in (_norm(x) for x in (values or [])) if v]


def _degree_level(value: Optional[str]) -> Optional[str]:
    c = _compact(value)
    if not c:
        return None
    if c in UNDERGRAD_COMPACT:
        return "undergraduate"
    if c in POSTGRAD_COMPACT:
        return "postgraduate"
    return None


def _generic_degree_kind(token: str) -> Optional[str]:
    return GENERIC_DEGREE_TOKENS.get(token) or GENERIC_DEGREE_TOKENS.get(_compact(token))


def _skill_match(profile_skills: list[str], wanted: str) -> bool:
    target = _compact(wanted)
    if not target:
        return False
    for ps in profile_skills:
        c = _compact(ps)
        if not c:
            continue
        if c == target:
            return True
        if len(target) >= 3 and len(c) >= 3 and (target in c or c in target):
            return True
        for group in SKILL_SYNONYMS:
            if target in group and c in group:
                return True
    return False


def _location_match(profile_location: str, allowed: list[str]) -> bool:
    p = _norm(profile_location)
    p_compact = _compact(profile_location)
    for a in allowed:
        an = _norm(a)
        ac = _compact(a)
        if not an:
            continue
        if an == p or ac == p_compact:
            return True
        if len(ac) >= 4 and ac in p_compact:
            return True
        if len(p_compact) >= 4 and p_compact in ac:
            return True
    return False


def _fmt_num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(v)


# --------------------------------------------------------------------------
# Individual criterion checks. Each returns (status, detail) where status is
# "match" | "mismatch" | "unknown".
# --------------------------------------------------------------------------
def _check_min_cgpa(req: float, profile: StudentProfile):
    if profile.cgpa is None:
        return "unknown", f"Minimum CGPA {_fmt_num(req)} stated, but profile has no CGPA"
    if profile.cgpa >= req:
        return "match", f"CGPA {_fmt_num(profile.cgpa)} meets minimum {_fmt_num(req)}"
    return "mismatch", f"CGPA {_fmt_num(profile.cgpa)} is below minimum {_fmt_num(req)}"


def _check_max_cgpa(req: float, profile: StudentProfile):
    if profile.cgpa is None:
        return "unknown", f"Maximum CGPA {_fmt_num(req)} stated, but profile has no CGPA"
    if profile.cgpa <= req:
        return "match", f"CGPA {_fmt_num(profile.cgpa)} within maximum {_fmt_num(req)}"
    return "mismatch", f"CGPA {_fmt_num(profile.cgpa)} is above maximum {_fmt_num(req)}"


def _check_degrees(req: list[str], profile: StudentProfile):
    listed = _norm_list(req)
    if not listed:
        return "unknown", "Degree requirement stated but unreadable"
    if not profile.degree:
        return "unknown", f"Degree requirement stated ({', '.join(listed)}), but profile has no degree"

    kinds = {k for k in (_generic_degree_kind(t) for t in listed) if k}
    profile_compact = _compact(profile.degree)
    profile_level = _degree_level(profile.degree)

    if kinds:
        if "any" in kinds:
            return "match", f"{profile.degree} accepted (opportunity open to all students)"
        wanted_levels = kinds
        if profile_level is None:
            return "unknown", (
                f"Opportunity targets {', '.join(sorted(wanted_levels))}, "
                f"could not map profile degree '{profile.degree}' to a level"
            )
        if profile_level in wanted_levels or (
            "graduate" in wanted_levels and profile_level == "undergraduate"
        ) or ("postgraduate" in wanted_levels and profile_level == "graduate"):
            return "match", f"{profile.degree} ({profile_level}) matches {', '.join(sorted(wanted_levels))}"
        return "mismatch", (
            f"Opportunity targets {', '.join(sorted(wanted_levels))}, "
            f"profile is {profile.degree} ({profile_level})"
        )

    listed_compact = {_compact(t) for t in listed}
    if profile_compact in listed_compact:
        return "match", f"{profile.degree} degree matches"
    return "mismatch", f"Opportunity lists {', '.join(listed)}; profile is {profile.degree}"


def _check_years(req: list[int], profile: StudentProfile):
    years = sorted({int(y) for y in req if y is not None})
    if not years:
        return "unknown", "Year requirement stated but unreadable"
    if profile.year is None:
        return "unknown", (
            f"Eligible year(s) {', '.join(str(y) for y in years)} stated, but profile has no year"
        )
    if profile.year in years:
        return "match", f"Year {profile.year} matches eligible year(s)"
    return "mismatch", (
        f"Opportunity is for year(s) {', '.join(str(y) for y in years)}; profile is year {profile.year}"
    )


def _check_min_year(req: int, profile: StudentProfile):
    """Inclusive lower bound, e.g. "2nd year or above" -> min_eligible_year=2.

    Distinct from _check_years, which is exact closed-set membership.
    """
    if profile.year is None:
        return "unknown", (
            f"Opportunity requires year {req} or above, but profile has no year"
        )
    if profile.year >= req:
        return "match", f"Year {profile.year} satisfies year {req} or above"
    return "mismatch", (
        f"Opportunity requires year {req} or above; profile is year {profile.year}"
    )


def _check_graduation_year(req: Optional[int], profile: StudentProfile, kind: str):
    if req is None:
        return "unknown", "unreadable"
    if profile.graduation_year is None:
        return "unknown", (
            f"{kind.capitalize()} graduation year {req} stated, but profile has no graduation year"
        )
    if kind == "min":
        ok = profile.graduation_year >= req
    else:
        ok = profile.graduation_year <= req
    if ok:
        return "match", f"Graduation year {profile.graduation_year} satisfies {kind} {req}"
    return "mismatch", (
        f"Graduation year {profile.graduation_year} does not satisfy {kind} {req}"
    )


def _check_skills(req: list[str], profile: StudentProfile, kind: str):
    wanted = [s for s in (_norm(x) for x in req) if s]
    if not wanted:
        return "unknown", f"{kind} skills stated but unreadable"
    if not profile.skills:
        return "unknown", f"Opportunity lists {kind} skills, but profile has no skills"

    matched = [w for w in wanted if _skill_match(profile.skills, w)]
    missing = [w for w in wanted if w not in matched]

    if kind == "required":
        if not missing:
            return "match", f"All required skills matched ({', '.join(matched)})"
        if matched:
            return "mismatch", (
                f"Missing required skill(s): {', '.join(missing)} (matched: {', '.join(matched)})"
            )
        return "mismatch", f"No required skills matched (needs: {', '.join(wanted)})"

    # preferred
    if matched:
        return "match", f"Preferred skill(s) matched ({', '.join(matched)})"
    return "mismatch", f"No preferred skills matched (nice to have: {', '.join(wanted)})"


def _check_locations(req: list[str], profile: StudentProfile):
    allowed = _norm_list(req)
    if not allowed:
        return "unknown", "Location requirement stated but unreadable"
    if not profile.location:
        return "unknown", (
            f"Location limited to {', '.join(allowed)}, but profile has no location"
        )
    if _location_match(profile.location, allowed):
        return "match", f"Location {profile.location} is allowed"
    return "mismatch", (
        f"Opportunity is limited to {', '.join(allowed)}; profile location is {profile.location}"
    )


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------
def evaluate_eligibility(
    requirements: Optional[OpportunityRequirements],
    profile: Optional[StudentProfile],
) -> EligibilityResult:
    """Compare explicit requirements against a profile. Pure function, no I/O."""
    if requirements is None or requirements.is_empty():
        return EligibilityResult(
            match_score=None,
            eligibility="unknown",
            matching_factors=[],
            potential_gaps=[],
            unknown_requirements=["Opportunity did not state any eligibility requirements"],
            signals=[],
            confidence=0.0,
        )

    if profile is None:
        return EligibilityResult(
            match_score=None,
            eligibility="unknown",
            matching_factors=[],
            potential_gaps=[],
            unknown_requirements=["No student profile configured"],
            signals=[],
            confidence=0.0,
        )

    signals: list[CriterionResult] = []
    matching_factors: list[str] = []
    potential_gaps: list[str] = []
    unknown_requirements: list[str] = []

    def add(criterion: str, status: str, detail: str) -> None:
        signals.append(CriterionResult(criterion=criterion, status=status, detail=detail))
        if status == "match":
            matching_factors.append(detail)
        elif status == "mismatch":
            potential_gaps.append(detail)
        else:
            unknown_requirements.append(detail)

    if requirements.min_cgpa is not None:
        add("min_cgpa", *_check_min_cgpa(requirements.min_cgpa, profile))
    if requirements.max_cgpa is not None:
        add("max_cgpa", *_check_max_cgpa(requirements.max_cgpa, profile))
    if requirements.eligible_degrees is not None:
        add("eligible_degrees", *_check_degrees(requirements.eligible_degrees, profile))
    if requirements.eligible_years is not None:
        add("eligible_years", *_check_years(requirements.eligible_years, profile))
    if requirements.min_eligible_year is not None:
        add("min_eligible_year", *_check_min_year(requirements.min_eligible_year, profile))
    if requirements.min_graduation_year is not None:
        add("min_graduation_year", *_check_graduation_year(requirements.min_graduation_year, profile, "min"))
    if requirements.max_graduation_year is not None:
        add("max_graduation_year", *_check_graduation_year(requirements.max_graduation_year, profile, "max"))
    if requirements.required_skills is not None:
        add("required_skills", *_check_skills(requirements.required_skills, profile, "required"))
    if requirements.preferred_skills is not None:
        add("preferred_skills", *_check_skills(requirements.preferred_skills, profile, "preferred"))
    if requirements.allowed_locations is not None:
        add("allowed_locations", *_check_locations(requirements.allowed_locations, profile))

    for text in requirements.other_requirements or []:
        add("other_requirement", "unknown", f"Stated requirement not machine-checkable: {text}")

    matched_weight = sum(WEIGHTS.get(s.criterion, 0.0) for s in signals if s.status == "match")
    evaluated_weight = sum(
        WEIGHTS.get(s.criterion, 0.0) for s in signals if s.status in ("match", "mismatch")
    )
    stated_weight = evaluated_weight + sum(
        WEIGHTS.get(s.criterion, 0.0) for s in signals if s.status == "unknown"
    )

    match_score: Optional[int]
    if evaluated_weight > 0:
        match_score = int(round(100 * matched_weight / evaluated_weight))
    else:
        match_score = None

    coverage = (evaluated_weight / stated_weight) if stated_weight > 0 else 0.0

    hard_mismatch = any(
        s.criterion in HARD_CRITERIA and s.status == "mismatch" for s in signals
    )
    any_match = any(s.status == "match" for s in signals)
    any_unknown = any(s.status == "unknown" for s in signals)

    if hard_mismatch:
        verdict = "unlikely_eligible"
    elif evaluated_weight > 0 and not any_unknown:
        verdict = "likely_eligible"
    elif evaluated_weight > 0 and any_match:
        verdict = "possible"
    else:
        verdict = "unknown"

    return EligibilityResult(
        match_score=match_score,
        eligibility=verdict,
        matching_factors=matching_factors,
        potential_gaps=potential_gaps,
        unknown_requirements=unknown_requirements,
        signals=signals,
        confidence=round(coverage, 2),
    )


def analyze_opportunity(opp, profile: Optional[StudentProfile] = None) -> EligibilityResult:
    """Convenience wrapper: evaluate an Opportunity's own requirements."""
    if profile is None:
        from agent.profile import load_profile

        profile = load_profile()
    return evaluate_eligibility(getattr(opp, "requirements", None), profile)
