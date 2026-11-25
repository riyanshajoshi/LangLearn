// Supported languages. `mix` = name of the code-mixed style for speakers of that language.
export const LANGUAGES = [
  { name: "English", code: "en-US", script: "Latin", mix: "Simple English" },
  { name: "Hindi", code: "hi-IN", script: "हिन्दी", mix: "Hinglish" },
  { name: "Kannada", code: "kn-IN", script: "ಕನ್ನಡ", mix: "Kanglish" },
  { name: "Tamil", code: "ta-IN", script: "தமிழ்", mix: "Tanglish" },
  { name: "Telugu", code: "te-IN", script: "తెలుగు", mix: "Tenglish" },
  { name: "Malayalam", code: "ml-IN", script: "മലയാളം", mix: "Manglish" },
  { name: "Bengali", code: "bn-IN", script: "বাংলা", mix: "Banglish" },
  { name: "Marathi", code: "mr-IN", script: "मराठी", mix: "Marathi-English mix" },
  { name: "Gujarati", code: "gu-IN", script: "ગુજરાતી", mix: "Gujarati-English mix" },
  { name: "Punjabi", code: "pa-IN", script: "ਪੰਜਾਬੀ", mix: "Punjabi-English mix" },
  { name: "French", code: "fr-FR", script: "Français", mix: "Franglais" },
  { name: "Spanish", code: "es-ES", script: "Español", mix: "Spanglish" },
  { name: "German", code: "de-DE", script: "Deutsch", mix: "Denglisch" },
  { name: "Japanese", code: "ja-JP", script: "日本語", mix: "Japanese-English mix" },
];

export const LEVELS = ["Beginner", "Intermediate", "Advanced"];
export const GOALS = ["Speaking", "Grammar", "Vocabulary", "Writing", "General Fluency"];
export const STYLES = [
  { id: "target", label: "Target language only" },
  { id: "native", label: "Native language" },
  { id: "mixed", label: "Code-mixed" },
];

export const langInfo = (name) => LANGUAGES.find((l) => l.name === name) || LANGUAGES[0];
export const langCode = (name) => langInfo(name).code;

export function styleLabel(p, s = p.style) {
  if (s === "target") return `${p.target} only`;
  if (s === "native") return `${p.native}`;
  return langInfo(p.native).mix;
}

// Instruction text used inside prompts for the chosen explanation style.
export function styleInstruction(p) {
  const { native, target, level } = p;
  if (p.style === "target")
    return `Explain only in ${target}, using vocabulary a ${level} learner knows.`;
  if (p.style === "native")
    return `Explain in ${native}; keep ${target} for examples and corrected sentences only.`;
  return `Explain in ${langInfo(native).mix} (${native} and English mixed naturally, romanised where easier to read); keep ${target} for examples and corrected sentences.`;
}

export const DEFAULT_PROFILE = {
  name: "",
  native: "Kannada",
  target: "English",
  level: "Beginner",
  goal: "Speaking",
  style: "mixed",
  onboarded: false,
};
