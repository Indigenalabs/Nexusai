import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readJsonFile, writeJsonFileAtomic } from "./jsonStore.mjs";

const FILE = path.resolve(process.cwd(), "backend", ".data", "ai-providers.json");
const SECRET_FILE = path.resolve(process.cwd(), "backend", ".data", "ai-provider-secrets.json");
const DEFAULTS = {
  chat: {
    provider: "fallback",
    model: "gemini-2.5-flash",
    model_lite: "gemini-2.5-flash-lite",
    model_standard: "gemini-2.5-flash",
    model_premium: "gemini-2.5-pro",
    api_key: "",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  image: {
    provider: "fallback",
    model: "gpt-image-1.5",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    size: "1024x1024",
    quality: "high",
  },
  voice: {
    provider: "fallback",
    model: "gpt-4o-mini-tts",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    voice: "alloy",
  },
  video: {
    provider: "fallback",
    model: "sora-1",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    quality: "high",
  },
  agent_overrides: {},
};

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safe(value = "") {
  return String(value || "").trim();
}

function compactLines(lines = []) {
  return lines.map((line) => safe(line)).filter(Boolean).join("\n");
}

export function normalizeProviderAgentId(agent = "") {
  const s = safe(agent).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!s) return "";
  if (s === "supportsage" || s === "support-sage") return "support-sage";
  return s;
}

function providerSupportsKeyless(kind = "chat", provider = "fallback") {
  const target = ["image", "voice", "video"].includes(kind) ? kind : "chat";
  const value = safe(provider).toLowerCase();
  if (target === "chat") return value === "ollama";
  if (target === "image") return value === "pollinations" || value === "automatic1111";
  return false;
}

function readStore() {
  return readJsonFile(FILE, DEFAULTS, (value = {}, parsed = value) => ({
    chat: { ...structuredClone(DEFAULTS.chat), ...((parsed && parsed.chat) || value.chat || {}) },
    image: { ...structuredClone(DEFAULTS.image), ...((parsed && parsed.image) || value.image || {}) },
    voice: { ...structuredClone(DEFAULTS.voice), ...((parsed && parsed.voice) || value.voice || {}) },
    video: { ...structuredClone(DEFAULTS.video), ...((parsed && parsed.video) || value.video || {}) },
    agent_overrides: parsed?.agent_overrides || value.agent_overrides || {},
  }));
}

let store = readStore();

function defaultSecrets() {
  return {
    chat: { api_key: "" },
    image: { api_key: "" },
    voice: { api_key: "" },
    video: { api_key: "" },
  };
}

function protectSecret(value = "") {
  const secret = safe(value);
  if (!secret) return "";
  if (process.platform !== "win32") return secret;
  try {
    return execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(ConvertTo-SecureString $env:CODEX_SECRET_VALUE -AsPlainText -Force | ConvertFrom-SecureString)",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, CODEX_SECRET_VALUE: secret },
      },
    ).trim();
  } catch {
    return "";
  }
}

function unprotectSecret(value = "", encrypted = false) {
  const raw = safe(value);
  if (!raw) return "";
  if (!encrypted || process.platform !== "win32") return raw;
  try {
    return execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$secure = ConvertTo-SecureString $env:CODEX_SECRET_BLOB; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, CODEX_SECRET_BLOB: raw },
      },
    ).trim();
  } catch {
    return "";
  }
}

function readSecrets() {
  const parsed = readJsonFile(SECRET_FILE, { encrypted: false, ...defaultSecrets() });
  const encrypted = Boolean(parsed?.encrypted);
  return {
    chat: { api_key: unprotectSecret(parsed?.chat?.api_key || "", encrypted) },
    image: { api_key: unprotectSecret(parsed?.image?.api_key || "", encrypted) },
    voice: { api_key: unprotectSecret(parsed?.voice?.api_key || "", encrypted) },
    video: { api_key: unprotectSecret(parsed?.video?.api_key || "", encrypted) },
  };
}

let secrets = readSecrets();

function persist() {
  ensureDir();
  writeJsonFileAtomic(FILE, store, { backup: true });
  const encryptedSecrets = {
    encrypted: process.platform === "win32",
    chat: { api_key: protectSecret(secrets.chat?.api_key || "") || "" },
    image: { api_key: protectSecret(secrets.image?.api_key || "") || "" },
    voice: { api_key: protectSecret(secrets.voice?.api_key || "") || "" },
    video: { api_key: protectSecret(secrets.video?.api_key || "") || "" },
  };
  writeJsonFileAtomic(SECRET_FILE, encryptedSecrets, { backup: true });
}

function migrateInlineSecrets() {
  let changed = false;
  ["chat", "image", "voice", "video"].forEach((kind) => {
    const inlineKey = safe(store?.[kind]?.api_key || "");
    if (inlineKey && !safe(secrets?.[kind]?.api_key || "")) {
      secrets[kind] = { api_key: inlineKey };
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(store?.[kind] || {}, "api_key") && inlineKey) {
      store[kind] = { ...store[kind], api_key: "" };
      changed = true;
    }
  });
  if (changed) persist();
}

migrateInlineSecrets();

function resolveConfigured(key = "chat", agentId = "") {
  const normalizedKey = ["chat", "image", "voice", "video"].includes(key) ? key : "chat";
  const normalizedAgentId = normalizeProviderAgentId(agentId);
  const baseConfig = store?.[normalizedKey] || {};
  const agentOverride = normalizedAgentId ? (store?.agent_overrides?.[normalizedAgentId]?.[normalizedKey] || {}) : {};
  const local = { ...baseConfig, ...agentOverride };
  const explicitProvider = safe(local.provider).toLowerCase();
  let provider = explicitProvider;

  if (!provider) {
    if (normalizedKey === "chat" && (safe(process.env.OLLAMA_BASE_URL) || safe(process.env.OLLAMA_CHAT_MODEL))) provider = "ollama";
    else if (normalizedKey === "chat" && safe(process.env.GEMINI_API_KEY)) provider = "gemini";
    else if (normalizedKey === "image" && (safe(process.env.A1111_BASE_URL) || safe(process.env.SD_WEBUI_BASE_URL))) provider = "automatic1111";
    else if (normalizedKey === "image" && safe(process.env.POLLINATIONS_BASE_URL)) provider = "pollinations";
    else if (
      (normalizedKey === "chat" && safe(process.env.OPENAI_API_KEY)) ||
      (normalizedKey === "image" && safe(process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY)) ||
      (normalizedKey === "voice" && safe(process.env.OPENAI_API_KEY)) ||
      (normalizedKey === "video" && safe(process.env.OPENAI_API_KEY))
    ) provider = "openai";
    else provider = "fallback";
  }

  let envApiKey = "";
  let envModel = "";
  let envBase = "";
  let envExtra = {};

  if (provider === "openai") {
    envApiKey = normalizedKey === "image"
      ? safe(process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY)
      : safe(process.env.OPENAI_API_KEY);
    envModel = normalizedKey === "chat"
      ? safe(process.env.OPENAI_CHAT_MODEL)
      : normalizedKey === "image"
        ? safe(process.env.OPENAI_IMAGE_MODEL)
        : normalizedKey === "voice"
          ? safe(process.env.OPENAI_VOICE_MODEL)
          : safe(process.env.OPENAI_VIDEO_MODEL);
    envBase = normalizedKey === "image"
      ? safe(process.env.OPENAI_IMAGE_BASE_URL || process.env.OPENAI_BASE_URL)
      : safe(process.env.OPENAI_BASE_URL);
  } else if (provider === "gemini" && normalizedKey === "chat") {
    envApiKey = safe(process.env.GEMINI_API_KEY);
    envModel = safe(process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash");
    envBase = safe(process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/");
  } else if (provider === "ollama" && normalizedKey === "chat") {
    envModel = safe(process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b-instruct");
    envBase = safe(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1");
  } else if (provider === "pollinations" && normalizedKey === "image") {
    envModel = safe(process.env.POLLINATIONS_IMAGE_MODEL || "pollinations");
    envBase = safe(process.env.POLLINATIONS_BASE_URL || "https://image.pollinations.ai");
  } else if (provider === "automatic1111" && normalizedKey === "image") {
    envModel = safe(process.env.A1111_MODEL || process.env.SD_WEBUI_MODEL);
    envBase = safe(process.env.A1111_BASE_URL || process.env.SD_WEBUI_BASE_URL || "http://127.0.0.1:7860");
  }

  if (normalizedKey === "voice") envExtra.voice = safe(local.voice || process.env.OPENAI_TTS_VOICE || DEFAULTS.voice.voice);
  if (normalizedKey === "video") envExtra.quality = safe(local.quality || process.env.OPENAI_VIDEO_QUALITY || DEFAULTS.video.quality);
  if (normalizedKey === "image") {
    envExtra.size = safe(local.size || process.env.OPENAI_IMAGE_SIZE || DEFAULTS.image.size);
    envExtra.quality = safe(local.quality || process.env.OPENAI_IMAGE_QUALITY || DEFAULTS.image.quality);
  }

  return {
    ...structuredClone(DEFAULTS[normalizedKey]),
    ...baseConfig,
    ...agentOverride,
    provider,
    model: safe(local.model || envModel || DEFAULTS[normalizedKey].model),
    base_url: safe(local.base_url || envBase || DEFAULTS[normalizedKey].base_url),
    api_key: safe(secrets?.[normalizedKey]?.api_key || envApiKey),
    ...envExtra,
  };
}

export function getResolvedAiProviderConfig(kind = "chat", agentId = "") {
  return resolveConfigured(kind, agentId);
}

const AGENT_DEFAULT_CHAT_TIER = {
  nexus: "premium",
  sage: "premium",
  veritas: "premium",
  centsible: "premium",
  maestro: "standard",
  prospect: "standard",
  "support-sage": "standard",
  pulse: "standard",
  merchant: "standard",
  canvas: "standard",
  inspect: "standard",
  atlas: "standard",
  compass: "standard",
  part: "standard",
  sentinel: "standard",
  chronos: "standard",
  scribe: "standard",
};

function pickConfiguredChatTier(agentId = "", userText = "", input = {}) {
  const agentKey = normalizeProviderAgentId(agentId);
  const text = safe(userText).toLowerCase();
  const domain = safe(input.domain).toLowerCase();
  const greetingSignals = [
    /^(hi|hello|hey|yo|hiya|howdy)\b/,
    /^good (morning|afternoon|evening)\b/,
  ];
  const premiumSignals = [
    /strategy|strategic|tradeoff|compare|which is better|board|fundraising|scenario|what-if|forecast|sensitivity/,
    /contract|msa|nda|privacy|gdpr|regulation|legal|risk score|compliance/,
    /capital allocation|runway|pricing strategy|cash flow|financial model|settlement|litigation/,
    /conflict|escalation|root cause|why do you recommend|challenge that|devil's advocate/,
  ];
  const liteSignals = [
    /classify|tag|extract|detect|parse|categorize|categorise|route|label/,
    /status|health check|list|show metrics|dashboard|log|track/,
  ];
  if (greetingSignals.some((rx) => rx.test(text))) return agentKey === "nexus" ? "standard" : "lite";
  if (premiumSignals.some((rx) => rx.test(text))) return "premium";
  if (liteSignals.some((rx) => rx.test(text)) && !/why|recommend|strategy|risk|tradeoff/.test(text)) return "lite";
  if (["legal", "finance", "strategy"].includes(domain) && /recommend|plan|compare|risk|strategy/.test(text)) return "premium";
  return AGENT_DEFAULT_CHAT_TIER[agentKey] || "standard";
}

function resolveChatModelForTier(configured = {}, tier = "standard") {
  const provider = safe(configured.provider).toLowerCase();
  if (!provider || provider === "fallback") return safe(configured.model || DEFAULTS.chat.model);
  if (provider === "gemini") {
    const lite = safe(configured.model_lite || process.env.GEMINI_CHAT_MODEL_LITE || "gemini-2.5-flash-lite");
    const standard = safe(configured.model_standard || process.env.GEMINI_CHAT_MODEL_STANDARD || process.env.GEMINI_CHAT_MODEL || configured.model || "gemini-2.5-flash");
    const premium = safe(configured.model_premium || process.env.GEMINI_CHAT_MODEL_PREMIUM || "gemini-2.5-pro");
    if (tier === "lite") return lite || standard;
    if (tier === "premium") return premium || standard;
    return standard;
  }
  if (provider === "openai") {
    const lite = safe(configured.model_lite || process.env.OPENAI_CHAT_MODEL_LITE || "");
    const standard = safe(configured.model_standard || process.env.OPENAI_CHAT_MODEL_STANDARD || process.env.OPENAI_CHAT_MODEL || configured.model || DEFAULTS.chat.model);
    const premium = safe(configured.model_premium || process.env.OPENAI_CHAT_MODEL_PREMIUM || "");
    if (tier === "lite") return lite || standard;
    if (tier === "premium") return premium || standard;
    return standard;
  }
  if (provider === "ollama") {
    const lite = safe(configured.model_lite || process.env.OLLAMA_CHAT_MODEL_LITE || "");
    const standard = safe(configured.model_standard || process.env.OLLAMA_CHAT_MODEL_STANDARD || process.env.OLLAMA_CHAT_MODEL || configured.model || "llama3.1:8b-instruct");
    const premium = safe(configured.model_premium || process.env.OLLAMA_CHAT_MODEL_PREMIUM || "");
    if (tier === "lite") return lite || standard;
    if (tier === "premium") return premium || standard;
    return standard;
  }
  return safe(configured.model || DEFAULTS.chat.model);
}

export function getChatRoutingDecision(input = {}) {
  const agentId = input.agentId || input.agentName || "";
  const configured = getResolvedAiProviderConfig("chat", agentId);
  const tier = pickConfiguredChatTier(agentId, input.userText || "", input);
  const provider = safe(configured.provider || "fallback");
  const isUsable = provider !== "fallback" && (Boolean(safe(configured.api_key)) || providerSupportsKeyless("chat", provider));
  const model = isUsable
    ? resolveChatModelForTier(configured, tier)
    : safe(DEFAULTS.chat.model);
  return {
    provider: isUsable ? provider : "fallback",
    tier,
    model,
  };
}

function toPublic(providerConfig = {}, kind = "chat") {
  const provider = safe(providerConfig.provider || "fallback");
  return {
    provider,
    model: safe(providerConfig.model || ""),
    base_url: safe(providerConfig.base_url || ""),
    configured: provider !== "fallback" && (Boolean(safe(providerConfig.api_key)) || providerSupportsKeyless(kind, provider)),
    api_key_present: Boolean(safe(providerConfig.api_key)),
    api_key_masked: safe(providerConfig.api_key) ? `****${safe(providerConfig.api_key).slice(-4)}` : "",
    size: safe(providerConfig.size || ""),
    quality: safe(providerConfig.quality || ""),
    voice: safe(providerConfig.voice || ""),
  };
}

export function getAiProviderStatus(agentId = "") {
  const normalizedAgentId = normalizeProviderAgentId(agentId);
  const chat = resolveConfigured("chat", normalizedAgentId);
  const image = resolveConfigured("image", normalizedAgentId);
  const voice = resolveConfigured("voice", normalizedAgentId);
  const video = resolveConfigured("video", normalizedAgentId);
  return {
    chat: toPublic(chat, "chat"),
    image: toPublic(image, "image"),
    voice: toPublic(voice, "voice"),
    video: toPublic(video, "video"),
    agent_id: normalizedAgentId || "",
    timestamp: new Date().toISOString(),
  };
}

export function getAiProviderSettings() {
  const chat = resolveConfigured("chat");
  const image = resolveConfigured("image");
  const voice = resolveConfigured("voice");
  const video = resolveConfigured("video");
  return {
    chat: toPublic(chat, "chat"),
    image: toPublic(image, "image"),
    voice: toPublic(voice, "voice"),
    video: toPublic(video, "video"),
    editable: {
      chat: {
        provider: safe(store.chat.provider || chat.provider),
        model: safe(store.chat.model || chat.model),
        model_lite: safe(store.chat.model_lite || chat.model_lite),
        model_standard: safe(store.chat.model_standard || chat.model_standard || chat.model),
        model_premium: safe(store.chat.model_premium || chat.model_premium),
        base_url: safe(store.chat.base_url || chat.base_url),
        api_key: "",
        api_key_present: Boolean(safe(chat.api_key || "")),
        api_key_masked: safe(chat.api_key || "") ? `****${safe(chat.api_key || "").slice(-4)}` : "",
      },
      image: {
        provider: safe(store.image.provider || image.provider),
        model: safe(store.image.model || image.model),
        base_url: safe(store.image.base_url || image.base_url),
        api_key: "",
        api_key_present: Boolean(safe(image.api_key || "")),
        api_key_masked: safe(image.api_key || "") ? `****${safe(image.api_key || "").slice(-4)}` : "",
        size: safe(store.image.size || image.size),
        quality: safe(store.image.quality || image.quality),
      },
      voice: {
        provider: safe(store.voice.provider || voice.provider),
        model: safe(store.voice.model || voice.model),
        base_url: safe(store.voice.base_url || voice.base_url),
        api_key: "",
        api_key_present: Boolean(safe(voice.api_key || "")),
        api_key_masked: safe(voice.api_key || "") ? `****${safe(voice.api_key || "").slice(-4)}` : "",
        voice: safe(store.voice.voice || voice.voice),
      },
      video: {
        provider: safe(store.video.provider || video.provider),
        model: safe(store.video.model || video.model),
        base_url: safe(store.video.base_url || video.base_url),
        api_key: "",
        api_key_present: Boolean(safe(video.api_key || "")),
        api_key_masked: safe(video.api_key || "") ? `****${safe(video.api_key || "").slice(-4)}` : "",
        quality: safe(store.video.quality || video.quality),
      },
      agent_overrides: store.agent_overrides || {},
    },
    timestamp: new Date().toISOString(),
  };
}

function mergeProviderConfig(existing = {}, incoming = {}) {
  const next = { ...existing, ...(incoming || {}) };
  delete next.api_key;
  delete next.clear_api_key;
  return next;
}

export function saveAiProviderSettings(patch = {}) {
  const next = patch && typeof patch === "object" ? patch : {};
  store = {
    chat: mergeProviderConfig(store.chat, (next.chat && typeof next.chat === "object") ? next.chat : {}),
    image: mergeProviderConfig(store.image, (next.image && typeof next.image === "object") ? next.image : {}),
    voice: mergeProviderConfig(store.voice, (next.voice && typeof next.voice === "object") ? next.voice : {}),
    video: mergeProviderConfig(store.video, (next.video && typeof next.video === "object") ? next.video : {}),
    agent_overrides: {
      ...(store.agent_overrides || {}),
      ...((next.agent_overrides && typeof next.agent_overrides === "object") ? next.agent_overrides : {}),
    },
  };
  ["chat", "image", "voice", "video"].forEach((kind) => {
    const incoming = next?.[kind];
    if (!incoming || typeof incoming !== "object") return;
    const candidate = safe(incoming.api_key);
    if (candidate) {
      secrets[kind] = { api_key: candidate };
    } else if (incoming.clear_api_key) {
      secrets[kind] = { api_key: "" };
    }
  });
  persist();
  return getAiProviderSettings();
}

async function openAiCompatibleChat(messages = [], options = {}) {
  const configured = resolveConfigured("chat", options.agentId || "");
  if (configured.provider === "fallback") return null;
  if (!configured.api_key && !providerSupportsKeyless("chat", configured.provider)) return null;
  const model = safe(options.model || configured.model || DEFAULTS.chat.model);
  const baseUrl = safe(configured.base_url || DEFAULTS.chat.base_url).replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
  };
  if (configured.api_key) headers.Authorization = `Bearer ${configured.api_key}`;
  if (safe(configured.provider).toLowerCase() === "gemini") headers["x-goog-api-client"] = "nexus-ai-run/1.0";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: Number.isFinite(options.temperature) ? options.temperature : 0.6,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${configured.provider} chat failed (${res.status}): ${detail || "request failed"}`);
  }
  const json = await res.json();
  return safe(json?.choices?.[0]?.message?.content || "");
}

export async function testAiProvider(kind = "chat", agentId = "") {
  const target = ["image", "voice", "video"].includes(kind) ? kind : "chat";
  const configured = resolveConfigured(target, agentId);

  if (target === "chat") {
    if (configured.provider === "fallback") {
      return {
        ok: false,
        kind: "chat",
        provider: "fallback",
        reason: "No live chat provider configured",
        timestamp: new Date().toISOString(),
      };
    }
    try {
      const reply = await openAiCompatibleChat([
        { role: "system", content: "Reply with the single word: healthy" },
        { role: "user", content: "health check" },
      ], { model: configured.model, temperature: 0, agentId });
      return {
        ok: /healthy/i.test(reply),
        kind: "chat",
        provider: configured.provider,
        model: configured.model,
        reply,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        kind: "chat",
        provider: configured.provider || "fallback",
        model: configured.model,
        reason: String(err?.message || err || "Chat provider unavailable"),
        timestamp: new Date().toISOString(),
      };
    }
  }

  if (target === "image" && configured.provider === "pollinations") {
    return {
      ok: true,
      kind: "image",
      provider: "pollinations",
      model: configured.model || "pollinations",
      reason: "Pollinations endpoint configured",
      timestamp: new Date().toISOString(),
    };
  }

  if (target === "image" && configured.provider === "automatic1111") {
    try {
      const baseUrl = safe(configured.base_url || "http://127.0.0.1:7860").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/sdapi/v1/sd-models`, { method: "GET" });
      if (!res.ok) throw new Error(`Automatic1111 responded ${res.status}`);
      const json = await res.json().catch(() => []);
      return {
        ok: true,
        kind: "image",
        provider: "automatic1111",
        model: configured.model || (Array.isArray(json) && json[0]?.model_name) || "automatic1111",
        reason: "Automatic1111 endpoint reachable",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        kind: "image",
        provider: "automatic1111",
        model: configured.model,
        reason: String(err?.message || err || "Automatic1111 unavailable"),
        timestamp: new Date().toISOString(),
      };
    }
  }

  if (target === "voice" || target === "video" || target === "image") {
    if (configured.provider === "fallback") {
      return {
        ok: false,
        kind: target,
        provider: "fallback",
        reason: `No live ${target} provider configured`,
        timestamp: new Date().toISOString(),
      };
    }
    if (configured.provider === "openai" && !configured.api_key) {
      return {
        ok: false,
        kind: target,
        provider: configured.provider,
        reason: "OpenAI API key is required",
        timestamp: new Date().toISOString(),
      };
    }
    return {
      ok: true,
      kind: target,
      provider: configured.provider,
      model: configured.model,
      reason: "Configuration present",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    kind: target,
    provider: configured.provider || "fallback",
    reason: `No live ${target} provider configured`,
    timestamp: new Date().toISOString(),
  };
}

export async function generateAgentInsightReply(input = {}) {
  const status = getAiProviderStatus(input.agentId || "");
  if (!status.chat.configured) return null;
  const routing = getChatRoutingDecision(input);
  const tier = routing.tier;
  const routedModel = routing.model;

  const system = compactLines([
    "You are a deeply specialized business agent inside an AI operating system.",
    `Agent: ${safe(input.agentName)}`,
    `Domain: ${safe(input.domain)}`,
    `Model routing tier for this turn: ${tier}.`,
    "Behave like a real operator in that specialty, not a command router.",
    "Use the supplied business context, memory, and evidence.",
    "Treat business profile, memory, and operating context as silent background context.",
    "Do not echo internal labels such as 'Business context', 'Channels and markets', 'Remembered priorities', or 'Working style' unless the user explicitly asks for a recap.",
    "Only mention profile or memory details when they materially change the recommendation, and then weave them in naturally rather than listing them.",
    "Do not mention being an AI model or list quick options unless directly helpful.",
    "Be conversational, insightful, and practical.",
    "Keep the response grounded in operating signals, likely causes, tradeoffs, and next moves.",
    "Where relevant, tie recommendations to the concrete agent actions or capabilities provided.",
    "If there is evidence, reference it naturally.",
    "If the user is exploratory, do not force execution.",
    "Answer in plain text with short paragraphs or light numbered steps when useful.",
  ]);

  const backgroundContext = compactLines([
    input.businessIdentity ? safe(input.businessIdentity) : "",
    input.businessFocus ? safe(input.businessFocus) : "",
    input.businessOffer ? safe(input.businessOffer) : "",
    input.businessAudience ? safe(input.businessAudience) : "",
    input.businessStrategy ? safe(input.businessStrategy) : "",
    input.businessChannels ? safe(input.businessChannels) : "",
    input.businessEconomics ? safe(input.businessEconomics) : "",
    input.businessBrand ? safe(input.businessBrand) : "",
    input.businessRisk ? safe(input.businessRisk) : "",
    input.businessOps ? safe(input.businessOps) : "",
    input.industryOverlay ? safe(input.industryOverlay) : "",
    input.memoryPriorities ? safe(input.memoryPriorities) : "",
    input.memoryConcerns ? safe(input.memoryConcerns) : "",
    input.memoryPreferences ? safe(input.memoryPreferences) : "",
    input.memoryReferences ? safe(input.memoryReferences) : "",
    input.specialtyRelevance ? safe(input.specialtyRelevance) : "",
    input.specialtyLens ? safe(input.specialtyLens) : "",
    input.specialtySignals ? safe(input.specialtySignals) : "",
    input.specialtyHeuristic ? safe(input.specialtyHeuristic) : "",
    input.recommendedActions ? safe(input.recommendedActions) : "",
    input.executionPath ? safe(input.executionPath) : "",
    input.taskHint ? safe(input.taskHint) : "",
    input.constraints ? safe(input.constraints) : "",
    input.changeDecision ? safe(input.changeDecision) : "",
    input.changeDiagnosis ? safe(input.changeDiagnosis) : "",
    input.evidenceLine ? safe(input.evidenceLine) : "",
    input.planFrame?.length ? input.planFrame.join(" -> ") : "",
  ]);

  const user = compactLines([
    `User message: ${safe(input.userText)}`,
    backgroundContext ? `Background context for reasoning only: ${backgroundContext}` : "",
  ]);

  const content = await openAiCompatibleChat([
    { role: "system", content: system },
    { role: "user", content: user },
  ], { agentId: input.agentId || "", model: routedModel });

  return sanitizeAgentInsightReply(content || "");
}

function sanitizeAgentInsightReply(text = "") {
  const cleaned = String(text || "")
    .replace(/\bBusiness context:\s*/gi, "")
    .replace(/\bChannels and markets:\s*/gi, "")
    .replace(/\bRemembered priorities:\s*/gi, "")
    .replace(/\bRemembered concerns:\s*/gi, "")
    .replace(/\bWorking style:\s*/gi, "")
    .replace(/\bReference assets:\s*/gi, "")
    .replace(/\bBusiness priority:\s*/gi, "")
    .replace(/\bOffer and positioning:\s*/gi, "")
    .replace(/\bAudience focus:\s*/gi, "")
    .replace(/\bCommercial guardrails:\s*/gi, "")
    .replace(/\bBrand direction:\s*/gi, "")
    .replace(/\bOperating context:\s*/gi, "")
    .replace(/\bOperating notes:\s*/gi, "")
    .replace(/\bCurrent task:\s*/gi, "")
    .replace(/\bSignals to watch:\s*/gi, "")
    .replace(/\bUseful heuristic:\s*/gi, "")
    .replace(/\bThe real challenge usually is not just getting attention\.\s*/gi, "The real challenge is not just getting attention. ")
    .replace(/\bI(?:'|’)m keeping approvals in view,\s*/gi, "")
    .replace(/\bI(?:'|’)m also noticing a pattern around burnout,\s*/gi, "")
    .replace(/\band I know you prefer risk-aware\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}
