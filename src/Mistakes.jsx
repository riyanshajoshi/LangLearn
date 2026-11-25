import { useState } from "react";
import "./Mistakes.css";
import { useStore } from "./lib/store.jsx";
import { CATEGORIES, conceptLabel, catOf, weaknessMap, interferenceStats, retention, humanDue } from "./lib/engine.js";
import { go } from "./lib/nav.js";
import Radar from "./components/Radar.jsx";
import { Empty, StrategyBadge } from "./components/Common.jsx";

function Mistakes() {
  const { state, lang, profile, now, concepts, act } = useStore();
  const [fCat, setFCat] = useState("all");
  const [fState, setFState] = useState("all");
  const list = state.mistakes.filter((m) => m.lang === lang).sort((a, b) => b.ts - a.ts);
  const map = weaknessMap(state.events, lang, now);
  const inter = interferenceStats(state.mistakes, lang);
  const ranked = [...concepts].sort((a, b) => b.level - a.level || b.wrong - a.wrong);
  const reviewed = list.filter((m) => m.reviewed).length;
  const shown = list.filter((m) => (fCat === "all" || catOf(m.concept) === fCat) && (fState === "all" || (fState === "open" ? !m.reviewed : m.reviewed)));

  if (!list.length)
    return (
      <div className="mistakes-page">
        <div className="mistakes-heading"><span className="mistakes-label">YOUR LEARNING JOURNEY</span><h1>My Mistakes</h1><p>Your personal error memory for {lang}.</p></div>
        <Empty icon="↻" title="No mistakes recorded yet" text="Chat with the tutor, correct a sentence or take a quiz. Every mistake is saved here, grouped by cause, and used to personalise your next lessons.">
          <div className="row-gap"><button className="primary-btn" onClick={() => go("tutor")}>Talk to the tutor</button></div>
        </Empty>
      </div>
    );

  return (
    <div className="mistakes-page">
      <div className="mistakes-heading"><span className="mistakes-label">YOUR LEARNING JOURNEY</span><h1>My Mistakes</h1><p>Mistake memory, weakness map and the native-language patterns behind your errors ({profile.native} → {lang}).</p></div>

      <div className="mistakes-summary">
        <div><strong>{list.length}</strong><span>Total mistakes</span></div>
        <div><strong>{concepts.length}</strong><span>Concepts affected</span></div>
        <div><strong>{Math.round(inter.share * 100)}%</strong><span>Linked to {profile.native}</span></div>
        <div><strong>{list.length - reviewed}</strong><span>Left to review</span></div>
      </div>

      <div className="insight-grid">
        <div className="card">
          <h3 className="sub-h">Personal weakness map</h3>
          <Radar map={map} />
          <p className="muted-note">Recency-weighted accuracy per area (older answers count less). Based only on your recorded answers.</p>
        </div>
        <div className="card">
          <h3 className="sub-h">Concepts to work on</h3>
          {ranked.map((c) => (
            <div key={c.key} className="concept-row">
              <div className="cr-main"><b>{conceptLabel(c.concept)}</b><span>{c.wrong} wrong · {c.right} right</span></div>
              <StrategyBadge level={c.level} />
              <div className="cr-ret" title="Predicted recall"><div className="ret-bar"><div style={{ width: `${Math.round(retention(c, now) * 100)}%` }} /></div><small>{humanDue(c, now)}</small></div>
              <button className="ghost-sm" onClick={() => go("revision", { concept: c.concept })}>Practise</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="sub-h">⇄ Language interference detected</h3>
        {inter.patterns.length ? inter.patterns.map((p) => (
          <div key={p.pattern} className="pattern-row"><div><b>{p.pattern}</b>{p.confidence && <em> · {p.confidence}</em>}<p>{p.explanation}</p></div><span className="count-pill">×{p.count}</span></div>
        )) : <p className="muted-note">No mistakes with a clear {profile.native} pattern yet. Errors without a clear link are not labelled as interference.</p>}
      </div>

      <div className="filter-bar">
        <div className="seg left"><button className={fCat === "all" ? "on" : ""} onClick={() => setFCat("all")}>All</button>{Object.entries(CATEGORIES).map(([k, v]) => <button key={k} className={fCat === k ? "on" : ""} onClick={() => setFCat(k)}>{v.label}</button>)}</div>
        <div className="seg left"><button className={fState === "all" ? "on" : ""} onClick={() => setFState("all")}>Any</button><button className={fState === "open" ? "on" : ""} onClick={() => setFState("open")}>To review</button><button className={fState === "done" ? "on" : ""} onClick={() => setFState("done")}>Reviewed</button></div>
      </div>

      <div className="mistakes-list">
        {shown.map((m, index) => (
          <div className="mistake-card" key={m.id}>
            <div className="mistake-card-top">
              <span className="mistake-topic">{conceptLabel(m.concept)}</span>
              <span className="mistake-number">{m.demo && <span className="demo-badge">demo</span>} {m.source} · {new Date(m.ts).toLocaleDateString()}</span>
            </div>
            {m.context && <p className="mistake-ctx">{m.context}</p>}
            <div className="mistake-answer wrong-answer"><span>Your answer</span><p>{m.original}</p></div>
            {m.corrected && <div className="mistake-answer correct-answer"><span>Correct answer</span><p>{m.corrected}</p></div>}
            {m.reason && <p className="mistake-explanation">{m.reason}</p>}
            {m.interference?.is_transfer && <p className="mistake-explanation interf-line">⇄ {m.interference.pattern}: {m.interference.explanation}</p>}
            <div className="row-gap">
              <button className="review-button" onClick={() => act.toggleReviewed(m.id)}>{m.reviewed ? "✓ Reviewed" : "Mark as Reviewed"}</button>
              <button className="ghost-sm" onClick={() => go("revision", { concept: m.concept })}>Practise this</button>
            </div>
          </div>
        ))}
        {!shown.length && <Empty icon="✓" title="Nothing matches these filters" />}
      </div>
    </div>
  );
}

export default Mistakes;
