import Reveal from "./Reveal";

/** 04 — Discovery. Email → extraction → object. Illustrative content.
 *  Presentation only. The flow rail is a static editorial summary of the
 *  existing product concepts — no data, no logic.
 */
const FLOW = ["Email", "Extract", "Match", "Deadline", "Decision"];

export default function Discovery() {
  return (
    <section className="band band-pad band--tight band--bridge" id="discovery">
      <div className="shell">
        <div className="shead">
          <span className="shead-n">03</span>
          <div className="shead-body">
            <p className="eyebrow">discovery/</p>
            <Reveal variant="clip">
              <h3 className="d1 d1-lg">From inbox<br />to opportunity.</h3>
            </Reveal>
            <p className="lede">
              One message in. One structured opportunity out — ready to match,
              rank and decide.
            </p>
          </div>
        </div>

        <Reveal delay={40}>
          <ol className="flow-rail" aria-label="Inbox to opportunity flow">
            {FLOW.map((f, i) => (
              <li key={f} className="flow-rail-step">
                <span className="flow-rail-n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flow-rail-t">{f}</span>
                {i < FLOW.length - 1 && (
                  <span className="flow-rail-c" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={80}>
          <div className="disc disc--large" style={{ marginTop: "clamp(1rem,2vw,1.5rem)" }}>
            <div className="disc-cell">
              <div className="disc-top">
                <span className="disc-n">01</span>
                <span className="disc-l">Inbox</span>
              </div>
              <p className="mail-from">AWS Careers · careers@amazon.com</p>
              <p className="mail-subject">Cloud Engineering Internship 2026</p>
              <p className="mail-body">
                Eligible: students pursuing BCA, B.Tech or equivalent
                undergraduate degree, second year or above. Minimum CGPA 7.5.
                Python required.
              </p>
              <span className="chip">deadline · 15 oct</span>
              <span className="chip">cgpa</span>
              <span className="chip">skills</span>
            </div>

            <div className="disc-cell">
              <div className="disc-top">
                <span className="disc-n">02</span>
                <span className="disc-l">Extraction</span>
              </div>
              <dl className="kv">
                <div><dt>name</dt><dd>Cloud Engineering Internship</dd></div>
                <div><dt>org</dt><dd>Amazon Web Services</dd></div>
                <div><dt>type</dt><dd>internship</dd></div>
                <div><dt>deadline</dt><dd>2026-10-15</dd></div>
                <div><dt>url</dt><dd>careers.amazon.com</dd></div>
                <div><dt>summary</dt><dd>Engineering internship</dd></div>
              </dl>
              <p className="note">Stated values only — never inferred.</p>
            </div>

            <div className="disc-cell">
              <div className="disc-top">
                <span className="disc-n">03</span>
                <span className="disc-l">Opportunity</span>
              </div>
              <p className="res-t">Cloud Engineering Internship</p>
              <p className="res-s">Amazon Web Services</p>
              <div className="res-tags">
                <span className="tag tag-ink">15 Oct 2026</span>
                <span className="tag tag-ok">Likely eligible</span>
              </div>
              <p className="res-t" style={{ marginTop: "0.6rem" }}>Deadline intelligence</p>
              <div className="res-tags">
                <span className="tag tag-clay">Urgent · 4 days</span>
              </div>
            </div>
          </div>
          <p className="meta" style={{ marginTop: "0.8rem" }}>
            Example — real cards always show data from your own scan.
          </p>
        </Reveal>
      </div>
    </section>
  );
}