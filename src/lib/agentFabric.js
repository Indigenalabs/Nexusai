import { loadPersisted, savePersisted, mergeObject } from "@/lib/persistentStore";
const AGENTS = [
  { name: "Nexus", domain: "Command" },
  { name: "Maestro", domain: "Growth" },
  { name: "Prospect", domain: "Growth" },
  { name: "Support Sage", domain: "Customers" },
  { name: "Centsible", domain: "Finance" },
  { name: "Sage", domain: "Strategy" },
  { name: "Chronos", domain: "Operations" },
  { name: "Atlas", domain: "Operations" },
  { name: "Scribe", domain: "Knowledge" },
  { name: "Sentinel", domain: "Security" },
  { name: "Compass", domain: "Intelligence" },
  { name: "Part", domain: "Growth" },
  { name: "Pulse", domain: "People" },
  { name: "Merchant", domain: "Commerce" },
  { name: "Canvas", domain: "Creative" },
  { name: "Inspect", domain: "Quality" },
  { name: "Veritas", domain: "Legal" },
];

const statusCycle = ["active", "idle", "active", "needs_attention"];

const FABRIC_KEY = "nexus.agent.fabric.v1";
const persistedFabric = loadPersisted(FABRIC_KEY, null);

const state = {
  registry: AGENTS.reduce((acc, agent, i) => {
    acc[agent.name] = {
      ...agent,
      status: statusCycle[i % statusCycle.length],
      current_focus: "Monitoring and coordinating domain operations",
      key_metric: "Nominal",
      concern: i % 7 === 0 ? "Watchlist: pending optimization" : "No critical concern reported",
      load: 0.25 + ((i * 7) % 40) / 100,
      updated_at: new Date().toISOString(),
    };
    return acc;
  }, {}),
  events: persistedFabric?.events || [],
};
state.registry = mergeObject(state.registry, persistedFabric?.registry || {});
const persist = () => savePersisted(FABRIC_KEY, { registry: state.registry, events: state.events });

const now = () => new Date().toISOString();
const id = (p = "evt") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function publish(eventType, source, data = {}, correlationId = null) {
  const evt = {
    eventId: id("evt"),
    eventType,
    source,
    time: now(),
    correlationId: correlationId || id("corr"),
    data,
  };
  state.events.unshift(evt);
  state.events = state.events.slice(0, 200);
  if (state.registry[source]) {
    state.registry[source].updated_at = evt.time;
    state.registry[source].key_metric = eventType;
  }
  persist();
  return evt;
}

function listEvents(limit = 30) {
  return state.events.slice(0, limit);
}

function setAgentStatus(name, status, patch = {}) {
  if (!state.registry[name]) return;
  state.registry[name] = {
    ...state.registry[name],
    status,
    ...patch,
    updated_at: now(),
  };
  persist();
}

function getRegistry() {
  return Object.values(state.registry).map((agent) => ({ ...agent }));
}

function routeIntent(userRequest = "") {
  const t = String(userRequest || "").toLowerCase();
  const agents = new Set(["Nexus"]);

  if (/market|campaign|brand|content|social/.test(t)) agents.add("Maestro"), agents.add("Canvas");
  if (/lead|pipeline|outreach|sales/.test(t)) agents.add("Prospect");
  if (/support|ticket|customer|csat|churn/.test(t)) agents.add("Support Sage");
  if (/budget|finance|cash|revenue|forecast/.test(t)) agents.add("Centsible");
  if (/security|threat|incident|breach/.test(t)) agents.add("Sentinel");
  if (/legal|contract|compliance|policy/.test(t)) agents.add("Veritas");
  if (/ops|workflow|delivery|resource|task/.test(t)) agents.add("Atlas"), agents.add("Chronos");
  if (/quality|test|qa|bug/.test(t)) agents.add("Inspect");
  if (/product|catalog|inventory|pricing/.test(t)) agents.add("Merchant");
  if (/team|people|hiring|burnout/.test(t)) agents.add("Pulse");
  if (/partner|alliance/.test(t)) agents.add("Part");
  if (/trend|competitor|market intel/.test(t)) agents.add("Compass");
  if (/strategy|okr|board|planning/.test(t)) agents.add("Sage"), agents.add("Scribe");

  const agentsSelected = Array.from(agents);
  publish("workflow.intent_routed", "Nexus", { userRequest, agents_selected: agentsSelected });

  return {
    route: agentsSelected.length > 3 ? "multi_agent" : "single_agent",
    agents_selected: agentsSelected,
    confidence: Math.min(0.98, 0.72 + agentsSelected.length * 0.03),
    recommendation: `Dispatch ${agentsSelected.join(", ")} with Nexus orchestration and return a merged briefing.`,
    timestamp: now(),
  };
}

function healthSummary() {
  const agents = getRegistry();
  const active = agents.filter((a) => a.status === "active").length;
  const attention = agents.filter((a) => a.status === "needs_attention").length;
  const healthScore = Math.max(70, 96 - attention * 3);

  return {
    health: {
      health_score: healthScore,
      unread_critical_alerts: attention,
      active_workflows: 8 + Math.max(0, active - 8),
      blocked_tasks: attention,
    },
    checks: {
      registry: true,
      routing: true,
      event_bus: true,
      policy_gate: true,
      audit_log: true,
    },
    recommendations: {
      immediate_actions: attention > 0
        ? [
            "Resolve agents currently marked as needs_attention.",
            "Run cross-agent alert correlation and dispatch owners.",
          ]
        : ["No critical interventions required; continue monitoring."],
      orchestration_optimizations: [
        "Parallelize low-risk workflows across Atlas and Chronos.",
        "Increase automation thresholds for repeatable ops commands.",
      ],
      risk_controls: [
        "Maintain Sentinel continuous scan cadence.",
        "Validate Veritas compliance checklist before launch workflows.",
      ],
    },
    timestamp: now(),
  };
}

export const agentFabric = {
  publish,
  listEvents,
  setAgentStatus,
  getRegistry,
  routeIntent,
  healthSummary,
};




