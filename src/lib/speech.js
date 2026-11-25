// Browser speech (Web Speech API). Buttons are hidden when the browser does not support it.
const w = typeof window !== "undefined" ? window : {};
export const canSpeak = "speechSynthesis" in w;
const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
export const canListen = !!SR;

export function speak(text, lang) {
  if (!canSpeak || !text) return;
  w.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  const voice = w.speechSynthesis.getVoices().find((v) => v.lang === lang) || w.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  w.speechSynthesis.speak(u);
}

export function listen(lang, { onResult, onEnd, onError }) {
  if (!SR) return null;
  const r = new SR();
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => onResult(e.results[0][0].transcript);
  r.onend = () => onEnd && onEnd();
  r.onerror = (e) => onError && onError(e.error);
  try { r.start(); } catch { onEnd && onEnd(); }
  return r;
}
