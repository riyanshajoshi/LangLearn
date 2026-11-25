// Server-side AI proxy. Runs inside the Vite dev/preview server, so API keys stay in .env and never reach the browser.
import { loadEnv } from "vite";

const DEFAULT_MODELS = { groq: "qwen/qwen3.8-27b", anthropic: "claude-haiku-5-5", openai: "gpt-4o-mini", gemini: "gemini-3.8-flash" };

export function resolveProvider(env) {
  const has = {
    groq: !!env.GROQ_API_KEY,
    ollama: !!env.OLLAMA_MODEL,
    anthropic: !!env.ANTHROPIC_API_KEY,
    openai: !!env.OPENAI_API_KEY,
    gemini: !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
  };
  const want = (env.AI_PROVIDER || "").toLowerCase();
  const provider = want === "offline" ? null : want ? (has[want] ? want : null) : ["groq", "gemini", "ollama", "openai", "anthropic"].find(p => has[p]);
  return provider ? { provider, model: provider === "ollama" ? env.OLLAMA_MODEL : (provider === "groq" ? env.GROQ_MODEL : provider === "gemini" ? env.GEMINI_MODEL || env.AI_MODEL : env.AI_MODEL) || DEFAULT_MODELS[provider] } : null;
}

async function callProvider({ provider, model }, env, { system, user, json, maxTokens, temperature }, fetchImpl) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  try {
    let url, headers, body, pick;
    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers = { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` };
      body = { model, max_completion_tokens: maxTokens, temperature, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: [system, json ? "Return only a valid JSON object." : ""].filter(Boolean).join("\n") || "You are a helpful language tutor." }, { role: "user", content: user }] };
      pick = d => d.choices?.[0]?.message?.content || "";
    } else if (provider === "ollama") {
      url = "http://127.0.0.1:11434/api/chat";
      headers = { "content-type": "application/json" };
      body = { model, stream: false, ...(json ? { format: "json" } : {}), options: { temperature, num_predict: maxTokens }, messages: [...(system ? [{role:"system",content:system}] : []), {role:"user",content:user}] };
      pick = d => d.message?.content || "";
    } else if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers = { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" };
      body = { model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: [{ role: "user", content: user }] };
      pick = (d) => (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions";
      headers = { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` };
      body = { model, max_tokens: maxTokens, temperature, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }] };
      pick = (d) => d.choices?.[0]?.message?.content || "";
    } else {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers = { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || env.GOOGLE_API_KEY };
      body = { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) } };
      pick = (d) => (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    }
    const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error?.message || data?.error || "Provider request failed"}`);
    const output = pick(data);
    if (!output.trim()) throw new Error("Provider returned no usable text");
    return output;
  } finally {
    clearTimeout(timer);
  }
}

const hits = new Map(); // tiny per-IP rate limit (60 requests / minute)
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 60;
}

export function createHandler(getEnv, fetchImpl = globalThis.fetch) {
  const send = (res, code, obj) => {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(obj));
  };
  return async function handler(req, res, next) {
    const path = (req.url || "").split("?")[0];
    if (path !== "/status" && path !== "/ai") return next();
    const env = getEnv();
    const cfg = resolveProvider(env);
    if (path === "/status" && req.method === "GET") return send(res, 200, { configured: !!cfg, provider: cfg?.provider || null, model: cfg?.model || null });
    if (path !== "/ai" || req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!cfg) return send(res, 503, { error: "No AI key configured. Add one to .env (see .env.example)." });
    if (limited(req.socket?.remoteAddress || "local")) return send(res, 429, { error: "Too many requests. Please wait a moment." });
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100000) return send(res, 413, { error: "Request too large" });
    }
    let b;
    try { b = JSON.parse(raw); } catch { return send(res, 400, { error: "Invalid JSON body" }); }
    if (typeof b.user !== "string" || !b.user.trim() || b.user.length > 20000 || (b.system != null && (typeof b.system !== "string" || b.system.length > 20000)))
      return send(res, 400, { error: "Invalid prompt" });
    const args = { system: b.system || "", user: b.user, json: !!b.json, maxTokens: Math.min(Math.max(+b.maxTokens || 1200, 100), 4096), temperature: Math.min(Math.max(b.temperature ?? 0.4, 0), 1) };
    try {
      let used = cfg, text;
      try { text = await callProvider(cfg, env, args, fetchImpl); } catch (err) {
        const fallback = cfg.provider === "groq" && (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) ? resolveProvider({...env, AI_PROVIDER:"gemini"}) : cfg.provider !== "ollama" && env.OLLAMA_MODEL ? {provider:"ollama", model:env.OLLAMA_MODEL} : null;
        if (!fallback) throw err;
        used = fallback;
        text = await callProvider(used, env, args, fetchImpl);
      }
      return send(res, 200, { text, provider: used.provider, model: used.model });
    } catch (e) {
      return send(res, 502, { error: `AI provider error: ${String(e.message || e).slice(0, 300)}` });
    }
  };
}

export default function aiProxy() {
  let cfg = { mode: "development", root: process.cwd() };
  const attach = (server) => { server.middlewares.use("/api", createHandler(() => ({ ...loadEnv(cfg.mode, cfg.root, ""), ...process.env }))); };
  return {
    name: "lingua-ai-proxy",
    configResolved(c) { cfg = { mode: c.mode, root: c.root }; },
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
