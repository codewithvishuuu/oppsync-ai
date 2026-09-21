"""Tests for agent/state.py — SQLite processed-state store."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent.state as state_module


class TestStateStore(unittest.TestCase):
    """Tests using a temporary SQLite database."""

    def setUp(self):
        self._original_db_path = state_module._DB_PATH
        self._tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self._tmp.close()
        state_module._DB_PATH = self._tmp.name

    def tearDown(self):
        state_module._DB_PATH = self._original_db_path
        if os.path.exists(self._tmp.name):
            os.unlink(self._tmp.name)

    def test_mark_and_check_processed(self):
        state_module.mark_processed("email_001", "approved", "Test Opp")
        self.assertTrue(state_module.is_processed("email_001"))
        self.assertFalse(state_module.is_processed("email_999"))

    def test_approved_state(self):
        state_module.mark_processed("email_002", "approved", "Approved Opp", "page_123")
        self.assertTrue(state_module.is_processed("email_002"))
        self.assertEqual(state_module.get_action("email_002"), "approved")

    def test_rejected_state(self):
        state_module.mark_processed("email_003", "rejected", "Rejected Opp")
        self.assertTrue(state_module.is_processed("email_003"))
        self.assertEqual(state_module.get_action("email_003"), "rejected")

    def test_unprocessed_email(self):
        self.assertFalse(state_module.is_processed("email_new"))
        self.assertIsNone(state_module.get_action("email_new"))

    def test_upsert_preserves_notion_page_id(self):
        state_module.mark_processed("email_004", "approved", "Opp", "page_original")
        self.assertEqual(state_module.get_action("email_004"), "approved")

        # Second call with None notion_page_id should preserve original
        state_module.mark_processed("email_004", "approved", "Opp", None)
        conn = state_module._get_connection()
        cursor = conn.execute("SELECT notion_page_id FROM processed WHERE email_id = ?", ("email_004",))
        row = cursor.fetchone()
        conn.close()
        self.assertEqual(row[0], "page_original")

    def test_upsert_updates_action(self):
        state_module.mark_processed("email_005", "rejected", "Opp")
        self.assertEqual(state_module.get_action("email_005"), "rejected")

        # Approve the same email — action should update
        state_module.mark_processed("email_005", "approved", "Opp", "page_abc")
        self.assertEqual(state_module.get_action("email_005"), "approved")

    def test_same_title_different_email_id(self):
        state_module.mark_processed("email_A", "approved", "Same Title")
        state_module.mark_processed("email_B", "approved", "Same Title")
        self.assertTrue(state_module.is_processed("email_A"))
        self.assertTrue(state_module.is_processed("email_B"))
        # Both exist independently
        self.assertNotEqual("email_A", "email_B")

    def test_multiple_entries(self):
        for i in range(10):
            state_module.mark_processed(f"email_{i}", "approved", f"Opp {i}")
        for i in range(10):
            self.assertTrue(state_module.is_processed(f"email_{i}"))
        self.assertFalse(state_module.is_processed("email_10"))

    def test_database_creates_automatically(self):
        os.unlink(self._tmp.name)
        # Should not raise — database is created on first use
        state_module.mark_processed("email_auto", "approved", "Auto")
        self.assertTrue(state_module.is_processed("email_auto"))


class TestStateSkipBehavior(unittest.TestCase):
    """Test that processed emails would be skipped in the scan loop."""

    def setUp(self):
        self._original_db_path = state_module._DB_PATH
        self._tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self._tmp.close()
        state_module._DB_PATH = self._tmp.name

    def tearDown(self):
        state_module._DB_PATH = self._original_db_path
        if os.path.exists(self._tmp.name):
            os.unlink(self._tmp.name)

    def test_approved_email_would_be_skipped(self):
        state_module.mark_processed("email_approved", "approved", "Approved Opp")
        self.assertTrue(state_module.is_processed("email_approved"))
        # In agent.py, this would cause: reason=already_processed

    def test_rejected_email_would_be_skipped(self):
        state_module.mark_processed("email_rejected", "rejected", "Rejected Opp")
        self.assertTrue(state_module.is_processed("email_rejected"))
        # In agent.py, this would cause: reason=already_processed

    def test_new_email_not_skipped(self):
        self.assertFalse(state_module.is_processed("email_new"))
        # In agent.py, this would proceed to pre-filter → Gemini


if __name__ == "__main__":
    unittest.main()
