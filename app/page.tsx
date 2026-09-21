"use client";

import { useState } from "react";

interface Opportunity {
  index: number;
  name: string | null;
  organization: string | null;
  type: string | null;
  deadline: string | null;
  url: string | null;
  summary: string | null;
  confidence: number;
  source_email_id: string | null;
}

interface ScanResponse {
  status: string;
  scan_id: string;
  emails_scanned: number;
  opportunities_found: number;
  opportunities: Opportunity[];
  ai_quota_exhausted?: boolean;
  ai_unavailable?: boolean;
  ai_error?: string;
  message?: string;
}

type ReviewStatus = "approved" | "rejected";

export default function Home() {
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const [processingCards, setProcessingCards] = useState<Record<string, "approve" | "reject">>({});

  const cardKey = (opp: Opportunity): string => opp.source_email_id ?? String(opp.index);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setScanResult(null);
    setReviewStatuses({});
    setProcessingCards({});
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setError(data.error);
      } else {
        setScanResult(data);
      }
    } catch (e: any) {
      setError(e.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (opp: Opportunity) => {
    const key = cardKey(opp);
    setProcessingCards((prev) => ({ ...prev, [key]: "reject" }));
    setError(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: opp, approved: false }),
      });
      const data = await res.json();

      if (!res.ok || data.status === "error") {
        setError(data.error || "Request failed");
        setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      setReviewStatuses((prev) => ({ ...prev, [key]: "rejected" }));
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e: any) {
      setError(e.message || "Request failed");
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleApprove = async (opp: Opportunity) => {
    const key = cardKey(opp);
    setProcessingCards((prev) => ({ ...prev, [key]: "approve" }));
    setError(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: opp, approved: true }),
      });
      const data = await res.json();

      if (!res.ok || data.status === "error") {
        setError(data.error || "Request failed");
        setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      if (data.status === "success" || data.status === "skipped") {
        setReviewStatuses((prev) => ({ ...prev, [key]: "approved" }));
      } else if (data.status === "partial_success") {
        setReviewStatuses((prev) => ({ ...prev, [key]: "approved" }));
        setError("Approval partially completed. Check Notion/Calendar for details.");
      } else {
        setReviewStatuses((prev) => ({ ...prev, [key]: "approved" }));
      }
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e: any) {
      setError(e.message || "Request failed");
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>OppSync AI</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Discover opportunities. Never miss a deadline.</p>

      <div style={{ marginBottom: "2rem" }}>
        <button onClick={handleScan} disabled={loading} style={{ padding: "0.75rem 1.5rem", backgroundColor: loading ? "#ccc" : "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontSize: "1rem" }}>
          {loading ? "Scanning..." : "Scan Recent Emails"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "6px", marginBottom: "1rem", color: "#991b1b" }}>{error}</div>
      )}

      {scanResult && (
        <div style={{ marginBottom: "1rem", color: "#666" }}>
          Scanned {scanResult.emails_scanned} emails. Found {scanResult.opportunities_found} opportunities.
          {scanResult.opportunities_found === 0 && " No new opportunities found. Existing opportunities were already in Notion."}
        </div>
      )}

      {scanResult && scanResult.opportunities.map((opp) => {
        const key = cardKey(opp);
        const status = reviewStatuses[key] ?? null;
        const action = processingCards[key] ?? null;
        const isProcessing = action !== null;
        const isApproving = action === "approve";
        const isRejecting = action === "reject";
        const isApproved = status === "approved";
        const isRejected = status === "rejected";
        const isDisabled = status !== null || isProcessing;

        let cardBg = "white";
        let cardBorder = "1px solid #e5e7eb";
        if (isApproved) { cardBg = "#f0fdf4"; cardBorder = "1px solid #86efac"; }
        if (isRejected) { cardBg = "#fef2f2"; cardBorder = "1px solid #fca5a5"; }
        if (isProcessing) { cardBg = "#f9fafb"; }

        return (
          <div key={key} style={{ border: cardBorder, borderRadius: "8px", padding: "1.5rem", marginBottom: "1rem", backgroundColor: cardBg, opacity: isProcessing ? 0.7 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{opp.name || "Unknown Opportunity"}</h3>
              <span style={{ padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", backgroundColor: "#dbeafe", color: "#1e40af" }}>{opp.type || "unknown"}</span>
            </div>

            {opp.organization && <p style={{ margin: "0.25rem 0", color: "#374151" }}><strong>Organization:</strong> {opp.organization}</p>}
            {opp.deadline && <p style={{ margin: "0.25rem 0", color: "#374151" }}><strong>Deadline:</strong> {opp.deadline}</p>}
            {opp.url && <p style={{ margin: "0.25rem 0" }}><a href={opp.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{opp.url}</a></p>}
            {opp.summary && <p style={{ margin: "0.5rem 0", color: "#6b7280", fontSize: "0.9rem" }}>{opp.summary}</p>}

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Confidence: {Math.round(opp.confidence * 100)}%</span>
              <div style={{ flex: 1 }} />
              {isApproved ? (
                <span style={{ color: "#16a34a", fontSize: "0.85rem", fontWeight: 500 }}>&#10003; Approved</span>
              ) : isRejected ? (
                <span style={{ color: "#dc2626", fontSize: "0.85rem", fontWeight: 500 }}>&#10007; Rejected</span>
              ) : isApproving ? (
                <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>&#9203; Approving...</span>
              ) : isRejecting ? (
                <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>&#9203; Rejecting...</span>
              ) : (
                <>
                  <button onClick={() => handleApprove(opp)} disabled={isDisabled} style={{ padding: "0.5rem 1rem", backgroundColor: isDisabled ? "#ccc" : "#16a34a", color: "white", border: "none", borderRadius: "4px", cursor: isDisabled ? "not-allowed" : "pointer" }}>Approve</button>
                  <button onClick={() => handleReject(opp)} disabled={isDisabled} style={{ padding: "0.5rem 1rem", backgroundColor: isDisabled ? "#ccc" : "#dc2626", color: "white", border: "none", borderRadius: "4px", cursor: isDisabled ? "not-allowed" : "pointer" }}>Reject</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}
