import { phraseTranslate } from "./lib/offline.js";
import { useState } from "react";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildTranslate } from "./lib/prompts.js";
import { LANGUAGES } from "./lib/languages.js";
import { Empty, ErrorNote, Loading, MicButton, PageHead, SourceTag, SpeakButton } from "./components/Common.jsx";

const CONTEXTS = ["Neutral", "Formal", "Casual", "Travel", "Academic", "Workplace"];

export default function Translate() {
  const { state, profile, lang, ai, act } = useStore();
  const [from, setFrom] = useState(profile.native);
  const [to, setTo] = useState(lang);
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState("Neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [res, setRes] = useState(null);

  const swap = () => { setFrom(to); setTo(from); setRes(null); };
  const setPair = (f, t) => { if (f === t) return; setFrom(f); setTo(t); };

  async function run(t = text, f = from, tt = to) {
    if (!t.trim() || busy) return;
    setBusy(true); setError(null); setRes(null);
    try {
      const r = await runPrompt(buildTranslate({ profile, from: f, to: tt, text: t.trim(), context: ctx }), { task: "translate" });
      const out = { ...r.data, from: f, to: tt, source: "ai", meta: r, text: t.trim() };
      setRes(out);
      act.addTranslation({ from: f, to: tt, text: t.trim(), translation: r.data.translation });
    } catch (e) {
      const translation = phraseTranslate(t, f, tt);
      if (translation) { setRes({translation, from:f,to:tt,text:t.trim(),source:"builtin",meta:{},context_note:"Basic phrasebook match; context and tone are not analysed."}); act.addTranslation({from:f,to:tt,text:t.trim(),translation}); }
      else setError(new Error("AI is unavailable and this phrase is not in the offline phrasebook. Try Hello, Thank you, or connect a working AI provider."));
    }
    setBusy(false);
  }

  return (
    <div className="page">
      <PageHead eyebrow="TRANSLATION & PRONUNCIATION" title="Contextual translator" sub="Translates meaning and tone, not word-for-word, and shows how to say it." />
      <div className="card">
        <div className="lang-pair">
          <select value={from} onChange={(e) => setPair(e.target.value, to)}>{LANGUAGES.map((l) => <option key={l.name} disabled={l.name === to}>{l.name}</option>)}</select>
          <button className="icon-btn" onClick={swap} aria-label="Swap languages" title="Swap languages">⇄</button>
          <select value={to} onChange={(e) => setPair(from, e.target.value)}>{LANGUAGES.map((l) => <option key={l.name} disabled={l.name === from}>{l.name}</option>)}</select>
        </div>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type or speak in ${from}…`} />
        <div className="chip-row">{CONTEXTS.map((c) => <button key={c} className={`chip ${ctx === c ? "on" : ""}`} onClick={() => setCtx(c)}>{c}</button>)}</div>
        <div className="row-gap">
          <button className="primary-btn" onClick={() => run()} disabled={busy || !text.trim()}>{busy ? "Translating…" : "Translate"}</button>
          <MicButton lang={from} onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
          {!ai.configured && <span className="muted-note">Offline mode supports common phrasebook expressions.</span>}
        </div>
      </div>
      <ErrorNote error={error} onRetry={() => run()} />
      {busy && <Loading label="Translating with context…" />}
      {res && (
        <div className="card trans-result">
          <div className="result-head"><h3>{res.to}</h3><SourceTag source={res.source} meta={res.meta} valid={res.meta.valid} attempts={res.meta.attempts} /></div>
          <p className="trans-main">{res.translation} <SpeakButton text={res.translation} lang={res.to} /></p>
          {res.pronunciation && <p className="trans-pron"><span>Pronunciation</span> {res.pronunciation}</p>}
          <div className="two-col">
            <div><h4>Literal gloss</h4><p className="muted-note">{res.literal_gloss}</p></div>
            <div><h4>Context</h4><p className="muted-note">{res.context_note}</p></div>
          </div>
          {res.alternatives?.length > 0 && <><h4>Other ways to say it</h4><ul className="alt-list">{res.alternatives.map((a, i) => <li key={i}><b>{a.text}</b> <em>{a.register}</em> <SpeakButton text={a.text} lang={res.to} /></li>)}</ul></>}
          {res.key_words?.length > 0 && (
            <><h4>Key words</h4>
              <div className="kw-grid">{res.key_words.map((k, i) => (
                <div key={i} className="kw"><b>{k.word}</b><span>{k.meaning}</span><em>{k.pronunciation}</em>
                  {res.to === lang && <button className="ghost-sm" onClick={() => act.addVocab({ word: k.word, pron: k.pronunciation, meaning_native: res.from === profile.native ? res.text : "", meaning_target: k.meaning, example: res.translation, example_translation: res.text, synonyms: [], usage_note: "", topic: "Translation" })}>+ Save</button>}
                </div>))}</div>
              {res.to !== lang && <p className="muted-note">Words can be saved to vocabulary when translating into {lang}.</p>}
            </>
          )}
        </div>
      )}
      {!res && !busy && state.translations.length > 0 && (
        <div className="card"><h3 className="sub-h">Recent</h3>{state.translations.map((t, i) => (
          <button key={i} className="hist-row" onClick={() => { setFrom(t.from); setTo(t.to); setText(t.text); }}><span>{t.from} → {t.to}</span><b>{t.text}</b><em>{t.translation}</em></button>))}</div>
      )}
      {!res && !busy && !state.translations.length && <Empty icon="⇄" title="Translate something" text="Try a sentence you would really say, pick the context, and listen to the pronunciation." />}
    </div>
  );
}
