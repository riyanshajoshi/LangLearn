import { offlineWords } from "./lib/offline.js";
import { useState } from "react";
import "./Vocabulary.css";
import { useStore } from "./lib/store.jsx";
import { runPrompt } from "./lib/ai.js";
import { buildVocab } from "./lib/prompts.js";
import { STATIC_WORDS } from "./lib/bank.js";
import { retention, isDue, humanDue } from "./lib/engine.js";
import { go } from "./lib/nav.js";
import { Empty, ErrorNote, Loading, SourceTag, SpeakButton } from "./components/Common.jsx";

const levelFilters = ["All", "Beginner", "Intermediate", "Advanced"];
const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);

export default function Vocabulary() {
  const { state, profile, lang, ai, now, weak, act } = useStore();
  const [tab, setTab] = useState("discover");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const key = `${lang}:${profile.native}:${profile.level}:${dayOf(now)}`;
  const saved = state.vocab.filter((v) => v.lang === lang);
  const isSaved = (w) => saved.some((v) => v.word.toLowerCase() === w.word.toLowerCase());
  const aiWords = state.daily[key] || [];
  const useStatic = lang === "English" && !ai.configured;
  const pool = [...aiWords, ...(useStatic ? STATIC_WORDS : offlineWords(profile)).filter(w => !aiWords.some(a => a.word === w.word))];
  const words = pool.filter((w) => (useStatic ? filter === "All" || w.level === filter : true) && [w.word, w.meaning_target, w.meaning_native, w.topic || ""].join(" ").toLowerCase().includes(search.toLowerCase()));
  const learned = saved.filter((v) => v.learned || v.stab >= 7).length;
  const due = saved.filter((v) => isDue(v, now));

  async function generate() {
    setBusy(true); setError(null);
    try {
      const avoid = [...saved.map((v) => v.word), ...aiWords.map((w) => w.word)];
      const r = await runPrompt(buildVocab({ profile, concepts: weak, count: 5, avoid, theme: theme.trim() }), { task: "vocab" });
      const list = r.data.words.filter((w) => w.word).map((w, i) => ({ ...w, pron: w.pronunciation, id: `${Date.now().toString(36)}${i}`, topic: theme.trim() || profile.goal, source: "ai" }));
      if (!list.length) throw new Error("The AI returned no words. Please try again.");
      act.saveDaily(key, [...aiWords, ...list]);
    } catch (e) { setError(e.offline ? new Error(`AI generation unavailable. Browse the built-in phrasebook below.`) : e); }
    setBusy(false);
  }

  const Card = ({ w }) => (
    <div className="vocabulary-card">
      <div className="vocabulary-card-top">
        {w.level && <span className={`vocabulary-level ${w.level.toLowerCase()}`}>{w.level}</span>}
        <span className="vocabulary-category">{w.topic || profile.goal}</span>
      </div>
      <SourceTag source={w.source || "builtin"} /><h3>{w.word} <SpeakButton text={w.word} lang={lang} /></h3>
      <span className="vocabulary-pronunciation">{w.pron} {w.pos && `· ${w.pos}`}</span>
      {w.meaning_native && <p className="vocabulary-meaning"><b>{profile.native}:</b> {w.meaning_native}</p>}
      <p className="vocabulary-meaning">{w.meaning_target}</p>
      <div className="vocabulary-example"><span>EXAMPLE</span><p>"{w.example}"</p>{w.example_translation && <p className="bubble-sub">{w.example_translation}</p>}</div>
      <div className="vocabulary-card-actions">
        <button className="vocabulary-detail-button" onClick={() => setSelected(w)}>View Details</button>
        <button className={`vocabulary-learn-button ${isSaved(w) ? "learned" : ""}`} disabled={isSaved(w)} onClick={() => act.addVocab(w)}>{isSaved(w) ? "✓ Saved" : "+ Save word"}</button>
        {!isSaved(w) && <button className="vocabulary-detail-button" title="Save as difficult: revised sooner" onClick={() => act.addVocab(w, { difficult: true })}>⚑ Difficult</button>}
      </div>
    </div>
  );

  return (
    <div className="vocabulary-page">
      <section className="vocabulary-header">
        <div>
          <span className="vocabulary-eyebrow">WORD POWER</span>
          <h1>Build your {lang} vocabulary ✨</h1>
          <p>Meaning, pronunciation, examples and usage. Save words and the forgetting model schedules their revision.</p>
        </div>
        <div className="vocabulary-progress-card">
          <div className="vocab-progress-icon">📚</div>
          <span>WORDS LEARNED</span>
          <h2>{learned} / {saved.length}</h2>
          <div className="vocab-progress-track"><div className="vocab-progress-fill" style={{ width: `${saved.length ? (learned / saved.length) * 100 : 0}%` }} /></div>
          <small>{due.length ? `${due.length} due for revision` : "Nothing due right now"}</small>
        </div>
      </section>

      <div className="seg left">
        <button className={tab === "discover" ? "on" : ""} onClick={() => setTab("discover")}>Discover</button>
        <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>My words ({saved.length})</button>
      </div>

      {tab === "discover" && (
        <>
          {!useStatic && (
            <div className="card vocab-gen">
              <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Optional theme: travel, food, work…" />
              <button className="primary-btn" onClick={generate} disabled={busy || !ai.configured}>{busy ? "Generating…" : aiWords.length ? "5 more words" : "Generate today's words"}</button>
              {!ai.configured && <span className="muted-note">Built-in phrases are available below. Connect AI for more words.</span>}
            </div>
          )}
          <ErrorNote error={error} onRetry={generate} />
          {busy && <Loading label="Choosing words for your level and goal…" />}
          <div className="vocab-source">{useStatic ? <SourceTag source="builtin" /> : aiWords.length > 0 && <SourceTag source="ai" meta={{ model: ai.model }} />}</div>
          <div className="vocabulary-search"><span>⌕</span><input type="text" placeholder="Search words or meanings..." value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button onClick={() => setSearch("")}>✕</button>}</div>
          {useStatic && <div className="vocabulary-filters">{levelFilters.map((f) => <button key={f} className={`vocabulary-filter ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}</div>}
          <div className="vocabulary-grid">{words.map((w) => <Card key={w.id} w={w} />)}</div>
          {!words.length && !busy && (useStatic || aiWords.length ? <div className="vocabulary-empty"><span>🔎</span><h3>No words found</h3><p>Try a different search or filter.</p></div> : <Empty icon="Aa" title="No words yet today" text={`Generate a fresh set of ${lang} words matched to your ${profile.level.toLowerCase()} level and ${profile.goal.toLowerCase()} goal.`} />)}
        </>
      )}

      {tab === "mine" && (
        <>
          <div className="row-gap"><button className="primary-btn" disabled={!due.length} onClick={() => go("revision")}>Revise due words ({due.length})</button></div>
          {!saved.length ? <Empty icon="📚" title="No saved words yet" text="Save words from Discover. Mark hard ones with ⚑ and they come back sooner." /> : (
            <div className="my-words">
              {[...saved].sort((a, b) => retention(a, now) - retention(b, now)).map((v) => {
                const r = Math.round(retention(v, now) * 100);
                return (
                  <div key={v.id} className="my-word">
                    <div className="mw-main"><h4>{v.word} <SpeakButton text={v.word} lang={lang} />{v.demo && <span className="demo-badge">demo</span>}{v.difficult && <span className="diff-flag">⚑ difficult</span>}</h4><p>{v.meaning_native || v.meaning_target}</p></div>
                    <div className="mw-ret"><div className="ret-bar"><div style={{ width: `${r}%` }} className={r < 50 ? "low" : r < 80 ? "mid" : ""} /></div><small>{r}% recall · {humanDue(v, now)}</small></div>
                    <div className="mw-actions">
                      <button onClick={() => act.toggleDifficult(v.id)} title="Toggle difficult">⚑</button>
                      <button onClick={() => act.toggleLearned(v.id)} title="Mark learned">{v.learned ? "✓" : "○"}</button>
                      <button onClick={() => act.removeVocab(v.id)} title="Remove">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="vocabulary-modal-overlay" onClick={() => setSelected(null)}>
          <div className="vocabulary-modal" onClick={(e) => e.stopPropagation()}>
            <button className="vocabulary-modal-close" onClick={() => setSelected(null)}>✕</button>
            <h2>{selected.word} <SpeakButton text={selected.word} lang={lang} /></h2>
            <span className="vocabulary-pronunciation">{selected.pron} {selected.pos && `· ${selected.pos}`}</span>
            <h4>Meaning</h4>
            {selected.meaning_native && <p>{profile.native}: {selected.meaning_native}</p>}
            <p>{selected.meaning_target}</p>
            <h4>Example sentence</h4>
            <div className="vocabulary-modal-example">"{selected.example}"{selected.example_translation && <div className="bubble-sub">{selected.example_translation}</div>}</div>
            {selected.synonyms?.length > 0 && <><h4>Synonyms</h4><p>{selected.synonyms.join(", ")}</p></>}
            {selected.usage_note && <><h4>Usage</h4><p>{selected.usage_note}</p></>}
            <button className="vocabulary-learn-button learned" disabled={isSaved(selected)} onClick={() => { act.addVocab(selected); setSelected(null); }}>{isSaved(selected) ? "✓ Already saved" : "+ Save word"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
