import { ask } from "./lib/ai.js";
import { useState } from "react";
import { useStore } from "./lib/store.jsx";
import { LANGUAGES, LEVELS, GOALS, langInfo } from "./lib/languages.js";

import { PageHead } from "./components/Common.jsx";

export function ProfileForm({ onDone, submitLabel = "Save profile" }) {
  const { profile, act } = useStore();
  const [d, setD] = useState(profile);
  const set = (k, v) => setD((x) => {
    const n = { ...x, [k]: v };
    if (k === "native" && v === x.target) n.target = x.target === "English" ? "Hindi" : "English";
    if (k === "target" && v === x.native) n.native = x.native === "English" ? "Hindi" : "English";
    return n;
  });
  const save = () => { act.setProfile({ ...d, name: d.name.trim(), onboarded: true }); onDone && onDone(); };
  const label = (l) => `${l.name} · ${l.script}`;
  return (
    <div className="setup-form">
      <label>Your name (optional)</label>
      <input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Asha" maxLength={30} />
      <div className="form-two">
        <div><label>I speak (native language)</label><select value={d.native} onChange={(e) => set("native", e.target.value)}>{LANGUAGES.map((l) => <option key={l.name} value={l.name}>{label(l)}</option>)}</select></div>
        <div><label>I want to learn</label><select value={d.target} onChange={(e) => set("target", e.target.value)}>{LANGUAGES.map((l) => <option key={l.name} value={l.name}>{label(l)}</option>)}</select></div>
      </div>
      <div className="form-two">
        <div><label>Proficiency</label><select value={d.level} onChange={(e) => set("level", e.target.value)}>{LEVELS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Learning goal</label><select value={d.goal} onChange={(e) => set("goal", e.target.value)}>{GOALS.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <label>How should I explain things?</label>
      <div className="radio-row">
        {[["target", `${d.target} only`], ["native", `${d.native}`], ["mixed", `Code-mixed (${langInfo(d.native).mix})`]].map(([id, text]) => (
          <button type="button" key={id} className={`radio-pill ${d.style === id ? "on" : ""}`} onClick={() => set("style", id)}>{text}</button>
        ))}
      </div>
      <button className="start-learning-button" onClick={save}>{submitLabel} <span>→</span></button>
    </div>
  );
}

export default function Settings() {
  const { state, ai, act } = useStore();
  const [test, setTest] = useState("");
  const [testing, setTesting] = useState(false);
  async function testAI() { setTesting(true); setTest(""); try { const r=await ask({user:"Translate Hello into Spanish. Return only the translation.",json:false,maxTokens:200}); setTest(`Response from ${r.provider} (${r.model}): ${r.text}`); } catch(e) { setTest(e.message); } finally {setTesting(false);} }
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "langlearn-data.json"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="page">
      <PageHead eyebrow="SETTINGS" title="Profile & data" sub="Your profile is saved in this browser and shapes every prompt the tutor builds." />
      <div className="card"><ProfileForm onDone={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }} />{saved && <p className="p-ok">✓ Profile saved</p>}</div>

      <div className="card">
        <h3 className="sub-h">AI connection</h3>
        {ai.configured ? <p className="p-ok">● Configured: {ai.provider} · {ai.model}. The key stays on the local server.</p> : <p><b>Offline mode.</b> No API key found. Add one to a <code>.env</code> file (see <code>.env.example</code>) and restart <code>npm run dev</code>. Until then, results are rule-based or built-in and are labelled as such.</p>}
        <button className="ghost-btn" disabled={testing} onClick={testAI}>{testing ? "Testing…" : "Test AI connection"}</button>{test && <p role="status">{test}</p>}
      </div>



      <div className="card">
        <h3 className="sub-h">Your data</h3>
        <div className="row-gap">
          <button className="ghost-btn" onClick={exportData}>Download my data (JSON)</button>
          {!confirm ? <button className="danger-btn" onClick={() => setConfirm(true)}>Reset everything</button> : <><span>Delete all progress?</span><button className="danger-btn" onClick={() => { act.resetAll(); setConfirm(false); }}>Yes, delete</button><button className="ghost-btn" onClick={() => setConfirm(false)}>Cancel</button></>}
        </div>
      </div>
    </div>
  );
}
