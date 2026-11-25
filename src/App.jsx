import { useEffect, useState } from "react";
import "./App.css";
import "./ui.css";
import { StoreProvider, useStore } from "./lib/store.jsx";
import { PAGES, parseHash, go } from "./lib/nav.js";
import { LANGUAGES, LEVELS } from "./lib/languages.js";

import Home from "./Home";
import Tutor from "./Tutor";
import Simulator from "./Simulator";
import Grammar from "./Grammar";
import Vocabulary from "./Vocabulary";
import Quiz from "./Quiz";
import Mistakes from "./Mistakes";
import Revision from "./Revision";
import Translate from "./Translate";
import PromptLab from "./PromptLab";
import Settings, { ProfileForm } from "./Settings";

const VIEWS = { home: Home, tutor: Tutor, simulator: Simulator, grammar: Grammar, vocabulary: Vocabulary, quiz: Quiz, mistakes: Mistakes, revision: Revision, translate: Translate, lab: PromptLab, settings: Settings };

function Shell() {
  const { state, profile, ai, act } = useStore();
  const [route, setRoute] = useState(parseHash);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("langlearn-theme") === "dark" ? "dark" : "light"; } catch { return "light"; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("langlearn-theme", theme); } catch {} }, [theme]);
  useEffect(() => { const close = e => { if (e.key === "Escape") setMenu(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const themeButton = <button className="theme-toggle" type="button" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>;
  useEffect(() => {
    const on = () => { setRoute(parseHash()); setMenu(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  if (!profile.onboarded)
    return (
      <div className="onboard">
        <div className="setup-card">
          <div className="onboard-actions">{themeButton}</div>
          <h1>Welcome to LangLearn</h1>
          <p className="setup-description">Choose your languages. The tutor adapts to your language background, finds why mistakes happen and personalises its teaching as you practise.</p>
          <ProfileForm submitLabel="Start learning" />
        </div>
      </div>
    );

  const View = VIEWS[route.id];
  const page = PAGES.find((p) => p.id === route.id);

  const pickLang = (k, v) => act.setProfile({ [k]: v });

  return (
    <div className="app">
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand"><div className="brand-icon">✦</div><div><h2>LangLearn</h2><p>LANGUAGE COMPANION</p></div></div>
        
        <nav className="navigation" aria-label="Main">
          {[["Learn", ["home", "tutor", "vocabulary", "grammar", "translate"]], ["Practice", ["quiz", "simulator", "revision", "mistakes"]], ["Tools", ["lab", "settings"]]].map(([label, ids]) => <div className="nav-group" key={label}><div className="menu-label">{label}</div>{ids.map(id => PAGES.find(p => p.id === id)).map((item) => (
            <button key={item.id} className={`nav-item ${route.id === item.id ? "active" : ""}`} onClick={() => { go(item.id); setMenu(false); }} aria-current={route.id === item.id ? "page" : undefined}>
              <span className="nav-icon">{item.icon}</span>{item.name}
            </button>
          ))}</div>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => go("settings")}>
            <div className="avatar">{(profile.name || "S").charAt(0).toUpperCase()}</div>
            <div><h4>{profile.name || "Student"}</h4><p>{profile.level} learner</p></div>
            <span className="profile-dots">⚙</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>☰</button>
          <div className="breadcrumb"><strong>{page.name}</strong></div>
          <div className="lang-switch" aria-label="Language selection">
            <label><small>I speak</small>
              <select value={profile.native} onChange={(e) => pickLang("native", e.target.value)}>{LANGUAGES.map((l) => <option key={l.name} value={l.name} disabled={l.name === profile.target}>{l.name}</option>)}</select></label>
            <span className="lang-arrow">→</span>
            <label><small>I'm learning</small>
              <select value={profile.target} onChange={(e) => pickLang("target", e.target.value)}>{LANGUAGES.map((l) => <option key={l.name} value={l.name} disabled={l.name === profile.native}>{l.name}</option>)}</select></label>
            <label className="lvl"><small>Level</small>
              <select value={profile.level} onChange={(e) => pickLang("level", e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
          <div className="topbar-right">
            {themeButton}
            <button className="status" onClick={() => go("settings")} title={ai.configured ? `${ai.provider} · ${ai.model}` : "No API key: offline mode"}>
              <i className={ai.configured ? "" : "off"} /> {ai.checked ? (ai.configured ? "AI configured" : "Offline mode") : "Checking…"}
            </button>
          </div>
        </header>
        <div className="view" key={`${route.id}:${profile.target}`}><View params={route.params} /></div>
      </main>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
