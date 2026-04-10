import { getState, updateState, nowIso, makeId } from "./controlState.mjs";

function ensureUserState() {
  const s = getState();
  const hasRoot = s.user_data && typeof s.user_data === "object";
  const hasProfiles = hasRoot && s.user_data.profiles && typeof s.user_data.profiles === "object";
  const hasFavorites = hasRoot && s.user_data.favorites && typeof s.user_data.favorites === "object";
  const hasPersonalization = hasRoot && s.user_data.personalization && typeof s.user_data.personalization === "object";
  const hasPresets = hasRoot && s.user_data.tool_presets && typeof s.user_data.tool_presets === "object";

  if (hasRoot && hasProfiles && hasFavorites && hasPersonalization && hasPresets) return;

  updateState((state) => {
    const current = state.user_data && typeof state.user_data === "object" ? state.user_data : {};
    state.user_data = {
      profiles: current.profiles && typeof current.profiles === "object" ? current.profiles : {},
      favorites: current.favorites && typeof current.favorites === "object" ? current.favorites : {},
      personalization: current.personalization && typeof current.personalization === "object" ? current.personalization : {},
      tool_presets: current.tool_presets && typeof current.tool_presets === "object" ? current.tool_presets : {},
    };
  });
}

function userKey(userId = "local-user") {
  return String(userId || "local-user");
}

function legacyKeysFor(userId = "local-user") {
  const key = userKey(userId);
  return key === "local-admin" ? [] : ["local-admin"];
}

function readWithLegacyFallback(bucket = {}, userId = "local-user", fallbackFactory = () => null) {
  const key = userKey(userId);
  if (bucket && Object.prototype.hasOwnProperty.call(bucket, key)) return bucket[key];
  for (const legacyKey of legacyKeysFor(userId)) {
    if (bucket && Object.prototype.hasOwnProperty.call(bucket, legacyKey)) return bucket[legacyKey];
  }
  return fallbackFactory();
}

function safeProfile(input = {}) {
  return {
    full_name: String(input.full_name || "Local User"),
    timezone: String(input.timezone || "Australia/Adelaide"),
    language: String(input.language || "en"),
    role: String(input.role || "admin"),
    settings: typeof input.settings === "object" && input.settings ? input.settings : {},
    updated_at: nowIso(),
  };
}

function safeFavorites(arr = []) {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))).slice(0, 500);
}

function safePersonalization(input = {}) {
  return {
    brandVoice: String(input.brandVoice || input.brand_voice || "professional"),
    objective: String(input.objective || "growth"),
    channels: String(input.channels || "email,social,web"),
    autonomyTier: String(input.autonomyTier || input.autonomy_tier || "approve"),
    updated_at: nowIso(),
  };
}

function safePreset(input = {}) {
  return {
    id: String(input.id || makeId("preset")),
    agent_id: String(input.agent_id || "nexus"),
    name: String(input.name || "Untitled Preset"),
    capability_id: String(input.capability_id || ""),
    payload: typeof input.payload === "object" && input.payload ? input.payload : {},
    updated_at: nowIso(),
  };
}

export function getUserProfile(userId = "local-user") {
  ensureUserState();
  const s = getState();
  return readWithLegacyFallback(s.user_data.profiles, userId, () => safeProfile({})) || safeProfile({});
}

export function setUserProfile(userId = "local-user", profile = {}) {
  ensureUserState();
  const key = userKey(userId);
  let out = null;
  updateState((s) => {
    const prev = s.user_data.profiles[key] || safeProfile({});
    out = { ...prev, ...safeProfile({ ...prev, ...profile }) };
    s.user_data.profiles[key] = out;
  });
  return out;
}

export function getUserFavorites(userId = "local-user") {
  ensureUserState();
  const s = getState();
  return safeFavorites(readWithLegacyFallback(s.user_data.favorites, userId, () => []));
}

export function setUserFavorites(userId = "local-user", favorites = []) {
  ensureUserState();
  const key = userKey(userId);
  const next = safeFavorites(favorites);
  updateState((s) => {
    s.user_data.favorites[key] = next;
  });
  return next;
}

export function getUserPersonalization(userId = "local-user", agentId = "nexus") {
  ensureUserState();
  const key = userKey(userId);
  const aid = String(agentId || "nexus");
  const s = getState();
  const current = s.user_data.personalization?.[key]?.[aid];
  if (current) return safePersonalization(current);
  for (const legacyKey of legacyKeysFor(userId)) {
    const legacy = s.user_data.personalization?.[legacyKey]?.[aid];
    if (legacy) return safePersonalization(legacy);
  }
  return safePersonalization({});
}

export function setUserPersonalization(userId = "local-user", agentId = "nexus", payload = {}) {
  ensureUserState();
  const key = userKey(userId);
  const aid = String(agentId || "nexus");
  const next = safePersonalization(payload || {});
  updateState((s) => {
    s.user_data.personalization[key] = s.user_data.personalization[key] || {};
    s.user_data.personalization[key][aid] = next;
  });
  return next;
}

export function listUserToolPresets(userId = "local-user", agentId = "") {
  ensureUserState();
  const s = getState();
  const all = readWithLegacyFallback(s.user_data.tool_presets, userId, () => []);
  const normalized = Array.isArray(all) ? all : [];
  if (!agentId) return all;
  const aid = String(agentId || "");
  return normalized.filter((p) => String(p.agent_id) === aid);
}

export function upsertUserToolPreset(userId = "local-user", preset = {}) {
  ensureUserState();
  const key = userKey(userId);
  const clean = safePreset(preset || {});
  let out = null;
  updateState((s) => {
    s.user_data.tool_presets[key] = s.user_data.tool_presets[key] || [];
    const idx = s.user_data.tool_presets[key].findIndex((x) => String(x.id) === String(clean.id));
    if (idx >= 0) s.user_data.tool_presets[key][idx] = { ...s.user_data.tool_presets[key][idx], ...clean };
    else s.user_data.tool_presets[key].unshift(clean);
    s.user_data.tool_presets[key] = s.user_data.tool_presets[key].slice(0, 500);
    out = clean;
  });
  return out;
}

export function deleteUserToolPreset(userId = "local-user", presetId = "") {
  ensureUserState();
  const key = userKey(userId);
  const pid = String(presetId || "");
  let removed = false;
  updateState((s) => {
    s.user_data.tool_presets[key] = s.user_data.tool_presets[key] || [];
    const prev = s.user_data.tool_presets[key].length;
    s.user_data.tool_presets[key] = s.user_data.tool_presets[key].filter((x) => String(x.id) !== pid);
    removed = s.user_data.tool_presets[key].length < prev;
  });
  return { removed, preset_id: pid };
}


