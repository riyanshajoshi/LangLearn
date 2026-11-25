import { offlineQuiz } from "./lib/offline.js";
import { useState } from "react";
import "./Quiz.css";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildQuiz } from "./lib/prompts.js";
import { sampleBank } from "./lib/bank.js";
import { conceptLabel } from "./lib/engine.js";
import { go } from "./lib/nav.js";
import ExerciseCard from "./components/Exercise.jsx";
import { ErrorNote, Loading, SourceTag } from "./components/Common.jsx";

function Quiz() {
  const { profile, lang, ai, weak, act } = useStore();
  const [count, setCount] = useState(5);
  const [adaptive, setAdaptive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const focus = adaptive ? weak.slice(0, 3) : [];

  async function start() {
    setBusy(true); setError(null); setQuiz(null); setResults([]); setI(0); setDone(false);
    try {
      let q;
      try {
        const r = await runPrompt(buildQuiz({ profile, concepts: focus, count }), { task: "quiz" });
        if (r.data.questions.length < 2) throw new Error("The AI returned too few usable questions. Please try again.");
        q = { title: r.data.title, questions: r.data.questions, source: "ai", meta: r };
      } catch (e) {
        
        const w = (c) => 1 + (focus.find((f) => f.concept === c) ? 4 : 0);
        q = { title: "Offline practice quiz", questions: lang === "English" ? sampleBank(count, w) : offlineQuiz(profile,count), source: "builtin" };
      }
      setQuiz(q);
    } catch (e) { setError(e); }
    setBusy(false);
  }

  function finish(all) {
    const byConcept = {};
    all.forEach((r) => { const c = r.item.concept; byConcept[c] = byConcept[c] || { right: 0, total: 0 }; byConcept[c].total++; if (r.ok) byConcept[c].right++; });
    act.addQuiz({ score: all.filter((r) => r.ok).length, total: all.length, byConcept });
    setDone(true);
  }

  if (done) {
    const score = results.filter((r) => r.ok).length;
    const wrong = results.filter((r) => !r.ok);
    const by = {};
    results.forEach((r) => { const c = r.item.concept; by[c] = by[c] || [0, 0]; by[c][1]++; if (r.ok) by[c][0]++; });
    return (
      <div className="quiz-page">
        <div className="quiz-result-card">
          <span className="quiz-label">QUIZ COMPLETED</span>
          <h1>{score === results.length ? "Perfect score!" : score >= results.length / 2 ? "Good work!" : "Keep learning!"}</h1>
          <div className="quiz-score-circle"><strong>{score}/{results.length}</strong><span>Your Score</span></div>
          <div className="by-concept">{Object.entries(by).map(([c, [r, t]]) => <div key={c}><span>{conceptLabel(c)}</span><div className="mini-bar"><div style={{ width: `${(r / t) * 100}%` }} /></div><em>{r}/{t}</em></div>)}</div>
          <p className="muted-note">{wrong.length ? `${wrong.length} wrong answer(s) were added to your mistake memory and will shape your next quiz.` : "Nothing new for your mistake memory."}</p>
          <div className="row-gap"><button className="quiz-restart-button" onClick={start}>↻ New adaptive quiz</button>{wrong.length > 0 && <button className="ghost-btn" onClick={() => go("mistakes")}>Review mistakes</button>}</div>
        </div>
        {wrong.length > 0 && (
          <div className="review-list">
            <h3 className="sub-h">Review of wrong answers</h3>
            {wrong.map((r, k) => <div key={k} className="corr-card"><div className="corr-head"><span className="mistake-topic">{conceptLabel(r.item.concept)}</span></div><p><b>{r.item.prompt}</b></p><div className="corr-flow"><div className="corr-box bad"><span>Your answer</span><p>{r.given}</p></div><div className="corr-arrow">→</div><div className="corr-box good"><span>Correct</span><p>{r.item.answer}</p></div></div><p className="corr-reason">{r.item.explanation}</p></div>)}
          </div>
        )}
      </div>
    );
  }

  if (quiz) {
    const item = quiz.questions[i];
    return (
      <div className="quiz-page">
        <div className="quiz-heading"><span className="quiz-label">ADAPTIVE QUIZ</span><h1>{quiz.title || "Practice quiz"}</h1><SourceTag source={quiz.source} meta={quiz.meta} valid={quiz.meta?.valid} attempts={quiz.meta?.attempts} /></div>
        <div className="quiz-card">
          <ExerciseCard key={item.id} item={item} index={i} total={quiz.questions.length} isLast={i === quiz.questions.length - 1}
            onResult={(r) => act.logExercise({ concept: r.item.concept, ok: r.ok, source: "quiz", given: r.given, correct: r.item.answer, reason: r.item.explanation, context: r.item.prompt })}
            onNext={(r) => { const all = [...results, r]; setResults(all); if (i === quiz.questions.length - 1) finish(all); else setI(i + 1); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-heading"><span className="quiz-label">LEARNING ACTIVITY</span><h1>Practice Quiz</h1><p>Questions are generated for your language pair and level, and weighted toward what you get wrong.</p></div>
      <div className="quiz-card">
        <h3 className="sub-h">{profile.native} → {lang} · {profile.level}</h3>
        <div className="quiz-config">
          <label className="check-row"><input type="checkbox" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} /> Adapt to my mistakes</label>
          <label>Questions <select value={count} onChange={(e) => setCount(+e.target.value)}>{[5, 6, 8, 10].map((n) => <option key={n}>{n}</option>)}</select></label>
        </div>
        {adaptive && (focus.length ? <div className="focus-chips"><span>This quiz will focus on:</span>{focus.map((c) => <b key={c.concept}>{conceptLabel(c.concept)}</b>)}</div> : <p className="muted-note">No mistakes recorded yet for {lang}, so the first quiz covers varied topics. Your answers will personalise the next one.</p>)}
        <p className="muted-note">Question types: multiple choice, fill-in-the-blank, translation and sentence formation{ai.configured ? "." : " (offline mode: multiple choice from the built-in practice bank)."}</p>
        <button className="primary-btn" onClick={start} disabled={busy}>{busy ? "Preparing…" : "Start quiz"}</button>
        <ErrorNote error={error} onRetry={start} />
        {busy && <Loading label="Building your quiz…" />}
      </div>
    </div>
  );
}

export default Quiz;
