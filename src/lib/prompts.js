// Reusable prompt templates + the layered "evolving" tutor prompt.
// Each prompt = layers (role, learner, memory, transfer, strategy, few-shot, format, self-check, guard).
import { CONCEPTS, STRATEGIES, transferNote } from "./engine.js";
import { styleInstruction } from "./languages.js";

const IDS = Object.keys(CONCEPTS).join("|");

// ---- tiny schema language: "string", "number", "boolean", [item], {enum:[..]}, nested objects, "key?" = optional.
export function specToText(spec) {
  const t = (s) => {
    if (typeof s === "string") {
      const [base, ...d] = s.split(":");
      const desc = d.join(":").trim();
      if (base === "string") return JSON.stringify(desc || "string");
      return desc ? `${base} /* ${desc} */` : base;
    }
    if (Array.isArray(s)) return `[${t(s[0])}, ...]`;
    if (s && s.enum) return JSON.stringify(s.enum.join("|"));
    return `{${Object.entries(s).map(([k, v]) => `"${k.replace("?", "")}":${t(v)}`).join(",")}}`;
  };
  return t(spec);
}
export function validate(data, spec, path = "$") {
  const issues = [];
  const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
  if (typeof spec === "string") {
    const want = spec.split(":")[0].trim();
    if (typeOf(data) !== want) issues.push(`${path}: expected ${want}, got ${typeOf(data)}`);
  } else if (Array.isArray(spec)) {
    if (!Array.isArray(data)) issues.push(`${path}: expected array`);
    else data.forEach((d, i) => issues.push(...validate(d, spec[0], `${path}[${i}]`)));
  } else if (spec.enum) {
    if (!spec.enum.includes(data)) issues.push(`${path}: must be one of ${spec.enum.join("|")}`);
  } else if (typeOf(data) !== "object") {
    issues.push(`${path}: expected object`);
  } else {
    for (const [k, v] of Object.entries(spec)) {
      const opt = k.endsWith("?");
      const key = opt ? k.slice(0, -1) : k;
      if (data[key] === undefined || data[key] === null) { if (!opt) issues.push(`${path}.${key}: missing`); }
      else issues.push(...validate(data[key], v, `${path}.${key}`));
    }
  }
  return issues;
}

// ---- output schemas (single source of truth: used in the prompt text AND to validate the reply) ----
const INTERFERENCE = { is_transfer: "boolean", "pattern?": "string: short label, empty if none", "explanation?": "string: 1-2 sentences comparing the native and target language, empty if none" };
const ITEM = { original: "string", corrected: "string", reason: "string: max 40 words", concept: { enum: Object.keys(CONCEPTS) }, interference: INTERFERENCE, "practice?": { prompt: "string: new fill-in-the-blank sentence using ___", answer: "string" } };
const EX = { type: { enum: ["mcq", "fill", "translate", "order"] }, prompt: "string", "options?": ["string"], "words?": ["string"], answer: "string", "accept?": ["string"], "hint?": "string", explanation: "string", concept: { enum: Object.keys(CONCEPTS) } };

export const SPECS = {
  correct: { has_errors: "boolean", corrections: [ITEM], natural_version: "string", feedback: { fluency: "number: 0-5", grammar: "number: 0-5", vocabulary: "number: 0-5" } },
  chat: { reply: "string", "say?": "string: one target-language sentence worth repeating aloud, or empty", "say_phonetic?": "string", "attempt?": "boolean: true only if the learner message is their own attempt to write the target language", corrections: [{ ...ITEM, "practice?": { prompt: "string", answer: "string" } }], "fluency?": "number: 0-5" },
  sim: { partner_reply: "string", "partner_reply_translation?": "string", corrections: [ITEM], scores: { fluency: "number: 0-5", grammar: "number: 0-5", vocabulary: "number: 0-5" }, "hint?": "string: a useful phrase for the learner's next turn" },
  sim_summary: { overall: "string", strengths: ["string"], focus: ["string"], next_difficulty: "number: 1-5" },
  vocab: { words: [{ word: "string", pronunciation: "string: phonetic respelling in Latin letters", pos: "string", meaning_native: "string", meaning_target: "string", example: "string", example_translation: "string", synonyms: ["string"], usage_note: "string" }] },
  quiz: { title: "string", questions: [EX] },
  revision: { intro: "string: 2 sentences", contrast: "string: native-vs-target comparison, empty if not useful", exercises: [EX] },
  translate: { translation: "string", pronunciation: "string: phonetic respelling of the translation in Latin letters", literal_gloss: "string: word-by-word gloss for comparison", context_note: "string", alternatives: [{ text: "string", register: "string" }], key_words: [{ word: "string", meaning: "string", pronunciation: "string" }] },
  grade: { correct: "boolean", corrected: "string", reason: "string" },
  audit: { verdict: { enum: ["ok", "revise"] }, issues: ["string"], "revised?": "string: improved corrected sentence if verdict is revise" },
  structured: { error_span: "string", error_type: "string", rule: "string: max 25 words", evidence: "string: quote from learner text", corrected: "string", confidence: "number: 0-1" },
};

const SHOTS = {
  correct: `Example\nInput: "Where you are going?"\nOutput: {"has_errors":true,"corrections":[{"original":"Where you are going?","corrected":"Where are you going?","reason":"English moves the helper verb before the subject in questions.","concept":"questions","interference":{"is_transfer":true,"pattern":"Question word without inversion","explanation":"In many Indian languages the question word stays in place and no helper verb moves."},"practice":{"prompt":"Why ___ late?","answer":"are you"}}],"natural_version":"Where are you going?","feedback":{"fluency":3,"grammar":2,"vocabulary":4}}`,
  chat: `Example\nLearner: "I am having a doubt"\nOutput: {"reply":"Nice try! Say 'I have a question' when you want to ask something. What is your question?","say":"I have a question.","say_phonetic":"ai hav a kwes-chun","attempt":true,"corrections":[{"original":"I am having a doubt","corrected":"I have a question","reason":"'Doubt' means unsure; 'question' is what you ask.","concept":"word_choice","interference":{"is_transfer":true,"pattern":"Literal word transfer","explanation":"The native word for 'doubt' is also used for questions."}}],"fluency":3}`,
  quiz: `Example question: {"type":"fill","prompt":"She ___ to college every day.","answer":"goes","hint":"he/she/it","explanation":"Add -es after he/she/it.","concept":"agreement"}`,
};

const art = (w) => (/^[AEIOU]/i.test(w) ? "an" : "a");
const strat = (lvl) => STRATEGIES[Math.min(4, Math.max(0, lvl))];

// ---- Layered system prompt ----
// concepts: [{concept, wrong, right, level}] for the active target language (most important first).
export function buildLayers({ profile: p, concepts = [], task = "correct", forceStrategy, forceConcept }) {
  const top = concepts.slice(0, 3);
  const hasMem = top.length > 0;
  const transfers = top.map((c) => transferNote(p.native, p.target, c.concept)).filter(Boolean);
  const adapted = top.filter((c) => c.level > 0);
  const spec = SPECS[task];
  const layers = [
    { id: "role", label: "Role", technique: "Role prompting", on: true, text: `You are Lingua, ${art(p.target)} ${p.target} tutor for ${p.native} speakers. You teach by finding why a mistake happens, not only what is wrong.`, why: "Fixed persona and goal." },
    { id: "learner", label: "Learner profile", technique: "Context prompting", on: true, text: `Learner: native ${p.native}; level ${p.level}; goal ${p.goal}. ${styleInstruction(p)}`, why: "Built from the saved profile (language pair, level, goal, explanation style)." },
    { id: "memory", label: "Mistake memory", technique: "Memory injection", on: hasMem, text: `Recurring difficulties (most important first): ${top.map((c) => `${CONCEPTS[c.concept].label} (${c.wrong} errors, ${c.right} correct since)`).join("; ")}.`, why: hasMem ? "Added because your log contains repeated errors." : "Inactive: no mistakes recorded yet for this language." },
    { id: "transfer", label: "Language interference", technique: "Contrastive hints", on: hasMem && p.target !== p.native, text: transfers.length ? `Known ${p.native}→${p.target} transfer risks: ${transfers.join(" ")}` : `Where ${p.native} and ${p.target} differ for these concepts, name the likely transfer from ${p.native}; if there is no clear link, say it is a general learner error.`, why: hasMem ? `Links recurring errors to ${p.native} structure.` : "Inactive until mistakes exist." },
    { id: "strategy", label: "Teaching strategy", technique: "Adaptive instruction", on: true, text: (forceStrategy != null ? [{ concept: forceConcept || "the selected concept", level: forceStrategy }] : adapted.length ? adapted.map((c) => ({ concept: CONCEPTS[c.concept].label, level: c.level })) : []).map((c) => `For ${c.concept}: ${strat(c.level).name}. ${strat(c.level).directive}`).join("\n") || `Default teaching strategy: ${STRATEGIES[0].name}. ${STRATEGIES[0].directive}`, why: adapted.length || forceStrategy != null ? "Escalated because recent answers on these concepts were incorrect." : "Default level: no repeated errors yet." },
    { id: "fewshot", label: "Few-shot example", technique: "Few-shot prompting", on: !!SHOTS[task], text: SHOTS[task] || "", why: "One compact worked example fixes tone and structure." },
    { id: "format", label: "Output format", technique: "Output-format control", on: !!spec, text: spec ? `Reply with ONLY valid JSON, no markdown, matching: ${specToText(spec)}\nUse concept ids from: ${IDS}.` : "", why: "Strict JSON schema; the reply is validated in code." },
    { id: "selfcheck", label: "Self-check", technique: "Self-evaluation", on: true, text: `Before replying, silently check: corrected text is correct ${p.target}; the reason is accurate; fields follow the schema. Never show your checking or step-by-step reasoning.`, why: "Asks the model to verify itself without exposing hidden reasoning." },
    { id: "guard", label: "Guardrails", technique: "Constraints", on: true, text: `Be concise. Judge only the text provided; do not guess the learner's feelings or abilities beyond it. If unsure about a correction, say so in 'reason'.`, why: "Keeps output short and evidence-based." },
  ];
  return layers;
}
export const compose = (layers) => layers.filter((l) => l.on && l.text).map((l) => l.text).join("\n");

const histText = (h) => h.slice(-6).map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.text}`).join("\n");
const out = (task, p, concepts, user, layersOverride) => {
  const layers = layersOverride || buildLayers({ profile: p, concepts, task });
  return { task, system: compose(layers), user, spec: SPECS[task], layers };
};

export const buildCorrect = ({ profile, concepts, text }) => out("correct", profile, concepts, `Learner text: "${text}"\nFind every error in the ${profile.target}. If there are none, set has_errors=false and corrections=[]. Give a natural version of the whole text.`);
export const buildChat = ({ profile, concepts, history, message }) => out("chat", profile, concepts, `${histText(history)}\nLearner: ${message}\nReply as the tutor (max 80 words). If the learner wrote ${profile.target}, correct mistakes; if they asked a question, answer it at ${profile.level} level and set attempt=false.`);
export const buildSim = ({ profile, concepts, scenario, difficulty, history, message, start }) => {
  const layers = buildLayers({ profile, concepts, task: "sim" }).map((l) => (l.id === "role" ? { ...l, text: `You are playing a character in a ${profile.target} role-play (${scenario.title}: ${scenario.brief}) with a ${profile.native}-speaking learner. Stay in character; speak ${profile.target}. Difficulty ${difficulty}/5: ${["very short simple sentences, common words", "short sentences, everyday words", "natural speed, some idioms", "longer sentences, follow-up questions, some idioms", "native-like speech, nuance and pushback"][difficulty - 1]}.` } : l));
  const user = start ? `Open the scene with one short line in character. corrections=[], scores all 3.` : `${histText(history)}\nLearner: ${message}\nRespond in character in 1-3 sentences, then correct the learner's last message and score it.`;
  return out("sim", profile, concepts, user, layers);
};
export const buildSimSummary = ({ profile, concepts, scenario, turns, avg }) => out("sim_summary", profile, concepts, `Role-play "${scenario.title}" finished. Average scores (0-5): fluency ${avg.fluency}, grammar ${avg.grammar}, vocabulary ${avg.vocabulary}. Learner lines:\n${turns.map((t) => `- ${t}`).join("\n")}\nGive an overall comment (2 sentences), 2 strengths, 2 focus points and a suggested next difficulty.`);
export const buildVocab = ({ profile, concepts, count = 5, avoid = [], theme }) => out("vocab", profile, concepts, `Give ${count} useful ${profile.target} words for a ${profile.level} learner with goal "${profile.goal}"${theme ? ` on the theme "${theme}"` : ""}. Meanings in ${profile.native} (meaning_native) and simple ${profile.target} (meaning_target). Pronunciation as phonetic respelling in Latin letters. Do not repeat: ${avoid.slice(0, 40).join(", ") || "none"}.`);
export const buildQuiz = ({ profile, concepts, count = 6 }) => {
  const weak = concepts.slice(0, 3).map((c) => c.concept);
  return out("quiz", profile, concepts, `Create a ${count}-question ${profile.target} quiz for a ${profile.level} learner (goal: ${profile.goal}). Mix types: mcq (answer must equal one option), fill (blank is ___), translate (prompt in ${profile.native}, answer in ${profile.target}, give accept[] variants), order (words[] shuffled, answer is the full sentence). ${weak.length ? `At least half of the questions must target: ${weak.join(", ")}.` : "Cover varied concepts."} Each explanation max 25 words.`);
};
export const buildRevision = ({ profile, concept, level, recent = [], count = 4, concepts = [] }) => {
  const layers = buildLayers({ profile, concepts, task: "revision", forceStrategy: level, forceConcept: CONCEPTS[concept].label });
  const user = `Create a ${count}-exercise revision drill on "${CONCEPTS[concept].label}" (concept id ${concept}) using strategy level ${level}: ${strat(level).name}. ${recent.length ? `The learner's own recent errors:\n${recent.slice(0, 4).map((m) => `- "${m.original}" → "${m.corrected}"`).join("\n")}\nReuse their situations, not their exact sentences.` : ""} All exercises must have concept="${concept}".`;
  return out("revision", profile, concepts, user, layers);
};
export const buildTranslate = ({ profile, from, to, text, context }) => {
  const layers = buildLayers({ profile, concepts: [], task: "translate" }).filter((l) => ["role", "learner", "format", "selfcheck", "guard"].includes(l.id));
  return out("translate", profile, [], `Translate from ${from} to ${to}: "${text}"\nContext: ${context || "neutral"}. Translate meaning and tone, not word-for-word. Give the pronunciation of the ${to} text in Latin letters. Add 1-3 alternatives with register, and up to 4 key words.`, layers);
};
export const buildGrade = ({ profile, prompt, expected, given }) => out("grade", profile, [], `Exercise: ${prompt}\nReference answer: ${expected}\nLearner answer: ${given}\nIs the learner answer acceptable ${profile.target}, even if worded differently? Return correct, the best corrected answer and a one-sentence reason.`, buildLayers({ profile, concepts: [], task: "grade" }).filter((l) => ["role", "format", "guard"].includes(l.id)));
export const buildAudit = ({ profile, text, proposed }) => out("audit", profile, [], `Audit this correction. Learner text: "${text}"\nProposed correction JSON: ${JSON.stringify(proposed)}\nCheck: is every flagged error real, is anything missed, is the corrected text correct ${profile.target}, does the reason match the concept? verdict "ok" or "revise" (then give revised text).`, buildLayers({ profile, concepts: [], task: "audit" }).filter((l) => ["role", "format", "selfcheck", "guard"].includes(l.id)));

// ---- Prompt Lab: technique templates over the same task so the effect of each technique is visible ----
export const LAB_TYPES = [
  { id: "role", name: "Role prompting", sample: "I am having a doubt in this chapter.", blurb: "Only a persona and task. Shows how little control a role alone gives over structure.", layers: ["role"], mode: "text" },
  { id: "context", name: "Learner-profile & context", sample: "Where you are going?", blurb: "Adds the saved profile, mistake memory and language-interference hints.", layers: ["role", "learner", "memory", "transfer"], mode: "text" },
  { id: "fewshot", name: "Few-shot prompting", sample: "She go to college every day.", blurb: "Role plus one worked example to fix the response style.", layers: ["role", "fewshot"], mode: "text" },
  { id: "structured", name: "Structured reasoning (no hidden CoT)", sample: "I went to market yesterday.", blurb: "Asks for a brief justification in fixed fields (span, rule, evidence), never step-by-step reasoning.", layers: ["role", "learner", "guard"], mode: "json", spec: "structured" },
  { id: "format", name: "Output-format control", sample: "I am student. He don't like tea.", blurb: "Strict JSON schema that the app validates before using it.", layers: ["role", "learner", "format", "guard"], mode: "json", spec: "correct" },
  { id: "selfeval", name: "Self-evaluation & validation", sample: "Yesterday I go to market and buy informations.", blurb: "Two passes: generate a correction, then a second prompt audits it. Output is also schema-validated.", layers: ["role", "learner", "format", "selfcheck", "guard"], mode: "json", spec: "correct", audit: true },
  { id: "quiz", name: "Adaptive quiz generation", sample: "articles", blurb: "Quiz template biased toward your weakest concepts. Input = optional focus concept.", mode: "json", spec: "quiz", kind: "quiz" },
  { id: "revision", name: "Mistake-based revision", sample: "questions", blurb: "Revision drill using the teaching strategy level chosen from your recent answers. Input = concept id.", mode: "json", spec: "revision", kind: "revision" },
  { id: "evolved", name: "Full adaptive prompt (all layers)", sample: "What you want to eat?", blurb: "Everything combined: this is the prompt the tutor really sends.", layers: ["role", "learner", "memory", "transfer", "strategy", "fewshot", "format", "selfcheck", "guard"], mode: "json", spec: "correct" },
];

export function buildLab(type, { profile, concepts, input }) {
  if (type.kind === "quiz") {
    const focus = CONCEPTS[input.trim()] ? [{ concept: input.trim(), wrong: 1, right: 0, level: 1 }] : concepts;
    const b = buildQuiz({ profile, concepts: focus, count: 3 });
    return { ...b, spec: SPECS.quiz };
  }
  if (type.kind === "revision") {
    const c = CONCEPTS[input.trim()] ? input.trim() : concepts[0]?.concept || "articles";
    const lvl = concepts.find((x) => x.concept === c)?.level ?? 1;
    const b = buildRevision({ profile, concept: c, level: Math.max(1, lvl), count: 2, concepts });
    return { ...b, spec: SPECS.revision };
  }
  const base = buildLayers({ profile, concepts, task: "correct" });
  let layers = base.map((l) => ({ ...l, on: type.layers.includes(l.id) && l.on }));
  const spec = type.spec ? SPECS[type.spec] : null;
  if (type.id === "structured")
    layers = layers.map((l) => (l.id === "guard" ? { ...l, on: true, text: `${l.text}\nGive only a brief justification in the fields below. Do not reveal step-by-step reasoning. Reply with ONLY valid JSON matching: ${specToText(SPECS.structured)}` } : l));
  if (type.id === "fewshot") layers = layers.map((l) => (l.id === "fewshot" ? { ...l, on: true, text: `Reply in plain text as: Incorrect → Correct → Reason.\nExample\nInput: "Where you are going?"\nIncorrect: Where you are going?\nCorrect: Where are you going?\nReason: English puts the helper verb before the subject in questions.\n\nExample\nInput: "I am student."\nIncorrect: I am student.\nCorrect: I am a student.\nReason: singular countable nouns need a/an.` } : l));
  if (type.mode === "text" && type.id !== "fewshot") layers = layers.map((l) => (l.id === "role" ? { ...l, text: `${l.text} Correct the learner's sentence and briefly say why.` } : l));
  return { task: "lab", system: compose(layers), user: `Learner text: "${input}"`, spec, layers };
}

// Baseline used for "Compare with plain prompt"
export const plainPrompt = (input, p) => ({ system: "", user: `Correct this ${p.target} sentence: ${input}` });

export const approxTokens = (s) => Math.ceil((s || "").length / 4);
