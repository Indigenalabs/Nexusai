import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AGENTS as AGENT_ROSTER } from "@/lib/agents";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Brain, Megaphone, Target, Users, DollarSign, Calendar,
  Zap, FileText, Shield, Compass, Handshake, Heart, ShoppingBag,
  Sparkles, BarChart3, Scale, Search, ExternalLink, Bot, RefreshCw,
  AlertTriangle, PauseCircle, CheckCircle2, Play, Loader2
} from "lucide-react";

const NEXUS = {
  name: "Nexus",
  subtitle: "CEO - Master Command Center",
  description:
    "The central intelligence that orchestrates all 16 specialist agents. It synthesizes cross-domain insights, routes decisions, resolves conflicts, and keeps a unified strategic view.",
  page: "AICommandCenter",
  capabilities: [
    "Cross-agent orchestration",
    "Business health scoring",
    "Strategic briefings",
    "Alert correlation",
    "Scenario modeling",
    "Conflict resolution",
  ],
};

const AGENTS = [
  { name: "Maestro", subtitle: "Marketing & Lifecycle", description: "Runs strategy, campaigns, content, social, and lifecycle automation.", icon: Megaphone, color: "violet", page: "Maestro", capabilities: ["Campaign orchestration", "Lifecycle automation", "Audience segmentation"], domain: "Growth" },
  { name: "Prospect", subtitle: "Sales & Acquisition", description: "Finds, scores, enriches, and converts leads across pipeline stages.", icon: Target, color: "blue", page: "Prospect", capabilities: ["Lead scoring", "Outreach automation", "Pipeline analytics"], domain: "Growth" },
  { name: "Support Sage", subtitle: "Customer Support", description: "Handles triage, replies, escalations, and churn-risk detection.", icon: Users, color: "emerald", page: "SupportSage", capabilities: ["Ticket triage", "Sentiment analysis", "CSAT insights"], domain: "Customers" },
  { name: "Centsible", subtitle: "Finance & Revenue", description: "Monitors cash flow, budgets, anomalies, and finance operations.", icon: DollarSign, color: "green", page: "Centsible", capabilities: ["Forecasting", "Anomaly detection", "Budget controls"], domain: "Finance" },
  { name: "Sage", subtitle: "Growth Strategy", description: "Builds scenario-based strategy and prioritizes strategic moves.", icon: Brain, color: "amber", page: "SageAI", capabilities: ["Scenario planning", "Opportunity mapping", "Strategic briefs"], domain: "Strategy" },
  { name: "Chronos", subtitle: "Scheduling & Time", description: "Coordinates schedules, meetings, focus time, and team calendar health.", icon: Calendar, color: "sky", page: "Chronos", capabilities: ["Smart scheduling", "Time audits", "Meeting intelligence"], domain: "Operations" },
  { name: "Atlas", subtitle: "Operations & Workflows", description: "Runs workflows, task orchestration, and operational throughput.", icon: Zap, color: "orange", page: "Atlas", capabilities: ["Workflow automation", "Task routing", "Ops reporting"], domain: "Operations" },
  { name: "Scribe", subtitle: "Knowledge & Documentation", description: "Captures and structures docs, SOPs, and institutional memory.", icon: FileText, color: "slate", page: "Scribe", capabilities: ["Knowledge synthesis", "SOP generation", "Audit trails"], domain: "Knowledge" },
  { name: "Sentinel", subtitle: "Security & Privacy", description: "Monitors threats, vulnerabilities, and incident response readiness.", icon: Shield, color: "red", page: "Sentinel", capabilities: ["Threat scans", "Incident response", "Privacy checks"], domain: "Security" },
  { name: "Compass", subtitle: "Market Intelligence", description: "Tracks competitors, market shifts, and external strategic signals.", icon: Compass, color: "cyan", page: "Compass", capabilities: ["Trend monitoring", "Competitor analysis", "Market briefs"], domain: "Intelligence" },
  { name: "Part", subtitle: "Partnerships & Alliances", description: "Builds and maintains partner pipelines and co-marketing motions.", icon: Handshake, color: "blue", page: "Part", capabilities: ["Partner discovery", "Outreach", "Relationship scoring"], domain: "Growth" },
  { name: "Pulse", subtitle: "People & Culture", description: "Monitors team health, hiring flow, performance, and retention risk.", icon: Heart, color: "pink", page: "Pulse", capabilities: ["Wellbeing checks", "Retention risk", "People analytics"], domain: "People" },
  { name: "Merchant", subtitle: "Commerce & Products", description: "Optimizes catalog, pricing, inventory, and conversion pathways.", icon: ShoppingBag, color: "emerald", page: "Merchant", capabilities: ["Catalog ops", "Pricing intelligence", "Channel optimization"], domain: "Commerce" },
  { name: "Canvas", subtitle: "Creative & Brand", description: "Generates creative assets and guides brand-consistent execution.", icon: Sparkles, color: "purple", page: "Canvas", capabilities: ["Creative generation", "Brand systems", "Campaign concepts"], domain: "Creative" },
  { name: "Inspect", subtitle: "Quality & Analytics", description: "Executes quality checks, testing, compliance QA, and root-cause scans.", icon: BarChart3, color: "cyan", page: "Inspect", capabilities: ["Test orchestration", "QA audits", "Anomaly review"], domain: "Quality" },
  { name: "Veritas", subtitle: "Legal & Compliance", description: "Handles contracts, controls, obligations, and risk governance.", icon: Scale, color: "indigo", page: "Veritas", capabilities: ["Contract review", "Compliance checks", "Risk analysis"], domain: "Legal" },
];

const COLOR_MAP = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", badge: "bg-blue-500/15 text-blue-400" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", badge: "bg-violet-500/15 text-violet-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400" },
  green: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", badge: "bg-green-500/15 text-green-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", badge: "bg-amber-500/15 text-amber-400" },
  sky: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-400", badge: "bg-sky-500/15 text-sky-400" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400" },
  slate: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-400", badge: "bg-slate-500/15 text-slate-400" },
  red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", badge: "bg-red-500/15 text-red-400" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", badge: "bg-cyan-500/15 text-cyan-400" },
  pink: { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-400", badge: "bg-pink-500/15 text-pink-400" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", badge: "bg-purple-500/15 text-purple-400" },
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", badge: "bg-indigo-500/15 text-indigo-400" },
};

const STATUS_STYLE = {
  active: { icon: CheckCircle2, text: "text-emerald-300", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", rank: 2 },
  idle: { icon: PauseCircle, text: "text-slate-300", badge: "bg-slate-500/15 text-slate-400 border-slate-500/25", rank: 1 },
  needs_attention: { icon: AlertTriangle, text: "text-amber-300", badge: "bg-amber-500/15 text-amber-400 border-amber-500/25", rank: 0 },
};

const AGENT_ACTION_MAP = {
  Maestro: { label: "Run Ops Health", functionName: "maestroSocialOps", payload: { action: "unified_social_health" } },
  Prospect: { label: "Run Pipeline Scan", functionName: "prospectLeadGeneration", payload: { action: "pipeline_analytics" } },
  "Support Sage": { label: "Run Support Analytics", functionName: "supportSageCustomerService", payload: { action: "support_analytics" } },
  Centsible: { label: "Run Finance Health", functionName: "centsibleFinanceEngine", payload: { action: "financial_health_check" } },
  Sage: { label: "Run Strategy Scorecard", functionName: "sageBussinessStrategy", payload: { action: "health_scorecard" } },
  Chronos: { label: "Run Weekly Time Report", functionName: "chronosSchedulingEngine", payload: { action: "weekly_report" } },
  Atlas: { label: "Run Ops Briefing", functionName: "atlasWorkflowAutomation", payload: { action: "status_briefing" } },
  Scribe: { label: "Run Knowledge Health", functionName: "scribeKnowledgeBase", payload: { action: "knowledge_health" } },
  Sentinel: { label: "Run Threat Scan", functionName: "sentinelSecurityMonitoring", payload: { action: "full_threat_scan" } },
  Compass: { label: "Run Market Briefing", functionName: "compassMarketIntelligence", payload: { action: "market_briefing" } },
  Part: { label: "Run Partner Analytics", functionName: "partPartnershipEngine", payload: { action: "partner_analytics" } },
  Pulse: { label: "Run People Analytics", functionName: "pulseHREngine", payload: { action: "people_analytics" } },
  Merchant: { label: "Run Store Health", functionName: "merchantProductManagement", payload: { action: "store_health" } },
  Canvas: { label: "Run Creative Performance", functionName: "canvasCreativeGeneration", payload: { action: "creative_performance" } },
  Inspect: { label: "Run QA Check", functionName: "inspectQualityEngine", payload: { action: "run_tests", params: { scope: "core workflows" } } },
  Veritas: { label: "Run Compliance Audit", functionName: "veritasComplianceValidation", payload: { action: "audit_compliance" } },
};

const AGENT_PAGE_MAP = {
  "Maestro": { overview: "Maestro", ops: "MaestroOpsHub", dashboard: "MaestroPerformanceDashboard" },
  "Prospect": { overview: "Prospect", ops: "ProspectOpsHub", dashboard: "ProspectRevenueDashboard" },
  "Support Sage": { overview: "SupportSage", ops: "SupportSageOpsHub", dashboard: "SupportCXDashboard" },
  "Centsible": { overview: "Centsible", ops: "CentsibleOpsHub", dashboard: "CentsibleCFODashboard" },
  "Sage": { overview: "SageAI", ops: "SageOpsHub", dashboard: "SageStrategyDashboard" },
  "Chronos": { overview: "Chronos", ops: "ChronosOpsHub", dashboard: "ChronosTimeDashboard" },
  "Atlas": { overview: "Atlas", ops: "AtlasOpsHub", dashboard: "AtlasOperationsDashboard" },
  "Scribe": { overview: "Scribe", ops: "ScribeOpsHub", dashboard: "ScribeKnowledgeDashboard" },
  "Sentinel": { overview: "Sentinel", ops: "SentinelOpsHub", dashboard: "SentinelThreatDashboard" },
  "Compass": { overview: "Compass", ops: "CompassOpsHub", dashboard: "CompassIntelDashboard" },
  "Part": { overview: "Part", ops: "PartOpsHub", dashboard: "PartEcosystemDashboard" },
  "Pulse": { overview: "Pulse", ops: "PulseOpsHub", dashboard: "PulsePeopleDashboard" },
  "Merchant": { overview: "Merchant", ops: "MerchantOpsHub", dashboard: "MerchantCommerceDashboard" },
  "Canvas": { overview: "Canvas", ops: "CanvasOpsHub", dashboard: "CanvasCreativeDashboard" },
  "Inspect": { overview: "Inspect", ops: "InspectOpsHub", dashboard: "InspectQualityDashboard" },
  "Veritas": { overview: "Veritas", ops: "VeritasOpsHub", dashboard: "VeritasLegalDashboard" },
};

const normalizeName = (name) => String(name || "").toLowerCase().replace(/\s+/g, "").trim();
const ROSTER_CAPS = Object.fromEntries(AGENT_ROSTER.map((a) => [normalizeName(a.name), a.capabilities || []]));

const summarizeRunResult = (raw) => {
  if (!raw) return "Action completed.";
  const result = raw.result || raw;
  if (typeof result === "string") return result.slice(0, 180);
  if (result.summary) return String(result.summary).slice(0, 180);
  if (result.message) return String(result.message).slice(0, 180);
  if (result.federation_health) return `Federation health: ${result.federation_health}`;
  if (Array.isArray(result.recommendations) && result.recommendations[0]) return String(result.recommendations[0]).slice(0, 180);
  const keys = Object.keys(result || {});
  if (keys.length > 0) return `Updated: ${keys.slice(0, 3).join(", ")}`;
  return "Action completed.";
};

export default function AIAgents() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [agentRuns, setAgentRuns] = useState({});
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState("");
  const [runningCapabilityKey, setRunningCapabilityKey] = useState("");

  const domains = useMemo(() => ["All", "Command", ...new Set(AGENTS.map((a) => a.domain))], []);

  const { data: registryResult, isLoading: isLoadingRegistry, refetch: refetchRegistry, isFetching: isFetchingRegistry } = useQuery({
    queryKey: ["agent_registry_status"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "agent_registry_status", params: {} });
      return res.data?.result || {};
    },
    staleTime: 120000,
    refetchInterval: 300000,
  });

  const { data: capabilityCatalog = { agents: [] } } = useQuery({
    queryKey: ["agent_capability_catalog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", { action: "list_capabilities" });
      return res.data || { agents: [] };
    },
    staleTime: 300000,
  });

  const { data: manifestCatalog = { agents: [] } } = useQuery({
    queryKey: ["agent_manifest_catalog"],
    queryFn: async () => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", { action: "list_manifest" });
      return res.data || { agents: [] };
    },
    staleTime: 300000,
  });

  const runAgentAction = useMutation({
    mutationFn: async (agentName) => {
      const mapped = AGENT_ACTION_MAP[agentName];

      // Preferred path: agent-specific action mapping.
      if (mapped) {
        try {
          const res = await base44.functions.invoke(mapped.functionName, mapped.payload);
          if (res?.data?.error) throw new Error(String(res.data.error));
          if (res?.data?.status === 'error') throw new Error(String(res?.data?.run_error || 'Agent action failed'));
          return { agentName, data: res.data };
        } catch {
          // Fall through to capability-first execution.
        }
      }

      // Fallback path: run strongest capability from live capability catalog.
      const fallbackCaps = capabilityMap?.[agentName] || [];
      const chosen =
        fallbackCaps.find((c) => String(c.id || '').includes('full_self_test')) ||
        fallbackCaps.find((c) => String(c.id || '').includes('health')) ||
        fallbackCaps.find((c) => c.impact === 'high') ||
        fallbackCaps[0];

      if (chosen?.id) {
        const capRes = await base44.functions.invoke('agentCapabilityOrchestrator', {
          action: 'run_capability',
          params: { agent_name: agentName, capability_id: chosen.id },
        });
        if (capRes?.data?.error) throw new Error(String(capRes.data.error));
        if (capRes?.data?.status === 'error') throw new Error(String(capRes?.data?.run_error || 'Capability execution failed'));
        return { agentName, data: capRes.data };
      }

      // Final fallback: let Nexus infer the best route.
      const res = await base44.functions.invoke('commandCenterIntelligence', {
        action: 'intent_routing',
        params: {
          user_request: `Run a diagnostic check for ${agentName}. Return immediate focus, risk, and next action.`,
          context: { source: 'ai_agents_page' },
        },
      });

      if (res?.data?.error) throw new Error(String(res.data.error));
      if (res?.data?.status === 'error') throw new Error(String(res?.data?.run_error || 'Capability run failed'));
      return { agentName, data: res.data };
    },
    onSuccess: ({ agentName, data }) => {
      setAgentRuns((prev) => ({
        ...prev,
        [agentName]: { status: 'success', summary: summarizeRunResult(data), at: new Date().toISOString() },
      }));
    },
    onError: (error, agentName) => {
      setAgentRuns((prev) => ({
        ...prev,
        [agentName]: { status: 'error', summary: error?.message || 'Action failed', at: new Date().toISOString() },
      }));
    },
  });

  const runCapability = useMutation({
    mutationFn: async ({ agentName, capabilityId }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: agentName, capability_id: capabilityId },
      });
      if (res?.data?.error) throw new Error(String(res.data.error));
      if (res?.data?.status === 'error') throw new Error(String(res?.data?.run_error || 'Capability run failed'));
      return { agentName, data: res.data };
    },
    onSuccess: ({ agentName, data }) => {
      setAgentRuns((prev) => ({
        ...prev,
        [agentName]: {
          status: data?.status === "success" ? "success" : "error",
          summary: data?.status === "success"
            ? `Capability completed: ${data?.capability?.label || "run"}`
            : `Capability failed: ${data?.run_error || "unknown error"}`,
          at: new Date().toISOString(),
        },
      }));
    },
    onError: (error, vars) => {
      setAgentRuns((prev) => ({
        ...prev,
        [vars.agentName]: { status: "error", summary: error?.message || "Capability run failed", at: new Date().toISOString() },
      }));
    },
    onSettled: () => {
      setRunningCapabilityKey("");
    },
  });

  const registryMap = useMemo(() => {
    const map = {};
    (registryResult?.agents || []).forEach((agent) => {
      map[normalizeName(agent.name)] = agent;
    });
    return map;
  }, [registryResult]);

  const capabilityMap = useMemo(() => {
    const map = {};
    (capabilityCatalog.agents || []).forEach((entry) => {
      map[entry.agent_name] = entry.capabilities || [];
    });
    // Fallback from manifest when capability list is unavailable.
    (manifestCatalog.agents || []).forEach((entry) => {
      if (!map[entry.name] || map[entry.name].length === 0) {
        map[entry.name] = entry.capabilities || [];
      }
    });
    return map;
  }, [capabilityCatalog, manifestCatalog]);

  const manifestMap = useMemo(() => {
    const map = {};
    (manifestCatalog.agents || []).forEach((entry) => {
      map[normalizeName(entry.name)] = entry;
    });
    return map;
  }, [manifestCatalog]);

  const mergedAgents = useMemo(
    () => AGENTS.map((agent) => {
      const live = registryMap[normalizeName(agent.name)];
      const manifest = manifestMap[normalizeName(agent.name)] || {};
      return {
        ...agent,
        subtitle: manifest.role ? `${manifest.role}` : agent.subtitle,
        description: manifest.tagline ? `${agent.description} ${manifest.tagline}` : agent.description,
        domain: manifest.domain || agent.domain,
        capabilities: (manifest.capabilities || []).length
          ? manifest.capabilities.map((c) => c.label || c.id || "capability")
          : (ROSTER_CAPS[normalizeName(agent.name)]?.length ? ROSTER_CAPS[normalizeName(agent.name)] : agent.capabilities),
        liveStatus: live?.status || "idle",
        liveFocus: live?.current_focus || "Monitoring baseline signals",
        liveMetric: live?.key_metric || "No live metric available",
        liveConcern: live?.concern || "No critical concern reported",
      };
    }),
    [registryMap, manifestMap]
  );

  const triggerAgentAction = (agentName) => {
    setAgentRuns((prev) => ({
      ...prev,
      [agentName]: { status: "running", summary: "Running action...", at: new Date().toISOString() },
    }));
    runAgentAction.mutate(agentName);
  };

  const handleRunCapability = (agentName, capabilityId) => {
    const key = `${agentName}:${capabilityId}`;
    setRunningCapabilityKey(key);
    runCapability.mutate({ agentName, capabilityId });
  };

  const runAllNeedingAttention = async () => {
    const targets = mergedAgents.filter((agent) => agent.liveStatus === "needs_attention");
    if (targets.length === 0) return;

    setIsBulkRunning(true);
    for (const agent of targets) {
      // Sequential execution avoids request bursts and keeps per-agent feedback readable.
       
      await new Promise((resolve) => {
        setAgentRuns((prev) => ({
          ...prev,
          [agent.name]: { status: "running", summary: "Running action...", at: new Date().toISOString() },
        }));

        runAgentAction.mutate(agent.name, {
          onSettled: () => resolve(),
        });
      });
    }
    setIsBulkRunning(false);
  };

  const showNexus = filter === "All" && !search;
  const showAtlasLanding = !search && (filter === "All" || filter === "Operations");

  const filtered = useMemo(() => {
    const base = mergedAgents.filter((a) => {
      const matchDomain = filter === "All" || a.domain === filter;
      const needle = search.trim().toLowerCase();
      const matchSearch = !needle || a.name.toLowerCase().includes(needle) || a.subtitle.toLowerCase().includes(needle) || a.description.toLowerCase().includes(needle) || a.capabilities.some((c) => c.toLowerCase().includes(needle));
      return matchDomain && matchSearch;
    });

    const byPriority = [...base].sort((a, b) => {
      const ar = STATUS_STYLE[a.liveStatus]?.rank ?? 1;
      const br = STATUS_STYLE[b.liveStatus]?.rank ?? 1;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });

    if (sortBy === "name") return [...base].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "status") return [...base].sort((a, b) => (a.liveStatus || "").localeCompare(b.liveStatus || ""));
    return byPriority;
  }, [mergedAgents, filter, search, sortBy]);

  const needsAttentionCount = mergedAgents.filter((a) => a.liveStatus === "needs_attention").length;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Agent Federation</h1>
              <p className="text-sm text-slate-500">17 specialist agents with live federation telemetry</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={runAllNeedingAttention}
              disabled={isBulkRunning || needsAttentionCount === 0}
              className="border-white/[0.1] text-slate-200"
            >
              {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isBulkRunning ? "Running..." : "Run All Needing Attention"}
            </Button>
            <Button variant="outline" onClick={() => refetchRegistry()} disabled={isFetchingRegistry} className="border-white/[0.1] text-slate-200">
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingRegistry ? "animate-spin" : ""}`} />
              Run Live Scan
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mt-4 flex-wrap">
          {[
            { label: "Active Agents", value: String(mergedAgents.filter((a) => a.liveStatus === "active").length + 1), color: "text-blue-400" },
            { label: "Needs Attention", value: String(needsAttentionCount), color: needsAttentionCount > 0 ? "text-amber-400" : "text-emerald-400" },
            { label: "Domains Covered", value: String(new Set(AGENTS.map((a) => a.domain)).size), color: "text-violet-400" },
            { label: "Federation Health", value: registryResult?.federation_health || (isLoadingRegistry ? "Scanning..." : "Unknown"), color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 text-center">
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, domain, or capability..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {domains.map((d) => (
            <button key={d} onClick={() => setFilter(d)} className={`text-xs px-3 py-2 rounded-lg transition-all ${filter === d ? "bg-blue-500/20 border border-blue-500/30 text-blue-400" : "bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-slate-300"}`}>
              {d}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-200">
              <option value="priority">By priority</option>
              <option value="status">By status</option>
              <option value="name">By name</option>
            </select>
          </div>
        </div>
      </div>

      {showNexus && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="relative rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-violet-500/10 p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-violet-600/5 pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex items-center gap-5 flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-white">Nexus</h2>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-semibold tracking-wide">CEO � Command Center</span>
                  </div>
                  <p className="text-sm text-blue-300/80">Master orchestrator of the AI federation</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] text-emerald-400">{registryResult?.highest_priority_agent ? `Priority now: ${registryResult.highest_priority_agent}` : "Live orchestration active"}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-slate-300 leading-relaxed mb-2">{NEXUS.description}</p>
                {(registryResult?.recommended_focus || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {registryResult.recommended_focus.slice(0, 3).map((focus) => (
                      <span key={focus} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-300">{focus}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 flex-shrink-0 min-w-[220px]">
                <div className="flex flex-wrap gap-1.5">
                  {NEXUS.capabilities.map((cap) => (
                    <span key={cap} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-300">{cap}</span>
                  ))}
                </div>
                <Link to={createPageUrl(NEXUS.page)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-all">
                  <ExternalLink className="w-4 h-4" />
                  Open Nexus Command Center
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}


      {showAtlasLanding && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="relative rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-amber-500/10 p-5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 to-amber-600/5 pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">Atlas Operations Hub</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 font-semibold tracking-wide">Operations</span>
                  </div>
                  <p className="text-sm text-orange-300/80">Run workflows, manage capacity, and track operational health</p>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Jump directly into Atlas execution surfaces. Use Ops Hub for commands and diagnostics, and Operations Dashboard for executive health and interventions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 flex-shrink-0">
                <Link to={createPageUrl("Atlas")} className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-orange-500/25 bg-orange-500/10 text-orange-300 text-xs font-medium hover:bg-orange-500/20 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Atlas
                </Link>
                <Link to={createPageUrl("AtlasOpsHub")} className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-orange-500/35 bg-orange-500/15 text-orange-200 text-xs font-semibold hover:bg-orange-500/25 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Atlas Ops Hub
                </Link>
                <Link to={createPageUrl("AtlasOperationsDashboard")} className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-amber-500/35 bg-amber-500/15 text-amber-200 text-xs font-semibold hover:bg-amber-500/25 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ops Dashboard
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((agent, i) => {
          const colors = COLOR_MAP[agent.color] || COLOR_MAP.blue;
          const Icon = agent.icon;
          const statusCfg = STATUS_STYLE[agent.liveStatus] || STATUS_STYLE.idle;
          const StatusIcon = statusCfg.icon;
          const actionCfg = AGENT_ACTION_MAP[agent.name] || { label: "Run Agent Check" };
          const runState = agentRuns[agent.name];
          const isRunning = runState?.status === "running";
          const catalogCaps = capabilityMap[agent.name] || [];
          const fallbackCaps = ((ROSTER_CAPS[normalizeName(agent.name)] || agent.capabilities || [])).map((label) => ({
            id: `${agent.name.toLowerCase().replace(/\s+/g, "_")}.${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
            label,
            impact: "medium",
            description: `${agent.name} can execute ${label.toLowerCase()} workflows.`,
          }));
          const capabilities = catalogCaps.length ? catalogCaps : fallbackCaps;
          const isExpanded = expandedAgent === agent.name;
          const agentPages = AGENT_PAGE_MAP[agent.name] || { overview: agent.page };
          const quickLinks = [
            { label: "Overview", page: agentPages.overview },
            ...(agentPages.ops ? [{ label: "Ops", page: agentPages.ops }] : []),
            ...(agentPages.dashboard ? [{ label: "Dashboard", page: agentPages.dashboard }] : []),
          ];

          return (
            <motion.div key={agent.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 h-full flex flex-col hover:border-white/20 transition-all`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${colors.text}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                      <p className={`text-[10px] ${colors.text}`}>{agent.subtitle}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${colors.badge} border ${colors.border} flex-shrink-0`}>{agent.domain}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-3">{agent.description}</p>

                <div className="rounded-lg bg-black/20 border border-white/[0.06] p-2.5 mb-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">Status</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${statusCfg.badge}`}>
                      <StatusIcon className="w-3 h-3" />
                      {agent.liveStatus.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300"><span className="text-slate-500">Focus:</span> {agent.liveFocus}</p>
                  <p className="text-[11px] text-slate-300"><span className="text-slate-500">Metric:</span> {agent.liveMetric}</p>
                  <p className={`text-[11px] ${statusCfg.text}`}><span className="text-slate-500">Signal:</span> {agent.liveConcern}</p>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-500">{cap}</span>
                  ))}
                </div>

                {runState && (
                  <div className={`mb-2 text-[10px] rounded-md px-2 py-1 border ${runState.status === "error" ? "text-red-300 border-red-500/20 bg-red-500/10" : runState.status === "success" ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" : "text-slate-300 border-white/[0.08] bg-white/[0.03]"}`}>
                    {runState.summary}
                  </div>
                )}

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button onClick={() => triggerAgentAction(agent.name)} disabled={isRunning} className="h-8 text-[11px] bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] text-slate-200">
                    {isRunning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                    {isRunning ? "Running" : actionCfg.label}
                  </Button>

                  <Link to={createPageUrl(agentPages.overview)} className={`flex items-center justify-center gap-2 py-2 rounded-xl border ${colors.border} ${colors.bg} ${colors.text} text-xs font-medium hover:opacity-80 transition-all`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open {agent.name}
                  </Link>
                </div>

                {quickLinks.length > 1 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {quickLinks.slice(1).map((link) => (
                      <Link key={link.page} to={createPageUrl(link.page)} className="flex items-center justify-center gap-1 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] text-[10px] text-slate-300 hover:bg-white/[0.07] transition-all">
                        <ExternalLink className="w-3 h-3" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-2">
                  <Button onClick={() => setExpandedAgent(isExpanded ? "" : agent.name)} variant="outline" className="w-full h-8 text-[11px] border-white/[0.1] text-slate-300">
                    {isExpanded ? "Hide Capabilities" : `Capabilities (${capabilities.length})`}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 space-y-2">
                    {capabilities.length === 0 && <p className="text-[10px] text-slate-500">No capability catalog loaded for this agent yet.</p>}
                    {capabilities.map((cap) => {
                      const key = `${agent.name}:${cap.id}`;
                      const isCapRunning = runningCapabilityKey === key;
                      return (
                        <button key={cap.id} onClick={() => handleRunCapability(agent.name, cap.id)} disabled={isCapRunning} className="w-full text-left rounded-md border border-white/[0.08] bg-black/20 hover:bg-black/30 px-2 py-1.5 transition-all disabled:opacity-50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-200">{cap.label}</span>
                            <span className="text-[9px] text-slate-500">{cap.impact}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{isCapRunning ? "Running capability..." : cap.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Bot className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No agents match your current filters</p>
        </div>
      )}
    </div>
  );
}























