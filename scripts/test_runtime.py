#!/usr/bin/env python3
"""Minimal integration test for OppSync AI foundation."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.gemini import test_gemini_connectivity
from agent.runtime import test_runtime_tools


def main():
    print("=" * 60)
    print("OPPSYNC AI - Foundation Test")
    print("=" * 60)

    print("\n[1/2] Testing Gemini connectivity...")
    gemini_result = test_gemini_connectivity()
    if gemini_result["status"] == "ok":
        print(f"  OK - Model: {gemini_result['model']}")
        print(f"  Response: {gemini_result['response']}")
    else:
        print(f"  FAILED - {gemini_result['error']}")

    print("\n[2/2] Testing Swytchcode Runtime SDK...")
    runtime_result = test_runtime_tools()
    if runtime_result["status"] == "ok":
        print(f"  OK - Tools loaded: {runtime_result['tool_count']}")
        print(f"  Toolkits: {runtime_result['toolkits']}")
    else:
        print(f"  FAILED - {runtime_result['error']}")

    print("\n" + "=" * 60)
    all_ok = (
        gemini_result["status"] == "ok" and runtime_result["status"] == "ok"
    )
    if all_ok:
        print("RESULT: ALL TESTS PASSED")
    else:
        print("RESULT: SOME TESTS FAILED")
    print("=" * 60)

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
