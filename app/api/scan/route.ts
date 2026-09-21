import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd());
const HELPER = path.join(PROJECT_ROOT, "scripts", "scan_helper.py");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 10;

    const result = execFileSync("python", [HELPER, String(limit)], {
      cwd: PROJECT_ROOT,
      timeout: 120000,
      encoding: "utf-8",
    });

    const lastLine = result.trim().split("\n").pop() || "{}";
    const data = JSON.parse(lastLine);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", error: e.message || "Scan failed" },
      { status: 500 }
    );
  }
}
