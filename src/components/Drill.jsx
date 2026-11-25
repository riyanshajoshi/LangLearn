import { useState } from "react";
import { useStore } from "../lib/store.jsx";
import ExerciseCard from "./Exercise.jsx";
import { StrategyBadge } from "./Common.jsx";
import { conceptLabel, STRATEGIES } from "../lib/engine.js";

// Plays a revision drill: {intro, contrast, exercises[]}. Every answer feeds the mistake memory
// and may change the teaching strategy for the concept (shown at the end, based only on answers).
export default function DrillPlayer({ drill, concept, source = "drill", onAgain, onClose, againLabel = "Next drill" }) {
  const { concepts, act } = useStore();
  const [i, setI] = useState(0);
  const [results, setResults] = useState([]);
  const [before] = useState(() => concepts.find((c) => c.concept === concept)?.level ?? 0);
  const after = concepts.find((c) => c.concept === concept)?.level ?? 0;
  const list = drill.exercises;
  const done = results.length === list.length && i >= list.length;

  if (done) {
    const score = results.filter((r) => r.ok).length;
    return (
      <div className="quiz-result-card">
        <span className="quiz-label">DRILL COMPLETE · {conceptLabel(concept).toUpperCase()}</span>
        <div className="quiz-score-circle"><strong>{score}/{list.length}</strong><span>Score</span></div>
        <div className="evolve-note">
          {after !== before ? (
            <p>Your recent answers moved the teaching approach for <b>{conceptLabel(concept)}</b> from <StrategyBadge level={before} /> to <StrategyBadge level={after} />. {after > before ? "The next drill will explain it differently." : "Nice progress, so the tutor is easing off."}</p>
          ) : (
            <p>Teaching approach for {conceptLabel(concept)} stays at <StrategyBadge level={after} />: {STRATEGIES[after].directive}</p>
          )}
        </div>
        <div className="row-gap">
          {onAgain && <button className="quiz-restart-button" onClick={onAgain}>↻ {againLabel}</button>}
          {onClose && <button className="ghost-btn" onClick={onClose}>Done</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="quiz-card">
      {i === 0 && (drill.intro || drill.contrast) && (
        <div className="drill-intro">
          <div className="drill-strategy"><StrategyBadge level={before} /></div>
          {drill.intro && <p>{drill.intro}</p>}
          {drill.contrast && <p className="drill-contrast">⇄ {drill.contrast}</p>}
        </div>
      )}
      <ExerciseCard key={list[i].id} item={list[i]} index={i} total={list.length} isLast={i === list.length - 1}
        onResult={(r) => act.logExercise({ concept: r.item.concept || concept, ok: r.ok, kind: "review", source, given: r.given, correct: r.item.answer, reason: r.item.explanation, context: r.item.prompt })}
        onNext={(r) => { setResults((p) => [...p, r]); setI(i + 1); }} />
    </div>
  );
}
