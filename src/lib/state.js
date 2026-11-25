// Pure application state + updaters (React-free so it is unit-testable). The store provider wraps these.
import { DEFAULT_PROFILE } from "./languages.js";
import { DAY, CONCEPTS, catOf, deriveFromEvents, normConcept, reviewItem, correctOffline } from "./engine.js";
import { STATIC_WORDS, practiceFor } from "./bank.js";

export const KEY = "lingua-ai:v2";
export const initialState = () => ({ v: 2, profile: { ...DEFAULT_PROFILE }, clock: 0, events: [], mistakes: [], vocab: [], quizzes: [], sims: [], chats: {}, daily: {}, translations: [], simLevels: {} });

export const nowOf = (s) => Date.now() + s.clock * DAY;
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const derive = (s) => deriveFromEvents(s.events);

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.v === 2) return clearDemo({ ...initialState(), ...raw, clock: 0, profile: { ...DEFAULT_PROFILE, ...raw.profile } });
  } catch { /* corrupt or unavailable storage: start fresh */ }
  return initialState();
}
export const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } };

const cap = (arr, n) => (arr.length > n ? arr.slice(arr.length - n) : arr);

export function setProfile(s, patch) {
  let p = { ...s.profile, ...patch };
  if (p.native === p.target) p = patch.target ? { ...p, native: p.native === "English" ? "Hindi" : "English" } : { ...p, target: p.target === "English" ? "Hindi" : "English" };
  return { ...s, profile: p };
}

// A learner turn (chat message, corrector run, simulator turn). Mistakes become memory + events.
export function logTurn(s, { mistakes = [], attempt = true, source, fluency, ts, demo }) {
  const t = ts ?? nowOf(s);
  const lang = s.profile.target;
  const ms = mistakes.map((m) => ({ id: uid(), ts: t, lang, native: s.profile.native, source, original: m.original, corrected: m.corrected, reason: m.reason || "", concept: normConcept(m.concept), interference: m.interference || null, context: m.context || "", reviewed: false, ...(demo ? { demo: true } : {}) }));
  const events = [];
  if (attempt) {
    for (const cat of ["grammar", "construction", "vocabulary"]) {
      const hits = ms.filter((m) => catOf(m.concept) === cat || (cat === "grammar" && catOf(m.concept) === "fluency"));
      if (hits.length) hits.forEach((m) => events.push({ ts: t, lang, concept: m.concept, cat: catOf(m.concept) === "fluency" ? "grammar" : cat, ok: false, kind: "attempt", source, ...(demo ? { demo: true } : {}) }));
      else events.push({ ts: t, lang, concept: null, cat, ok: true, kind: "attempt", source, ...(demo ? { demo: true } : {}) });
    }
    if (typeof fluency === "number" && (fluency <= 2 || fluency >= 4)) events.push({ ts: t, lang, concept: null, cat: "fluency", ok: fluency >= 4, kind: "attempt", source, ...(demo ? { demo: true } : {}) });
  }
  return { ...s, mistakes: cap([...s.mistakes, ...ms], 400), events: cap([...s.events, ...events], 800) };
}

// One exercise answer (quiz question, drill item, practice box). Wrong answers also enter the mistake log.
export function logExercise(s, { concept, ok, kind = "attempt", source, given, correct, reason, context, ts, demo }) {
  const t = ts ?? nowOf(s);
  const c = normConcept(concept);
  const lang = s.profile.target;
  const ev = { ts: t, lang, concept: c, cat: catOf(c), ok, kind, source, ...(demo ? { demo: true } : {}) };
  const mistakes = ok ? s.mistakes : cap([...s.mistakes, { id: uid(), ts: t, lang, native: s.profile.native, source, original: given || "(no answer)", corrected: correct || "", reason: reason || "", concept: c, interference: null, context: context || "", reviewed: false, ...(demo ? { demo: true } : {}) }], 400);
  return { ...s, mistakes, events: cap([...s.events, ev], 800) };
}

export const toggleReviewed = (s, id) => ({ ...s, mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, reviewed: !m.reviewed } : m)) });

export function addVocab(s, w, { difficult = false } = {}) {
  const lang = s.profile.target;
  if (s.vocab.some((v) => v.lang === lang && v.word.toLowerCase() === w.word.toLowerCase())) return s;
  const t = nowOf(s);
  return { ...s, vocab: [...s.vocab, { ...w, id: w.id || uid(), lang, native: s.profile.native, difficult, stab: difficult ? 0.6 : 1.5, last: t, reps: 0, lapses: 0, added: t, learned: false }] };
}
export const removeVocab = (s, id) => ({ ...s, vocab: s.vocab.filter((v) => v.id !== id) });
export const gradeVocab = (s, id, grade) => ({ ...s, vocab: s.vocab.map((v) => (v.id === id ? reviewItem(v, grade, nowOf(s)) : v)) });
export const toggleLearned = (s, id) => ({ ...s, vocab: s.vocab.map((v) => (v.id === id ? (v.learned ? { ...v, learned: false } : { ...v, learned: true, stab: Math.max(v.stab, 14), last: nowOf(s) }) : v)) });
export const toggleDifficult = (s, id) => ({ ...s, vocab: s.vocab.map((v) => (v.id === id ? { ...v, difficult: !v.difficult } : v)) });

export const addQuiz = (s, q) => ({ ...s, quizzes: cap([...s.quizzes, { ...q, ts: nowOf(s), lang: s.profile.target }], 60) });
export const addSim = (s, q) => ({ ...s, sims: cap([...s.sims, { ...q, ts: nowOf(s), lang: s.profile.target }], 40) });
export const setSimLevel = (s, lang, n) => ({ ...s, simLevels: { ...s.simLevels, [lang]: n } });
export const setChat = (s, lang, msgs) => ({ ...s, chats: { ...s.chats, [lang]: cap(msgs, 40) } });
export const saveDaily = (s, key, words) => ({ ...s, daily: { ...s.daily, [key]: words } });
export const addTranslation = (s, t) => ({ ...s, translations: cap([{ ...t, ts: nowOf(s) }, ...s.translations], 12) });

// ---- activity ----
const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);
export function activeDays(s) {
  const set = new Set();
  s.events.forEach((e) => set.add(dayKey(e.ts)));
  s.quizzes.forEach((q) => set.add(dayKey(q.ts)));
  s.sims.forEach((q) => set.add(dayKey(q.ts)));
  s.vocab.forEach((v) => v.reps && set.add(dayKey(v.last)));
  return set;
}
export function weekProgress(s) {
  const days = activeDays(s);
  const now = nowOf(s);
  let n = 0;
  for (let i = 0; i < 7; i++) if (days.has(dayKey(now - i * DAY))) n++;
  let streak = 0;
  for (let i = 0; i < 365; i++) { if (days.has(dayKey(now - i * DAY))) streak++; else if (i > 0) break; }
  return { week: n, streak };
}

 // Remove legacy sample records during migration.
export const clearDemo = (s) => ({ ...s, events: s.events.filter((e) => !e.demo), mistakes: s.mistakes.filter((m) => !m.demo), vocab: s.vocab.filter((v) => !v.demo), quizzes: s.quizzes.filter((q) => !q.demo), sims: s.sims.filter((q) => !q.demo) });
export const CONCEPT_IDS = Object.keys(CONCEPTS);
