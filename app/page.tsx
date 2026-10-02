"use client";

import { useState } from "react";
import SiteHeader from "./components/SiteHeader";
import Hero from "./components/Hero";
import ProductMoment from "./components/ProductMoment";
import Discovery from "./components/Discovery";
import MatchingDeadline from "./components/MatchingDeadline";
import HowItWorks from "./components/HowItWorks";
import ExecutionLayer from "./components/ExecutionLayer";
import FinalCta from "./components/FinalCta";
import FilterBar, { ScanLine, Notice, Blank, Pulsing } from "./components/FilterBar";
import OpportunityCard from "./components/OpportunityCard";
import Reveal from "./components/Reveal";
import Mark from "./components/Mark";
import { setMascotState } from "./components/mascotEvents";
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
    setMascotState("scan");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setError(data.error);
        setMascotState("idle");
      } else {
        setScanResult(data);
        // Mascot reaction follows the REAL backend result: found only when
        // the (deduplicated) scan actually produced opportunities.
        setMascotState(
          typeof data.opportunities_found === "number" && data.opportunities_found > 0
            ? "opportunity-found"
            : "idle"
        );
      }
    } catch (e: any) {
      setError(e.message || "Scan failed");
      setMascotState("idle");
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
        setMascotState("idle");
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
      setMascotState("approved");
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e: any) {
      setError(e.message || "Request failed");
      setMascotState("idle");
      setProcessingCards((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };
return (
    <>
      <SiteHeader onScan={handleScan} loading={loading} />

      <main>
      {/* 02 Hero */}
      <Hero onScan={handleScan} loading={loading} />

      {/* 03 Product moment */}
      <ProductMoment />

      {/* 04 Discovery */}
      <Discovery />

      {/* 05 Matching + deadline */}
      <MatchingDeadline />

      {/* 06 Real opportunities — the product surface */}
      <section className="band band-pad band--paper band--showcase band--tight" id="opportunities">
        <div className="shell">
          <div className="shead">
            <span className="shead-n">05</span>
            <div className="shead-body">
              <p className="eyebrow">opportunities/</p>
              <Reveal variant="clip">
                <h3 className="d1 d1-lg">
                  Opportunities
                  <br />
                  from your inbox.
                </h3>
              </Reveal>
              <p className="lede">
                Everything below comes from a scan of your recent emails —
                with match, deadline and decision in one place.
              </p>
            </div>
          </div>

          <div className="explorer-grid" style={{ marginTop: "clamp(1rem,2vw,1.5rem)" }}>
            {error && <Notice message={error} />}

            {loading && (
              <div className="scanline">
                <Pulsing>Scanning your inbox</Pulsing>
                <span className="q">
                  Reading recent mail and extracting opportunities.
                </span>
              </div>
            )}

            {scanResult && (
              <ScanLine
                scanned={scanResult.emails_scanned}
                found={scanResult.opportunities_found}
                warn={Boolean(scanResult.ai_quota_exhausted || scanResult.ai_unavailable)}
                note={
                  scanResult.opportunities_found === 0
                    ? "No new opportunities found."
                    : scanResult.ai_quota_exhausted
                      ? scanResult.message
                      : scanResult.ai_unavailable
                        ? scanResult.ai_error
                        : undefined
                }
              />
            )}

            {scanResult && scanResult.opportunities.length > 0 && (
              <FilterBar
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                typeFilter={typeFilter}
                onType={setTypeFilter}
                eligibilityFilter={eligibilityFilter}
                onEligibility={setEligibilityFilter}
                deadlineFilter={deadlineFilter}
                onDeadline={setDeadlineFilter}
                typeOptions={OPPORTUNITY_TYPES}
                eligibilityOptions={ELIGIBILITY_FILTERS}
                deadlineOptions={DEADLINE_FILTERS}
                eligibilityLabelFor={(v) => ELIGIBILITY_LABELS[v]?.text ?? capitalize(v)}
                deadlineLabelFor={(v) => DEADLINE_LABELS[v] ?? capitalize(v)}
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
                visibleCount={visibleOpportunities.length}
                totalCount={allOpportunities.length}
              />
            )}

            {scanResult &&
              scanResult.opportunities.length > 0 &&
              visibleOpportunities.length === 0 && (
                <Blank
                  title="No opportunities match your filters."
                  detail="Try a different search term, or clear the filters to see everything."
                />
              )}

            {!scanResult && !loading && (
              <Blank
                title="No scan yet."
                detail="Your opportunity feed is waiting. Scan your recent Gmail to find internships, hackathons, scholarships and more."
                action={
                  <button className="btn btn-green" onClick={handleScan} disabled={loading}>
                    Scan Gmail
                    <span className="arw" aria-hidden="true">↗</span>
                  </button>
                }
              />
            )}

            {scanResult && visibleOpportunities.length > 0 && (
              <div className="cards">
                {visibleOpportunities.map((opp, i) => {
                  const key = cardKey(opp);
                  const variant =
                    i === 0 ? "feature" : i % 3 === 0 ? "full" : "half";
                  return (
                    <OpportunityCard
                      key={key}
                      opp={opp}
                      variant={variant}
                      reviewStatus={reviewStatuses[key] ?? null}
                      action={processingCards[key] ?? null}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      deadlineLabel={deadlineLabel}
                      eligibilityLabel={(v) =>
                        ELIGIBILITY_LABELS[v] ?? ELIGIBILITY_LABELS.unknown
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 07 How OppSync works */}
      <HowItWorks />

      {/* 08 Execution / Swytchcode */}
      <ExecutionLayer />

      {/* 09 Final CTA */}
      <FinalCta onScan={handleScan} loading={loading} />
      </main>

      {/* 10 Footer */}
      <footer className="site-foot">
        <div className="foot-in">
          <div className="foot-brand">
            <span className="mark">
              <Mark size={15} className="brand-mark" />
              OppSync AI
            </span>
            <p>Discover opportunities. Never miss a deadline.</p>
            <div className="foot-swy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/swytchcode-logo.png" alt="Swytchcode" width={90} height={22} />
            </div>
          </div>
          <div className="foot-col">
            <h3>Explore</h3>
            <a href="#opportunities">Opportunities</a>
            <a href="#discovery">How it works</a>
            <a href="#matching">Matching</a>
            <a href="#deadlines">Deadlines</a>
          </div>
          <div className="foot-col">
            <h3>Act</h3>
            <a href="#cta">Scan Gmail</a>
          </div>
          <div className="foot-col">
            <h3>Technology</h3>
            <p className="attr">Powered by Swytchcode</p>
          </div>
        </div>
        <div className="foot-base">
          <span className="meta">&copy; 2026 OppSync AI</span>
          <span className="meta">
            Execution layer &middot; powered by Swytchcode
          </span>
        </div>
      </footer>
    </>
  );
}