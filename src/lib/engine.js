// Pure learning logic: concepts, interference rules, adaptive strategy, weakness map, forgetting model.
// No React / network here, so it also powers the offline fallback and can be unit-tested in Node.

export const DAY = 86400000;

export const CATEGORIES = {
  grammar: { label: "Grammar" },
  vocabulary: { label: "Vocabulary" },
  fluency: { label: "Fluency" },
  construction: { label: "Sentence construction" },
};

// Fixed concept taxonomy shared by every feature (AI output is constrained to these ids).
export const CONCEPTS = {
  articles: { label: "Articles", cat: "grammar" },
  tense: { label: "Tense & aspect", cat: "grammar" },
  agreement: { label: "Subject–verb agreement", cat: "grammar" },
  prepositions: { label: "Prepositions & postpositions", cat: "grammar" },
  verb_forms: { label: "Verb forms", cat: "grammar" },
  plurals: { label: "Plurals & countability", cat: "grammar" },
  pronouns: { label: "Pronouns & gender", cat: "grammar" },
  word_order: { label: "Word order", cat: "construction" },
  questions: { label: "Question formation", cat: "construction" },
  negation: { label: "Negation", cat: "construction" },
  linking: { label: "Clauses & linking", cat: "construction" },
  word_choice: { label: "Word choice", cat: "vocabulary" },
  collocation: { label: "Collocations & idioms", cat: "vocabulary" },
  spelling: { label: "Spelling & script", cat: "vocabulary" },
  naturalness: { label: "Naturalness", cat: "fluency" },
  register: { label: "Politeness & register", cat: "fluency" },
  pronunciation: { label: "Pronunciation", cat: "fluency" },
};
export const conceptLabel = (c) => CONCEPTS[c]?.label || c;
export const normConcept = (c) => (CONCEPTS[c] ? c : "naturalness");
export const catOf = (c) => CONCEPTS[normConcept(c)].cat;

// Adaptive teaching ladder. The level for a concept is derived only from observable answers.
export const STRATEGIES = [
  { id: 0, name: "Rule + examples", directive: "Give the rule in one sentence and two short examples." },
  { id: 1, name: "Native-language contrast", directive: "Contrast with the learner's native-language structure: show how it works there and why it causes this error." },
  { id: 2, name: "Minimal pairs & analogy", directive: "Use a minimal pair (wrong vs right, one element different) and one everyday analogy." },
  { id: 3, name: "Scaffolded practice", directive: "Scaffold: a hinted fill-in first, then a sentence with a blank, then a free sentence." },
  { id: 4, name: "Find the error yourself", directive: "Do not give the answer first: show a flawed sentence, ask the learner to find and fix the error, then reveal." },
];

export function levelFromRecent(recent) {
  const r = recent.slice(-5);
  if (!r.length) return 0;
  let lvl = Math.min(4, r.reduce((a, b) => a + b, 0));
  const tail = r.slice(-3);
  if (tail.length === 3 && tail.every((x) => x === 0)) lvl = Math.max(0, lvl - 1);
  return lvl;
}

const INIT_STAB = 1;
export const RETAIN_TARGET = 0.8;

// Replays the event log into per-concept statistics + the log of strategy changes (prompt evolution).
export function deriveFromEvents(events) {
  const concepts = {};
  const evolutions = [];
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  for (const e of sorted) {
    if (!e.concept) continue;
    const key = `${e.lang}:${e.concept}`;
    let c = concepts[key];
    if (!c) {
      if (e.ok) continue; // a concept is tracked once the learner has made an error in it
      c = concepts[key] = { key, lang: e.lang, concept: e.concept, cat: catOf(e.concept), wrong: 0, right: 0, recent: [], level: 0, stab: INIT_STAB, last: e.ts, reps: 0, lapses: 0, firstTs: e.ts };
    }
    const before = c.level;
    if (e.ok) {
      c.right++; c.reps++; c.recent.push(0);
      c.stab = Math.min(90, c.stab * (e.kind === "review" ? 2 : 1.5));
    } else {
      c.wrong++; c.lapses++; c.recent.push(1);
      c.stab = Math.max(0.3, c.stab * 0.6);
    }
    if (c.recent.length > 8) c.recent.shift();
    c.last = e.ts;
    c.level = levelFromRecent(c.recent);
    if (c.level !== before) {
      const r = c.recent.slice(-5);
      const trigger = c.level > before
        ? `${r.reduce((a, b) => a + b, 0)} of the last ${r.length} attempts on ${conceptLabel(c.concept)} were incorrect`
        : `the last 3 attempts on ${conceptLabel(c.concept)} were correct`;
      evolutions.push({ ts: e.ts, lang: e.lang, concept: c.concept, from: before, to: c.level, trigger, demo: !!e.demo });
    }
  }
  return { concepts, evolutions };
}

export function topWeaknesses(concepts, lang, k = 3) {
  return Object.values(concepts)
    .filter((c) => c.lang === lang && c.wrong > 0)
    .sort((a, b) => b.level - a.level || b.wrong - b.right * 0.5 - (a.wrong - a.right * 0.5) || b.last - a.last)
    .slice(0, k);
}

// Weakness map: recency-weighted accuracy per category (half-life 14 days), Laplace smoothed.
export function weaknessMap(events, lang, now) {
  const acc = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, { n: 0, w: 0, wrong: 0, right: 0 }]));
  for (const e of events) {
    if (e.lang !== lang || !acc[e.cat]) continue;
    const age = Math.max(0, now - e.ts) / DAY;
    const wt = Math.pow(0.5, age / 14);
    const a = acc[e.cat];
    a.n++; a.w += wt;
    if (e.ok) a.right += wt; else a.wrong += wt;
  }
  const out = {};
  for (const [k, a] of Object.entries(acc)) {
    out[k] = { n: a.n, strength: a.n ? Math.round((100 * (a.right + 1)) / (a.w + 2)) : null };
  }
  return out;
}

// ---- Forgetting predictor (Ebbinghaus-style decay: R = exp(-t / S)) ----
export const retention = (it, now) => Math.exp(-Math.max(0, now - it.last) / DAY / it.stab);
export const dueTs = (it) => it.last + it.stab * Math.log(1 / RETAIN_TARGET) * DAY;
export const isDue = (it, now) => now >= dueTs(it);
const GRADE = { again: 0.35, hard: 1.3, good: 2.2, easy: 3.5 };
export function reviewItem(it, grade, now) {
  const stab = Math.min(120, Math.max(0.3, it.stab * GRADE[grade]));
  return { ...it, stab, last: now, reps: it.reps + (grade === "again" ? 0 : 1), lapses: it.lapses + (grade === "again" ? 1 : 0) };
}
export function forecast(items, now, days = 14) {
  return Array.from({ length: days + 1 }, (_, d) => {
    const t = now + d * DAY;
    const avg = items.length ? items.reduce((s, it) => s + retention(it, t), 0) / items.length : null;
    return { day: d, avg };
  });
}
export function humanDue(it, now) {
  const ms = dueTs(it) - now;
  if (ms <= 0) return "due now";
  const h = ms / 3600000;
  if (h < 1) return "in <1 h";
  if (h < 36) return `in ${Math.round(h)} h`;
  return `in ${Math.round(h / 24)} d`;
}

export function interferenceStats(mistakes, lang) {
  const list = mistakes.filter((m) => m.lang === lang);
  const patterns = {};
  let transfer = 0;
  for (const m of list) {
    if (m.interference?.is_transfer) {
      transfer++;
      const k = m.interference.pattern || "Native-language transfer";
      patterns[k] = patterns[k] || { pattern: k, count: 0, explanation: m.interference.explanation, confidence: m.interference.confidence };
      patterns[k].count++;
    }
  }
  return { total: list.length, transfer, share: list.length ? transfer / list.length : 0, patterns: Object.values(patterns).sort((a, b) => b.count - a.count) };
}

// ---- Native → target transfer notes (used in prompts; English target only has a curated KB) ----
const INDIC = ["Hindi", "Marathi", "Gujarati", "Punjabi", "Bengali", "Kannada", "Tamil", "Telugu", "Malayalam"];
const NOART = [...INDIC, "Japanese"];
const SOV_WH = [...INDIC, "Japanese"];
const TRANSFER_EN = {
  articles: { fam: NOART, text: "{native} has no articles, so there is no built-in cue for a/an/the." },
  questions: { fam: SOV_WH, text: "In {native} question words stay in place and no auxiliary moves before the subject." },
  prepositions: { fam: INDIC, text: "{native} uses postpositions/case endings, so English prepositions map unevenly." },
  agreement: { fam: INDIC, text: "English marks only 3rd-person singular present with -s; {native} marks agreement differently." },
  tense: { fam: INDIC, text: "{native} can use progressive forms and time words differently from English tense rules." },
  word_choice: { fam: INDIC, text: "Literal translation from {native} (e.g. 'doubt' used for 'question')." },
  plurals: { fam: INDIC, text: "Some English uncountable nouns (information, advice) can be pluralised in {native}." },
  word_order: { fam: SOV_WH, text: "{native} is verb-final (SOV); English is SVO." },
};
export function transferNote(native, target, concept) {
  if (target === "English") {
    const t = TRANSFER_EN[concept];
    return t && t.fam.includes(native) ? t.text.replaceAll("{native}", native) : "";
  }
  return "";
}

// ---- Offline rule base: English target, learners from Indic languages / Japanese (and generic developmental errors) ----
const IRREG = { go: "went", come: "came", eat: "ate", see: "saw", meet: "met", buy: "bought", take: "took", give: "gave", do: "did", make: "made", get: "got", have: "had", say: "said", write: "wrote", know: "knew", speak: "spoke", run: "ran", drink: "drank", sleep: "slept", tell: "told", think: "thought", bring: "brought", leave: "left", begin: "began", sit: "sat", stand: "stood", forget: "forgot", find: "found", pay: "paid" };
const PAST_BASE = Object.fromEntries(Object.entries(IRREG).map(([b, p]) => [p, b]));
const toPast = (v) => IRREG[v] || (/e$/.test(v) ? v + "d" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ied" : v + "ed");
const third = (v) => ({ have: "has", do: "does", go: "goes" }[v] || (/(s|sh|ch|x|z)$/.test(v) ? v + "es" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ies" : v + "s"));
const needsAn = (w) => /^(honest|hour|heir)/i.test(w) || (/^[aeiou]/i.test(w) && !/^(uni|use|usu|eu|one|once)/i.test(w));
const aOrAn = (w) => (needsAn(w) ? "an" : "a");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const keepCase = (orig, repl) => (/^[A-Z]/.test(orig) ? cap(repl) : repl);
const be1 = { i: "am", he: "is", she: "is", it: "is", we: "are", you: "are", they: "are" };
const STATIVE = { knowing: "know", understanding: "understand", wanting: "want", liking: "like", loving: "love", hating: "hate", needing: "need", believing: "believe", remembering: "remember", preferring: "prefer" };
const WHVERB = { want: "want", wants: "want", need: "need", needs: "need", like: "like", likes: "like", think: "think", thinks: "think", eat: "eat", eats: "eat", say: "say", says: "say", mean: "mean", means: "mean", study: "study", studies: "study", prefer: "prefer", prefers: "prefer", know: "know", knows: "know", live: "live", lives: "live", do: "do", does: "do" };
const subjHave = (s) => (/^(he|she|it)$/i.test(s) ? "has" : "have");

// tr = transfer info: { fam, pattern, why(native), conf }. Rules without tr are treated as general learner errors.
export const RULES = [
  { id: "doubt", re: /\b(?:I am|I'm) having (?:a |an |some )?doubts?\b/gi, fix: () => "I have a question", concept: "word_choice", reason: "In English, 'doubt' means you are unsure something is true. To ask about something, say 'I have a question'.", tr: { fam: INDIC, pattern: "Literal word transfer ('doubt' = question)", conf: "likely", why: (n) => `Many ${n} speakers use the word for 'doubt' to mean 'a question'. English keeps 'doubt' for uncertainty.` } },
  { id: "stative", re: /\b(I am|I'm|he is|she is|it is|we are|you are|they are) (knowing|understanding|wanting|liking|loving|hating|needing|believing|remembering|preferring)\b/gi, fix: (m, s, v) => { const subj = s.split(/\s|'/)[0].toLowerCase(); const b = STATIVE[v.toLowerCase()]; return `${/^(he|she|it)$/.test(subj) ? subj : subj === "i" || s.toLowerCase() === "i'm" ? "I" : subj} ${/^(he|she|it)$/.test(subj) ? third(b) : b}`; }, concept: "tense", reason: "Verbs of knowing, wanting and liking describe states, so English uses the simple present, not '-ing'.", tr: { fam: INDIC, pattern: "Progressive form used with state verbs", conf: "possible", why: (n) => `In ${n} an ongoing form can be used with verbs like 'know' or 'want'. English treats them as states.` } },
  { id: "having-possession", re: /\b(I am|I'm|he is|she is|we are|you are|they are) having (?=(?:a|an|two|three|four|many|some|one|\d+) )/gi, fix: (m, s) => { const subj = s.split(/\s|'/)[0].toLowerCase(); const w = subj === "i" ? "I" : subj; return `${w} ${subjHave(subj)} `; }, concept: "tense", reason: "To show possession, English uses 'have/has' in the simple present, not 'is/am/are having'.", tr: { fam: INDIC, pattern: "Progressive form used with state verbs", conf: "possible", why: (n) => `Ongoing forms are flexible in ${n}; English keeps possession in the simple present.` } },
  { id: "third-s", re: /(?<!\b(?:does|did|do|will|can|could|should|would|must|may|might|to|let|not)\s)\b(he|she|it)\s+(go|do|have|eat|like|want|come|play|study|work|live|need|know|read|write|watch|speak|teach|make|take|get|see|say|think|stay|walk|drive)\b/gi, fix: (m, s, v) => `${s} ${third(v.toLowerCase())}`, concept: "agreement", reason: "With he, she and it in the present simple, the verb takes -s/-es (she goes, he has).", tr: { fam: INDIC, pattern: "No matching 3rd-person -s marker", conf: "possible", why: (n) => `${n} marks agreement in a different way, so the English -s is easy to drop.` } },
  { id: "doesnt", re: /\b(he|she|it) (don't|do not)\b/gi, fix: (m, s, d) => `${s} ${d.toLowerCase() === "don't" ? "doesn't" : "does not"}`, concept: "agreement", reason: "With he, she and it use 'doesn't' (does not) in present-simple negatives." },
  { id: "be-agree", re: /\b(they|we|you) (is|am)\b|\bI is\b|\b(he|she|it) (are|am)\b/gi, fix: (m) => { const w = m.split(" "); return `${w[0]} ${be1[w[0].toLowerCase()]}`; }, concept: "agreement", reason: "The verb 'be' must match the subject: I am, he/she/it is, we/you/they are." },
  { id: "wh-invert", re: /^(\s*)(what|where|when|why|how|who|which)\s+(you|we|they|he|she|it|I)\s+(are|is|was|were|will|can|could|should|have|has|had|am)\b/i, fix: (m, sp, wh, subj, aux) => `${sp}${wh} ${aux.toLowerCase()} ${subj.toLowerCase() === "i" ? "I" : subj.toLowerCase()}`, concept: "questions", reason: "In English questions the helper verb comes before the subject: wh-word + helper + subject.", tr: { fam: SOV_WH, pattern: "Question word without auxiliary inversion", conf: "likely", why: (n) => `In ${n} the question word stays where the answer would be and no helper verb moves forward. English moves it before the subject.` } },
  { id: "wh-do", re: /^(\s*)(what|where|when|why|how|which)\s+(you|we|they|he|she)\s+(want|wants|need|needs|like|likes|think|thinks|eat|eats|say|says|mean|means|study|studies|prefer|prefers|know|knows|live|lives|do|does)\b/i, fix: (m, sp, wh, subj, v) => `${sp}${wh} ${/^(he|she)$/i.test(subj) ? "does" : "do"} ${subj.toLowerCase()} ${WHVERB[v.toLowerCase()]}`, concept: "questions", reason: "Present-simple questions need do/does after the question word: 'What do you want?'", tr: { fam: SOV_WH, pattern: "Question word without auxiliary inversion", conf: "likely", why: (n) => `${n} questions do not need a helper verb like do/does, but English present-simple questions do.` } },
  { id: "discuss-about", re: /\b(discuss|discussed|discussing|discusses) about\b/gi, fix: (m, v) => v, concept: "prepositions", reason: "'Discuss' already means 'talk about', so no 'about' follows it.", tr: { fam: INDIC, pattern: "Extra postposition carried over", conf: "likely", why: (n) => `${n} phrases for 'discuss' normally include a postposition meaning 'about'. English 'discuss' already contains it.` } },
  { id: "listen-to", re: /\b(listen|listening|listened|listens) (music|songs?|radio|podcasts?|him|her|them|me|you)\b/gi, fix: (m, v, o) => `${v} to ${o}`, concept: "prepositions", reason: "'Listen' needs 'to' before its object: listen to music.", tr: { fam: INDIC, pattern: "Missing preposition (direct object)", conf: "likely", why: (n) => `In ${n} the verb for 'listen' takes its object directly, with no separate word for 'to'.` } },
  { id: "explain-me", re: /\b(explain|explained|explaining|explains) (me|him|her|us|them)\b/gi, fix: (m, v, o) => `${v} to ${o}`, concept: "prepositions", reason: "'Explain' needs 'to' before the person: explain to me.", tr: { fam: INDIC, pattern: "Missing preposition (indirect object)", conf: "possible", why: (n) => `${n} marks the listener with a case ending, which English replaces with 'to'.` } },
  { id: "wait-for", re: /\b(waiting|waited|wait|waits) (you|him|her|them|us|me)\b/gi, fix: (m, v, o) => `${v} for ${o}`, concept: "prepositions", reason: "'Wait' needs 'for' before the person you are waiting for.", tr: { fam: INDIC, pattern: "Missing preposition (direct object)", conf: "likely", why: (n) => `The ${n} equivalent of 'wait for someone' takes the person directly, without a separate word for 'for'.` } },
  { id: "married-with", re: /\bmarried with\b/gi, fix: () => "married to", concept: "prepositions", reason: "We say 'married to' someone.", tr: { fam: INDIC, pattern: "Postposition mapped word-for-word", conf: "possible", why: (n) => `A ${n} postposition meaning 'with' is often used here; English uses 'to'.` } },
  { id: "angry-on", re: /\bangry on\b/gi, fix: () => "angry with", concept: "prepositions", reason: "We say 'angry with' a person (and 'angry about' a thing).", tr: { fam: INDIC, pattern: "Postposition mapped word-for-word", conf: "possible", why: (n) => `${n} uses a case ending that maps to 'on' for this idea; English uses 'with'.` } },
  { id: "good-in", re: /\b(good|bad|weak|poor|excellent) in (maths?|english|science|studies|sports?|cooking|drawing|singing|coding|programming|[a-z]+ing)\b/gi, fix: (m, a, s) => `${a} at ${s}`, concept: "prepositions", reason: "For skills we say 'good at', not 'good in'.", tr: { fam: INDIC, pattern: "Locative postposition mapped to 'in'", conf: "likely", why: (n) => `${n} uses a locative ending ('in/at') for skills, which is often translated as 'in'. English uses 'at'.` } },
  { id: "art-predicate", re: /\b(I am|I'm|he is|she is|it is|this is|that is) (?!a\b|an\b|the\b|my\b|your\b|his\b|her\b|our\b|their\b)(student|teacher|engineer|doctor|developer|boy|girl|man|woman|manager|lawyer|nurse|driver|farmer|designer)\b/gi, fix: (m, s, n) => `${s} ${aOrAn(n)} ${n}`, concept: "articles", reason: "A singular countable noun needs a/an: 'I am a student'.", tr: { fam: NOART, pattern: "No article system in native language", conf: "likely", why: (n) => `${n} has no articles, so nothing signals that English needs a/an here.` } },
  { id: "art-place", re: /\b(go|goes|went|going|gone) to (market|bank|station|airport|library|doctor|dentist|mall|park)\b/gi, fix: (m, v, p) => `${v} to the ${p}`, concept: "articles", reason: "Specific, known places take 'the': 'go to the market'.", tr: { fam: NOART, pattern: "No article system in native language", conf: "likely", why: (n) => `${n} has no word for 'the', so definite places are named without any marker.` } },
  { id: "art-have", re: /\b(I|we|they|you) (have|had|bought|need|want) (car|laptop|phone|bike|computer|dog|cat|house|brother|sister|friend|job|problem|question)\b/gi, fix: (m, s, v, n) => `${s} ${v} ${aOrAn(n)} ${n}`, concept: "articles", reason: "Singular countable nouns need a/an: 'I have a laptop'.", tr: { fam: NOART, pattern: "No article system in native language", conf: "likely", why: (n) => `In ${n} the bare noun is enough; English needs a/an before singular countable nouns.` } },
  { id: "a-an", re: /\b(an?)\s+([a-z]+)/gi, fix: (m, art, w) => { const want = aOrAn(w); return art.toLowerCase() === want ? m : `${keepCase(art, want)} ${w}`; }, concept: "articles", reason: "Use 'an' before a vowel sound and 'a' before a consonant sound." },
  { id: "past-time-word", re: /\b(yesterday|last night|last week|last month)\b([^.?!]*?)\b(I|we|they|he|she) (go|come|eat|see|meet|buy|take|watch|play|finish|study|visit)\b/gi, fix: (m, t, mid, s, v) => `${t}${mid}${s} ${toPast(v.toLowerCase())}`, concept: "tense", reason: "With 'yesterday' or 'last…', the verb itself must be in the past form (went, ate, saw).", tr: { fam: INDIC, pattern: "Time word treated as enough to show past", conf: "possible", why: (n) => `In everyday ${n} a time word can carry the 'past' meaning. English still needs the verb to change.` } },
  { id: "didnt-past", re: /\b(didn't|did not|don't|doesn't|won't|can't|cannot|couldn't|shouldn't) (went|came|ate|saw|took|gave|did|made|got|had|said|bought|met|wrote|knew)\b/gi, fix: (m, a, v) => `${a} ${PAST_BASE[v.toLowerCase()]}`, concept: "verb_forms", reason: "After did/didn't (and other helpers) the main verb stays in its base form: 'I didn't go'." },
  { id: "since-from", re: /\b(I am|I'm|he is|she is|it is|we are|you are|they are) (\w+ing) (?:from|since) (yesterday|morning|monday|tuesday|wednesday|thursday|friday|saturday|sunday|last \w+|\d+)\b/gi, fix: (m, s, v, t) => { const subj = s.split(/\s|'/)[0].toLowerCase(); const w = subj === "i" ? "I" : subj; return `${w} ${/^(he|she|it)$/.test(subj) ? "has" : "have"} been ${v} since ${t}`; }, concept: "tense", reason: "For an action that started in the past and continues now, use present perfect continuous with 'since'.", tr: { fam: INDIC, pattern: "'From/since' and present continuous merged", conf: "likely", why: (n) => `${n} uses one postposition for both 'from' and 'since', and the present tense for ongoing durations.` } },
  { id: "myself-name", re: /\bMyself ([A-Z][a-z]+)/g, fix: (m, n) => `My name is ${n}`, concept: "word_choice", reason: "Introduce yourself with 'My name is…' or 'I'm…'. 'Myself' needs a matching 'I' in the sentence." },
  { id: "cousin", re: /\bcousin (brother|sister)\b/gi, fix: () => "cousin", concept: "word_choice", reason: "English 'cousin' covers all genders; add gender only if needed ('my female cousin').", tr: { fam: INDIC, pattern: "More specific kinship vocabulary", conf: "likely", why: (n) => `${n} kinship words are more specific than English, so learners add 'brother/sister' to clarify.` } },
  { id: "good-name", re: /\b(your|his|her) good name\b/gi, fix: (m, p) => `${p} name`, concept: "register", reason: "Ask 'What is your name?'. 'Good name' sounds unusual in English even though it is polite.", tr: { fam: INDIC, pattern: "Honorific phrase translated literally", conf: "likely", why: (n) => `${n} has honorific phrases for asking a name. Translated word-for-word they sound odd in English.` } },
  { id: "more-better", re: /\b(more|most) (better|best|easier|bigger|faster|cheaper)\b/gi, fix: (m, a, b) => b, concept: "word_choice", reason: "Words like 'better' and 'best' are already comparatives or superlatives, so 'more/most' is not needed." },
  { id: "said-me", re: /\b(he|she|they|you|who|ram|my \w+) (said|says) me\b/gi, fix: (m, s, v) => `${s} ${v.toLowerCase() === "said" ? "told" : "tells"} me`, concept: "word_choice", reason: "'Say' needs 'to' before the listener ('said to me'); with a listener directly after the verb, use 'tell'.", tr: { fam: INDIC, pattern: "One verb for say/tell", conf: "possible", why: (n) => `${n} often uses a single verb for 'say' and 'tell'.` } },
  { id: "uncountable", re: /\b(informations|advices|furnitures|equipments|knowledges|homeworks|luggages|feedbacks)\b/gi, fix: (m) => m.slice(0, -1), concept: "plurals", reason: "Information, advice, furniture, equipment, knowledge, homework, luggage and feedback are uncountable: no -s.", tr: { fam: INDIC, pattern: "Uncountable noun pluralised", conf: "possible", why: (n) => `The matching ${n} nouns can usually be made plural, but English treats these as uncountable.` } },
  { id: "prepone", re: /\bprepone(d)?\b/gi, fix: (m, d) => (d ? "moved earlier" : "move earlier"), concept: "word_choice", reason: "'Prepone' is common in Indian English but is not widely understood elsewhere. Use 'move earlier'." },
  { id: "return-back", re: /\b(return|returned|reply|replied|revert|reverted) back\b/gi, fix: (m, v) => v, concept: "collocation", reason: "'Return', 'reply' and 'revert' already include the idea of 'back'." },
];

export function offlineSupported(native, target) {
  return target === "English" && native !== "English";
}

const splitSentences = (t) => t.split(/(?<=[.?!])\s+/).filter((s) => s.trim());

// Returns an AI-schema-shaped result so the UI is identical for AI and offline results.
export function correctOffline(text, native, practiceFor) {
  const corrections = [];
  let natural = [];
  for (const sentence of splitSentences(text)) {
    let full = sentence;
    for (const rule of RULES) {
      const apply = (str) => str.replace(new RegExp(rule.re.source, rule.re.flags), (...a) => keepCase(a[0], rule.fix(...a)));
      const fullNext = apply(full);
      if (fullNext !== full) {
        const once = apply(sentence);
        const hit = rule.tr && rule.tr.fam.includes(native);
        corrections.push({
          original: sentence, corrected: once !== sentence ? once : fullNext, reason: rule.reason, concept: rule.concept, rule: rule.id,
          interference: hit
            ? { is_transfer: true, pattern: rule.tr.pattern, explanation: rule.tr.why(native), confidence: rule.tr.conf }
            : { is_transfer: false, pattern: "", explanation: "", confidence: "" },
          practice: practiceFor ? practiceFor(rule.concept) : undefined,
        });
      }
      full = fullNext;
    }
    natural.push(full);
  }
  return { has_errors: corrections.length > 0, corrections, natural_version: natural.join(" "), feedback: null };
}

export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
