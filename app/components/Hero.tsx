"use client";

import { useRef } from "react";
import Reveal from "./Reveal";
import MascotRig from "./MascotRig";

const WORD = "OPPSYNC";

/**
 * 02 — Hero. Giant OPPSYNC identity wordmark, the statement + CTA on the
 * left, and a large editorial art panel on the right where the OppSync
 * mascot peeks up from behind the panel's bottom edge.
 *
 * The entry sequence is pure CSS (runs once per page load): letter
 * clip-reveal → green accent → staggered hero content → panel settles →
 * mascot rises (≈1.8s total, no loader, no scroll replay).
 *
 * Pointer depth is tiny and mouse-only: mascot ≤5px / ≤1.5deg, disabled
 * for prefers-reduced-motion and touch pointers.
 */
export default function Hero({
  onScan,
  loading,
}: {
  onScan: () => void;
  loading: boolean;
}) {
  const heroRef = useRef<HTMLElement | null>(null);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = heroRef.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    node.style.setProperty("--px", x.toFixed(3));
    node.style.setProperty("--py", y.toFixed(3));
  };

  const onPointerLeave = () => {
    const node = heroRef.current;
    if (!node) return;
    node.style.setProperty("--px", "0");
    node.style.setProperty("--py", "0");
  };

  return (
    <section
      className="hero"
      id="hero"
      ref={heroRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="shell">
        {/* Brand identity moment */}
        <div className="hero-brand">
          <div className="ww-motif" aria-hidden="true">
            <div className="ww-motif-in">
              <span className="ww-squares"><i /><i /><i /></span>
              <span className="ww-rule" />
            </div>
          </div>
          <h1 className="hero-word" aria-label="OppSync AI">
            <span className="ww-letters" aria-hidden="true">
              {WORD.split("").map((ch, i) => (
                <span className="ww-ln" key={i}>
                  <span className="ww-ch">{ch}</span>
                </span>
              ))}
            </span>
            <span className="ww-ai" aria-hidden="true">AI</span>
          </h1>
        </div>

        <div className="hero-cols">
          <div className="hero-copy">
            <p className="eyebrow">01 / identity</p>
            <h2 className="d1 d1-hero hero-title hero-anim">
              <span className="ln"><span>Your next opportunity</span></span>
              <span className="ln"><span>might already be</span></span>
              <span className="ln"><span>in <span className="accent">your inbox.</span></span></span>
            </h2>
            <p className="lede hero-sub">
              Opportunity emails arrive every day. Most get buried. OppSync
              finds them, checks how well they match you, and surfaces what
              needs your attention — before anything is written or scheduled.
            </p>
            <div className="hero-actions">
              <button className="btn btn-green" onClick={onScan} disabled={loading}>
                {loading ? "Scanning your inbox…" : "Scan Gmail"}
                <span className="arw" aria-hidden="true">↗</span>
              </button>
              <span className="meta">
                {loading ? "Reading recent mail" : "One scan · up to 10 recent emails"}
              </span>
            </div>
            <div className="hero-facts">
              <div><div className="k">Source</div><div className="v">Gmail</div></div>
              <div><div className="k">Analysis</div><div className="v">Match + urgency</div></div>
              <div><div className="k">Writes</div><div className="v">After approval</div></div>
            </div>
          </div>

          <Reveal delay={800}>
            <div className="hero-viz">
              <div className="hero-panel" aria-hidden="true">
                <div className="panel-bar">
                  <span className="panel-motif"><i /><i /><i /></span>
                  <span className="panel-label">Opportunity found</span>
                  <span className="panel-meta">from inbox to opportunity</span>
                </div>
                <div className="panel-grid" />
                {/* Secondary editorial layer: the product story, behind the mascot */}
                <div className="panel-flow">
                  <span className="pf-step"><i /><span>Email</span></span>
                  <span className="pf-line" />
                  <span className="pf-step"><i /><span>Extract</span></span>
                  <span className="pf-line" />
                  <span className="pf-step"><i /><span>Match</span></span>
                  <span className="pf-line" />
                  <span className="pf-step"><i /><span>Action</span></span>
                </div>
                <MascotRig />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
