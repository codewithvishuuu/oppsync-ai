import Reveal from "./Reveal";

/** 07 — How OppSync works. One connected editorial path, six stages.
 *  Presentation only. Same six ideas as before, retitled to the product
 *  verbs. Nothing is written to Calendar or Notion until approval.
 */
const STAGES = [
  { n: "01", t: "Connect", s: "List the 10 most recent emails." },
  { n: "02", t: "Discover", s: "Surface messages that hold opportunities." },
  { n: "03", t: "Extract", s: "Transcribe only what is stated." },
  { n: "04", t: "Match", s: "Compare against your profile, with urgency." },
  { n: "05", t: "Decide", s: "Approve or reject each card." },
  { n: "06", t: "Act", s: "Calendar + Notion, written only on approval.", end: true },
];

export default function HowItWorks() {
  return (
    <section className="band band-pad band--tight" id="how-it-works">
      <div className="shell">
        <div className="shead shead--rev">
          <span className="shead-n">06</span>
          <div className="shead-body">
            <p className="eyebrow">process/</p>
            <Reveal variant="clip">
              <h3 className="d1 d1-lg">Six steps, one direction.</h3>
            </Reveal>
            <p className="lede">
              OppSync prepares each opportunity before you decide. Nothing is
              written to Calendar or Notion until you press Approve.
            </p>
          </div>
        </div>

        <Reveal delay={60}>
          <ol className="path path--editorial" style={{ marginTop: "clamp(1rem,2vw,1.5rem)" }}>
            {STAGES.map((s) => (
              <li className={"path-step" + (s.end ? " path-step--end" : "")} key={s.n}>
                <span className="path-n">{s.n}</span>
                <span className="path-t">{s.t}</span>
                <span className="path-s">{s.s}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}