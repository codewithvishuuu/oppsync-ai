"use client";

import { useState } from "react";

interface EligibilitySignal {
  criterion: string;
  status: "match" | "mismatch" | "unknown";
  detail: string;
}

interface Eligibility {
  match_score: number | null;
  eligibility: string;
  matching_factors: string[];
  potential_gaps: string[];
  unknown_requirements: string[];
  signals: EligibilitySignal[];
  confidence: number;
}

type DeadlineStatus =
  | "no_deadline"
  | "expired"
  | "today"
  | "critical"
  | "urgent"
  | "upcoming"
  | "normal";

interface DeadlineIntelligence {
  days_remaining: number | null;
  deadline_status: DeadlineStatus;
  urgency: string;
  is_expired: boolean;
}

// Visual weight follows real urgency: strongest warning for today/critical,
// decaying to neutral. Colours reuse the greys already used in this file.
const DEADLINE_BADGE: Record<string, { bg: string; color: string; bold?: boolean }> = {
  today: { bg: "#fee2e2", color: "#991b1b", bold: true },
  critical: { bg: "#fee2e2", color: "#991b1b", bold: true },
  urgent: { bg: "#ffedd5", color: "#9a3412" },
  upcoming: { bg: "#fef9c3", color: "#854d0e" },
  normal: { bg: "#f3f4f6", color: "#4b5563" },
  expired: { bg: "#e5e7eb", color: "#4b5563" },
  no_deadline: { bg: "#f9fafb", color: "#9ca3af" },
};

// Fixed option text for the deadline filter dropdown. Independent of the
// per-card badge, which stays contextual (e.g. "3 days left").
const DEADLINE_LABELS: Record<string, string> = {
  expired: "Expired",
  today: "Due today",
  critical: "Critical",
  urgent: "Urgent",
  upcoming: "Upcoming",
  normal: "Normal",
  no_deadline: "No deadline",
};

/**
 * Derive the label purely from backend fields. No date maths here.
 * Returns null when there is nothing safe to show, so a card can never
 * render "undefined days left".
 */
function deadlineLabel(di: DeadlineIntelligence): string | null {
  const days = typeof di.days_remaining === "number" ? di.days_remaining : null;
  switch (di.deadline_status) {
    case "expired":
      return "Expired";
    case "today":
      return "Due today";
    case "critical":
    case "urgent":
    case "upcoming":
    case "normal":
      if (days === null) return null;
      return days === 1 ? "1 day left" : `${days} days left`;
    case "no_deadline":
      return "No deadline";
    default:
      return null;
  }
}

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
  requirements?: unknown | null;
  eligibility?: Eligibility | null;
  deadline_intelligence?: DeadlineIntelligence | null;
}

const ELIGIBILITY_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  likely_eligible: { text: "Likely eligible", color: "#166534", bg: "#dcfce7" },
  possible: { text: "Possibly eligible", color: "#854d0e", bg: "#fef9c3" },
  unlikely_eligible: { text: "Likely not eligible", color: "#991b1b", bg: "#fee2e2" },
  unknown: { text: "Eligibility unknown", color: "#374151", bg: "#e5e7eb" },
};

const OPPORTUNITY_TYPES = [
  "internship",
  "hackathon",
  "scholarship",
  "competition",
  "job",
  "workshop",
  "certification",
  "fellowship",
];

const ELIGIBILITY_FILTERS = [
  "likely_eligible",
  "possible",
  "unlikely_eligible",
];

const DEADLINE_FILTERS = [
  "expired",
  "today",
  "critical",
  "urgent",
  "upcoming",
  "normal",
  "no_deadline",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Raw deadline status, defaulting to "no_deadline" when absent. No date maths. */
function deadlineStatusOf(opp: Opportunity): string {
  return opp.deadline_intelligence?.deadline_status ?? "no_deadline";
}

/** Raw eligibility verdict, defaulting to "unknown" when absent. */
function eligibilityOf(opp: Opportunity): string {
  return opp.eligibility?.eligibility ?? "unknown";
}

/**
 * Pure, client-side filter. Never mutates the opportunity and never computes
 * dates -- it only reads fields the backend already produced.
 */
function matchesFilters(
  opp: Opportunity,
  query: string,
  typeFilter: string,
  eligibilityFilter: string,
  deadlineFilter: string
): boolean {
  if (typeFilter && opp.type !== typeFilter) return false;
  if (eligibilityFilter && eligibilityOf(opp) !== eligibilityFilter) return false;
  if (deadlineFilter && deadlineStatusOf(opp) !== deadlineFilter) return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [opp.name, opp.organization, opp.summary]
    .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
    .join(" ");
  return haystack.includes(q);
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

  // Phase 3: client-side search + filters. No extra network requests.
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    typeFilter !== "" ||
    eligibilityFilter !== "" ||
    deadlineFilter !== "";

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("");
    setEligibilityFilter("");
    setDeadlineFilter("");
  };

  // Filters the same array of original objects; nothing is mutated, so the
  // Approve/Reject handlers still receive the untouched opportunity.
  const allOpportunities = scanResult ? scanResult.opportunities : [];
  const visibleOpportunities = allOpportunities.filter((opp) =>
    matchesFilters(opp, searchQuery, typeFilter, eligibilityFilter, deadlineFilter)
  );

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

      {scanResult && scanResult.opportunities.length > 0 && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, organization, summary..."
            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "0.9rem", marginBottom: "0.5rem" }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "0.4rem 0.5rem", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "0.8rem", backgroundColor: "white" }}>
              <option value="">All types</option>
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>{capitalize(t)}</option>
              ))}
            </select>
            <select value={eligibilityFilter} onChange={(e) => setEligibilityFilter(e.target.value)} style={{ padding: "0.4rem 0.5rem", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "0.8rem", backgroundColor: "white" }}>
              <option value="">All eligibility</option>
              {ELIGIBILITY_FILTERS.map((e) => (
                <option key={e} value={e}>{ELIGIBILITY_LABELS[e]?.text ?? capitalize(e)}</option>
              ))}
            </select>
            <select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)} style={{ padding: "0.4rem 0.5rem", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "0.8rem", backgroundColor: "white" }}>
              <option value="">All deadlines</option>
              {DEADLINE_FILTERS.map((d) => (
                <option key={d} value={d}>{DEADLINE_LABELS[d] ?? capitalize(d)}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ padding: "0.4rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "white", fontSize: "0.8rem", cursor: "pointer" }}>Clear filters</button>
            )}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
            Showing {visibleOpportunities.length} of {allOpportunities.length} opportunities
          </div>
        </div>
      )}

      {scanResult && scanResult.opportunities.length > 0 && visibleOpportunities.length === 0 && (
        <div style={{ padding: "1rem", border: "1px dashed #d1d5db", borderRadius: "6px", marginBottom: "1rem", color: "#6b7280" }}>
          No opportunities match your filters.
        </div>
      )}

      {scanResult && visibleOpportunities.map((opp) => {
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
            {opp.deadline_intelligence && (() => {
              const di = opp.deadline_intelligence!;
              const label = deadlineLabel(di);
              if (!label) return null;
              const s = DEADLINE_BADGE[di.deadline_status] ?? DEADLINE_BADGE.normal;
              return (
                <p style={{ margin: "0.25rem 0" }}>
                  <span style={{ padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.75rem", backgroundColor: s.bg, color: s.color, fontWeight: s.bold ? 600 : 400 }}>{label}</span>
                </p>
              );
            })()}
            {opp.url && <p style={{ margin: "0.25rem 0" }}><a href={opp.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{opp.url}</a></p>}
            {opp.summary && <p style={{ margin: "0.5rem 0", color: "#6b7280", fontSize: "0.9rem" }}>{opp.summary}</p>}

            {opp.eligibility && (
              <div style={{ margin: "0.75rem 0", padding: "0.75rem", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    Match: {opp.eligibility.match_score !== null ? `${opp.eligibility.match_score}%` : "Unknown"}
                  </span>
                  {(() => {
                    const v = ELIGIBILITY_LABELS[opp.eligibility!.eligibility] ?? ELIGIBILITY_LABELS.unknown;
                    return (
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.75rem", backgroundColor: v.bg, color: v.color }}>
                        {v.text}
                      </span>
                    );
                  })()}
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    Confidence: {Math.round(opp.eligibility.confidence * 100)}%
                  </span>
                </div>
                {opp.eligibility.signals.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", lineHeight: 1.5 }}>
                    {opp.eligibility.signals.map((s, index) => (
                      <li key={`${s.criterion}-${index}`} style={{ color: s.status === "mismatch" ? "#991b1b" : s.status === "unknown" ? "#854d0e" : "#166534" }}>
                        {s.detail}
                      </li>
                    ))}
                  </ul>
                )}
                {opp.eligibility.unknown_requirements.length > 0 && (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#854d0e" }}>
                    Unknown requirements: {opp.eligibility.unknown_requirements.join("; ")}
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Extraction: {Math.round(opp.confidence * 100)}%</span>
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
