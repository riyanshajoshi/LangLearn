import { useEffect, useState } from "react";
import { useStore } from "./lib/store.jsx";
import { conceptLabel, retention, dueTs, isDue, humanDue, forecast, reviewItem, STRATEGIES } from "./lib/engine.js";
import { makeDrill } from "./lib/drill.js";
import DrillPlayer from "./components/Drill.jsx";
import { Empty, ErrorNote, Loading, PageHead, SourceTag, SpeakButton, StrategyBadge } from "./components/Common.jsx";

function Curve({ points }) {
  const W = 520, H = 170, pad = 30;
  const xs = (d) => pad + (d / 14) * (W - pad - 10);
  const ys = (v) => 10 + (1 - v) * (H - 40);
  const pts = points.filter((p) => p.avg != null).map((p) => `${xs(p.day)},${ys(p.avg)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="curve" role="img" aria-label="Predicted average recall over the next 14 days">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={pad} x2={W - 10} y1={ys(v)} y2={ys(v)} className="radar-grid" /><text x={pad - 6} y={ys(v) + 3} textAnchor="end" className="radar-val">{Math.round(v * 100)}%</text></g>)}
      <line x1={pad} x2={W - 10} y1={ys(0.8)} y2={ys(0.8)} className="curve-target" />
      <polyline points={pts} className="curve-line" />
      {[0, 3, 7, 14].map((d) => <text key={d} x={xs(d)} y={H - 8} textAnchor="middle" className="radar-val">{d === 0 ? "now" : `+${d}d`}</text>)}
    </svg>
  );
}

function Flashcard({ v, onGrade }) {
  const { lang, profile, now } = useStore();
  const [show, setShow] = useState(false);
  const preview = (g) => humanDue(reviewItem(v, g, now), now).replace("in ", "");
  return (
    <div className="flash">
      <span className="vocabulary-eyebrow">VOCABULARY · {lang.toUpperCase()}</span>
      <h2>{v.word} <SpeakButton text={v.word} lang={lang} /></h2>
      <span className="vocabulary-pronunciation">{v.pron}</span>
      {!show ? <button className="primary-btn" onClick={() => setShow(true)}>Show meaning</button> : (
        <>
          {v.meaning_native && <p><b>{profile.native}:</b> {v.meaning_native}</p>}
          <p>{v.meaning_target}</p>
          <p className="bubble-sub">"{v.example}"</p>
          <p className="muted-note">How well did you remember it?</p>
          <div className="grade-row">{[["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]].map(([g, l]) => <button key={g} className={`grade ${g}`} onClick={() => onGrade(g)}>{l}<small>next {preview(g)}</small></button>)}</div>
        </>
      )}
    </div>
  );
}

export default function Revision({ params }) {
  const { state, profile, lang, ai, now, concepts, act } = useStore();
  const [active, setActive] = useState(null); // {type:'word', id} | {type:'concept', concept, drill, source, meta}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const words = state.vocab.filter((v) => v.lang === lang);
  const items = [...concepts.map((c) => ({ kind: "concept", id: c.key, ref: c, label: conceptLabel(c.concept) })), ...words.map((w) => ({ kind: "word", id: w.id, ref: w, label: w.word }))];
  const due = items.filter((x) => isDue(x.ref, now)).sort((a, b) => retention(a.ref, now) - retention(b.ref, now));
  const curve = forecast(items.map((x) => x.ref), now, 14);

  async function openConcept(concept) {
    setBusy(true); setError(null);
    try {
      const level = concepts.find((c) => c.concept === concept)?.level ?? 0;
      const r = await makeDrill({ profile, concept, level: Math.max(level, 0), concepts, mistakes: state.mistakes, useAI: ai.configured });
      setActive({ type: "concept", concept, ...r });
    } catch (e) { setError(e); setActive(null); }
    setBusy(false);
  }
  const open = (x) => (x.kind === "word" ? setActive({ type: "word", id: x.id }) : openConcept(x.ref.concept));

  useEffect(() => { if (params?.concept) openConcept(params.concept); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeWord = active?.type === "word" ? words.find((w) => w.id === active.id) : null;
  if (activeWord) {
    const v = activeWord;
    return (
      <div className="page">
        <PageHead eyebrow="REVISION" title="Vocabulary review" right={<button className="ghost-btn" onClick={() => setActive(null)}>← Back</button>} />
        <div className="card"><Flashcard key={v.id} v={v} onGrade={(g) => { act.gradeVocab(v.id, g); const next = due.find((x) => x.kind === "word" && x.id !== v.id); next ? setActive({ type: "word", id: next.id }) : setActive(null); }} /></div>
      </div>
    );
  }
  if (active?.type === "concept") {
    return (
      <div className="page">
        <PageHead eyebrow="REVISION" title={`Targeted drill: ${conceptLabel(active.concept)}`} right={<><SourceTag source={active.source} meta={active.meta} /><button className="ghost-btn" onClick={() => setActive(null)}>← Back</button></>} />
        {busy && <Loading label="Preparing the next drill with your current teaching approach…" />}
        <DrillPlayer key={active.drill.exercises[0].id} drill={active.drill} concept={active.concept} source="revision" onAgain={() => openConcept(active.concept)} againLabel="Next drill (adapted)" onClose={() => setActive(null)} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead eyebrow="FORGETTING PREDICTOR" title="Revision planner" sub="Revision is scheduled from your own answers using a memory-decay model (recall falls over time, and falls faster after mistakes)." />
      <ErrorNote error={error} />
      {busy && <Loading label="Preparing drill…" />}
      {!items.length ? <Empty icon="◷" title="Nothing to schedule yet" text="Save vocabulary or make a few mistakes and this page will predict when you are about to forget them." /> : (
        <>
          <div className="insight-grid">
            <div className="card">
              <h3 className="sub-h">Predicted recall if you do nothing</h3>
              <Curve points={curve} />
              <p className="muted-note">Average over {items.length} item(s). The dashed line is the 80% recall level where a review is scheduled. It is a model estimate, not a measurement of memory.</p>
            </div>
            <div className="card">
              <h3 className="sub-h">Due now ({due.length})</h3>
              {due.length ? (<>
                <button className="primary-btn" onClick={() => open(due[0])}>Start with the most urgent</button>
                <div className="due-list">{due.slice(0, 8).map((x) => (
                  <button key={x.id} className="due-item" onClick={() => open(x)}>
                    <span>{x.kind === "word" ? "Aa" : "▤"}</span><b>{x.label}</b>
                    {x.kind === "concept" && <StrategyBadge level={x.ref.level} />}
                    <em>{Math.round(retention(x.ref, now) * 100)}% recall</em>
                  </button>))}</div>
              </>) : <p className="muted-note">Nothing is due. Return when your next review is scheduled.</p>}
            </div>
          </div>
          <div className="card">
            <h3 className="sub-h">Schedule</h3>
            <div className="sched">
              {[...items].sort((a, b) => dueTs(a.ref) - dueTs(b.ref)).map((x) => {
                const r = Math.round(retention(x.ref, now) * 100);
                return (
                  <div key={x.id} className="sched-row">
                    <span className="sched-kind">{x.kind === "word" ? "Word" : "Concept"}</span>
                    <b>{x.label}</b>
                    <div className="ret-bar"><div style={{ width: `${r}%` }} className={r < 50 ? "low" : r < 80 ? "mid" : ""} /></div>
                    <small>{r}% · {humanDue(x.ref, now)}</small>
                    <button className="ghost-sm" onClick={() => open(x)}>Review</button>
                  </div>
                );
              })}
            </div>
            <p className="muted-note">Stability grows when you answer correctly and shrinks after errors. {STRATEGIES.length} teaching strategies are available per concept.</p>
          </div>
        </>
      )}
    </div>
  );
}
