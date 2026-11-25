import { useState } from "react";
import { useStore } from "./lib/store.jsx";
import { ask, runPrompt } from "./lib/ai.js";
import { buildLayers, compose, buildLab, buildAudit, plainPrompt, LAB_TYPES, approxTokens } from "./lib/prompts.js";
import { CONCEPTS, STRATEGIES, conceptLabel, correctOffline, offlineSupported, levelFromRecent } from "./lib/engine.js";
import { BANK, practiceFor } from "./lib/bank.js";
import { Empty, ErrorNote, Loading, PageHead, SourceTag, StrategyBadge } from "./components/Common.jsx";

const dayLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const clean = (d) => { if (!d || typeof d !== "object") return d; const { _meta, ...rest } = d; return rest; }; // eslint-disable-line no-unused-vars
const pretty = (d) => (typeof d === "string" ? d : JSON.stringify(clean(d), null, 2));

function Layers({ layers, baseline }) {
  return (
    <div className="layers">
      {layers.map((l) => {
        const was = baseline?.find((b) => b.id === l.id);
        const changed = baseline && (l.on !== was?.on || (l.on && l.text !== was?.text));
        return (
          <div key={l.id} className={`layer ${l.on ? "on" : "off"} ${changed ? "changed" : ""}`}>
            <div className="layer-head"><b>{l.label}</b><span className="tech">{l.technique}</span>{changed && <span className="chg">changed since day 0</span>}<span className="state">{l.on ? "active" : "inactive"}</span></div>
            <p className="layer-why">{l.why}</p>
            {l.on && l.text && <pre className="prompt-pre small">{l.text}</pre>}
          </div>
        );
      })}
    </div>
  );
}

function Evolution() {
  const { profile, lang, weak, derived, concepts } = useStore();
  const conceptsNow = weak;
  const now = buildLayers({ profile, concepts: conceptsNow, task: "correct" });
  const day0 = buildLayers({ profile, concepts: [], task: "correct" });
  const log = derived.evolutions.filter((e) => e.lang === lang).slice(-12).reverse();
  const ids = Object.keys(CONCEPTS);
  const [sc, setSc] = useState("articles");
  const [wr, setWr] = useState(3);
  const recent = [...Array(5 - wr).fill(0), ...Array(wr).fill(1)];
  const lvl = levelFromRecent(recent);
  const sim = buildLayers({ profile, concepts: wr ? [{ concept: sc, wrong: wr, right: 5 - wr, level: lvl }] : [], task: "correct" });
  const changed = (a, b) => a.filter((l, i) => l.on !== b[i].on || (l.on && l.text !== b[i].text)).length;

  return (
    <>
      <div className="card">
        <h3 className="sub-h">How the tutor’s prompt has evolved</h3>
        <p className="muted-note">Every request is built from layers. Layers switch on, and the teaching strategy changes, only because of what you answered. Nothing is inferred about your feelings or mind.</p>
        <div className="evo-summary"><span>Day-0 prompt: <b>{approxTokens(compose(day0))}</b> tokens</span><span>→</span><span>Now: <b>{approxTokens(compose(now))}</b> tokens</span><span>{changed(now, day0)} layer(s) changed</span></div>
        {concepts.length === 0 && <p className="muted-note">No mistakes recorded for {lang} yet, so the prompt is still at day 0. Use the what-if simulator below, or load sample history in Settings.</p>}
        <Layers layers={now} baseline={day0} />
      </div>

      <div className="card">
        <h3 className="sub-h">Strategy changes from your answers</h3>
        {log.length ? <div className="evo-log">{log.map((e, i) => (
          <div key={i} className="evo-row"><span className="evo-date">{dayLabel(e.ts)}</span><b>{conceptLabel(e.concept)}</b><StrategyBadge level={e.from} /><span>→</span><StrategyBadge level={e.to} /><em>because {e.trigger}</em>{e.demo && <span className="demo-badge">demo</span>}</div>))}</div>
          : <Empty icon="⚗" title="No strategy changes yet" text="They appear when repeated mistakes (or a run of correct answers) change how a concept is taught." />}
      </div>

      <div className="card">
        <h3 className="sub-h">What-if simulator (not saved)</h3>
        <p className="muted-note">Pretend the learner got a concept wrong in some of their last 5 attempts and watch the prompt change.</p>
        <div className="row-gap">
          <select value={sc} onChange={(e) => setSc(e.target.value)}>{ids.map((c) => <option key={c} value={c}>{CONCEPTS[c].label}</option>)}</select>
          <label className="slider">Wrong in last 5: <b>{wr}</b><input type="range" min="0" max="5" value={wr} onChange={(e) => setWr(+e.target.value)} /></label>
          <StrategyBadge level={lvl} />
        </div>
        <p className="strategy-line"><b>{STRATEGIES[lvl].name}:</b> {STRATEGIES[lvl].directive}</p>
        <div className="two-col"><div><h4>Memory + strategy layers</h4><pre className="prompt-pre small">{compose(sim.filter((l) => ["memory", "transfer", "strategy"].includes(l.id))) || "(inactive: no mistakes)"}</pre></div><div><h4>Same input, day-0 prompt</h4><pre className="prompt-pre small">{compose(day0.filter((l) => ["memory", "transfer", "strategy"].includes(l.id)))}</pre></div></div>
      </div>
    </>
  );
}

function Tester() {
  const { profile, lang, ai, weak } = useStore();
  const [tid, setTid] = useState("format");
  const type = LAB_TYPES.find((t) => t.id === tid);
  const [input, setInput] = useState(type.sample);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [out, setOut] = useState(null);

  const built = buildLab(type, { profile, concepts: weak, input: input || type.sample });
  const choose = (id) => { setTid(id); setInput(LAB_TYPES.find((t) => t.id === id).sample); setOut(null); setError(null); };

  function offlineRun() {
    if (type.kind === "quiz" || type.kind === "revision") {
      const c = CONCEPTS[input.trim()] ? input.trim() : weak[0]?.concept || "articles";
      const qs = BANK.filter((q) => q.concept === c).slice(0, 2);
      return { source: "offline", data: type.kind === "quiz" ? { title: "Offline sample", questions: qs } : { intro: `Offline sample for ${conceptLabel(c)}`, contrast: "", exercises: qs }, note: "Built-in bank item, not generated by a prompt." };
    }
    if (!offlineSupported(profile.native, lang)) throw new Error(`Offline mode can only run this for English with a different native language. Add an API key to run real prompts for ${lang}.`);
    return { source: "offline", data: correctOffline(input, profile.native, practiceFor), note: "Rule engine output (no LLM was called). Connect AI to see how this prompt behaves." };
  }

  async function run(compare = false) {
    if (!input.trim() || busy) return;
    setBusy(true); setError(null); setOut(null);
    try {
      if (!ai.configured) { if (compare) throw new Error("Comparison needs the AI connection."); setOut(offlineRun()); }
      else {
        const task = type.kind === "quiz" ? "quiz" : type.kind === "revision" ? "revision" : type.spec === "structured" ? "structured" : type.spec ? "correct" : "lab";
        const r = await runPrompt(built, { task });
        const o = { source: "ai", meta: r, data: r.data, issues: r.issues, valid: r.valid, attempts: r.attempts, tokens: approxTokens(built.system + built.user) };
        if (type.audit) {
          const a = await runPrompt(buildAudit({ profile, text: input, proposed: clean(r.data) }), { task: "audit" });
          o.audit = a.data;
        }
        if (compare) {
          const p = plainPrompt(input, profile);
          const pr = await ask({ system: p.system, user: p.user, json: false, maxTokens: 500 });
          o.plain = pr.text;
        }
        setOut(o);
      }
    } catch (e) { setError(e); }
    setBusy(false);
  }

  return (
    <>
      <div className="card">
        <h3 className="sub-h">1 · Choose a prompt technique</h3>
        <div className="type-grid">{LAB_TYPES.map((t) => <button key={t.id} className={`type-card ${tid === t.id ? "on" : ""}`} onClick={() => choose(t.id)}><b>{t.name}</b><span>{t.blurb}</span></button>)}</div>
      </div>
      <div className="card">
        <h3 className="sub-h">2 · Generated prompt template <span className="tok">~{approxTokens(built.system + built.user)} tokens</span></h3>
        <p className="muted-note">Filled with your real profile ({profile.native} → {lang}, {profile.level}) and mistake memory.</p>
        <div className="layer-chips">{built.layers.filter((l) => l.on).map((l) => <span key={l.id} title={l.technique}>{l.label}</span>)}</div>
        <h4>System prompt</h4>
        <pre className="prompt-pre">{built.system || "(empty)"}</pre>
        <h4>User prompt</h4>
        <pre className="prompt-pre">{built.user}</pre>
      </div>
      <div className="card">
        <h3 className="sub-h">3 · Sample input and run</h3>
        <textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder={type.sample} />
        <div className="row-gap">
          <button className="primary-btn" onClick={() => run(false)} disabled={busy || !input.trim()}>{busy ? "Running…" : "Run prompt"}</button>
          <button className="ghost-btn" onClick={() => run(true)} disabled={busy || !input.trim() || !ai.configured} title="Also runs a plain one-line prompt for comparison">Run & compare with plain prompt</button>
          {!ai.configured && <span className="muted-note">Offline: runs the built-in rule engine instead of an LLM.</span>}
        </div>
        <ErrorNote error={error} />
        {busy && <Loading label="Running prompt…" />}
        {out && (
          <div className="lab-out">
            <div className="result-head"><h4>Output</h4><SourceTag source={out.source} meta={out.meta} valid={out.valid} attempts={out.attempts} /></div>
            {out.note && <p className="muted-note">{out.note}</p>}
            {out.source === "ai" && type.spec && <div className={`valid-badge ${out.valid ? "ok" : "bad"}`}>{out.valid ? "✓ Schema validation passed" : `✗ Validation issues: ${out.issues.join("; ")}`}{out.attempts > 1 && " (auto-repaired on 2nd attempt)"}{out.data?._meta?.dropped > 0 && ` · ${out.data._meta.dropped} invalid item(s) dropped`}</div>}
            {out.source === "ai" && !type.spec && <div className="valid-badge neutral">Free-text output: no schema, so nothing can be validated automatically.</div>}
            <div className={out.plain ? "two-col" : ""}>
              <div><h5>{type.name}</h5><pre className="prompt-pre">{pretty(out.data)}</pre></div>
              {out.plain && <div><h5>Plain one-line prompt</h5><pre className="prompt-pre">{out.plain}</pre></div>}
            </div>
            {out.audit && <><h5>Second pass: self-evaluation audit</h5><div className={`valid-badge ${out.audit.verdict === "ok" ? "ok" : "bad"}`}>Verdict: {out.audit.verdict}</div><pre className="prompt-pre">{pretty(out.audit)}</pre></>}
          </div>
        )}
      </div>
    </>
  );
}

export default function PromptLab() {
  const [tab, setTab] = useState("evolution");
  return (
    <div className="page">
      <PageHead eyebrow="PROMPT ENGINEERING" title="Prompt Lab" sub="Inspect how the tutor’s prompt adapts to the learner, and test each prompting technique."
        right={<div className="seg"><button className={tab === "evolution" ? "on" : ""} onClick={() => setTab("evolution")}>Prompt evolution</button><button className={tab === "tester" ? "on" : ""} onClick={() => setTab("tester")}>Technique tester</button></div>} />
      {tab === "evolution" ? <Evolution /> : <Tester />}
    </div>
  );
}
