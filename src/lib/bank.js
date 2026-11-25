// Offline content (English target only). Everything served from here is labelled "offline / built-in" in the UI.
import { norm } from "./engine.js";

// [concept, prompt, options, answerIndex, explanation]
const Q = [
  ["articles", "She bought ___ umbrella.", ["a", "an", "the", "no article"], 1, "'Umbrella' starts with a vowel sound, so we use 'an'."],
  ["articles", "I am ___ engineer.", ["a", "an", "the", "no article"], 1, "'Engineer' starts with a vowel sound: 'an engineer'."],
  ["articles", "We went to ___ market near our house yesterday.", ["a", "an", "the", "no article"], 2, "A specific, known place takes 'the'."],
  ["tense", "They ___ football right now.", ["play", "plays", "are playing", "played"], 2, "'Right now' needs the present continuous: are playing."],
  ["tense", "We ___ a movie yesterday.", ["watch", "watched", "watching", "watches"], 1, "'Yesterday' signals the past, so use 'watched'."],
  ["tense", "I ___ here since Monday.", ["am living", "live", "have been living", "was living"], 2, "An action that began in the past and continues now uses 'have been living' with 'since'."],
  ["agreement", "She ___ to college every day.", ["go", "goes", "going", "gone"], 1, "Use 'goes' with he, she and it in the present simple."],
  ["agreement", "The students ___ ready.", ["is", "am", "are", "was"], 2, "'Students' is plural, so we use 'are'."],
  ["agreement", "I ___ a student.", ["is", "are", "am", "be"], 2, "We use 'am' with the subject 'I'."],
  ["prepositions", "My birthday is ___ July.", ["at", "on", "in", "by"], 2, "Use 'in' with months and years."],
  ["prepositions", "I wake up ___ 7 AM.", ["in", "on", "at", "by"], 2, "Use 'at' with clock times."],
  ["prepositions", "She is good ___ mathematics.", ["in", "at", "on", "with"], 1, "We say 'good at' for skills."],
  ["verb_forms", "Choose the past tense of 'eat'.", ["Eated", "Eating", "Eats", "Ate"], 3, "'Eat' is irregular: eat → ate → eaten."],
  ["verb_forms", "I didn't ___ to the party.", ["went", "go", "going", "gone"], 1, "After 'didn't' the verb stays in base form: 'go'."],
  ["plurals", "Choose the correct sentence.", ["She gave me many informations.", "She gave me much information.", "She gave me an information.", "She gave me informations."], 1, "'Information' is uncountable: no -s, use 'much' or 'some'."],
  ["plurals", "I need some ___ about the course.", ["advices", "advice", "an advice", "advises"], 1, "'Advice' is uncountable."],
  ["questions", "Which question is correct?", ["Where you are going?", "Where are you going?", "Where you going are?", "Where going you?"], 1, "In English questions the helper verb comes before the subject."],
  ["questions", "What ___ you want to eat?", ["do", "does", "are", "is"], 0, "Present-simple questions with 'you' use 'do'."],
  ["questions", "Why ___ late?", ["he is", "is he", "he does", "does be"], 1, "Wh-word + helper verb + subject: 'Why is he late?'"],
  ["word_order", "Choose the natural sentence.", ["I yesterday saw him.", "I saw him yesterday.", "Saw I him yesterday.", "Yesterday saw I him."], 1, "English word order is Subject – Verb – Object, with time words usually at the end or start."],
  ["word_choice", "What is the opposite of 'Happy'?", ["Excited", "Sad", "Kind", "Friendly"], 1, "'Sad' is the opposite of 'Happy'."],
  ["word_choice", "You want to ask your teacher something. You say: 'I have a ___.'", ["doubt", "question", "confusion", "problem"], 1, "'Question' is what you ask. 'Doubt' means being unsure something is true."],
  ["word_choice", "Introduce yourself: '___ Anita.'", ["Myself", "My name is", "I name", "Name is my"], 1, "Use 'My name is…' or 'I'm…'."],
  ["collocation", "I want to ___ a decision before Friday.", ["do", "make", "take out", "put"], 1, "We 'make' a decision."],
  ["negation", "Choose the correct negative.", ["He don't like tea.", "He doesn't likes tea.", "He doesn't like tea.", "He not like tea."], 2, "With he/she/it use 'doesn't' + base verb."],
  ["pronouns", "Sita is my friend. ___ lives in Mysuru.", ["He", "She", "It", "They"], 1, "Use 'she' for a female person."],
  ["linking", "If it rains, we ___ at home.", ["stayed", "will stay", "stays", "stay yesterday"], 1, "First conditional: If + present, will + verb."],
  ["linking", "I stayed home ___ it was raining.", ["because", "but", "so", "or"], 0, "'Because' introduces the reason."],
  ["register", "Politely asking for water at a restaurant:", ["Give water.", "Could I have some water, please?", "Water bring.", "I want water now."], 1, "'Could I… please?' is polite and natural."],
];

export const BANK = Q.map(([concept, prompt, options, a, explanation], i) => ({
  id: `b${i}`, type: "mcq", concept, prompt, options, answer: options[a], explanation,
}));

export function sampleBank(count, weightFor = () => 1, avoid = []) {
  const pool = BANK.filter((q) => !avoid.includes(q.id));
  const picked = [];
  const items = (pool.length >= count ? pool : BANK).map((q) => ({ q, w: weightFor(q.concept) + Math.random() * 0.01 }));
  while (picked.length < count && items.length) {
    const total = items.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    const idx = items.findIndex((x) => (r -= x.w) <= 0);
    picked.push(items.splice(idx < 0 ? 0 : idx, 1)[0].q);
  }
  return picked;
}

export const bankForConcept = (concept, n = 4) => {
  const same = BANK.filter((q) => q.concept === concept);
  return (same.length ? same : BANK.filter((q) => q.concept === "word_choice")).slice(0, n);
};

// A fill-in practice prompt for a concept (used under each correction card)
export function practiceFor(concept) {
  const q = BANK.filter((x) => x.concept === concept && x.prompt.includes("___"))[0];
  return q ? { prompt: q.prompt, answer: q.answer } : undefined;
}

export const looseEqual = (a, b) => norm(a) === norm(b);

// ---- Existing demo tutor replies (preserved from the original app; used only when AI is not connected) ----
export function cannedTutorReply(question) {
  const q = question.toLowerCase();
  if (q.includes("is, am") || q.includes("is/am") || q.includes("am and are") || q.includes(" are"))
    return `Let's learn "am", "is" and "are"!\n\n• I am a student.\n• She is happy.\n• They are friends.\n\nRemember:\nUse "am" with I.\nUse "is" with he, she and it.\nUse "are" with you, we and they.\n\nPractice: They ___ playing.`;
  if (q.includes("word") || q.includes("vocabulary"))
    return `Here are 5 useful English words:\n\n1. Confident — feeling sure about yourself.\n2. Improve — to become better.\n3. Curious — wanting to learn something.\n4. Practice — doing something regularly to get better.\n5. Opportunity — a chance to do something.\n\nPractice:\nMake one sentence using "confident".`;
  if (/^(hello|hi|hey)\b/.test(q))
    return `Hello! I'm your English tutor.\nWe can practise grammar, vocabulary, sentence correction and everyday conversation.\n\nType an English sentence and I'll check it.`;
  return null;
}

// ---- Scripted partner lines for the offline simulator (English only) ----
export const SCENARIOS = {
  restaurant: { title: "Restaurant", icon: "🍽", brief: "You are ordering dinner. The AI is your waiter.", lines: ["Good evening! Welcome. Table for how many?", "Here is the menu. Can I get you something to drink first?", "Great choice. Would you like anything for starters?", "And what would you like for the main course?", "Perfect. Is there anything else I can get you?"] },
  interview: { title: "Job interview", icon: "💼", brief: "You are interviewing for an internship. The AI is the interviewer.", lines: ["Good morning! Please, take a seat. Can you introduce yourself?", "Thank you. Why are you interested in this internship?", "What would you say is your biggest strength?", "Can you describe a project you are proud of?", "Do you have any questions for us?"] },
  travel: { title: "Travel", icon: "✈", brief: "You are checking in at a hotel. The AI is the receptionist.", lines: ["Welcome to the hotel! Do you have a reservation?", "May I see your ID, please? How many nights are you staying?", "Your room is on the third floor. Would you like a wake-up call?", "Breakfast is from seven to ten. Do you need directions to anywhere?", "Is there anything else I can help you with?"] },
  shopping: { title: "Shopping", icon: "🛍", brief: "You are buying clothes. The AI is the shop assistant.", lines: ["Hi there! Are you looking for anything in particular?", "What size do you usually wear?", "That one comes in blue and black. Which do you prefer?", "The fitting room is over there. How does it fit?", "Would you like to pay by cash or card?"] },
  college: { title: "College", icon: "🎓", brief: "You are talking to a classmate about an assignment.", lines: ["Hey! Did you finish the assignment for tomorrow?", "Which part was the hardest for you?", "Do you want to study together this evening?", "Where should we meet, the library or the canteen?", "Great. What time works for you?"] },
  daily: { title: "Daily life", icon: "🏠", brief: "You are chatting with a new neighbour.", lines: ["Hi! I just moved in next door. Nice to meet you!", "Where are you from originally?", "What do you usually do on weekends?", "Is there a good place to eat around here?", "Thanks for the tips! Shall we exchange numbers?"] },
  debate: { title: "Debate", icon: "🗣", brief: "Topic: Should students use mobile phones in class? The AI disagrees with you.", lines: ["I think phones should be banned in class. They are a distraction. Do you agree?", "But students can look up information quickly. Isn't that a problem for learning?", "Interesting point. What rules would you suggest instead?", "Some students might still misuse them. How would you handle that?", "Fair enough. Can you summarise your position in one sentence?"] },
};

// ---- Static word list (preserved from the original app; English only, offline) ----
export const STATIC_WORDS = [
  ["Confident", "/ˈkɒnfɪdənt/", "Adjective", "Beginner", "Feeling sure about yourself and your abilities.", "I feel confident when I speak English.", "Personality"],
  ["Improve", "/ɪmˈpruːv/", "Verb", "Beginner", "To become better or make something better.", "I practice every day to improve my English.", "Learning"],
  ["Curious", "/ˈkjʊəriəs/", "Adjective", "Beginner", "Wanting to know or learn something.", "She is curious about different cultures.", "Personality"],
  ["Opportunity", "/ˌɒpəˈtjuːnəti/", "Noun", "Intermediate", "A chance to do something useful or important.", "This internship is a great opportunity for me.", "Daily Life"],
  ["Essential", "/ɪˈsenʃəl/", "Adjective", "Intermediate", "Very important or necessary.", "Practice is essential for learning a language.", "Academic"],
  ["Fluent", "/ˈfluːənt/", "Adjective", "Intermediate", "Able to speak a language smoothly and easily.", "She wants to become fluent in English.", "Learning"],
  ["Persistent", "/pəˈsɪstənt/", "Adjective", "Advanced", "Continuing to try despite difficulties.", "A persistent learner never gives up easily.", "Personality"],
  ["Articulate", "/ɑːˈtɪkjələt/", "Adjective", "Advanced", "Able to express ideas clearly using words.", "She is articulate during presentations.", "Speaking"],
  ["Adapt", "/əˈdæpt/", "Verb", "Intermediate", "To change according to a new situation.", "We must adapt to new learning methods.", "Daily Life"],
  ["Remarkable", "/rɪˈmɑːkəbəl/", "Adjective", "Advanced", "Very unusual or impressive.", "She made remarkable progress in English.", "General"],
].map(([word, pron, pos, level, meaning, example, topic], i) => ({ id: `s${i}`, word, pron, pos, level, meaning_target: meaning, meaning_native: "", example, example_translation: "", synonyms: [], usage_note: "", topic }));
