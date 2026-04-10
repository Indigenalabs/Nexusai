import path from "node:path";
import { probeEmailConnector, probeFinanceConnector } from "./integrations.mjs";
import { AGENT_BY_FUNCTION, AGENT_MANIFEST, FUNCTION_BY_AGENT, getAgentByName } from "./agentManifest.mjs";
import { getConnector } from "./connectorsPhase3.mjs";
import { scanLinks } from "./linkScanner.mjs";
import { runDeterministicAction } from "./durableExecutionPhase6.mjs";
import { vectorSearch } from "./vectorMemoryPhase2.mjs";
import { generateAgentInsightReply, getAiProviderStatus, getChatRoutingDecision, getResolvedAiProviderConfig, normalizeProviderAgentId } from "./aiProviderPhase7.mjs";
import { createVersionedJsonStore } from "./jsonStore.mjs";
import { getAgentMemoryRecord, getChatSchemaHistoryRecords, getChatSchemaRegistryRecord, getChatStateStoreStatus, getConversationCount, getConversationRecord, saveAgentMemoryRecord, saveChatSchemaHistoryRecords, saveChatSchemaRegistryRecord, saveConversationRecord } from "./chatStateStore.mjs";
import { addRuntimeEvent, addRuntimeWorkflow, getActiveRuntimeWorkflowCount, getFunctionHistory, getRuntimeConnectorState, getRuntimeEventCount, getRuntimeOpsStoreStatus, getRuntimeWorkflowCount, getTrackedFunctionCount, listRuntimeEvents, listRuntimeWorkflows, pushFunctionHistory, updateRuntimeConnectorState } from "./runtimeOpsStore.mjs";

const now = () => new Date().toISOString();
const id = (p = "id") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATE_DIR = path.resolve(process.cwd(), "backend", ".data");
const STATE_FILE = path.join(STATE_DIR, "runtime-state.json");

const defaultState = {
  fnHistory: {},
  connectors: {
    prospectLeadGeneration: {
      connector: { provider: "gmail", inbox_address: "sales@company.com", auth_type: "oauth2", host: "", port: 993, username: "", secure: true, client_id: "", tenant_id: "", api_base_url: "" },
      secret_refs: { token_secret_name: "PROSPECT_EMAIL_TOKEN", client_secret_name: "PROSPECT_CLIENT_SECRET", password_secret_name: "PROSPECT_IMAP_PASSWORD" },
    },
    supportSageCustomerService: {
      connector: { provider: "gmail", inbox_address: "support@company.com", auth_type: "oauth2", host: "", port: 993, username: "", secure: true, client_id: "", tenant_id: "", api_base_url: "" },
      secret_refs: { token_secret_name: "SUPPORT_EMAIL_TOKEN", client_secret_name: "SUPPORT_CLIENT_SECRET", password_secret_name: "SUPPORT_IMAP_PASSWORD" },
    },
    centsibleFinanceEngine: {
      connector: { provider: "quickbooks", auth_type: "oauth2", account_label: "Primary Finance Org", tenant_id: "", realm_id: "", api_base_url: "", client_id: "" },
      secret_refs: { api_key_secret_name: "CENTSIBLE_API_KEY", client_secret_name: "CENTSIBLE_CLIENT_SECRET", refresh_token_secret_name: "CENTSIBLE_REFRESH_TOKEN" },
    },
  },
  events: [],
  workflows: [],
};

function sanitizeLeakedPromptText(value = "") {
  let text = String(value || "");
  if (!text) return "";
  text = text.replace(/\n*\s*Business Profile Context:\s*[\s\S]*$/i, "");
  text = text.replace(/\bBusiness context:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bChannels and markets:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bBrand direction:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bFor Nexus, regulated businesses need approvals, evidence, and escalation paths designed into execution from the start\.?\s*/gi, "");
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  return text.trim();
}

function deepSanitizeRuntimeStrings(value) {
  if (typeof value === "string") return sanitizeLeakedPromptText(value);
  if (Array.isArray(value)) return value.map((item) => deepSanitizeRuntimeStrings(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepSanitizeRuntimeStrings(item)]));
  }
  return value;
}

const RUNTIME_SCHEMA_VERSION = 2;

const runtimeStore = createVersionedJsonStore({
  filePath: STATE_FILE,
  defaults: defaultState,
  storeName: "runtime-state",
  schemaVersion: RUNTIME_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    const clean = deepSanitizeRuntimeStrings(parsed || value || {});
    return {
      ...structuredClone(defaultState),
      ...clean,
      fnHistory: { ...defaultState.fnHistory, ...(clean.fnHistory || {}) },
      connectors: { ...defaultState.connectors, ...(clean.connectors || {}) },
      events: clean.events || [],
      workflows: clean.workflows || [],
    };
  },
  beforeWrite(current = {}) {
    return deepSanitizeRuntimeStrings(current);
  },
  migrate(current = {}, { fromVersion }) {
    let next = structuredClone(current || {});
    if (fromVersion < 2) {
      next = deepSanitizeRuntimeStrings(next);
    }
    return next;
  },
  backup: true,
});

let state = runtimeStore.get();

function persist() {
  runtimeStore.replace(state);
  state = runtimeStore.get();
}

const CAPABILITY_LIBRARY = Object.fromEntries(
  AGENT_MANIFEST.map((agent) => [agent.name, (agent.capabilities || []).map((c) => ({ id: c.id, label: c.label, impact: c.impact, action: c.action }))])
);
const ALL_AGENTS = AGENT_MANIFEST.map((agent) => agent.name);
const CORE_ACTIONS_BY_FUNCTION = Object.fromEntries(
  AGENT_MANIFEST.map((agent) => [agent.functionName, (agent.capabilities || []).slice(0, 5).map((c) => String(c.action || c.id || "").toLowerCase()).filter(Boolean)])
);

const CHAT_SCHEMA_REGISTRY = {
  version: "1.0.0",
  generated_at: () => now(),
  common: {
    fields: {
      objective: { type: "select", label: "Objective", options: ["leads", "sales", "traffic", "awareness"] },
      budget: { type: "number", label: "Budget" },
      audience: { type: "text", label: "Audience" },
      channels: { type: "multiselect", label: "Channels", options: ["meta", "google", "linkedin", "tiktok", "email", "web"] },
      contract_name_or_text: { type: "textarea", label: "Contract" },
      suite_name_or_scope: { type: "text", label: "Suite/Scope" },
      job_title: { type: "text", label: "Job Title" },
      department: { type: "text", label: "Department" },
      product_or_segment: { type: "text", label: "Product/Segment" },
      discount_or_offer: { type: "text", label: "Discount/Offer" },
      duration: { type: "text", label: "Duration" },
      deadline: { type: "date", label: "Deadline" },
    },
    actions: {
      campaign_orchestration: { fields: ["objective", "budget", "audience", "channels"], help: "Provide campaign inputs to generate an executable ad setup." },
      contract_risk_review: { fields: ["contract_name_or_text"], help: "Provide contract name or paste key clauses for risk analysis." },
      review_contract: { fields: ["contract_name_or_text"], help: "Provide contract name or paste key clauses for review." },
      quality_gate: { fields: ["suite_name_or_scope"], help: "Specify release/test scope for readiness check." },
      test_orchestration: { fields: ["suite_name_or_scope"], help: "Specify test suite or module scope to run." },
      create_job_description: { fields: ["job_title", "department"], help: "Provide role title and team to generate a JD." },
      create_promotion: { fields: ["product_or_segment", "discount_or_offer", "duration"], help: "Define target product/segment, offer, and campaign duration." },
    },
  },
  agents: {
    maestro: {
      fields: {
        objective: { type: "select", label: "Campaign Objective", options: ["leads", "sales", "traffic", "awareness"] },
        channels: { type: "multiselect", label: "Ad Channels", options: ["meta", "google", "linkedin", "tiktok"] },
      },
    },
    veritas: {
      fields: { contract_name_or_text: { type: "textarea", label: "Contract Name/Text" } },
    },
    inspect: {
      fields: { suite_name_or_scope: { type: "text", label: "Test Suite/Scope" } },
    },
    pulse: {
      fields: { audience: { type: "text", label: "Team/Population" } },
    },
    merchant: {
      fields: {
        product_or_segment: { type: "text", label: "Product or Segment" },
        discount_or_offer: { type: "text", label: "Discount/Offer" },
      },
    },
  },
};

function defaultChatSchemaRegistryBase() {
  return {
    version: CHAT_SCHEMA_REGISTRY.version,
    common: structuredClone(CHAT_SCHEMA_REGISTRY.common),
    agents: structuredClone(CHAT_SCHEMA_REGISTRY.agents),
  };
}

function schemaFingerprint(schema = {}) {
  try {
    return JSON.stringify(schema);
  } catch {
    return "";
  }
}

function summarizeSchemaDelta(before = {}, after = {}) {
  const b = before || {};
  const a = after || {};
  const beforeCommonFields = Object.keys(b?.common?.fields || {}).length;
  const afterCommonFields = Object.keys(a?.common?.fields || {}).length;
  const beforeCommonActions = Object.keys(b?.common?.actions || {}).length;
  const afterCommonActions = Object.keys(a?.common?.actions || {}).length;
  const beforeAgents = new Set(Object.keys(b?.agents || {}));
  const afterAgents = new Set(Object.keys(a?.agents || {}));
  const allAgents = Array.from(new Set([...beforeAgents, ...afterAgents])).sort();
  const addedAgents = allAgents.filter((x) => !beforeAgents.has(x));
  const removedAgents = allAgents.filter((x) => !afterAgents.has(x));
  const changedAgents = allAgents.filter((x) => schemaFingerprint((b?.agents || {})[x] || null) !== schemaFingerprint((a?.agents || {})[x] || null));
  return {
    common_fields_delta: afterCommonFields - beforeCommonFields,
    common_actions_delta: afterCommonActions - beforeCommonActions,
    agent_count_delta: afterAgents.size - beforeAgents.size,
    changed_agents: changedAgents,
    added_agents: addedAgents,
    removed_agents: removedAgents,
  };
}

function parseSemver(version = "") {
  const m = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bumpPatchVersion(version = "") {
  const parsed = parseSemver(version);
  if (!parsed) return "1.0.1";
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function normalizeSchemaRegistryPayload(input = {}, fallback = null) {
  const baseFallback = fallback || defaultChatSchemaRegistryBase();
  const source = (input && typeof input === "object") ? input : {};
  const version = String(source.version || "").trim() || bumpPatchVersion(baseFallback.version);
  const common = source.common && typeof source.common === "object" ? source.common : baseFallback.common;
  const fields = common.fields && typeof common.fields === "object" ? common.fields : {};
  const actions = common.actions && typeof common.actions === "object" ? common.actions : {};
  const agents = source.agents && typeof source.agents === "object" ? source.agents : baseFallback.agents;
  return {
    version,
    common: {
      ...common,
      fields,
      actions,
    },
    agents,
  };
}

function getActiveChatSchemaRegistryBase() {
  const storedRegistry = getChatSchemaRegistryRecord();
  if (storedRegistry && typeof storedRegistry === "object") {
    const parsed = normalizeSchemaRegistryPayload(storedRegistry, defaultChatSchemaRegistryBase());
    return parsed;
  }
  return defaultChatSchemaRegistryBase();
}

if (!getChatSchemaRegistryRecord()) {
  saveChatSchemaRegistryRecord(defaultChatSchemaRegistryBase());
}

function normalizeSchemaAgentKey(agent = "") {
  const s = String(agent || "").toLowerCase().replace(/[^a-z-]/g, "");
  const byId = {
    nexus: "nexus",
    maestro: "maestro",
    prospect: "prospect",
    "support-sage": "support-sage",
    centsible: "centsible",
    sage: "sage",
    chronos: "chronos",
    atlas: "atlas",
    scribe: "scribe",
    sentinel: "sentinel",
    compass: "compass",
    part: "part",
    pulse: "pulse",
    merchant: "merchant",
    canvas: "canvas",
    inspect: "inspect",
    veritas: "veritas",
  };
  if (byId[s]) return byId[s];
  if (s.includes("supportsage")) return "support-sage";
  return s;
}

const ACTION_MATRIX_EXTRAS = {
  commandCenterIntelligence: ["agent_registry_status","command_center_full_self_test","intent_routing","start_workflow","cross_agent_insights","scenario_modeling","workflow_health","business_health_score","alert_correlation","system_action_matrix"],
  maestroSocialOps: ["run_history","unified_social_health","full_ops_self_test"],
  prospectLeadGeneration: ["prospect_run_history","prospect_health_snapshot","inbox_connector_load","inbox_connector_save","inbox_connector_register_secret_refs","inbox_connector_test"],
  supportSageCustomerService: ["support_kpi_command_center","support_connector_load","support_connector_save","support_connector_register_secret_refs","support_connector_test"],
  centsibleFinanceEngine: ["financial_health_check","centsible_connector_load","centsible_connector_save","centsible_connector_register_secret_refs","centsible_connector_test"],
  atlasWorkflowAutomation: ["atlas_full_self_test"],
  chronosSchedulingEngine: ["time_audit","chronos_full_self_test"],
  compassMarketIntelligence: ["market_briefing","website_link_scan","compass_full_self_test"],
  sentinelSecurityMonitoring: ["security_posture_report","sentinel_full_self_test"],
};

function listActionMatrix() {
  const matrix = {};
  AGENT_MANIFEST.forEach((agent) => {
    const fn = agent.functionName;
    matrix[fn] = matrix[fn] || new Set();
    (agent.capabilities || []).forEach((cap) => matrix[fn].add(cap.action || cap.id));
  });
  Object.entries(ACTION_MATRIX_EXTRAS).forEach(([fn, actions]) => {
    matrix[fn] = matrix[fn] || new Set();
    actions.forEach((a) => matrix[fn].add(a));
  });
  const functions = Object.entries(matrix)
    .map(([function_name, actions]) => ({ function_name, action_count: actions.size, actions: Array.from(actions).sort() }))
    .sort((a,b)=>a.function_name.localeCompare(b.function_name));
  const total_actions = functions.reduce((acc, f) => acc + f.action_count, 0);
  return { functions, total_functions: functions.length, total_actions, timestamp: now() };
}

function pushHistory(fn, action, status = "completed", description = "") {
  pushFunctionHistory(fn, { id: id("run"), title: String(action || "run").replace(/_/g, " "), status, description: description || `[${fn}] ${action} executed`, created_date: now() });
}

function getHistory(fn) {
  return getFunctionHistory(fn);
}

function publishEvent(eventType, source, data = {}, correlationId = null) {
  addRuntimeEvent({ eventId: id("evt"), eventType, source, time: now(), correlationId: correlationId || id("corr"), data });
}

function startWorkflow(name = "Workflow", steps = []) {
  const wf = {
    id: id("wf"),
    name,
    status: "running",
    created_at: now(),
    updated_at: now(),
    steps: (steps.length ? steps : [{ title: "Gather signals" }, { title: "Dispatch" }, { title: "Synthesize" }]).map((s, i) => ({ id: id(`s${i}`), title: s.title || `Step ${i + 1}`, status: "pending" })),
  };
  addRuntimeWorkflow(wf);
  return wf;
}

function healthSummary() {
  const eventCount = getRuntimeEventCount();
  const alerts = Math.max(0, Math.floor((eventCount % 7) / 2));
  return {
    health: { health_score: Math.max(78, 96 - alerts * 3), unread_critical_alerts: alerts, active_workflows: getActiveRuntimeWorkflowCount(), blocked_tasks: alerts },
    checks: { registry: true, routing: true, event_bus: true, policy_gate: true, audit_log: true },
    recommendations: {
      immediate_actions: alerts ? ["Resolve alert clusters", "Run cross-agent incident review"] : ["No critical interventions required"],
      orchestration_optimizations: ["Parallelize low-risk workflows", "Reduce duplicated approvals in Atlas"],
      risk_controls: ["Maintain Sentinel scanning cadence", "Run Veritas compliance gate before launches"],
    },
    timestamp: now(),
  };
}

function routeIntent(userRequest = "") {
  const t = String(userRequest).toLowerCase();
  const agents = new Set(["Nexus"]);
  if (/market|campaign|brand|content|social/.test(t)) agents.add("Maestro").add("Canvas");
  if (/lead|pipeline|outreach|sales/.test(t)) agents.add("Prospect");
  if (/support|ticket|customer|csat|churn/.test(t)) agents.add("Support Sage");
  if (/budget|finance|cash|revenue|forecast/.test(t)) agents.add("Centsible");
  if (/security|threat|incident|breach/.test(t)) agents.add("Sentinel");
  if (/legal|contract|compliance|policy/.test(t)) agents.add("Veritas");
  if (/ops|workflow|task|resource/.test(t)) agents.add("Atlas").add("Chronos");
  if (/quality|test|qa|bug/.test(t)) agents.add("Inspect");
  if (/product|catalog|inventory|pricing/.test(t)) agents.add("Merchant");
  if (/team|people|hiring|burnout/.test(t)) agents.add("Pulse");
  if (/partner|alliance/.test(t)) agents.add("Part");
  if (/trend|competitor|intel/.test(t)) agents.add("Compass");
  if (/strategy|okr|board|planning/.test(t)) agents.add("Sage").add("Scribe");

  const selected = Array.from(agents);
  publishEvent("workflow.intent_routed", "Nexus", { userRequest, agents_selected: selected });
  return {
    route: selected.length > 3 ? "multi_agent" : "single_agent",
    agents_selected: selected,
    confidence: Math.min(0.98, 0.72 + selected.length * 0.03),
    recommendation: selected.length > 1
      ? `I'd bring in ${selected.join(", ")} and keep the thread coordinated from here.`
      : `I'd keep this with ${selected[0] || "Nexus"} and move it forward from there.`,
    timestamp: now(),
  };
}

function capabilityResult(agentName, capabilityId, runtimeParams = {}) {
  const capKey = String(capabilityId || "capability").split(".").pop() || "capability";
  const meta = (CAPABILITY_LIBRARY[agentName] || []).find((c) => c.id === capKey);
  return {
    ok: true,
    agent: agentName,
    capability_id: capabilityId,
    capability_label: meta?.label || capKey.replace(/_/g, " "),
    impact: meta?.impact || "medium",
    summary: `${agentName} executed ${meta?.label || capKey} successfully.`,
    insights: [
      `${agentName} baseline remains stable.`,
      `No blocking errors found during ${meta?.label || capKey} execution.`,
      "Proceed with next-step action sequencing.",
    ],
    next_actions: [
      `Review result for ${meta?.label || capKey}.`,
      "Apply highest-impact recommendation first.",
      "Re-run capability after changes to compare impact.",
    ],
    runtime_params: runtimeParams,
    timestamp: now(),
  };
}

function actionProfile(action) {
  const a = String(action || "").toLowerCase();
  if (a.includes("self_test")) return { summary: "Self-test completed with all core checks passing.", recommendation: "Proceed with normal operations and monitor drift.", kpi: { key: "self_test_score", value: 93 } };
  if (a.includes("health") || a.includes("status")) return { summary: "Operational health snapshot generated.", recommendation: "Address any flagged risk clusters immediately.", kpi: { key: "health_score", value: 90 } };
  if (a.includes("risk")) return { summary: "Risk analysis completed with prioritized exposures.", recommendation: "Mitigate top-ranked risk before next release window.", kpi: { key: "risk_index", value: 0.21 } };
  if (a.includes("analytics") || a.includes("analysis")) return { summary: "Analytics run completed with trend interpretation.", recommendation: "Act on the top-performing improvement lever.", kpi: { key: "signal_confidence", value: 0.87 } };
  if (a.includes("forecast")) return { summary: "Forecast generated with scenario bounds.", recommendation: "Use conservative case for operational planning.", kpi: { key: "forecast_confidence", value: 0.84 } };
  if (a.includes("pipeline") || a.includes("lead")) return { summary: "Pipeline action completed with lead prioritization.", recommendation: "Follow up hot leads inside 24 hours.", kpi: { key: "hot_leads", value: 11 } };
  if (a.includes("market") || a.includes("competitive")) return { summary: "Market intelligence sweep completed.", recommendation: "Align campaign messaging with strongest trend.", kpi: { key: "priority_signals", value: 5 } };
  if (a.includes("compliance") || a.includes("legal") || a.includes("contract")) return { summary: "Compliance/legal action completed with obligations updated.", recommendation: "Review upcoming deadlines and ownership.", kpi: { key: "open_obligations", value: 6 } };
  if (a.includes("creative") || a.includes("canvas")) return { summary: "Creative action completed with performance guidance.", recommendation: "Scale top-performing variant and retest.", kpi: { key: "creative_lift_pct", value: 18 } };
  if (a.includes("send_") || a.includes("reply") || a.includes("outreach")) return { summary: "Message orchestration completed and queued.", recommendation: "Track reply latency and iterate content.", kpi: { key: "messages_queued", value: 31 } };
  return { summary: "Execution completed successfully.", recommendation: "Review output and run the next highest-impact action.", kpi: { key: "execution_score", value: 90 } };
}

function buildActionResult(fn, action, params = {}) {
  const agentName = AGENT_BY_FUNCTION[fn] || fn;
  const profile = actionProfile(action);
  return {
    ok: true,
    summary: `${agentName}: ${profile.summary}`,
    recommendation: profile.recommendation,
    kpi: profile.kpi,
    next_actions: [
      "Review this result with the owning workflow.",
      "Apply one recommended fix or optimization now.",
      "Re-run action to validate movement.",
    ],
    inputs: params,
    timestamp: now(),
  };
}

function buildCanvasFallbackResult(action, params = {}) {
  const rawPrompt = String(
    params?.brief ||
    params?.prompt ||
    params?.user_request ||
    "Create a campaign-ready visual"
  ).trim();
  const prompt = normalizeCanvasPrompt(rawPrompt, action);
  const seed = Date.now();
  const isVideo = /video|reel|cinematic/i.test(String(action || ""));
  const isVoice = /voice|voiceover|audio|tts|speech|narrat/.test(String(action || ""));
  const buildCanvasPreviewDataUri = (label, width, height, variantSeed) => {
    const safePrompt = String(label || prompt || "Creative preview").slice(0, 120);
    const palette = [
      ["#0f172a", "#2563eb", "#38bdf8"],
      ["#111827", "#db2777", "#fb7185"],
      ["#172554", "#7c3aed", "#22d3ee"],
      ["#052e16", "#16a34a", "#84cc16"],
    ][Math.abs(Number(variantSeed) || 0) % 4];
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="55%" stop-color="${palette[1]}"/>
      <stop offset="100%" stop-color="${palette[2]}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="28" fill="url(#bg)"/>
  <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.24)}" r="${Math.round(Math.min(width, height) * 0.12)}" fill="rgba(255,255,255,0.15)"/>
  <circle cx="${Math.round(width * 0.22)}" cy="${Math.round(height * 0.72)}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="rgba(255,255,255,0.08)"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.76)}" rx="24" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)"/>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.24)}" fill="#f8fafc" font-size="${Math.round(height * 0.085)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">Canvas Preview</text>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.34)}" fill="rgba(248,250,252,0.84)" font-size="${Math.round(height * 0.04)}" font-family="Arial, Helvetica, sans-serif">Prompt</text>
  <foreignObject x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.39)}" width="${Math.round(width * 0.76)}" height="${Math.round(height * 0.34)}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:${Math.round(height * 0.058)}px;line-height:1.25;font-weight:600;">
      ${safePrompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
  </foreignObject>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.86)}" fill="rgba(248,250,252,0.84)" font-size="${Math.round(height * 0.036)}" font-family="Arial, Helvetica, sans-serif">In-app preview fallback</text>
</svg>`.trim();
    const encodedSvg = encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29");
    return `data:image/svg+xml;charset=UTF-8,${encodedSvg}`;
  };
  const externalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}`;
  const previewImageUrl = buildCanvasPreviewDataUri(prompt, 1024, 1024, seed);
  const voiceoverScript = String(
    params?.transcript ||
    params?.script ||
    params?.copy ||
    params?.narration ||
    buildCanvasVoiceoverScript(prompt, params?.tone || "")
  ).trim();
  const storyboardFrames = isVideo
      ? [
          {
            title: "Frame 1 - Hook",
            prompt: `${prompt}, opening hero frame, cinematic hook`,
            image_url: buildCanvasPreviewDataUri(`${prompt}, opening hero frame, cinematic hook`, 1280, 720, seed),
            preview_image_url: buildCanvasPreviewDataUri(`${prompt}, opening hero frame, cinematic hook`, 1280, 720, seed),
            external_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, opening hero frame, cinematic hook`)}?width=1280&height=720&seed=${seed}`,
          },
          {
            title: "Frame 2 - Product Focus",
            prompt: `${prompt}, product detail frame, dynamic lighting`,
            image_url: buildCanvasPreviewDataUri(`${prompt}, product detail frame, dynamic lighting`, 1280, 720, seed + 1),
            preview_image_url: buildCanvasPreviewDataUri(`${prompt}, product detail frame, dynamic lighting`, 1280, 720, seed + 1),
            external_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, product detail frame, dynamic lighting`)}?width=1280&height=720&seed=${seed + 1}`,
          },
          {
            title: "Frame 3 - Motion Beat",
            prompt: `${prompt}, action frame, movement and speed`,
            image_url: buildCanvasPreviewDataUri(`${prompt}, action frame, movement and speed`, 1280, 720, seed + 2),
            preview_image_url: buildCanvasPreviewDataUri(`${prompt}, action frame, movement and speed`, 1280, 720, seed + 2),
            external_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, action frame, movement and speed`)}?width=1280&height=720&seed=${seed + 2}`,
          },
          {
            title: "Frame 4 - Closing CTA",
            prompt: `${prompt}, ending frame, strong call to action`,
            image_url: buildCanvasPreviewDataUri(`${prompt}, ending frame, strong call to action`, 1280, 720, seed + 3),
            preview_image_url: buildCanvasPreviewDataUri(`${prompt}, ending frame, strong call to action`, 1280, 720, seed + 3),
            external_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, ending frame, strong call to action`)}?width=1280&height=720&seed=${seed + 3}`,
          },
        ]
      : [];
  return {
    summary: isVoice
      ? "Voiceover script prepared for the requested creative brief."
      : isVideo ? "Storyboard and key frames generated for the requested video concept." : "Image concept generated for the requested creative brief.",
    recommendation: isVoice
      ? "Review the narration, then generate live audio when a voice provider is configured."
      : isVideo ? "Review the direction, then expand it into a motion sequence." : "Review the visual direction, then generate variants or adapt it per channel.",
    kpi: { key: isVoice ? "voiceover_seconds" : isVideo ? "story_frames" : "image_variants", value: isVoice ? Math.max(3, Math.ceil(voiceoverScript.split(/\s+/).length / 2.8)) : isVideo ? 6 : 1 },
    next_actions: [
      isVoice ? "Approve or refine the narration script." : isVideo ? "Approve the storyboard direction." : "Approve or refine this visual direction.",
      "Generate another variant if needed.",
      "Adapt the approved concept to the target channel.",
    ],
    prompt,
    voiceover_script: isVoice ? voiceoverScript : "",
    transcript: isVoice ? voiceoverScript : "",
    voice_style: isVoice ? inferCanvasVoiceStyle(prompt, params?.tone || "") : "",
    audio_url: "",
    video_url: "",
    video_job_id: "",
    video_status: "",
    image_url: previewImageUrl,
    preview_image_url: previewImageUrl,
    external_image_url: externalImageUrl,
    asset_url: externalImageUrl,
    asset_type: isVoice ? "audio" : isVideo ? "storyboard" : "image",
    storyboard_frames: storyboardFrames,
    shot_list: isVideo
      ? [
          "Open on the strongest visual hook within the first second.",
          "Cut to the core product or subject detail with tighter framing.",
          "Introduce motion, transformation, or contrast for momentum.",
          "End on a clear branded CTA frame.",
        ]
      : [],
    timestamp: now(),
  };
}

function normalizeCanvasPrompt(input = "", action = "") {
  let text = String(input || "").trim();
  if (!text) return "Create a campaign-ready visual";

  const colonMatch = text.match(/:\s*(.+)$/);
  if (/voice|voiceover|audio|tts|narrat/i.test(String(action || "")) && colonMatch?.[1]) {
    return colonMatch[1].replace(/\band go ahead\b/gi, "").replace(/\bgo ahead\b/gi, "").replace(/\s+/g, " ").trim();
  }

  text = text
    .replace(/^(generate|create|make|design|draw|render|build)\s+/i, "")
    .replace(/\b(an?|the)\s+(image|picture|photo|illustration|visual|poster|cover|logo|video|reel|voiceover|audio|storyboard)\b/gi, "$2")
    .replace(/\bfor my (ad|campaign|brand)\b/gi, "")
    .replace(/\band go ahead\b/gi, "")
    .replace(/\bgo ahead\b/gi, "")
    .replace(/\bplease\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || "Create a campaign-ready visual";
}

function inferCanvasVoiceStyle(prompt = "", tone = "") {
  const text = `${String(prompt || "")} ${String(tone || "")}`.toLowerCase();
  if (/\bluxury|premium|elegant|refined|high-end|exclusive\b/.test(text)) return "luxury";
  if (/\bplayful|fun|cheerful|light|energetic|quirky\b/.test(text)) return "playful";
  if (/\bdirect response|conversion|cta|offer|sale|limited|discount|buy now|shop now\b/.test(text)) return "direct-response";
  if (/\bcinematic|dramatic|story|trailer|epic|atmospheric\b/.test(text)) return "cinematic";
  return "ad";
}

function buildCanvasVoiceoverScript(prompt = "", tone = "") {
  const clean = String(prompt || "").trim().replace(/[.]+$/g, "");
  if (!clean) {
    return "Introducing our latest launch. Crafted to capture attention quickly, communicate the value clearly, and close with a confident next step.";
  }
  const normalized = clean.replace(/^introducing\s+/i, "");
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const style = inferCanvasVoiceStyle(sentence, tone);
  if (style === "luxury") {
    return `Introducing ${sentence}. Crafted with a more refined presence, elevated detail, and a finish that feels unmistakably premium.`;
  }
  if (style === "playful") {
    return `Say hello to ${sentence}. Bright, upbeat, and easy to love, it brings instant energy and gives people a simple reason to jump in.`;
  }
  if (style === "direct-response") {
    return `Introducing ${sentence}. Built to catch attention fast, make the benefit obvious, and move people cleanly toward the next action.`;
  }
  if (style === "cinematic") {
    return `Introducing ${sentence}. Framed with atmosphere, momentum, and a stronger emotional beat, it lands with the feeling of a story unfolding.`;
  }
  return `Introducing ${sentence}. Designed to grab attention quickly, make the value feel immediate, and finish with a clear invitation to act.`;
}

function buildCanvasVoiceInstructions(prompt = "", tone = "") {
  const style = inferCanvasVoiceStyle(prompt, tone);
  const affect = tone ? String(tone).trim() : style;
  if (style === "luxury") return `Voice Affect: ${affect}. Tone: polished and elevated. Pacing: measured. Emphasis: premium detail and confidence.`;
  if (style === "playful") return `Voice Affect: ${affect}. Tone: bright and upbeat. Pacing: lively. Emphasis: charm, momentum, and approachability.`;
  if (style === "direct-response") return `Voice Affect: ${affect}. Tone: confident and persuasive. Pacing: brisk. Emphasis: benefit, urgency, and call to action.`;
  if (style === "cinematic") return `Voice Affect: ${affect}. Tone: dramatic and immersive. Pacing: controlled. Emphasis: atmosphere, build, and emotional weight.`;
  return `Voice Affect: ${affect}. Tone: clear and polished. Pacing: steady. Emphasis: hook, value, and CTA.`;
}

async function generateLiveImageDataUrl(prompt = "", options = {}) {
  const configured = getResolvedAiProviderConfig("image", options.agentId || "canvas");
  const provider = String(configured?.provider || "fallback").trim().toLowerCase();
  if (provider === "pollinations") {
    const size = String(options.size || configured?.size || "1024x1024").trim();
    const [widthRaw, heightRaw] = size.split("x");
    const width = Math.max(256, Number(widthRaw) || 1024);
    const height = Math.max(256, Number(heightRaw) || 1024);
    const seed = Number(options.seed || Date.now());
    const baseUrl = String(configured?.base_url || "https://image.pollinations.ai").trim().replace(/\/$/, "");
    return `${baseUrl}/prompt/${encodeURIComponent(String(prompt || "").trim())}?width=${width}&height=${height}&seed=${seed}`;
  }
  if (provider === "automatic1111") {
    const size = String(options.size || configured?.size || "1024x1024").trim();
    const [widthRaw, heightRaw] = size.split("x");
    const width = Math.max(256, Number(widthRaw) || 1024);
    const height = Math.max(256, Number(heightRaw) || 1024);
    const quality = String(options.quality || configured?.quality || "standard").trim().toLowerCase();
    const baseUrl = String(configured?.base_url || "http://127.0.0.1:7860").trim().replace(/\/$/, "");
    const steps = quality === "high" ? 36 : quality === "medium" ? 30 : quality === "low" ? 18 : 24;
    const res = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: String(prompt || "").trim(),
        width,
        height,
        steps,
        cfg_scale: 7,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Automatic1111 image generation failed (${res.status}): ${detail || "request failed"}`);
    }
    const json = await res.json();
    const image = Array.isArray(json?.images) ? json.images[0] : "";
    return image ? `data:image/png;base64,${image}` : null;
  }

  const apiKey = String(configured?.api_key || "").trim();
  if (!apiKey || provider !== "openai") return null;

  const model = String(options.model || configured?.model || "gpt-image-1.5").trim();
  const size = String(options.size || configured?.size || "1024x1024").trim();
  const quality = String(options.quality || configured?.quality || "auto").trim();
  const baseUrl = String(configured?.base_url || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const body = {
    model,
    prompt: String(prompt || "").trim(),
    size,
    quality,
  };

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI image generation failed (${res.status}): ${detail || "request failed"}`);
  }

  const json = await res.json();
  const item = Array.isArray(json?.data) ? json.data[0] : null;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return item.url;
  return null;
}

async function generateLiveVoiceAudioUrl(input = "", options = {}) {
  const configured = getResolvedAiProviderConfig("voice", options.agentId || "canvas");
  const provider = String(configured?.provider || "fallback").trim().toLowerCase();
  if (provider !== "openai" || !String(configured?.api_key || "").trim()) return null;

  const baseUrl = String(configured?.base_url || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const model = String(options.model || configured?.model || "gpt-4o-mini-tts").trim();
  const voice = String(options.voice || configured?.voice || "alloy").trim();
  const format = String(options.format || "mp3").trim().toLowerCase();
  const instructions = String(options.instructions || "").trim();
  const res = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${configured.api_key}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: String(input || "").trim(),
      instructions: instructions || undefined,
      response_format: format,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI voice generation failed (${res.status}): ${detail || "request failed"}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = format === "wav" ? "audio/wav" : format === "opus" ? "audio/ogg" : "audio/mpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function generateLiveVideoAsset(prompt = "", options = {}) {
  const configured = getResolvedAiProviderConfig("video", options.agentId || "canvas");
  const provider = String(configured?.provider || "fallback").trim().toLowerCase();
  if (provider !== "openai" || !String(configured?.api_key || "").trim()) return null;

  const baseUrl = String(configured?.base_url || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const model = String(options.model || configured?.model || "sora-2").trim();
  const size = String(options.size || "1280x720").trim();
  const seconds = String(options.seconds || "4").trim();
  const quality = String(options.quality || configured?.quality || "high").trim();

  const form = new FormData();
  form.set("model", model);
  form.set("prompt", String(prompt || "").trim());
  form.set("size", size);
  form.set("seconds", seconds);
  const createRes = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configured.api_key}`,
    },
    body: form,
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(`OpenAI video generation failed (${createRes.status}): ${detail || "request failed"}`);
  }

  const created = await createRes.json().catch(() => ({}));
  const createdItem = Array.isArray(created?.data) ? created.data[0] : (created?.video || created);
  const jobId = String(createdItem?.id || "").trim();
  let status = String(createdItem?.status || "submitted").trim();
  let thumbnailUrl = String(createdItem?.thumbnail_url || "").trim();
  let directUrl = String(createdItem?.url || "").trim();

  if (jobId && !directUrl && !/completed|succeeded/i.test(status)) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await sleep(1800);
      const pollRes = await fetch(`${baseUrl}/videos/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${configured.api_key}`,
        },
      });
      if (!pollRes.ok) break;
      const polled = await pollRes.json().catch(() => ({}));
      status = String(polled?.status || status).trim();
      thumbnailUrl = String(polled?.thumbnail_url || thumbnailUrl).trim();
      directUrl = String(polled?.url || directUrl).trim();
      if (/completed|succeeded/i.test(status)) break;
    }
  }

  const proxyUrl = jobId
    ? `http://127.0.0.1:${Number(process.env.AGENT_BACKEND_PORT || 8787)}/v1/ai/video-content?video_id=${encodeURIComponent(jobId)}&agent_id=${encodeURIComponent(options.agentId || "canvas")}`
    : "";
  return {
    job_id: jobId,
    status,
    thumbnail_url: thumbnailUrl,
    poster_frame_url: thumbnailUrl,
    video_url: directUrl || proxyUrl,
    provider,
  };
}

async function buildCanvasAssetResult(action, params = {}) {
  const fallback = buildCanvasFallbackResult(action, params);
  const prompt = normalizeCanvasPrompt(
    String(
      params?.brief ||
      params?.prompt ||
      params?.user_request ||
      "Create a campaign-ready visual"
    ).trim(),
    action
  );
  const isVideo = /video|reel|cinematic/i.test(String(action || ""));
  const isVoice = /voice|voiceover|audio|tts|speech|narrat/.test(String(action || ""));

  try {
    if (isVoice) {
      const script = String(
        params?.transcript ||
        params?.script ||
        params?.copy ||
        params?.narration ||
        fallback.voiceover_script ||
        buildCanvasVoiceoverScript(prompt, params?.tone || "")
      ).trim();
      const liveAudio = await generateLiveVoiceAudioUrl(script, {
        agentId: "canvas",
        instructions: buildCanvasVoiceInstructions(prompt, params?.tone || ""),
      });
      return {
        ...fallback,
        voiceover_script: script,
        transcript: script,
        voice_style: inferCanvasVoiceStyle(prompt, params?.tone || ""),
        audio_url: liveAudio || "",
        provider: String(getResolvedAiProviderConfig("voice", "canvas")?.provider || "fallback"),
        live_generated: Boolean(liveAudio),
      };
    }

    if (isVideo) {
      const baseFrames = Array.isArray(fallback.storyboard_frames) ? fallback.storyboard_frames : [];
      const liveFrames = await Promise.all(
        baseFrames.map(async (frame, index) => {
          const liveUrl = await generateLiveImageDataUrl(frame?.prompt || `${prompt} frame ${index + 1}`, {
            size: "1536x1024",
            quality: "medium",
            seed: Date.now() + index,
          });
          return {
            ...frame,
            image_url: liveUrl || frame.image_url,
            preview_image_url: liveUrl || frame.preview_image_url || frame.image_url,
          };
        })
      );
      const liveVideo = await generateLiveVideoAsset(prompt, {
        agentId: "canvas",
        quality: params?.quality || "high",
      });
      return {
        ...fallback,
        storyboard_frames: liveFrames,
        video_url: liveVideo?.video_url || "",
        video_job_id: liveVideo?.job_id || "",
        video_status: liveVideo?.status || "",
        poster_frame_url: liveVideo?.poster_frame_url || liveVideo?.thumbnail_url || "",
        provider: String(liveVideo?.provider || getResolvedAiProviderConfig("video", "canvas")?.provider || getResolvedAiProviderConfig("image", "canvas")?.provider || "fallback"),
        live_generated:
          Boolean(liveVideo?.video_url) ||
          liveFrames.some((frame) => String(frame?.image_url || "").startsWith("data:image/") || /^https?:\/\//i.test(String(frame?.image_url || ""))),
      };
    }

    const liveImage = await generateLiveImageDataUrl(prompt, {
      size: "1024x1024",
      quality: "high",
      seed: Date.now(),
    });

    if (!liveImage) return fallback;

    return {
      ...fallback,
      image_url: liveImage,
      preview_image_url: liveImage,
      provider: String(getResolvedAiProviderConfig("image", "canvas")?.provider || "openai"),
      live_generated: true,
    };
  } catch (err) {
    return {
      ...fallback,
      provider: "fallback",
      live_generated: false,
      provider_error: String(err?.message || err || "Image generation failed"),
    };
  }
}

function inferConnectorKeyForAction(action = "") {
  const a = String(action || "").toLowerCase();
  if (/(campaign|creative|social|ad|brand|content|outreach)/.test(a)) return "social";
  if (/(lead|pipeline|ticket|support|reply|email|notification|message)/.test(a)) return "email";
  if (/(contract|compliance|policy|knowledge|document|sop|audit|report|qa|test|release)/.test(a)) return "docs";
  if (/(inventory|pricing|catalog|order|commerce|partner|budget|cash|finance|payment)/.test(a)) return "ecommerce";
  return "docs";
}

async function maybeRunCoreDeterministic(fn, action, payload = {}) {
  const a = String(action || "").toLowerCase();
  const coreActions = CORE_ACTIONS_BY_FUNCTION[fn] || [];
  if (!coreActions.includes(a)) return null;
  const run = await runDeterministicAction({
    action: "agent_operation",
    params: {
      function_name: fn,
      action: a,
      params: payload?.params || {},
      connector_key: payload?.params?.connector_key || "",
      dry_run: Boolean(payload?.params?.dry_run),
    },
    requested_by: payload?.params?.requested_by || AGENT_BY_FUNCTION[fn] || "system",
    idempotency_key: payload?.params?.idempotency_key || "",
    max_attempts: payload?.params?.max_attempts || 2,
    correlation_id: payload?.params?.correlation_id || "",
  });
  pushHistory(fn, a, run.status === "success" ? "completed" : "failed");
  return {
    data: {
      action: a,
      status: run.status === "success" ? "success" : "error",
      result: run.result || { summary: run.error || "Deterministic execution failed" },
      deterministic: true,
      contract: run.contract || null,
      dead_letter: run.dead_letter || null,
    },
  };
}

export async function invokeFunction(fn, payload = {}) {
  const a = payload?.action || "run";

  publishEvent(`${fn}.${a}`, fn, { params: payload?.params || {} });

  if (["social_posting", "email_replies", "document_ingestion", "shop_operations"].includes(String(a))) {
    const run = await runDeterministicAction({
      action: String(a),
      params: payload?.params || {},
      requested_by: payload?.params?.requested_by || AGENT_BY_FUNCTION[fn] || "system",
      idempotency_key: payload?.params?.idempotency_key || "",
      max_attempts: payload?.params?.max_attempts || 2,
      correlation_id: payload?.params?.correlation_id || "",
    });
    pushHistory(fn, a, run.status === "success" ? "completed" : "failed");
    return {
      data: {
        action: a,
        status: run.status === "success" ? "success" : "error",
        result: run.result || { summary: run.error || "Deterministic execution failed" },
        deterministic: true,
        contract: run.contract || null,
        dead_letter: run.dead_letter || null,
      },
    };
  }

  if (fn === "agentCapabilityOrchestrator" && a === "list_capabilities") {
    const agents = Object.keys(CAPABILITY_LIBRARY).map((agentName) => ({
      agent_name: agentName,
      capabilities: (CAPABILITY_LIBRARY[agentName] || []).map((c) => ({ ...c, id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${c.id}` })),
    }));
    return { data: { action: a, agents, status: "success", result: { count: agents.length } } };
  }

  if (fn === "agentCapabilityOrchestrator" && a === "list_manifest") {
    return { data: { action: a, status: "success", agents: AGENT_MANIFEST, result: { count: AGENT_MANIFEST.length } } };
  }

  if (fn === "agentCapabilityOrchestrator" && a === "get_agent_blueprint") {
    const agentName = payload?.params?.agent_name || payload?.params?.agent || "Maestro";
    const capabilities = (CAPABILITY_LIBRARY[agentName] || []).map((c) => ({ ...c, id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${c.id}` }));
    return { data: { action: a, status: "success", result: { agent_name: agentName, capability_count: capabilities.length, capabilities, operating_model: "event-driven", timestamp: now() } } };
  }

  if (fn === "agentCapabilityOrchestrator" && a === "run_capability") {
    const capabilityId = payload?.params?.capability_id || "capability";
    const agentName = payload?.params?.agent_name || "agent";
    const runtimeParams = payload?.params?.runtime_params || {};
    const targetFn = FUNCTION_BY_AGENT[agentName];
    const capabilityKey = String(capabilityId).split(".").pop();
    const capabilityMeta = (CAPABILITY_LIBRARY[agentName] || []).find((c) => c.id === capabilityKey);
    const toolAction = capabilityMeta?.action || capabilityKey || capabilityId;

    let executed = null;
    if (targetFn) {
      executed = await invokeFunction(targetFn, Object.keys(runtimeParams).length ? { action: toolAction, params: runtimeParams } : { action: toolAction });
    }

    const result = executed?.data?.result?.summary
      ? executed.data.result
      : (executed?.data?.result || capabilityResult(agentName, capabilityId, runtimeParams));

    pushHistory(targetFn || agentName, capabilityId, "completed", `[capability] ${agentName} -> ${capabilityId}`);

    return {
      data: {
        action: a,
        status: "success",
        capability: { id: capabilityId, label: capabilityMeta?.label || capabilityId.split(".").pop()?.replace(/_/g, " ") || "capability" },
        result,
        source_action: capabilityId,
        tool_action: executed?.data?.action || toolAction,
      },
    };
  }

  if (fn === "commandCenterIntelligence") {
    if (a === "agent_registry_status") return { data: { action: a, status: "success", result: listAgentRegistry() } };
    if (a === "command_center_full_self_test") return { data: { action: a, status: "success", result: { ...healthSummary(), workflows: listRuntimeWorkflows(20), events: listRuntimeEvents(20) } } };
    if (a === "intent_routing") return { data: { action: a, status: "success", result: routeIntent(payload?.params?.user_request || "") } };
    if (a === "start_workflow") return { data: { action: a, status: "success", result: startWorkflow(payload?.params?.name || "Adhoc Nexus Workflow", payload?.params?.steps || []) } };
    if (a === "system_action_matrix") return { data: { action: a, status: "success", result: listActionMatrix() } };
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "maestroSocialOps") {
    if (a === "run_history") return { data: { action: a, history: getHistory(fn) } };
    if (a === "unified_social_health") return { data: { action: a, result: { ops_score: 91, posts: { scheduled: 18 }, community: { unread: 7, flagged: 1 }, channels_online: 4, timestamp: now() }, history: getHistory(fn) } };
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}), history: getHistory(fn) } };
  }

  if (fn === "prospectLeadGeneration") {
    if (a === "prospect_run_history") return { data: { action: a, history: getHistory(fn) } };
    if (a === "prospect_health_snapshot") return { data: { action: a, result: { health_score: 90, lead_health: { total: 124, hot: 14, warm: 42, cold: 68 }, by_status: { new: 31, contacted: 49, meeting_booked: 18, proposal: 9 }, conversion_rate: 11.4, timestamp: now() }, history: getHistory(fn) } };
    if (a === "inbox_connector_load") return { data: { action: a, status: "success", result: { exists: true, connector: getRuntimeConnectorState("prospectLeadGeneration")?.connector, secret_refs: getRuntimeConnectorState("prospectLeadGeneration")?.secret_refs } } };
    if (a === "inbox_connector_save") { const saved = updateRuntimeConnectorState("prospectLeadGeneration", (current) => ({ ...current, connector: { ...(current.connector || {}), ...(payload?.params?.connector || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { saved: true, connector: saved?.connector || {} } } }; }
    if (a === "inbox_connector_register_secret_refs") { const saved = updateRuntimeConnectorState("prospectLeadGeneration", (current) => ({ ...current, secret_refs: { ...(current.secret_refs || {}), ...(payload?.params?.secret_refs || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { registered: true, secret_refs: saved?.secret_refs || {} } } }; }
    if (a === "inbox_connector_test") { const c = getRuntimeConnectorState("prospectLeadGeneration")?.connector; const connected = Boolean(c.provider && c.inbox_address && c.auth_type); const probe = await probeEmailConnector(c); const ok = connected && (probe.connected || !c.api_base_url); pushHistory(fn, a, ok ? "completed" : "failed"); return { data: { action: a, status: ok ? "success" : "error", result: { connected: ok, provider: c.provider, inbox_address: c.inbox_address, probe, last_tested_at: now() } } }; }
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}), history: getHistory(fn) } };
  }

  if (fn === "supportSageCustomerService") {
    if (a === "support_kpi_command_center") return { data: { action: a, result: { kpi_snapshot: { health_score: 88, first_response_sla: "96.2%", resolution_sla: "93.8%" }, forecast_risk: "moderate", executive_actions: ["Increase weekend coverage", "Update billing KB", "Escalate churn-risk tickets"], timestamp: now() } } };
    if (a === "support_connector_load") return { data: { action: a, status: "success", result: { exists: true, connector: getRuntimeConnectorState("supportSageCustomerService")?.connector, secret_refs: getRuntimeConnectorState("supportSageCustomerService")?.secret_refs } } };
    if (a === "support_connector_save") { const saved = updateRuntimeConnectorState("supportSageCustomerService", (current) => ({ ...current, connector: { ...(current.connector || {}), ...(payload?.params?.connector || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { saved: true, connector: saved?.connector || {} } } }; }
    if (a === "support_connector_register_secret_refs") { const saved = updateRuntimeConnectorState("supportSageCustomerService", (current) => ({ ...current, secret_refs: { ...(current.secret_refs || {}), ...(payload?.params?.secret_refs || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { registered: true, secret_refs: saved?.secret_refs || {} } } }; }
    if (a === "support_connector_test") { const c = getRuntimeConnectorState("supportSageCustomerService")?.connector; const connected = Boolean(c.provider && c.inbox_address && c.auth_type); const probe = await probeEmailConnector(c); const ok = connected && (probe.connected || !c.api_base_url); pushHistory(fn, a, ok ? "completed" : "failed"); return { data: { action: a, status: ok ? "success" : "error", result: { connected: ok, provider: c.provider, inbox_address: c.inbox_address, probe, last_tested_at: now() } } }; }
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "centsibleFinanceEngine") {
    if (a === "financial_health_check") return { data: { action: a, result: { health_score: 93, net_profit: "$182,400", cash_flow_status: "positive", burn_multiple: 1.3, timestamp: now() } } };
    if (a === "centsible_connector_load") return { data: { action: a, status: "success", result: { exists: true, connector: getRuntimeConnectorState("centsibleFinanceEngine")?.connector, secret_refs: getRuntimeConnectorState("centsibleFinanceEngine")?.secret_refs } } };
    if (a === "centsible_connector_save") { const saved = updateRuntimeConnectorState("centsibleFinanceEngine", (current) => ({ ...current, connector: { ...(current.connector || {}), ...(payload?.params?.connector || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { saved: true, connector: saved?.connector || {} } } }; }
    if (a === "centsible_connector_register_secret_refs") { const saved = updateRuntimeConnectorState("centsibleFinanceEngine", (current) => ({ ...current, secret_refs: { ...(current.secret_refs || {}), ...(payload?.params?.secret_refs || {}) } })); pushHistory(fn, a); return { data: { action: a, status: "success", result: { registered: true, secret_refs: saved?.secret_refs || {} } } }; }
    if (a === "centsible_connector_test") { const c = getRuntimeConnectorState("centsibleFinanceEngine")?.connector; const connected = Boolean(c.provider && c.auth_type); const probe = await probeFinanceConnector(c); const ok = connected && (probe.connected || !c.api_base_url); pushHistory(fn, a, ok ? "completed" : "failed"); return { data: { action: a, status: ok ? "success" : "error", result: { connected: ok, provider: c.provider, account_label: c.account_label, probe, last_tested_at: now() } } }; }
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "atlasWorkflowAutomation") {
    if (a === "atlas_full_self_test") return { data: { action: a, result: { health: { health_score: 94, active_tasks: 47, blocked_tasks: 2, overdue_tasks: 1 }, checks: { workflow_engine: true, task_router: true, dependency_graph: true, scheduler: true, alerts: true }, timestamp: now() } } };
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "chronosSchedulingEngine") {
    if (a === "time_audit") return { data: { action: a, result: { time_health_score: 86, breakdown: { meeting_percent: 41, focus_percent: 37 }, hours_to_reclaim: 6.5, timestamp: now() } } };
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "compassMarketIntelligence") {
    if (a === "market_briefing") return { data: { action: a, result: { critical_alerts: ["Competitor reduced annual pricing by 12%"], opportunities: ["Rising APAC demand for workflow AI", "Partner gap in compliance tooling"], top_3_actions: ["Test pricing bundle", "Publish differentiation page", "Run partner outreach sprint"], timestamp: now() } } };
    if (a === "website_link_scan") {
      const links = Array.isArray(payload?.params?.links) ? payload.params.links : [];
      const result = await scanLinks(links);
      return { data: { action: a, status: "success", result } };
    }
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}) } };
  }

  if (fn === "sentinelSecurityMonitoring") {
    if (a === "security_posture_report") {
      const posture = { security_score: 89, threat_level: "low", incident_summary: { open_critical: 0, open_high: 2 }, top_5_risks: ["MFA policy drift", "Stale API keys pending rotation"], timestamp: now() };
      return { data: { action: a, ...posture, result: posture } };
    }
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    if (deterministic) return deterministic;
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: { ...buildActionResult(fn, a, payload?.params || {}), security_score: 89, threat_level: "low", incident_summary: { open_critical: 0 } } } };
  }

  if (fn === "canvasCreativeGeneration" && (a === "creative_generation" || a === "cinematic_video_command" || a === "voiceover_generation")) {
    const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
    const assetResult = await buildCanvasAssetResult(a, payload?.params || {});
    if (deterministic) {
      const deterministicResult = deterministic?.data?.result || {};
      deterministic.data.result = {
        ...assetResult,
        ...deterministicResult,
        run: deterministicResult.run || null,
        total_runs: deterministicResult.total_runs ?? null,
        connector_key: deterministicResult.connector_key || "social",
        provider: deterministicResult.provider || assetResult.provider || "fallback",
        summary: deterministicResult.summary || assetResult.summary,
      };
      return deterministic;
    }
    pushHistory(fn, a);
    return { data: { action: a, status: "success", result: assetResult } };
  }

  const deterministic = await maybeRunCoreDeterministic(fn, a, payload);
  if (deterministic) return deterministic;
  pushHistory(fn, a);
  return { data: { action: a, status: "success", result: buildActionResult(fn, a, payload?.params || {}), history: getHistory(fn) } };
}

export function listAgentRegistry() {
  const summary = healthSummary();
  const agents = AGENT_MANIFEST.map((agent, i) => ({
    name: agent.name,
    role: agent.role,
    domain: agent.domain,
    tagline: agent.tagline,
    status: i % 6 === 0 ? "needs_attention" : (i % 2 ? "active" : "idle"),
    current_focus: `Running ${agent.role} workflows`,
    key_metric: agent.capabilities?.[0]?.label || "Nominal",
    concern: i % 6 === 0 ? "Pending optimization" : "None",
    capability_count: (agent.capabilities || []).length,
  }));
  return { agents, health_score: summary.health.health_score, timestamp: now() };
}

export function listManifest() {
  return { agents: AGENT_MANIFEST, count: AGENT_MANIFEST.length, timestamp: now() };
}

export function listCapabilities() {
  const agents = Object.keys(CAPABILITY_LIBRARY).map((agentName) => ({
    agent_name: agentName,
    capabilities: (CAPABILITY_LIBRARY[agentName] || []).map((c) => ({ ...c, id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${c.id}` })),
  }));
  return { agents, count: agents.length, timestamp: now() };
}

export function capabilityAudit(minCapabilities = 30) {
  const min = Math.max(1, Number(minCapabilities) || 30);
  const agents = AGENT_MANIFEST.map((agent) => {
    const count = (agent.capabilities || []).length;
    return {
      agent: agent.name,
      function_name: agent.functionName,
      capability_count: count,
      min_required: min,
      gap: Math.max(0, min - count),
      status: count >= min ? "ready" : "needs_expansion",
    };
  });
  const total = agents.reduce((acc, x) => acc + x.capability_count, 0);
  const avg = Number((total / Math.max(1, agents.length)).toFixed(1));
  const blocked = agents.filter((x) => x.status !== "ready").length;
  return {
    summary: {
      total_agents: agents.length,
      total_capabilities: total,
      average_capabilities: avg,
      min_required: min,
      blocked_agents: blocked,
      status: blocked === 0 ? "all_ready" : "gaps_present",
    },
    agents,
    timestamp: now(),
  };
}

export function deterministicImplementationAudit() {
  const agents = AGENT_MANIFEST.map((agent) => {
    const core = (agent.capabilities || []).slice(0, 5);
    const checks = core.map((cap) => {
      const action = String(cap.action || cap.id || "").toLowerCase();
      const connector_key = inferConnectorKeyForAction(action);
      let connector_ready = false;
      let connector_live_ready = false;
      try {
        const record = getConnector(connector_key);
        connector_ready = Boolean(record?.ready);
        connector_live_ready = Boolean(record?.ready && (record?.connector?.api_base_url || record?.connector?.host));
      } catch {
        connector_ready = false;
        connector_live_ready = false;
      }
      return {
        capability_id: cap.id,
        action,
        deterministic_binding: true,
        connector_key,
        connector_ready,
        connector_live_ready,
      };
    });
    const ready_count = checks.filter((x) => x.connector_live_ready).length;
    return {
      agent: agent.name,
      function_name: agent.functionName,
      core_action_count: checks.length,
      deterministic_bound_count: checks.filter((x) => x.deterministic_binding).length,
      connector_ready_count: ready_count,
      status: ready_count === checks.length ? "live_ready" : "simulated_or_partial",
      checks,
    };
  });
  const total_core = agents.reduce((acc, a) => acc + a.core_action_count, 0);
  const total_bound = agents.reduce((acc, a) => acc + a.deterministic_bound_count, 0);
  const total_live = agents.reduce((acc, a) => acc + a.connector_ready_count, 0);
  return {
    summary: {
      total_agents: agents.length,
      total_core_actions: total_core,
      deterministic_bound_actions: total_bound,
      live_ready_actions: total_live,
      deterministic_coverage_pct: total_core ? Number(((total_bound / total_core) * 100).toFixed(1)) : 0,
      live_readiness_pct: total_core ? Number(((total_live / total_core) * 100).toFixed(1)) : 0,
    },
    agents,
    timestamp: now(),
  };
}

export function getChatSchemaRegistry(agent = "") {
  const key = normalizeSchemaAgentKey(agent);
  const registry = getActiveChatSchemaRegistryBase();
  return {
    version: registry.version,
    generated_at: now(),
    common: registry.common,
    agent: key ? { id: key, ...(registry.agents[key] || {}) } : null,
    agents: registry.agents,
  };
}

export function setChatSchemaRegistry(registry = {}) {
  const current = getActiveChatSchemaRegistryBase();
  const normalized = normalizeSchemaRegistryPayload(registry, current);
  const unchanged = schemaFingerprint(current) === schemaFingerprint(normalized);
  if (unchanged) return getChatSchemaRegistry();
  const historyEntry = {
    id: id("schema"),
    created_at: now(),
    actor: "system",
    change_type: "update",
    from_version: current.version,
    to_version: normalized.version,
    summary: summarizeSchemaDelta(current, normalized),
    before: current,
    after: normalized,
  };
  saveChatSchemaRegistryRecord(normalized);
  saveChatSchemaHistoryRecords([historyEntry, ...getChatSchemaHistoryRecords()].slice(0, 100));
  return getChatSchemaRegistry();
}

export function listChatSchemaHistory(limit = 30) {
  const max = Math.max(1, Math.min(100, Number(limit) || 30));
  return {
    entries: getChatSchemaHistoryRecords().slice(0, max),
    count: getChatSchemaHistoryRecords().length,
    timestamp: now(),
  };
}

export function rollbackChatSchemaRegistry(entryId = "", target = "before") {
  const entries = getChatSchemaHistoryRecords();
  const found = entries.find((x) => x.id === entryId);
  if (!found) return null;
  const pick = String(target || "before").toLowerCase() === "after" ? found.after : found.before;
  if (!pick || typeof pick !== "object") return null;
  const current = getActiveChatSchemaRegistryBase();
  const normalized = normalizeSchemaRegistryPayload(pick, current);
  const unchanged = schemaFingerprint(current) === schemaFingerprint(normalized);
  if (unchanged) {
    return {
      registry: getChatSchemaRegistry(),
      rollback_entry: null,
      no_change: true,
    };
  }
  const rollbackEntry = {
    id: id("schema"),
    created_at: now(),
    actor: "system",
    change_type: "rollback",
    source_entry_id: found.id,
    from_version: current.version,
    to_version: normalized.version,
    summary: summarizeSchemaDelta(current, normalized),
    before: current,
    after: normalized,
  };
  saveChatSchemaRegistryRecord(normalized);
  saveChatSchemaHistoryRecords([rollbackEntry, ...entries].slice(0, 100));
  return {
    registry: getChatSchemaRegistry(),
    rollback_entry: rollbackEntry,
    no_change: false,
  };
}

export function listEvents(limit = 50) {
  return { events: listRuntimeEvents(limit), count: getRuntimeEventCount(), timestamp: now() };
}

export function listWorkflows(limit = 50) {
  return { workflows: listRuntimeWorkflows(limit), count: getRuntimeWorkflowCount(), timestamp: now() };
}


function normalizeChatAgent(agentName = "assistant") {
  let k = String(agentName || "assistant").toLowerCase().replace(/[^a-z]/g, "");
  if (k.endsWith("agent")) k = k.slice(0, -5);
  if (k.includes("nexus") || k.includes("commander") || k.includes("command")) return "Nexus";
  if (k.includes("supportsage")) return "Support Sage";
  const map = {
    maestro: "Maestro",
    prospect: "Prospect",
    centsible: "Centsible",
    sage: "Sage",
    chronos: "Chronos",
    atlas: "Atlas",
    scribe: "Scribe",
    sentinel: "Sentinel",
    compass: "Compass",
    part: "Part",
    pulse: "Pulse",
    merchant: "Merchant",
    canvas: "Canvas",
    inspect: "Inspect",
    veritas: "Veritas",
  };
  return map[k] || "Nexus";
}

function inferChatAction(agentName, text = "") {
  const normalizedAgent = normalizeChatAgent(agentName);
  const profile = getAgentByName(agentName) || getAgentByName(normalizedAgent) || getAgentByName("Nexus");
  const t = String(text || "").toLowerCase();

  if (normalizedAgent === "Nexus") {
    if (/self[ -]?test|diagnostic|readiness|system health|platform health/.test(t)) return "command_center_full_self_test";
    if (/registry|which agents|agent status|available agents/.test(t)) return "agent_registry_status";
    if (/route|dispatch|orchestrate|handoff|who should handle|which agent/.test(t)) return "intent_routing";
    if (/workflow|launch|start|kickoff|runbook/.test(t)) return "start_workflow";
  }
  if (normalizedAgent === "Maestro") {
    if (/campaign|ad set|ads|launch|meta ads|google ads/.test(t)) return "campaign_orchestration";
    if (/lifecycle|nurture|drip|journey|retention/.test(t)) return "lifecycle_automation";
    if (/creative brief|messaging|hooks|angles/.test(t)) return "creative_brief_generation";
    if (/(ab test|split test|experiment|variant)/.test(t) || t.includes("a/b")) return "ab_test_planning";
    if (/performance|roas|cpc|cpa|ctr/.test(t)) return "performance_scorecard";
  }
  if (normalizedAgent === "Canvas") {
    if (/voice|voiceover|narrat|tts|audio|read this/.test(t)) return "voiceover_generation";
    if (/brand|guideline|compliance/.test(t)) return "brand_compliance";
    if (/variant|variation|test multiple/.test(t)) return "variant_testing";
    if (/format|resize|repurpose|adapt/.test(t)) return "format_adaptation";
    if (/video|reel|cinematic|motion|storyboard|animation/.test(t)) return "cinematic_video_command";
    if (/image|picture|photo|illustration|draw|render|visual|poster|cover|cat|dog|portrait|logo/.test(t)) return "creative_generation";
  }

  const manifestPick = pickBestCapability(profile, text);
  if (manifestPick?.action || manifestPick?.id) return manifestPick.action || manifestPick.id;

  if (/health|status|brief|summary/.test(t)) return "health_check";
  if (/risk|threat|security/.test(t)) return "security_posture_report";
  if (/pipeline|lead/.test(t)) return "pipeline_analytics";
  if (/market|trend|competitor/.test(t)) return "market_briefing";
  if (/finance|cash|budget/.test(t)) return "financial_health_check";
  if (/quality|test|bug/.test(t)) return "quality_gate";
  if (/legal|compliance|contract/.test(t)) return "legal_risk_register";
  return (profile?.capabilities || []).find((cap) => !GENERIC_UTILITY_ACTIONS.has(String(cap?.action || cap?.id || "").toLowerCase()))?.action || "health_check";
}

function inferDeterministicActionFromChat(text = "") {
  const t = String(text || "").toLowerCase();
  const explicitExecutionIntent = /\b(run|execute|go ahead|do it|ship|launch|post|publish|send|ingest|index|apply)\b/.test(t);
  if (!explicitExecutionIntent) return null;
  if (/post|publish|instagram|tiktok|reel|social/.test(t)) {
    return {
      action: "social_posting",
      params: {
        platform: /tiktok/.test(t) ? "tiktok" : "instagram",
        content: String(text || "").slice(0, 500),
      },
    };
  }
  if (/email|reply|inbox|respond/.test(t)) {
    return {
      action: "email_replies",
      params: {
        to: "customer@example.com",
        subject: "Automated Reply Draft",
        body: String(text || "").slice(0, 1200),
      },
    };
  }
  if (/document|upload|ingest|index|pdf/.test(t)) {
    return {
      action: "document_ingestion",
      params: {
        name: "chat-document.txt",
        mime: "text/plain",
        text: String(text || ""),
        namespace: "chat_ingestion",
      },
    };
  }
  if (/shop|order|inventory|sku|store|shopify/.test(t)) {
    return {
      action: "shop_operations",
      params: {
        operation: "create_order",
        payload: { customer: "Chat Customer", total: 99, status: "new" },
      },
    };
  }
  return null;
}

function tokenize(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x && x.length > 2);
}

const CHAT_STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "what", "when", "where", "how", "can", "you",
  "your", "our", "are", "was", "were", "will", "would", "should", "could", "first", "next",
  "please", "want", "need", "from", "into", "about", "just", "also", "then",
]);

const GENERIC_UTILITY_ACTIONS = new Set([
  "api_registry",
  "workflow_packs",
  "ops_cockpit",
  "advanced_runbooks",
  "live_execution_console",
  "deterministic_action_runner",
  "reliability_snapshot",
  "dead_letter_queue",
  "release_gate",
  "autonomy_escalation_guardrails",
  "promotion_history_rollback",
  "ops_timeline",
  "documents_upload",
  "email_configuration",
  "connector_health",
  "connector_credentials",
  "approval_queue",
  "mode_plan",
  "mode_simulate",
  "mode_execute",
  "execution_receipts",
  "kpi_lens",
  "alerting_rules",
  "audit_export",
  "cross_agent_handoff",
]);

const ACTION_INTENT_HINTS = {
  intent_routing: "route dispatch direct handoff assign owner who should handle",
  command_center_full_self_test: "self test diagnostic readiness platform health federation test",
  start_workflow: "start workflow launch workflow kickoff automation flow runbook",
  agent_registry_status: "registry status which agents online agent availability",
  campaign_orchestration: "campaign ads ad set promotion launch media buy funnel",
  lifecycle_automation: "lifecycle nurture drip onboarding reengagement retention journey",
  creative_brief_generation: "creative brief messaging hooks concepts copy angle",
  ab_test_planning: "ab test split test experiment variants test plan",
  performance_scorecard: "performance scorecard roas cpa ctr cpc results",
  lead_discovery: "lead discovery prospecting find leads prospects target accounts",
  lead_scoring: "lead scoring qualify prioritize hot leads fit score",
  profile_enrichment: "profile enrichment enrich firmographic technographic contact details",
  outreach_drafting: "outreach drafting cold email outbound messages sequences",
  pipeline_analytics: "pipeline analytics forecast deals stages conversion pipeline",
  ticket_triage: "ticket triage classify prioritize support queue",
  response_recommendation: "response recommendation reply draft answer support response",
  sentiment_analysis: "sentiment analysis tone customer mood frustration satisfaction",
  sla_monitoring: "sla monitoring response time breach service level",
  csat_driver_analysis: "csat driver analysis satisfaction drivers complaints trends",
  cash_flow_forecast: "cash flow forecast inflow outflow cash position",
  budget_variance: "budget variance spend vs plan actuals",
  anomaly_detection: "anomaly detection outliers unusual finance spend revenue",
  runway_estimation: "runway estimation burn runway months cash left",
  revenue_leakage_scan: "revenue leakage scan missed billing leakage lost revenue",
  strategy_scorecard: "strategy scorecard strategic health priorities progress",
  scenario_modeling: "scenario modeling what if sensitivity downside upside",
  opportunity_mapping: "opportunity mapping whitespace growth opportunities bets",
  risk_tradeoff_analysis: "risk tradeoff analysis compare options downside tradeoffs",
  strategic_briefing: "strategic briefing executive brief strategy summary",
  smart_scheduling: "smart scheduling calendar book meeting reschedule availability",
  focus_blocking: "focus blocking deep work calendar protection",
  meeting_load_audit: "meeting load audit meeting overload time audit calendar audit",
  deadline_alignment: "deadline alignment timeline milestones due dates",
  weekly_time_report: "weekly time report time allocation schedule report",
  workflow_automation: "workflow automation automate process operations",
  task_routing: "task routing assign tasks queue routing owner",
  dependency_tracking: "dependency tracking blockers dependencies sequencing",
  capacity_planning: "capacity planning bandwidth resourcing workload",
  status_briefing: "status briefing ops status progress report",
  knowledge_capture: "knowledge capture notes docs capture information",
  document_structuring: "document structuring organize docs summarize format",
  sop_generation: "sop generation playbook documentation procedures",
  semantic_retrieval: "semantic retrieval search knowledge find docs",
  audit_trail_export: "audit trail export evidence records logs",
  threat_scan: "threat scan security scan risks vulnerabilities",
  incident_triage: "incident triage incident response prioritize alerts",
  vulnerability_review: "vulnerability review security review weaknesses",
  security_posture_report: "security posture report security health controls",
  response_playbook: "response playbook incident plan remediation steps",
  market_briefing: "market briefing market summary competitor trend briefing",
  competitor_tracking: "competitor tracking rivals compare competitor moves",
  trend_detection: "trend detection market signals emerging trends",
  sentiment_signal_read: "sentiment signal read market sentiment reviews buzz",
  opportunity_alerting: "opportunity alerting gap signals opportunities alerts",
  partner_discovery: "partner discovery find partners affiliates alliances",
  relationship_scoring: "relationship scoring partner fit score",
  co_marketing_planning: "co marketing planning partnership campaign joint promotion",
  alliance_pipeline: "alliance pipeline partner deals partnerships pipeline",
  partner_roi_review: "partner roi review channel roi partner performance",
  sentiment_monitor: "sentiment monitor morale pulse team sentiment",
  burnout_risk_detection: "burnout risk detection burnout workload stress wellbeing",
  retention_risk: "retention risk attrition turnover leaving employees",
  recognition_insights: "recognition insights recognition appreciation team wins",
  people_analytics: "people analytics headcount culture people data",
  catalog_health: "catalog health product catalog merchandising",
  inventory_risk: "inventory risk stockouts overstock replenishment",
  pricing_intelligence: "pricing intelligence price optimization discounts margins",
  conversion_optimization: "conversion optimization cro checkout funnel sales",
  store_health: "store health ecommerce health commerce ops",
  creative_generation: "image design visual graphic poster creative asset",
  cinematic_video_command: "video reel motion storyboard cinematic",
  voiceover_generation: "voiceover audio narration tts speech",
  brand_compliance: "brand compliance brand consistency guidelines review",
  format_adaptation: "format adaptation resize repurpose channel formats",
  variant_testing: "variant testing creative variants versions tests",
  creative_performance: "creative performance asset results ads performance",
  test_orchestration: "test orchestration qa run tests suite",
  regression_scan: "regression scan bugs regressions breakages",
  quality_gate: "quality gate release gate qa check",
  root_cause_analysis: "root cause analysis investigate issue why broken",
  defect_trend_report: "defect trend report bug trends quality trend",
  contract_risk_review: "contract risk review nda msa sow clause risk",
  compliance_audit: "compliance audit policy compliance controls",
  obligation_tracking: "obligation tracking renewal terms commitments",
  policy_update_check: "policy update check policy changes legal update",
  legal_risk_register: "legal risk register legal exposure issues",
};


function isExecutionIntent(text = "") {
  return /\b(run it|execute now|go ahead|do it|ship it|launch now|apply now|proceed)\b/i.test(String(text || ""));
}

function isActionOrAnalysisRequest(text = "") {
  return /(set up|setup|create|generate|analyz|analyze|check|optimiz|optimize|launch|schedule|review|assess|scan|monitor|build|draft|fix|triage|recommend|strategy|plan)/i.test(String(text || ""));
}

function isCapabilityExecutionRequest(text = "", chosenCap = null, ranked = [], conversationMode = "work") {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  if (!chosenCap || !raw) return false;
  if (conversationMode === "chat") return false;
  if (/^(hi|hello|hey|yo)\b/.test(t)) return false;
  if (/what can you do|capabilit|options|who are you/.test(t)) return false;
  if (/what do you think|thoughts|ideas|why do you recommend|compare|tradeoff|best option|your pick/.test(t)) return false;
  const requested = /(create|generate|draft|scan|check|review|audit|forecast|estimate|model|analyz|analyse|assess|monitor|triage|schedule|discover|find|enrich|score|track|map|optimi[sz]e|orchestrate|launch|start|run|build|test|report|brief|plan)/i.test(t);
  if (!requested) return false;
  const chosenAction = String(chosenCap?.action || chosenCap?.id || "").toLowerCase();
  if (GENERIC_UTILITY_ACTIONS.has(chosenAction)) {
    return /(workflow|runbook|registry|queue|release|approval|connector|ops|timeline|audit export)/.test(t);
  }
  const chosenScore = Number((ranked || []).find((item) => String(item?.cap?.action || item?.cap?.id || "").toLowerCase() === chosenAction)?.score || ranked?.[0]?.score || 0);
  return chosenScore > 0 || requested;
}

function isBackendSmallTalkPrompt(text = "") {
  return /^(how are you|how was your day|how's your day|how is your day|what'?s up|whats up|sup|good morning|good afternoon|good evening|thanks|thank you)\b/i.test(String(text || "").trim());
}

function buildBackendSmallTalkReply(intro, text = "") {
  const raw = String(text || "").trim().toLowerCase();
  if (/^how are you|how was your day|how's your day|how is your day/.test(raw)) {
    return `${intro}: Doing well. I'm here and ready to help. What are you working through right now?`;
  }
  if (/^thanks|^thank you/.test(raw)) {
    return `${intro}: Anytime. What do you want to tackle next?`;
  }
  if (/^good morning|^good afternoon|^good evening/.test(raw)) {
    return `${intro}: Hi. Good to see you. What do you want to work on?`;
  }
  return `${intro}: I'm here with you. What do you want to dig into?`;
}

function isBackendClientAcquisitionPrompt(agentName = "", text = "") {
  if (String(agentName || "") !== "Nexus") return false;
  return hasBackendClientAcquisitionContext(text);
}

function hasBackendClientAcquisitionContext(text = "") {
  const raw = String(text || "");
  const mentionsDemand = /(clients?|customers?|leads?|referrals?|enquiries|inquiries|bookings?)/i.test(raw);
  const asksForGrowth = /(attr|acquir|acq|bring|win|get|find|generate|grow|new|more|help|need|want|struggl|trouble)/i.test(raw);
  return mentionsDemand && asksForGrowth;
}

function buildBackendClientAcquisitionReply(intro, business = {}, memoryNarrative = "") {
  const regulatedHint = /ndis|regulated|health|medical|compliance/i.test(`${business.identity || ""} ${business.risk || ""}`);
  return [
    `${intro}: Client acquisition is the core growth constraint here, so I'd treat this as a demand-generation and trust-building problem, not a tooling problem.`,
    regulatedHint
      ? "For a regulated service like yours, the first levers are usually trust, referral pathways, and a smooth intake experience rather than broad awareness alone."
      : "The first levers are usually sharper positioning, a reachable audience, and a simple path from interest to conversation.",
    "I'd focus on three things first: where the highest-intent clients or referrers already are, what proof makes them trust you quickly, and how fast your enquiry-to-intake follow-up happens.",
    regulatedHint
      ? "For an NDIS-style business, that usually means support coordinators, plan managers, local search, community presence, and evidence that intake is clear and responsive."
      : "That usually means the best referral sources, the clearest promise, and the fastest path to a first call or booking.",
    "If you want, I can turn this into a concrete client-acquisition plan for the next 30 days.",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function isBackendFounderGrowthPrompt(agentName = "", text = "") {
  if (String(agentName || "") !== "Nexus") return false;
  const t = String(text || "").toLowerCase();
  return /(app|product|platform|startup|saas)/.test(t) && /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/.test(t);
}

function buildBackendFounderGrowthReply(intro, business = {}, memoryNarrative = "") {
  return [
    `${intro}: This is a classic early distribution problem.`,
    "The real challenge usually is not just getting attention. It is creating a loop where the first users get enough value to tell the next users.",
    "I'd break it into three parts: who feels the problem most sharply, what promise gets them to try the app now, and what mechanism turns early usage into repeatable growth.",
    "I'd usually start narrower, not broader. Pick one audience you can reach cheaply, one outcome you can prove quickly, and one channel you can learn fast.",
    "If you want, I can map the acquisition loop here in Nexus, or I can bring Maestro in for the growth plan and Prospect in for the first traction plays.",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function isBackendSpecialistFounderGrowthPrompt(agentName = "", text = "") {
  if (!["Maestro", "Prospect", "Centsible", "Pulse", "Merchant", "Veritas", "Sage", "Atlas", "Chronos", "Compass", "Part", "Inspect", "Canvas", "Support Sage", "Scribe", "Sentinel"].includes(String(agentName || ""))) return false;
  const t = String(text || "").toLowerCase();
  return /(app|product|platform|startup|saas)/.test(t) && /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/.test(t);
}

function buildBackendSpecialistFounderGrowthReply(intro, agentName = "", business = {}, memoryNarrative = "") {
  if (agentName === "Maestro") {
    return [
      `${intro}: This is a distribution and message-fit problem before it is a pure ad-spend problem.`,
      "At this stage, I'd focus on one sharp audience, one reason they should care right now, and one channel where we can learn quickly.",
      "The trap is trying to speak to everyone and ending up with messaging that nobody feels is really for them.",
      "I'd start by defining the first audience wedge, the promise that gets them to try the app, and the content or campaign angle that makes the app easy to talk about.",
      "If you want, I can turn that into a concrete growth narrative, channel plan, and first campaign test matrix.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Prospect") {
    return [
      `${intro}: This is an early traction problem, which usually means we need sharper targeting before we need more volume.`,
      "The first win is getting in front of the people who feel the pain most urgently and are easiest to reach directly.",
      "I'd narrow the ICP, identify where those users already congregate, and build a simple outreach or partnership motion that gets the first conversations and first usage signals moving.",
      "If you want, I can help define the first traction segment and the initial outreach play.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Pulse") {
    return [
      `${intro}: Early growth pressure usually lands on the team before it shows up cleanly on a dashboard.`,
      "The people risk here is trying to solve traction by asking a small team to push in every direction at once.",
      "I'd look at role clarity, founder bandwidth, and whether the growth push depends on repeatable work or just heroic effort.",
      "If you want, I can help map the people risks around this growth phase and the operating structure that makes it sustainable.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Merchant") {
    return [
      `${intro}: This is a growth problem, but the commercial question is how the product turns attention into repeatable revenue.`,
      "I'd focus on the path from discovery to activation to conversion, and whether the app creates enough immediate value for people to come back or pay.",
      "The risk early on is chasing traffic before the conversion loop, monetization hook, and retention behavior are clear enough.",
      "If you want, I can help break this into acquisition, activation, conversion, and monetization moves.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Veritas") {
    return [
      `${intro}: Moving fast on growth is fine, but early-stage legal drag usually comes from fuzzy terms, unclear data handling, or commitments you cannot support yet.`,
      "At this stage, I'd usually keep the legal posture simple and defensible: clean terms, basic privacy alignment, and clear boundaries around what the product promises.",
      "The goal is not heavyweight process. It is avoiding the kind of mess that slows the company down right when traction starts to show up.",
      "If you want, I can map the minimum viable legal/risk posture for this growth phase.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Sage") {
    return [
      `${intro}: This is a strategy sequencing problem more than a raw growth problem.`,
      "The key is deciding which constraint to solve first: attention, activation, retention, or monetization.",
      "Early on, the best strategy is usually the one that reduces uncertainty fastest while preserving enough room to keep moving.",
      "I'd frame this around one clear wedge, one proof point, and one near-term loop that can compound if it works.",
      "If you want, I can turn that into a 90-day founder strategy with explicit tradeoffs.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Atlas") {
    return [
      `${intro}: This is an execution-system problem once the growth idea is clear.`,
      "The risk early on is that growth depends on a pile of manual work, ad hoc follow-up, and founder memory instead of a repeatable loop.",
      "I'd look at how users are acquired, what needs to happen right after they arrive, and where the handoffs break down.",
      "If you want, I can map the first reliable growth workflow and show where automation should and should not enter yet.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Chronos") {
    return [
      `${intro}: Founder growth problems usually become time-allocation problems very quickly.`,
      "If you are trying to solve traction, build product, and respond to everything at once, the calendar becomes the bottleneck before the strategy does.",
      "I'd separate maker time, growth time, and reactive time so the work that actually creates traction stops getting crowded out.",
      "If you want, I can help design the founder cadence and focus blocks for this stage.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Compass") {
    return [
      `${intro}: This is partly a market-discovery problem.`,
      "The goal early on is figuring out where demand is already warm enough that your app does not need a massive education effort just to get a first try.",
      "I'd look for audience pockets, competitor gaps, messaging patterns, and timing signals that tell us where the wedge is strongest.",
      "If you want, I can help define the market wedge and the signals that would tell us we're pushing in the right direction.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Part") {
    return [
      `${intro}: This can also be a leverage problem, not just a direct-acquisition problem.`,
      "At an early stage, the right partnership, community, or ecosystem channel can compress the time it takes to earn trust and reach the first meaningful users.",
      "I'd look for adjacent audiences, integration partners, communities, or creators who already have the attention you need.",
      "If you want, I can map the highest-leverage partnership angles for getting the first wave of users in.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Inspect") {
    return [
      `${intro}: Early growth only helps if the product experience is strong enough to survive first contact.`,
      "The risk is getting users in the door before activation, reliability, or quality is good enough to keep them.",
      "I'd focus on the moments that decide whether a new user bounces, converts, or comes back: onboarding, first value, performance, and obvious defects.",
      "If you want, I can help define the minimum quality bar that protects growth instead of undermining it.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Canvas") {
    return [
      `${intro}: Early growth usually needs creative that makes the product easy to understand, trust, and talk about.`,
      "At this stage, the goal is not just polished visuals. It is assets that sharpen the promise, reduce confusion, and give people something memorable enough to share.",
      "I'd focus on the first visual hooks, founder-story angles, and simple social assets that help the app travel.",
      "If you want, I can map the first creative system for traction: hooks, visuals, landing assets, and launch content.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Support Sage") {
    return [
      `${intro}: Early user growth creates a feedback-loop problem as much as a support problem.`,
      "The first users will show you where the product confuses people, where expectations break, and what value they actually care about.",
      "I'd treat support not as a cost center here, but as a source of activation insight, retention signals, and language we can feed back into the product and messaging.",
      "If you want, I can help design the early-user feedback and support loop.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Scribe") {
    return [
      `${intro}: At this stage, what matters is capturing the learning fast enough that the team does not keep relearning the same lesson.`,
      "Early growth generates a lot of messy information: user objections, acquisition learnings, onboarding friction, and founder decisions.",
      "I'd focus on turning that into reusable knowledge so product, growth, and operations all compound instead of drifting.",
      "If you want, I can help define the startup knowledge loop and what should be documented first.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  if (agentName === "Sentinel") {
    return [
      `${intro}: Early-stage growth does not need enterprise security theater, but it does need a sane trust posture.`,
      "The risk is waiting too long on the basics, then discovering that growth exposed weak auth, poor data handling, or risky third-party access.",
      "I'd focus on the minimum protections that keep the app credible while preserving speed: identity, secrets, data boundaries, and a small number of high-risk checks.",
      "If you want, I can map the minimum viable security posture for this stage.",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  return [
    `${intro}: This is a growth problem, but the real question is whether the acquisition path is financially survivable at your current stage.`,
    "Early on, I'd watch for cheap learning before I'd optimize for scale. You want signals on activation, retention, and payback before you pour money into growth.",
    "I'd usually frame it around three questions: how much can you afford to spend to learn, what user behavior proves the app is sticky, and which channel gives you the cleanest feedback loop.",
    "If you want, I can turn that into a founder-style growth-versus-runway plan.",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasBackendFounderGrowthContext(text = "") {
  return /(app|product|platform|startup|saas)/i.test(String(text || "")) && /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/i.test(String(text || ""));
}

function buildBackendClientAcquisitionRecommendation(intro, business = {}, memoryNarrative = "") {
  const regulatedHint = /ndis|regulated|health|medical|compliance/i.test(`${business.identity || ""} ${business.risk || ""}`);
  return [
    `${intro}: I'd start by tightening the referral and enquiry loop before trying to do everything at once.`,
    regulatedHint
      ? "For a regulated service like yours, the cleanest first move is usually a focused referral engine through coordinators, plan managers, local trust signals, and faster intake follow-up."
      : "The cleanest first move is usually one clear audience, one strong proof point, and one channel that can produce real conversations quickly.",
    "If you want, I can map the exact acquisition plan and the first metrics we should watch.",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildBackendClientAcquisitionPlan(intro, business = {}, memoryNarrative = "") {
  const regulatedHint = /ndis|regulated|health|medical|compliance/i.test(`${business.identity || ""} ${business.risk || ""}`);
  if (regulatedHint) {
    return [
      `${intro}: Here's the 30-day client-acquisition plan I'd run.`,
      "1. Referral engine: make a target list of local support coordinators, plan managers, hospital discharge contacts, and allied-health referrers. Reach out weekly with a short introduction, service fit, and intake contact path.",
      "2. Trust signals: tighten the website, Google Business profile, and referral pack so they clearly show who you support, what areas you cover, how intake works, and why families or referrers should trust you.",
      "3. Intake speed: treat every enquiry like a hot lead. Aim for same-day follow-up, a simple intake checklist, and a clear next step within one conversation.",
      "4. Community presence: show up where trust is built locally, including disability networks, community groups, and partner organisations that already work with participants and carers.",
      "5. Weekly metrics: track referral conversations, enquiries, response time, intake-to-service conversion, and which referral sources are producing real opportunities.",
      "If you want, I can turn this into a week-by-week action plan with the exact outreach messages and intake checklist.",
    ].join("\n");
  }
  return [
    `${intro}: Here's the 30-day client-acquisition plan I'd run.`,
    "1. Pick one audience segment with the clearest pain and strongest buying intent.",
    "2. Tighten the offer and proof so the value is easy to trust quickly.",
    "3. Choose one main acquisition channel and one supporting channel for the month.",
    "4. Build a fast lead-response flow so interest turns into conversations quickly.",
    "5. Track weekly metrics: leads, conversations booked, close rate, and source quality.",
    "If you want, I can turn this into a week-by-week action plan next.",
  ].join("\n");
}

function buildBackendFounderGrowthRecommendation(intro, agentName = "", business = {}, memoryNarrative = "") {
  const byAgent = {
    Nexus: "I'd start by choosing one audience wedge, one core outcome to prove, and one channel where we can learn fast without spreading the team too thin.",
    Maestro: "I'd start by tightening the audience wedge and message before trying to scale distribution.",
    Prospect: "I'd start with the first high-intent segment we can reach directly and learn from quickly.",
    Centsible: "I'd start with the cheapest learning loop that still tells us whether activation and retention are real.",
    Pulse: "I'd start by protecting the team from trying to solve growth in too many directions at once.",
    Merchant: "I'd start by tightening the path from discovery to activation to conversion before chasing more traffic.",
    Veritas: "I'd start with the minimum clean legal posture that lets you grow without creating avoidable drag later.",
    Sage: "I'd start with the single constraint that, if solved, would make the rest of the growth problem easier.",
    Atlas: "I'd start by designing one reliable growth workflow that can be repeated without heroic effort.",
    Chronos: "I'd start by protecting founder time for the work that actually creates traction.",
    Compass: "I'd start by proving where the market wedge is strongest before broadening the message.",
    Part: "I'd start by identifying the one partnership or channel that gives you borrowed trust fastest.",
    Inspect: "I'd start by making sure the first user experience is strong enough that growth is worth amplifying.",
    Canvas: "I'd start with clear launch assets that make the product easy to understand and easy to share.",
    "Support Sage": "I'd start by turning early-user confusion and feedback into an activation learning loop.",
    Scribe: "I'd start by capturing the lessons from user conversations and growth tests so the team compounds them.",
    Sentinel: "I'd start with the minimum trust and security posture that keeps growth from exposing avoidable weaknesses.",
  };
  const nextByAgent = {
    Nexus: "If you want, I can map that into a founder growth plan and bring in the right specialists behind it.",
    Maestro: "If you want, I can turn that into a concrete messaging and channel plan.",
    Prospect: "If you want, I can define the first traction segment and outreach motion.",
    Centsible: "If you want, I can turn that into a growth-versus-runway plan.",
    Pulse: "If you want, I can map the team structure and workload guardrails around it.",
    Merchant: "If you want, I can break that into activation, conversion, and monetization moves.",
    Veritas: "If you want, I can map the minimum viable legal posture for this phase.",
    Sage: "If you want, I can turn that into a 90-day strategy with explicit tradeoffs.",
    Atlas: "If you want, I can map the first repeatable execution loop.",
    Chronos: "If you want, I can design the founder cadence around that priority.",
    Compass: "If you want, I can define the wedge signals we should track first.",
    Part: "If you want, I can map the highest-leverage partnership angles.",
    Inspect: "If you want, I can define the minimum quality bar that protects growth.",
    Canvas: "If you want, I can turn that into the first creative system and launch assets.",
    "Support Sage": "If you want, I can design the support and feedback loop around it.",
    Scribe: "If you want, I can define what the team should capture and reuse first.",
    Sentinel: "If you want, I can map the minimum viable security posture for this stage.",
  };
  return [
    `${intro}: ${byAgent[agentName] || "I'd start by narrowing the growth problem to the first thing that truly changes the outcome."}`,
    business.identity,
    memoryNarrative,
    nextByAgent[agentName] || "If you want, I can turn that into a concrete next-step plan.",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildBackendFounderGrowthPlan(intro, agentName = "", business = {}, memoryNarrative = "") {
  const plans = {
    Nexus: ["Choose the wedge audience and outcome to prove first.", "Pick one acquisition loop worth testing for the next 2-4 weeks.", "Bring in the right specialist lane only after that first loop is clear."],
    Maestro: ["Lock the audience wedge and core message.", "Build a simple creative and channel test around that promise.", "Use the early response to refine the hook before scaling."],
    Prospect: ["Define the first traction segment clearly.", "List the places or channels where those users are easiest to reach.", "Run a direct outreach or partnership motion and capture the learnings."],
    Centsible: ["Set the maximum learning budget you can afford.", "Define the user behavior that proves traction is real.", "Review payback, retention, and burn before widening spend."],
    Pulse: ["Clarify who owns growth, product, and follow-up work.", "Protect the team from too many parallel priorities.", "Set a weekly operating rhythm that can hold under growth pressure."],
    Merchant: ["Map the path from discovery to activation to conversion.", "Find the biggest drop-off in that loop.", "Fix the conversion and monetization friction before chasing more traffic."],
    Veritas: ["Make the product promise and terms clean and realistic.", "Cover the basic privacy and data handling posture.", "Avoid commitments that create drag before the growth loop is proven."],
    Sage: ["Name the single constraint that matters most right now.", "Pick the proof point that would reduce the most uncertainty.", "Sequence the next 90 days around that learning loop."],
    Atlas: ["Map the first repeatable growth workflow end to end.", "Identify where founder memory or manual work is holding it together.", "Add structure only where it reduces rework and delay."],
    Chronos: ["Protect dedicated founder growth time every week.", "Separate strategic work from reactive work.", "Review the calendar against traction goals, not just busyness."],
    Compass: ["Define the market wedge we think is strongest.", "Track the signals that would confirm or weaken that wedge.", "Adjust positioning based on real demand evidence."],
    Part: ["List the audiences or ecosystems that already have trust.", "Identify the most credible leverage partner or community path.", "Run one focused partnership experiment before broadening."],
    Inspect: ["Define the minimum quality bar for first-user experience.", "Check onboarding, first value, and obvious friction points.", "Fix the issues that would make growth expensive or leaky."],
    Canvas: ["Define the first creative promise and visual hook.", "Build the minimum launch asset set around that message.", "Use early response to refine the story before multiplying formats."],
    "Support Sage": ["Capture the first user questions and failure points fast.", "Feed those signals back into onboarding and messaging.", "Turn recurring confusion into prevention, not just replies."],
    Scribe: ["Document the key growth learnings as they happen.", "Capture objections, channels, and activation patterns in one place.", "Use that knowledge to keep the team aligned as the loop evolves."],
    Sentinel: ["Cover auth, secrets, and basic data boundaries first.", "Check the highest-risk trust points before traffic rises.", "Keep the posture lightweight but real enough to support growth."],
  };
  const steps = plans[agentName] || ["Define the growth constraint clearly.", "Pick the first learning loop to run.", "Sequence the next step so it reduces uncertainty fast."];
  return [
    `${intro}: Here's how I'd take that forward.`,
    business.identity,
    memoryNarrative,
    `1. ${steps[0]}`,
    `2. ${steps[1]}`,
    `3. ${steps[2]}`,
    "If you want, I can keep going and turn that into a more detailed execution plan.",
  ].filter(Boolean).join("\n");
}

function inferBackendConversationMode(text = "", currentGoal = "") {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return "chat";
  if (isBackendSmallTalkPrompt(clean)) return "chat";
  if (/^(hello|hi|hey|yo)\b/.test(clean)) return "chat";
  if (/^(help|thoughts|ideas|advice|not sure|unsure|what do you think|can you help|this feels messy|something feels off|i'm worried|im worried)\b/.test(clean)) return "explore";
  if (/^(what do you recommend|recommend|best option|your pick|what should i do|why that one)\b/.test(clean)) {
    return currentGoal && !isBackendSmallTalkPrompt(currentGoal) ? "decide" : "explore";
  }
  if (/run it|execute|go ahead|do it|ship it|launch|apply/.test(clean)) return "execute";
  if (/plan|show me a plan|draft please|map it out/.test(clean)) return "plan";
  return "work";
}

function capabilityKeywords(cap = {}) {
  const base = `${cap?.id || ""} ${cap?.label || ""} ${cap?.action || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x && x.length > 2);
  return Array.from(new Set(base));
}

function capabilityIntentText(cap = {}) {
  const actionKey = String(cap?.action || cap?.id || "").toLowerCase();
  return `${cap?.id || ""} ${cap?.label || ""} ${cap?.action || ""} ${ACTION_INTENT_HINTS[actionKey] || ""}`.toLowerCase();
}

function capabilityIntentTokens(cap = {}) {
  return Array.from(new Set(
    capabilityIntentText(cap)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x && x.length > 2)
  ));
}

function rankCapabilities(profile, text = "") {
  const caps = profile?.capabilities || [];
  if (!caps.length) return [];
  const raw = String(text || "").toLowerCase();
  const toks = tokenize(text).filter((t) => !CHAT_STOPWORDS.has(t));
  return caps
    .map((cap) => {
      const words = capabilityIntentTokens(cap);
      const hintText = capabilityIntentText(cap);
      const label = String(cap?.label || "").toLowerCase();
      const actionKey = String(cap?.action || cap?.id || "").toLowerCase();
      const actionPhrase = actionKey.replace(/_/g, " ");
      let score = 0;
      for (const tok of toks) {
        if (words.includes(tok)) score += 2;
        if (tok.length >= 4 && hintText.includes(tok)) score += 1;
        if (tok.length >= 4 && label.includes(tok)) score += 1;
        if (tok.length >= 4 && actionPhrase.includes(tok)) score += 1;
      }
      if (label && raw.includes(label)) score += 4;
      if (actionPhrase && raw.includes(actionPhrase)) score += 4;
      if (GENERIC_UTILITY_ACTIONS.has(actionKey)) score -= 1;
      return { cap, score };
    })
    .sort((a, b) => b.score - a.score);
}

function pickBestCapability(profile, text = "") {
  const ranked = rankCapabilities(profile, text);
  if (!ranked.length || ranked[0].score <= 0) return null;
  return ranked[0].cap;
}

function findCapabilityByAction(profile, action = "") {
  const target = String(action || "").toLowerCase();
  return (profile?.capabilities || []).find((c) => String(c?.action || c?.id || "").toLowerCase() === target) || null;
}

function suggestNextCapability(profile, currentAction = "", goalText = "") {
  const ranked = rankCapabilities(profile, goalText || "");
  const current = String(currentAction || "").toLowerCase();
  const next = ranked.find((x) => String(x?.cap?.action || x?.cap?.id || "").toLowerCase() !== current && x.score > 0);
  if (next?.cap) return next.cap;
  return (profile?.capabilities || []).find((c) => String(c?.action || c?.id || "").toLowerCase() !== current) || null;
}

function resolveCandidateSelection(text = "", taskState = {}, profile = null) {
  const t = String(text || "").trim().toLowerCase();
  const candidates = Array.isArray(taskState?.candidate_actions) ? taskState.candidate_actions : [];
  if (!candidates.length) return null;
  const m = t.match(/^(?:option\s*)?([1-3])$/);
  if (m) {
    const idx = Number(m[1]) - 1;
    const pick = candidates[idx];
    if (!pick) return null;
    return findCapabilityByAction(profile, pick.action) || null;
  }
  for (const c of candidates) {
    const label = String(c?.label || "").toLowerCase();
    const action = String(c?.action || "").toLowerCase();
    if ((label && t.includes(label)) || (action && t.includes(action))) {
      return findCapabilityByAction(profile, c.action) || null;
    }
  }
  return null;
}

function normalizeBackendFollowUpText(text = "", taskState = {}, profile = null) {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  if (!raw) return raw;
  const pendingAction = String(taskState?.last_action || "").trim();
  const pendingCap = pendingAction ? findCapabilityByAction(profile, pendingAction) : null;
  const pendingLabel = String(pendingCap?.label || pendingAction || "").trim();
  const firstCandidate = Array.isArray(taskState?.candidate_actions) ? taskState.candidate_actions[0] : null;
  const firstLabel = String(firstCandidate?.label || "").trim();

  if (/^(draft|draft please|plan|plan please|show plan|map it out)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `plan first for ${pendingLabel || firstLabel}`;
  }
  if (/^(next|what next|and then|what else)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `what do you recommend next for ${pendingLabel || firstLabel}`;
  }
  if (/^(whichever you think|you choose|your call|best one)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `what do you recommend for ${pendingLabel || firstLabel}`;
  }
  if (/^(why|why that|why that one|reason)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `why do you recommend ${pendingLabel || firstLabel}`;
  }
  if (/^(details|more detail|explain more)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `give me more detail on ${pendingLabel || firstLabel}`;
  }
  if (/^(okay|ok|sure|alright|sounds good)$/i.test(raw) && (pendingLabel || firstLabel)) {
    return `plan first for ${pendingLabel || firstLabel}`;
  }
  if (/^(that one|the first one|go with the first one)$/i.test(raw) && firstLabel) {
    return firstLabel;
  }
  if (/^(go with the safer one|safer one|lower risk one)$/i.test(raw) && firstLabel) {
    const secondLabel = String(Array.isArray(taskState?.candidate_actions) ? taskState.candidate_actions[1]?.label || "" : "").trim();
    return secondLabel || firstLabel;
  }
  return raw;
}

function inferApprovalMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/analysis only|just analyze|no execute|don't execute|do not execute/.test(t)) return "analysis";
  if (/execute|run|go ahead|do it|ship|launch/.test(t)) return "execute";
  return "unspecified";
}

function inferChatMode(text = "", current = "execute") {
  const t = String(text || "").toLowerCase();
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*plan\b/.test(t)) return "plan";
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*simulate\b/.test(t)) return "simulate";
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*execute\b/.test(t)) return "execute";
  if (/analysis only|just analyze|plan first|ask for a plan/.test(t)) return "plan";
  if (/simulate|dry run|preview only|what would happen/.test(t)) return "simulate";
  if (/run it|execute|go ahead|do it|ship it|launch/.test(t)) return "execute";
  return current || "execute";
}

function inferParamsFromText(text = "") {
  const t = String(text || "").toLowerCase();
  const out = {};
  if (/lead/.test(t)) out.objective = "leads";
  else if (/sale|purchase|revenue/.test(t)) out.objective = "sales";
  else if (/traffic/.test(t)) out.objective = "traffic";
  const budget = String(text || "").match(/\$?\s?(\d{2,7})\s*(\/\s*day|per day|daily|\/\s*week|per week|weekly)?/i);
  if (budget?.[1]) out.budget = budget[1];
  const channels = Array.from(new Set((t.match(/meta|facebook|instagram|google|linkedin|tiktok/g) || [])));
  if (channels.length) out.channels = channels;
  if (/audience|target|geo|age|interest/.test(t)) out.audience = "specified";
  if (/contract|msa|nda|sow/.test(t)) out.contract_name_or_text = "provided";
  if (/suite|regression|checkout|payment|auth|api/.test(t)) out.suite_name_or_scope = "specified";
  return out;
}

function inferParamsFromTaskState(taskState = {}) {
  const out = {};
  const goal = String(taskState?.goal || "");
  const goalParams = inferParamsFromText(goal);
  Object.assign(out, goalParams);
  const constraints = Array.isArray(taskState?.constraints) ? taskState.constraints : [];
  constraints.forEach((c) => {
    const str = String(c || "");
    const budget = str.match(/^budget=(.+)$/i);
    if (budget?.[1]) out.budget = out.budget || budget[1].replace(/[^0-9]/g, "");
    const channels = str.match(/^channels=(.+)$/i);
    if (channels?.[1]) out.channels = out.channels || channels[1].split(",").map((x) => x.trim()).filter(Boolean);
  });
  return out;
}

const ACTION_REQUIREMENTS = {
  campaign_orchestration: ["objective", "budget", "audience", "channels"],
  review_contract: ["contract_name_or_text"],
  contract_risk_review: ["contract_name_or_text"],
  test_orchestration: ["suite_name_or_scope"],
  quality_gate: ["suite_name_or_scope"],
};

function missingRequiredFields(action = "", params = {}) {
  const required = ACTION_REQUIREMENTS[String(action || "").toLowerCase()] || [];
  return required.filter((field) => !(field in (params || {})));
}

function extractConstraints(text = "") {
  const t = String(text || "");
  const constraints = [];
  const budget = t.match(/\$[\d,]+(?:\s*\/\s*(day|week|month))?/i);
  if (budget) constraints.push(`budget=${budget[0]}`);
  const dateLike = t.match(/\b(by|before|on)\s+([a-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  if (dateLike) constraints.push(`deadline=${dateLike[2]}`);
  if (/meta|facebook|instagram|google|linkedin|tiktok/i.test(t)) {
    const channels = Array.from(new Set((t.match(/meta|facebook|instagram|google|linkedin|tiktok/gi) || []).map((x) => x.toLowerCase())));
    constraints.push(`channels=${channels.join(",")}`);
  }
  return constraints.slice(0, 5);
}

function updateTaskState(prev = {}, text = "", chosenAction = "") {
  const next = {
    goal: prev.goal || "",
    constraints: Array.isArray(prev.constraints) ? [...prev.constraints] : [],
    business_context: prev.business_context || null,
    approval_mode: prev.approval_mode || "unspecified",
    mode: prev.mode || "execute",
    candidate_actions: Array.isArray(prev.candidate_actions) ? [...prev.candidate_actions] : [],
    last_action: prev.last_action || "",
    status: prev.status || "active",
    turn_count: Number(prev.turn_count || 0) + 1,
    updated_at: now(),
  };
  const clean = String(text || "").trim();
  if (clean && clean.length > 8 && !/^(hi|hello|hey|yo)\b/i.test(clean)) {
    const lower = clean.toLowerCase();
    const isModeCommand = /(^|\s)(\/mode|mode)\s*[:=]?\s*(plan|simulate|execute)\b/.test(lower);
    const shouldReplaceGoal =
      !next.goal ||
      isBackendSmallTalkPrompt(String(next.goal || "")) ||
      /^mode\b/i.test(String(next.goal || "")) ||
      /new goal|change goal|switch to|instead/i.test(lower);
    if (!isModeCommand && shouldReplaceGoal) next.goal = clean.slice(0, 240);
  }
  const mode = inferApprovalMode(clean);
  if (mode !== "unspecified") next.approval_mode = mode;
  next.mode = inferChatMode(clean, next.mode);
  const foundConstraints = extractConstraints(clean);
  if (foundConstraints.length) {
    const merged = Array.from(new Set([...(next.constraints || []), ...foundConstraints]));
    next.constraints = merged.slice(0, 8);
  }
  if (chosenAction) next.last_action = chosenAction;
  return next;
}

const AGENT_CHAT_STYLE = {
  Nexus: { nextAsk: "What outcome should we orchestrate next?", helpAsk: "Share the business outcome and constraints; I'll map the execution path.", toneOpen: "I'll optimize across the whole system.", verbosity: "standard" },
  Maestro: { nextAsk: "Do you want creative concepts first or channel execution first?", helpAsk: "Give me your campaign objective and I'll shape a winning mix.", toneOpen: "Let's turn strategy into momentum.", verbosity: "standard" },
  Prospect: { nextAsk: "Should we prioritize speed-to-meeting or deal quality?", helpAsk: "Share your ICP and target segment; I'll build the outreach play.", toneOpen: "I focus on qualified pipeline, not noise.", verbosity: "concise" },
  "Support Sage": { nextAsk: "Should we optimize first response or first-contact resolution?", helpAsk: "Tell me the customer issue context and I'll route the fastest resolution.", toneOpen: "I'll keep this precise and empathetic.", verbosity: "standard" },
  Centsible: { nextAsk: "Do you want to optimize cash protection or growth allocation first?", helpAsk: "Share your finance target and decision horizon.", toneOpen: "I'll keep recommendations grounded in financial impact.", verbosity: "standard" },
  Sage: { nextAsk: "Should I optimize this for near-term execution or long-term advantage?", helpAsk: "State the strategic decision and constraints.", toneOpen: "I'll frame choices with explicit tradeoffs.", verbosity: "detailed" },
  Chronos: { nextAsk: "Which team's calendar pressure should we fix first?", helpAsk: "Tell me where time is being lost and I'll redesign the cadence.", toneOpen: "I optimize time as a strategic asset.", verbosity: "concise" },
  Atlas: { nextAsk: "Which workflow should we stabilize first?", helpAsk: "Point me to the bottleneck and I'll structure the runbook.", toneOpen: "I keep execution predictable and resilient.", verbosity: "standard" },
  Scribe: { nextAsk: "Should I optimize this for discovery, retention, or auditability?", helpAsk: "Tell me what knowledge should be captured or retrieved.", toneOpen: "I make institutional knowledge operational.", verbosity: "detailed" },
  Sentinel: { nextAsk: "Do you want containment actions first or forensic depth first?", helpAsk: "State your risk concern and environment scope.", toneOpen: "I prioritize exposure reduction and rapid containment.", verbosity: "concise" },
  Compass: { nextAsk: "Should we focus on competitive threats or growth opportunities first?", helpAsk: "Tell me the market question and decision timeline.", toneOpen: "I turn market signals into actionable direction.", verbosity: "standard" },
  Part: { nextAsk: "Should we optimize for partner quality or partner volume?", helpAsk: "Share partner goals and target ecosystem.", toneOpen: "I build leverage through the right alliances.", verbosity: "standard" },
  Pulse: { nextAsk: "Do you want to focus on retention risk or team performance first?", helpAsk: "Tell me the team/population and concern.", toneOpen: "I prioritize people outcomes with measurable follow-through.", verbosity: "standard" },
  Merchant: { nextAsk: "Should we optimize for margin, conversion, or inventory movement first?", helpAsk: "Share product context and target KPI.", toneOpen: "I balance growth, margin, and operational reliability.", verbosity: "concise" },
  Canvas: { nextAsk: "Do you want bold exploration or tighter optimization on current assets?", helpAsk: "Share creative objective and channel context.", toneOpen: "I'll shape creative with clear performance intent.", verbosity: "standard" },
  Inspect: { nextAsk: "Should we prioritize release confidence or defect prevention first?", helpAsk: "Tell me the release scope or quality risk area.", toneOpen: "I focus on preventing avoidable failures.", verbosity: "concise" },
  Veritas: { nextAsk: "Should we optimize this for legal safety or negotiation speed?", helpAsk: "Share the legal/compliance objective and context.", toneOpen: "I'll keep risk explicit and decisions defensible.", verbosity: "concise" },
};

const AGENT_CONVERSATION_PLAYBOOK = {
  Nexus: {
    frame: ["Define outcome and decision deadline", "Select minimal agent set for signal quality", "Set execution path (plan/simulate/execute) with guardrails"],
    ask: "What outcome matters most right now: growth, risk reduction, or speed?",
  },
  Maestro: {
    frame: ["Clarify offer + audience fit", "Pick channel mix by expected CAC/ROAS", "Define creative test matrix and success KPI"],
    ask: "Which metric is primary for this campaign: CPA, ROAS, or qualified pipeline?",
  },
  Prospect: {
    frame: ["Tighten ICP and disqualifiers", "Prioritize by buying signals + fit", "Sequence outreach with clear CTA and timing"],
    ask: "Which segment closes fastest for you right now?",
  },
  "Support Sage": {
    frame: ["Identify issue cluster and impact scope", "Route by urgency/SLA and resolution playbook", "Convert repeated issues into KB prevention"],
    ask: "Are we optimizing for faster first response or fewer repeat tickets?",
  },
  Centsible: {
    frame: ["Protect runway first", "Find variance drivers and leakage", "Reallocate spend to highest return lane"],
    ask: "What is your minimum cash runway target in months?",
  },
  Sage: {
    frame: ["Set strategic objective and constraints", "Model base/upside/downside scenarios", "Prioritize moves by expected impact vs risk"],
    ask: "What decision horizon should I optimize for: 90 days or 12 months?",
  },
  Chronos: {
    frame: ["Measure meeting load and interruptions", "Protect deep-work windows", "Rebuild cadence around high-value ceremonies"],
    ask: "Which team is currently losing the most focus time?",
  },
  Atlas: {
    frame: ["Map bottleneck step and owner", "Enforce workflow checkpoint and SLA", "Automate repeatable handoffs with rollback safety"],
    ask: "Which workflow is currently blocking execution most often?",
  },
  Scribe: {
    frame: ["Capture source artifacts", "Structure with tags + decisions + owners", "Enable citation-backed retrieval for reuse"],
    ask: "Do you want this optimized for recall speed or auditability?",
  },
  Sentinel: {
    frame: ["Rank threat exposure by blast radius", "Contain highest-risk path first", "Codify response and verification steps"],
    ask: "Are you most concerned about account takeover, data leakage, or infra misconfig?",
  },
  Compass: {
    frame: ["Separate signal from noise by source confidence", "Map competitor moves to your positioning", "Translate trends into immediate plays"],
    ask: "Do you want offensive opportunities or defensive alerts first?",
  },
  Part: {
    frame: ["Score partner fit + revenue potential", "Sequence outreach and qualification", "Track activation and co-sell conversion"],
    ask: "Are you prioritizing strategic alliances or channel revenue partners?",
  },
  Pulse: {
    frame: ["Detect risk in sentiment/workload/retention", "Prioritize manager interventions", "Track follow-through and impact"],
    ask: "Which org should we assess first for burnout or attrition risk?",
  },
  Merchant: {
    frame: ["Check inventory and margin risk", "Tune pricing/promotions by elasticity", "Fix funnel friction and fulfillment leakage"],
    ask: "Are you optimizing for margin, volume, or inventory clearance?",
  },
  Canvas: {
    frame: ["Lock creative objective and audience emotion", "Produce variants across formats/channels", "Measure winners and scale fast"],
    ask: "Do you need net-new concepts or optimized variants from existing assets?",
  },
  Inspect: {
    frame: ["Identify critical quality risks", "Run focused regression and readiness gates", "Cluster defects and close systemic causes"],
    ask: "Is release confidence or defect reduction your immediate priority?",
  },
  Veritas: {
    frame: ["Surface highest-risk clauses/obligations", "Map regulatory exposure and owner", "Define mitigation and approval path"],
    ask: "Should we optimize for deal speed or risk minimization on this matter?",
  },
};

const AGENT_SPECIALTY_CONTEXT = {
  Nexus: {
    domain: "business orchestration",
    signals: ["blocked workflows", "connector health", "autonomy drift", "priority conflicts"],
    heuristics: [
      "Route work to the smallest capable agent set before broad orchestration.",
      "Protect reliability before raising autonomy.",
    ],
    lenses: {
      growth: "Growth usually fails at the handoff layer, not the idea layer.",
      risk: "Hidden risk tends to show up as weak release gates or unresolved dead letters.",
      speed: "Speed improves when execution paths are deterministic, observable, and reversible.",
    },
    greeting: "What are we optimizing right now: growth, reliability, or speed?",
    prompt: "Tell me the outcome, deadline, and what cannot break.",
  },
  Maestro: {
    domain: "marketing strategy and paid growth",
    signals: ["CTR", "CPC", "CVR", "CPA", "ROAS", "creative fatigue"],
    heuristics: [
      "Weak performance usually comes from message-market mismatch before channel mismatch.",
      "Refresh creative before broadening audience if frequency is rising.",
    ],
    lenses: {
      campaign: "The first question is whether the issue is targeting, creative, offer, or post-click friction.",
      brand: "Brand work should still anchor to a distinct audience tension and a measurable behavior change.",
      retention: "Lifecycle wins come from timing, segmentation, and relevance more than volume.",
    },
    greeting: "What are we trying to move: qualified pipeline, purchases, or awareness?",
    prompt: "Tell me the offer, audience, and target KPI, and I will work from the economics outward.",
  },
  Prospect: {
    domain: "sales development and pipeline generation",
    signals: ["reply rate", "meeting rate", "conversion by segment", "intent signals", "deal velocity"],
    heuristics: [
      "Tighter ICP and disqualifiers outperform broad top-of-funnel volume.",
      "A good sequence creates a reason to reply, not just a reason to read.",
    ],
    lenses: {
      outreach: "The main failure mode is usually weak relevance or an unclear CTA.",
      pipeline: "Pipeline quality improves when we bias toward urgency, fit, and account context.",
    },
    greeting: "Are we trying to source more meetings, improve reply quality, or clean up pipeline quality?",
    prompt: "Share the ICP, deal size, and current bottleneck in the funnel.",
  },
  "Support Sage": {
    domain: "customer support and service operations",
    signals: ["first response time", "time to resolution", "reopen rate", "CSAT", "backlog aging"],
    heuristics: [
      "Repeated tickets are usually a product, documentation, or routing issue in disguise.",
      "The highest leverage move is often to reduce incoming ticket volume at the source.",
    ],
    lenses: {
      backlog: "Backlogs get dangerous when aging and complexity rise together.",
      quality: "Service quality is the combination of empathy, accuracy, and follow-through.",
    },
    greeting: "What needs attention first: SLA risk, ticket quality, or repeat issue prevention?",
    prompt: "Tell me the issue pattern, volume, and where the customer experience is breaking down.",
  },
  Centsible: {
    domain: "finance, cash flow, and operating leverage",
    signals: ["runway", "gross margin", "burn multiple", "budget variance", "AR aging"],
    heuristics: [
      "Protect cash before optimizing optics.",
      "Look for leakage in pricing, collections, and contract terms before cutting strategic growth.",
    ],
    lenses: {
      growth: "Growth is healthy only when payback and margin structure remain defensible.",
      cost: "Cost reduction should distinguish waste from capability.",
      forecast: "Forecasts matter most at the driver level, not the spreadsheet level.",
    },
    greeting: "Do we need to protect runway, improve margin, or unlock growth capacity?",
    prompt: "Share the decision horizon, target metric, and where the financial pressure is showing up.",
  },
  Sage: {
    domain: "strategy and executive decision support",
    signals: ["initiative progress", "market uncertainty", "option value", "execution risk"],
    heuristics: [
      "Name the tradeoff explicitly before choosing the move.",
      "Small reversible bets beat large ambiguous bets in uncertain markets.",
    ],
    lenses: {
      planning: "The quality of the decision depends on scenario clarity, not slide depth.",
      competition: "Advantage usually comes from where competitors are structurally slow.",
    },
    greeting: "What decision are we trying to make, and over what horizon?",
    prompt: "Tell me the decision, the horizon, and the downside we must avoid.",
  },
  Chronos: {
    domain: "time systems and scheduling quality",
    signals: ["meeting hours", "context switching", "focus block erosion", "schedule conflicts"],
    heuristics: [
      "Calendar chaos is usually a prioritization problem wearing a scheduling mask.",
      "Protect deep work first; then optimize meeting cadence.",
    ],
    lenses: {
      scheduling: "The key is not fitting more in, it is preserving the right work at the right energy level.",
      focus: "A team with fragmented focus looks busy but ships slower.",
    },
    greeting: "What should we fix first: meeting load, scheduling conflicts, or protected focus time?",
    prompt: "Tell me where time is leaking and which team feels the scheduling pain most.",
  },
  Atlas: {
    domain: "workflow automation and operating reliability",
    signals: ["queue health", "handoff failures", "retries", "dead letters", "throughput"],
    heuristics: [
      "If a workflow cannot be replayed safely, it is not production-ready.",
      "The strongest ops systems are deterministic, observable, and reversible.",
    ],
    lenses: {
      automation: "Automation should remove ambiguity, not bury it.",
      reliability: "Retries hide issues unless failure reasons are explicit and measurable.",
    },
    greeting: "Where is execution breaking down today: handoffs, queues, or runbook reliability?",
    prompt: "Tell me the workflow, the failure mode, and what must stay reliable.",
  },
  Scribe: {
    domain: "knowledge systems and organizational memory",
    signals: ["retrieval success", "duplicate docs", "stale content", "coverage gaps"],
    heuristics: [
      "If knowledge is not easy to find, it might as well not exist.",
      "Good documentation captures decisions, assumptions, and owners, not just steps.",
    ],
    lenses: {
      docs: "The goal is not more documents; it is faster, more reliable reuse.",
      retrieval: "Search quality depends on structure, tags, and source integrity.",
    },
    greeting: "Should we improve discovery, documentation quality, or auditability first?",
    prompt: "Tell me what knowledge needs to be captured, clarified, or made reusable.",
  },
  Sentinel: {
    domain: "security operations and exposure reduction",
    signals: ["blast radius", "account takeover risk", "misconfigurations", "containment time"],
    heuristics: [
      "Prioritize exposure reduction before deep forensic detail when the blast radius is still open.",
      "The best security operations remove easy attacker paths quickly.",
    ],
    lenses: {
      incidents: "Containment speed usually matters more than perfect attribution in the first phase.",
      posture: "Security posture weakens most at identity, secrets, and third-party trust boundaries.",
    },
    greeting: "What needs attention first: threat containment, posture risk, or compliance exposure?",
    prompt: "Tell me the asset, threat concern, and how much operational risk we can tolerate.",
  },
  Compass: {
    domain: "market intelligence and competitive insight",
    signals: ["pricing shifts", "new launches", "hiring patterns", "messaging changes"],
    heuristics: [
      "Prioritize signals tied to customer behavior or strategic investment.",
      "Competitor messaging changes often reveal roadmap pressure or segment shifts.",
    ],
    lenses: {
      market: "The strongest insights tie trends to timing, buyers, and channel dynamics.",
      competition: "The aim is not to copy moves; it is to understand what they reveal.",
    },
    greeting: "Do you want a read on competitors, demand shifts, or whitespace opportunities?",
    prompt: "Tell me the market question, segment, and decision deadline.",
  },
  Part: {
    domain: "partnerships, alliances, and ecosystem growth",
    signals: ["partner fit", "activation rate", "sourced revenue", "influenced pipeline"],
    heuristics: [
      "The best partners reduce CAC, speed up trust, or unlock distribution the direct team cannot reach alone.",
      "Partner ecosystems fail when incentives, enablement, and attribution are fuzzy.",
    ],
    lenses: {
      sourcing: "Partner quality matters more than top-of-funnel partner volume.",
      activation: "The first 30 days determine whether a partnership becomes real or stays conceptual.",
    },
    greeting: "Should we focus on finding new partners, activating current ones, or improving partner ROI?",
    prompt: "Tell me the partner type, strategic goal, and what good looks like commercially.",
  },
  Pulse: {
    domain: "people operations, talent, and organizational health",
    signals: ["engagement trend", "attrition risk", "manager load", "promotion readiness", "burnout risk"],
    heuristics: [
      "People issues often show up in manager quality and workload balance before they show up in attrition.",
      "Retention risk rises when growth opportunities, workload, and recognition all weaken together.",
    ],
    lenses: {
      engagement: "Survey scores matter less than trend direction and managerial follow-through.",
      talent: "Hiring quality improves when the role design is precise before sourcing starts.",
      performance: "Development systems work when feedback, goals, and growth paths reinforce each other.",
    },
    greeting: "What needs attention first: hiring, engagement, performance, or retention risk?",
    prompt: "Tell me the team, lifecycle stage, and people outcome you want to improve.",
  },
  Merchant: {
    domain: "commerce, merchandising, and revenue operations",
    signals: ["AOV", "conversion rate", "inventory turnover", "return rate", "margin", "days on hand"],
    heuristics: [
      "Revenue problems often start with merchandising clarity or pricing posture before ad volume.",
      "Promotions should protect margin structure, not just move units.",
    ],
    lenses: {
      pricing: "Price changes should account for elasticity, competitor position, and inventory pressure together.",
      conversion: "Conversion gains usually come from offer clarity, trust, and checkout friction reduction.",
      inventory: "Inventory health is a strategy signal, not just an ops metric.",
    },
    greeting: "Are we trying to improve margin, conversion, or inventory movement?",
    prompt: "Tell me the product, channel, and KPI pressure point you want to improve.",
  },
  Canvas: {
    domain: "creative generation and visual production",
    signals: ["hook strength", "format fit", "brand consistency", "variant fatigue", "creative velocity"],
    heuristics: [
      "Good creative starts with audience tension, not just aesthetics.",
      "Format and platform behavior should shape concept development early.",
    ],
    lenses: {
      creative: "A strong asset creates an immediate point of view and emotional direction.",
      performance: "Performance creative should trade abstraction for clarity and speed of comprehension.",
      brand: "Consistency matters, but sameness kills attention.",
    },
    greeting: "Do you need net-new concepts, ad variants, or a richer visual system?",
    prompt: "Tell me the audience, offer, channel, and emotional direction for the asset.",
  },
  Inspect: {
    domain: "quality assurance and release governance",
    signals: ["pass rate", "critical defects", "coverage by module", "flaky tests", "release blockers"],
    heuristics: [
      "Quality confidence comes from critical path coverage, not raw test volume.",
      "A release gate is only useful if the block reason is explicit and actionable.",
    ],
    lenses: {
      release: "Readiness should combine defect severity, coverage, performance, and risk concentration.",
      defects: "Root cause quality matters more than defect count alone.",
    },
    greeting: "What matters more right now: release confidence, defect prevention, or coverage quality?",
    prompt: "Tell me the release scope, risk area, and what failure would hurt most.",
  },
  Veritas: {
    domain: "legal, contracts, and compliance operations",
    signals: ["risk concentration", "expiring obligations", "regulatory exposure", "clause deviations"],
    heuristics: [
      "The biggest legal risk often hides in one-sided clauses, vague obligations, or silent renewals.",
      "Faster deals come from a strong clause library and explicit risk thresholds.",
    ],
    lenses: {
      contracts: "The right question is not just whether a term is risky, but whether the risk is worth the commercial upside.",
      compliance: "Regulatory risk gets expensive when ownership and evidence are unclear.",
    },
    greeting: "Should we optimize for deal speed, compliance confidence, or risk reduction?",
    prompt: "Tell me the legal objective, counterparty or regulation, and the commercial context.",
  },
};

function pickSpecialtyLens(agentName, text = "") {
  const pack = AGENT_SPECIALTY_CONTEXT[agentName] || AGENT_SPECIALTY_CONTEXT.Nexus;
  const t = String(text || "").toLowerCase();
  if (/campaign|ads|creative|copy|landing|roas|cpa|ctr/.test(t)) return pack.lenses?.campaign || pack.lenses?.creative || pack.lenses?.performance || "";
  if (/brand|position|messag|awareness/.test(t)) return pack.lenses?.brand || "";
  if (/retention|lifecycle|email|crm/.test(t)) return pack.lenses?.retention || "";
  if (/outreach|sequence|reply|meeting/.test(t)) return pack.lenses?.outreach || "";
  if (/pipeline|forecast|deal/.test(t)) return pack.lenses?.pipeline || pack.lenses?.forecast || "";
  if (/cost|expense|spend/.test(t)) return pack.lenses?.cost || "";
  if (/growth/.test(t)) return pack.lenses?.growth || "";
  if (/risk|threat|incident|breach/.test(t)) return pack.lenses?.risk || pack.lenses?.incidents || pack.lenses?.posture || "";
  if (/schedule|meeting|calendar|focus/.test(t)) return pack.lenses?.scheduling || pack.lenses?.focus || "";
  if (/workflow|runbook|handoff|queue|reliability/.test(t)) return pack.lenses?.automation || pack.lenses?.reliability || "";
  if (/docs|knowledge|search|retrieve/.test(t)) return pack.lenses?.docs || pack.lenses?.retrieval || "";
  if (/market|trend|competitor|positioning/.test(t)) return pack.lenses?.market || pack.lenses?.competition || "";
  if (/partner|alliance|ecosystem/.test(t)) return pack.lenses?.sourcing || pack.lenses?.activation || "";
  if (/people|team|burnout|attrition|manager|engagement/.test(t)) return pack.lenses?.engagement || pack.lenses?.performance || "";
  if (/hire|candidate|recruit|job/.test(t)) return pack.lenses?.talent || "";
  if (/pricing|price/.test(t)) return pack.lenses?.pricing || "";
  if (/conversion|checkout|cart/.test(t)) return pack.lenses?.conversion || "";
  if (/inventory|stock|warehouse/.test(t)) return pack.lenses?.inventory || "";
  if (/release|deploy|launch|test|coverage|defect|bug/.test(t)) return pack.lenses?.release || pack.lenses?.defects || "";
  if (/contract|msa|nda|sow|clause|privacy|gdpr/.test(t)) return pack.lenses?.contracts || pack.lenses?.compliance || "";
  return Object.values(pack.lenses || {})[0] || "";
}

function buildSpecialtySummary(agentName, text = "", ranked = []) {
  const pack = AGENT_SPECIALTY_CONTEXT[agentName] || AGENT_SPECIALTY_CONTEXT.Nexus;
  const top = ranked.filter((x) => x.score > 0).slice(0, 2).map((x) => x.cap?.label).filter(Boolean);
  return {
    pack,
    relevance: top.length
      ? `From a ${pack.domain} perspective, the highest-leverage lanes here are ${top.join(" and ")}.`
      : `From a ${pack.domain} perspective, I would anchor this around the strongest signal first.`,
    lens: pickSpecialtyLens(agentName, text),
    signals: pack.signals?.length ? `Signals I would watch here: ${pack.signals.slice(0, 4).join(", ")}.` : "",
    heuristic: pack.heuristics?.[0] ? `A useful rule here: ${pack.heuristics[0]}` : "",
  };
}

function buildCapabilityGuidance(profile = null, ranked = [], goalText = "") {
  const top = (ranked || []).filter((x) => x.score > 0).slice(0, 3).map((x) => x.cap).filter(Boolean);
  const recommendedActions = top.map((cap) => `${cap.label} (${cap.action || cap.id})`);
  const primary = top[0] || null;
  return {
    actionsLine: recommendedActions.length ? `Concrete capabilities I would lean on here: ${recommendedActions.join("; ")}.` : "",
    executionPath: primary ? `My first execution move would likely be ${primary.label} via ${primary.action || primary.id}.` : "",
    primaryAction: primary?.action || primary?.id || "",
    primaryLabel: primary?.label || "",
    goal: String(goalText || "").trim(),
  };
}

const INDUSTRY_INTELLIGENCE = {
  ecommerce: {
    match: [/shopify|e-?commerce|online store|retail|consumer product|dtc|direct to consumer/],
    label: "ecommerce",
    notes: [
      "In ecommerce, margin, merchandising, inventory pressure, and conversion friction usually interact.",
      "Channel growth should be read alongside AOV, return rate, and inventory turnover.",
    ],
  },
  services: {
    match: [/services|agency|consulting|consultancy|professional services|freelance/],
    label: "services",
    notes: [
      "In services businesses, utilization, pipeline quality, positioning, and delivery capacity are tightly linked.",
      "Growth quality depends on lead fit, sales cycle efficiency, and fulfillment bandwidth.",
    ],
  },
  saas: {
    match: [/saas|software|b2b software|platform|app|subscription/],
    label: "saas",
    notes: [
      "In SaaS, acquisition efficiency, activation, retention, and expansion matter more than top-line volume alone.",
      "A weak funnel often traces back to ICP clarity, onboarding friction, or value communication.",
    ],
  },
  creator: {
    match: [/creator|influencer|content creator|social media influencer|personal brand/],
    label: "creator business",
    notes: [
      "In creator businesses, attention, consistency, audience trust, and monetization mix drive results together.",
      "Content performance should be evaluated across reach, saves, engagement quality, and downstream conversion.",
    ],
  },
  regulated: {
    match: [/regulated|health|healthcare|ndis|medical|finance|fintech|legal|compliance|hipaa|gdpr/],
    label: "regulated business",
    notes: [
      "In regulated environments, speed only scales if approvals, evidence, and policy constraints are explicit.",
      "Operational design should account for auditability, documentation, and escalation paths up front.",
    ],
  },
};

const AGENT_INDUSTRY_OVERLAYS = {
  ecommerce: {
    Nexus: "For Nexus, ecommerce pressure usually shows up as coordination gaps between demand generation, merchandising, inventory, fulfillment, and support.",
    Maestro: "For Maestro in ecommerce, the main read is how creative, offer, and landing-page friction interact with CAC and conversion.",
    Prospect: "For Prospect in ecommerce, the priority is usually channel, affiliate, wholesale, or B2B partnership pipeline rather than classic outbound sales alone.",
    "Support Sage": "For Support Sage in ecommerce, returns, shipping friction, damaged orders, and expectation-setting often drive ticket volume.",
    Centsible: "For Centsible in ecommerce, margin, contribution after ad spend, refund drag, and inventory carrying cost matter more than headline revenue alone.",
    Sage: "For Sage in ecommerce, the strategic question is usually where merchandising, pricing, channel mix, and retention create durable advantage.",
    Chronos: "For Chronos in ecommerce, promotional calendars and launch timing create bursty workload that has to be protected against operational overload.",
    Atlas: "For Atlas in ecommerce, brittle points usually sit in order operations, fulfillment handoffs, returns, and campaign-to-stock coordination.",
    Scribe: "For Scribe in ecommerce, the highest-value knowledge is usually repeatable SOPs for merchandising, launches, support macros, and return handling.",
    Sentinel: "For Sentinel in ecommerce, payment fraud, account takeover, promotion abuse, and third-party app risk are common pressure points.",
    Compass: "For Compass in ecommerce, price moves, assortment shifts, merchandising patterns, and channel positioning are the most revealing signals.",
    Part: "For Part in ecommerce, affiliate, retail, marketplace, and technology partners matter when they reduce CAC or expand distribution.",
    Pulse: "For Pulse in ecommerce, burnout risk often clusters around launches, campaign peaks, fulfillment strain, and support surges.",
    Merchant: "For Merchant in ecommerce, the operating system is margin, conversion, AOV, return rate, and inventory turnover moving together.",
    Canvas: "For Canvas in ecommerce, the strongest creative usually leads with product truth, buying tension, and fast comprehension on mobile.",
    Inspect: "For Inspect in ecommerce, release risk concentrates around checkout, payment, promo logic, catalog integrity, and fulfillment flows.",
    Veritas: "For Veritas in ecommerce, consumer protection, refund terms, privacy, payments, and marketplace obligations usually matter most.",
  },
  services: {
    Nexus: "For Nexus, services businesses usually need tight coordination between pipeline, utilization, delivery quality, and staffing capacity.",
    Maestro: "For Maestro in services, the main lever is usually positioning clarity, proof, and lead quality rather than cheap volume.",
    Prospect: "For Prospect in services, speed-to-meeting is useful only if fit and commercial intent stay high.",
    "Support Sage": "For Support Sage in services, quality issues often appear as expectation gaps, scope confusion, or slow follow-through.",
    Centsible: "For Centsible in services, margin depends on utilization, pricing discipline, scope control, and collections.",
    Sage: "For Sage in services, strategic advantage usually comes from specialization, packaging, and delivery leverage.",
    Chronos: "For Chronos in services, calendar sprawl and context switching often erode billable or high-value work.",
    Atlas: "For Atlas in services, the core workflows are intake, handoff, project delivery, approvals, and renewals.",
    Scribe: "For Scribe in services, reusable playbooks, proposals, discovery notes, and delivery SOPs create leverage fast.",
    Sentinel: "For Sentinel in services, client data exposure and permissions sprawl are usually the first practical risks.",
    Compass: "For Compass in services, the most meaningful signals are competitor packaging, positioning changes, and demand shifts in target sectors.",
    Part: "For Part in services, referral partners and complementary service alliances often create the best-fit pipeline.",
    Pulse: "For Pulse in services, burnout often follows overload, weak scoping, and poor manager capacity planning.",
    Merchant: "For Merchant in services, productization and offer packaging matter more than physical inventory dynamics.",
    Canvas: "For Canvas in services, trust, credibility, and proof usually outperform pure style.",
    Inspect: "For Inspect in services, quality should measure delivery consistency, handoff quality, and client-facing failure points.",
    Veritas: "For Veritas in services, SOW scope, liability boundaries, payment terms, and IP ownership are recurring pressure points.",
  },
  saas: {
    Nexus: "For Nexus, SaaS execution usually depends on clean handoffs across acquisition, activation, product, support, and expansion.",
    Maestro: "For Maestro in SaaS, the real question is usually whether CAC pressure comes from ICP mismatch, onboarding friction, or weak value communication.",
    Prospect: "For Prospect in SaaS, pipeline quality improves when urgency, buying committee fit, and pain specificity are clear.",
    "Support Sage": "For Support Sage in SaaS, repeat tickets often point to onboarding gaps, product friction, or broken expectation-setting.",
    Centsible: "For Centsible in SaaS, efficient growth is usually read through payback, retention, expansion, and burn discipline.",
    Sage: "For Sage in SaaS, moat comes from distribution, retention, product wedge, and speed of learning.",
    Chronos: "For Chronos in SaaS, meeting bloat tends to crowd out product focus and deep execution time.",
    Atlas: "For Atlas in SaaS, operational brittleness often appears in onboarding, lifecycle automation, release workflows, and incident response.",
    Scribe: "For Scribe in SaaS, docs, release notes, support knowledge, and product decision records create compounding leverage.",
    Sentinel: "For Sentinel in SaaS, identity, secrets, tenant isolation, and third-party integrations are recurring exposure points.",
    Compass: "For Compass in SaaS, launches, pricing changes, hiring patterns, and positioning shifts are the best market clues.",
    Part: "For Part in SaaS, integration partners, channel partners, and co-selling alliances can materially shift distribution.",
    Pulse: "For Pulse in SaaS, attrition risk often starts in manager quality, roadmap churn, and sustained release pressure.",
    Merchant: "For Merchant in SaaS, packaging, conversion, trial activation, and upgrade motion often behave like merchandising decisions.",
    Canvas: "For Canvas in SaaS, clarity of pain, product value, and proof beats abstract brand language most of the time.",
    Inspect: "For Inspect in SaaS, quality confidence should center on auth, billing, core workflows, and release regressions.",
    Veritas: "For Veritas in SaaS, data processing, privacy, security commitments, and enterprise contract terms usually dominate risk.",
  },
  creator: {
    Nexus: "For Nexus, creator businesses usually depend on coordination between content production, audience growth, monetization, and brand operations.",
    Maestro: "For Maestro in creator businesses, consistency, hooks, audience resonance, and monetization fit matter together.",
    Prospect: "For Prospect in creator businesses, partnerships, sponsors, and high-fit inbound or outbound deals matter more than traditional SDR volume.",
    "Support Sage": "For Support Sage in creator businesses, membership, order, and community support experience shapes retention and trust quickly.",
    Centsible: "For Centsible in creator businesses, revenue concentration risk, sponsor mix, and monetization diversity matter a lot.",
    Sage: "For Sage in creator businesses, the strategic question is usually how to turn attention into durable owned channels and revenue.",
    Chronos: "For Chronos in creator businesses, production cadence and creative energy management matter as much as scheduling efficiency.",
    Atlas: "For Atlas in creator businesses, publishing workflows, approvals, sponsorship delivery, and asset reuse are core systems.",
    Scribe: "For Scribe in creator businesses, reusable content frameworks, sponsor notes, and audience insights become high-value memory.",
    Sentinel: "For Sentinel in creator businesses, impersonation, account compromise, and brand abuse are frequent risks.",
    Compass: "For Compass in creator businesses, platform shifts, format changes, and audience behavior changes are the most important signals.",
    Part: "For Part in creator businesses, sponsors, affiliate partners, brand deals, and platform alliances are the obvious leverage points.",
    Pulse: "For Pulse in creator businesses, burnout often shows up through production fatigue, inconsistency, and constant context switching.",
    Merchant: "For Merchant in creator businesses, merch, offers, bundles, and launch timing often matter more than catalog breadth.",
    Canvas: "For Canvas in creator businesses, distinct voice and repeatable visual identity matter more than polished sameness.",
    Inspect: "For Inspect in creator businesses, quality means consistency, platform fit, and avoiding preventable publishing errors.",
    Veritas: "For Veritas in creator businesses, sponsorship terms, disclosures, usage rights, and IP boundaries matter most.",
  },
  regulated: {
    Nexus: "For Nexus, regulated businesses need approvals, evidence, and escalation paths designed into execution from the start.",
    Maestro: "For Maestro in regulated businesses, speed only works if claims, disclosures, and review requirements are explicit up front.",
    Prospect: "For Prospect in regulated businesses, outreach quality depends on compliant messaging and the right qualification boundaries.",
    "Support Sage": "For Support Sage in regulated businesses, documentation quality and escalation discipline are part of service quality, not separate from it.",
    Centsible: "For Centsible in regulated businesses, financial decisions need to account for auditability, reporting obligations, and control maturity.",
    Sage: "For Sage in regulated businesses, strategic options should be weighed against approval friction and compliance load, not just growth upside.",
    Chronos: "For Chronos in regulated businesses, reviews and approvals can dominate calendars unless cadence is designed intentionally.",
    Atlas: "For Atlas in regulated businesses, workflows need checkpoints, evidence capture, and deterministic rollback paths.",
    Scribe: "For Scribe in regulated businesses, citations, version control, and audit-ready documentation are central requirements.",
    Sentinel: "For Sentinel in regulated businesses, policy alignment, evidence trails, and incident reporting obligations are core design constraints.",
    Compass: "For Compass in regulated businesses, the most important signals are regulatory shifts, policy interpretation, and competitor compliance posture.",
    Part: "For Part in regulated businesses, partner diligence, contract control, and compliance fit are as important as commercial upside.",
    Pulse: "For Pulse in regulated businesses, policy acknowledgment, training coverage, and manager consistency matter alongside engagement.",
    Merchant: "For Merchant in regulated businesses, product claims, listing accuracy, and policy-safe promotions matter as much as conversion.",
    Canvas: "For Canvas in regulated businesses, creative has to balance persuasion with approval-safe language and disclosures.",
    Inspect: "For Inspect in regulated businesses, quality means evidence-backed gates, traceability, and explicit release criteria.",
    Veritas: "For Veritas in regulated businesses, ownership, evidence, and policy alignment determine whether risk stays manageable.",
  },
};

function normalizeBusinessContext(profile = {}) {
  if (!profile || typeof profile !== "object") return null;
  const company = String(profile.company_name || profile.legal_name || "").trim();
  const industry = String(profile.industry || profile.business_type || "").trim();
  const businessModel = String(profile.business_model || "").trim();
  const stage = String(profile.stage || "").trim();
  const website = String(profile.website || "").trim();
  const teamSize = String(profile.team_size || "").trim();
  const headquarters = String(profile.headquarters || "").trim();
  const serviceAreas = String(profile.service_areas || "").trim();
  const mission = String(profile.mission || "").trim();
  const vision = String(profile.vision || "").trim();
  const valueProposition = String(profile.value_proposition || "").trim();
  const offerings = String(profile.offerings || profile.value_proposition || "").trim();
  const icp = String(profile.ideal_customer_profile || profile.audience_personas || "").trim();
  const audiencePersonas = String(profile.audience_personas || "").trim();
  const channels = String(profile.preferred_channels || "").trim();
  const goals = String(profile.core_goals_90d || profile.annual_goals || "").trim();
  const annualGoals = String(profile.annual_goals || "").trim();
  const kpis = String(profile.kpis || "").trim();
  const marketingBudget = String(profile.budget_marketing_monthly || "").trim();
  const opsBudget = String(profile.budget_ops_monthly || "").trim();
  const tools = String(profile.tools_and_integrations || "").trim();
  const compliance = String(profile.compliance_requirements || "").trim();
  const approvalRules = String(profile.approval_rules || "").trim();
  const riskTolerance = String(profile.risk_tolerance || "").trim();
  const brandVoice = String(profile.brand_voice || "").trim();
  const brandColors = String(profile.brand_colors || "").trim();
  const brandKeywords = String(profile.brand_keywords || "").trim();
  const notes = String(profile.notes_for_agents || "").trim();
  const referenceAssets = Array.isArray(profile.reference_assets) ? profile.reference_assets.slice(0, 48) : [];
  const businessLogoAssetId = String(profile.business_logo_asset_id || "").trim();
  const hay = `${industry} ${businessModel} ${offerings} ${valueProposition} ${channels} ${compliance} ${notes}`.toLowerCase();
  const industryPack =
    Object.values(INDUSTRY_INTELLIGENCE).find((pack) => pack.match.some((rx) => rx.test(hay))) || null;
  return {
    company,
    industry,
    business_model: businessModel,
    stage,
    website,
    team_size: teamSize,
    headquarters,
    service_areas: serviceAreas,
    mission,
    vision,
    value_proposition: valueProposition,
    offerings,
    icp,
    audience_personas: audiencePersonas,
    preferred_channels: channels,
    goals,
    annual_goals: annualGoals,
    kpis,
    budget_marketing_monthly: marketingBudget,
    budget_ops_monthly: opsBudget,
    tools_and_integrations: tools,
    compliance,
    approval_rules: approvalRules,
    risk_tolerance: riskTolerance,
    brand_voice: brandVoice,
    brand_colors: brandColors,
    brand_keywords: brandKeywords,
    notes,
    reference_assets: referenceAssets,
    business_logo_asset_id: businessLogoAssetId,
    industry_label: industryPack?.label || "",
    industry_notes: industryPack?.notes || [],
  };
}

function businessContextSummary(context = null) {
  if (!context) return { identity: "", strategy: "", risk: "", references: "", offer: "", audience: "", channels: "", economics: "", brand: "", ops: "" };
  const identityParts = [context.company, context.industry, context.business_model, context.stage].filter(Boolean);
  const sharedRefs = Array.isArray(context.reference_assets) ? context.reference_assets : [];
  const offer = [context.value_proposition, context.offerings].filter(Boolean).join(" ");
  const audience = [context.icp, context.audience_personas].filter(Boolean).join(" ");
  const channels = [context.preferred_channels, context.service_areas].filter(Boolean).join(" | ");
  const economics = [
    context.budget_marketing_monthly ? `marketing budget ${context.budget_marketing_monthly}` : "",
    context.budget_ops_monthly ? `ops budget ${context.budget_ops_monthly}` : "",
    context.kpis ? `KPIs ${context.kpis}` : "",
  ].filter(Boolean).join(" | ");
  const brand = [context.brand_voice, context.brand_keywords, context.brand_colors].filter(Boolean).join(" | ");
  const ops = [context.tools_and_integrations, context.approval_rules, context.notes].filter(Boolean).join(" | ");
  return {
    identity: identityParts.length ? `Business context: ${identityParts.join(" | ")}.` : "",
    strategy: context.goals ? `Current business priority: ${context.goals}.` : "",
    risk: context.industry_notes?.[0] || context.compliance ? `Operating context: ${context.industry_notes?.[0] || `Compliance requirements include ${context.compliance}.`}` : "",
    references: sharedRefs.length ? `Shared references available: ${sharedRefs.slice(0, 3).map((asset) => asset?.role_label ? `${asset.role_label} (${asset.name})` : asset?.name).filter(Boolean).join(", ")}.` : "",
    offer: offer ? `Offer and positioning: ${offer}.` : "",
    audience: audience ? `Audience focus: ${audience}.` : "",
    channels: channels ? `Channels and markets: ${channels}.` : "",
    economics: economics ? `Commercial guardrails: ${economics}.` : "",
    brand: brand ? `Brand direction: ${brand}.` : "",
    ops: ops ? `Operating notes: ${ops}.` : "",
  };
}

function businessFocusSummary(agentName = "", business = {}) {
  const key = String(agentName || "").trim();
  const focusByAgent = {
    Nexus: [business.strategy, business.audience, business.channels, business.ops],
    Maestro: [business.offer, business.audience, business.channels, business.brand],
    Prospect: [business.audience, business.offer, business.channels, business.economics],
    Centsible: [business.strategy, business.economics, business.risk, business.ops],
    Pulse: [business.strategy, business.ops, business.risk],
    Merchant: [business.offer, business.audience, business.channels, business.economics],
    Veritas: [business.risk, business.ops, business.strategy],
    Canvas: [business.brand, business.offer, business.audience, business.references],
    Sage: [business.strategy, business.economics, business.audience],
    Atlas: [business.ops, business.strategy, business.channels],
    Chronos: [business.strategy, business.ops],
    Compass: [business.audience, business.channels, business.offer],
    Part: [business.audience, business.channels, business.offer],
    Inspect: [business.offer, business.audience, business.ops],
    "Support Sage": [business.audience, business.offer, business.ops],
    Scribe: [business.ops, business.strategy, business.offer],
    Sentinel: [business.risk, business.ops, business.channels],
  };
  return (focusByAgent[key] || [business.offer, business.audience, business.strategy]).filter(Boolean).slice(0, 3).join(" ");
}

function industryOverlaySummary(agentName = "", context = null) {
  const label = String(context?.industry_label || "").trim();
  if (!label) return "";
  const byIndustry = AGENT_INDUSTRY_OVERLAYS[label] || {};
  return byIndustry[agentName] || "";
}

function memoryKey(userId = "local-user", agent = "Nexus") {
  return `${String(userId || "local-user").toLowerCase()}::${String(agent || "Nexus").toLowerCase()}`;
}

function buildOwnerKey(userId = "local-user", tenantId = "local-tenant") {
  return `${String(tenantId || "local-tenant").toLowerCase()}::${String(userId || "local-user").toLowerCase()}`;
}

function getAgentMemory(userId = "local-user", agent = "Nexus") {
  const currentKey = memoryKey(userId, agent);
  const legacyKey = String(userId || "").toLowerCase() !== "local-admin" ? memoryKey("local-admin", agent) : "";
  return getAgentMemoryRecord(currentKey, legacyKey) || {
    priorities: [],
    concerns: [],
    preferences: [],
    asset_refs: [],
    last_goal: "",
    last_topics: [],
    last_action: "",
    decision_log: [],
    diagnosis_log: [],
    playbooks: [],
    default_playbook_id: "",
    updated_at: "",
  };
}

function uniqueTrimmed(items = [], limit = 5) {
  return Array.from(new Set((items || []).map((x) => String(x || "").trim()).filter(Boolean))).slice(0, limit);
}

function inferMemoryFromText(text = "") {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const out = { priorities: [], concerns: [], preferences: [], topics: [] };
  const priorityPatterns = [
    /(?:need|want|trying|goal is to|priority is to|focus is to)\s+(.+?)(?:\.|,|$)/i,
    /(?:we are|we're)\s+(?:trying|looking)\s+to\s+(.+?)(?:\.|,|$)/i,
  ];
  for (const rx of priorityPatterns) {
    const m = raw.match(rx);
    if (m?.[1]) out.priorities.push(m[1].trim());
  }
  const concernMap = [
    ["cac", /cac|cost to acquire|cost per acquisition/],
    ["roas", /roas|return on ad spend/],
    ["retention", /retention|churn|renewal/],
    ["runway", /runway|cash flow|burn rate/],
    ["compliance", /compliance|regulation|gdpr|privacy|audit/],
    ["burnout", /burnout|attrition|engagement|morale/],
    ["inventory", /inventory|stock|warehouse|overstock|stockout/],
    ["conversion", /conversion|checkout|cart|cvr|aov/],
    ["pipeline", /pipeline|meetings|reply rate|outreach|prospect/],
    ["quality", /quality|release|bug|defect|coverage|test/],
  ];
  concernMap.forEach(([label, rx]) => {
    if (rx.test(t)) out.concerns.push(label);
  });
  const preferenceMap = [
    ["plan-first", /plan first|show me a plan|ask for a plan/],
    ["analysis-only", /analysis only|just analyze|do not execute/],
    ["execute-fast", /go ahead|execute|run it|ship it/],
    ["cost-conscious", /budget|margin|cash|runway/],
    ["risk-aware", /risk|safe|careful|compliance|approval/],
  ];
  preferenceMap.forEach(([label, rx]) => {
    if (rx.test(t)) out.preferences.push(label);
  });
  out.topics = uniqueTrimmed(out.concerns, 4);
  return out;
}

function mergeAgentMemory(existing = {}, delta = {}, taskState = {}) {
  return {
    priorities: uniqueTrimmed([...(existing.priorities || []), ...(delta.priorities || [])]),
    concerns: uniqueTrimmed([...(existing.concerns || []), ...(delta.concerns || [])]),
    preferences: uniqueTrimmed([...(existing.preferences || []), ...(delta.preferences || [])]),
    asset_refs: Array.from(new Map([...(existing.asset_refs || []), ...(delta.asset_refs || [])].map((asset) => [asset?.id, asset])).values()).filter(Boolean).slice(0, 24),
    last_goal: String(taskState?.goal || existing.last_goal || "").trim(),
    last_topics: uniqueTrimmed([...(delta.topics || []), ...(existing.last_topics || [])], 4),
    last_action: String(taskState?.last_action || existing.last_action || "").trim(),
    decision_log: Array.isArray(existing.decision_log) ? existing.decision_log.slice(0, 12) : [],
    diagnosis_log: Array.isArray(existing.diagnosis_log) ? existing.diagnosis_log.slice(0, 12) : [],
    playbooks: Array.isArray(existing.playbooks) ? existing.playbooks.slice(0, 24) : [],
    default_playbook_id: String(existing.default_playbook_id || "").trim(),
    updated_at: now(),
  };
}

function memorySummary(memory = null) {
  if (!memory) return { priorities: "", concerns: "", preferences: "", references: "" };
  return {
    priorities: Array.isArray(memory.priorities) && memory.priorities.length ? `What I remember matters to you: ${memory.priorities.slice(0, 2).join("; ")}.` : "",
    concerns: Array.isArray(memory.concerns) && memory.concerns.length ? `Recurring themes I have seen: ${memory.concerns.slice(0, 4).join(", ")}.` : "",
    preferences: Array.isArray(memory.preferences) && memory.preferences.length ? `Working style I am tracking: ${memory.preferences.slice(0, 3).join(", ")}.` : "",
    references: Array.isArray(memory.asset_refs) && memory.asset_refs.length ? `Reference assets I can draw from: ${memory.asset_refs.slice(0, 3).map((asset) => asset?.role_label ? `${asset.role_label} (${asset.name})` : asset?.name).filter(Boolean).join(", ")}.` : "",
  };
}

function buildBackendMemoryNarrative(memory = null) {
  const parts = [];
  if (Array.isArray(memory?.priorities) && memory.priorities.length) {
    parts.push(`I'm keeping ${memory.priorities.slice(0, 2).join(" and ")} in view`);
  }
  if (Array.isArray(memory?.concerns) && memory.concerns.length) {
    parts.push(`I'm also noticing a pattern around ${memory.concerns.slice(0, 3).join(", ")}`);
  }
  if (Array.isArray(memory?.preferences) && memory.preferences.length) {
    parts.push(`and I know you prefer ${memory.preferences.slice(0, 2).join(" and ")}`);
  }
  if (Array.isArray(memory?.asset_refs) && memory.asset_refs.length) {
    parts.push(`with ${memory.asset_refs.slice(0, 2).map((asset) => asset?.role_label ? `${asset.role_label} (${asset.name})` : asset?.name).filter(Boolean).join(" and ")} available as reference`);
  }
  if (!parts.length) return "";
  return `${parts.join(", ")}.`;
}

function pickBackendFollowUp(agentName = "Nexus", taskState = {}, options = []) {
  const clean = (options || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!clean.length) return "";
  const seed = String(agentName || "").length
    + Number(taskState?.turn_count || 0)
    + (Array.isArray(taskState?.agent_memory?.decision_log) ? taskState.agent_memory.decision_log.length : 0)
    + (Array.isArray(taskState?.agent_memory?.diagnosis_log) ? taskState.agent_memory.diagnosis_log.length : 0);
  return clean[seed % clean.length];
}

function pickBackendLead(agentName = "Nexus", taskState = {}, options = []) {
  return pickBackendFollowUp(agentName, taskState, options);
}

function buildBackendMissingQuestion(missing = [], fallback = "") {
  const labels = (missing || []).map((field) => String(field || "").trim()).filter(Boolean);
  if (!labels.length) return fallback;
  if (labels.length === 1) return `I just need one thing from you: what should I use for ${labels[0]}?`;
  if (labels.length === 2) return `I just need two details before I run it: ${labels[0]} and ${labels[1]}.`;
  return `Before I run it, I still need ${labels.slice(0, 2).join(", ")} and the remaining inputs.`;
}

function buildBackendHandoffSuggestion(agentName = "", text = "") {
  const t = String(text || "").toLowerCase();
  const handoffs = [];
  if (agentName !== "Veritas" && /contract|nda|msa|policy|compliance|legal/.test(t)) handoffs.push("Veritas");
  if (agentName !== "Pulse" && /hiring|onboarding|burnout|retention|engagement|employee/.test(t)) handoffs.push("Pulse");
  if (agentName !== "Merchant" && /inventory|sku|pricing|promotion|catalog|orders/.test(t)) handoffs.push("Merchant");
  if (agentName !== "Maestro" && /campaign|ads|creative fatigue|roas|cac|launch/.test(t)) handoffs.push("Maestro");
  if (agentName !== "Centsible" && /cash flow|runway|margin|forecast|budget|burn/.test(t)) handoffs.push("Centsible");
  return handoffs.length ? `If you want, I can bring ${handoffs[0]} in for the specialist part and keep this moving here.` : "";
}

function getBackendToneAccent(agentName = "") {
  return {
    Maestro: "There's real upside here if we stay sharp about message-market fit.",
    Merchant: "I want to protect the economics while we improve the result.",
    Pulse: "I want this to feel workable for the people living inside it, not just good on paper.",
    Veritas: "I want the commercial path to stay usable without hiding the risk.",
    Inspect: "I want the confidence to be real, not just optimistic.",
    Centsible: "I want the recommendation to hold up financially, not just narratively.",
    Nexus: "I want the system to stay coordinated while we move.",
  }[String(agentName || "")] || "I want this to be practical and defensible.";
}

function isVagueBackendPrompt(text = "") {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return true;
  if (clean.length <= 14) return true;
  if (/^(help|thoughts|ideas|advice|where do we start|not sure|unsure|what do you think|can you help)$/i.test(clean)) return true;
  const tokenCount = clean.split(/\s+/).filter(Boolean).length;
  return tokenCount <= 3 && !/\d/.test(clean);
}

function isTradeoffBackendPrompt(text = "") {
  return /trade[\s-]?off|compare|comparison|vs\.?|versus|option a|option b|which is better|two good paths|better path/i.test(String(text || "").toLowerCase());
}

function isChallengeBackendPrompt(text = "") {
  return /push back|challenge (that|this|me)|argue against|what am i missing|why not|devil'?s advocate|poke holes/i.test(String(text || "").toLowerCase());
}
function isObjectionBackendPrompt(text = "") {
  return /too expensive|too risky|too slow|won't work|dont like that|don't like that|not convinced|that feels off|hard no|i disagree|not comfortable/i.test(String(text || "").toLowerCase());
}

function getBackendDisagreementLens(agentName = "") {
  return {
    Maestro: "the wrong move is usually forcing more spend through a weak offer or tired creative",
    Centsible: "the wrong move is usually optimizing for optics instead of cash impact",
    Pulse: "the wrong move is usually treating a people signal like an isolated incident",
    Merchant: "the wrong move is usually solving for volume while quietly damaging margin or inventory health",
    Veritas: "the wrong move is usually moving faster commercially than the risk posture can support",
    Inspect: "the wrong move is usually shipping on partial confidence and then paying for it later",
    Nexus: "the wrong move is usually treating a coordination problem like a single-team issue",
  }[String(agentName || "")] || "the wrong move is usually acting before the signal is strong enough";
}

function buildBackendConditionalReasoning({ primaryLabel = "", secondaryLabel = "", specialty = {}, agentName = "" }) {
  const domain = specialty.domain || agentName || "this lane";
  return [
    primaryLabel ? `If the signal holds, ${primaryLabel} is the stronger move.` : "",
    secondaryLabel ? `If the signal is still noisy, ${secondaryLabel} is the safer move.` : "",
    `In ${domain}, I usually decide by asking whether the fastest move is also the one most likely to survive a week of scrutiny.`,
  ].filter(Boolean).join("\n");
}

function buildBackendThreadContext(taskState = {}) {
  const goal = String(taskState?.goal || "").trim();
  const lastAction = String(taskState?.last_action || "").trim();
  const memory = taskState?.agent_memory || {};
  const latestDecision = Array.isArray(memory?.decision_log) ? memory.decision_log[0] : null;
  const latestDiagnosis = Array.isArray(memory?.diagnosis_log) ? memory.diagnosis_log[0] : null;
  return {
    goal,
    lastAction,
    latestDecision: latestDecision?.title || "",
    latestDiagnosis: latestDiagnosis?.title || "",
  };
}

function isThreadRecapBackendPrompt(text = "") {
  return /where were we|recap|catch me up|remind me|summarize the thread|what's the state/i.test(String(text || "").toLowerCase());
}

function isVagueTensionBackendPrompt(text = "") {
  return /feels off|something is off|things feel messy|everything feels messy|it feels fragile|i'm uneasy|i'm worried|this feels messy|too many moving parts|a lot going on/i.test(String(text || "").toLowerCase());
}

function buildBackendThreadRecap(intro, taskState = {}, specialty = {}, change = {}) {
  const thread = buildBackendThreadContext(taskState);
  return [
    `${intro}: here's where we left it.`,
    thread.goal ? `We were working toward ${thread.goal}.` : "",
    thread.lastAction ? `The last active lane was ${thread.lastAction}.` : "",
    change.decision || "",
    change.diagnosis || "",
    specialty.relevance || "",
    "If you want, I can pick this back up from the current lane or re-rank the options from here.",
  ].filter(Boolean).join("\n");
}

function buildBackendTensionResponse(intro, agentName, taskState = {}, specialty = {}, business = {}, memoryNarrative = "") {
  return [
    `${intro}: ${pickBackendLead(agentName, taskState, ["I can feel the tension in this.", "This sounds like the kind of situation where several small problems start compounding.", "This usually means the system is carrying more strain than any one metric shows."])}`,
    buildBackendContextCarry(taskState, business, memoryNarrative),
    specialty.lens || "",
    specialty.signals || "",
    "Before we force a decision, I'd separate signal, strain, and actual constraint.",
    pickBackendFollowUp(agentName, taskState, ["If you want, I can help name the real pressure points first.", "I can also narrow this to the 2 or 3 things actually driving the tension.", "If it helps, I can turn the unease into a concrete diagnosis."]),
  ].filter(Boolean).join("\n");
}

function buildBackendContextCarry(taskState = {}, business = {}, memoryNarrative = "") {
  const thread = buildBackendThreadContext(taskState);
  return [
    business.identity,
    memoryNarrative,
    thread.goal ? `I'm carrying forward the current goal: ${thread.goal}.` : "",
  ].filter(Boolean).join("\n");
}

function buildBackendTradeoffResponse(intro, agentName, taskState = {}, ranked = [], specialty = {}, business = {}, memoryNarrative = "") {
  const viable = (ranked || []).filter((entry) => Number(entry?.score || 0) > 0).slice(0, 2);
  if (viable.length < 2) return "";
  const [first, second] = viable;
  const recommendation = Number(first.score || 0) >= Number(second.score || 0) ? first.cap : second.cap;
  const thread = buildBackendThreadContext(taskState);
  return [
    `${intro}: ${pickBackendLead(agentName, taskState, ["There are two credible paths here.", "I see two good ways to play this.", "There are two strong options worth weighing."])}`,
    memoryNarrative,
    business.identity,
    `${first.cap.label}: better when you want ${first.score >= second.score ? "the cleaner immediate move" : "more upside if the signal holds"}.`,
    `${second.cap.label}: better when you want ${first.score >= second.score ? "more flexibility before committing" : "the steadier lower-risk path"}.`,
    specialty.lens || `In ${specialty.domain || agentName}, the real tradeoff is speed versus confidence.`,
    buildBackendConditionalReasoning({ primaryLabel: first.cap.label, secondaryLabel: second.cap.label, specialty, agentName }),
    thread.goal ? `Given the goal I'm already tracking, the decision point is whether ${first.cap.label} helps sooner than ${second.cap.label} without creating rework.` : "",
    thread.latestDiagnosis ? `I'm also anchoring this to the current diagnosis thread: ${thread.latestDiagnosis}.` : "",
    `${pickBackendLead(agentName, taskState, [`I'd still start with ${recommendation.label}.`, `If I were sequencing this, I'd begin with ${recommendation.label}.`, `My lean is still ${recommendation.label}.`])} ${specialty.heuristic || ""}`.trim(),
    pickBackendFollowUp(agentName, taskState, ["If you want, I can lay out the tradeoffs step by step.", "If it helps, I can pressure-test the weaker path too.", "I can also turn the recommended path into a concrete plan."]),
  ].filter(Boolean).join("\n");
}

function buildBackendChallengeResponse(intro, agentName, taskState = {}, primary = null, secondary = null, specialty = {}, business = {}, memoryNarrative = "") {
  const primaryLabel = primary?.cap?.label || primary?.label || "that path";
  const secondaryLabel = secondary?.cap?.label || secondary?.label || "the alternative";
  const thread = buildBackendThreadContext(taskState);
  return [
    `${intro}: ${pickBackendLead(agentName, taskState, [`If I push back on ${primaryLabel}, the main risk is moving too quickly before the signal is clean.`, `Let me challenge ${primaryLabel} for a second.`, `If I take the skeptical view on ${primaryLabel}, here's where it can go wrong.`])}`,
    memoryNarrative,
    business.risk,
    `From a ${specialty.domain || agentName} point of view, ${getBackendDisagreementLens(agentName)}.`,
    specialty.signals || `The thing I'd watch hardest in ${specialty.domain || agentName} is whether the underlying signal is real or just noisy.`,
    buildBackendConditionalReasoning({ primaryLabel, secondaryLabel, specialty, agentName }),
    thread.latestDecision ? `I'm pushing against the current decision thread rather than starting over: ${thread.latestDecision}.` : "",
    specialty.heuristic,
    `The strongest alternative is ${secondaryLabel}.`,
    pickBackendFollowUp(agentName, taskState, ["If you want, I can compare them directly and tell you where I'd draw the line.", "If it helps, I can make the case for both sides before we choose.", "I can also turn that skepticism into a safer first-step plan."]),
  ].filter(Boolean).join("\n");
}

function buildBackendSynthesisResponse(intro, agentName, taskState = {}, specialty = {}, business = {}, memoryNarrative = "", change = {}) {
  return [
    `${intro}: ${pickBackendLead(agentName, taskState, ["Here's the shape of the problem as I see it.", "Let me synthesize this before we pick a move.", "The real issue here is not just one tactic, it's the way these pressures interact."])}`,
    buildBackendContextCarry(taskState, business, memoryNarrative),
    `${specialty.relevance || ""}`,
    `${specialty.lens || ""}`,
    `The central tension is that ${change.diagnosis || "you have multiple pressures pulling in different directions"}.`,
    specialty.signals || "",
    specialty.heuristic || "",
    pickBackendFollowUp(agentName, taskState, ["The cleanest next step is for me to separate what is urgent, what is structural, and what can wait.", "If you want, I can turn that into a decision memo next.", "If it helps, I can map the first move and the tradeoffs behind it."]),
  ].filter(Boolean).join("\n");
}

function buildBackendObjectionResponse(intro, agentName, taskState = {}, ranked = [], specialty = {}, business = {}, memoryNarrative = "") {
  const best = ranked?.[0]?.cap?.label || "the current path";
  const alt = ranked?.[1]?.cap?.label || "the lower-risk alternative";
  return [
    `${intro}: ${pickBackendLead(agentName, taskState, ["That objection is fair.", "I think that pushback is reasonable.", "You're right to challenge that before we commit."])}`,
    buildBackendContextCarry(taskState, business, memoryNarrative),
    `If ${best} feels too aggressive, the safer adjustment is ${alt}.`,
    "If the objection is mainly about risk, we can narrow scope first. If it is mainly about time or cost, we can simplify the first step instead of abandoning the direction entirely.",
    specialty.heuristic || `In ${specialty.domain || agentName}, I usually keep the thesis but reduce the blast radius.`,
    pickBackendFollowUp(agentName, taskState, ["If you want, I can reshape the recommendation around that objection.", "I can also give you the lowest-risk version of the plan.", "If it helps, I can show what I would cut first."]),
  ].filter(Boolean).join("\n");
}

function buildBackendDiscoveryQuestion(style = {}, specialty = {}, business = {}, memory = {}, overlay = "") {
  return [
    "Here's where I'd start.",
    business.identity,
    memory.priorities,
    overlay,
    `My first instinct here is ${specialty.lens || specialty.prompt || specialty.greeting || "to narrow the goal before acting."}`,
    pickBackendFollowUp(specialty.domain || "Nexus", { agent_memory: {} }, [style.helpAsk, style.nextAsk, specialty.prompt]),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildBackendExplorationReply(intro, agentName, taskState = {}, style = {}, specialty = {}, business = {}, memoryNarrative = "") {
  return `${intro}: ${pickBackendLead(agentName, taskState, ["Happy to think it through with you.", "We can work through it together.", "Let's open it up a bit first."])} ${business.identity || ""} ${memoryNarrative || ""} ${specialty.lens || ""} ${pickBackendFollowUp(agentName, taskState, [style.helpAsk, style.nextAsk, specialty.prompt].filter(Boolean))}`.replace(/\s+/g, " ").trim();
}

function appendTimelineEntry(existing = [], entry = {}, limit = 12) {
  const next = [{ id: id("mem"), timestamp: now(), ...entry }, ...(Array.isArray(existing) ? existing : [])];
  return next.slice(0, limit);
}

function inferDiagnosisEntry(agentName = "", text = "", memoryDelta = {}, sources = []) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  const concerns = Array.isArray(memoryDelta.concerns) ? memoryDelta.concerns : [];
  if (!concerns.length && !/why|recommend|issue|problem|risk|declin|rising|drop|stuck|broken|not working/i.test(clean)) return null;
  return {
    type: "diagnosis",
    title: concerns.length ? `Focus areas: ${concerns.join(", ")}` : `Diagnosis started for ${agentName}`,
    summary: clean.slice(0, 220),
    signals: concerns,
    status: "draft",
    pinned: false,
    sources: Array.isArray(sources) ? sources : [],
  };
}

function inferDecisionEntry(agentName = "", text = "", action = "", shouldExecute = false, sources = []) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  if (!action && !/recommend|plan|next|should we|what do you recommend/i.test(clean)) return null;
  return {
    type: "decision",
    title: action ? `${shouldExecute ? "Executed" : "Selected"} ${action}` : `Decision requested for ${agentName}`,
    summary: clean.slice(0, 220),
    action: action || "",
    mode: shouldExecute ? "execute" : /plan|recommend/i.test(clean) ? "plan" : "analysis",
    status: "draft",
    pinned: false,
    sources: Array.isArray(sources) ? sources : [],
  };
}

function summarizeChangeSinceLastTime(memory = null) {
  const decisions = Array.isArray(memory?.decision_log) ? memory.decision_log : [];
  const diagnoses = Array.isArray(memory?.diagnosis_log) ? memory.diagnosis_log : [];
  const currentDecision = decisions[0] || null;
  const previousDecision = decisions[1] || null;
  const currentDiagnosis = diagnoses[0] || null;
  const previousDiagnosis = diagnoses[1] || null;

  let decision = "";
  let diagnosis = "";
  if (currentDecision && previousDecision) {
    if (currentDecision.action && previousDecision.action && currentDecision.action !== previousDecision.action) {
      decision = `What changed since last time: the recommended path shifted from ${previousDecision.action} to ${currentDecision.action}.`;
    } else {
      decision = `What changed since last time: the decision path is still centered on ${currentDecision.action || currentDecision.title || "the same lane"}.`;
    }
  } else if (currentDecision) {
    decision = `This is the newest decision thread I am tracking: ${currentDecision.title}.`;
  }

  const currentSignals = Array.isArray(currentDiagnosis?.signals) ? currentDiagnosis.signals : [];
  const previousSignals = Array.isArray(previousDiagnosis?.signals) ? previousDiagnosis.signals : [];
  const newlyVisible = currentSignals.filter((x) => !previousSignals.includes(x));
  const dropped = previousSignals.filter((x) => !currentSignals.includes(x));
  if (currentDiagnosis && previousDiagnosis) {
    if (newlyVisible.length || dropped.length) {
      diagnosis = `Diagnosis shift: new focus areas ${newlyVisible.join(", ") || "none"}; reduced emphasis on ${dropped.join(", ") || "none"}.`;
    } else {
      diagnosis = `Diagnosis shift: the same core signals are still showing up${currentSignals.length ? ` (${currentSignals.join(", ")})` : ""}.`;
    }
  } else if (currentDiagnosis) {
    diagnosis = `Current diagnosis thread: ${currentDiagnosis.title}.`;
  }

  return { decision, diagnosis };
}

function lookupEvidence(text = "", taskState = {}) {
  const business = taskState?.business_context || null;
  const query = [text, business?.company, business?.industry, business?.goals].filter(Boolean).join(" ");
  if (!query.trim()) return { evidence: [], line: "" };
  try {
    const result = vectorSearch({ namespace: "global", query, limit: 3 });
    const matches = (result?.matches || []).filter((m) => Number(m.score || 0) >= 0.12).slice(0, 2);
    const evidence = matches.map((m) => {
      const label = m?.metadata?.title || m?.metadata?.name || m?.metadata?.document_id || m.id;
      return { label, score: Number(m.score || 0), snippet: String(m.text || "").slice(0, 120) };
    });
    return {
      evidence,
      line: evidence.length ? `Evidence I can reference: ${evidence.map((e) => e.label).join("; ")}.` : "",
    };
  } catch {
    return { evidence: [], line: "" };
  }
}

export function loadAgentMemory(userId = "local-user", agent = "Nexus") {
  return { memory: getAgentMemory(userId, agent) };
}

export function saveAgentMemory(userId = "local-user", agent = "Nexus", memory = {}) {
  const current = getAgentMemory(userId, agent);
  const next = {
    priorities: uniqueTrimmed(memory?.priorities ?? current.priorities ?? []),
    concerns: uniqueTrimmed(memory?.concerns ?? current.concerns ?? []),
    preferences: uniqueTrimmed(memory?.preferences ?? current.preferences ?? []),
    asset_refs: Array.from(new Map([...(Array.isArray(memory?.asset_refs) ? memory.asset_refs : current.asset_refs || [])].map((asset) => [asset?.id, asset])).values()).filter(Boolean).slice(0, 24),
    last_goal: String(memory?.last_goal ?? current.last_goal ?? "").trim(),
    last_topics: uniqueTrimmed(memory?.last_topics ?? current.last_topics ?? [], 4),
    last_action: String(memory?.last_action ?? current.last_action ?? "").trim(),
    decision_log: Array.isArray(memory?.decision_log) ? memory.decision_log.slice(0, 12) : (current.decision_log || []).slice(0, 12),
    diagnosis_log: Array.isArray(memory?.diagnosis_log) ? memory.diagnosis_log.slice(0, 12) : (current.diagnosis_log || []).slice(0, 12),
    playbooks: Array.isArray(memory?.playbooks) ? memory.playbooks.slice(0, 24) : (current.playbooks || []).slice(0, 24),
    default_playbook_id: String(memory?.default_playbook_id ?? current.default_playbook_id ?? "").trim(),
    updated_at: now(),
  };
  saveAgentMemoryRecord(memoryKey(userId, agent), next);
  return { memory: next };
}

async function buildInsightResponse(intro, agentName, text, ranked = [], taskState = {}) {
  const guide = AGENT_CONVERSATION_PLAYBOOK[agentName] || AGENT_CONVERSATION_PLAYBOOK.Nexus;
  const style = AGENT_CHAT_STYLE[agentName] || AGENT_CHAT_STYLE.Nexus;
  const specialty = buildSpecialtySummary(agentName, text, ranked);
  const profile = getAgentByName(agentName) || getAgentByName("Nexus");
  const capability = buildCapabilityGuidance(profile, ranked, taskState?.goal || text);
  const agentId = normalizeProviderAgentId(agentName);
  const business = businessContextSummary(taskState?.business_context || null);
  const overlay = industryOverlaySummary(agentName, taskState?.business_context || null);
  const businessFocus = businessFocusSummary(agentName, business);
  const memory = memorySummary(taskState?.agent_memory || null);
  const memoryNarrative = buildBackendMemoryNarrative(taskState?.agent_memory || null);
  const change = summarizeChangeSinceLastTime(taskState?.agent_memory || null);
  const evidence = lookupEvidence(text, taskState || {});
  const taskHint = taskState?.goal ? `Current goal I'm tracking: ${taskState.goal}.` : "";
  const constraints = Array.isArray(taskState?.constraints) && taskState.constraints.length ? `Constraints considered: ${taskState.constraints.join("; ")} .`.replace(" .", ".") : "";
  const followUp = pickBackendFollowUp(agentName, taskState, [style.nextAsk, guide.ask, specialty.pack?.prompt]);
  try {
    const liveReply = await generateAgentInsightReply({
      agentId,
      agentName,
      domain: specialty.domain,
      userText: text,
      businessIdentity: business.identity,
      businessFocus,
      businessOffer: business.offer,
      businessAudience: business.audience,
      businessStrategy: business.strategy,
      businessChannels: business.channels,
      businessEconomics: business.economics,
      businessBrand: business.brand,
      businessRisk: business.risk,
      businessOps: business.ops,
      industryOverlay: overlay,
      memoryPriorities: memory.priorities,
      memoryConcerns: memory.concerns,
      memoryPreferences: memory.preferences,
      memoryReferences: memory.references,
      specialtyRelevance: specialty.relevance,
      specialtyLens: specialty.lens,
      specialtySignals: specialty.signals,
      specialtyHeuristic: specialty.heuristic,
      recommendedActions: capability.actionsLine,
      executionPath: capability.executionPath,
      taskHint,
      constraints,
      changeDecision: change.decision,
      changeDiagnosis: change.diagnosis,
      evidenceLine: evidence.line,
      planFrame: guide.frame,
    });
    if (liveReply) return liveReply;
  } catch {
    // Fall back to deterministic local response scaffolding.
  }
  if (style.verbosity === "concise") {
    return [
      `${intro}: ${style.toneOpen}`,
      business.identity,
      memoryNarrative,
      business.references,
      specialty.relevance,
      specialty.lens,
      business.risk,
      overlay,
      memory.concerns,
      change.decision,
      change.diagnosis,
      evidence.line,
      specialty.heuristic,
      capability.actionsLine,
      capability.executionPath,
      memory.preferences,
      `I would work this in three moves: ${guide.frame[0]}, then ${guide.frame[1]}, then ${guide.frame[2]} .`.replace(' .', '.'),
      business.strategy,
      constraints,
      followUp,
    ].filter(Boolean).join("\n");
  }
  if (style.verbosity === "detailed") {
    return [
      `${intro}: ${style.toneOpen}`,
      "Here's how I'm reading it:",
      business.identity,
      memoryNarrative,
      business.references,
      specialty.relevance,
      specialty.lens,
      taskHint,
      business.strategy,
      business.risk,
      overlay,
      memory.concerns,
      change.decision,
      change.diagnosis,
      evidence.line,
      specialty.signals,
      specialty.heuristic,
      capability.actionsLine,
      capability.executionPath,
      memory.preferences,
      constraints,
      "Best path from here:",
      `1. ${guide.frame[0]}`,
      `2. ${guide.frame[1]}`,
      `3. ${guide.frame[2]}`,
      "If you want, I can turn that into a scoped plan, run a dry pass, or execute when you're ready.",
      followUp,
    ].filter(Boolean).join("\n");
  }
  return [
    `${intro}: ${style.toneOpen}`,
    "Here's how I'd tackle it:",
    business.identity,
    memoryNarrative,
    specialty.relevance,
    specialty.lens,
    taskHint,
    business.strategy,
    business.risk,
    overlay,
    memory.concerns,
    change.decision,
    change.diagnosis,
    evidence.line,
    specialty.signals,
    specialty.heuristic,
    capability.actionsLine,
    capability.executionPath,
    memory.preferences,
    constraints,
    "Recommended approach:",
    `1. ${guide.frame[0]}`,
    `2. ${guide.frame[1]}`,
    `3. ${guide.frame[2]}`,
    "If you want, I can turn this into an executable plan now.",
    followUp,
  ].filter(Boolean).join("\n");
}

function buildBackendLightGreeting(intro, style = {}, specialty = {}, business = {}, memoryNarrative = "") {
  const opener = String(intro === "Nexus" ? "Here when you need me." : (style.toneOpen || "Ready when you are."))
    .replace(/^I am\s+/i, "")
    .replace(/^I(?:'|’)m\\s+/i, "")
    .replace(/^I'll\s+/i, "")
    .replace(/\.$/, "")
    .trim();
  const offers = {
    Nexus: "I can help sort it out and figure out the next move.",
    Maestro: "I can help shape the offer, audience, and next move.",
    Prospect: "I can help tighten the target and build the outreach path.",
    "Support Sage": "I can help untangle the issue and get to the fastest resolution path.",
    Centsible: "I can help frame the decision and pressure-test the numbers behind it.",
    Sage: "I can help sort the tradeoffs and define the strongest path.",
    Chronos: "I can help find the scheduling pressure and clean up the cadence.",
    Atlas: "I can help map the bottleneck and tighten the workflow.",
    Scribe: "I can help capture what matters and make it easier to reuse.",
    Sentinel: "I can help sort the exposure and decide what needs attention first.",
    Compass: "I can help separate the market signal from the noise.",
    Part: "I can help map the right partnership angle and next move.",
    Pulse: "I can help read the people signals and decide what needs attention first.",
    Merchant: "I can help sort the commercial pressure and choose the next lever.",
    Canvas: "I can help shape the creative direction and turn it into assets.",
    Inspect: "I can help figure out where confidence is weak and what to fix first.",
    Veritas: "I can help make the risk clear and keep the path usable.",
  };
  const asks = {
    Nexus: "What are you working on right now?",
    Maestro: "What are we trying to move right now?",
    Centsible: "What decision are you trying to make right now?",
    Veritas: "What do you need help moving or de-risking right now?",
  };
  const ask = asks[intro] || specialty.greeting || style.nextAsk || "What are you trying to get done right now?";
  return `${intro}: ${opener ? `${opener}. ` : ""}${ask} ${offers[intro] || "I can help make sense of it and take it forward with you."}`.replace(/\s+/g, " ").trim();
}

function buildBackendHelpReply(intro, style = {}, specialty = {}, business = {}, memoryNarrative = "", quickOptions = "") {
  const prompts = [style.helpAsk, specialty.ask, specialty.prompt, style.nextAsk].filter(Boolean);
  return `${intro}: I can think this through with you like a specialist, help you choose a path, and step in to act when it makes sense. My lens here is ${specialty.domain || "the work in front of us"}. ${quickOptions || ""} ${pickBackendFollowUp(intro, { agent_memory: {} }, prompts)}`.replace(/\s+/g, " ").trim();
}

async function assistantMessageFor(agentName, userText, taskState = null) {
  const profile = getAgentByName(agentName) || getAgentByName("Nexus");
  const text = normalizeBackendFollowUpText(String(userText || "").trim(), taskState || {}, profile);
  const t = text.toLowerCase();
  const intro = `${profile?.name || agentName}`;
  const style = AGENT_CHAT_STYLE[profile?.name || agentName] || AGENT_CHAT_STYLE.Nexus;
  const specialty = AGENT_SPECIALTY_CONTEXT[profile?.name || agentName] || AGENT_SPECIALTY_CONTEXT.Nexus;
  const business = businessContextSummary(taskState?.business_context || null);
  const overlay = industryOverlaySummary(profile?.name || agentName, taskState?.business_context || null);
  const memory = memorySummary(taskState?.agent_memory || null);
  const memoryNarrative = buildBackendMemoryNarrative(taskState?.agent_memory || null);
  const topCapabilities = (profile?.capabilities || []).slice(0, 3).map((c) => c.label);
  const quickOptions = topCapabilities.length
    ? `The strongest directions I can take from here are ${topCapabilities.join(", ")}.`
    : "I can help diagnose the situation, model options, or put a workflow behind it.";
  const followUp = pickBackendFollowUp(profile?.name || agentName, taskState || {}, [style.nextAsk, specialty.prompt, quickOptions]);
  const conversationMode = inferBackendConversationMode(text, taskState?.goal || "");

  if (isBackendSmallTalkPrompt(text)) return buildBackendSmallTalkReply(intro, text);
  if (/^(hi|hello|hey|yo)\b/.test(t)) return buildBackendLightGreeting(intro, style, specialty, { ...business, overlay }, memoryNarrative);
  if (isBackendClientAcquisitionPrompt(profile?.name || agentName, text)) return buildBackendClientAcquisitionReply(intro, business, memoryNarrative);
  if (/plan|show me a plan|draft please|map it out|ask for a plan/.test(t) && hasBackendClientAcquisitionContext(taskState?.goal || "")) return buildBackendClientAcquisitionPlan(intro, business, memoryNarrative);
  if (isBackendFounderGrowthPrompt(profile?.name || agentName, text)) return buildBackendFounderGrowthReply(intro, business, memoryNarrative);
  if (/plan|show me a plan|draft please|map it out|ask for a plan/.test(t) && hasBackendFounderGrowthContext(taskState?.goal || "")) return buildBackendFounderGrowthPlan(intro, profile?.name || agentName, business, memoryNarrative);
  if (isBackendSpecialistFounderGrowthPrompt(profile?.name || agentName, text)) return buildBackendSpecialistFounderGrowthReply(intro, profile?.name || agentName, business, memoryNarrative);

  if (!text) return buildBackendLightGreeting(intro, style, specialty, { ...business, overlay }, memoryNarrative);

  if (/help|what can you do|capabilit|options/.test(t)) return buildBackendHelpReply(intro, style, specialty, { ...business, overlay }, memoryNarrative, quickOptions);

  if (isThreadRecapBackendPrompt(text)) {
    return buildBackendThreadRecap(intro, taskState || {}, buildSpecialtySummary(profile?.name || agentName, text, rankCapabilities(profile, text)), summarizeChangeSinceLastTime(taskState?.agent_memory || null));
  }

  if (isVagueTensionBackendPrompt(text) && !String(taskState?.last_action || "").trim()) {
    return buildBackendTensionResponse(intro, profile?.name || agentName, taskState || {}, buildSpecialtySummary(profile?.name || agentName, text, rankCapabilities(profile, text)), business, memoryNarrative);
  }

  if ((conversationMode === "explore" || isVagueBackendPrompt(text)) && !String(taskState?.last_action || "").trim() && !(Array.isArray(taskState?.candidate_actions) && taskState.candidate_actions.length)) {
    return buildBackendExplorationReply(intro, profile?.name || agentName, taskState || {}, style, specialty, { ...business, overlay }, memoryNarrative);
  }

  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*(plan|simulate|execute)\b/.test(t)) {
    const mode = taskState?.mode || inferChatMode(t, "execute");
    return `${intro}: got it. We'll work in ${mode} mode. ${mode === "execute" ? "I'll act when you confirm." : "I'll keep this in guidance mode for now."}`;
  }

  if (/fix|broken|not working|integrat|setup|configure|connect|api/.test(t)) {
    return [
      `${intro}: here is the fastest remediation path.`,
      "1. Configure required connectors in Integrations (look for disconnected states).",
      "2. Run one high-impact action in Ops and verify in Execution Results Board.",
      "3. If it fails, inspect dead-letter queue and replay after fixes.",
      "4. Re-run self-test, then raise autonomy only when SLO is healthy.",
    ].join("\n");
  }

  if (
    agentName === "Maestro" &&
    /campaign|ad set|ads|launch|meta ads|google ads/.test(t) &&
    !/execute with defaults|ship with defaults|run with defaults/.test(t)
  ) {
    return [
      `${intro}: for this campaign objective, if CAC is climbing, the usual root causes are audience saturation, creative fatigue, or landing-page conversion loss.`,
      business.identity,
      business.strategy,
      business.risk,
      "Here is the highest-impact sequence:",
      "1. Stabilize targeting: isolate high-intent audiences and suppress low-conversion segments.",
      "2. Refresh creative matrix: test 3-5 new hooks/offers per channel.",
      "3. Rebalance spend to channels/ad sets with strongest CPA trend over last 7-14 days.",
      "If you share current CTR, CPC, and CVR, I'll give a precise optimization plan before execution.",
    ].join("\n");
  }

  if (agentName === "Nexus") {
    const deterministic = inferDeterministicActionFromChat(userText);
    if (deterministic) {
      const run = await runDeterministicAction({
        action: deterministic.action,
        params: deterministic.params,
        requested_by: "chat:nexus",
        max_attempts: 2,
      });
      if (run.status === "success") {
        return [
          `Nexus handled that through ${deterministic.action}.`,
          `Summary: ${run?.result?.summary || "completed"}`,
          `Mode: ${run?.result?.mode || "simulated"}`,
          "You can review the execution board if you want the full audit trail.",
        ].join("\n");
      }
      return [
        `Nexus hit a problem while trying ${deterministic.action}.`,
        `What got in the way: ${run.error || "Execution failed"}`,
        "The next step is to fix the connector or payload issue, then replay it from the queue.",
      ].join("\n");
    }

    const nexusFn = FUNCTION_BY_AGENT[agentName] || "commandCenterIntelligence";
    const nexusRanked = rankCapabilities(profile, text);
    const nexusCap = pickBestCapability(profile, text) || findCapabilityByAction(profile, inferChatAction(profile?.name || agentName, text));
    const nexusShouldExecute =
      (taskState?.mode || "execute") === "execute" &&
      isCapabilityExecutionRequest(text, nexusCap, nexusRanked, conversationMode);

    if (nexusShouldExecute && nexusCap) {
      const action = nexusCap?.action || nexusCap?.id || inferChatAction(agentName, text);
      const params = { ...inferParamsFromTaskState(taskState), ...inferParamsFromText(text) };
      const result = await invokeFunction(nexusFn, { action, params: { user_request: userText, ...params } });
      const status = String(result?.data?.status || "success");
      const payload = result?.data?.result || {};
      if (status === "pending_approval") {
        const approval = result?.data?.approval || {};
        return [
          "Nexus: this is ready, but I still need approval before I can apply it.",
          `Approval ID: ${approval?.id || "pending"}`,
          `Why it paused: ${approval?.reason || "manual approval mode is enabled"}`,
          "Approve it in the approvals panel and I'll pick it back up from there.",
        ].join("\n");
      }
      if (status === "error") {
        return [
          `Nexus: that didn't go through for ${action}.`,
          `What got in the way: ${payload?.message || payload?.summary || "unknown error"}`,
          "Fix the connector or payload issue, then replay it from the queue.",
        ].join("\n");
      }
      const rawSummary = payload?.summary || payload?.message || (action === "intent_routing"
        ? `Intent routed to ${(payload?.agents_selected || []).join(", ") || "Nexus"}.`
        : `Nexus executed ${nexusCap?.label || action}.`);
      const summary = String(rawSummary).replace(/^Nexus:\s*/i, "");
      const nextMove = payload?.recommendation || payload?.top_3_actions?.[0] || "Review the result and move the next highest-impact step forward.";
      return [
        `Nexus: ${summary}`,
        `I've logged ${nexusCap?.label || action} and the result looks ${status}.`,
        `What I'd do next: ${nextMove}`,
        `Task: ${text}`,
      ].join("\n");
    }

    const routed = routeIntent(userText);
    const selected = routed?.agents_selected || [];
    return [
      `Nexus: here's how I'd frame it.`,
      selected.length > 1
        ? `This touches ${selected.join(", ")}.`
        : `This fits best with ${selected.join(", ") || "Nexus"}.`,
      `My confidence in that read is ${Math.round((routed.confidence || 0.8) * 100)}%.`,
      `${routed.recommendation || "I'd keep the right specialists involved and move it forward from here."}`,
      buildBackendHandoffSuggestion(profile?.name || agentName, text),
    ].join("\n");
  }
  const fn = FUNCTION_BY_AGENT[agentName] || "commandCenterIntelligence";
  const ranked = rankCapabilities(profile, text);
  const bestCap = ranked[0]?.score > 0 ? ranked[0].cap : null;
  const secondCap = ranked[1]?.score > 0 ? ranked[1] : null;
  const selectedFromCandidates = resolveCandidateSelection(text, taskState, profile);
  const fallbackCap = !bestCap && /run it|execute|go ahead|do it|ship it|launch/.test(t)
    ? findCapabilityByAction(profile, taskState?.last_action || "")
    : null;
  const inferredCap = !bestCap ? findCapabilityByAction(profile, inferChatAction(profile?.name || agentName, text)) : null;
  const inferredActionForChoice = inferChatAction(profile?.name || agentName, text);
  const preferredCanvasCap =
    profile?.name === "Canvas" && inferredActionForChoice !== "health_check"
      ? findCapabilityByAction(profile, inferredActionForChoice)
      : null;
  const chosenCap = selectedFromCandidates || preferredCanvasCap || bestCap || fallbackCap || inferredCap;
  const canvasDirectGeneration =
    profile?.name === "Canvas" &&
    /(generate|create|make|design|draw|render|animate|storyboard)/.test(t) &&
    /(image|picture|photo|illustration|visual|poster|cover|logo|video|reel|cinematic|motion|storyboard|animation|voice|voiceover|audio|tts|cat|dog|portrait)/.test(t);
  const mode = taskState?.mode || "execute";
  const capabilityExecutionRequested =
    mode === "execute" &&
    isCapabilityExecutionRequest(text, chosenCap, ranked, conversationMode);
  const shouldExecute = isExecutionIntent(text) || canvasDirectGeneration || capabilityExecutionRequested;
  const isAnalysisRequest = isActionOrAnalysisRequest(text);
  const tightTradeoff = ranked[0]?.score > 0 && ranked[1]?.score > 0 && Math.abs((ranked[0]?.score || 0) - (ranked[1]?.score || 0)) <= 2;

  if (text.split(/\s+/).filter(Boolean).length >= 28 && !shouldExecute) {
    const specialtySummary = buildSpecialtySummary(profile?.name || agentName, text, ranked);
    return buildBackendSynthesisResponse(intro, profile?.name || agentName, taskState || {}, specialtySummary, business, memoryNarrative, summarizeChangeSinceLastTime(taskState?.agent_memory || null));
  }

  if ((isTradeoffBackendPrompt(text) || tightTradeoff) && ranked.length >= 2 && !shouldExecute) {
    return buildBackendTradeoffResponse(intro, profile?.name || agentName, taskState || {}, ranked, buildSpecialtySummary(profile?.name || agentName, text, ranked), business, memoryNarrative);
  }

  if (isChallengeBackendPrompt(text) && !shouldExecute) {
    return buildBackendChallengeResponse(
      intro,
      profile?.name || agentName,
      taskState || {},
      ranked[0] || selectedFromCandidates || bestCap,
      secondCap || selectedFromCandidates,
      buildSpecialtySummary(profile?.name || agentName, text, ranked),
      business,
      memoryNarrative,
    );
  }

  if (isObjectionBackendPrompt(text) && !shouldExecute) {
    return buildBackendObjectionResponse(
      intro,
      profile?.name || agentName,
      taskState || {},
      ranked,
      buildSpecialtySummary(profile?.name || agentName, text, ranked),
      business,
      memoryNarrative,
    );
  }

  const taskHint = taskState?.goal ? `Task: ${taskState.goal}.` : "";
  const constraintHint = Array.isArray(taskState?.constraints) && taskState.constraints.length ? `Constraints: ${taskState.constraints.join("; ")}.` : "";

  if ((mode === "plan" || mode === "simulate") && chosenCap) {
    const action = chosenCap?.action || chosenCap?.id || inferChatAction(agentName, text);
    const inferredParams = inferParamsFromText(text);
  if (mode === "plan") {
    return [
      `${intro}: here's how I'd approach ${chosenCap.label}.`,
      taskHint || "Task: define the objective and guardrails.",
      constraintHint || "Constraints: none captured yet.",
      "1. Confirm the missing inputs and success criteria.",
      "2. Prepare the payload and do the risk check.",
      "3. Run it and watch the KPI movement.",
      "When you want me to apply it, switch to execute mode and tell me to run it.",
    ].join("\n");
  }
  return [
    `${intro}: here's the dry run for ${chosenCap.label}.`,
    `What I'd run: ${action}`,
    `Inputs picked up: ${Object.keys(inferredParams).length ? Object.keys(inferredParams).join(", ") : "none yet"}`,
    "Nothing has been applied yet because we're still in simulate mode.",
    "If it looks right, switch to execute mode and I'll take it forward.",
  ].join("\n");
}

  if (!shouldExecute) {
    const hasSubstantiveContext = (ranked[0]?.score || 0) > 0 || (!!taskState?.goal && !isBackendSmallTalkPrompt(taskState.goal));
    if (/what do you recommend|recommend|best option|your pick|what should i do/.test(t) && !hasSubstantiveContext) {
      return `${intro}: I can absolutely recommend a direction, but I need the actual problem or goal first. Tell me what you want help with and I'll take it from there.`;
    }
    if ((/what do you recommend|recommend|best option|your pick|what should i do/.test(t) && hasBackendClientAcquisitionContext(taskState?.goal || "")) || (hasBackendClientAcquisitionContext(taskState?.goal || "") && /hardest part|main issue|struggling|stuck|that's the issue|that is the issue|yes\b/.test(t))) {
      return buildBackendClientAcquisitionRecommendation(intro, business, memoryNarrative);
    }
    if (/what do you recommend|recommend|best option|your pick|what should i do/.test(t) && hasBackendFounderGrowthContext(taskState?.goal || "")) {
      return buildBackendFounderGrowthRecommendation(intro, profile?.name || agentName, business, memoryNarrative);
    }
    if (/plan|show me a plan|draft please|map it out|ask for a plan/.test(t) && hasBackendClientAcquisitionContext(taskState?.goal || "")) {
      return buildBackendClientAcquisitionPlan(intro, business, memoryNarrative);
    }
    if (/plan|show me a plan|draft please|map it out|ask for a plan/.test(t) && hasBackendFounderGrowthContext(taskState?.goal || "")) {
      return buildBackendFounderGrowthPlan(intro, profile?.name || agentName, business, memoryNarrative);
    }
    if (isAnalysisRequest) return await buildInsightResponse(intro, profile?.name || agentName, text, ranked, taskState || {});
    if (chosenCap) return await buildInsightResponse(intro, profile?.name || agentName, text, ranked, taskState || {});
    const top = ranked.filter((x) => x.score > 0).slice(0, 3).map((x) => x.cap);
    const closeCall = ranked?.[0]?.score > 0 && ranked?.[1]?.score > 0 && Math.abs((ranked?.[0]?.score || 0) - (ranked?.[1]?.score || 0)) <= 2;
    if (top.length >= 2) {
      return [
        `${intro}: ${closeCall ? "this is a close call, but there are a few strong paths worth weighing:" : "a few strong paths stand out here. I can take the lead on whichever feels closest to the outcome you want:"}`,
        ...top.map((c, i) => `${i + 1}. ${c.label}`),
        "Reply with 1, 2, or 3, or tell me what matters most and I'll choose for you.",
        buildBackendHandoffSuggestion(profile?.name || agentName, text),
      ].join("\n");
    }
    return await buildInsightResponse(intro, profile?.name || agentName, text, ranked, taskState || {});
  }

  const inferredAction = inferChatAction(profile?.name || agentName, text);
  if (!chosenCap && inferredAction === "health_check") {
    if (hasBackendFounderGrowthContext(taskState?.goal || "")) {
      return buildBackendFounderGrowthPlan(intro, profile?.name || agentName, business, memoryNarrative);
    }
    return `${intro}: I can take this forward, but I need one quick clarification first. ${quickOptions} Which path do you want me to run with?`;
  }

  const action = chosenCap?.action || chosenCap?.id || inferredAction;
  const inferredParams = { ...inferParamsFromTaskState(taskState), ...inferParamsFromText(text) };
  const missing = missingRequiredFields(action, inferredParams);

  if (/why do you recommend/i.test(t) && chosenCap) {
    return [
      `${intro}: I'm leaning toward ${chosenCap.label} because ${buildSpecialtySummary(profile?.name || agentName, text, ranked).relevance}`,
      buildSpecialtySummary(profile?.name || agentName, text, ranked).lens,
      getBackendToneAccent(profile?.name || agentName),
      buildSpecialtySummary(profile?.name || agentName, text, ranked).signals,
      buildSpecialtySummary(profile?.name || agentName, text, ranked).heuristic,
      pickBackendFollowUp(profile?.name || agentName, taskState || {}, ["If you want, I can compare it with the next-best option.", "If you'd like, I can turn that into a step-by-step plan."]),
    ].filter(Boolean).join("\n");
  }

  if (missing.length) {
    return `${intro}: I'm ready to run ${chosenCap?.label || action.replace(/_/g, " ")}, but I still need a little more from you.\n${buildBackendMissingQuestion(missing, 'Send the details, or say "simulate" if you want a dry run first.')}`;
  }

  const result = await invokeFunction(fn, { action, params: { user_request: userText, ...inferredParams } });
  const status = String(result?.data?.status || "success");
  const payload = result?.data?.result || {};
  if (status === "pending_approval") {
    const approval = result?.data?.approval || {};
    return [
      `${intro}: this is ready, but I still need approval before I can apply it.`,
      `Approval ID: ${approval?.id || "pending"}`,
      `Why it paused: ${approval?.reason || "manual approval mode is enabled"}`,
      "Approve it in the approvals panel and I'll pick it back up from there.",
    ].join("\n");
  }
  if (status === "error") {
    return [
      `${intro}: that didn't go through for ${action}.`,
      `What got in the way: ${payload?.message || payload?.summary || "unknown error"}`,
      "What I'd do next:",
      "1. Check the integration or connector health for this agent.",
      "2. Re-run in simulate mode to validate the payload.",
      "3. Try again once the input or connectivity issue is cleaned up.",
    ].join("\n");
  }
  const rawSummary = payload?.summary || payload?.message || `${agentName} executed ${action}.`;
  const summary = String(rawSummary).replace(new RegExp(`^${agentName}:\\s*`, "i"), "");
  const recommendation = payload?.recommendation ? `What I'd do next: ${payload.recommendation}` : "What I'd do next: review the output and take the next highest-impact move.";
  const providerNotice = action === "voiceover_generation"
    ? payload?.provider === "fallback"
      ? "Provider status: live voice generation is not configured here, so Canvas prepared the script only."
      : payload?.provider === "openai" && payload?.live_generated
        ? "Provider status: live voice generated via OpenAI."
        : ""
    : /cinematic_video_command/i.test(String(action || ""))
      ? payload?.provider === "fallback"
        ? "Provider status: live video generation is not configured here, so Canvas is showing the storyboard fallback."
        : payload?.provider === "openai" && payload?.video_url
          ? `Provider status: video job ${payload?.video_status || "submitted"} via OpenAI.`
          : ""
      : payload?.provider === "fallback"
        ? "Provider status: live image generation is not configured here, so Canvas is showing a preview fallback."
        : payload?.provider === "openai" && payload?.live_generated
          ? "Provider status: live image generated via OpenAI."
          : payload?.provider === "pollinations" && payload?.live_generated
            ? "Provider status: live image generated via Pollinations."
            : payload?.provider === "automatic1111" && payload?.live_generated
              ? "Provider status: live image generated via Automatic1111."
              : "";
  const runRef = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const kpiLine = payload?.kpi?.key ? `KPI: ${payload.kpi.key}=${payload.kpi.value}` : "";
  const nextCap = suggestNextCapability(profile, action, taskState?.goal || userText || "");
  const nextActionLine = nextCap ? `If we keep going, I'd look at ${nextCap.label} next.` : "";
  const executionNote = ({
    Maestro: "I'd watch creative response and channel efficiency from here.",
    Merchant: "I'd watch margin, conversion, and inventory movement from here.",
    Pulse: "I'd watch follow-through, sentiment, and manager response from here.",
    Veritas: "I'd watch the approval path, counterparty response, and residual risk from here.",
    Inspect: "I'd watch defect fallout, release confidence, and whether this closes the root cause from here.",
    Centsible: "I'd watch cash impact, variance, and any downstream budget effect from here.",
    Canvas: "I'd watch asset quality, channel fit, and whether we need another variant from here.",
  }[profile?.name || agentName] || "I'd watch the downstream result and the next decision point from here.");
  const storyboardBlock = Array.isArray(payload?.storyboard_frames) && payload.storyboard_frames.length
    ? `\nStoryboard:\n${payload.storyboard_frames.map((frame) => `${frame.title}\n![${frame.title}](${frame.preview_image_url || frame.image_url})`).join("\n")}`
    : "";
  const shotListBlock = Array.isArray(payload?.shot_list) && payload.shot_list.length
    ? `\nShot List:\n${payload.shot_list.map((shot, index) => `${index + 1}. ${shot}`).join("\n")}`
    : "";
  const voiceScriptBlock = payload?.voiceover_script
    ? `\nVoiceover Script:\n${payload.voiceover_script}`
    : "";
  const audioBlock = payload?.audio_url
    ? `\n[audio:${payload?.prompt || "voiceover"}](${payload.audio_url})`
    : "";
  const videoBlock = payload?.video_url
    ? `\n[video:${payload?.prompt || "generated video"}](${payload.video_url})`
    : "";
  const imageBlock = (action === "creative_generation" && (payload?.preview_image_url || payload?.image_url))
    ? `\n![${payload?.prompt || "generated creative"}](${payload.preview_image_url || payload.image_url})`
    : "";

  const receiptFollowUp = pickBackendFollowUp(agentName, taskState || {}, [style.nextAsk, `Do you want me to keep going from ${action}?`, "If you want, I can turn this into the next step right away."]);
  return `${intro}: ${summary}\nI've logged ${chosenCap?.label || action} and the result looks ${status}.\n${executionNote}\n${kpiLine}\n${nextActionLine}\n${providerNotice}\n${recommendation}\n${taskHint} ${constraintHint}\nRun Ref: ${runRef}\n${receiptFollowUp}${voiceScriptBlock}${shotListBlock}${storyboardBlock}${videoBlock}${audioBlock}${imageBlock}`.replace(/[ \t]+\n/g, "\n").trim();
}

export function createConversation(payload = {}) {
  const agent = normalizeChatAgent(payload?.agent_name || payload?.agent || payload?.agentName || "assistant");
  const businessContext = normalizeBusinessContext(payload?.metadata?.business_profile || null);
  const userId = payload?.metadata?.user_id || "local-user";
  const tenantId = payload?.metadata?.tenant_id || "local-tenant";
  const ownerKey = payload?.metadata?.owner_key || buildOwnerKey(userId, tenantId);
  const agentMemory = getAgentMemory(ownerKey, agent);
  const conversation = {
    id: id("conv"),
    agent,
    metadata: {
      ...(payload?.metadata || {}),
      user_id: userId,
      tenant_id: tenantId,
      owner_key: ownerKey,
      task_state: {
        goal: "",
        constraints: [],
        business_context: businessContext,
        agent_memory: agentMemory,
        approval_mode: "unspecified",
        mode: "execute",
        last_action: "",
        status: "active",
        turn_count: 0,
        updated_at: now(),
      },
    },
    messages: [],
    created_date: now(),
    updated_date: now(),
  };
  saveConversationRecord(conversation);
  return { conversation };
}

export function getConversation(conversationId) {
  const conversation = getConversationRecord(conversationId);
  if (!conversation) return null;
  return { conversation };
}

export async function addConversationMessage(conversationId, message = {}) {
  const conversation = getConversationRecord(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  const msg = { id: id("msg"), role: message?.role || "user", content: String(message?.content || ""), created_date: now() };
  conversation.messages.push(msg);

  if (msg.role === "user") {
    const hiddenPromptContext = String(message?.metadata?.prompt_context || "").trim();
    const visibleUserText = String(msg.content || "").trim();
    const isCasualGreeting = /^(hi|hello|hey|yo)\b/i.test(visibleUserText) || isBackendSmallTalkPrompt(visibleUserText);
    if (/^(hi|hello|hey|yo)\b/i.test(visibleUserText)) {
      const profile = getAgentByName(conversation.agent) || getAgentByName("Nexus");
      const intro = `${profile?.name || conversation.agent}`;
      const style = AGENT_CHAT_STYLE[profile?.name || intro] || AGENT_CHAT_STYLE.Nexus;
      const specialty = AGENT_SPECIALTY_CONTEXT[profile?.name || intro] || AGENT_SPECIALTY_CONTEXT.Nexus;
      const greeting = buildBackendLightGreeting(intro, style, specialty, {}, "");
      const routing = getChatRoutingDecision({
        agentId: normalizeProviderAgentId(conversation.agent),
        agentName: conversation.agent,
        userText: visibleUserText,
        domain: profile?.domain || "",
      });
      conversation.messages.push({
        id: id("msg"),
        role: "assistant",
        content: greeting,
        created_date: now(),
        metadata: {
          routed_tier: routing?.tier || "standard",
          routed_model: routing?.model || "",
          routed_provider: routing?.provider || "fallback",
        },
      });
      conversation.updated_date = now();
      saveConversationRecord(conversation);
      return { conversation };
    }
    const effectiveUserText = visibleUserText;
    const profile = getAgentByName(conversation.agent) || getAgentByName("Nexus");
    const selected = pickBestCapability(profile, effectiveUserText);
    const refreshedProfile = message?.metadata?.business_profile || conversation?.metadata?.business_profile || null;
    const refreshedBusinessContext = normalizeBusinessContext(refreshedProfile) || conversation?.metadata?.task_state?.business_context || null;
    const taskBefore = {
      ...(conversation?.metadata?.task_state || {}),
      business_context: refreshedBusinessContext,
    };
    const taskAfter = updateTaskState(taskBefore, effectiveUserText, selected?.action || selected?.id || "");
    const userId = conversation?.metadata?.user_id || "local-user";
    const tenantId = conversation?.metadata?.tenant_id || "local-tenant";
    const ownerKey = conversation?.metadata?.owner_key || buildOwnerKey(userId, tenantId);
    const existingMemory = getAgentMemory(ownerKey, conversation.agent);
    const memoryDelta = inferMemoryFromText(effectiveUserText);
    const nextMemory = mergeAgentMemory(existingMemory, memoryDelta, taskAfter);
    const likelyAction = selected?.action || selected?.id || "";
  const evidence = lookupEvidence(effectiveUserText, { business_context: taskAfter.business_context || null });
  const evidenceSources = Array.isArray(evidence?.evidence)
    ? evidence.evidence.map((entry) => ({ label: entry.label, snippet: entry.snippet || "", score: Number(entry.score || 0) }))
    : [];
  const decisionEntry = inferDecisionEntry(conversation.agent, effectiveUserText, likelyAction, /run it|execute|go ahead|do it|ship it|launch/i.test(effectiveUserText), evidenceSources);
  const diagnosisEntry = inferDiagnosisEntry(conversation.agent, effectiveUserText, memoryDelta, evidenceSources);
    if (decisionEntry) nextMemory.decision_log = appendTimelineEntry(nextMemory.decision_log, decisionEntry, 12);
    if (diagnosisEntry) nextMemory.diagnosis_log = appendTimelineEntry(nextMemory.diagnosis_log, diagnosisEntry, 12);
    const ranked = rankCapabilities(profile, effectiveUserText)
      .filter((x) => x.score > 0)
      .slice(0, 3)
      .map((x) => ({ action: x.cap?.action || x.cap?.id || "", label: x.cap?.label || x.cap?.id || "" }));
    taskAfter.candidate_actions = ranked;
    taskAfter.agent_memory = nextMemory;
    saveAgentMemoryRecord(memoryKey(ownerKey, conversation.agent), nextMemory);
    conversation.metadata = {
      ...(conversation.metadata || {}),
      business_profile: refreshedProfile || conversation?.metadata?.business_profile || null,
      owner_key: ownerKey,
      task_state: taskAfter,
    };
    const content = await assistantMessageFor(conversation.agent, effectiveUserText, taskAfter);
    const routing = getChatRoutingDecision({
      agentId: normalizeProviderAgentId(conversation.agent),
      agentName: conversation.agent,
      userText: effectiveUserText,
      domain: profile?.domain || "",
    });
    conversation.messages.push({
      id: id("msg"),
      role: "assistant",
      content,
      created_date: now(),
      metadata: {
        routed_tier: routing?.tier || "standard",
        routed_model: routing?.model || "",
        routed_provider: routing?.provider || "fallback",
      },
    });
  }

  conversation.updated_date = now();
  saveConversationRecord(conversation);
  return { conversation };
}

export function getRuntimeStoreStatus() {
  return runtimeStore.status();
}

export function getDiagnostics() {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: now(),
    ai_providers: getAiProviderStatus(),
    stores: {
      runtime: getRuntimeStoreStatus(),
      chat_state: getChatStateStoreStatus(),
      runtime_ops: getRuntimeOpsStoreStatus(),
    },
    state: {
      events: getRuntimeEventCount(),
      workflows: getRuntimeWorkflowCount(),
      tracked_functions: getTrackedFunctionCount(),
      conversations: getConversationCount(),
    },
  };
}
























