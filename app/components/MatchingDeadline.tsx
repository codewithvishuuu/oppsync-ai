import Reveal from "./Reveal";

/**
 * 05 — Matching + Deadline, combined into one split composition.
 * The 92% / 4 days figures are fixed illustrative values, labelled as such.
 * Real opportunities always use actual eligibility + deadline_intelligence.
 */

const CRITERIA = [
  { k: "Degree", s: "match", t: "BCA is listed as eligible" },
  { k: "Year", s: "match", t: "Second year satisfies the requirement" },
  { k: "Skills", s: "match", t: "Python is present in your profile" },
  { k: "CGPA", s: "match", t: "Profile CGPA clears the stated minimum" },
  { k: "Location", s: "unknown", t: "No location requirement was stated" },
  { k: "Other requirements", s: "unknown", t: "Stated but not machine-checkable" },
];

const SCALE = [
  { k: "Today", w: 8 },
  { k: "1–3 days", w: 18 },
  { k: "4–7 days", w: 36, now: true, at: "44%" },
  { k: "8–14 days", w: 62 },
  { k: "15+ days", w: 90 },
];

export default function MatchingDeadline() {
  return (
    <section className="band band-pad band--paper band--tight" id="matching">
      <div className="shell">
        <div className="shead">
          <span className="shead-n">04</span>
          <div className="shead-body">
            <p className="eyebrow">intelligence/</p>
            <Reveal variant="clip">
              <h3 className="d1 d1-lg">Two numbers that matter.</h3>
            </Reveal>
            <p className="lede">
              OppSync doesn&apos;t only find opportunities. It helps you
              understand which ones deserve attention.
            </p>
          </div>
        </div>

        <Reveal delay={60}>
          <div className="dual dual--moment" style={{ marginTop: "clamp(1rem,2vw,1.5rem)" }}>
            <div className="dual-cell dual-cell--match">
              <span className="scene-k">Eligibility · example</span>
              <div className="score score--hero">
                <span className="v">92%</span>
                <span className="l">Match</span>
              </div>
              <p className="lede" style={{ marginTop: "0.7rem" }}>
                How well this opportunity fits your profile — from stated
                requirements only.
              </p>

              <ul className="crit">
                {CRITERIA.map((c) => (
                  <li key={c.k} tabIndex={0}>
                    <span className="k">{c.k}</span>
                    <span className={"m " + (c.s === "match" ? "ok" : "unk")}>
                      {c.s === "match" ? "✓" : "?"}
                    </span>
                    <span className="why">{c.t}</span>
                  </li>
                ))}
              </ul>
              <p className="note scale-note">
                Only stated requirements are scored. Unknown stays unknown.
              </p>
            </div>

            <div className="dual-div" aria-hidden="true" />

            <div className="dual-cell dual-cell--deadline" id="deadlines">
              <span className="scene-k">Deadline · example</span>
              <div className="dline">Urgent</div>
              <div className="days days--hero">4 <em>days left</em></div>
              <p className="lede" style={{ marginTop: "0.7rem" }}>
                How much time you have — with urgency from the real deadline.
              </p>

              <div className="scale">
                {SCALE.map((s) => (
                  <div className={"scale-row" + (s.now ? " is-now" : "")} key={s.k}>
                    <span className="scale-k">{s.k}</span>
                    <span className="scale-b">
                      <i style={{ width: s.w + "%" }} />
                    </span>
                  </div>
                ))}
              </div>

              <p className="note scale-note">
                Urgency is calculated from each opportunity&apos;s actual
                deadline.
              </p>
              <p className="meta" style={{ marginTop: "0.6rem" }}>
                Not a live scan
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}