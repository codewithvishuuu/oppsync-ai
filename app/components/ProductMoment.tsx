import Reveal from "./Reveal";

/** 03 — Product moment: the problem, and the transformation.
 *  Presentation only. FEED is explicitly illustrative and labelled as such.
 *  Real opportunities always come from the scan in page.tsx.
 */
const FEED = [
  {
    from: "careers@amazon.com",
    subject: "Cloud Engineering Internship 2026",
    t: "Cloud Engineering Internship",
    s: "AWS · match 92% · 4 days left",
  },
  {
    from: "scholarships@tcs.com",
    subject: "Merit Scholarship 2026",
    t: "Merit Scholarship",
    s: "TCS · match 71% · 20 days left",
  },
  {
    from: "hello@hackathon.in",
    subject: "Smart India Hackathon",
    t: "Smart India Hackathon",
    s: "eligible · 12 days left",
  },
];

export default function ProductMoment() {
  return (
    <section className="band band-pad band--tight" aria-labelledby="moment-h">
      <div className="shell">
        <div className="shead">
          <span className="shead-n">02</span>
          <div className="shead-body">
            <p className="eyebrow">the-problem/</p>
            <Reveal variant="clip">
              <h2 className="d1 d1-lg" id="moment-h">Opportunity arrives as an email.</h2>
            </Reveal>
            <p className="lede">
              Buried in threads, easy to miss. OppSync keeps the message
              intact and gives it structure.
            </p>
          </div>
        </div>

        <Reveal delay={40}>
          <figure className="moment-figure">
            <picture>
              <source srcSet="/images/opportunity-inbox.webp" type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/opportunity-inbox.png"
                alt="Student reviewing an opportunity email on a laptop"
                width={1672}
                height={941}
                loading="lazy"
                decoding="async"
              />
            </picture>
            <figcaption className="moment-figcaption">
              <span className="meta">Student reviewing an opportunity email</span>
              <span className="meta">illustrative photograph</span>
            </figcaption>
          </figure>
        </Reveal>

        <div className="moment-grid" style={{ marginTop: "clamp(0.85rem,1.8vw,1.2rem)" }}>
          <Reveal delay={110}>
            <p className="d1 d1-md">
              OppSync turns the inbox into an{" "}
              <span className="accent">opportunity feed</span>.
            </p>
            <p className="lede" style={{ marginTop: "0.9rem" }}>
              Every relevant message becomes a structured opportunity with a
              match score, deadline and next action.
            </p>
            <p className="meta" style={{ marginTop: "1rem" }}>
              Example — not your mail · illustrative content only
            </p>
          </Reveal>

          <Reveal delay={60}>
            <div className="moment-feed moment-feed--sub">
              <div className="mf-h">
                <span className="meta">Inbox</span>
                <span className="meta">unread, unranked, missable</span>
              </div>
              {FEED.map((f) => (
                <div className="moment-item" key={f.t}>
                  <p className="mail-from">from · {f.from}</p>
                  <p className="mail-subject">{f.subject}</p>
                  <p className="moment-opp">{f.t}</p>
                  <span className="s">{f.s}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}