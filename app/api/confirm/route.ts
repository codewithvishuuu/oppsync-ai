import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const PROJECT_ROOT = path.resolve(process.cwd());
const WRITE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "write_helper.py");

const AUDIT_DIR = path.join(PROJECT_ROOT, "logs");

function writeAuditLog(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
    const ts = new Date().toISOString().slice(0, 10);
    const logFile = path.join(AUDIT_DIR, `audit_${ts}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // audit log failure is non-critical
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const { opportunity, approved } = body;

    if (!opportunity) {
      return NextResponse.json(
        { status: "error", error: "No opportunity data provided" },
        { status: 400 }
      );
    }

    if (!approved) {
      // REJECT: instant, zero external writes
      const emailId = opportunity.source_email_id || "unknown";
      writeAuditLog({
        event: "rejection",
        email_id: emailId,
        opportunity_name: opportunity.name || "Unknown",
        timestamp: new Date().toISOString(),
      });
      const elapsed = Date.now() - start;
      console.log(`[confirm] REJECT ${emailId} completed in ${elapsed}ms`);
      return NextResponse.json({
        status: "rejected",
        message: "No external changes made",
      });
    }

    // APPROVE: Python subprocess for Notion + Calendar writes
    const result = execFileSync("python", [WRITE_SCRIPT, JSON.stringify(opportunity)], {
      cwd: PROJECT_ROOT,
      timeout: 60000,
      encoding: "utf-8",
    });

    const lastLine = result.trim().split("\n").pop() || "{}";
    const data = JSON.parse(lastLine);
    const elapsed = Date.now() - start;
    console.log(`[confirm] APPROVE ${opportunity.source_email_id || "unknown"} completed in ${elapsed}ms`);
    return NextResponse.json(data);
  } catch (e: any) {
    const elapsed = Date.now() - start;
    console.log(`[confirm] ERROR completed in ${elapsed}ms: ${e.message}`);
    return NextResponse.json(
      { status: "error", error: e.message || "Operation failed" },
      { status: 500 }
    );
  }
}
