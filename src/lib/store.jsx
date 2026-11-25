import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as S from "./state.js";
import { fetchStatus } from "./ai.js";
import { topWeaknesses } from "./engine.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [state, setState] = useState(S.load);
  const [ai, setAi] = useState({ checked: false, configured: false, provider: null, model: null });

  useEffect(() => S.save(state), [state]);
  useEffect(() => { fetchStatus().then((s) => setAi({ checked: true, ...s })); }, []);

  const derived = useMemo(() => S.derive(state), [state.events]);
  const act = useMemo(() => {
    const u = (fn) => (...a) => setState((s) => fn(s, ...a));
    return {
      setProfile: u(S.setProfile), logTurn: u(S.logTurn), logExercise: u(S.logExercise), toggleReviewed: u(S.toggleReviewed),
      addVocab: u(S.addVocab), removeVocab: u(S.removeVocab), gradeVocab: u(S.gradeVocab), toggleLearned: u(S.toggleLearned), toggleDifficult: u(S.toggleDifficult),
      addQuiz: u(S.addQuiz), addSim: u(S.addSim), setSimLevel: u(S.setSimLevel), setChat: u(S.setChat), saveDaily: u(S.saveDaily), addTranslation: u(S.addTranslation),
      resetAll: () => setState(S.initialState()),
      importState: (s) => setState(S.clearDemo({ ...S.initialState(), ...s, clock: 0 })),
    };
  }, []);

  const lang = state.profile.target;
  const now = S.nowOf(state);
  const concepts = useMemo(() => Object.values(derived.concepts).filter((c) => c.lang === lang), [derived, lang]);
  const weak = useMemo(() => topWeaknesses(derived.concepts, lang, 6), [derived, lang]);
  const value = { state, profile: state.profile, lang, now, ai, derived, concepts, weak, act };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
