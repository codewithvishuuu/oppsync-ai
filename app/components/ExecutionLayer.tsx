"use client";

import { useState } from "react";
import Reveal from "./Reveal";

/**
 * 08 — Execution / Swytchcode. The official PNG (2048x492, transparent) is
 * served from /swytchcode-logo.png, used cleanly, at a secondary size. It
 * degrades to a plain text attribution if the file is absent — the logo is
 * never recreated, redrawn, recoloured or distorted.
 */
const LOGO_SRC = "/swytchcode-logo.png";

const ROWS = [
  { n: "01", t: "OppSync", s: "Local analysis only.", key: true },
  { n: "02", t: "Swytchcode", s: "Governed execution, validation, retries, audit trail." },
  { n: "03", t: "Gmail · Gemini", s: "Read and extract." },
  { n: "04", t: "Calendar · Notion", s: "Written only after approval." },
];

export default function ExecutionLayer() {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <section className="band band-pad band--tight" id="execution">
      <div className="shell">
        <div className="shead">
          <span className="shead-n">07</span>
          <div className="shead-body">
            <p className="eyebrow">execution-layer/</p>
            <Reveal variant="clip">
              <h3 className="d1 d1-lg">From intelligence<br />to action.</h3>
            </Reveal>
            <p className="lede">
              Intelligence decides what matters. Execution acts only when you
              approve.
            </p>
          </div>
        </div>

        <div className="exec" style={{ marginTop: "clamp(1rem,2vw,1.5rem)" }}>
          <Reveal>
            <div className="exec-list">
              {ROWS.map((r) => (
                <div className={"exec-row" + (r.key ? " exec-row--key" : "")} key={r.n}>
                  <span className="n">{r.n}</span>
                  <span>
                    <span className="t">{r.t}</span>
                    <span className="s" style={{ display: "block" }}>{r.s}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={70}>
            <div>
              <p className="lede">
                OppSync runs through Swytchcode&apos;s governed execution
                layer, connecting the agent to the services it needs.
              </p>

              <div className="swy" style={{ marginTop: "1.4rem" }}>
                {logoOk ? (
                  <img
                    className="swy-logo"
                    src={LOGO_SRC}
                    alt="Swytchcode"
                    width={184}
                    height={44}
                    onError={() => setLogoOk(false)}
                  />
                ) : (
                  <span className="swy-fallback">Swytchcode</span>
                )}
                <span className="swy-txt">
                  <b>Powered by Swytchcode</b>
                  Execution layer only — OppSync remains the product.
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}