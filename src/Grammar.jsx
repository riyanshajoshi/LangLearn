import { useState } from "react";
import "./Grammar.css";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildCorrect } from "./lib/prompts.js";
import { CONCEPTS, correctOffline, offlineSupported, conceptLabel } from "./lib/engine.js";
import { practiceFor } from "./lib/bank.js";
import { makeDrill } from "./lib/drill.js";
import DrillPlayer from "./components/Drill.jsx";
import { CorrectionCard, ErrorNote, Loading, MicButton, PageHead, SourceTag, StrategyBadge } from "./components/Common.jsx";

const grammarTopics = [
  {
    id: 1,
    title: "Present Simple",
    concept: "agreement",
    category: "Beginner",
    description: "Talk about habits, routines, and facts.",
    rule: "Use the present simple for things that happen regularly or are generally true.",
    examples: [
      { wrong: "She go to college.", correct: "She goes to college." },
      { wrong: "I eats breakfast.", correct: "I eat breakfast." },
    ],
    question: "She _____ to college every day.",
    options: ["go", "goes", "going", "gone"],
    answer: 1,
    explanation: "Use 'goes' with he, she, or it in the present simple.",
  },
  {
    id: 2,
    title: "Present Continuous",
    concept: "tense",
    category: "Beginner",
    description: "Talk about actions happening right now.",
    rule: "Use am/is/are + verb-ing for actions happening at the moment.",
    examples: [
      { wrong: "I am study.", correct: "I am studying." },
      { wrong: "They is playing.", correct: "They are playing." },
    ],
    question: "They _____ football right now.",
    options: ["play", "plays", "are playing", "played"],
    answer: 2,
    explanation: "Use 'are + verb-ing' for an action happening right now.",
  },
  {
    id: 3,
    title: "Past Simple",
    concept: "tense",
    category: "Beginner",
    description: "Talk about completed actions in the past.",
    rule: "Use the past form of a verb for completed past actions.",
    examples: [
      { wrong: "I go yesterday.", correct: "I went yesterday." },
      { wrong: "She eat lunch.", correct: "She ate lunch." },
    ],
    question: "We _____ a movie yesterday.",
    options: ["watch", "watched", "watching", "watches"],
    answer: 1,
    explanation: "'Yesterday' indicates the past, so use 'watched'.",
  },
  {
    id: 4,
    title: "Articles (A, An, The)",
    concept: "articles",
    category: "Beginner",
    description: "Learn when to use a, an, and the.",
    rule: "Use 'a' before a consonant sound, 'an' before a vowel sound, and 'the' for something specific.",
    examples: [
      { wrong: "I ate a apple.", correct: "I ate an apple." },
      { wrong: "Give me book.", correct: "Give me the book." },
    ],
    question: "She bought _____ umbrella.",
    options: ["a", "an", "the", "no article"],
    answer: 1,
    explanation: "'Umbrella' begins with a vowel sound, so we use 'an'.",
  },
  {
    id: 5,
    title: "Prepositions",
    concept: "prepositions",
    category: "Intermediate",
    description: "Show time, place, and relationships.",
    rule: "Prepositions like in, on, and at show when or where something happens.",
    examples: [
      { wrong: "I wake up in 7 AM.", correct: "I wake up at 7 AM." },
      { wrong: "The book is in the table.", correct: "The book is on the table." },
    ],
    question: "My birthday is _____ July.",
    options: ["at", "on", "in", "by"],
    answer: 2,
    explanation: "Use 'in' with months, years, and longer time periods.",
  },
  {
    id: 6,
    title: "Subject-Verb Agreement",
    concept: "agreement",
    category: "Intermediate",
    description: "Make sure the subject and verb match.",
    rule: "A singular subject generally takes a singular verb, and a plural subject takes a plural verb.",
    examples: [
      { wrong: "He are happy.", correct: "He is happy." },
      { wrong: "They is students.", correct: "They are students." },
    ],
    question: "The students _____ ready.",
    options: ["is", "am", "are", "was"],
    answer: 2,
    explanation: "'Students' is plural, so we use 'are'.",
  },
  {
    id: 7,
    title: "Conditionals",
    concept: "linking",
    category: "Advanced",
    description: "Express possibilities and hypothetical situations.",
    rule: "The first conditional uses If + present simple, followed by will + verb.",
    examples: [
      { wrong: "If it will rain, I will stay.", correct: "If it rains, I will stay." },
      { wrong: "If I study, I pass.", correct: "If I study, I will pass." },
    ],
    question: "If it rains, we _____ at home.",
    options: ["stayed", "will stay", "stays", "stay yesterday"],
    answer: 1,
    explanation: "First conditional uses 'will + verb' in the result clause.",
  },
  {
    id: 8,
    title: "Passive Voice",
    concept: "verb_forms",
    category: "Advanced",
    description: "Focus on the action rather than the person doing it.",
    rule: "Passive voice uses a form of be + past participle.",
    examples: [
      { wrong: "The cake made by her.", correct: "The cake was made by her." },
      { wrong: "They built the house.", correct: "The house was built by them." },
    ],
    question: "The letter _____ yesterday.",
    options: ["sent", "is send", "was sent", "sending"],
    answer: 2,
    explanation: "Past passive voice uses 'was/were + past participle'.",
  },
];

const levels = ["All", "Beginner", "Intermediate", "Advanced"];

function EnglishLessons() {
  const { act } = useStore();
  const [level, setLevel] = useState("All");
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const filteredTopics =
    level === "All"
      ? grammarTopics
      : grammarTopics.filter((topic) => topic.category === level);

  const currentTopic = grammarTopics.find(
    (topic) => topic.id === selectedTopic
  );

  function openTopic(topic) {
    setSelectedTopic(topic.id);
    setSelectedAnswer(null);
    setShowFeedback(false);
  }

  function goBack() {
    setSelectedTopic(null);
    setSelectedAnswer(null);
    setShowFeedback(false);
  }

  function markCompleted() {
    if (!completed.includes(currentTopic.id)) {
      setCompleted([...completed, currentTopic.id]);
    }
  }

  function checkAnswer() {
    if (selectedAnswer !== null) {
      setShowFeedback(true);
      act.logExercise({
        concept: currentTopic.concept,
        ok: selectedAnswer === currentTopic.answer,
        source: "lesson",
        given: currentTopic.options[selectedAnswer],
        correct: currentTopic.options[currentTopic.answer],
        reason: currentTopic.explanation,
        context: currentTopic.question,
      });
    }
  }

  return (
    <div className="grammar-lessons">
      {!currentTopic ? (
        <>
          <div className="grammar-heading">
            <div>
              <span className="grammar-eyebrow">BUILT-IN ENGLISH LESSONS</span>
              <h2 className="lessons-title">Lessons</h2>
              <p>Build your English grammar step by step. Wrong answers are saved to your mistake memory.</p>
            </div>

            <div className="grammar-progress-card">
              <span>YOUR PROGRESS</span>
              <strong>
                {completed.length} / {grammarTopics.length}
              </strong>
              <div className="grammar-progress-bar">
                <div
                  style={{
                    width: `${(completed.length / grammarTopics.length) * 100}%`,
                  }}
                />
              </div>
              <small>Topics completed</small>
            </div>
          </div>

          <div className="grammar-filters">
            {levels.map((item) => (
              <button
                key={item}
                className={`grammar-filter ${level === item ? "active" : ""}`}
                onClick={() => setLevel(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grammar-topic-grid">
            {filteredTopics.map((topic) => (
              <div className="grammar-topic-card" key={topic.id}>
                <div className="grammar-card-top">
                  <span className={`grammar-level ${topic.category.toLowerCase()}`}>
                    {topic.category}
                  </span>

                  {completed.includes(topic.id) && (
                    <span className="grammar-done">✓ Completed</span>
                  )}
                </div>

                <h3>{topic.title}</h3>
                <p>{topic.description}</p>

                <div className="grammar-card-bottom">
                  <span>📖 Learn & Practice</span>
                  <button onClick={() => openTopic(topic)}>
                    Start Learning →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grammar-detail">
          <button className="grammar-back" onClick={goBack}>
            ← Back to Grammar
          </button>

          <div className="grammar-detail-header">
            <span className={`grammar-level ${currentTopic.category.toLowerCase()}`}>
              {currentTopic.category}
            </span>
            <h1>{currentTopic.title}</h1>
            <p>{currentTopic.description}</p>
          </div>

          <section className="grammar-section">
            <h2>📘 Grammar Rule</h2>
            <p>{currentTopic.rule}</p>
          </section>

          <section className="grammar-section">
            <h2>💡 Examples</h2>

            {currentTopic.examples.map((example, index) => (
              <div className="grammar-example" key={index}>
                <div className="grammar-wrong">
                  <span>✗ Incorrect</span>
                  <p>{example.wrong}</p>
                </div>

                <div className="grammar-correct">
                  <span>✓ Correct</span>
                  <p>{example.correct}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grammar-section grammar-practice">
            <h2>✍️ Practice Time</h2>
            <p className="grammar-question">{currentTopic.question}</p>

            <div className="grammar-options">
              {currentTopic.options.map((option, index) => (
                <button
                  key={index}
                  className={`grammar-option ${
                    selectedAnswer === index ? "selected" : ""
                  } ${
                    showFeedback && index === currentTopic.answer
                      ? "answer-correct"
                      : ""
                  } ${
                    showFeedback &&
                    selectedAnswer === index &&
                    index !== currentTopic.answer
                      ? "answer-wrong"
                      : ""
                  }`}
                  onClick={() => {
                    if (!showFeedback) setSelectedAnswer(index);
                  }}
                >
                  <span className="grammar-option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </button>
              ))}
            </div>

            {!showFeedback ? (
              <button
                className="grammar-check-button"
                disabled={selectedAnswer === null}
                onClick={checkAnswer}
              >
                Check Answer
              </button>
            ) : (
              <div
                className={`grammar-feedback ${
                  selectedAnswer === currentTopic.answer ? "correct" : "wrong"
                }`}
              >
                <strong>
                  {selectedAnswer === currentTopic.answer
                    ? "🎉 Correct answer!"
                    : "Not quite! Try to remember the rule."}
                </strong>
                <p>{currentTopic.explanation}</p>

                <button
                  className="grammar-check-button"
                  onClick={() => {
                    setSelectedAnswer(null);
                    setShowFeedback(false);
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
          </section>

          <button
            className="grammar-complete-button"
            onClick={markCompleted}
            disabled={completed.includes(currentTopic.id)}
          >
            {completed.includes(currentTopic.id)
              ? "✓ Topic Completed"
              : "Mark Topic as Completed"}
          </button>
        </div>
      )}
    </div>
  );
}

function Corrector() {
  const { profile, lang, ai, weak, concepts, state, act } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [out, setOut] = useState(null);
  const [drill, setDrill] = useState(null);
  const [dBusy, setDBusy] = useState(false);

  async function check() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setError(null); setOut(null); setDrill(null);
    try {
      let result;
      try {
        const r = await runPrompt(buildCorrect({ profile, concepts: weak, text: t }), { task: "correct" });
        result = { ...r.data, source: "ai", meta: r, valid: r.valid, attempts: r.attempts };
      } catch (e) {
        if (!e.offline) throw e;
        if (!offlineSupported(profile.native, lang)) throw new Error(`Offline checking only works for English with a different native language. Add an API key to .env to correct ${lang} sentences.`);
        result = { ...correctOffline(t, profile.native, practiceFor), source: "offline" };
      }
      act.logTurn({ mistakes: result.corrections, attempt: true, source: "corrector", fluency: result.feedback?.fluency });
      setOut(result);
    } catch (e) { setError(e); }
    setBusy(false);
  }

  async function moreDrill(concept) {
    setDBusy(true); setError(null);
    try {
      const level = concepts.find((c) => c.concept === concept)?.level ?? 1;
      setDrill({ ...(await makeDrill({ profile, concept, level: Math.max(1, level), concepts, mistakes: state.mistakes, useAI: ai.configured })), concept });
    } catch (e) { setError(e); }
    setDBusy(false);
  }

  const topConcept = out?.corrections?.[0]?.concept;
  return (
    <div className="corrector">
      <div className="card">
        <label className="field-label" htmlFor="gtext">Write a sentence in {lang}</label>
        <textarea id="gtext" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === "English" ? "e.g. I am having a doubt in this chapter. Where you are going?" : `Write one or two sentences in ${lang}…`} />
        <div className="row-gap">
          <button className="primary-btn" onClick={check} disabled={busy || !text.trim()}>{busy ? "Checking…" : "Check my sentence"}</button>
          <MicButton lang={lang} onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
          {lang === "English" && <button className="ghost-btn" onClick={() => setText("Yesterday I go to market. Where you are going? She is good in maths.")}>Try an example</button>}
        </div>
      </div>
      <ErrorNote error={error} />
      {busy && <Loading label="Analysing mistakes and their causes…" />}
      {out && (
        <div className="corr-results">
          <div className="result-head"><h3>{out.has_errors ? `${out.corrections.length} thing${out.corrections.length > 1 ? "s" : ""} to improve` : "No errors found 🎉"}</h3><SourceTag source={out.source} meta={out.meta} valid={out.valid} attempts={out.attempts} /></div>
          {out._meta?.dropped > 0 && <p className="muted-note">The validator removed {out._meta.dropped} invalid correction(s) from the AI reply.</p>}
          {out.source === "offline" && !out.has_errors && <p className="muted-note">The offline checker only knows common patterns, so this is not a guarantee. Connect AI for full checking.</p>}
          {out.natural_version && out.has_errors && <div className="natural-box"><span>Natural version</span><p>{out.natural_version}</p></div>}
          {out.feedback && <div className="score-row">{Object.entries(out.feedback).map(([k, v]) => <div key={k} className="score-pill"><span>{k}</span><strong>{v}/5</strong><div className="mini-bar"><div style={{ width: `${(v / 5) * 100}%` }} /></div></div>)}</div>}
          <div className="corr-list">{out.corrections.map((c, i) => <CorrectionCard key={i} c={c} index={i} />)}</div>
          {topConcept && !drill && <button className="primary-btn" onClick={() => moreDrill(topConcept)} disabled={dBusy}>{dBusy ? "Preparing…" : `Generate more practice: ${conceptLabel(topConcept)}`}</button>}
        </div>
      )}
      {drill && (
        <div className="drill-wrap">
          <div className="result-head"><h3>Targeted practice · {conceptLabel(drill.concept)}</h3><SourceTag source={drill.source} meta={drill.meta} /></div>
          <DrillPlayer key={drill.drill.exercises[0].id} drill={drill.drill} concept={drill.concept} source="corrector-drill" onAgain={() => moreDrill(drill.concept)} againLabel="New drill" onClose={() => setDrill(null)} />
        </div>
      )}
    </div>
  );
}

function AILessons() {
  const { profile, lang, ai, concepts, state } = useStore();
  const options = Object.entries(CONCEPTS).filter(([, v]) => v.cat === "grammar" || v.cat === "construction");
  const [concept, setConcept] = useState(options[0][0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lesson, setLesson] = useState(null);
  const level = concepts.find((c) => c.concept === concept)?.level ?? 0;

  async function generate() {
    setBusy(true); setError(null); setLesson(null);
    try { setLesson({ ...(await makeDrill({ profile, concept, level, concepts, mistakes: state.mistakes, useAI: ai.configured, count: 4 })), concept }); } catch (e) { setError(e); }
    setBusy(false);
  }
  return (
    <div className="card">
      <p className="lead">Pick a grammar concept. The lesson uses your language pair ({profile.native} → {lang}) and the teaching approach your past answers have earned for it.</p>
      <div className="row-gap">
        <select value={concept} onChange={(e) => { setConcept(e.target.value); setLesson(null); }}>{options.map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}</select>
        <StrategyBadge level={level} />
        <button className="primary-btn" onClick={generate} disabled={busy}>{busy ? "Preparing…" : "Generate lesson"}</button>
      </div>
      <ErrorNote error={error} onRetry={generate} />
      {busy && <Loading label="Preparing your lesson…" />}
      {lesson && <div className="drill-wrap"><div className="result-head"><h3>{conceptLabel(lesson.concept)}</h3><SourceTag source={lesson.source} meta={lesson.meta} /></div><DrillPlayer key={lesson.drill.exercises[0].id} drill={lesson.drill} concept={lesson.concept} source="lesson" onAgain={generate} againLabel="Another lesson" onClose={() => setLesson(null)} /></div>}
    </div>
  );
}

export default function Grammar() {
  const { lang } = useStore();
  const [tab, setTab] = useState("corrector");
  const [lessons, setLessons] = useState(lang === "English" ? "builtin" : "ai");
  return (
    <div className="grammar-page">
      <PageHead eyebrow="LEARN & PRACTISE" title="Grammar" sub="Smart correction: incorrect → correct → reason → why you made it → practice."
        right={<div className="seg"><button className={tab === "corrector" ? "on" : ""} onClick={() => setTab("corrector")}>Sentence corrector</button><button className={tab === "lessons" ? "on" : ""} onClick={() => setTab("lessons")}>Lessons</button></div>} />
      {tab === "corrector" && <Corrector />}
      {tab === "lessons" && (
        <>
          {lang === "English" && <div className="seg left"><button className={lessons === "builtin" ? "on" : ""} onClick={() => setLessons("builtin")}>Built-in lessons</button><button className={lessons === "ai" ? "on" : ""} onClick={() => setLessons("ai")}>Adaptive lesson generator</button></div>}
          {lang === "English" && lessons === "builtin" ? <EnglishLessons /> : <AILessons />}
        </>
      )}
    </div>
  );
}
