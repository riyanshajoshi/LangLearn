import { useState } from "react";
import { useStore } from "../lib/store.jsx";
import { runPrompt } from "../lib/ai.js";
import { buildGrade } from "../lib/prompts.js";
import { norm, conceptLabel } from "../lib/engine.js";
import { Loading } from "./Common.jsx";

export const localMatch = (item, given) => {
  const g = norm(given);
  return !!g && [item.answer, ...(item.accept || [])].some((a) => norm(a) === g);
};

// One question of any type (mcq / fill / translate / order). Calls onResult once, then shows a Next button.
export default function ExerciseCard({ item, index, total, onResult, onNext, isLast }) {
  const { profile, ai } = useStore();
  const [given, setGiven] = useState("");
  const [picked, setPicked] = useState([]);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(value) {
    const g = (value ?? given).trim();
    if (!g || res || busy) return;
    let ok = localMatch(item, g);
    let extra = {};
    if (!ok && item.type === "translate" && ai.configured) {
      setBusy(true);
      try {
        const r = await runPrompt(buildGrade({ profile, prompt: item.prompt, expected: item.answer, given: g }), { task: "grade" });
        ok = !!r.data.correct;
        extra = { aiReason: r.data.reason, aiCorrected: r.data.corrected };
      } catch { /* fall back to strict comparison */ }
      setBusy(false);
    }
    const result = { item, given: g, ok, ...extra };
    setRes(result);
    onResult && onResult(result);
  }

  const words = item.words || [];
  const orderText = picked.map((i) => words[i]).join(" ");
  return (
    <div className="exercise">
      <div className="quiz-card-top">
        <span className="quiz-category">{conceptLabel(item.concept)} · {{ mcq: "Multiple choice", fill: "Fill in the blank", translate: "Translation", order: "Sentence formation" }[item.type]}</span>
        {total && <span className="quiz-question-number">Question {index + 1} of {total}</span>}
      </div>
      {total && <div className="quiz-progress-track"><div className="quiz-progress-fill" style={{ width: `${((index + (res ? 1 : 0)) / total) * 100}%` }} /></div>}
      <h2 className="quiz-question">{item.type === "translate" ? `Translate: ${item.prompt}` : item.type === "order" ? `Put the words in order: ${item.prompt}` : item.prompt}</h2>

      {item.type === "mcq" && (
        <div className="quiz-options">
          {item.options.map((o, i) => {
            const cls = res ? (o === item.answer ? "correct" : o === res.given ? "incorrect" : "") : "";
            return (
              <button key={o} className={`quiz-option ${cls}`} disabled={!!res} onClick={() => submit(o)}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span><span className="option-text">{o}</span>
                {res && o === item.answer && <span className="option-status">✓</span>}
                {res && o === res.given && o !== item.answer && <span className="option-status">✕</span>}
              </button>
            );
          })}
        </div>
      )}

      {(item.type === "fill" || item.type === "translate") && (
        <div className="ex-input">
          <input value={given} disabled={!!res || busy} autoFocus onChange={(e) => setGiven(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={item.type === "fill" ? "Type the missing word(s)" : `Write it in ${profile.target}`} />
          {!res && <button className="primary-sm" disabled={!given.trim() || busy} onClick={() => submit()}>Check</button>}
        </div>
      )}

      {item.type === "order" && (
        <div className="order-wrap">
          <div className="order-answer">{picked.length ? picked.map((i, k) => <button key={k} disabled={!!res} className="word-chip picked" onClick={() => setPicked(picked.filter((_, j) => j !== k))}>{words[i]}</button>) : <em>Tap the words below</em>}</div>
          <div className="order-pool">{words.map((w, i) => <button key={i} className="word-chip" disabled={!!res || picked.includes(i)} onClick={() => setPicked([...picked, i])}>{w}</button>)}</div>
          {!res && <button className="primary-sm" disabled={!picked.length || busy} onClick={() => submit(orderText)}>Check</button>}
        </div>
      )}

      {item.hint && !res && <p className="ex-hint">💡 Hint: {item.hint}</p>}
      {busy && <Loading label="Checking your answer…" />}
      {res && (
        <div className={`quiz-feedback ${res.ok ? "feedback-correct" : "feedback-incorrect"}`}>
          <strong>{res.ok ? "Correct! 🎉" : "Not quite."}</strong>
          {!res.ok && <p>Answer: <b>{res.aiCorrected || item.answer}</b></p>}
          <p>{res.aiReason || item.explanation}</p>
        </div>
      )}
      {res && <div className="quiz-footer"><span>{res.ok ? "Saved to your progress" : "Added to your mistake memory"}</span><button className="quiz-next-button" onClick={() => onNext(res)}>{isLast ? "Finish →" : "Next →"}</button></div>}
    </div>
  );
}
