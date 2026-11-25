import { runPrompt, normalizeExercise, AIError } from "./ai.js";
import { buildRevision } from "./prompts.js";
import { STRATEGIES, conceptLabel } from "./engine.js";
import { bankForConcept } from "./bank.js";

// Builds a revision drill for one concept at the given teaching-strategy level.
// AI when connected; otherwise built-in English items (clearly labelled by the caller via `source`).
export async function makeDrill({ profile, concept, level, concepts, mistakes, useAI, count = 4 }) {
  if (useAI) {
    const recent = mistakes.filter((m) => m.concept === concept && m.lang === profile.target).slice(-4);
    const r = await runPrompt(buildRevision({ profile, concept, level, recent, count, concepts }), { task: "revision" });
    if (!r.data.exercises.length) throw new AIError("The AI returned no usable exercises. Please try again.");
    return { drill: r.data, source: "ai", meta: r };
  }
  if (profile.target !== "English") throw new AIError(`Drills for ${profile.target} need the AI connection. Add an API key to .env (see README).`, true);
  const items = bankForConcept(concept, count).map((q, i) => {
    const asFill = level >= 2 && q.prompt.includes("___");
    return normalizeExercise({ ...q, type: asFill ? "fill" : "mcq", hint: level >= 3 && asFill ? `Starts with "${q.answer[0]}"` : undefined, concept }, i);
  });
  return { drill: { intro: `Built-in practice on ${conceptLabel(concept)}. ${items[0]?.explanation || ""} (Offline mode cannot change its explanation style; connect AI for the adaptive strategy "${STRATEGIES[level].name}".)`, contrast: "", exercises: items }, source: "builtin", meta: null };
}
