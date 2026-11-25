import { offlineWords } from "./lib/offline.js";
import { useEffect, useRef, useState } from "react";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildChat } from "./lib/prompts.js";
import { correctOffline, offlineSupported, conceptLabel } from "./lib/engine.js";
import { cannedTutorReply, practiceFor } from "./lib/bank.js";
import { styleLabel } from "./lib/languages.js";
import { go } from "./lib/nav.js";
import { CorrectionCard, ErrorNote, Loading, MicButton, SourceTag, SpeakButton } from "./components/Common.jsx";

export default function Tutor() {
  const { state, profile, lang, ai, weak, act } = useStore();
  const messages = state.chats[lang] || [];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastText, setLastText] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!messages.length) {
      const focus = weak.slice(0, 2).map((c) => conceptLabel(c.concept)).join(" and ");
      act.setChat(lang, [{ role: "ai", source: "system", text: `Hi${profile.name ? ` ${profile.name}` : ""}! I'm your ${lang} tutor for ${profile.native} speakers.\nLevel: ${profile.level} · Goal: ${profile.goal} · Explanations: ${styleLabel(profile)}.\n${focus ? `Your mistake log shows ${focus} come up often, so I'll watch for them and adapt how I explain.` : "I'll learn from your mistakes as we go: the more we practise, the more personal my teaching gets."}\nWrite a sentence in ${lang}, or ask me anything.` }]);
    }
  }, [lang, messages.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy]);

  async function send(raw = input) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput(""); setError(null); setLastText(text);
    const history = messages.filter((m) => m.source !== "system");
    const base = messages.map((m) => ({ ...m, promptUsed: undefined }));
    const withUser = [...base, { role: "user", text }];
    act.setChat(lang, withUser);
    setBusy(true);
    try {
      const built = buildChat({ profile, concepts: weak, history, message: text });
      const r = await runPrompt(built, { task: "chat" });
      const d = r.data;
      act.logTurn({ mistakes: d.corrections, attempt: d.attempt !== false, source: "chat", fluency: d.fluency });
      act.setChat(lang, [...withUser, { role: "ai", source: "ai", meta: { model: r.model, provider: r.provider }, valid: r.valid, attempts: r.attempts, text: d.reply, say: d.say, say_phonetic: d.say_phonetic, corrections: d.corrections, layersOn: built.layers.filter((l) => l.on).map((l) => l.label), promptUsed: built.system }]);
    } catch (e) {
      if (e.offline) {
        const canned = cannedTutorReply(text);
        if (offlineSupported(profile.native, lang)) {
          const r = correctOffline(text, profile.native, practiceFor);
          if (r.has_errors) act.logTurn({ mistakes: r.corrections, attempt: true, source: "chat" });
          const reply = r.has_errors ? `I found ${r.corrections.length} thing${r.corrections.length > 1 ? "s" : ""} to fix. Natural version: "${r.natural_version}"` : canned || "My offline checker found no common errors in that. It only knows a fixed set of patterns, so connect an AI key for full feedback.";
          act.setChat(lang, [...withUser, { role: "ai", source: r.has_errors ? "offline" : canned ? "builtin" : "offline", text: reply, corrections: r.corrections }]);
        } else {
          act.setChat(lang, [...withUser, { role: "ai", source: "builtin", text: `Offline phrase practice (${lang}):\n${offlineWords(profile).slice(0,5).map(w => `${w.word} — ${w.meaning_native}`).join("\n")}\nTry these in the vocabulary or quiz page. Full conversation and correction need a working AI provider.` }]);
        }
      } else setError(e);
    }
    setBusy(false);
  }

  const quick = [
    { label: weak[0] ? `Explain ${conceptLabel(weak[0].concept)}` : "Explain a basic rule", run: () => send(weak[0] ? `Explain ${conceptLabel(weak[0].concept)} in ${lang} with simple examples` : `Explain a basic ${lang} grammar rule for a ${profile.level} learner`) },
    { label: "Correct a sentence", run: () => { setInput(lang === "English" ? "I am having a doubt in this chapter." : ""); inputRef.current?.focus(); } },
    { label: `Teach me 5 ${lang} words`, run: () => send(`Teach me 5 useful ${lang} words for ${profile.goal.toLowerCase()}`) },
    { label: "Start a role-play", run: () => go("simulator") },
  ];

  return (
    <div className="tutor-page">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-avatar">✦</div>
          <div>
            <h2>Your AI {lang} tutor</h2>
            <p>{profile.native} → {lang} · {profile.level} · {profile.goal} · {styleLabel(profile)}</p>
          </div>
          <button className="change-profile-button" onClick={() => go("settings")}>Edit profile</button>
          <button className="change-profile-button" onClick={() => act.setChat(lang, [])}>Clear chat</button>
        </div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className="message-avatar">{m.role === "ai" ? "✦" : (profile.name || "S").charAt(0).toUpperCase()}</div>
              <div className="message-col">
                <div className="message-bubble">{m.text.split("\n").map((l, k) => <p key={k}>{l || "\u00A0"}</p>)}</div>
                {m.say && <div className="say-line"><SpeakButton text={m.say} lang={lang} /> <span>{m.say}</span>{m.say_phonetic && <em>{m.say_phonetic}</em>}</div>}
                {m.corrections?.map((c, k) => <CorrectionCard key={k} c={c} index={k} />)}
                {m.role === "ai" && m.source !== "system" && (
                  <div className="msg-meta">
                    <SourceTag source={m.source} meta={m.meta} valid={m.valid} attempts={m.attempts} />
                    {m.promptUsed && <details><summary>Why this reply? View prompt</summary><div className="layer-chips">{m.layersOn.map((l) => <span key={l}>{l}</span>)}</div><pre className="prompt-pre">{m.promptUsed}</pre></details>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="message ai"><div className="message-avatar">✦</div><Loading label="Tutor is thinking…" /></div>}
          <div ref={endRef} />
        </div>
        <ErrorNote error={error} onRetry={() => send(lastText)} />
        <div className="quick-prompts">{quick.map((q) => <button key={q.label} onClick={q.run} disabled={busy}>{q.label}</button>)}</div>
        <form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Write in ${lang} or ask a question…`} disabled={busy} />
          <MicButton lang={lang} onText={(t) => setInput(t)} />
          <button type="submit" disabled={busy || !input.trim()}>Send ↑</button>
        </form>
        <p className="demo-note">{ai.configured ? `✦ AI connected (${ai.model}). Replies are validated against a schema before use.` : "✦ Offline mode: rule-based English checks and built-in replies only. Add an API key for full AI tutoring."}</p>
      </div>
    </div>
  );
}
