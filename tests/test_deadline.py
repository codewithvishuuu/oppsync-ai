import sys
import os
import json
import unittest
import tempfile
from datetime import date, datetime
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.deadline import (
    calculate_deadline_intelligence,
    parse_deadline,
    resolve_reference_date,
    analyze_opportunity,
    DeadlineIntelligence,
    DEADLINE_STATUSES,
    URGENCIES,
    CRITICAL_MAX_DAYS,
    URGENT_MAX_DAYS,
    UPCOMING_MAX_DAYS,
)
from agent.models import Opportunity, DeadlineIntelligence as ModelDeadlineIntelligence

# Fixed reference date so nothing depends on the real clock.
TODAY = "2026-09-30"


def _di(deadline, today=TODAY):
    return calculate_deadline_intelligence(deadline, today=today)


class TestCase1NoDeadline(unittest.TestCase):
    def test_none_deadline(self):
        r = _di(None)
        self.assertIsNone(r.days_remaining)
        self.assertEqual(r.deadline_status, "no_deadline")
        self.assertEqual(r.urgency, "unknown")
        self.assertFalse(r.is_expired)

    def test_empty_string_deadline(self):
        r = _di("")
        self.assertEqual(r.deadline_status, "no_deadline")
        self.assertIsNone(r.days_remaining)

    def test_whitespace_deadline(self):
        r = _di("   ")
        self.assertEqual(r.deadline_status, "no_deadline")
        self.assertIsNone(r.days_remaining)


class TestCase2DeadlineToday(unittest.TestCase):
    def test_today(self):
        r = _di("2026-09-30")
        self.assertEqual(r.days_remaining, 0)
        self.assertEqual(r.deadline_status, "today")
        self.assertEqual(r.urgency, "critical")
        self.assertFalse(r.is_expired)


class TestCase3Tomorrow(unittest.TestCase):
    def test_tomorrow(self):
        r = _di("2026-10-01")
        self.assertEqual(r.days_remaining, 1)
        self.assertEqual(r.deadline_status, "critical")
        self.assertEqual(r.urgency, "critical")
        self.assertFalse(r.is_expired)


class TestCase4ThreeDays(unittest.TestCase):
    def test_three_days_is_last_critical_day(self):
        r = _di("2026-10-03")
        self.assertEqual(r.days_remaining, CRITICAL_MAX_DAYS)
        self.assertEqual(r.deadline_status, "critical")
        self.assertEqual(r.urgency, "critical")


class TestCase5FourDays(unittest.TestCase):
    def test_four_days_is_first_urgent_day(self):
        r = _di("2026-10-04")
        self.assertEqual(r.days_remaining, URGENT_MAX_DAYS - 3)
        self.assertEqual(r.deadline_status, "urgent")
        self.assertEqual(r.urgency, "urgent")


class TestCase6SevenDays(unittest.TestCase):
    def test_seven_days_is_last_urgent_day(self):
        r = _di("2026-10-07")
        self.assertEqual(r.days_remaining, URGENT_MAX_DAYS)
        self.assertEqual(r.deadline_status, "urgent")
        self.assertEqual(r.urgency, "urgent")


class TestCase7EightDays(unittest.TestCase):
    def test_eight_days_is_first_upcoming_day(self):
        r = _di("2026-10-08")
        self.assertEqual(r.days_remaining, URGENT_MAX_DAYS + 1)
        self.assertEqual(r.deadline_status, "upcoming")
        self.assertEqual(r.urgency, "upcoming")


class TestCase8FourteenDays(unittest.TestCase):
    def test_fourteen_days_is_last_upcoming_day(self):
        r = _di("2026-10-14")
        self.assertEqual(r.days_remaining, UPCOMING_MAX_DAYS)
        self.assertEqual(r.deadline_status, "upcoming")
        self.assertEqual(r.urgency, "upcoming")


class TestCase9FifteenDays(unittest.TestCase):
    def test_fifteen_days_is_first_normal_day(self):
        r = _di("2026-10-15")
        self.assertEqual(r.days_remaining, UPCOMING_MAX_DAYS + 1)
        self.assertEqual(r.deadline_status, "normal")
        self.assertEqual(r.urgency, "normal")


class TestCase10Expired(unittest.TestCase):
    def test_yesterday_is_expired_with_negative_days(self):
        r = _di("2026-09-29")
        self.assertEqual(r.days_remaining, -1)
        self.assertEqual(r.deadline_status, "expired")
        self.assertEqual(r.urgency, "expired")
        self.assertTrue(r.is_expired)

    def test_long_expired_keeps_meaningful_negative_days(self):
        r = _di("2026-01-01")
        self.assertEqual(r.days_remaining, -272)
        self.assertEqual(r.deadline_status, "expired")
        self.assertTrue(r.is_expired)

    def test_expired_is_not_negative_urgency(self):
        """Urgency must be the literal 'expired', not a negative or 'critical'."""
        r = _di("2020-01-01")
        self.assertEqual(r.urgency, "expired")
        self.assertNotIn(r.urgency, ("critical", "urgent", "normal", "upcoming"))

    def test_expired_boundaries(self):
        self.assertEqual(_di("2026-09-29").days_remaining, -1)
        self.assertTrue(_di("2026-09-29").is_expired)
        self.assertFalse(_di("2026-09-30").is_expired)


class TestCase11MalformedDeadline(unittest.TestCase):
    def test_malformed_values_never_raise(self):
        for bad in ["not-a-date", "15/10/2026", "2026-13-45", "October 5",
                    "TBD", "soon", "2026-99-99", "2026-02-30", 12345, [], {}, object()]:
            r = _di(bad)
            self.assertEqual(r.deadline_status, "no_deadline", f"for {bad!r}")
            self.assertIsNone(r.days_remaining)
            self.assertEqual(r.urgency, "unknown")
            self.assertFalse(r.is_expired)

    def test_parse_deadline_returns_none_for_bad_input(self):
        for bad in ["nope", "15/10/2026", "2026-02-30", None, 5, ""]:
            self.assertIsNone(parse_deadline(bad), f"for {bad!r}")

    def test_parse_deadline_accepts_both_stored_formats(self):
        self.assertEqual(parse_deadline("2026-10-05"), date(2026, 10, 5))
        self.assertEqual(parse_deadline("2026-10-05T10:30:00"), date(2026, 10, 5))
        self.assertEqual(parse_deadline("2026-10-05T10:30:00Z"), date(2026, 10, 5))
        self.assertEqual(parse_deadline("2026-10-05T10:30:00+00:00"), date(2026, 10, 5))

    def test_iso_with_time_uses_calendar_date_only(self):
        r = _di("2026-10-05T23:59:59Z")
        self.assertEqual(r.days_remaining, 5)
        self.assertEqual(r.deadline_status, "urgent")

    def test_malformed_does_not_crash_a_scan(self):
        """One bad deadline must not abort the whole scan pipeline."""
        from agent.agent import scan_emails, get_pending_confirmations

        bad = Opportunity(is_opportunity=True, name="Bad", type="internship",
                          confidence=0.9, source_email_id="m1", deadline="2026-10-05")
        # Simulate a deadline that became garbage after construction.
        object.__setattr__(bad, "deadline", "not-a-date")
        good = Opportunity(is_opportunity=True, name="Good", type="internship",
                           confidence=0.9, source_email_id="m2", deadline="2026-10-05")

        def detail(subject):
            return ({
                "data": {
                    "snippet": subject,
                    "payload": {"headers": [
                        {"name": "Subject", "value": subject},
                        {"name": "From", "value": "careers@example.com"},
                        {"name": "Date", "value": "Wed, 30 Sep 2026 00:00:00 +0000"},
                    ]},
                }
            }, "body")

        with patch("agent.agent.fetch_recent_emails") as fe, \
             patch("agent.agent.query_existing", return_value=[]), \
             patch("agent.agent._fetch_email_detail_and_body",
                   side_effect=[detail("Internship apply"), detail("Internship apply")]), \
             patch("agent.agent.extract_opportunity", side_effect=[bad, good]), \
             patch("agent.agent.is_processed", return_value=False), \
             patch("agent.agent.is_duplicate", return_value={"is_duplicate": False,
                                                              "notion_exact_match": False,
                                                              "notion_fallback_match": False,
                                                              "calendar_match": False}), \
             patch("agent.agent.load_profile", return_value=None):
            e1, e2 = MagicMock(), MagicMock()
            e1.id, e2.id = "m1", "m2"
            e1.subject = e2.subject = "Internship apply"
            e1.snippet = e2.snippet = "apply"
            fe.return_value = [e1, e2]
            result = scan_emails(limit=2)

        self.assertEqual(len(result.opportunities), 2)
        pending = get_pending_confirmations(result)
        self.assertEqual(pending[0]["deadline_intelligence"]["deadline_status"], "no_deadline")
        self.assertIsNone(pending[0]["deadline_intelligence"]["days_remaining"])
        self.assertIsNotNone(pending[1]["deadline_intelligence"])


class TestCase12DateBoundaries(unittest.TestCase):
    def test_leap_day_deadline(self):
        # 2028 is a leap year: 2028-02-29 exists.
        r = _di("2028-02-29", today="2028-02-28")
        self.assertEqual(r.days_remaining, 1)
        self.assertEqual(r.deadline_status, "critical")

    def test_non_leap_year_feb_29_is_malformed_not_a_date(self):
        r = _di("2027-02-29", today="2027-02-28")
        self.assertEqual(r.deadline_status, "no_deadline")
        self.assertIsNone(r.days_remaining)

    def test_month_boundary(self):
        r = _di("2026-10-01", today="2026-09-30")
        self.assertEqual(r.days_remaining, 1)

    def test_year_boundary(self):
        r = _di("2027-01-01", today="2026-12-31")
        self.assertEqual(r.days_remaining, 1)
        r2 = _di("2026-12-31", today="2027-01-01")
        self.assertTrue(r2.is_expired)
        self.assertEqual(r2.days_remaining, -1)

    def test_full_ladder_is_monotonic(self):
        """Every step further out must have status no more urgent than the last."""
        order = ["critical", "urgent", "upcoming", "normal"]
        seen = []
        for offset in range(1, 40):
            y, m, d = (2026, 9, 30)
            t = date(y, m, d).toordinal() + offset
            r = calculate_deadline_intelligence(date.fromordinal(t).isoformat(), today=TODAY)
            if r.deadline_status not in seen:
                seen.append(r.deadline_status)
        self.assertEqual(seen, order)


class TestCase13BackwardCompatibility(unittest.TestCase):
    def test_opportunity_without_deadline_unchanged(self):
        opp = Opportunity(is_opportunity=True, name="Legacy", organization="Acme",
                          type="internship", url="https://x.com", summary="s",
                          confidence=0.9, source_email_id="m1")
        self.assertIsNone(opp.deadline)
        self.assertIsNone(opp.deadline_intelligence)
        dumped = opp.model_dump()
        for key in ("is_opportunity", "name", "organization", "type", "deadline",
                    "url", "summary", "confidence", "source_email_id",
                    "requirements", "eligibility"):
            self.assertIn(key, dumped)
        self.assertIsNone(dumped["deadline_intelligence"])

    def test_legacy_payload_reconstructs_through_write_helper_constructor(self):
        legacy = {"is_opportunity": True, "name": "L", "organization": "A",
                  "type": "internship", "deadline": "2026-10-05", "url": None,
                  "summary": None, "confidence": 0.8, "source_email_id": "m2"}
        opp = Opportunity(**legacy)
        self.assertEqual(opp.deadline, "2026-10-05")
        self.assertIsNone(opp.deadline_intelligence)

    def test_round_trip_with_deadline_intelligence(self):
        opp = Opportunity(is_opportunity=True, name="R", confidence=0.9,
                          source_email_id="m3", deadline="2026-10-05")
        opp.deadline_intelligence = ModelDeadlineIntelligence(
            days_remaining=5, deadline_status="urgent", urgency="urgent", is_expired=False)
        again = Opportunity(**opp.model_dump())
        self.assertEqual(again.deadline_intelligence.deadline_status, "urgent")
        self.assertEqual(again.deadline, "2026-10-05")

    def test_deadline_meaning_and_type_unchanged(self):
        self.assertIsNone(Opportunity.model_fields["deadline"].default)
        self.assertIsNone(Opportunity.model_fields["deadline_intelligence"].default)

    def test_validation_still_accepts_legacy_opportunity(self):
        from agent.validation import validate_opportunity
        opp = Opportunity(is_opportunity=True, name="V", confidence=0.9,
                          source_email_id="m4", deadline="2026-10-05")
        self.assertTrue(validate_opportunity(opp)["valid"])

    def test_existing_eligibility_fields_untouched(self):
        opp = Opportunity(is_opportunity=True, name="E", confidence=0.9)
        self.assertIsNone(opp.requirements)
        self.assertIsNone(opp.eligibility)


class TestCase14ExtractionUnchanged(unittest.TestCase):
    def test_gemini_still_extracts_plain_deadline_only(self):
        """Deadline intelligence must not change what Gemini is asked for."""
        from agent.gemini import SYSTEM_PROMPT, extract_opportunity

        self.assertIn('"deadline": "ISO date string (YYYY-MM-DD) or null"', SYSTEM_PROMPT)
        self.assertNotIn("urgency", SYSTEM_PROMPT.lower().replace("deadline intelligence", ""))
        self.assertNotIn("days_remaining", SYSTEM_PROMPT)

        payload = json.dumps({
            "is_opportunity": True, "name": "Deadline Test", "type": "internship",
            "deadline": "2026-10-05", "confidence": 0.9,
        })
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "candidates": [{"content": {"parts": [{"text": payload}]}}]
        }).encode()
        with patch("agent.gemini.urllib.request.urlopen", return_value=mock_resp):
            opp = extract_opportunity(subject="s", snippet="sn", body="b", email_id="m5")
        self.assertEqual(opp.deadline, "2026-10-05")
        self.assertIsNone(opp.deadline_intelligence)

    def test_intelligence_is_derived_not_extracted(self):
        opp = Opportunity(is_opportunity=True, name="D", confidence=0.9,
                          source_email_id="m6", deadline="2026-10-05")
        di = analyze_opportunity(opp, today=TODAY)
        self.assertEqual(di.days_remaining, 5)
        self.assertEqual(di.deadline_status, "urgent")
        self.assertEqual(opp.deadline_intelligence, None)

    def test_analyze_opportunity_tolerates_object_without_deadline(self):
        class Bare:
            pass
        r = analyze_opportunity(Bare(), today=TODAY)
        self.assertEqual(r.deadline_status, "no_deadline")


class TestStatusVocabulary(unittest.TestCase):
    def test_only_defined_statuses_are_emitted(self):
        samples = [None, "", "2026-09-30", "2026-10-01", "2026-10-03", "2026-10-04",
                   "2026-10-07", "2026-10-08", "2026-10-14", "2026-10-15",
                   "2026-01-01", "garbage"]
        seen_status, seen_urgency = set(), set()
        for s in samples:
            r = _di(s)
            seen_status.add(r.deadline_status)
            seen_urgency.add(r.urgency)
        self.assertTrue(seen_status <= set(DEADLINE_STATUSES), seen_status - set(DEADLINE_STATUSES))
        self.assertTrue(seen_urgency <= set(URGENCIES), seen_urgency - set(URGENCIES))
        self.assertEqual(len(seen_status), 7)  # all seven states reachable

    def test_reference_date_injection_shapes(self):
        for today in ("2026-09-30", date(2026, 9, 30), datetime(2026, 9, 30, 15, 30)):
            r = calculate_deadline_intelligence("2026-10-05", today=today)
            self.assertEqual(r.days_remaining, 5)

    def test_defaults_to_real_today_when_not_injected(self):
        r = calculate_deadline_intelligence(None)
        self.assertEqual(r.deadline_status, "no_deadline")
        r2 = calculate_deadline_intelligence(date.today().isoformat())
        self.assertEqual(r2.days_remaining, 0)
        self.assertEqual(r2.deadline_status, "today")

    def test_result_object_shape(self):
        d = _di("2026-10-05").model_dump()
        self.assertEqual(set(d), {"days_remaining", "deadline_status", "urgency", "is_expired"})
        self.assertEqual(d["days_remaining"], 5)

    def test_module_imports_only_datetime_and_project_models(self):
        """Check real imports, not prose: the docstring names these services."""
        import ast
        import agent.deadline as D

        tree = ast.parse(open(D.__file__, encoding="utf-8").read())
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(a.name for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        self.assertEqual(imported, {"__future__", "datetime", "typing", "agent.models"})

    def test_module_uses_the_single_project_model(self):
        """One DeadlineIntelligence type, defined in models.py -- no duplicates."""
        import agent.deadline as D
        from agent.models import DeadlineIntelligence as M
        self.assertIs(D.DeadlineIntelligence, M)
        self.assertEqual(type(_di("2026-10-05")), M)

    def test_module_pulls_in_no_other_agent_service(self):
        """Importing agent.deadline must not drag in gemini/gmail/notion/calendar."""
        import subprocess
        code = (
            "import sys; import agent.deadline; "
            "bad=[m for m in sys.modules if m.startswith('agent.') "
            "and any(k in m for k in ('gemini','gmail','notion','calendar','writer','state','audit'))]; "
            "print(bad)"
        )
        out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(out.stdout.strip(), "[]", out.stdout)


if __name__ == "__main__":
    unittest.main()
