// Browser-side AI client. Talks only to our own /api proxy (keys stay on the server).
import { validate } from "./prompts.js";
import { normConcept } from "./engine.js";

export async function fetchStatus() {
  try {
    const r = await fetch("/api/status");
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { configured: false, provider: null, model: null };
  }
}

export class AIError extends Error {
  constructor(message, offline = false) { super(message); this.offline = offline; }
}

export async function ask({ system = "", user, json = true, maxTokens = 1200, temperature = 0.4 }) {
  let r;
  try {
    r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system, user, json, maxTokens, temperature }) });
  } catch {
    throw new AIError("Could not reach the local AI server. Is the app running with `npm run dev`?", true);
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 503) throw new AIError(data.error || "AI is not configured.", true);
  if (!r.ok) throw new AIError(data.error || `AI request failed (${r.status})`, true);
  return data; // { text, provider, model }
}

export function extractJson(text) {
  if (!text) return null;
  const t = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch { /* ignore */ } }
  return null;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+n) ? +n : (lo + hi) / 2));
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

export function normalizeExercise(e, i = 0) {
  if (!e || typeof e !== "object" || !e.prompt || e.answer == null) return null;
  const x = { ...e, id: `${Date.now().toString(36)}-${i}`, concept: normConcept(e.concept), answer: String(e.answer), prompt: String(e.prompt), explanation: String(e.explanation || "") };
  let type = ["mcq", "fill", "translate", "order"].includes(x.type) ? x.type : Array.isArray(x.options) && x.options.length > 1 ? "mcq" : Array.isArray(x.words) && x.words.length > 1 ? "order" : String(x.prompt).includes("___") ? "fill" : "translate";
  if (type === "mcq") {
    const opts = [...new Set((Array.isArray(x.options) ? x.options : []).map(String))];
    if (/^[A-D]$/i.test(x.answer.trim()) && opts[x.answer.trim().toUpperCase().charCodeAt(0) - 65]) x.answer = opts[x.answer.trim().toUpperCase().charCodeAt(0) - 65];
    else if (/^\d$/.test(x.answer.trim()) && opts[+x.answer]) x.answer = opts[+x.answer];
    const hit = opts.find((o) => o.toLowerCase() === x.answer.toLowerCase());
    if (hit) x.answer = hit; else opts.push(x.answer);
    if (opts.length < 2) return null;
    x.options = shuffle([x.answer, ...opts.filter(o => o !== x.answer).slice(0, 4)]);
  }
  if (type === "order") x.words = Array.isArray(x.words) && x.words.length > 1 ? x.words.map(String) : shuffle(x.answer.split(/\s+/));
  x.type = type;
  x.accept = Array.isArray(x.accept) ? x.accept.map(String) : [];
  return x;
}

// Post-processing = response validation layer: repairs what can be repaired, drops what cannot.
export function sanitize(task, d) {
  const meta = { dropped: 0 };
  const items = (list) => (Array.isArray(list) ? list : []).filter((c) => {
    const ok = c && typeof c.original === "string" && typeof c.corrected === "string" && c.original.trim() && c.original.trim() !== c.corrected.trim();
    if (!ok) meta.dropped++;
    return ok;
  }).map((c) => ({ ...c, concept: normConcept(c.concept), reason: String(c.reason || ""), interference: { is_transfer: !!c.interference?.is_transfer, pattern: c.interference?.pattern || "", explanation: c.interference?.explanation || "", confidence: c.interference?.confidence || "" } }));
  if (["correct", "chat", "sim"].includes(task)) {
    d.corrections = items(d.corrections);
    if (task === "correct") d.has_errors = d.corrections.length > 0;
    for (const k of ["feedback", "scores"]) if (d[k]) for (const m of Object.keys(d[k])) d[k][m] = clamp(d[k][m], 0, 5);
    if (d.fluency != null) d.fluency = clamp(d.fluency, 0, 5);
  }
  if (task === "quiz") d.questions = (Array.isArray(d.questions) ? d.questions : []).map(normalizeExercise).filter((x) => x || (meta.dropped++, false));
  if (task === "revision") d.exercises = (Array.isArray(d.exercises) ? d.exercises : []).map(normalizeExercise).filter((x) => x || (meta.dropped++, false));
  if (task === "sim_summary") d.next_difficulty = Math.round(clamp(d.next_difficulty, 1, 5));
  d._meta = meta;
  return d;
}

const STRICT = new Set(["chat", "sim", "sim_summary", "translate", "vocab", "grade", "audit"]);
const TOKENS = { correct: 1200, chat: 900, sim: 900, vocab: 1800, quiz: 2200, revision: 2000, translate: 900, grade: 300, audit: 500, sim_summary: 500, lab: 1500, structured: 600 };

// Runs a built prompt: call -> parse -> sanitize -> validate -> (one repair attempt) -> result with metadata.
export async function runPrompt(built, { temperature = 0.4, task } = {}) {
  const t = task || built.task;
  const maxTokens = TOKENS[t] || 1200;
  let res = await ask({ system: built.system, user: built.user, json: !!built.spec, maxTokens, temperature });
  let data = built.spec ? extractJson(res.text) : res.text;
  let attempts = 1;
  const check = (d) => {
    if (!built.spec) return [];
    if (!d || typeof d !== "object" || Array.isArray(d)) return ["Reply was not valid JSON"];
    const clean = sanitize(t, d);
    return validate(clean, built.spec);
  };
  let issues = check(data);
  if (built.spec && issues.length) {
    attempts = 2;
    res = await ask({ system: built.system, user: `${built.user}\n\nYour previous reply failed validation: ${issues.slice(0, 5).join("; ")}. Reply again with ONLY the corrected JSON.`, json: true, maxTokens, temperature: 0.1 });
    data = extractJson(res.text);
    issues = check(data);
  }
  if (built.spec && !data) throw new AIError("The AI reply could not be read. Please try again.");
  if (issues.length && STRICT.has(t)) throw new AIError("The AI reply was incomplete. Please try again.");
  return { data, raw: res.text, issues, valid: issues.length === 0, attempts, provider: res.provider, model: res.model, source: "ai" };
}
