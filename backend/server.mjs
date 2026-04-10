import http from "node:http";
import {
  invokeFunction,
  getDiagnostics,
  listAgentRegistry,
  listCapabilities,
  capabilityAudit,
  deterministicImplementationAudit,
  getChatSchemaRegistry,
  setChatSchemaRegistry,
  listChatSchemaHistory,
  rollbackChatSchemaRegistry,
  listManifest,
  listEvents,
  listWorkflows,
  createConversation,
  getConversation,
  addConversationMessage,
  loadAgentMemory,
  saveAgentMemory,
} from "./runtime.mjs";
import { getAiProviderSettings, getAiProviderStatus, getResolvedAiProviderConfig, saveAiProviderSettings, testAiProvider } from "./aiProviderPhase7.mjs";
import { authorize, issueDevToken, parseAuth } from "./authPhase1.mjs";
import { guardedExecute } from "./controlPlanePhase1.mjs";
import { listApprovals, approve } from "./orchestratorPhase1.mjs";
import { budgetSnapshot } from "./guardrailsPhase1.mjs";
import { persistenceStatus, listExecutions, listAuditEvents, logAudit, getPersistenceStoreStatus } from "./persistencePhase2.mjs";
import { vectorStatus, vectorUpsert, vectorSearch, getVectorStoreStatus } from "./vectorMemoryPhase2.mjs";
import { getControlStoreStatus } from "./controlState.mjs";
import { getPersistenceAdapterStatus } from "./persistenceAdapter.mjs";
import { getRuntimeOpsStoreStatus } from "./runtimeOpsStore.mjs";
import { listConnectors, connectorTemplates, getConnector, saveConnector, saveConnectorSecrets, testConnector } from "./connectorsPhase3.mjs";
import { observabilitySnapshot, sloStatus } from "./observabilityPhase4.mjs";
import { listEvalSuites, releaseGateFromSummary, runEvalSuite } from "./evalsPhase4.mjs";
import { getUserProfile, setUserProfile, getUserFavorites, setUserFavorites, getUserPersonalization, setUserPersonalization, listUserToolPresets, upsertUserToolPreset, deleteUserToolPreset } from "./userStatePhase5.mjs";
import { getAutonomyMatrix, setAutonomyMatrix, evaluateAutonomy, workflowTemplates, findWorkflowTemplate, instantiateWorkflowTemplate } from "./autonomyPolicy.mjs";
import { listActionContracts, getActionContract } from "./actionContractsPhase6.mjs";
import { listDeadLetters, listDeterministicRuns, replayDeadLetter, runDeterministicAction } from "./durableExecutionPhase6.mjs";
import { reliabilitySnapshot } from "./reliabilityPhase6.mjs";
import {
  enqueueAutonomyJob,
  getAutonomyRuntimeStatus,
  getAutonomySchedule,
  listAutonomyQueue,
  listAutonomySchedules,
  retryAutonomyJob,
  runAutonomyTick,
  saveAutonomySchedule,
  startAutonomyRuntime,
  stopAutonomyRuntime,
} from "./autonomyRuntimePhase3.mjs";
import { getExecutionRuntimeStoreStatus } from "./executionRuntimeStore.mjs";
import { scanLinks } from "./linkScanner.mjs";
import {
  getAgentChatLog,
  getAgentFunctionOutputs,
  getAgentIntegrations,
  getAgentOpsHistory,
  getAgentWorkflowRuns,
  getAgentUiStoreStatus,
  listCanvasAssets,
  saveCanvasAssets,
  setAgentChatLog,
  setAgentFunctionOutputs,
  setAgentIntegrations,
  setAgentOpsHistory,
  setAgentWorkflowRuns,
} from "./agentUiState.mjs";
import {
  addCompassScans,
  addMerchantOrder,
  addMerchantSku,
  addProspectSequence,
  addScribeDocuments,
  addSentinelCase,
  addVeritasContracts,
  indexScribeDocument,
  listCompassScans,
  listMerchantCatalog,
  listMerchantOrders,
  listProspectSequences,
  listScribeDocuments,
  listSentinelCases,
  listVeritasContracts,
  getAgentOpsStoreStatus,
  reviewVeritasContract,
  syncScribeDocument,
  updateMerchantOrderStatus,
  updateProspectSequence,
  updateSentinelCaseStatus,
} from "./agentOpsState.mjs";

const PORT = Number(process.env.AGENT_BACKEND_PORT || 8787);
const CORS_ALLOW_HEADERS = "Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key, X-Correlation-Id, X-Request-Id, X-Approval-Id, x-approval-id";
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getAllowedOrigins() {
  const configured = String(process.env.AGENT_CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function resolveAllowedOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return null;
  return getAllowedOrigins().has(origin) ? origin : false;
}

function buildCorsHeaders(req) {
  const allowedOrigin = resolveAllowedOrigin(req);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    Vary: "Origin",
  };
  if (allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
  return headers;
}

function isLoopbackRequest(req) {
  const remote = String(req.socket?.remoteAddress || "");
  return remote === "::1" || remote === "127.0.0.1" || remote === "::ffff:127.0.0.1";
}

function isPublicRoute(pathname = "") {
  return pathname === "/health" || pathname === "/auth/dev-token";
}

function sendJson(res, statusCode, payload, req = null) {
  const request = req || res._codexReq || { headers: {}, socket: {} };
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCorsHeaders(request),
  });
  res.end(JSON.stringify(payload), "utf8");
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function requirePermission(req, res, permission) {
  const user = req.authUser || parseAuth(req).user;
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" }, req);
    return null;
  }
  const allowed = authorize(user, permission);
  if (!allowed.ok) {
    sendJson(res, allowed.code || 403, { error: allowed.error || "Forbidden" }, req);
    return null;
  }
  req.authUser = user;
  return user;
}

function requireAuthenticated(req, res) {
  const auth = parseAuth(req);
  if (!auth.ok) {
    sendJson(res, auth.code || 401, { error: auth.error || "Unauthorized" }, req);
    return null;
  }
  req.authUser = auth.user;
  return auth.user;
}

function currentUserId(req) {
  return String(req?.authUser?.user_id || "local-user");
}

function currentTenantId(req) {
  return String(req?.authUser?.tenant_id || "local-tenant");
}

function currentOwnerKey(req) {
  return `${currentTenantId(req)}::${currentUserId(req)}`;
}

function currentActor(req) {
  return String(req?.authUser?.user_id || req?.authUser?.name || "local-user");
}

function isQueueCapableFunction(functionName = "") {
  return [
    "commandCenterIntelligence",
    "atlasWorkflowAutomation",
    "maestroSocialOps",
    "prospectLeadGeneration",
    "centsibleFinanceEngine",
    "sageBussinessStrategy",
    "supportSageCustomerService",
    "scribeKnowledgeBase",
    "sentinelSecurityMonitoring",
    "compassMarketIntelligence",
    "partPartnershipEngine",
    "pulseHREngine",
    "chronosSchedulingEngine",
    "merchantProductManagement",
    "canvasCreativeGeneration",
    "inspectQualityEngine",
    "veritasComplianceValidation",
  ].includes(String(functionName || ""));
}

function sendBinary(res, statusCode, buffer, contentType = "application/octet-stream", req = null) {
  const request = req || res._codexReq || { headers: {}, socket: {} };
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(buffer),
    "Cache-Control": "no-store",
    ...buildCorsHeaders(request),
  });
  res.end(buffer);
}

async function readJsonBody(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" }, req);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    res._codexReq = req;
    if (req.method === "OPTIONS") {
      const allowedOrigin = resolveAllowedOrigin(req);
      if (allowedOrigin === false) return sendJson(res, 403, { error: "Origin not allowed" }, req);
      res.writeHead(204, buildCorsHeaders(req));
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (!isPublicRoute(url.pathname)) {
      const defaultPermission = req.method === "GET" ? "execute:read" : "execute:run";
      const user = requirePermission(req, res, defaultPermission);
      if (!user) return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ...getDiagnostics(),
        persistence: persistenceStatus(),
        vector_memory: vectorStatus(),
        persistence_adapter: getPersistenceAdapterStatus(),
        stores: {
          control: getControlStoreStatus(),
          runtime: getDiagnostics().stores?.runtime || null,
          runtime_ops: getRuntimeOpsStoreStatus(),
          execution_runtime: getExecutionRuntimeStoreStatus(),
          persistence: getPersistenceStoreStatus(),
          vector_memory: getVectorStoreStatus(),
          agent_ui: getAgentUiStoreStatus(),
          agent_ops: getAgentOpsStoreStatus(),
        },
        autonomy_runtime: getAutonomyRuntimeStatus(),
      }, req);
    }

    if (req.method === "GET" && url.pathname === "/v1/ai/providers") {
      const agentId = url.searchParams.get("agent_id") || "";
      return sendJson(res, 200, { status: "success", result: agentId ? getAiProviderStatus(agentId) : (getDiagnostics().ai_providers || {}) });
    }

    if (req.method === "GET" && url.pathname === "/v1/ai/providers/settings") {
      if (!requirePermission(req, res, "execute:*")) return;
      return sendJson(res, 200, { status: "success", result: getAiProviderSettings() });
    }

    if (req.method === "POST" && url.pathname === "/v1/ai/providers/settings") {
      if (!requirePermission(req, res, "execute:*")) return;
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: saveAiProviderSettings(body?.settings || body || {}) });
    }

    if (req.method === "POST" && url.pathname === "/v1/ai/providers/test") {
      if (!requirePermission(req, res, "execute:*")) return;
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const kind = String(body?.kind || "chat");
      const agentId = String(body?.agent_id || body?.agentId || "");
      return sendJson(res, 200, { status: "success", result: await testAiProvider(kind, agentId) });
    }

    if (req.method === "GET" && url.pathname === "/v1/ai/video-content") {
      const videoId = String(url.searchParams.get("video_id") || "").trim();
      const agentId = String(url.searchParams.get("agent_id") || "").trim();
      if (!videoId) return sendJson(res, 400, { status: "error", error: "video_id is required" });
      const configured = getResolvedAiProviderConfig("video", agentId || "canvas");
      if (String(configured?.provider || "").toLowerCase() !== "openai" || !String(configured?.api_key || "").trim()) {
        return sendJson(res, 400, { status: "error", error: "OpenAI video provider is not configured" });
      }
      const baseUrl = String(configured?.base_url || "https://api.openai.com/v1").trim().replace(/\/$/, "");
      const contentRes = await fetch(`${baseUrl}/videos/${encodeURIComponent(videoId)}/content`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${configured.api_key}`,
        },
      });
      if (!contentRes.ok) {
        const detail = await contentRes.text().catch(() => "");
        return sendJson(res, contentRes.status, { status: "error", error: detail || "Unable to fetch video content" });
      }
      const buffer = Buffer.from(await contentRes.arrayBuffer());
      return sendBinary(res, 200, buffer, contentRes.headers.get("content-type") || "video/mp4");
    }

    if (req.method === "GET" && url.pathname === "/auth/dev-token") {
      const allowedOrigin = resolveAllowedOrigin(req);
      if (!isLoopbackRequest(req) || allowedOrigin === false) {
        return sendJson(res, 403, { error: "Dev token is only available from allowed local origins" }, req);
      }
      const role = url.searchParams.get("role") || "admin";
      const userId = url.searchParams.get("user_id") || "local-user";
      const tenantId = url.searchParams.get("tenant_id") || "local-tenant";
      return sendJson(res, 200, { status: "success", token: issueDevToken({ user_id: userId, tenant_id: tenantId, role }) }, req);
    }

    if (req.method === "GET" && url.pathname === "/v1/approvals") {
      if (!requirePermission(req, res, "approvals:*")) return;
      return sendJson(res, 200, { status: "success", result: { approvals: listApprovals() } }, req);
    }

    if (req.method === "POST" && url.pathname.startsWith("/v1/approvals/") && url.pathname.endsWith("/approve")) {
      if (!requirePermission(req, res, "approvals:*")) return;
      const approvalId = decodeURIComponent(url.pathname.replace("/v1/approvals/", "").replace("/approve", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const approver = currentActor(req);
      const result = approve(approvalId, approver);
      if (result) logAudit({ type: "approval.approved", actor: approver, target: approvalId, metadata: { approval: result } });
      return sendJson(res, 200, { status: "success", result }, req);
    }


    if (req.method === "GET" && url.pathname === "/v1/autonomy/matrix") {
      return sendJson(res, 200, { status: "success", result: getAutonomyMatrix() });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/matrix") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = setAutonomyMatrix(body?.matrix || body || {});
      logAudit({ type: "autonomy.matrix.updated", actor: "system", target: "autonomy_matrix", metadata: { matrix: result?.matrix || {} } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/evaluate") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = evaluateAutonomy(body?.functionName || body?.function_name || "", body?.action || "run");
      return sendJson(res, 200, { status: "success", result });
    }
    if (req.method === "GET" && url.pathname === "/v1/autonomy/runtime") {
      return sendJson(res, 200, { status: "success", result: getAutonomyRuntimeStatus() });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/runtime/start") {
      return sendJson(res, 200, { status: "success", result: startAutonomyRuntime({ invokeFunction }) });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/runtime/stop") {
      return sendJson(res, 200, { status: "success", result: stopAutonomyRuntime() });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/runtime/tick") {
      return sendJson(res, 200, { status: "success", result: await runAutonomyTick() });
    }

    if (req.method === "GET" && url.pathname === "/v1/autonomy/queue") {
      return sendJson(res, 200, {
        status: "success",
        result: listAutonomyQueue({
          limit: Number(url.searchParams.get("limit") || 100),
          status: url.searchParams.get("status") || "",
          source: url.searchParams.get("source") || "",
        }),
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/queue") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: enqueueAutonomyJob(body?.job || body || {}) });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v1/autonomy/queue/") && url.pathname.endsWith("/retry")) {
      const jobId = decodeURIComponent(url.pathname.replace("/v1/autonomy/queue/", "").replace("/retry", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: retryAutonomyJob(jobId, body || {}) });
    }

    if (req.method === "GET" && url.pathname === "/v1/autonomy/schedules") {
      return sendJson(res, 200, {
        status: "success",
        result: listAutonomySchedules({
          limit: Number(url.searchParams.get("limit") || 100),
          enabled: url.searchParams.has("enabled") ? url.searchParams.get("enabled") === "true" : null,
        }),
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/autonomy/schedules/")) {
      const scheduleId = decodeURIComponent(url.pathname.replace("/v1/autonomy/schedules/", ""));
      return sendJson(res, 200, { status: "success", result: getAutonomySchedule(scheduleId) });
    }

    if (req.method === "POST" && url.pathname === "/v1/autonomy/schedules") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: saveAutonomySchedule(body?.schedule || body || {}) });
    }
    if (req.method === "GET" && url.pathname === "/v1/workflow-templates") {
      const filters = {
        business_type: url.searchParams.get("business_type") || "",
        category: url.searchParams.get("category") || "",
        q: url.searchParams.get("q") || "",
      };
      return sendJson(res, 200, { status: "success", result: workflowTemplates(filters) });
    }

    if (req.method === "GET" && url.pathname === "/v1/chat/schema") {
      return sendJson(res, 200, { status: "success", result: getChatSchemaRegistry() });
    }

    if (req.method === "GET" && url.pathname === "/v1/agents/capability-audit") {
      const min = Number(url.searchParams.get("min") || 30);
      return sendJson(res, 200, { status: "success", result: capabilityAudit(min) });
    }

    if (req.method === "GET" && url.pathname === "/v1/agents/deterministic-audit") {
      return sendJson(res, 200, { status: "success", result: deterministicImplementationAudit() });
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/schema") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = setChatSchemaRegistry(body?.registry || body || {});
      logAudit({ type: "chat.schema.updated", actor: "system", target: "chat_schema_registry", metadata: { version: result?.version || "unknown" } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/chat/schema/")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v1/chat/schema/", ""));
      return sendJson(res, 200, { status: "success", result: getChatSchemaRegistry(agentId) });
    }

    if (req.method === "GET" && url.pathname === "/v1/chat/schema-history") {
      const limit = Number(url.searchParams.get("limit") || 30);
      return sendJson(res, 200, { status: "success", result: listChatSchemaHistory(limit) });
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/schema/rollback") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const entryId = String(body?.entry_id || body?.id || "");
      if (!entryId) return sendJson(res, 400, { status: "error", error: "entry_id is required" });
      const target = String(body?.target || "before");
      const result = rollbackChatSchemaRegistry(entryId, target);
      if (!result) return sendJson(res, 404, { status: "error", error: "History entry not found or invalid rollback target" });
      if (!result.no_change) {
        logAudit({
          type: "chat.schema.rollback",
          actor: "system",
          target: "chat_schema_registry",
          metadata: { source_entry_id: entryId, target, version: result?.registry?.version || "unknown" },
        });
      }
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/workflow-templates/")) {
      const templateId = decodeURIComponent(url.pathname.replace("/v1/workflow-templates/", ""));
      if (templateId && !templateId.includes("/") ) {
        const template = findWorkflowTemplate(templateId);
        if (!template) return sendJson(res, 404, { status: "error", error: "Template not found" });
        return sendJson(res, 200, { status: "success", result: { template, timestamp: new Date().toISOString() } });
      }
    }

    if (req.method === "POST" && url.pathname.startsWith("/v1/workflow-templates/") && url.pathname.endsWith("/instantiate")) {
      const templateId = decodeURIComponent(url.pathname.replace("/v1/workflow-templates/", "").replace("/instantiate", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = instantiateWorkflowTemplate(templateId, body?.overrides || body || {});
      if (!result) return sendJson(res, 404, { status: "error", error: "Template not found" });
      return sendJson(res, 200, { status: "success", result });
    }
    if (req.method === "GET" && url.pathname === "/v1/budgets") {
      return sendJson(res, 200, { status: "success", result: budgetSnapshot() });
    }

    if (req.method === "GET" && url.pathname === "/v5/user/profile") {
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      return sendJson(res, 200, { status: "success", result: { profile: getUserProfile(currentOwnerKey(req)), user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "POST" && url.pathname === "/v5/user/profile") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const profile = setUserProfile(currentOwnerKey(req), body?.profile || body || {});
      return sendJson(res, 200, { status: "success", result: { profile, user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "GET" && url.pathname === "/v5/user/favorites") {
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      return sendJson(res, 200, { status: "success", result: { favorites: getUserFavorites(currentOwnerKey(req)), user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "POST" && url.pathname === "/v5/user/favorites") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const favorites = setUserFavorites(currentOwnerKey(req), body?.favorites || []);
      return sendJson(res, 200, { status: "success", result: { favorites, user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v5/user/personalization/")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v5/user/personalization/", ""));
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      return sendJson(res, 200, { status: "success", result: { personalization: getUserPersonalization(currentOwnerKey(req), agentId), user_id: userId, tenant_id: tenantId, agent_id: agentId } });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v5/user/personalization/")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v5/user/personalization/", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const personalization = setUserPersonalization(currentOwnerKey(req), agentId, body?.personalization || body || {});
      return sendJson(res, 200, { status: "success", result: { personalization, user_id: userId, tenant_id: tenantId, agent_id: agentId } });
    }

    if (req.method === "GET" && url.pathname === "/v5/user/tool-presets") {
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const agentId = url.searchParams.get("agent_id") || "";
      return sendJson(res, 200, { status: "success", result: { presets: listUserToolPresets(currentOwnerKey(req), agentId), user_id: userId, tenant_id: tenantId, agent_id: agentId || null } });
    }

    if (req.method === "POST" && url.pathname === "/v5/user/tool-presets") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const preset = upsertUserToolPreset(currentOwnerKey(req), body?.preset || body || {});
      return sendJson(res, 200, { status: "success", result: { preset, user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "POST" && url.pathname === "/v5/user/tool-presets/delete") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const result = deleteUserToolPreset(currentOwnerKey(req), body?.preset_id || body?.id || "");
      return sendJson(res, 200, { status: "success", result: { ...result, user_id: userId, tenant_id: tenantId } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v5/user/agent-memory/")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v5/user/agent-memory/", ""));
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      return sendJson(res, 200, { status: "success", result: { ...loadAgentMemory(currentOwnerKey(req), agentId), user_id: userId, tenant_id: tenantId, agent_id: agentId } });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v5/user/agent-memory/")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v5/user/agent-memory/", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      return sendJson(res, 200, { status: "success", result: { ...saveAgentMemory(currentOwnerKey(req), agentId, body?.memory || {}), user_id: userId, tenant_id: tenantId, agent_id: agentId } });
    }

    if (req.method === "GET" && url.pathname === "/v2/persistence/status") {
      return sendJson(res, 200, { status: "success", result: persistenceStatus() });
    }

    if (req.method === "GET" && url.pathname === "/v2/executions") {
      const limit = Number(url.searchParams.get("limit") || 100);
      return sendJson(res, 200, { status: "success", result: { executions: listExecutions(limit) } });
    }

    if (req.method === "GET" && url.pathname === "/v2/audit") {
      const limit = Number(url.searchParams.get("limit") || 100);
      return sendJson(res, 200, { status: "success", result: { events: listAuditEvents(limit) } });
    }

    if (req.method === "GET" && url.pathname === "/v2/vector/status") {
      return sendJson(res, 200, { status: "success", result: vectorStatus() });
    }

    if (req.method === "POST" && url.pathname === "/v2/vector/upsert") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: vectorUpsert(body || {}) });
    }

    if (req.method === "POST" && url.pathname === "/v2/vector/search") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      return sendJson(res, 200, { status: "success", result: vectorSearch(body || {}) });
    }


    if (req.method === "GET" && url.pathname === "/v3/connectors") {
      return sendJson(res, 200, { status: "success", result: listConnectors() });
    }

    if (req.method === "GET" && url.pathname === "/v3/connectors/templates") {
      return sendJson(res, 200, { status: "success", result: connectorTemplates() });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v3/connectors/")) {
      const key = decodeURIComponent(url.pathname.replace("/v3/connectors/", ""));
      if (key && !key.includes("/")) {
        return sendJson(res, 200, { status: "success", result: getConnector(key) });
      }
    }

    if (req.method === "POST" && url.pathname.startsWith("/v3/connectors/") && url.pathname.endsWith("/save")) {
      const key = decodeURIComponent(url.pathname.replace("/v3/connectors/", "").replace("/save", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = saveConnector(key, body?.connector || {});
      logAudit({ type: "connector.saved", actor: "system", target: key, metadata: { connector: result.connector } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v3/connectors/") && url.pathname.endsWith("/secrets")) {
      const key = decodeURIComponent(url.pathname.replace("/v3/connectors/", "").replace("/secrets", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = saveConnectorSecrets(key, body?.secret_refs || {});
      logAudit({ type: "connector.secrets_ref_saved", actor: "system", target: key, metadata: { secret_refs: Object.keys(result.secret_refs || {}) } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v3/connectors/") && url.pathname.endsWith("/test")) {
      const key = decodeURIComponent(url.pathname.replace("/v3/connectors/", "").replace("/test", ""));
      const result = await testConnector(key);
      logAudit({ type: "connector.tested", actor: "system", target: key, metadata: { connected: Boolean(result?.probe?.connected) } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "GET" && url.pathname === "/v4/observability") {
      const limit = Number(url.searchParams.get("limit") || 150);
      return sendJson(res, 200, { status: "success", result: observabilitySnapshot(limit) });
    }

    if (req.method === "GET" && url.pathname === "/v4/slo") {
      return sendJson(res, 200, { status: "success", result: sloStatus() });
    }

    if (req.method === "GET" && url.pathname === "/v4/reliability") {
      return sendJson(res, 200, { status: "success", result: reliabilitySnapshot() });
    }

    if (req.method === "GET" && url.pathname === "/v4/evals/suites") {
      return sendJson(res, 200, { status: "success", result: listEvalSuites() });
    }

    if (req.method === "POST" && url.pathname === "/v4/evals/run") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const suite = body?.suite || "agent_smoke_17";
      const result = await runEvalSuite(suite, invokeFunction);
      logAudit({ type: "eval.completed", actor: "system", target: suite, metadata: { score: result?.summary?.score || 0 } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname === "/v4/evals/release-gate") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const suite = body?.suite || "agent_smoke_17";
      const result = await runEvalSuite(suite, invokeFunction);
      const gate = releaseGateFromSummary(result?.summary || {});
      logAudit({ type: "release.gate", actor: "system", target: suite, metadata: { decision: gate.decision, score: gate.score } });
      return sendJson(res, gate.pass ? 200 : 409, { status: gate.pass ? "success" : "error", result: { suite_result: result, gate } });
    }

    if (req.method === "GET" && url.pathname === "/v7/contracts") {
      return sendJson(res, 200, { status: "success", result: listActionContracts() });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v7/contracts/")) {
      const action = decodeURIComponent(url.pathname.replace("/v7/contracts/", ""));
      const contract = getActionContract(action);
      if (!contract) return sendJson(res, 404, { status: "error", error: "Contract not found" });
      return sendJson(res, 200, { status: "success", result: { contract } });
    }

    if (req.method === "POST" && url.pathname === "/v7/actions/execute") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const request = {
        action: body?.action || "",
        params: body?.params || {},
        requested_by: currentActor(req),
        idempotency_key:
          String(body?.idempotency_key || req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || ""),
        max_attempts: body?.max_attempts,
        correlation_id: body?.correlation_id || req.headers["x-correlation-id"] || req.headers["x-request-id"] || "",
      };
      const result = await runDeterministicAction(request);
      const code = result?.status === "success" ? 200 : 422;
      return sendJson(res, code, { status: result?.status || "error", result });
    }

    if (req.method === "GET" && url.pathname === "/v7/actions/runs") {
      const limit = Number(url.searchParams.get("limit") || 200);
      return sendJson(res, 200, { status: "success", result: listDeterministicRuns(limit) });
    }

    if (req.method === "GET" && url.pathname === "/v7/actions/dead-letters") {
      const limit = Number(url.searchParams.get("limit") || 200);
      return sendJson(res, 200, { status: "success", result: listDeadLetters(limit) });
    }

    if (req.method === "POST" && url.pathname.startsWith("/v7/actions/dead-letters/") && url.pathname.endsWith("/replay")) {
      const id = decodeURIComponent(url.pathname.replace("/v7/actions/dead-letters/", "").replace("/replay", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const result = await replayDeadLetter(id, body || {});
      const code = result?.status === "success" ? 200 : 404;
      return sendJson(res, code, { status: result?.status || "error", result });
    }

    if (req.method === "POST" && url.pathname === "/v1/compass/link-scan") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const links = Array.isArray(body?.links) ? body.links : [];
      const result = await scanLinks(links);
      addCompassScans(result?.results || []);
      logAudit({ type: "compass.link_scan", actor: "system", target: "compass", metadata: { links_scanned: result.links_scanned } });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "GET" && url.pathname === "/v6/veritas/contracts") {
      return sendJson(res, 200, { status: "success", result: { contracts: listVeritasContracts() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/veritas/contracts") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const contracts = Array.isArray(body?.contracts) ? body.contracts : body?.contract ? [body.contract] : [];
      const next = addVeritasContracts(contracts);
      return sendJson(res, 200, { status: "success", result: { contracts: next } });
    }
    if (req.method === "POST" && url.pathname === "/v6/veritas/contracts/review") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const reviewed = reviewVeritasContract(body?.id || "", { risk: body?.risk, status: body?.status });
      return sendJson(res, 200, { status: "success", result: { contract: reviewed } });
    }

    if (req.method === "GET" && url.pathname === "/v6/sentinel/cases") {
      return sendJson(res, 200, { status: "success", result: { cases: listSentinelCases() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/sentinel/cases") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const created = addSentinelCase(body?.case || body || {});
      return sendJson(res, 200, { status: "success", result: { case: created, cases: listSentinelCases() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/sentinel/cases/status") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const updated = updateSentinelCaseStatus(body?.id || "", body?.status || "triaged");
      return sendJson(res, 200, { status: "success", result: { case: updated, cases: listSentinelCases() } });
    }

    if (req.method === "GET" && url.pathname === "/v6/merchant/catalog") {
      return sendJson(res, 200, { status: "success", result: { catalog: listMerchantCatalog() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/merchant/catalog") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const sku = addMerchantSku(body?.sku || body || {});
      return sendJson(res, 200, { status: "success", result: { sku, catalog: listMerchantCatalog() } });
    }
    if (req.method === "GET" && url.pathname === "/v6/merchant/orders") {
      return sendJson(res, 200, { status: "success", result: { orders: listMerchantOrders() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/merchant/orders") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const order = addMerchantOrder(body?.order || body || {});
      return sendJson(res, 200, { status: "success", result: { order, orders: listMerchantOrders() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/merchant/orders/status") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const order = updateMerchantOrderStatus(body?.id || "", body?.status || "shipped");
      return sendJson(res, 200, { status: "success", result: { order, orders: listMerchantOrders() } });
    }

    if (req.method === "GET" && url.pathname === "/v6/prospect/sequences") {
      return sendJson(res, 200, { status: "success", result: { sequences: listProspectSequences() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/prospect/sequences") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const sequence = addProspectSequence(body?.sequence || body || {});
      if (body?.update && sequence?.id) updateProspectSequence(sequence.id, body.update);
      return sendJson(res, 200, { status: "success", result: { sequence, sequences: listProspectSequences() } });
    }

    if (req.method === "GET" && url.pathname === "/v6/scribe/documents") {
      return sendJson(res, 200, { status: "success", result: { documents: listScribeDocuments() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/scribe/documents") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const documents = Array.isArray(body?.documents) ? body.documents : body?.document ? [body.document] : [];
      const next = addScribeDocuments(documents);
      return sendJson(res, 200, { status: "success", result: { documents: next } });
    }
    if (req.method === "POST" && url.pathname === "/v6/scribe/documents/index") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const document = indexScribeDocument(body?.id || "");
      return sendJson(res, 200, { status: "success", result: { document, documents: listScribeDocuments() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/scribe/documents/sync") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const document = syncScribeDocument(body?.id || "", body?.target || "s3_docs");
      return sendJson(res, 200, { status: "success", result: { document, documents: listScribeDocuments() } });
    }

    if (req.method === "GET" && url.pathname === "/v6/compass/scans") {
      return sendJson(res, 200, { status: "success", result: { scans: listCompassScans() } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/integrations")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/integrations", ""));
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, integrations: getAgentIntegrations(agentId) } });
    }
    if (req.method === "POST" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/integrations")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/integrations", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const integrations = setAgentIntegrations(agentId, body?.integrations || body || {});
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, integrations } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/ops-history")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/ops-history", ""));
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, history: getAgentOpsHistory(agentId) } });
    }
    if (req.method === "POST" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/ops-history")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/ops-history", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const history = setAgentOpsHistory(agentId, body?.history || []);
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, history } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/chat-log")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/chat-log", ""));
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, messages: getAgentChatLog(agentId) } });
    }
    if (req.method === "POST" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/chat-log")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/chat-log", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const messages = setAgentChatLog(agentId, body?.messages || []);
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, messages } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/function-outputs")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/function-outputs", ""));
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, outputs: getAgentFunctionOutputs(agentId) } });
    }
    if (req.method === "POST" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/function-outputs")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/function-outputs", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const outputs = setAgentFunctionOutputs(agentId, body?.outputs || []);
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, outputs } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/workflow-runs")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/workflow-runs", ""));
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, runs: getAgentWorkflowRuns(agentId) } });
    }
    if (req.method === "POST" && url.pathname.startsWith("/v6/agents/") && url.pathname.endsWith("/workflow-runs")) {
      const agentId = decodeURIComponent(url.pathname.replace("/v6/agents/", "").replace("/workflow-runs", ""));
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const runs = setAgentWorkflowRuns(agentId, body?.runs || []);
      return sendJson(res, 200, { status: "success", result: { agent_id: agentId, runs } });
    }

    if (req.method === "GET" && url.pathname === "/v6/canvas/assets") {
      return sendJson(res, 200, { status: "success", result: { assets: listCanvasAssets() } });
    }
    if (req.method === "POST" && url.pathname === "/v6/canvas/assets") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const assets = saveCanvasAssets(body?.assets || []);
      return sendJson(res, 200, { status: "success", result: { assets } });
    }


    if (req.method === "GET" && url.pathname === "/registry") {
      return sendJson(res, 200, { status: "success", result: listAgentRegistry() });
    }

    if (req.method === "GET" && url.pathname === "/manifest") {
      return sendJson(res, 200, { status: "success", result: listManifest() });
    }

    if (req.method === "GET" && url.pathname === "/capabilities") {
      return sendJson(res, 200, { status: "success", result: listCapabilities() });
    }

    if (req.method === "GET" && url.pathname === "/events") {
      const limit = Number(url.searchParams.get("limit") || 50);
      return sendJson(res, 200, { status: "success", result: listEvents(limit) });
    }

    if (req.method === "GET" && url.pathname === "/workflows") {
      const limit = Number(url.searchParams.get("limit") || 50);
      return sendJson(res, 200, { status: "success", result: listWorkflows(limit) });
    }

    if (req.method === "POST" && url.pathname === "/invoke") {
      const body = await readJsonBody(req, res);
      if (body == null) return;
      const functionName = body?.functionName;
      const payload = body?.payload || {};
      if (!functionName || typeof functionName !== "string") {
        return sendJson(res, 400, { error: "functionName is required" });
      }
      const queueRequested = Boolean(body?.queue || payload?.queue || payload?.params?.queue || payload?.params?.execution_mode === "queue");
      if (queueRequested && isQueueCapableFunction(functionName)) {
        const job = enqueueAutonomyJob({
          type: "function_invocation",
          function_name: functionName,
          action: payload?.action || "run",
          params: payload?.params || {},
          requested_by: currentUserId(req),
          requested_role: String(req?.authUser?.role || "admin"),
          tenant_id: currentTenantId(req),
          user_id: currentUserId(req),
          priority: Number(body?.priority || payload?.priority || 70),
          max_attempts: Number(body?.max_attempts || payload?.max_attempts || 2),
          source: "invoke_queue",
          correlation_id: String(payload?.params?.correlation_id || ""),
          idempotency_key: String(payload?.params?.idempotency_key || ""),
          metadata: { queued_via: "/invoke" },
        });
        return sendJson(res, 202, { status: "queued", result: job });
      }
      const out = await guardedExecute(req, functionName, payload, invokeFunction);
      return sendJson(res, out.code, out.body);
    }

    if (req.method === "POST" && url.pathname === "/conversations") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return;
      const userId = currentUserId(req);
      const tenantId = currentTenantId(req);
      const result = createConversation({
        ...(payload || {}),
        metadata: {
          ...((payload || {}).metadata || {}),
          user_id: userId,
          tenant_id: tenantId,
        },
      });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "GET" && url.pathname.startsWith("/conversations/")) {
      const conversationId = decodeURIComponent(url.pathname.replace("/conversations/", "")).replace(/\/messages$/, "");
      const result = getConversation(conversationId);
      if (!result) return sendJson(res, 404, { error: "Conversation not found" });
      if (
        String(result?.conversation?.metadata?.user_id || "") !== currentUserId(req) ||
        String(result?.conversation?.metadata?.tenant_id || "") !== currentTenantId(req)
      ) {
        return sendJson(res, 403, { error: "Forbidden" }, req);
      }
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname.endsWith("/messages") && url.pathname.startsWith("/conversations/")) {
      const conversationId = decodeURIComponent(url.pathname.replace("/conversations/", "").replace("/messages", ""));
      const existing = getConversation(conversationId);
      if (!existing) return sendJson(res, 404, { error: "Conversation not found" });
      if (
        String(existing?.conversation?.metadata?.user_id || "") !== currentUserId(req) ||
        String(existing?.conversation?.metadata?.tenant_id || "") !== currentTenantId(req)
      ) {
        return sendJson(res, 403, { error: "Forbidden" }, req);
      }
      const payload = await readJsonBody(req, res);
      if (payload == null) return;
      const result = await addConversationMessage(conversationId, {
        ...(payload || {}),
        metadata: {
          ...((payload || {}).metadata || {}),
          user_id: currentUserId(req),
          tenant_id: currentTenantId(req),
        },
      });
      return sendJson(res, 200, { status: "success", result });
    }

    if (req.method === "POST" && url.pathname.startsWith("/functions/")) {
      const functionName = decodeURIComponent(url.pathname.replace("/functions/", ""));
      const payload = await readJsonBody(req, res);
      if (payload == null) return;
      const out = await guardedExecute(req, functionName, payload, invokeFunction);
      return sendJson(res, out.code, out.body);
    }

    return notFound(res);
  } catch (err) {
    return sendJson(res, 500, { error: String(err?.message || err || "Server error") });
  }
});

server.listen(PORT, () => {
  startAutonomyRuntime({ invokeFunction });
  console.log(`Agent backend listening on http://localhost:${PORT}`);
});













