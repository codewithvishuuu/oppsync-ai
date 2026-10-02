"use client";

/**
 * Search + filters — editorial controls. Purely presentational: every value,
 * setter and option list comes from page.tsx's frozen constants. No filtering
 * logic lives here.
 */
export default function FilterBar({
  searchQuery,
  onSearch,
  typeFilter,
  onType,
  eligibilityFilter,
  onEligibility,
  deadlineFilter,
  onDeadline,
  typeOptions,
  eligibilityOptions,
  deadlineOptions,
  eligibilityLabelFor,
  deadlineLabelFor,
  hasActiveFilters,
  onClear,
  visibleCount,
  totalCount,
}: {
  searchQuery: string;
  onSearch: (v: string) => void;
  typeFilter: string;
  onType: (v: string) => void;
  eligibilityFilter: string;
  onEligibility: (v: string) => void;
  deadlineFilter: string;
  onDeadline: (v: string) => void;
  typeOptions: readonly string[];
  eligibilityOptions: readonly string[];
  deadlineOptions: readonly string[];
  eligibilityLabelFor: (v: string) => string;
  deadlineLabelFor: (v: string) => string;
  hasActiveFilters: boolean;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-top">
        <div>
          <label className="field-label" htmlFor="oppsync-search">
            Search
          </label>
          <input
            id="oppsync-search"
            className="f-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, organization, summary…"
            autoComplete="off"
          />
        </div>
        <span className="f-count" role="status" aria-live="polite">
          Showing <b>{visibleCount}</b> of <b>{totalCount}</b> opportunities
        </span>
      </div>

      <div className="toolbar-bottom">
        <div className="tb-group">
          <label className="field-label" htmlFor="oppsync-type">Type</label>
          <select
            id="oppsync-type"
            className="f-select"
            value={typeFilter}
            onChange={(e) => onType(e.target.value)}
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="tb-group">
          <label className="field-label" htmlFor="oppsync-elig">Eligibility</label>
          <select
            id="oppsync-elig"
            className="f-select"
            value={eligibilityFilter}
            onChange={(e) => onEligibility(e.target.value)}
          >
            <option value="">All eligibility</option>
            {eligibilityOptions.map((o) => (
              <option key={o} value={o}>{eligibilityLabelFor(o)}</option>
            ))}
          </select>
        </div>

        <div className="tb-group">
          <label className="field-label" htmlFor="oppsync-deadline">Deadline</label>
          <select
            id="oppsync-deadline"
            className="f-select"
            value={deadlineFilter}
            onChange={(e) => onDeadline(e.target.value)}
          >
            <option value="">All deadlines</option>
            {deadlineOptions.map((o) => (
              <option key={o} value={o}>{deadlineLabelFor(o)}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="tb-group">
            <button className="btn btn-out btn-sm" onClick={onClear}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScanLine({
  scanned,
  found,
  note,
  warn,
}: {
  scanned: number;
  found: number;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="scanline">
      <span className="n">
        Scanned <b>{scanned}</b> emails · found <b>{found}</b>{" "}
        {found === 1 ? "opportunity" : "opportunities"}
      </span>
      {note &&
        (warn ? (
          <span className="q warn" role="status">
            <i aria-hidden="true">!</i>
            {note}
          </span>
        ) : (
          <span className="q">{note}</span>
        ))}
    </div>
  );
}

export function Notice({ message }: { message: string }) {
  return (
    <div className="notice" role="alert">
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </div>
  );
}

export function Blank({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="blank">
      <p className="t">{title}</p>
      <p className="d">{detail}</p>
      {action && <div className="blank-act">{action}</div>}
    </div>
  );
}

export function Pulsing({ children }: { children: React.ReactNode }) {
  return (
    <span className="pulse">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
