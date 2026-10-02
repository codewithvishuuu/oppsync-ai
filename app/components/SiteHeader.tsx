"use client";

import { useEffect, useState } from "react";
import Mark from "./Mark";

/**
 * Compact sticky nav: official Swytchcode logo + OppSync identity left,
 * section links centre, Scan CTA right. The logo is the real PNG from
 * /public, never recreated — it degrades to text if the file is missing.
 */
const SWY_LOGO = "/swytchcode-logo.png";

const LINKS = [
  { href: "#opportunities", label: "Opportunities" },
  { href: "#discovery", label: "How it works" },
  { href: "#matching", label: "Match" },
  { href: "#deadlines", label: "Deadlines" },
];

export default function SiteHeader({
  onScan,
  loading,
}: {
  onScan: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const scan = () => {
    setOpen(false);
    onScan();
  };

  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Sections">
        <a className="nav-brand" href="#hero" aria-label="OppSync home">
          {logoOk ? (
            <img
              className="nav-swy"
              src={SWY_LOGO}
              alt="Swytchcode"
              width={76}
              height={15}
              onError={() => setLogoOk(false)}
            />
          ) : (
            <span className="nav-swy-txt">Swytchcode</span>
          )}
          <span className="nav-div" aria-hidden="true" />
          <span className="nav-name">
            <Mark size={14} className="brand-mark" />
            OppSync
          </span>
        </a>

        <div className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="nav-cta">
          <button className="btn btn-green btn-sm" onClick={onScan} disabled={loading}>
            {loading ? "Scanning…" : "Scan Gmail"}
            <span className="arw" aria-hidden="true">↗</span>
          </button>
        </div>

        <button
          className="nav-burger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="oppsync-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <span className={"burger" + (open ? " is-x" : "")} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </nav>

      <div id="oppsync-mobile-menu" className="nav-sheet" data-open={open}>
        <div className="nav-sheet-in">
          {LINKS.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              <span className="ns-n">{String(i + 1).padStart(2, "0")}</span>
              {l.label}
            </a>
          ))}
          <button className="btn btn-green ns-scan" onClick={scan} disabled={loading}>
            {loading ? "Scanning…" : "Scan Gmail"}
            <span className="arw" aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}