"use client";

import { useRef } from "react";
import type { CardAction, DeadlineIntelligence, Opportunity, ReviewStatus } from "./types";

const MARK: Record<string, string> = { match: "✓", mismatch: "✕", unknown: "?" };

const VERDICT: Record<string, string> = {
  likely_eligible: "tag-ok",
  possible: "",
  unlikely_eligible: "tag-clay",
  unknown: "tag-mute",
};

const DEADLINE_TONE: Record<string, string> = {
  today: "tag-clay",
  critical: "tag-clay",
  urgent: "tag-clay",
  upcoming: "",
  normal: "tag-mute",
  expired: "tag-mute",
  no_deadline: "tag-mute",
};

/** Raw backend deadline_status → display word. Presentation only. */
const STATUS_WORD: Record<string, string> = {
  today: "Due today",
  critical: "Critical",
  urgent: "Urgent",
  upcoming: "Upcoming",
  normal: "Normal",
  expired: "Expired",
  no_deadline: "No deadline",
};

/** Side-panel tone for the deadline status line. */
const STATUS_TONE: Record<string, string> = {
  today: "is-warn",
  critical: "is-warn",
  urgent: "is-warn",
  upcoming: "is-soon",
  normal: "is-mute",
  expired: "is-mute",
  no_deadline: "is-mute",
};

/** Backend criterion key → readable label. No inference, labels only. */
const CRITERION_LABEL: Record<string, string> = {
  eligible_degrees: "Degree",
  eligible_years: "Year",
  min_eligible_year: "Year",
  min_cgpa: "CGPA",
  max_cgpa: "CGPA",
  min_graduation_year: "Graduation year",
  max_graduation_year: "Graduation year",
  required_skills: "Skills",
  preferred_skills: "Preferred skills",
  allowed_locations: "Location",
  other_requirements: "Other requirements",
};

/** Display host for an existing URL. Returns null when unparseable. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Real opportunity card. Renders the untouched opportunity object and the
 * real handleApprove / handleReject. Computes nothing about eligibility or
 * deadlines — labels and statuses are supplied by page.tsx. Every field is
 * conditional: absent data is omitted or shown with the existing
 * unknown/unavailable wording, never invented.
 */
export default function OpportunityCard({
  opp,
  reviewStatus,
  action,
  variant,
  onApprove,
  onReject,
  deadlineLabel,
  eligibilityLabel,
}: {
  opp: Opportunity;
  reviewStatus: ReviewStatus | null;
  action: CardAction | null;
  variant: "feature" | "half" | "full";
  onApprove: (opp: Opportunity) => void;
  onReject: (opp: Opportunity) => void;
  deadlineLabel: (di: DeadlineIntelligence) => string | null;
  eligibilityLabel: (v: string) => { text: string };
}) {
  const isProcessing = action !== null;
  const isApproved = reviewStatus === "approved";
  const isRejected = reviewStatus === "rejected";
  const isDisabled = reviewStatus !== null || isProcessing;

  const state = isApproved
    ? "approved"
    : isRejected
      ? "rejected"
      : isProcessing
        ? "processing"
        : "idle";

  const di = opp.deadline_intelligence;
  const diText = di ? deadlineLabel(di) : null;
  const el = opp.eligibility;
  const verdict = el ? eligibilityLabel(el.eligibility).text : null;
  const score = el ? el.match_score : null;

  // Deadline status line: backend word + backend day count, never recomputed.
  const statusWord = di ? STATUS_WORD[di.deadline_status] ?? null : null;
  const statusText =
    diText && statusWord && diText !== statusWord
      ? `${statusWord} · ${diText}`
      : diText || statusWord;

  // Key-information grid — only rows whose data actually exists.
  // Deadline date + status live in the dedicated side/stacked DEADLINE
  // block (section 4), so they are not duplicated here.
  const metaRows: { k: string; v: string }[] = [];
  if (opp.type) metaRows.push({ k: "Type", v: opp.type });
  if (verdict) metaRows.push({ k: "Eligibility", v: verdict.replace(/^Eligibility\s+/, "") });
  if (score !== null) metaRows.push({ k: "Match score", v: `${score}%` });

  /**
   * Subtle pointer tilt: max ~2.5deg, mouse pointers only, reset on leave.
   * Never runs for touch input or reduced-motion users.
   */
  const cardRef = useRef<HTMLElement | null>(null);
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = cardRef.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    node.style.transform =
      "perspective(900px) rotateX(" + (-y * 2.5).toFixed(2) + "deg) rotateY(" + (x * 2.5).toFixed(2) + "deg)";
  };
  const onPointerLeave = () => {
    const node = cardRef.current;
    if (node) node.style.transform = "";
  };

  const host = opp.url ? hostOf(opp.url) : null;

  return (
    <div
      className={`card-cell is-${variant}`}
      data-state={state}
      aria-busy={isProcessing}
    >
      <article
        className="occ"
        ref={cardRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* Top row: type left, match / verdict right */}
        <header className="occ-head">
          <span className="occ-type">{opp.type || "unknown"}</span>
          {score !== null ? (
            <div className="occ-score">
              <span className="v">{score}%</span>
              <span className="l">Match</span>
            </div>
          ) : verdict ? (
            <span className={`tag ${VERDICT[el?.eligibility ?? "unknown"] ?? "tag-mute"}`}>
              {verdict}
            </span>
          ) : null}
        </header>

        <div className="occ-body">
          {/* Main column: identity, summary, key facts, eligibility */}
          <div className="occ-main">
            <h3 className="occ-name">{opp.name || "Unknown Opportunity"}</h3>
            {opp.organization && <p className="occ-org">{opp.organization}</p>}
            {opp.summary && <p className="occ-sum">{opp.summary}</p>}

            {metaRows.length > 0 && (
              <dl className="occ-meta">
                {metaRows.map((r) => (
                  <div key={r.k}>
                    <dt>{r.k}</dt>
                    <dd>{r.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Side column: deadline intelligence + source */}
          <aside className="occ-side">
            {(opp.deadline || statusText) && (
              <section className="occ-dl">
                <span className="occ-lbl">Deadline</span>
                {opp.deadline && <p className="occ-dl-date">{opp.deadline}</p>}
                {statusText && (
                  <p className={`occ-dstat ${STATUS_TONE[di?.deadline_status ?? ""] ?? "is-mute"}`}>
                    {statusText}
                  </p>
                )}
              </section>
            )}

            <section className="occ-src">
              <span className="occ-lbl">Source</span>
              {opp.url ? (
                <a
                  className="occ-link"
                  href={opp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {host ?? "Open opportunity"}
                  <span className="arw" aria-hidden="true"> ↗</span>
                </a>
              ) : (
                <span className="occ-unavail">Source link unavailable</span>
              )}
              {opp.source_email_id && (
                <p className="occ-srcmeta">Detected from Gmail</p>
              )}
            </section>
          </aside>
        </div>

        {/* Full-width eligibility band */}
        {el && (
          <section className="occ-elig">
            <div className="occ-elig-h">
              <span className="occ-lbl">Eligibility</span>
              <span className="conf">
                Confidence {Math.round(el.confidence * 100)}%
              </span>
            </div>

            {el.signals.length > 0 && (
              <ul className="occ-sig">
                {el.signals.map((s, i) => (
                  <li key={`${s.criterion}-${i}`} className={`s-${s.status}`}>
                    <span className="m" aria-hidden="true">
                      {MARK[s.status] ?? "•"}
                    </span>
                    <span className="lab">
                      {CRITERION_LABEL[s.criterion] ?? s.criterion}
                    </span>
                    <span className="why">{s.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            {el.unknown_requirements.length > 0 && (
              <p className="occ-unk">
                Unknown requirements: {el.unknown_requirements.join("; ")}
              </p>
            )}
          </section>
        )}

        <footer className="occ-foot">
          <span className="occ-ext">Extraction {Math.round(opp.confidence * 100)}%</span>

          <div className="occ-act">
            {isApproved ? (
              <span className="occ-state" data-s="approved">
                <span aria-hidden="true">✓</span> Approved
              </span>
            ) : isRejected ? (
              <span className="occ-state" data-s="rejected">
                <span aria-hidden="true">✕</span> Rejected
              </span>
            ) : isProcessing ? (
              <span className="occ-state" data-s="busy">
                {action === "approve" ? "Approving…" : "Rejecting…"}
              </span>
            ) : (
              <>
                <button
                  className="btn btn-ok btn-sm"
                  onClick={() => onApprove(opp)}
                  disabled={isDisabled}
                  aria-label={`Approve ${opp.name || "opportunity"}`}
                >
                  Approve
                </button>
                <button
                  className="btn btn-no btn-sm"
                  onClick={() => onReject(opp)}
                  disabled={isDisabled}
                  aria-label={`Reject ${opp.name || "opportunity"}`}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </footer>
      </article>
    </div>
  );
}
