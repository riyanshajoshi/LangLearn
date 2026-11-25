import { useEffect, useRef, useState } from "react";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildSim, buildSimSummary } from "./lib/prompts.js";
import { correctOffline, offlineSupported, conceptLabel } from "./lib/engine.js";
import { SCENARIOS, practiceFor } from "./lib/bank.js";
import { CorrectionCard, ErrorNote, Loading, MicButton, PageHead, SourceTag, SpeakButton } from "./components/Common.jsx";

const START_LEVEL = { Beginner: 1, Intermediate: 3, Advanced: 4 };
const avgOf = (s) => (s ? Math.round(((s.fluency + s.grammar + s.vocabulary) / 3) * 10) / 10 : null);

export default function Simulator() {
  const { state, profile, lang, ai, weak, act } = useStore();
  const [sid, setSid] = useState(null);
  const [mode, setMode] = useState("live");
  const [turns, setTurns] = useState([]);
  const [diff, setDiff] = useState(1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [scripted, setScripted] = useState(false);
  const endRef = useRef(null);
  const scenario = sid ? SCENARIOS[sid] : null;
  const savedLevel = state.simLevels[lang] ?? START_LEVEL[profile.level];
  const canScript = offlineSupported(profile.native, lang);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns.length, busy]);

  async function start(id) {
    const sc = SCENARIOS[id];
    setSid(id); setTurns([]); setSummary(null); setError(null); setDiff(savedLevel); setBusy(true);
    try {
      const r = await runPrompt(buildSim({ profile, concepts: weak, scenario: sc, difficulty: savedLevel, history: [], start: true }), { task: "sim" });
      setScripted(false);
      setTurns([{ role: "partner", text: r.data.partner_reply, translation: r.data.partner_reply_translation, hint: r.data.hint, source: "ai", meta: r }]);
    } catch (e) {
      if (e.offline && canScript) { setScripted(true); setTurns([{ role: "partner", text: sc.lines[0], source: "scripted" }]); }
      else if (e.offline) setError(new Error(`The simulator needs the AI connection for ${lang}. Add an API key to .env (see README).`));
      else setError(e);
    }
    setBusy(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setError(null);
    const history = turns.map((t) => ({ role: t.role === "user" ? "user" : "ai", text: t.text }));
    const withUser = [...turns, { role: "user", text }];
    setTurns(withUser); setBusy(true);
    try {
      if (scripted) {
        const r = correctOffline(text, profile.native, practiceFor);
        act.logTurn({ mistakes: r.corrections, attempt: true, source: "sim" });
        const n = withUser.filter((t) => t.role === "user").length;
        const line = scenario.lines[Math.min(n, scenario.lines.length - 1)];
        const scored = withUser.map((t, i) => (i === withUser.length - 1 ? { ...t, corrections: r.corrections, scores: { grammar: Math.max(1, 5 - r.corrections.length * 1.5) } } : t));
        setTurns([...scored, { role: "partner", text: line, source: "scripted" }]);
      } else {
        const r = await runPrompt(buildSim({ profile, concepts: weak, scenario, difficulty: diff, history, message: text }), { task: "sim" });
        const d = r.data;
        act.logTurn({ mistakes: d.corrections, attempt: true, source: "sim", fluency: d.scores.fluency });
        const scoredUser = withUser.map((t, i) => (i === withUser.length - 1 ? { ...t, corrections: d.corrections, scores: d.scores } : t));
        const out = [...scoredUser, { role: "partner", text: d.partner_reply, translation: d.partner_reply_translation, hint: d.hint, source: "ai", meta: r }];
        const recent = scoredUser.filter((t) => t.scores).slice(-2).map((t) => avgOf(t.scores));
        if (recent.length === 2) {
          const m = (recent[0] + recent[1]) / 2;
          if (m >= 4 && diff < 5) { setDiff(diff + 1); out.push({ role: "note", text: `Partner difficulty raised to ${diff + 1}/5: your last two turns averaged ${m.toFixed(1)}/5.` }); }
          else if (m <= 2 && diff > 1) { setDiff(diff - 1); out.push({ role: "note", text: `Partner difficulty lowered to ${diff - 1}/5: your last two turns averaged ${m.toFixed(1)}/5. Speaking more simply now.` }); }
        }
        setTurns(out);
      }
    } catch (e) { setError(e); }
    setBusy(false);
  }

  async function finish() {
    const mine = turns.filter((t) => t.role === "user");
    if (!mine.length) { setSid(null); return; }
    setBusy(true); setError(null);
    const scored = mine.filter((t) => t.scores);
    const avg = { fluency: 0, grammar: 0, vocabulary: 0 };
    scored.forEach((t) => Object.keys(avg).forEach((k) => (avg[k] += t.scores[k] ?? t.scores.grammar ?? 0)));
    Object.keys(avg).forEach((k) => (avg[k] = scored.length ? Math.round((avg[k] / scored.length) * 10) / 10 : 0));
    const all = mine.flatMap((t) => t.corrections || []);
    try {
      let s;
      if (scripted) {
        const c = [...new Set(all.map((x) => conceptLabel(x.concept)))];
        s = { overall: `You completed ${mine.length} turns. ${all.length ? `${all.length} corrections were found by the rule checker.` : "No common errors were found by the rule checker."}`, strengths: all.length ? ["You kept the conversation going"] : ["No common errors detected"], focus: c.length ? c.slice(0, 2) : ["Try longer sentences"], next_difficulty: savedLevel, source: "scripted" };
      } else {
        const r = await runPrompt(buildSimSummary({ profile, concepts: weak, scenario, turns: mine.map((t) => t.text), avg }), { task: "sim_summary" });
        s = { ...r.data, source: "ai", meta: r };
        act.setSimLevel(lang, r.data.next_difficulty);
      }
      act.addSim({ scenario: sid, turns: mine.length, avg, difficulty: diff });
      setSummary({ ...s, avg, corrections: all });
    } catch (e) { setError(e); }
    setBusy(false);
  }

  if (summary) {
    return (
      <div className="page">
        <PageHead eyebrow="REAL-LIFE SIMULATION" title="Conversation feedback" sub={`${scenario.title} · ${turns.filter((t) => t.role === "user").length} turns`} right={<SourceTag source={summary.source} meta={summary.meta} />} />
        <div className="card">
          {!scripted && <div className="score-row">{["fluency", "grammar", "vocabulary"].map((k) => <div key={k} className="score-pill"><span>{k}</span><strong>{summary.avg[k]}/5</strong><div className="mini-bar"><div style={{ width: `${(summary.avg[k] / 5) * 100}%` }} /></div></div>)}</div>}
          <p className="lead">{summary.overall}</p>
          <div className="two-col">
            <div><h4>Strengths</h4><ul>{summary.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><h4>Focus next</h4><ul>{summary.focus.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          {!scripted && <p className="muted-note">Next conversation starts at difficulty {summary.next_difficulty}/5 (based on your scores).</p>}
        </div>
        {mode === "end" && summary.corrections.length > 0 && (<><h3 className="sub-h">Corrections from this conversation</h3><div className="corr-list">{summary.corrections.map((c, i) => <CorrectionCard key={i} c={c} index={i} />)}</div></>)}
        <div className="row-gap"><button className="primary-btn" onClick={() => start(sid)}>↻ Try again</button><button className="ghost-btn" onClick={() => { setSid(null); setSummary(null); }}>Choose another scenario</button></div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="page">
        <PageHead eyebrow="REAL-LIFE SIMULATION" title="Conversation simulator" sub={`Practise ${lang} with an AI partner. Difficulty adapts to your scores; every mistake goes into your memory.`}
          right={<div className="seg"><button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Correct as we go</button><button className={mode === "end" ? "on" : ""} onClick={() => setMode("end")}>Feedback at the end</button></div>} />
        <div className="sim-level"><span>Starting difficulty</span><strong>{savedLevel}/5</strong><em>adapts after each conversation</em></div>
        <div className="scenario-grid">
          {Object.entries(SCENARIOS).map(([id, s]) => (
            <button key={id} className="scenario-card" onClick={() => start(id)}>
              <span className="scenario-icon">{s.icon}</span><h3>{s.title}</h3><p>{s.brief}</p><span className="card-tag">START →</span>
            </button>
          ))}
        </div>
        {!ai.configured && <p className="muted-note">Offline mode: {canScript ? "scripted partner lines with rule-based correction (English only)." : `the simulator needs an AI key for ${lang}.`}</p>}
        <ErrorNote error={error} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead eyebrow={scenario.icon + " " + scenario.title.toUpperCase()} title={scenario.title} sub={scenario.brief}
        right={<><span className="diff-badge">Difficulty {diff}/5 · adaptive</span><button className="ghost-btn" onClick={finish} disabled={busy}>End & get feedback</button></>} />
      <div className="chat-container sim-chat">
        <div className="chat-messages">
          {turns.map((t, i) => t.role === "note" ? <div key={i} className="sys-note">{t.text}</div> : (
            <div key={i} className={`message ${t.role === "user" ? "user" : "ai"}`}>
              <div className="message-avatar">{t.role === "user" ? (profile.name || "S").charAt(0).toUpperCase() : scenario.icon}</div>
              <div className="message-col">
                <div className="message-bubble"><p>{t.text}</p>{t.translation && <p className="bubble-sub">{t.translation}</p>}</div>
                {t.role === "partner" && <div className="say-line"><SpeakButton text={t.text} lang={lang} />{t.hint && <em>💡 {t.hint}</em>}{t.source === "scripted" && <SourceTag source="scripted" />}</div>}
                {t.role === "user" && t.scores && !scripted && <div className="turn-scores">fluency {t.scores.fluency} · grammar {t.scores.grammar} · vocabulary {t.scores.vocabulary}</div>}
                {t.role === "user" && mode === "live" && t.corrections?.map((c, k) => <CorrectionCard key={k} c={c} index={k} />)}
                {t.role === "user" && mode === "end" && t.corrections?.length > 0 && <div className="turn-scores">{t.corrections.length} correction(s) saved for the end</div>}
              </div>
            </div>
          ))}
          {busy && <div className="message ai"><div className="message-avatar">{scenario.icon}</div><Loading label="Partner is replying…" /></div>}
          <div ref={endRef} />
        </div>
        <ErrorNote error={error} />
        <form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Reply in ${lang}…`} disabled={busy} />
          <MicButton lang={lang} onText={setInput} />
          <button type="submit" disabled={busy || !input.trim()}>Send ↑</button>
        </form>
      </div>
    </div>
  );
}
