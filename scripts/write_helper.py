#!/usr/bin/env python3
"""Write helper - called by Next.js confirm API route."""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.models import Opportunity
from agent.writer import process_approval

opp_data = json.loads(sys.argv[1])
opp = Opportunity(**opp_data)
result = process_approval(opp)
print(json.dumps(result, default=str))
