import { agentFabric } from "@/lib/agentFabric";
import { loadPersisted, savePersisted, mergeObject } from "@/lib/persistentStore";
import { addRemoteConversationMessage, createRemoteConversation, getRemoteConversation, hasRemoteBackend, invokeRemoteFunction } from "@/lib/remoteAgentClient";
import { workflowEngine } from "@/lib/workflowEngine";
import { telemetry } from "@/lib/telemetry";

const mem = { db: {}, convs: {}, subs: {} };
const now = () => new Date().toISOString();
const id = (p = "id") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const user = () => ({ id: "local_user", full_name: "Local User", email: "local@localhost", role: "admin" });
const rows = (n) => {
  mem.db[n] = mem.db[n] || [];
  return mem.db[n];
};
const fnHistory = {};
const localState = {
  connectors: {
    prospectLeadGeneration: {
      connector: {
        provider: "gmail",
        inbox_address: "sales@company.com",
        auth_type: "oauth2",
        host: "",
        port: 993,
        username: "",
        secure: true,
        client_id: "",
        tenant_id: "",
        api_base_url: "",
      },
      secret_refs: {
        token_secret_name: "PROSPECT_EMAIL_TOKEN",
        client_secret_name: "PROSPECT_CLIENT_SECRET",
        password_secret_name: "PROSPECT_IMAP_PASSWORD",
      },
    },
    supportSageCustomerService: {
      connector: {
        provider: "gmail",
        inbox_address: "support@company.com",
        auth_type: "oauth2",
        host: "",
        port: 993,
        username: "",
        secure: true,
        client_id: "",
        tenant_id: "",
        api_base_url: "",
      },
      secret_refs: {
        token_secret_name: "SUPPORT_EMAIL_TOKEN",
        client_secret_name: "SUPPORT_CLIENT_SECRET",
        password_secret_name: "SUPPORT_IMAP_PASSWORD",
      },
    },
    centsibleFinanceEngine: {
      connector: {
        provider: "quickbooks",
        auth_type: "oauth2",
        account_label: "Primary Finance Org",
        tenant_id: "",
        realm_id: "",
        api_base_url: "",
        client_id: "",
      },
      secret_refs: {
        api_key_secret_name: "CENTSIBLE_API_KEY",
        client_secret_name: "CENTSIBLE_CLIENT_SECRET",
        refresh_token_secret_name: "CENTSIBLE_REFRESH_TOKEN",
      },
    },
  },
};
const STORAGE_KEY = "nexus.base44.local.v1";
const persisted = loadPersisted(STORAGE_KEY, null);
if (persisted?.mem?.db) mem.db = mergeObject(mem.db, persisted.mem.db);
if (persisted?.mem?.convs) mem.convs = mergeObject(mem.convs, persisted.mem.convs);
if (persisted?.fnHistory) Object.assign(fnHistory, persisted.fnHistory);
if (persisted?.localState) {
  localState.connectors = mergeObject(localState.connectors, persisted.localState.connectors || {});
}
const persistRuntime = () => {
  savePersisted(STORAGE_KEY, {
    mem: { db: mem.db, convs: mem.convs },
    fnHistory,
    localState,
  });
};
const pushFnHistory = (fn, action, status = "completed", description = "") => {
  fnHistory[fn] = fnHistory[fn] || [];
  const entry = {
    id: id("run"),
    title: String(action || "run").replace(/_/g, " "),
    status,
    description: description || `[${fn}] ${action} executed in local mode`,
    created_date: now(),
  };
  fnHistory[fn].unshift(entry);
  fnHistory[fn] = fnHistory[fn].slice(0, 50);
  persistRuntime();
  return entry;
};
const getFnHistory = (fn) => fnHistory[fn] || [];

const AGENT_BY_FUNCTION = {
  commandCenterIntelligence: "Nexus",
  maestroSocialOps: "Maestro",
  prospectLeadGeneration: "Prospect",
  supportSageCustomerService: "Support Sage",
  centsibleFinanceEngine: "Centsible",
  sageBussinessStrategy: "Sage",
  chronosSchedulingEngine: "Chronos",
  atlasWorkflowAutomation: "Atlas",
  scribeKnowledgeBase: "Scribe",
  sentinelSecurityMonitoring: "Sentinel",
  compassMarketIntelligence: "Compass",
  partPartnershipEngine: "Part",
  pulseHREngine: "Pulse",
  merchantProductManagement: "Merchant",
  canvasCreativeGeneration: "Canvas",
  inspectQualityEngine: "Inspect",
  veritasComplianceValidation: "Veritas",
};

const buildCapabilityResult = (agentName, capabilityId, runtimeParams = {}) => {
  const capKey = String(capabilityId || "capability").split(".").pop() || "capability";
  const label = capKey.replace(/_/g, " ");
  const lib = CAPABILITY_LIBRARY[agentName] || [];
  const capMeta = lib.find((x) => x.id === capKey) || lib.find((x) => String(capabilityId).includes(x.id));
  return {
    ok: true,
    agent: agentName,
    capability_id: capabilityId,
    capability_label: capMeta?.label || label,
    impact: capMeta?.impact || "medium",
    summary: `${agentName} executed ${capMeta?.label || label} with local intelligence mode.`,
    insights: [
      `${agentName} baseline health is stable for this capability area.`,
      `No blocking errors detected during ${capMeta?.label || label} execution.`,
      `Confidence is high enough to proceed with next-step actions.`,
    ],
    next_actions: [
      `Review the recommended plan for ${capMeta?.label || label}.`,
      `Execute highest-impact action first and monitor outcome.`,
      `Re-run this capability after applying changes to compare deltas.`,
    ],
    runtime_params: runtimeParams,
    timestamp: now(),
  };
};

const ents = new Proxy({}, {
  get: (_, n) => ({
    list: async (s = "-created_date", l) => {
      const d = [...rows(String(n))];
      const f = String(s).replace("-", "");
      d.sort((a, b) => (a?.[f] > b?.[f] ? 1 : -1));
      if (String(s).startsWith("-")) d.reverse();
      return typeof l === "number" ? d.slice(0, l) : d;
    },
    filter: async (c = {}, s = "-created_date", l) => {
      const d = rows(String(n)).filter((r) => Object.entries(c).every(([k, v]) => r?.[k] === v));
      const f = String(s).replace("-", "");
      d.sort((a, b) => (a?.[f] > b?.[f] ? 1 : -1));
      if (String(s).startsWith("-")) d.reverse();
      return typeof l === "number" ? d.slice(0, l) : d;
    },
    create: async (x = {}) => {
      const o = { id: id(String(n).toLowerCase()), created_date: now(), updated_date: now(), ...x };
      rows(String(n)).unshift(o);
      persistRuntime();
      return o;
    },
    update: async (i, p = {}) => {
      const d = rows(String(n));
      const k = d.findIndex((r) => r.id === i);
      if (k < 0) throw new Error("Not found");
      d[k] = { ...d[k], ...p, updated_date: now() };
      persistRuntime();
      return d[k];
    },
    delete: async (i) => {
      mem.db[String(n)] = rows(String(n)).filter((r) => r.id !== i);
      persistRuntime();
      return { success: true };
    },
  }),
});

const emit = (cid) => {
  const c = mem.convs[cid];
  (mem.subs[cid] || []).forEach((cb) => cb({ conversation: c, messages: c?.messages || [] }));
};

const auth = {
  me: async () => user(),
  updateMe: async (d = {}) => ({ ...user(), ...d }),
  deleteMe: async () => ({ success: true }),
  redirectToLogin: (_u) => {
    if (typeof window !== "undefined") window.location.href = `/`;
  },
  loginWithProvider: (_p, f = "/") => {
    if (typeof window !== "undefined") window.location.href = f;
  },
  loginViaEmailPassword: async (email) => ({ access_token: "local", user: { ...user(), email: email || user().email } }),
  isAuthenticated: async () => true,
  setToken: () => {},
  logout: (r) => {
    if (typeof window !== "undefined" && r) window.location.href = r;
  },
  inviteUser: async (e, r = "user") => ({ success: true, invited: e, role: r }),
};
const CAPABILITY_LIBRARY = {
  "Maestro": [
    { id: "campaign_orchestration", label: "Campaign Orchestration", description: "Plans and coordinates multi-channel campaign execution.", impact: "high" },
    { id: "lifecycle_automation", label: "Lifecycle Automation", description: "Builds trigger-based lifecycle journeys for retention and conversion.", impact: "high" },
    { id: "creative_brief_generation", label: "Creative Brief Generation", description: "Generates channel-ready creative briefs and messaging pillars.", impact: "medium" },
    { id: "ab_test_planning", label: "A/B Test Planning", description: "Designs controlled experiments for campaign optimization.", impact: "medium" },
    { id: "performance_scorecard", label: "Performance Scorecard", description: "Summarizes spend, CAC, CTR, CVR, and recommendations.", impact: "high" },
  ],
  "Prospect": [
    { id: "lead_discovery", label: "Lead Discovery", description: "Finds high-fit leads from defined ICP criteria.", impact: "high" },
    { id: "lead_scoring", label: "Lead Scoring", description: "Ranks leads by intent, fit, and conversion probability.", impact: "high" },
    { id: "profile_enrichment", label: "Profile Enrichment", description: "Enriches firmographic and contact-level data.", impact: "medium" },
    { id: "outreach_drafting", label: "Outreach Drafting", description: "Creates personalized outreach sequences for each segment.", impact: "high" },
    { id: "pipeline_analytics", label: "Pipeline Analytics", description: "Analyzes funnel velocity, leakage, and conversion blockers.", impact: "high" },
  ],
  "Support Sage": [
    { id: "ticket_triage", label: "Ticket Triage", description: "Classifies and prioritizes inbound support requests.", impact: "high" },
    { id: "response_recommendation", label: "Response Recommendation", description: "Suggests empathetic, policy-aligned responses.", impact: "high" },
    { id: "sentiment_analysis", label: "Sentiment Analysis", description: "Detects customer sentiment and escalation risk.", impact: "medium" },
    { id: "sla_monitoring", label: "SLA Monitoring", description: "Monitors response and resolution SLA performance.", impact: "high" },
    { id: "csat_driver_analysis", label: "CSAT Driver Analysis", description: "Identifies root causes behind satisfaction changes.", impact: "medium" },
  ],
  "Centsible": [
    { id: "cash_flow_forecast", label: "Cash Flow Forecast", description: "Projects short and medium-term liquidity position.", impact: "high" },
    { id: "budget_variance", label: "Budget Variance", description: "Compares actuals vs budget and flags variance drivers.", impact: "high" },
    { id: "anomaly_detection", label: "Anomaly Detection", description: "Detects unusual financial events and outliers.", impact: "high" },
    { id: "runway_estimation", label: "Runway Estimation", description: "Estimates runway under multiple burn scenarios.", impact: "high" },
    { id: "revenue_leakage_scan", label: "Revenue Leakage Scan", description: "Identifies billing or process leak points.", impact: "medium" },
  ],
  "Sage": [
    { id: "strategy_scorecard", label: "Strategy Scorecard", description: "Assesses strategic progress against objective metrics.", impact: "high" },
    { id: "scenario_modeling", label: "Scenario Modeling", description: "Models strategic what-if scenarios and outcomes.", impact: "high" },
    { id: "opportunity_mapping", label: "Opportunity Mapping", description: "Maps growth vectors by impact and feasibility.", impact: "medium" },
    { id: "risk_tradeoff_analysis", label: "Risk Tradeoff Analysis", description: "Analyzes upside vs downside across options.", impact: "medium" },
    { id: "strategic_briefing", label: "Strategic Briefing", description: "Generates leadership-ready strategic recommendations.", impact: "high" },
  ],
  "Chronos": [
    { id: "smart_scheduling", label: "Smart Scheduling", description: "Optimizes calendars for availability and priority.", impact: "high" },
    { id: "focus_blocking", label: "Focus Blocking", description: "Protects deep-work windows automatically.", impact: "medium" },
    { id: "meeting_load_audit", label: "Meeting Load Audit", description: "Finds meeting overload and optimization opportunities.", impact: "medium" },
    { id: "deadline_alignment", label: "Deadline Alignment", description: "Aligns milestones with team capacity and dependencies.", impact: "high" },
    { id: "weekly_time_report", label: "Weekly Time Report", description: "Summarizes time usage, drag factors, and actions.", impact: "medium" },
  ],
  "Atlas": [
    { id: "workflow_automation", label: "Workflow Automation", description: "Automates repeatable operational workflows.", impact: "high" },
    { id: "task_routing", label: "Task Routing", description: "Routes tasks by skill, load, and urgency.", impact: "high" },
    { id: "dependency_tracking", label: "Dependency Tracking", description: "Tracks cross-task and cross-project dependencies.", impact: "medium" },
    { id: "capacity_planning", label: "Capacity Planning", description: "Forecasts workload and resource constraints.", impact: "high" },
    { id: "ops_status_briefing", label: "Ops Status Briefing", description: "Generates operational status and bottleneck report.", impact: "medium" },
  ],
  "Scribe": [
    { id: "knowledge_capture", label: "Knowledge Capture", description: "Captures decisions, context, and action items.", impact: "high" },
    { id: "document_structuring", label: "Document Structuring", description: "Turns raw notes into structured documentation.", impact: "medium" },
    { id: "sop_generation", label: "SOP Generation", description: "Generates operational SOPs from observed workflows.", impact: "high" },
    { id: "semantic_retrieval", label: "Semantic Retrieval", description: "Finds relevant knowledge via semantic matching.", impact: "high" },
    { id: "audit_trail_export", label: "Audit Trail Export", description: "Produces traceable records for audits.", impact: "medium" },
  ],
  "Sentinel": [
    { id: "threat_scan", label: "Threat Scan", description: "Scans for suspicious activity and threat indicators.", impact: "high" },
    { id: "incident_triage", label: "Incident Triage", description: "Prioritizes incidents by severity and blast radius.", impact: "high" },
    { id: "vulnerability_review", label: "Vulnerability Review", description: "Summarizes open vulnerabilities and remediation urgency.", impact: "high" },
    { id: "security_posture_report", label: "Security Posture Report", description: "Reports current posture, risk trends, and mitigations.", impact: "medium" },
    { id: "response_playbook", label: "Response Playbook", description: "Generates incident response actions and owners.", impact: "medium" },
  ],
  "Compass": [
    { id: "market_briefing", label: "Market Briefing", description: "Creates market pulse briefing from key external signals.", impact: "high" },
    { id: "competitor_tracking", label: "Competitor Tracking", description: "Tracks competitor launches and positioning shifts.", impact: "high" },
    { id: "trend_detection", label: "Trend Detection", description: "Detects emerging trends relevant to your vertical.", impact: "medium" },
    { id: "sentiment_signal_read", label: "Sentiment Signal Read", description: "Reads sentiment shifts across channels.", impact: "medium" },
    { id: "opportunity_alerting", label: "Opportunity Alerting", description: "Flags high-impact market opportunities.", impact: "high" },
  ],
  "Part": [
    { id: "partner_discovery", label: "Partner Discovery", description: "Finds strategic partner candidates by fit score.", impact: "high" },
    { id: "relationship_scoring", label: "Relationship Scoring", description: "Scores partner relationship health and momentum.", impact: "medium" },
    { id: "co_marketing_planning", label: "Co-Marketing Planning", description: "Builds partner co-marketing playbooks.", impact: "medium" },
    { id: "alliance_pipeline", label: "Alliance Pipeline", description: "Tracks partner pipeline stages and blockers.", impact: "high" },
    { id: "partner_roi_review", label: "Partner ROI Review", description: "Evaluates partnership impact on growth and revenue.", impact: "high" },
  ],
  "Pulse": [
    { id: "sentiment_monitor", label: "Sentiment Monitor", description: "Monitors team mood and engagement trends.", impact: "high" },
    { id: "burnout_risk_detection", label: "Burnout Risk Detection", description: "Flags burnout indicators from work patterns.", impact: "high" },
    { id: "retention_risk", label: "Retention Risk", description: "Predicts attrition risk and retention interventions.", impact: "medium" },
    { id: "recognition_insights", label: "Recognition Insights", description: "Surfaces wins and recognition opportunities.", impact: "low" },
    { id: "people_analytics", label: "People Analytics", description: "Summarizes capacity, morale, and team health.", impact: "medium" },
  ],
  "Merchant": [
    { id: "catalog_health", label: "Catalog Health", description: "Audits product content quality and completeness.", impact: "medium" },
    { id: "inventory_risk", label: "Inventory Risk", description: "Flags stockout and overstock risk by SKU.", impact: "high" },
    { id: "pricing_intelligence", label: "Pricing Intelligence", description: "Suggests pricing moves based on demand and margin.", impact: "high" },
    { id: "conversion_optimization", label: "Conversion Optimization", description: "Highlights conversion bottlenecks in purchase flow.", impact: "high" },
    { id: "store_health", label: "Store Health", description: "Summarizes commerce health with actionable priorities.", impact: "medium" },
  ],
  "Canvas": [
    { id: "creative_generation", label: "Creative Generation", description: "Generates campaign-ready visual concepts.", impact: "high" },
    { id: "cinematic_video_command", label: "Cinematic Video Command", description: "Builds storyboard frames and video generation briefs.", impact: "high" },
    { id: "voiceover_generation", label: "Voiceover Generation", description: "Creates narrated voiceover scripts and audio-ready direction.", impact: "medium" },
    { id: "brand_compliance", label: "Brand Compliance", description: "Checks assets for guideline adherence.", impact: "high" },
    { id: "format_adaptation", label: "Format Adaptation", description: "Adapts creative for web, social, and print formats.", impact: "medium" },
    { id: "variant_testing", label: "Variant Testing", description: "Produces A/B variants for creative performance testing.", impact: "medium" },
    { id: "creative_performance", label: "Creative Performance", description: "Summarizes engagement and conversion by asset.", impact: "high" },
  ],
  "Inspect": [
    { id: "test_orchestration", label: "Test Orchestration", description: "Runs prioritized test suites across critical paths.", impact: "high" },
    { id: "regression_scan", label: "Regression Scan", description: "Detects regressions introduced by recent changes.", impact: "high" },
    { id: "quality_gate", label: "Quality Gate", description: "Evaluates release readiness against quality thresholds.", impact: "high" },
    { id: "root_cause_analysis", label: "Root Cause Analysis", description: "Clusters failures and identifies likely causes.", impact: "medium" },
    { id: "defect_trend_report", label: "Defect Trend Report", description: "Summarizes quality trends and hotspots.", impact: "medium" },
  ],
  "Veritas": [
    { id: "contract_risk_review", label: "Contract Risk Review", description: "Flags contractual risk and clause deviations.", impact: "high" },
    { id: "compliance_audit", label: "Compliance Audit", description: "Evaluates policy and regulatory adherence.", impact: "high" },
    { id: "obligation_tracking", label: "Obligation Tracking", description: "Tracks legal obligations and renewal deadlines.", impact: "medium" },
    { id: "policy_update_check", label: "Policy Update Check", description: "Detects policy gaps against legal changes.", impact: "medium" },
    { id: "legal_risk_register", label: "Legal Risk Register", description: "Maintains ranked legal risk and mitigations.", impact: "high" },
  ],
};

const CAPABILITY_AGENTS = Object.keys(CAPABILITY_LIBRARY);

const ACTION_MATRIX_EXTRAS = {
  commandCenterIntelligence: ["agent_registry_status","command_center_full_self_test","intent_routing","start_workflow","cross_agent_insights","scenario_modeling","workflow_health","business_health_score","alert_correlation","system_action_matrix"],
  maestroSocialOps: ["run_history","unified_social_health","full_ops_self_test"],
  prospectLeadGeneration: ["prospect_run_history","prospect_health_snapshot","inbox_connector_load","inbox_connector_save","inbox_connector_register_secret_refs","inbox_connector_test"],
  supportSageCustomerService: ["support_kpi_command_center","support_connector_load","support_connector_save","support_connector_register_secret_refs","support_connector_test"],
  centsibleFinanceEngine: ["financial_health_check","centsible_connector_load","centsible_connector_save","centsible_connector_register_secret_refs","centsible_connector_test"],
  atlasWorkflowAutomation: ["atlas_full_self_test"],
  chronosSchedulingEngine: ["time_audit","chronos_full_self_test"],
  compassMarketIntelligence: ["market_briefing","compass_full_self_test"],
  sentinelSecurityMonitoring: ["security_posture_report","sentinel_full_self_test"],
};

const buildActionMatrix = () => {
  const matrix = {};
  Object.entries(AGENT_BY_FUNCTION).forEach(([fn, agent]) => {
    const caps = CAPABILITY_LIBRARY[agent] || [];
    matrix[fn] = matrix[fn] || new Set();
    caps.forEach((c) => matrix[fn].add(c.action || c.id));
  });
  Object.entries(ACTION_MATRIX_EXTRAS).forEach(([fn, actions]) => {
    matrix[fn] = matrix[fn] || new Set();
    actions.forEach((a) => matrix[fn].add(a));
  });
  const functions = Object.entries(matrix).map(([function_name, actions]) => ({
    function_name,
    action_count: actions.size,
    actions: Array.from(actions).sort(),
  })).sort((a,b)=>a.function_name.localeCompare(b.function_name));
  return {
    functions,
    total_functions: functions.length,
    total_actions: functions.reduce((acc, f) => acc + f.action_count, 0),
    timestamp: now(),
  };
};


const AGENT_PROFILES = {
  commander: { name: "Commander", tagline: "I see the whole board. You focus on the moves." },
  nexus: { name: "Commander", tagline: "I see the whole board. You focus on the moves." },
  maestro: { name: "Maestro", tagline: "Every campaign is a symphony. I conduct it." },
  sentinel: { name: "Sentinel", tagline: "I watch while you sleep. You wake up safe." },
  supportsage: { name: "Support Sage", tagline: "Here for you. Here for them. Always with a solution." },
  centsible: { name: "Centsible", tagline: "I speak fluent finance. You speak ambition." },
  prospect: { name: "Prospect", tagline: "I never stop looking. Your next customer is out there." },
  sage: { name: "Sage", tagline: "I see around corners. You make the call." },
  chronos: { name: "Chronos", tagline: "Time is your only non-renewable resource. I protect it." },
  veritas: { name: "Veritas", tagline: "In compliance we trust. In contracts we verify." },
  inspect: { name: "Inspect", tagline: "I break things so your customers do not have to." },
  canvas: { name: "Canvas", tagline: "I paint your ideas. You provide the vision." },
  merchant: { name: "Merchant", tagline: "Your products, your customers, your revenue. I keep it moving." },
  pulse: { name: "Pulse", tagline: "Happy teams build great things. I keep the pulse." },
  compass: { name: "Compass", tagline: "I read the wind. You set the sails." },
  part: { name: "Part", tagline: "Your network is your net worth. I make it grow." },
  atlas: { name: "Atlas", tagline: "Every task in its place. Every process running smoothly." },
  scribe: { name: "Scribe", tagline: "If it happened, it is remembered. If it matters, it is findable." },
  assistant: { name: "Assistant", tagline: "Ready to help." },
};

const normalizeAgent = (agentName = "assistant") => {
  let k = String(agentName).toLowerCase().replace(/[^a-z]/g, "");
  if (k.endsWith("agent")) k = k.slice(0, -5);
  if (k.includes("supportsage")) return "supportsage";
  if (k.includes("command") || k.includes("nexus") || k.includes("commander")) return "commander";
  if (k.includes("centsible")) return "centsible";
  if (k.includes("prospect")) return "prospect";
  if (k.includes("maestro")) return "maestro";
  if (k.includes("sentinel")) return "sentinel";
  if (k.includes("sage")) return "sage";
  if (k.includes("chronos")) return "chronos";
  if (k.includes("atlas")) return "atlas";
  if (k.includes("scribe")) return "scribe";
  if (k.includes("canvas")) return "canvas";
  if (k.includes("merchant")) return "merchant";
  if (k.includes("pulse")) return "pulse";
  if (k.includes("compass")) return "compass";
  if (k.includes("part")) return "part";
  if (k.includes("inspect")) return "inspect";
  if (k.includes("veritas")) return "veritas";
  return AGENT_PROFILES[k] ? k : "assistant";
};
const responseByIntent = (profile, text) => {
  const t = text.toLowerCase();
  if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/.test(t)) {
    return `${profile.name}: Hey. ${profile.tagline} What are we tackling right now?`;
  }
  if (t.includes("status") || t.includes("health")) {
    return `${profile.name}: Current status is stable. I can run a focused diagnostic and return blockers, decisions, and next actions.`;
  }
  if (t.includes("plan") || t.includes("roadmap") || t.includes("strategy")) {
    return `${profile.name}: Proposed path:\n1. Define target outcome\n2. Identify constraints\n3. Execute highest-impact actions\n4. Validate and iterate.`;
  }
  if (t.includes("fix") || t.includes("bug") || t.includes("error") || t.includes("issue")) {
    return `${profile.name}: I will triage this now, isolate root cause, and return a concrete fix with verification steps.`;
  }
  return `${profile.name}: Request received. I can execute this now and return clear outputs plus next actions.`;
};

const replyForAgent = (agentName, userText = "") => {
  const key = normalizeAgent(agentName);
  const profile = AGENT_PROFILES[key] || AGENT_PROFILES.assistant;
  const text = String(userText || "").trim();
  if (!text) return `${profile.name}: ${profile.tagline}`;
  return responseByIntent(profile, text);
};

const CHAT_FN_BY_AGENT = {
  commander: "commandCenterIntelligence",
  nexus: "commandCenterIntelligence",
  maestro: "maestroSocialOps",
  prospect: "prospectLeadGeneration",
  supportsage: "supportSageCustomerService",
  centsible: "centsibleFinanceEngine",
  sage: "sageBussinessStrategy",
  chronos: "chronosSchedulingEngine",
  atlas: "atlasWorkflowAutomation",
  scribe: "scribeKnowledgeBase",
  sentinel: "sentinelSecurityMonitoring",
  compass: "compassMarketIntelligence",
  part: "partPartnershipEngine",
  pulse: "pulseHREngine",
  merchant: "merchantProductManagement",
  canvas: "canvasCreativeGeneration",
  inspect: "inspectQualityEngine",
  veritas: "veritasComplianceValidation",
};

const inferChatAction = (agentKey, text = "") => {
  const t = String(text || "").toLowerCase();
  if (!t) return "health_check";
  if (agentKey === "commander") {
    if (/route|dispatch|orchestrate/.test(t)) return "intent_routing";
    if (/brief|status|health|overview|summary/.test(t)) return "command_center_full_self_test";
    if (/workflow|launch|start/.test(t)) return "start_workflow";
    return "intent_routing";
  }
  if (agentKey === "canvas") {
    if (/voice|voiceover|narrat|tts|audio|read this/.test(t)) return "voiceover_generation";
    if (/image|picture|photo|illustration|draw|render|visual|poster|cover|cat|dog|portrait|logo/.test(t)) return "creative_generation";
    if (/video|reel|cinematic|motion|storyboard|animation/.test(t)) return "cinematic_video_command";
  }
  if (/self\s*test|diagnostic|health/.test(t)) return `${agentKey}_full_self_test`;
  if (/report|brief|summary|status/.test(t)) return "status_briefing";
  if (/risk|threat|security/.test(t)) return "security_posture_report";
  if (/pipeline|lead|sales/.test(t)) return "pipeline_analytics";
  if (/market|competitor|trend/.test(t)) return "market_briefing";
  if (/finance|cash|budget|runway/.test(t)) return "financial_health_check";
  if (/quality|test|bug/.test(t)) return "quality_gate";
  if (/legal|contract|compliance/.test(t)) return "legal_risk_register";
  return "health_check";
};

const orchestrateChatReply = async (conversationAgent, userText) => {
  const key = normalizeAgent(conversationAgent);
  const profile = AGENT_PROFILES[key] || AGENT_PROFILES.assistant;
  const text = String(userText || "").trim();
  if (!text) return `${profile.name}: ${profile.tagline}`;

  if (key === "commander") {
    const route = await functions.invoke("commandCenterIntelligence", {
      action: "intent_routing",
      params: { user_request: text },
    });
    const routed = route?.data?.result || {};
    const selected = routed.agents_selected || ["Nexus"];

    const lines = [
      `**${profile.name}**`,
      `${profile.tagline}`,
      "",
      `**Route:** ${routed.route || "single_agent"}`,
      `**Agents:** ${(selected || []).join(", ")}`,
      `**Confidence:** ${Math.round((routed.confidence || 0.8) * 100)}%`,
      "",
      "**Next Actions**",
      ...(selected.slice(0, 4).map((name, idx) => `${idx + 1}. ${name}: execute focused diagnostic and return blockers + one decision.`)),
      "",
      `_You can say: run full self-test or start workflow._`,
    ];
    return lines.join("\n");
  }

  const fn = CHAT_FN_BY_AGENT[key];
  if (!fn) return replyForAgent(conversationAgent, text);

  const action = inferChatAction(key, text);
  let result;
  try {
    const res = await functions.invoke(fn, { action, params: { user_request: text } });
    result = res?.data?.result || {};
  } catch {
    result = { summary: "Execution failed for this request." };
  }

  const summary = typeof result === "string"
    ? result
    : (result.summary || result.message || `Executed ${action.replace(/_/g, " ")}.`);

  const lines = [
    `**${profile.name}**`,
    `${profile.tagline}`,
    "",
    `**Action:** ${action.replace(/_/g, " ")}`,
    `**Result:** ${summary}`,
  ];

  if (result?.recommendation) lines.push(`**Recommendation:** ${result.recommendation}`);
  if (Array.isArray(result?.insights) && result.insights.length) {
    lines.push("", "**Insights**", ...result.insights.slice(0, 3).map((i) => `- ${i}`));
  }
  return lines.join("\n");
};
const domainThemeByFunction = {
  maestroSocialOps: { metric: "campaign_health", value: "strong", recommendation: "Scale top-performing campaign variant by 15%." },
  prospectLeadGeneration: { metric: "pipeline_velocity", value: "improving", recommendation: "Prioritize hot leads with 24h follow-up SLA." },
  supportSageCustomerService: { metric: "support_resolution", value: "stable", recommendation: "Auto-route billing + login issues to fast-track queue." },
  centsibleFinanceEngine: { metric: "cash_position", value: "healthy", recommendation: "Keep discretionary spend guardrails in place this week." },
  sageBussinessStrategy: { metric: "strategic_alignment", value: "on_track", recommendation: "Run scenario sensitivity on the top strategic initiative." },
  chronosSchedulingEngine: { metric: "time_efficiency", value: "moderate", recommendation: "Protect two deep-work blocks for critical owners." },
  atlasWorkflowAutomation: { metric: "workflow_throughput", value: "steady", recommendation: "Resolve blocked tasks before starting new workflows." },
  scribeKnowledgeBase: { metric: "knowledge_freshness", value: "good", recommendation: "Promote latest SOP update to all relevant teams." },
  sentinelSecurityMonitoring: { metric: "security_posture", value: "guarded", recommendation: "Rotate stale keys and enforce MFA drift remediation." },
  compassMarketIntelligence: { metric: "market_signal_strength", value: "elevated", recommendation: "Publish a competitive differentiation update." },
  partPartnershipEngine: { metric: "partner_pipeline", value: "active", recommendation: "Advance top two partner motions to execution." },
  pulseHREngine: { metric: "team_health", value: "watch", recommendation: "Address burnout indicators in highest-load squad." },
  merchantProductManagement: { metric: "commerce_health", value: "solid", recommendation: "Mitigate low-stock risk on high-converting SKUs." },
  canvasCreativeGeneration: { metric: "creative_performance", value: "rising", recommendation: "Run A/B creative variants on two channels." },
  inspectQualityEngine: { metric: "quality_risk", value: "controlled", recommendation: "Execute regression scan before next release." },
  veritasComplianceValidation: { metric: "compliance_posture", value: "managed", recommendation: "Review upcoming obligation deadlines." },
  commandCenterIntelligence: { metric: "federation_health", value: "stable", recommendation: "Continue cross-agent orchestration with risk watch." },
};

const actionProfile = (action) => {
  const a = String(action || "").toLowerCase();
  if (a.includes("self_test")) return { summary: "Self-test completed with core systems passing.", recommendation: "Continue normal operations and watch drift.", kpi: { key: "self_test_score", value: 93 } };
  if (a.includes("health") || a.includes("status")) return { summary: "Operational health snapshot generated.", recommendation: "Resolve any flagged constraints first.", kpi: { key: "health_score", value: 90 } };
  if (a.includes("risk")) return { summary: "Risk scan completed with prioritized exposures.", recommendation: "Mitigate highest-ranked risk before expansion.", kpi: { key: "risk_index", value: 0.21 } };
  if (a.includes("analytics") || a.includes("analysis")) return { summary: "Analytics run completed with trend interpretation.", recommendation: "Execute the top impact recommendation.", kpi: { key: "signal_confidence", value: 0.87 } };
  if (a.includes("forecast")) return { summary: "Forecast completed with bounded scenarios.", recommendation: "Plan against conservative case assumptions.", kpi: { key: "forecast_confidence", value: 0.84 } };
  if (a.includes("pipeline") || a.includes("lead")) return { summary: "Pipeline action completed with priority lead routing.", recommendation: "Follow up hot leads within 24 hours.", kpi: { key: "hot_leads", value: 11 } };
  if (a.includes("market") || a.includes("competitive")) return { summary: "Market signal sweep completed.", recommendation: "Align campaign narrative to strongest trend.", kpi: { key: "priority_signals", value: 5 } };
  if (a.includes("compliance") || a.includes("legal") || a.includes("contract")) return { summary: "Compliance/legal action completed.", recommendation: "Review obligation deadlines and owners.", kpi: { key: "open_obligations", value: 6 } };
  if (a.includes("creative") || a.includes("canvas")) return { summary: "Creative action completed with performance guidance.", recommendation: "Scale best variant and rerun test.", kpi: { key: "creative_lift_pct", value: 18 } };
  if (a.includes("send_") || a.includes("reply") || a.includes("outreach")) return { summary: "Message orchestration completed and queued.", recommendation: "Track reply latency and tune sequencing.", kpi: { key: "messages_queued", value: 31 } };
  return { summary: "Execution completed successfully.", recommendation: "Review output and run next high-impact action.", kpi: { key: "execution_score", value: 90 } };
};

const buildAgentActionPayload = (fn, action, params = {}) => {
  const theme = domainThemeByFunction[fn] || { metric: "execution", value: "ok", recommendation: "Proceed with monitored execution." };
  const profile = actionProfile(action);
  return {
    summary: `${(AGENT_BY_FUNCTION[fn] || "Agent")}: ${profile.summary}`,
    metric: theme.metric,
    metric_state: theme.value,
    recommendation: profile.recommendation || theme.recommendation,
    kpi: profile.kpi,
    next_actions: [
      "Review this output with owner context.",
      "Execute the highest-impact recommendation.",
      "Re-run to confirm measurable improvement.",
    ],
    inputs: params,
    timestamp: now(),
  };
};

const buildCanvasAssetResult = (action, params = {}) => {
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
    summary: isVoice ? "Voiceover script prepared for the requested creative brief." : isVideo ? "Storyboard and key frames generated for the requested video concept." : "Image concept generated for the requested creative brief.",
    recommendation: isVoice ? "Review the narration, then switch to a live voice provider when available." : isVideo ? "Review the visual direction, then expand into a motion sequence." : "Review the visual direction, then generate variants or adapt it per channel.",
    kpi: { key: isVoice ? "voiceover_seconds" : isVideo ? "story_frames" : "image_variants", value: isVoice ? Math.max(3, Math.ceil(voiceoverScript.split(/\\s+/).length / 2.8)) : isVideo ? 6 : 1 },
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
};

const normalizeCanvasPrompt = (input = "", action = "") => {
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
};

const inferCanvasVoiceStyle = (prompt = "", tone = "") => {
  const text = `${String(prompt || "")} ${String(tone || "")}`.toLowerCase();
  if (/\bluxury|premium|elegant|refined|high-end|exclusive\b/.test(text)) return "luxury";
  if (/\bplayful|fun|cheerful|light|energetic|quirky\b/.test(text)) return "playful";
  if (/\bdirect response|conversion|cta|offer|sale|limited|discount|buy now|shop now\b/.test(text)) return "direct-response";
  if (/\bcinematic|dramatic|story|trailer|epic|atmospheric\b/.test(text)) return "cinematic";
  return "ad";
};

const buildCanvasVoiceoverScript = (prompt = "", tone = "") => {
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
};

const functions = {
  invoke: async (fn, p = {}) => {
    const a = p?.action || "run";
    const sourceAgent = AGENT_BY_FUNCTION[fn];
    if (sourceAgent) {
      agentFabric.setAgentStatus(sourceAgent, "active", { current_focus: `Running ${a.replace(/_/g, " ")}` });
      agentFabric.publish(`${sourceAgent.toLowerCase().replace(/\s+/g, "_")}.${a}`, sourceAgent, { fn, params: p?.params || {} });
    }

    
    if (hasRemoteBackend()) {
      try {
        const remote = await invokeRemoteFunction(fn, p || {});
        if (remote && typeof remote === "object" && "data" in remote) return remote;
        return { data: remote };
      } catch (err) {
        telemetry.warn("remote_invoke_failed", {
          source: "remote_backend",
          detail: String(err?.message || err || "Remote invoke failed"),
          meta: { functionName: fn, action: a },
        });
      }
    }

    if (fn === "canvasCreativeGeneration" && (a === "creative_generation" || a === "cinematic_video_command" || a === "voiceover_generation")) {
      const result = buildCanvasAssetResult(a, p?.params || {});
      pushFnHistory(fn, a);
      return { data: { action: a, status: "success", result, history: getFnHistory(fn) } };
    }

if (fn === "agentCapabilityOrchestrator" && a === "list_manifest") {
      const roleByAgent = {
        Nexus: "Unified Orchestrator", Maestro: "Marketing Virtuoso", Prospect: "Lead Hunter", "Support Sage": "Customer Experience", Centsible: "Numbers Whisperer", Sage: "Strategic Visionary", Chronos: "Time Master", Atlas: "Backbone of Operations", Scribe: "Collective Memory", Sentinel: "Silent Guardian", Compass: "Market Navigator", Part: "Partnership Connector", Pulse: "Team Heartbeat", Merchant: "Storekeeper", Canvas: "Visual Poet", Inspect: "Quality Enforcer", Veritas: "Guardian of Truth"
      };
      const domainByAgent = {
        Nexus: "Command", Maestro: "Growth", Prospect: "Growth", "Support Sage": "Customers", Centsible: "Finance", Sage: "Strategy", Chronos: "Operations", Atlas: "Operations", Scribe: "Knowledge", Sentinel: "Security", Compass: "Intelligence", Part: "Growth", Pulse: "People", Merchant: "Commerce", Canvas: "Creative", Inspect: "Quality", Veritas: "Legal"
      };
      const agents = ["Nexus", ...CAPABILITY_AGENTS].map((agentName) => {
        const key = normalizeAgent(agentName);
        const profile = AGENT_PROFILES[key] || { name: agentName, tagline: "Ready." };
        const capabilities = (CAPABILITY_LIBRARY[agentName] || []).map((c) => ({
          ...c,
          action: c.action || c.id,
          id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${c.id}`,
        }));
        return {
          name: agentName,
          role: roleByAgent[agentName] || "Specialist Agent",
          domain: domainByAgent[agentName] || "General",
          tagline: profile.tagline || "Ready.",
          functionName: CHAT_FN_BY_AGENT[key] || "commandCenterIntelligence",
          capabilities,
        };
      });
      return { data: { action: a, agents, status: "success", result: { count: agents.length } } };
    }

if (fn === "agentCapabilityOrchestrator" && a === "list_capabilities") {
      const agents = CAPABILITY_AGENTS.map((agentName) => ({
        agent_name: agentName,
        capabilities: (CAPABILITY_LIBRARY[agentName] || []).map((c) => ({ ...c, id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${c.id}` })),
      }));
      return { data: { agents, status: "success", result: { count: agents.length } } };
    }
    if (fn === "agentCapabilityOrchestrator" && a === "get_agent_blueprint") {
      const agentName = p?.params?.agent_name || p?.params?.agent || "Maestro";
      const capabilities = (CAPABILITY_LIBRARY[agentName] || []).map((cap) => ({
        ...cap,
        id: `${agentName.toLowerCase().replace(/\s+/g, "_")}.${cap.id}`,
      }));
      return {
        data: {
          action: a,
          status: "success",
          result: {
            agent_name: agentName,
            capability_count: capabilities.length,
            capabilities,
            operating_model: "event-driven",
            timestamp: now(),
          },
        },
      };
    }

    if (fn === "agentCapabilityOrchestrator" && a === "run_capability") {
      const capabilityId = p?.params?.capability_id || "capability";
      const agentName = p?.params?.agent_name || "agent";
      const runtimeParams = p?.params?.runtime_params || {};
      const fnByAgent = {
        "Maestro": "maestroSocialOps",
        "Prospect": "prospectLeadGeneration",
        "Support Sage": "supportSageCustomerService",
        "Centsible": "centsibleFinanceEngine",
        "Sage": "sageBussinessStrategy",
        "Chronos": "chronosSchedulingEngine",
        "Atlas": "atlasWorkflowAutomation",
        "Scribe": "scribeKnowledgeBase",
        "Sentinel": "sentinelSecurityMonitoring",
        "Compass": "compassMarketIntelligence",
        "Part": "partPartnershipEngine",
        "Pulse": "pulseHREngine",
        "Merchant": "merchantProductManagement",
        "Canvas": "canvasCreativeGeneration",
        "Inspect": "inspectQualityEngine",
        "Veritas": "veritasComplianceValidation",
        "Nexus": "commandCenterIntelligence",
        "Commander": "commandCenterIntelligence",
      };
      const targetFn = fnByAgent[agentName];
      const historyKey = targetFn || String(agentName).replace(/\s+/g, "");
      let executed = null;

      if (targetFn) {
        const capKey = String(capabilityId).split(".").pop() || capabilityId;
        const capMeta = (CAPABILITY_LIBRARY[agentName] || []).find((c) => c.id === capKey);
        const toolAction = capMeta?.action || capKey;
        const payload = Object.keys(runtimeParams || {}).length > 0
          ? { action: toolAction, params: runtimeParams }
          : { action: toolAction };
        try {
          executed = await functions.invoke(targetFn, payload);
          pushFnHistory(historyKey, capabilityId, "completed", `[capability] ${agentName} -> ${capabilityId}`);
        } catch (err) {
          pushFnHistory(historyKey, capabilityId, "failed", `[capability] ${agentName} -> ${capabilityId} failed`);
          return {
            data: {
              action: a,
              status: "error",
              capability: { id: capabilityId, label: capabilityId.split(".").pop()?.replace(/_/g, " ") || "capability" },
              run_error: String(err?.message || err || "Capability execution failed"),
            },
          };
        }
      }

            const fallbackResult = buildCapabilityResult(agentName, capabilityId, runtimeParams);
      const resolvedResult = executed?.data?.result?.summary
        ? executed.data.result
        : (executed?.data?.result?.message && !executed?.data?.result?.insights)
          ? { ...fallbackResult, tool_message: executed.data.result.message }
          : (executed?.data?.result || fallbackResult);

      return {
        data: {
          action: a,
          status: "success",
          capability: { id: capabilityId, label: capabilityId.split(".").pop()?.replace(/_/g, " ") || "capability" },
          result: resolvedResult,
          source_action: capabilityId,
          tool_action: executed?.data?.action || (String(capabilityId).split(".").pop() || capabilityId),
        },
      };
    }
    if (fn === "commandCenterIntelligence") {
      if (a === "agent_registry_status") {
        const agents = agentFabric.getRegistry().map((agent) => ({
          name: agent.name,
          status: agent.status,
          current_focus: agent.current_focus,
          key_metric: agent.key_metric,
          concern: agent.concern,
          domain: agent.domain,
          load: agent.load,
        }));
        return { data: { action: a, status: "success", result: { agents, health_score: agentFabric.healthSummary().health.health_score, timestamp: now() } } };
      }
      if (a === "command_center_full_self_test") {
        const summary = agentFabric.healthSummary();
        return { data: { action: a, status: "success", result: { ...summary, workflows: workflowEngine.list(20), events: agentFabric.listEvents(20), telemetry: telemetry.list(20) } } };
      }
      if (a === "intent_routing") {
        const routed = agentFabric.routeIntent(p?.params?.user_request || "");
        return { data: { action: a, status: "success", result: routed } };
      }
      if (a === "cross_agent_insights") {
        const events = agentFabric.listEvents(8);
        return {
          data: {
            action: a,
            status: "success",
            result: {
              summary: "Cross-agent synthesis completed across recent operational signals.",
              insights: [
                "Finance stability and pipeline growth support controlled expansion.",
                "Support load is rising in tandem with campaign velocity; allocate staffing proactively.",
                "Security and compliance posture are healthy enough for planned launches.",
              ],
              recent_events: events,
              timestamp: now(),
            },
          },
        };
      }
      if (a === "scenario_modeling") {
        const scenario = p?.params?.scenario || "Base case";
        return {
          data: {
            action: a,
            status: "success",
            result: {
              scenario,
              projected_impact: {
                revenue_delta_pct: 7.2,
                risk_delta_pct: 2.1,
                ops_load_delta_pct: 5.4,
              },
              recommended_moves: [
                "Stage rollout in two waves with Atlas workflow gates.",
                "Pre-brief Support Sage with playbooks before launch.",
                "Lock budget guardrails in Centsible before execution.",
              ],
              timestamp: now(),
            },
          },
        };
      }
      if (a === "start_workflow") {
        const workflow = workflowEngine.start({
          name: p?.params?.name || "Adhoc Nexus Workflow",
          steps: p?.params?.steps || [
            { title: "Gather signals" },
            { title: "Dispatch agents" },
            { title: "Synthesize output" },
          ],
          context: p?.params || {},
        });
        return { data: { action: a, status: "success", result: workflow } };
      }
      if (a === "system_action_matrix") {
        return { data: { action: a, status: "success", result: buildActionMatrix() } };
      }
      if (a === "causal_analysis") {
        return {
          data: {
            action: a,
            status: "success",
            result: {
              hypothesis: p?.params?.effect_to_analyze || "conversion movement",
              likely_causes: [
                "Campaign audience shift",
                "Landing page friction",
                "Pricing/offer mismatch",
              ],
              confidence: 0.81,
              timestamp: now(),
            },
          },
        };
      }
      if (a === "strategic_brief" || a === "board_deck" || a === "okr_progress" || a === "workflow_health" || a === "alert_correlation" || a === "business_health_score") {
        const summary = agentFabric.healthSummary();
        return {
          data: {
            action: a,
            status: "success",
            result: {
              summary: `Nexus generated ${a.replace(/_/g, " ")} from federated signals.`,
              health: summary.health,
              checks: summary.checks,
              recommendations: summary.recommendations,
              timestamp: now(),
            },
          },
        };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }
    if (fn === "maestroSocialOps") {
      if (a === "run_history") return { data: { action: a, history: getFnHistory(fn) } };
      if (a === "unified_social_health") {
        return {
          data: {
            action: a,
            result: { ops_score: 91, posts: { scheduled: 18 }, community: { unread: 7, flagged: 1 }, channels_online: 4, timestamp: now() },
            history: getFnHistory(fn),
          },
        };
      }
      pushFnHistory(fn, a, "completed");
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}), history: getFnHistory(fn) } };
    }

    if (fn === "prospectLeadGeneration") {
      if (a === "prospect_run_history") return { data: { action: a, history: getFnHistory(fn) } };
      if (a === "prospect_health_snapshot") {
        return {
          data: {
            action: a,
            result: {
              health_score: 90,
              lead_health: { total: 124, hot: 14, warm: 42, cold: 68 },
              by_status: { new: 31, contacted: 49, meeting_booked: 18, proposal: 9 },
              conversion_rate: 11.4,
              timestamp: now(),
            },
            history: getFnHistory(fn),
          },
        };
      }
      if (a === "inbox_connector_load") {
        const state = localState.connectors.prospectLeadGeneration;
        return { data: { action: a, status: "success", result: { exists: true, connector: state.connector, secret_refs: state.secret_refs } } };
      }
      if (a === "inbox_connector_save") {
        const next = p?.params?.connector || {};
        localState.connectors.prospectLeadGeneration.connector = { ...localState.connectors.prospectLeadGeneration.connector, ...next };
        pushFnHistory(fn, a, "completed", "[prospect_ops] inbox connector saved");
        return { data: { action: a, status: "success", result: { saved: true, connector: localState.connectors.prospectLeadGeneration.connector } } };
      }
      if (a === "inbox_connector_register_secret_refs") {
        const refs = p?.params?.secret_refs || {};
        localState.connectors.prospectLeadGeneration.secret_refs = { ...localState.connectors.prospectLeadGeneration.secret_refs, ...refs };
        pushFnHistory(fn, a, "completed", "[prospect_ops] secret references registered");
        return { data: { action: a, status: "success", result: { registered: true, secret_refs: localState.connectors.prospectLeadGeneration.secret_refs } } };
      }
      if (a === "inbox_connector_test") {
        const c = localState.connectors.prospectLeadGeneration.connector;
        const connected = Boolean(c.provider && c.inbox_address && c.auth_type);
        pushFnHistory(fn, a, connected ? "completed" : "failed", connected ? "[prospect_ops] inbox connector healthy" : "[prospect_ops] inbox connector needs required fields");
        return { data: { action: a, status: connected ? "success" : "error", result: { connected, provider: c.provider, inbox_address: c.inbox_address, last_tested_at: now() } } };
      }
      pushFnHistory(fn, a, "completed", `[prospect_ops] ${a} completed`);
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}), history: getFnHistory(fn) } };
    }

    if (fn === "supportSageCustomerService") {
      if (a === "support_kpi_command_center") {
        return {
          data: {
            action: a,
            result: {
              kpi_snapshot: { health_score: 88, first_response_sla: "96.2%", resolution_sla: "93.8%" },
              forecast_risk: "moderate",
              executive_actions: ["Increase weekend coverage", "Publish billing troubleshooting KB update", "Escalate high-value churn-risk tickets within 15 min"],
              timestamp: now(),
            },
          },
        };
      }
      if (a === "support_connector_load") {
        const state = localState.connectors.supportSageCustomerService;
        return { data: { action: a, status: "success", result: { exists: true, connector: state.connector, secret_refs: state.secret_refs } } };
      }
      if (a === "support_connector_save") {
        const next = p?.params?.connector || {};
        localState.connectors.supportSageCustomerService.connector = { ...localState.connectors.supportSageCustomerService.connector, ...next };
        persistRuntime();
        return { data: { action: a, status: "success", result: { saved: true, connector: localState.connectors.supportSageCustomerService.connector } } };
      }
      if (a === "support_connector_register_secret_refs") {
        const refs = p?.params?.secret_refs || {};
        localState.connectors.supportSageCustomerService.secret_refs = { ...localState.connectors.supportSageCustomerService.secret_refs, ...refs };
        persistRuntime();
        return { data: { action: a, status: "success", result: { registered: true, secret_refs: localState.connectors.supportSageCustomerService.secret_refs } } };
      }
      if (a === "support_connector_test") {
        const c = localState.connectors.supportSageCustomerService.connector;
        const connected = Boolean(c.provider && c.inbox_address && c.auth_type);
        return { data: { action: a, status: connected ? "success" : "error", result: { connected, provider: c.provider, inbox_address: c.inbox_address, last_tested_at: now() } } };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }

    if (fn === "centsibleFinanceEngine") {
      if (a === "financial_health_check") {
        return { data: { action: a, result: { health_score: 93, net_profit: "$182,400", cash_flow_status: "positive", burn_multiple: 1.3, timestamp: now() } } };
      }
      if (a === "centsible_connector_load") {
        const state = localState.connectors.centsibleFinanceEngine;
        return { data: { action: a, status: "success", result: { exists: true, connector: state.connector, secret_refs: state.secret_refs } } };
      }
      if (a === "centsible_connector_save") {
        const next = p?.params?.connector || {};
        localState.connectors.centsibleFinanceEngine.connector = { ...localState.connectors.centsibleFinanceEngine.connector, ...next };
        persistRuntime();
        return { data: { action: a, status: "success", result: { saved: true, connector: localState.connectors.centsibleFinanceEngine.connector } } };
      }
      if (a === "centsible_connector_register_secret_refs") {
        const refs = p?.params?.secret_refs || {};
        localState.connectors.centsibleFinanceEngine.secret_refs = { ...localState.connectors.centsibleFinanceEngine.secret_refs, ...refs };
        persistRuntime();
        return { data: { action: a, status: "success", result: { registered: true, secret_refs: localState.connectors.centsibleFinanceEngine.secret_refs } } };
      }
      if (a === "centsible_connector_test") {
        const c = localState.connectors.centsibleFinanceEngine.connector;
        const connected = Boolean(c.provider && c.auth_type);
        return { data: { action: a, status: connected ? "success" : "error", result: { connected, provider: c.provider, account_label: c.account_label, last_tested_at: now() } } };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }

    if (fn === "atlasWorkflowAutomation") {
      if (a === "atlas_full_self_test") {
        return {
          data: {
            action: a,
            result: {
              health: { health_score: 94, active_tasks: 47, blocked_tasks: 2, overdue_tasks: 1 },
              checks: { workflow_engine: true, task_router: true, dependency_graph: true, scheduler: true, alerts: true },
              timestamp: now(),
            },
          },
        };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }

    if (fn === "chronosSchedulingEngine") {
      if (a === "time_audit") {
        return { data: { action: a, result: { time_health_score: 86, breakdown: { meeting_percent: 41, focus_percent: 37 }, hours_to_reclaim: 6.5, timestamp: now() } } };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }

    if (fn === "compassMarketIntelligence") {
      if (a === "market_briefing") {
        return {
          data: {
            action: a,
            result: {
              critical_alerts: ["Major competitor reduced annual pricing by 12%"],
              opportunities: ["Search demand rising for AI workflow operations in APAC", "Partner gap in mid-market compliance tooling"],
              top_3_actions: ["Test defensive pricing bundle", "Publish competitive differentiation page", "Launch partner outreach sprint"],
              timestamp: now(),
            },
          },
        };
      }
      return { data: { action: a, status: "success", result: buildAgentActionPayload(fn, a, p?.params || {}) } };
    }

    if (fn === "sentinelSecurityMonitoring") {
      if (a === "security_posture_report") {
        const posture = {
          security_score: 89,
          threat_level: "low",
          incident_summary: { open_critical: 0, open_high: 2 },
          top_5_risks: ["MFA policy drift in one admin group", "Two stale API keys pending rotation"],
          timestamp: now(),
        };
        return { data: { action: a, ...posture, result: posture } };
      }
      return { data: { action: a, status: "success", result: { ok: true, message: `Sentinel executed ${a}`, timestamp: now(), security_score: 89, threat_level: "low", incident_summary: { open_critical: 0 } } } };
    }

    const result = {
      ok: true,
      function: fn,
      action: a,
      status: a.includes("self_test") ? "pass" : "ok",
      timestamp: now(),
      message: `Executed ${fn}:${a} (local)`,
      health_score: 92,
      security_score: 89,
      threat_level: "low",
      incident_summary: { open_critical: 0 },
    };
    return { data: { action: a, status: "success", result, history: getFnHistory(fn) } };
  },
};
const integrations = {
  Core: {
    InvokeLLM: async (i = {}) => ({ result: `Local AI response: ${String(i?.prompt || i?.message || "ok").slice(0, 120)}` }),
    UploadFile: async ({ file } = {}) => ({ file_url: `local://uploads/${Date.now()}-${file?.name || "file.bin"}` }),
    SendEmail: async () => ({ success: true }),
  },
};

const agents = {
  createConversation: async (p = {}) => {
    if (hasRemoteBackend()) {
      try {
        const remote = await createRemoteConversation({
          agent_name: p.agent || p.agentName || p.agent_name || "assistant",
          metadata: p.metadata || {},
        });
        const conv = remote?.conversation || remote?.result?.conversation || remote;
        if (conv?.id) return conv;
      } catch {
        // Fallback to local mode.
      }
    }

    const c = { id: id("conv"), agent: p.agent || p.agentName || p.agent_name || "assistant", messages: [] };
    mem.convs[c.id] = c;
    persistRuntime();
    return c;
  },

  subscribeToConversation: (cid, cb) => {
    if (hasRemoteBackend()) {
      let stopped = false;
      let latestSignature = "";

      const poll = async () => {
        if (stopped) return;
        try {
          const remote = await getRemoteConversation(cid);
          const conv = remote?.conversation || remote?.result?.conversation || remote;
          const messages = conv?.messages || [];
          const signature = `${messages.length}:${messages[messages.length - 1]?.id || ""}`;
          if (signature !== latestSignature) {
            latestSignature = signature;
            cb({ conversation: conv, messages });
          }
        } catch {
          // ignore polling errors and retry
        } finally {
          if (!stopped) setTimeout(poll, 900);
        }
      };

      poll();
      return () => {
        stopped = true;
      };
    }

    mem.subs[cid] = mem.subs[cid] || [];
    mem.subs[cid].push(cb);
    emit(cid);
    return () => {
      mem.subs[cid] = (mem.subs[cid] || []).filter((x) => x !== cb);
    };
  },

  addMessage: async (c, m) => {
    const cid = typeof c === "string" ? c : c?.id;

    if (hasRemoteBackend()) {
      try {
        await addRemoteConversationMessage(cid, m || {});
        return { success: true };
      } catch {
        // fallback local
      }
    }

    const cv = mem.convs[cid];
    if (!cv) throw new Error("Conversation not found");
    cv.messages.push({ id: id("msg"), created_date: now(), ...m });
    persistRuntime();
    emit(cid);
    if (m?.role === "user") {
      setTimeout(async () => {
        const x = mem.convs[cid];
        if (!x) return;
        const content = await orchestrateChatReply(cv.agent, m?.content);
        x.messages.push({ id: id("msg"), role: "assistant", content, created_date: now() });
        persistRuntime();
        emit(cid);
      }, 150);
    }
    return { success: true };
  },
};
export const base44 = { auth, users: { inviteUser: auth.inviteUser }, entities: ents, functions, agents, integrations };




































