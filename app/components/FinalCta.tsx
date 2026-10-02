import Reveal from "./Reveal";

/** 09 — Final CTA. Large closing composition. Real handleScan. */
const CHAIN = ["Gmail", "AI", "Match", "Deadline", "Decision", "Action"];

export default function FinalCta({
  onScan,
  loading,
}: {
  onScan: () => void;
  loading: boolean;
}) {
  return (
    <section className="final" id="cta">
      <span className="final-ghost" aria-hidden="true">OPPSYNC</span>
      <div className="shell final-in">
        <Reveal variant="clip">
          <p className="eyebrow">08 / action</p>
          <h2 className="d1 d1-hero" style={{ marginTop: "1rem" }}>
            Opportunities
            <br />
            shouldn&apos;t disappear
            <br />
            in your inbox.
          </h2>
          <div className="final-chain">
            {CHAIN.map((c, i) => (
              <span className={i === CHAIN.length - 1 ? "on" : ""} key={c}>
                {c}
              </span>
            ))}
          </div>
          <div className="hero-actions">
            <button className="btn btn-green" onClick={onScan} disabled={loading}>
              {loading ? "Scanning your inbox…" : "Scan Gmail"}
              <span className="arw" aria-hidden="true">↗</span>
            </button>
            <p className="close-note">One scan. Clear matches. Real deadlines. You decide.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}