#!/usr/bin/env python3
"""Reject helper - lightweight, no external writes."""
import sys
import os
import json
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(__file__).parent.parent / "logs"

opp_data = json.loads(sys.argv[1])
email_id = opp_data.get("source_email_id", "unknown")
name = opp_data.get("name", "Unknown")

# Write audit log directly (no heavy imports)
try:
    LOG_DIR.mkdir(exist_ok=True)
    log_file = LOG_DIR / f"audit_{datetime.utcnow().strftime('%Y-%m-%d')}.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "event": "rejection",
            "email_id": email_id,
            "opportunity_name": name,
            "timestamp": datetime.utcnow().isoformat(),
        }) + "\n")
except Exception:
    pass

# Return success
print(json.dumps({"status": "rejected", "message": "No external changes made"}))
