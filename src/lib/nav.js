export const PAGES = [
  { id: "home", name: "Home", icon: "⌂" },
  { id: "tutor", name: "AI Tutor", icon: "✦" },
  { id: "simulator", name: "Simulator", icon: "◐" },
  { id: "grammar", name: "Grammar", icon: "▤" },
  { id: "vocabulary", name: "Vocabulary", icon: "Aa" },
  { id: "quiz", name: "Practice Quiz", icon: "◎" },
  { id: "mistakes", name: "My Mistakes", icon: "↻" },
  { id: "revision", name: "Revision", icon: "◷" },
  { id: "translate", name: "Translate", icon: "⇄" },
  { id: "lab", name: "Prompt Lab", icon: "⚗" },
  { id: "settings", name: "Settings", icon: "⚙" },
];
export const go = (id, params) => { window.location.hash = `/${id}${params ? `?${new URLSearchParams(params)}` : ""}`; };
export function parseHash() {
  const [id, q] = window.location.hash.replace(/^#\/?/, "").split("?");
  return { id: PAGES.some((p) => p.id === id) ? id : "home", params: Object.fromEntries(new URLSearchParams(q || "")) };
}
