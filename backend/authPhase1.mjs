import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile, writeJsonFileAtomic } from "./jsonStore.mjs";

const ROLE_PERMS = {
  super_admin: ["*"],
  admin: ["execute:*", "approvals:*"],
  operator: ["execute:run", "execute:read", "approvals:request"],
  viewer: ["execute:read"],
};

const AUTH_DIR = path.resolve(process.cwd(), "backend", ".data");
const AUTH_SECRET_FILE = path.join(AUTH_DIR, "auth-secret.json");
const DEV_TOKEN_TTL_MS = Number(process.env.AGENT_DEV_TOKEN_TTL_MS || 8 * 60 * 60 * 1000);

function ensureDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getSigningSecret() {
  const envSecret = String(process.env.AGENT_AUTH_SECRET || "").trim();
  if (envSecret) return envSecret;
  ensureDir();
  try {
    const parsed = readJsonFile(AUTH_SECRET_FILE, {});
    const existing = String(parsed?.secret || "").trim();
    if (existing) return existing;
  } catch {
    // fall through to generate
  }
  const secret = crypto.randomBytes(32).toString("base64url");
  writeJsonFileAtomic(AUTH_SECRET_FILE, { secret, created_at: new Date().toISOString() }, { backup: true });
  return secret;
}

function signTokenParts(headerPart, payloadPart) {
  const unsigned = `${headerPart}.${payloadPart}`;
  return crypto.createHmac("sha256", getSigningSecret()).update(unsigned).digest("base64url");
}

function hasPerm(perms, required) {
  if (perms.includes("*")) return true;
  if (perms.includes(required)) return true;
  const domain = required.split(":")[0];
  return perms.includes(domain + ":*");
}

function normalizeUser(user = {}) {
  return {
    user_id: String(user?.user_id || "local-user").trim() || "local-user",
    tenant_id: String(user?.tenant_id || "local-tenant").trim() || "local-tenant",
    role: String(user?.role || "viewer").trim() || "viewer",
    name: String(user?.name || "").trim(),
  };
}

export function parseAuth(req) {
  const required = String(process.env.AGENT_AUTH_REQUIRED || "true") !== "false";
  if (!required) return { ok: true, user: normalizeUser({ user_id: "local-user", role: "admin", name: "Local Admin" }) };

  const raw = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!raw) return { ok: false, code: 401, error: "Unauthorized" };

  const parts = raw.split(".");
  if (parts.length !== 3) return { ok: false, code: 401, error: "Invalid token" };

  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = signTokenParts(headerPart, payloadPart);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signaturePart || "");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false, code: 401, error: "Invalid token signature" };
  }

  const payload = safeJsonParse(base64urlDecode(payloadPart), null);
  if (!payload || typeof payload !== "object") return { ok: false, code: 401, error: "Invalid token payload" };
  if (payload.exp && Date.now() >= Number(payload.exp)) return { ok: false, code: 401, error: "Token expired" };
  return { ok: true, user: normalizeUser(payload) };
}

export function authorize(user, required = "execute:run") {
  const perms = ROLE_PERMS[user?.role || "viewer"] || ROLE_PERMS.viewer;
  return hasPerm(perms, required) ? { ok: true } : { ok: false, code: 403, error: "Forbidden" };
}

export function issueDevToken(user = { user_id: "local-user", role: "admin" }) {
  const normalized = normalizeUser(user);
  const headerPart = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = base64urlEncode(
    JSON.stringify({
      ...normalized,
      iss: "nexus-ai-run",
      aud: "local-dev",
      iat: Date.now(),
      exp: Date.now() + DEV_TOKEN_TTL_MS,
    })
  );
  const signaturePart = signTokenParts(headerPart, payloadPart);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}
