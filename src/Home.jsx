import { useStore } from "./lib/store.jsx";
import { isDue, conceptLabel } from "./lib/engine.js";
import { weekProgress } from "./lib/state.js";
import { go } from "./lib/nav.js";

const activities = [
  ["tutor", "✦", "AI tutor", "Learn with personalised conversations."],
  ["translate", "⇄", "Translate", "Translate words and sentences."],
  ["vocabulary", "Aa", "Vocabulary", "Discover and save useful words."],
  ["grammar", "▤", "Grammar", "Correct sentences and learn the rules."],
  ["quiz", "◎", "Practice quiz", "Test what you know."],
  ["simulator", "◐", "Conversation", "Practise real-life situations."]
];
export default function Home() {
  const { state, profile, lang, now, concepts, weak } = useStore();
  const words = state.vocab.filter(v => v.lang === lang);
  const quizzes = state.quizzes.filter(q => q.lang === lang && q.total > 0);
  const avg = quizzes.length ? Math.round(100 * quizzes.reduce((n,q) => n + q.score/q.total, 0)/quizzes.length) : null;
  const due = [...concepts, ...words].filter(x => isDue(x, now)).length;
  const week = weekProgress(state);
  return <div className="page home-clean">
    <div className="home-intro"><div><span className="eyebrow-l">YOUR LEARNING SPACE</span><h1>{profile.name ? `Welcome, ${profile.name}` : "Ready to learn?"}</h1><p>{lang} · {profile.level} · From {profile.native}</p></div><button className="primary-btn" onClick={() => go("tutor")}>Start learning →</button></div>
    <section className="clean-stats" aria-label="Your progress">{[["Saved words", words.length], ["Quiz average", avg === null ? "—" : `${avg}%`], ["Study streak", `${week.streak} days`], ["Due for review", due]].map(([label,value]) => <div className="card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <h2>Choose an activity</h2><section className="activity-grid">{activities.map(([id,icon,title,desc]) => <button className="activity-card" key={id} onClick={() => go(id)}><span className="activity-icon">{icon}</span><span><strong>{title}</strong><small>{desc}</small></span><span className="activity-arrow">→</span></button>)}</section>
    <h2>Continue your progress</h2><section className="progress-grid"><div className="card"><h3>Revision</h3><p>{due ? `${due} items ready for review.` : "No reviews due right now."}</p><button className="ghost-btn" onClick={() => go("revision")}>Open revision</button></div><div className="card"><h3>Focus area</h3><p>{weak[0] ? conceptLabel(weak[0].concept) : "Complete an activity to identify areas to improve."}</p><button className="ghost-btn" onClick={() => go("mistakes")}>View mistakes</button></div></section>
  </div>;
}
