import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { AGENT_BY_ID, AGENT_TABS, normalizeAgentId } from "@/lib/agents";
import {
  buildLocalClientAcquisitionRecommendation as buildGrowthClientAcquisitionRecommendation,
  buildLocalClientAcquisitionReply as buildGrowthClientAcquisitionReply,
  buildLocalFounderGrowthPlan as buildGrowthFounderGrowthPlan,
  buildLocalFounderGrowthRecommendation as buildGrowthFounderGrowthRecommendation,
  buildLocalFounderGrowthReply as buildGrowthFounderGrowthReply,
  buildLocalSpecialistFounderGrowthReply as buildGrowthSpecialistFounderGrowthReply,
  hasLocalClientAcquisitionContext as hasGrowthClientAcquisitionContext,
  hasLocalFounderGrowthContext as hasGrowthFounderGrowthContext,
  isLocalClientAcquisitionPrompt as isGrowthClientAcquisitionPrompt,
  isLocalFounderGrowthPrompt as isGrowthFounderPrompt,
  isLocalSpecialistFounderGrowthPrompt as isGrowthSpecialistFounderPrompt,
} from "@/lib/localGrowthChat";
import {
  computeNextTaskState as computeLocalTaskState,
  inferLocalConversationMode as inferTaskConversationMode,
} from "@/lib/localTaskState";
import {
  buildLocalChallengeResponse,
  buildLocalObjectionResponse,
  buildLocalSynthesisResponse,
  buildLocalTensionResponse,
  buildLocalThreadRecap,
  buildLocalTradeoffResponse,
  getRecentLocalThreadContext,
  isChallengeLocalPrompt,
  isMessyLocalPrompt,
  isObjectionLocalPrompt,
  isThreadRecapLocalPrompt,
  isTradeoffLocalPrompt,
  isVagueTensionLocalPrompt,
  pickLocalFollowUp,
  pickLocalLead,
} from "@/lib/localConversationResponses";
import { toUiMessages } from "@/lib/chatMessageMapper";
import {
  addRemoteConversationMessage,
  createRemoteConversation,
  deleteToolPresetRemote,
  fetchAgentMemoryRemote,
  fetchToolPresetsRemote,
  fetchUserFavoritesRemote,
  fetchUserPersonalizationRemote,
  fetchUserProfileRemote,
  getRemoteBackendBase,
  getRemoteSessionUserId,
  getRemoteSessionTenantId,
  getRemoteConversation,
  hasRemoteBackend,
  markRemoteBackendUnavailable,
  saveToolPresetRemote,
  saveAgentMemoryRemote,
  saveUserFavoritesRemote,
  saveUserPersonalizationRemote,
  saveUserProfileRemote,
} from "@/lib/remoteAgentClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AgentProviderFabric from "@/components/agent-workspace/AgentProviderFabric";
import AgentWorkflowsTab from "@/components/agent-workspace/AgentWorkflowsTab";
import AgentExecutionReadinessPanel from "@/components/agent-workspace/AgentExecutionReadinessPanel";
import { Activity, CheckCircle2, Compass, Cpu, DollarSign, Download, FlaskConical, Link2, Loader2, Paperclip, Play, Scale, Search, Send, Settings2, Shield, ShoppingBag, Sparkles, Star, Target, Trash2, TrendingDown, TrendingUp, Users, Wand2, Wrench, XCircle } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TAB_LABELS = {
  overview: "Overview",
  chat: "Chat",
  tools: "Tools",
  integrations: "Integrations",
  ops: "Ops",
  dashboard: "Dashboard",
  workflows: "Workflows",
  functions: "Functions",
  "content-bank": "Content Bank",
  "knowledge-base": "Knowledge Base",
  assets: "Assets",
  "strategy-library": "Strategy Library",
  "schedule-library": "Schedule Library",
  "workflow-library": "Workflow Library",
  "knowledge-library": "Knowledge Library",
  "security-library": "Security Library",
  "market-library": "Market Library",
  "people-library": "People Library",
  "partnership-library": "Partnership Library",
  "commerce-library": "Commerce Library",
  "quality-library": "Quality Library",
  "legal-library": "Legal Library",
  documents: "Documents",
};

const AGENT_TAB_LABELS = {
  nexus: { overview: "Command", chat: "Briefing", tools: "Control Panel", integrations: "Federation APIs", ops: "Orchestration", dashboard: "Intelligence Deck", workflows: "Initiatives", functions: "Capabilities" },
  maestro: { overview: "Command Center", chat: "Maestro Chat", tools: "Marketing Toolbox", dashboard: "Marketing Intelligence", functions: "Capabilities" },
  prospect: { overview: "Sales Command", chat: "Prospect Chat", tools: "Sales Toolbox", dashboard: "Pipeline Intelligence", functions: "Capability Reference", assets: "Sales Assets" },
  sentinel: { overview: "Security Command", chat: "Sentinel Chat", tools: "Security Toolbox", dashboard: "Security Intelligence", functions: "Capability Reference", "security-library": "Security Library" },
  "support-sage": { overview: "Support Command", chat: "Support Chat", tools: "Support Toolbox", dashboard: "Support Intelligence", functions: "Capability Reference", "knowledge-base": "Knowledge Base" },
  centsible: { overview: "Finance Command", chat: "Centsible Chat", tools: "Finance Toolbox", dashboard: "Financial Intelligence", functions: "Capability Reference", documents: "Documents" },
  sage: { overview: "Strategy Command", chat: "Sage Chat", tools: "Strategy Toolbox", dashboard: "Strategic Intelligence", functions: "Capability Reference", "strategy-library": "Strategy Library" },
  chronos: { overview: "Time Command", chat: "Chronos Chat", tools: "Time Toolbox", dashboard: "Time Intelligence", functions: "Capability Reference", "schedule-library": "Schedule Library" },
  veritas: { overview: "Legal Command", chat: "Veritas Chat", tools: "Legal Toolbox", dashboard: "Legal Intelligence", functions: "Capability Reference", "legal-library": "Legal Library" },
  inspect: { overview: "Quality Command", chat: "Inspect Chat", tools: "Quality Toolbox", dashboard: "Quality Intelligence", functions: "Capability Reference", "quality-library": "Quality Library" },
  canvas: { overview: "Creative Command", chat: "Canvas Chat", tools: "Creative Toolbox", dashboard: "Creative Intelligence", functions: "Capability Reference", "content-bank": "Content Bank" },
  merchant: { overview: "Commerce Command", chat: "Merchant Chat", tools: "Commerce Toolbox", dashboard: "Commerce Intelligence", functions: "Capability Reference", "commerce-library": "Commerce Library" },
  pulse: { overview: "People Command", chat: "Pulse Chat", tools: "People Toolbox", dashboard: "People Intelligence", functions: "Capability Reference", "people-library": "People Library" },
  compass: { overview: "Market Command", chat: "Compass Chat", tools: "Market Toolbox", dashboard: "Market Intelligence", functions: "Capability Reference", "market-library": "Market Library" },
  part: { overview: "Partnership Command", chat: "Part Chat", tools: "Partnership Toolbox", dashboard: "Partnership Intelligence", functions: "Capability Reference", "partnership-library": "Partnership Library" },
  atlas: { overview: "Operations Command", chat: "Atlas Chat", tools: "Operations Toolbox", dashboard: "Operations Intelligence", functions: "Capability Reference", "workflow-library": "Workflow Library" },
  scribe: { overview: "Knowledge Command", chat: "Scribe Chat", tools: "Knowledge Toolbox", dashboard: "Knowledge Intelligence", functions: "Capability Reference", "knowledge-library": "Knowledge Library" },
};

const AGENT_TAB_SETS = {
  nexus: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions"],
  maestro: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions"],
  canvas: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "content-bank"],
  "support-sage": ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "knowledge-base"],
  prospect: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "assets"],
  sage: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "strategy-library"],
  chronos: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "schedule-library"],
  atlas: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "workflow-library"],
  scribe: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "knowledge-library"],
  sentinel: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "security-library"],
  compass: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "market-library"],
  pulse: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "people-library"],
  part: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "partnership-library"],
  merchant: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "commerce-library"],
  inspect: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "quality-library"],
  veritas: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "legal-library"],
  centsible: ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions", "documents"],
};

const TIER_OPTIONS = ["suggest", "approve", "auto-low-risk", "auto-broad"];
const USER_ID = getRemoteSessionUserId();
const TENANT_ID = getRemoteSessionTenantId();
const LOCAL_FAVORITES_KEY = "jarvis.favorite.tools.v1";
const BUSINESS_PROFILE_KEY = `jarvis.business.profile.v2.${TENANT_ID}`;
const CANVAS_BANK_KEY = "jarvis.canvas.bank.v1";
const CHAT_CACHE_PREFIX = "jarvis.chat.messages";
const SCRIBE_DOCS_KEY = "jarvis.scribe.documents.v1";
const VERITAS_CONTRACTS_KEY = "jarvis.veritas.contracts.v1";
const SENTINEL_CASES_KEY = "jarvis.sentinel.cases.v1";
const MERCHANT_CATALOG_KEY = "jarvis.merchant.catalog.v1";
const MERCHANT_ORDERS_KEY = "jarvis.merchant.orders.v1";
const PROSPECT_SEQUENCES_KEY = "jarvis.prospect.sequences.v1";
const SUPPORT_KB_KEY = "jarvis.support.kb.v1";
const PROSPECT_ASSETS_KEY = "jarvis.prospect.assets.v1";
const SAGE_LIBRARY_KEY = "jarvis.sage.library.v1";
const CHRONOS_LIBRARY_KEY = "jarvis.chronos.library.v1";
const ATLAS_LIBRARY_KEY = "jarvis.atlas.library.v1";
const SCRIBE_LIBRARY_KEY = "jarvis.scribe.library.v1";
const SENTINEL_LIBRARY_KEY = "jarvis.sentinel.library.v1";
const COMPASS_LIBRARY_KEY = "jarvis.compass.library.v1";
const PULSE_LIBRARY_KEY = "jarvis.pulse.library.v1";
const PART_LIBRARY_KEY = "jarvis.part.library.v1";
const MERCHANT_LIBRARY_KEY = "jarvis.merchant.library.v1";
const INSPECT_LIBRARY_KEY = "jarvis.inspect.library.v1";
const VERITAS_LIBRARY_KEY = "jarvis.veritas.library.v1";
const CENTSIBLE_DOCUMENTS_KEY = "jarvis.centsible.documents.v1";
const AGENT_NEEDS_KEY_PREFIX = "jarvis.agent.needs.v1";
const AGENT_NEED_IMPLEMENTATION_KEY_PREFIX = "jarvis.agent.needs.impl.v1";
const AGENT_NEED_CHECKLIST_KEY_PREFIX = "jarvis.agent.needs.checklist.v1";
const AGENT_NEED_CHECKLIST_EVIDENCE_KEY_PREFIX = "jarvis.agent.needs.checklist.evidence.v1";
const AGENT_EMAIL_CONFIG_KEY_PREFIX = "jarvis.agent.email.config.v1";
const CHAT_TASK_STATE_KEY_PREFIX = "jarvis.chat.taskstate.v1";
const CHAT_PENDING_ACTION_KEY_PREFIX = "jarvis.chat.pending.v1";
const CHAT_CANDIDATE_ACTIONS_KEY_PREFIX = "jarvis.chat.candidates.v1";
const CHAT_MEMORY_KEY_PREFIX = "jarvis.chat.memory.v1";
const CUSTOM_WORKFLOW_PACKS_KEY_PREFIX = "jarvis.workflow.packs.custom.v1";
const APPROVAL_MODE_KEY = "jarvis.approval.mode.v1";
const AUTONOMY_HISTORY_KEY = "jarvis.autonomy.history.v1";
const AUTONOMY_LANES = ["social_posting", "email_replies", "document_ingestion", "shop_operations", "generic_operations"];
const AGENT_LIBRARY_KEYS = {
  canvas: CANVAS_BANK_KEY,
  prospect: PROSPECT_ASSETS_KEY,
  "support-sage": SUPPORT_KB_KEY,
  centsible: CENTSIBLE_DOCUMENTS_KEY,
  sage: SAGE_LIBRARY_KEY,
  chronos: CHRONOS_LIBRARY_KEY,
  atlas: ATLAS_LIBRARY_KEY,
  scribe: SCRIBE_LIBRARY_KEY,
  sentinel: SENTINEL_LIBRARY_KEY,
  compass: COMPASS_LIBRARY_KEY,
  pulse: PULSE_LIBRARY_KEY,
  part: PART_LIBRARY_KEY,
  merchant: MERCHANT_LIBRARY_KEY,
  inspect: INSPECT_LIBRARY_KEY,
  veritas: VERITAS_LIBRARY_KEY,
};

const AGENT_OPS_ACTIONS = {
  nexus: [
    { action: "intent_routing", label: "Route Intent", risk: "medium" },
    { action: "cross_agent_insights", label: "Cross-Agent Insights", risk: "medium" },
    { action: "business_health_score", label: "Business Health", risk: "low" },
  ],
  maestro: [
    { action: "campaign_orchestration", label: "Campaign Orchestration", risk: "medium" },
    { action: "lifecycle_automation", label: "Lifecycle Automation", risk: "medium" },
    { action: "performance_scorecard", label: "Performance Scorecard", risk: "low" },
  ],
  prospect: [
    { action: "lead_discovery", label: "Lead Discovery", risk: "low" },
    { action: "lead_scoring", label: "Lead Scoring", risk: "low" },
    { action: "pipeline_analytics", label: "Pipeline Analytics", risk: "low" },
  ],
  "support-sage": [
    { action: "ticket_triage", label: "Ticket Triage", risk: "low" },
    { action: "sla_monitoring", label: "SLA Monitoring", risk: "low" },
    { action: "csat_driver_analysis", label: "CSAT Drivers", risk: "low" },
  ],
  centsible: [
    { action: "cash_flow_forecast", label: "Cash Flow Forecast", risk: "medium" },
    { action: "budget_variance", label: "Budget Variance", risk: "medium" },
    { action: "revenue_leakage_scan", label: "Revenue Leakage", risk: "medium" },
  ],
  sage: [
    { action: "scenario_modeling", label: "Scenario Modeling", risk: "medium" },
    { action: "strategy_scorecard", label: "Strategy Scorecard", risk: "low" },
    { action: "strategic_briefing", label: "Strategic Briefing", risk: "low" },
  ],
  chronos: [
    { action: "smart_scheduling", label: "Smart Scheduling", risk: "low" },
    { action: "meeting_load_audit", label: "Meeting Load Audit", risk: "low" },
    { action: "weekly_time_report", label: "Weekly Time Report", risk: "low" },
  ],
  atlas: [
    { action: "workflow_automation", label: "Workflow Automation", risk: "medium" },
    { action: "task_routing", label: "Task Routing", risk: "low" },
    { action: "capacity_planning", label: "Capacity Planning", risk: "medium" },
  ],
  scribe: [
    { action: "knowledge_capture", label: "Knowledge Capture", risk: "low" },
    { action: "sop_generation", label: "SOP Generation", risk: "low" },
    { action: "semantic_retrieval", label: "Semantic Retrieval", risk: "low" },
  ],
  sentinel: [
    { action: "threat_scan", label: "Threat Scan", risk: "high" },
    { action: "incident_triage", label: "Incident Triage", risk: "high" },
    { action: "security_posture_report", label: "Security Posture", risk: "medium" },
  ],
  compass: [
    { action: "market_briefing", label: "Market Briefing", risk: "low" },
    { action: "competitor_tracking", label: "Competitor Tracking", risk: "low" },
    { action: "opportunity_alerting", label: "Opportunity Alerts", risk: "medium" },
  ],
  part: [
    { action: "partner_discovery", label: "Partner Discovery", risk: "low" },
    { action: "alliance_pipeline", label: "Alliance Pipeline", risk: "low" },
    { action: "partner_roi_review", label: "Partner ROI", risk: "low" },
  ],
  pulse: [
    { action: "sentiment_monitor", label: "Sentiment Monitor", risk: "low" },
    { action: "burnout_risk_detection", label: "Burnout Risk", risk: "medium" },
    { action: "people_analytics", label: "People Analytics", risk: "low" },
  ],
  merchant: [
    { action: "inventory_risk", label: "Inventory Risk", risk: "medium" },
    { action: "pricing_intelligence", label: "Pricing Intelligence", risk: "medium" },
    { action: "conversion_optimization", label: "Conversion Optimization", risk: "medium" },
  ],
  canvas: [
    { action: "creative_generation", label: "Generate Creative", risk: "low" },
    { action: "cinematic_video_command", label: "Generate Reel/Video", risk: "medium" },
    { action: "voiceover_generation", label: "Generate Voiceover", risk: "low" },
    { action: "creative_performance", label: "Creative Performance", risk: "low" },
  ],
  inspect: [
    { action: "test_orchestration", label: "Test Orchestration", risk: "low" },
    { action: "quality_gate", label: "Quality Gate", risk: "low" },
    { action: "root_cause_analysis", label: "Root Cause Analysis", risk: "low" },
  ],
  veritas: [
    { action: "contract_risk_review", label: "Contract Risk Review", risk: "high" },
    { action: "compliance_audit", label: "Compliance Audit", risk: "high" },
    { action: "obligation_tracking", label: "Obligation Tracking", risk: "medium" },
  ],
};

const AGENT_DASHBOARD_KPIS = {
  nexus: ["Federation Health", "Active Workflows", "Critical Alerts"],
  maestro: ["Campaign ROI", "Engagement Lift", "Content Velocity"],
  prospect: ["Lead Volume", "Lead Quality", "Pipeline Velocity"],
  "support-sage": ["SLA Adherence", "CSAT", "Backlog Risk"],
  centsible: ["Runway", "Budget Variance", "Cash Conversion"],
  sage: ["Strategy Confidence", "Initiative Progress", "Risk Index"],
  chronos: ["Focus Hours", "Meeting Load", "Schedule Conflicts"],
  atlas: ["Throughput", "Blocked Tasks", "SLA Risk"],
  scribe: ["Knowledge Growth", "SOP Coverage", "Retrieval Success"],
  sentinel: ["Threat Level", "Open Incidents", "Posture Score"],
  compass: ["Trend Signals", "Competitor Moves", "Opportunity Index"],
  part: ["Partner Pipeline", "Activation Rate", "Partner ROI"],
  pulse: ["Sentiment", "Burnout Risk", "Retention Risk"],
  merchant: ["Conversion", "AOV", "Inventory Health"],
  canvas: ["Creative Output", "Variant Win Rate", "Brand Compliance"],
  inspect: ["Pass Rate", "Regression Rate", "Release Readiness"],
  veritas: ["Compliance Score", "Contract Risk", "Open Obligations"],
};

const AGENT_OPS_BRIEF = {
  nexus: {
    mission: "Coordinate cross-agent execution and surface highest-impact decisions.",
    focus: "Routing quality, conflict resolution, and strategic orchestration.",
  },
  maestro: {
    mission: "Drive campaign velocity and conversion across lifecycle channels.",
    focus: "Content pipeline, channel mix, and performance optimization.",
  },
  prospect: {
    mission: "Generate and progress qualified pipeline with minimal waste.",
    focus: "Lead quality, outreach effectiveness, and pipeline movement.",
  },
  sentinel: {
    mission: "Reduce threat exposure and accelerate containment response.",
    focus: "Threat detection, anomaly triage, and incident closure.",
  },
  "support-sage": {
    mission: "Protect customer experience and SLA reliability at scale.",
    focus: "Backlog health, first-response quality, and escalation risk.",
  },
  centsible: {
    mission: "Protect runway and improve financial operating efficiency.",
    focus: "Cash flow confidence, variance control, and leakage reduction.",
  },
  sage: {
    mission: "Translate data into high-confidence strategic decisions.",
    focus: "Scenario tradeoffs, initiative prioritization, and growth bets.",
  },
  chronos: {
    mission: "Optimize time allocation for execution and deep work.",
    focus: "Meeting load, schedule conflicts, and focus-time recovery.",
  },
  veritas: {
    mission: "Reduce legal/compliance risk while enabling safe growth.",
    focus: "Contract exposure, obligations, and regulatory alignment.",
  },
  inspect: {
    mission: "Increase release quality and prevent regression risk.",
    focus: "Pass rate, defect recurrence, and readiness confidence.",
  },
  canvas: {
    mission: "Ship high-performing branded creative consistently.",
    focus: "Asset throughput, format adaptation, and brand compliance.",
  },
  merchant: {
    mission: "Improve commerce performance and inventory resilience.",
    focus: "Conversion rate, pricing signal, and stock risk.",
  },
  pulse: {
    mission: "Maintain team health and reduce retention risk.",
    focus: "Sentiment movement, burnout signals, and manager interventions.",
  },
  compass: {
    mission: "Surface market shifts before they become business risk.",
    focus: "Trend velocity, competitor movement, and opportunity alerts.",
  },
  part: {
    mission: "Grow partner ecosystem with measurable revenue impact.",
    focus: "Partner quality, activation rate, and alliance throughput.",
  },
  atlas: {
    mission: "Maximize operational throughput with fewer bottlenecks.",
    focus: "Workflow flow rate, blocked tasks, and SLA stability.",
  },
  scribe: {
    mission: "Make organizational knowledge searchable and actionable.",
    focus: "Capture quality, SOP coverage, and retrieval accuracy.",
  },
};

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+)|(?:data:image\/[a-zA-Z0-9.+-]+(?:;charset=[^;,)\s]+)?(?:;base64)?,[^\s)]+))\)/gi;
const EMBEDDED_MEDIA_RE = /\[(audio|video):([^\]]*)\]\(((?:https?:\/\/[^\s)]+)|(?:data:(?:audio|video)\/[a-zA-Z0-9.+-]+(?:;charset=[^;,)\s]+)?(?:;base64)?,[^\s)]+))\)/gi;
const OPEN_ASSET_LINK_RE = /\[(Open image|Open storyboard cover)\]\(((?:https?:\/\/[^\s)]+)|(?:data:image\/[a-zA-Z0-9.+-]+(?:;charset=[^;,)\s]+)?(?:;base64)?,[^\s)]+))\)/gi;

const extractMarkdownImages = (text = "") => {
  const out = [];
  if (!text) return out;
  let match;
  while ((match = MARKDOWN_IMAGE_RE.exec(String(text))) !== null) {
    out.push({ alt: match[1] || "image", url: match[2] || "" });
  }
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  return out.filter((x) => /^https?:\/\//i.test(x.url) || /^data:image\//i.test(x.url));
};

const stripMarkdownImages = (text = "") => {
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  EMBEDDED_MEDIA_RE.lastIndex = 0;
  OPEN_ASSET_LINK_RE.lastIndex = 0;
  return String(text || "").replace(MARKDOWN_IMAGE_RE, "").replace(EMBEDDED_MEDIA_RE, "").replace(OPEN_ASSET_LINK_RE, "").trim();
};

const extractEmbeddedMedia = (text = "") => {
  const out = [];
  if (!text) return out;
  let match;
  while ((match = EMBEDDED_MEDIA_RE.exec(String(text))) !== null) {
    out.push({
      kind: match[1] || "media",
      alt: match[2] || match[1] || "media",
      url: match[3] || "",
    });
  }
  EMBEDDED_MEDIA_RE.lastIndex = 0;
  return out.filter((x) => /^https?:\/\//i.test(x.url) || /^data:(audio|video)\//i.test(x.url));
};

const buildCanvasPreviewDataUri = (prompt = "", options = {}) => {
  const width = Number(options.width || 1024);
  const height = Number(options.height || 1024);
  const variantSeed = Number(options.seed || Date.now());
  const safePrompt = String(prompt || "Creative preview").slice(0, 120);
  const palette = [
    ["#0f172a", "#2563eb", "#38bdf8"],
    ["#111827", "#db2777", "#fb7185"],
    ["#172554", "#7c3aed", "#22d3ee"],
    ["#052e16", "#16a34a", "#84cc16"],
  ][Math.abs(variantSeed) % 4];
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

const AGENT_PERSONALITY = {
  nexus: { title: "The Orchestrator", voice: "Calm and decisive. Sees the whole board before acting." },
  maestro: { title: "Marketing Virtuoso", voice: "Creative and energetic. Turns strategy into campaign momentum." },
  prospect: { title: "Persistent Hunter", voice: "Tenacious and data-driven. Finds and advances high-fit pipeline." },
  sentinel: { title: "Silent Guardian", voice: "Stoic and vigilant. Prioritizes protection and fast containment." },
  "support-sage": { title: "Empathetic Listener", voice: "Warm and patient. Resolves issues without losing the human touch." },
  centsible: { title: "Numbers Whisperer", voice: "Precise and pragmatic. Protects cash, margin, and runway." },
  sage: { title: "Strategic Visionary", voice: "Thoughtful and analytical. Models choices and tradeoffs clearly." },
  chronos: { title: "Time Master", voice: "Calm and exact. Defends focus and scheduling quality." },
  veritas: { title: "Guardian of Truth", voice: "Principled and meticulous. Enforces legal and compliance guardrails." },
  inspect: { title: "Quality Enforcer", voice: "Relentless and methodical. Catches defects before users do." },
  canvas: { title: "Visual Poet", voice: "Artistic and iterative. Ships creative that matches brand intent." },
  merchant: { title: "Storekeeper", voice: "Operational and practical. Optimizes catalog, pricing, and orders." },
  pulse: { title: "Team Heartbeat", voice: "Supportive and observant. Tracks wellbeing and retention risk." },
  compass: { title: "Market Navigator", voice: "Curious and outward-looking. Spots shifts before competitors react." },
  part: { title: "Connector", voice: "Charismatic and strategic. Builds leverage through partnerships." },
  atlas: { title: "Backbone of Operations", voice: "Systematic and reliable. Keeps workflows moving." },
  scribe: { title: "Collective Memory", voice: "Meticulous and organized. Makes knowledge searchable and actionable." },
};

const LOCAL_CHAT_ACTION_REQUIREMENTS = {
  campaign_orchestration: ["objective", "budget", "audience", "channels"],
  create_job_description: ["job_title", "department"],
  review_contract: ["contract_name_or_text"],
  contract_risk_review: ["contract_name_or_text"],
  create_promotion: ["product_or_segment", "discount_or_offer", "duration"],
  run_test_suite: ["suite_name_or_scope"],
  test_orchestration: ["suite_name_or_scope"],
  quality_gate: ["suite_name_or_scope"],
};

const LOCAL_CHAT_STYLE = {
  nexus: { toneOpen: "I’m looking across the whole system.", nextAsk: "What outcome matters most right now: growth, reliability, or speed?", helpAsk: "Share the outcome, deadline, and what cannot break, and I will route the best path." },
  maestro: { toneOpen: "I’m thinking from audience, offer, and economics outward.", nextAsk: "What are we trying to move first: demand, conversions, or retention?", helpAsk: "Tell me the offer, audience, and primary KPI, and I will shape the campaign path." },
  prospect: { toneOpen: "I’m optimizing for qualified pipeline, not noise.", nextAsk: "Should we prioritize speed-to-meeting or meeting quality?", helpAsk: "Share the ICP, deal size, and current funnel bottleneck, and I will work the outreach angle." },
  "support-sage": { toneOpen: "I’m balancing customer empathy with resolution speed.", nextAsk: "Do we need to reduce backlog risk or improve resolution quality first?", helpAsk: "Tell me the issue pattern, volume, and where the customer experience is breaking down." },
  centsible: { toneOpen: "I’m grounding this in cash impact and operating leverage.", nextAsk: "Should we protect runway, improve margin, or back a growth move?", helpAsk: "Share the decision horizon, target metric, and where the financial pressure is showing up." },
  sage: { toneOpen: "I’m framing the decision through tradeoffs, not optimism.", nextAsk: "Should I optimize this for the next 90 days or the next 12 months?", helpAsk: "Tell me the decision, constraints, and downside we need to avoid." },
  chronos: { toneOpen: "I’m treating time like a strategic resource.", nextAsk: "Where is time leaking most right now: meetings, conflicts, or fragmented focus?", helpAsk: "Tell me which team feels the calendar pain and where focus is getting lost." },
  atlas: { toneOpen: "I’m looking for the brittle handoff or workflow choke point.", nextAsk: "Which workflow is breaking trust first: handoffs, queues, or runbook reliability?", helpAsk: "Tell me the workflow, the failure mode, and what must stay reliable." },
  scribe: { toneOpen: "I’m optimizing this for reuse, not just storage.", nextAsk: "Do you need better recall, cleaner documentation, or stronger auditability?", helpAsk: "Tell me what knowledge needs to be captured, clarified, or made reusable." },
  sentinel: { toneOpen: "I’m prioritizing exposure reduction before depth for depth's sake.", nextAsk: "Do we need containment, posture hardening, or compliance evidence first?", helpAsk: "Tell me the asset, threat concern, and how much operational risk we can tolerate." },
  compass: { toneOpen: "I’m separating signal from noise before making a market call.", nextAsk: "Do you need competitive pressure, demand shifts, or whitespace opportunities first?", helpAsk: "Tell me the market question, segment, and decision deadline." },
  part: { toneOpen: "I’m looking for leverage, not just more partners.", nextAsk: "Should we focus on partner fit, activation, or sourced revenue first?", helpAsk: "Tell me the partner type, strategic goal, and what good looks like commercially." },
  pulse: { toneOpen: "I’m reading people signals before they become turnover or burnout.", nextAsk: "Are we trying to improve hiring quality, engagement, performance, or retention risk?", helpAsk: "Tell me the team, lifecycle stage, and people outcome you want to improve." },
  merchant: { toneOpen: "I’m balancing margin, conversion, and inventory health together.", nextAsk: "Are we solving for margin pressure, conversion drag, or inventory movement?", helpAsk: "Tell me the product, channel, and KPI pressure point you want to improve." },
  canvas: { toneOpen: "I’m shaping creative around audience tension and channel behavior.", nextAsk: "Do you need a fresh concept, a stronger hook, or variants for distribution?", helpAsk: "Tell me the audience, offer, channel, and emotional direction for the asset." },
  inspect: { toneOpen: "I’m focusing on failure prevention, not vanity QA metrics.", nextAsk: "Do we need more release confidence, better coverage, or faster root-cause clarity?", helpAsk: "Tell me the release scope, risk area, and what failure would hurt most." },
  veritas: { toneOpen: "I’m making the risk explicit before we move fast.", nextAsk: "Should we optimize for deal speed, compliance confidence, or risk reduction?", helpAsk: "Tell me the legal objective, counterparty or regulation, and the commercial context." },
};

const LOCAL_CHAT_KNOWLEDGE = {
  nexus: {
    domain: "business orchestration",
    greeting: "What are we optimizing right now: growth, reliability, or speed?",
    heuristic: "Reliable execution usually comes from clear ownership, deterministic run paths, and reversible changes.",
    signals: ["blocked workflows", "connector health", "autonomy drift", "priority conflicts"],
    ask: "What outcome matters most right now: growth, risk reduction, or speed?",
    frame: ["Define the business outcome and decision deadline.", "Select the smallest capable agent set.", "Choose a path: plan, simulate, or execute with guardrails."],
    lenses: {
      growth: "Growth breakdowns usually happen at handoffs, routing, or follow-through, not just ideation.",
      reliability: "Reliability improves when workflows are deterministic, observable, and reversible.",
      speed: "Speed matters only if the path is safe to replay and easy to verify.",
    },
  },
  maestro: {
    domain: "marketing strategy and paid growth",
    greeting: "What are we trying to move: qualified pipeline, purchases, or awareness?",
    heuristic: "Most campaign problems come down to audience, creative, offer, or post-click friction.",
    signals: ["CTR", "CPC", "CVR", "CPA", "ROAS", "creative fatigue"],
    ask: "Which KPI is primary here: CPA, ROAS, or qualified pipeline?",
    frame: ["Clarify the offer, audience, and buying tension.", "Pinpoint whether the bottleneck is creative, targeting, offer, or landing page.", "Build the first test matrix around the highest-leverage variable."],
    lenses: {
      campaign: "The core question is whether the drag is targeting, creative, offer, or post-click friction.",
      brand: "Brand work still needs to create a distinct audience tension and a measurable behavior shift.",
      retention: "Lifecycle lift usually comes from segmentation, timing, and relevance more than extra volume.",
    },
  },
  prospect: {
    domain: "sales development and pipeline generation",
    greeting: "Are we trying to source more meetings, improve reply quality, or clean up pipeline quality?",
    heuristic: "A strong sequence creates a reason to reply, not just a reason to read.",
    signals: ["reply rate", "meeting rate", "conversion by segment", "intent signals", "deal velocity"],
    ask: "Which segment closes fastest for you right now?",
    frame: ["Tighten the ICP and disqualifiers.", "Bias toward accounts showing urgency or fit.", "Sequence outreach with a clear reason to reply."],
    lenses: {
      outreach: "The failure mode is usually weak relevance or an unclear call to action.",
      pipeline: "Pipeline quality rises when we bias toward urgency, fit, and account context over list size.",
    },
  },
  "support-sage": {
    domain: "customer support operations",
    greeting: "What needs attention first: SLA risk, ticket quality, or repeat issue prevention?",
    heuristic: "Repeated tickets usually point to a product, documentation, or routing issue upstream.",
    signals: ["first response time", "time to resolution", "reopen rate", "CSAT", "backlog aging"],
    ask: "Are we optimizing for faster first response or fewer repeat tickets?",
    frame: ["Identify the issue cluster and impact scope.", "Route by urgency, complexity, and SLA risk.", "Convert repeated issues into prevention or knowledge fixes."],
    lenses: {
      backlog: "Backlogs become dangerous when aging and complexity rise together.",
      quality: "Support quality is empathy, accuracy, and follow-through working together.",
    },
  },
  centsible: {
    domain: "finance and operating leverage",
    greeting: "Do we need to protect runway, improve margin, or unlock growth capacity?",
    heuristic: "Protect cash first, then reallocate to the highest-return lane.",
    signals: ["runway", "gross margin", "burn multiple", "budget variance", "AR aging"],
    ask: "What minimum runway target are we protecting?",
    frame: ["Protect runway first.", "Find the biggest variance drivers or leakage sources.", "Reallocate capital toward the highest-confidence return path."],
    lenses: {
      growth: "Growth is only healthy if payback and margin structure stay defensible.",
      cost: "Cost reduction should separate waste from capability.",
      forecast: "Forecast quality lives at the driver level, not the spreadsheet level.",
    },
  },
  sage: {
    domain: "strategy and executive decisions",
    greeting: "What decision are we trying to make, and over what horizon?",
    heuristic: "A strategy is only useful if it changes priorities and resource allocation.",
    signals: ["initiative progress", "market uncertainty", "option value", "execution risk"],
    ask: "What decision horizon should I optimize for: 90 days or 12 months?",
    frame: ["Set the objective and constraints.", "Model base, upside, and downside cases.", "Choose the move with the best impact-to-risk profile."],
    lenses: {
      planning: "Decision quality depends on scenario clarity, not slide depth.",
      competition: "Strategic advantage often comes from where competitors are structurally slow.",
    },
  },
  chronos: {
    domain: "scheduling and focus management",
    greeting: "What should we fix first: meeting load, scheduling conflicts, or protected focus time?",
    heuristic: "Calendar chaos is usually a prioritization problem wearing a scheduling mask.",
    signals: ["meeting hours", "context switching", "focus block erosion", "schedule conflicts"],
    ask: "Which team is losing the most focus time right now?",
    frame: ["Measure meeting load and interruptions.", "Protect deep-work windows.", "Rebuild cadence around only the highest-value ceremonies."],
    lenses: {
      scheduling: "The goal is not fitting more in; it is protecting the right work at the right energy level.",
      focus: "A fragmented calendar makes a team look busy while shipping slower.",
    },
  },
  atlas: {
    domain: "workflow reliability and runbooks",
    greeting: "Where is execution breaking down today: handoffs, queues, or runbook reliability?",
    heuristic: "If a workflow cannot be replayed safely, it is not production-ready.",
    signals: ["queue health", "handoff failures", "retries", "dead letters", "throughput"],
    ask: "Which workflow is currently blocking execution most often?",
    frame: ["Map the bottleneck step and owner.", "Define the checkpoint, SLA, and rollback point.", "Automate only what can be observed and replayed safely."],
    lenses: {
      automation: "Automation should remove ambiguity, not bury it.",
      reliability: "Retries hide issues unless failure reasons are explicit and measurable.",
    },
  },
  scribe: {
    domain: "knowledge systems",
    greeting: "Should we improve discovery, documentation quality, or auditability first?",
    heuristic: "If knowledge is hard to find, it may as well not exist.",
    signals: ["retrieval success", "duplicate docs", "stale content", "coverage gaps"],
    ask: "Do you want this optimized for recall speed or auditability?",
    frame: ["Capture the source artifacts.", "Structure them with owners, tags, and decisions.", "Make retrieval citation-backed and reusable."],
    lenses: {
      docs: "The goal is not more documents; it is faster, more reliable reuse.",
      retrieval: "Search quality depends on structure, tags, and source integrity.",
    },
  },
  sentinel: {
    domain: "security operations",
    greeting: "What needs attention first: threat containment, posture risk, or compliance exposure?",
    heuristic: "Contain the highest-risk path first, then deepen the investigation.",
    signals: ["blast radius", "account takeover risk", "misconfigurations", "containment time"],
    ask: "Are you most concerned about identity abuse, data leakage, or infrastructure drift?",
    frame: ["Rank exposure by blast radius.", "Contain the highest-risk path first.", "Codify the response and verification steps."],
    lenses: {
      risk: "Containment speed matters more than perfect attribution in the first phase.",
      posture: "Security posture weakens most at identity, secrets, and third-party trust boundaries.",
    },
  },
  compass: {
    domain: "market intelligence",
    greeting: "Do you want a read on competitors, demand shifts, or whitespace opportunities?",
    heuristic: "Market signals matter when they change positioning, pricing, or timing.",
    signals: ["pricing shifts", "new launches", "hiring patterns", "messaging changes"],
    ask: "Do you want offensive opportunities or defensive alerts first?",
    frame: ["Separate signal from noise by source confidence.", "Map the change to your buyers or positioning.", "Translate the signal into an immediate play."],
    lenses: {
      market: "The strongest insights tie trends to timing, buyers, and channel dynamics.",
      competition: "The goal is not to copy moves; it is to understand what they reveal.",
    },
  },
  part: {
    domain: "partnerships and ecosystem growth",
    greeting: "Should we focus on finding new partners, activating current ones, or improving partner ROI?",
    heuristic: "Partner quality matters more than top-of-funnel partner volume.",
    signals: ["partner fit", "activation rate", "sourced revenue", "influenced pipeline"],
    ask: "Are you prioritizing strategic alliances or revenue-driving partners?",
    frame: ["Score partner fit and leverage.", "Sequence outreach and qualification.", "Track activation and revenue contribution early."],
    lenses: {
      sourcing: "Partner quality matters more than top-of-funnel partner volume.",
      activation: "The first 30 days decide whether a partnership becomes real or stays conceptual.",
    },
  },
  pulse: {
    domain: "people operations and organizational health",
    greeting: "What needs attention first: hiring, engagement, performance, or retention risk?",
    heuristic: "People risk often shows up in manager quality and workload balance before attrition.",
    signals: ["engagement trend", "attrition risk", "manager load", "promotion readiness", "burnout risk"],
    ask: "Which org should we assess first for burnout or attrition risk?",
    frame: ["Detect risk in sentiment, workload, and retention signals.", "Prioritize manager interventions.", "Track follow-through and impact."],
    lenses: {
      engagement: "Survey scores matter less than trend direction and manager follow-through.",
      talent: "Hiring quality improves when role design is precise before sourcing starts.",
      performance: "Development systems work when feedback, goals, and growth paths reinforce each other.",
    },
  },
  merchant: {
    domain: "commerce and merchandising",
    greeting: "Are we trying to improve margin, conversion, or inventory movement?",
    heuristic: "Revenue pressure usually starts with merchandising clarity, pricing posture, or checkout friction.",
    signals: ["AOV", "conversion rate", "inventory turnover", "return rate", "margin", "days on hand"],
    ask: "Are you optimizing for margin, volume, or inventory clearance?",
    frame: ["Check inventory and margin risk together.", "Tune pricing or promotions by elasticity and demand.", "Fix funnel friction and fulfillment leakage."],
    lenses: {
      pricing: "Price changes should consider elasticity, competitor position, and inventory pressure together.",
      conversion: "Conversion gains usually come from offer clarity, trust, and checkout friction reduction.",
      inventory: "Inventory health is a strategy signal, not just an ops metric.",
    },
  },
  canvas: {
    domain: "creative generation and visual production",
    greeting: "Do you need net-new concepts, ad variants, or a richer visual system?",
    heuristic: "Good creative starts with audience tension, not just aesthetics.",
    signals: ["hook strength", "format fit", "brand consistency", "variant fatigue", "creative velocity"],
    ask: "Do you need net-new concepts or optimized variants from existing assets?",
    frame: ["Lock the creative objective and audience tension.", "Generate the first concept or variant set by channel.", "Measure winners and scale the strongest direction."],
    lenses: {
      creative: "A strong asset creates an immediate point of view and emotional direction.",
      performance: "Performance creative should trade abstraction for speed of comprehension.",
      brand: "Consistency matters, but sameness kills attention.",
    },
  },
  inspect: {
    domain: "quality assurance and release readiness",
    greeting: "What matters more right now: release confidence, defect prevention, or coverage quality?",
    heuristic: "Quality confidence comes from critical path coverage, not raw test volume.",
    signals: ["pass rate", "critical defects", "coverage by module", "flaky tests", "release blockers"],
    ask: "Is release confidence or defect reduction your immediate priority?",
    frame: ["Identify the critical quality risks.", "Run focused regression and readiness gates.", "Cluster defects and close systemic causes."],
    lenses: {
      release: "Readiness should combine severity, coverage, performance, and risk concentration.",
      defects: "Root-cause quality matters more than defect count alone.",
    },
  },
  veritas: {
    domain: "legal and compliance operations",
    greeting: "Should we optimize for deal speed, compliance confidence, or risk reduction?",
    heuristic: "The biggest legal risk often hides in one-sided clauses, vague obligations, or silent renewals.",
    signals: ["risk concentration", "expiring obligations", "regulatory exposure", "clause deviations"],
    ask: "Should we optimize for deal speed or risk minimization on this matter?",
    frame: ["Surface the highest-risk clauses or obligations.", "Map regulatory exposure and ownership.", "Define mitigation and approval path."],
    lenses: {
      contracts: "The real question is whether the risk is justified by the commercial upside.",
      compliance: "Regulatory risk gets expensive when ownership and evidence are unclear.",
    },
  },
};

const LOCAL_INDUSTRY_MATCHERS = {
  ecommerce: [/shopify|e-?commerce|online store|retail|consumer product|dtc|direct to consumer/i],
  services: [/services|agency|consulting|consultancy|professional services|freelance/i],
  saas: [/saas|software|b2b software|platform|app|subscription/i],
  creator: [/creator|influencer|content creator|social media influencer|personal brand/i],
  regulated: [/regulated|health|healthcare|ndis|medical|finance|fintech|legal|compliance|hipaa|gdpr/i],
};

const LOCAL_AGENT_INDUSTRY_OVERLAYS = {
  ecommerce: {
    nexus: "For Nexus, ecommerce pressure usually appears between demand generation, merchandising, inventory, fulfillment, and support.",
    maestro: "For Maestro in ecommerce, the main read is how creative, offer, and landing-page friction interact with CAC and conversion.",
    prospect: "For Prospect in ecommerce, the best opportunities are often wholesale, affiliate, channel, or partner-led pipeline.",
    "support-sage": "For Support Sage in ecommerce, returns, shipping friction, and expectation-setting usually drive ticket load.",
    centsible: "For Centsible in ecommerce, contribution after ad spend, refund drag, and inventory carrying cost matter more than topline revenue alone.",
    sage: "For Sage in ecommerce, the strategic question is where merchandising, pricing, and retention create durable advantage.",
    chronos: "For Chronos in ecommerce, launch calendars and promo peaks create bursty workload that needs protection.",
    atlas: "For Atlas in ecommerce, brittle points usually sit in order ops, fulfillment handoffs, returns, and campaign-to-stock coordination.",
    scribe: "For Scribe in ecommerce, the highest-value memory is usually merchandising, launch, support, and returns SOPs.",
    sentinel: "For Sentinel in ecommerce, payment fraud, account takeover, and promo abuse are recurring risk lanes.",
    compass: "For Compass in ecommerce, price moves, assortment shifts, and merchandising patterns are the most revealing signals.",
    part: "For Part in ecommerce, affiliate, marketplace, retail, and tech partners matter when they reduce CAC or expand distribution.",
    pulse: "For Pulse in ecommerce, burnout often clusters around launches, support spikes, and fulfillment strain.",
    merchant: "For Merchant in ecommerce, margin, conversion, AOV, return rate, and inventory turnover have to be read together.",
    canvas: "For Canvas in ecommerce, strong creative leads with product truth, buying tension, and fast mobile comprehension.",
    inspect: "For Inspect in ecommerce, release risk concentrates around checkout, payment, promo logic, catalog integrity, and fulfillment flows.",
    veritas: "For Veritas in ecommerce, refund terms, privacy, payments, and marketplace obligations usually dominate risk.",
  },
  services: {
    nexus: "For Nexus, services businesses usually need tight coordination between pipeline, utilization, delivery quality, and staffing capacity.",
    maestro: "For Maestro in services, positioning clarity, proof, and lead quality usually matter more than cheap volume.",
    prospect: "For Prospect in services, speed-to-meeting only matters if fit and commercial intent stay high.",
    "support-sage": "For Support Sage in services, expectation gaps, scope confusion, and slow follow-through often drive dissatisfaction.",
    centsible: "For Centsible in services, margin depends on utilization, pricing discipline, scope control, and collections.",
    sage: "For Sage in services, advantage usually comes from specialization, packaging, and delivery leverage.",
    chronos: "For Chronos in services, calendar sprawl and context switching often erode billable or high-value work.",
    atlas: "For Atlas in services, intake, delivery, approvals, and renewals are usually the critical workflows.",
    scribe: "For Scribe in services, reusable discovery notes, proposals, and delivery playbooks create leverage fast.",
    sentinel: "For Sentinel in services, client data exposure and permissions sprawl are common practical risks.",
    compass: "For Compass in services, packaging changes, repositioning, and demand shifts in target sectors are the best clues.",
    part: "For Part in services, referral partners and complementary alliances often create the best-fit pipeline.",
    pulse: "For Pulse in services, burnout usually follows overload, weak scoping, and manager capacity issues.",
    merchant: "For Merchant in services, offer packaging and productization matter more than physical inventory dynamics.",
    canvas: "For Canvas in services, trust, proof, and credibility usually outperform style for style's sake.",
    inspect: "For Inspect in services, quality should measure delivery consistency and client-facing failure points.",
    veritas: "For Veritas in services, SOW scope, liability boundaries, payment terms, and IP ownership are recurring pressure points.",
  },
  saas: {
    nexus: "For Nexus, SaaS execution usually depends on clean handoffs across acquisition, activation, product, support, and expansion.",
    maestro: "For Maestro in SaaS, CAC pressure usually traces back to ICP mismatch, onboarding friction, or weak value communication.",
    prospect: "For Prospect in SaaS, pipeline quality rises when urgency, pain specificity, and buying committee fit are clear.",
    "support-sage": "For Support Sage in SaaS, repeat tickets often point to onboarding gaps, product friction, or poor expectation-setting.",
    centsible: "For Centsible in SaaS, efficient growth is usually read through payback, retention, expansion, and burn discipline.",
    sage: "For Sage in SaaS, moat usually comes from distribution, retention, product wedge, and learning speed.",
    chronos: "For Chronos in SaaS, meeting bloat tends to crowd out product focus and deep execution time.",
    atlas: "For Atlas in SaaS, brittleness often shows up in onboarding, lifecycle automation, release workflows, and incident response.",
    scribe: "For Scribe in SaaS, docs, release notes, support knowledge, and product decision records compound leverage.",
    sentinel: "For Sentinel in SaaS, identity, secrets, tenant isolation, and third-party integrations are recurring exposure points.",
    compass: "For Compass in SaaS, launches, pricing changes, hiring patterns, and positioning shifts are the best signals.",
    part: "For Part in SaaS, integration partners, co-selling, and channel alliances can materially shift distribution.",
    pulse: "For Pulse in SaaS, attrition risk often starts in manager quality, roadmap churn, and sustained release pressure.",
    merchant: "For Merchant in SaaS, packaging, trial activation, and upgrade motion often behave like merchandising decisions.",
    canvas: "For Canvas in SaaS, clarity of pain, value, and proof usually beats abstract brand language.",
    inspect: "For Inspect in SaaS, quality confidence should center on auth, billing, core workflows, and release regressions.",
    veritas: "For Veritas in SaaS, data processing, privacy, security commitments, and enterprise terms usually dominate risk.",
  },
  creator: {
    nexus: "For Nexus, creator businesses usually depend on coordination between content production, audience growth, monetization, and brand operations.",
    maestro: "For Maestro in creator businesses, consistency, hooks, audience resonance, and monetization fit matter together.",
    prospect: "For Prospect in creator businesses, sponsors, partnerships, and high-fit deals matter more than traditional outbound volume.",
    "support-sage": "For Support Sage in creator businesses, member, merch, and community support quality shapes trust quickly.",
    centsible: "For Centsible in creator businesses, revenue concentration risk and monetization diversity matter a lot.",
    sage: "For Sage in creator businesses, the strategic question is usually how to turn attention into owned channels and durable revenue.",
    chronos: "For Chronos in creator businesses, production cadence and creative energy management matter as much as scheduling efficiency.",
    atlas: "For Atlas in creator businesses, publishing workflows, approvals, sponsorship delivery, and asset reuse are core systems.",
    scribe: "For Scribe in creator businesses, reusable content frameworks, sponsor notes, and audience insights become high-value memory.",
    sentinel: "For Sentinel in creator businesses, impersonation, account compromise, and brand abuse are frequent risks.",
    compass: "For Compass in creator businesses, platform shifts, format changes, and audience behavior changes are the most important signals.",
    part: "For Part in creator businesses, sponsors, affiliates, and brand deals are the obvious leverage points.",
    pulse: "For Pulse in creator businesses, burnout often shows up through production fatigue and constant context switching.",
    merchant: "For Merchant in creator businesses, merch, bundles, and launch timing often matter more than catalog breadth.",
    canvas: "For Canvas in creator businesses, distinct voice and repeatable visual identity matter more than polished sameness.",
    inspect: "For Inspect in creator businesses, quality means consistency, platform fit, and avoiding preventable publishing errors.",
    veritas: "For Veritas in creator businesses, sponsorship terms, disclosures, usage rights, and IP boundaries matter most.",
  },
  regulated: {
    nexus: "For Nexus, regulated businesses need approvals, evidence, and escalation paths designed into execution from the start.",
    maestro: "For Maestro in regulated businesses, speed only works if claims, disclosures, and review requirements are explicit up front.",
    prospect: "For Prospect in regulated businesses, outreach quality depends on compliant messaging and the right qualification boundaries.",
    "support-sage": "For Support Sage in regulated businesses, documentation quality and escalation discipline are part of service quality.",
    centsible: "For Centsible in regulated businesses, financial decisions need to account for auditability, reporting obligations, and control maturity.",
    sage: "For Sage in regulated businesses, strategic options should be weighed against approval friction and compliance load.",
    chronos: "For Chronos in regulated businesses, reviews and approvals can dominate calendars unless cadence is designed intentionally.",
    atlas: "For Atlas in regulated businesses, workflows need checkpoints, evidence capture, and deterministic rollback paths.",
    scribe: "For Scribe in regulated businesses, citations, version control, and audit-ready documentation are central requirements.",
    sentinel: "For Sentinel in regulated businesses, policy alignment, evidence trails, and reporting obligations are core constraints.",
    compass: "For Compass in regulated businesses, regulatory shifts and competitor compliance posture are often the most important signals.",
    part: "For Part in regulated businesses, partner diligence and compliance fit matter as much as commercial upside.",
    pulse: "For Pulse in regulated businesses, policy acknowledgment, training coverage, and manager consistency matter alongside engagement.",
    merchant: "For Merchant in regulated businesses, product claims, listing accuracy, and policy-safe promotions matter as much as conversion.",
    canvas: "For Canvas in regulated businesses, creative has to balance persuasion with approval-safe language and disclosures.",
    inspect: "For Inspect in regulated businesses, quality means evidence-backed gates, traceability, and explicit release criteria.",
    veritas: "For Veritas in regulated businesses, ownership, evidence, and policy alignment determine whether risk stays manageable.",
  },
};

const inferLocalIndustryLabel = (profile = null) => {
  if (!profile || typeof profile !== "object") return "";
  const hay = `${profile.industry || ""} ${profile.business_model || ""} ${profile.offerings || ""} ${profile.compliance_requirements || ""} ${profile.notes_for_agents || ""}`.toLowerCase();
  return Object.entries(LOCAL_INDUSTRY_MATCHERS).find(([, matchers]) => matchers.some((rx) => rx.test(hay)))?.[0] || "";
};

const summarizeBusinessContext = (profile = null, agentId = "") => {
  if (!profile || typeof profile !== "object") {
    return { identity: "", strategy: "", risk: "", references: "", overlay: "", offer: "", audience: "", channels: "", economics: "", brand: "", ops: "" };
  }
  const identity = [profile.company_name, profile.industry, profile.business_model, profile.stage].filter(Boolean).join(" | ");
  const sharedRefs = Array.isArray(profile.reference_assets) ? profile.reference_assets : [];
  const industryLabel = inferLocalIndustryLabel(profile);
  const overlay = industryLabel ? (LOCAL_AGENT_INDUSTRY_OVERLAYS[industryLabel]?.[agentId] || "") : "";
  const offer = [profile.value_proposition, profile.offerings].filter(Boolean).join(" ");
  const audience = [profile.ideal_customer_profile, profile.audience_personas].filter(Boolean).join(" ");
  const channels = [profile.preferred_channels, profile.service_areas].filter(Boolean).join(" | ");
  const economics = [profile.budget_marketing_monthly ? `marketing budget ${profile.budget_marketing_monthly}` : "", profile.budget_ops_monthly ? `ops budget ${profile.budget_ops_monthly}` : "", profile.kpis ? `KPIs ${profile.kpis}` : ""].filter(Boolean).join(" | ");
  const brand = [profile.brand_voice, profile.brand_keywords, profile.brand_colors].filter(Boolean).join(" | ");
  const ops = [profile.tools_and_integrations, profile.approval_rules, profile.notes_for_agents].filter(Boolean).join(" | ");
  return {
    identity: identity ? `Business context: ${identity}.` : "",
    strategy: profile.core_goals_90d ? `Priority: ${profile.core_goals_90d}.` : "",
    risk: profile.compliance_requirements ? `Constraints: ${profile.compliance_requirements}.` : "",
    references: sharedRefs.length ? `Shared references: ${sharedRefs.slice(0, 3).map((asset) => asset?.role_label ? `${asset.role_label} (${asset.name})` : asset?.name).filter(Boolean).join(", ")}.` : "",
    overlay,
    offer: offer ? `Offer and positioning: ${offer}.` : "",
    audience: audience ? `Audience focus: ${audience}.` : "",
    channels: channels ? `Channels and markets: ${channels}.` : "",
    economics: economics ? `Commercial guardrails: ${economics}.` : "",
    brand: brand ? `Brand direction: ${brand}.` : "",
    ops: ops ? `Operating notes: ${ops}.` : "",
  };
};

const summarizeAgentBusinessFocus = (agentId = "", businessContext = {}) => {
  const key = String(agentId || "").toLowerCase().replace(/\s+/g, "-");
  const focusByAgent = {
    nexus: [businessContext.strategy, businessContext.audience, businessContext.channels, businessContext.ops],
    maestro: [businessContext.offer, businessContext.audience, businessContext.channels, businessContext.brand],
    prospect: [businessContext.audience, businessContext.offer, businessContext.channels, businessContext.economics],
    centsible: [businessContext.strategy, businessContext.economics, businessContext.risk, businessContext.ops],
    pulse: [businessContext.strategy, businessContext.ops, businessContext.risk],
    merchant: [businessContext.offer, businessContext.audience, businessContext.channels, businessContext.economics],
    veritas: [businessContext.risk, businessContext.ops, businessContext.strategy],
    canvas: [businessContext.brand, businessContext.offer, businessContext.audience, businessContext.references],
    sage: [businessContext.strategy, businessContext.economics, businessContext.audience],
    atlas: [businessContext.ops, businessContext.strategy, businessContext.channels],
    chronos: [businessContext.strategy, businessContext.ops],
    compass: [businessContext.audience, businessContext.channels, businessContext.offer],
    part: [businessContext.audience, businessContext.channels, businessContext.offer],
    inspect: [businessContext.offer, businessContext.audience, businessContext.ops],
    "support-sage": [businessContext.audience, businessContext.offer, businessContext.ops],
    scribe: [businessContext.ops, businessContext.strategy, businessContext.offer],
    sentinel: [businessContext.risk, businessContext.ops, businessContext.channels],
  };
  return (focusByAgent[key] || [businessContext.offer, businessContext.audience, businessContext.strategy]).filter(Boolean).slice(0, 3).join(" ");
};

const buildBusinessProfilePromptContext = (profile = null, agentId = "") => {
  const summary = summarizeBusinessContext(profile, agentId);
  const lines = [
    summary.identity,
    summary.offer,
    summary.audience,
    summary.strategy,
    summary.channels,
    summary.economics,
    summary.brand,
    summary.risk,
    summary.ops,
    summary.overlay,
    summary.references,
  ].filter(Boolean);
  return lines.length ? `\n\nBusiness Profile Context:\n${lines.join("\n")}` : "";
};

const pickLocalSpecialtyLens = (agentId, text = "") => {
  const knowledge = LOCAL_CHAT_KNOWLEDGE[agentId] || LOCAL_CHAT_KNOWLEDGE.nexus;
  const t = String(text || "").toLowerCase();
  if (/campaign|ads|creative|copy|landing|roas|cpa|ctr/.test(t)) return knowledge.lenses?.campaign || knowledge.lenses?.creative || knowledge.lenses?.performance || "";
  if (/brand|position|messag|awareness/.test(t)) return knowledge.lenses?.brand || "";
  if (/retention|lifecycle|email|crm/.test(t)) return knowledge.lenses?.retention || knowledge.lenses?.engagement || "";
  if (/outreach|sequence|reply|meeting/.test(t)) return knowledge.lenses?.outreach || "";
  if (/pipeline|forecast|deal/.test(t)) return knowledge.lenses?.pipeline || knowledge.lenses?.forecast || "";
  if (/cost|expense|spend/.test(t)) return knowledge.lenses?.cost || "";
  if (/growth/.test(t)) return knowledge.lenses?.growth || "";
  if (/risk|threat|incident|breach/.test(t)) return knowledge.lenses?.risk || knowledge.lenses?.incidents || knowledge.lenses?.posture || "";
  if (/schedule|meeting|calendar|focus/.test(t)) return knowledge.lenses?.scheduling || knowledge.lenses?.focus || "";
  if (/workflow|runbook|handoff|queue|reliability/.test(t)) return knowledge.lenses?.automation || knowledge.lenses?.reliability || "";
  if (/docs|knowledge|search|retrieve/.test(t)) return knowledge.lenses?.docs || knowledge.lenses?.retrieval || "";
  if (/market|trend|competitor|positioning/.test(t)) return knowledge.lenses?.market || knowledge.lenses?.competition || "";
  if (/partner|alliance|ecosystem/.test(t)) return knowledge.lenses?.sourcing || knowledge.lenses?.activation || "";
  if (/people|team|burnout|attrition|manager|engagement/.test(t)) return knowledge.lenses?.engagement || knowledge.lenses?.performance || "";
  if (/hire|candidate|recruit|job/.test(t)) return knowledge.lenses?.talent || "";
  if (/pricing|price/.test(t)) return knowledge.lenses?.pricing || "";
  if (/conversion|checkout|cart/.test(t)) return knowledge.lenses?.conversion || "";
  if (/inventory|stock|warehouse/.test(t)) return knowledge.lenses?.inventory || "";
  if (/release|deploy|launch|test|coverage|defect|bug/.test(t)) return knowledge.lenses?.release || knowledge.lenses?.defects || "";
  if (/contract|msa|nda|sow|clause|privacy|gdpr/.test(t)) return knowledge.lenses?.contracts || knowledge.lenses?.compliance || "";
  return Object.values(knowledge.lenses || {})[0] || "";
};

const buildLocalSpecialtySummary = (agentId, text = "", ranked = []) => {
  const knowledge = LOCAL_CHAT_KNOWLEDGE[agentId] || LOCAL_CHAT_KNOWLEDGE.nexus;
  const top = (ranked || []).filter((x) => x.score > 0).slice(0, 2).map((x) => x.item?.label || x.cap?.label).filter(Boolean);
  return {
    relevance: top.length
      ? `From a ${knowledge.domain} perspective, the highest-leverage lanes here are ${top.join(" and ")}.`
      : `From a ${knowledge.domain} perspective, I would anchor this around the strongest signal first.`,
    lens: pickLocalSpecialtyLens(agentId, text),
    signals: knowledge.signals?.length ? `Signals I would watch here: ${knowledge.signals.slice(0, 4).join(", ")}.` : "",
    heuristic: knowledge.heuristic ? `A useful rule here: ${knowledge.heuristic}` : "",
  };
};

const buildLocalCapabilityGuidance = (ranked = []) => {
  const top = (ranked || []).filter((x) => x.score > 0).slice(0, 3).map((x) => x.item).filter(Boolean);
  return {
    actionsLine: top.length ? `Concrete capabilities I would lean on here: ${top.map((item) => `${item.label} (${item.action})`).join("; ")}.` : "",
    executionPath: top[0] ? `My first execution move would likely be ${top[0].label} via ${top[0].action}.` : "",
  };
};

const getSharedReferenceAssets = (profile = null, memory = null) => {
  const shared = Array.isArray(profile?.reference_assets) ? profile.reference_assets : [];
  const local = Array.isArray(memory?.asset_refs) ? memory.asset_refs : [];
  return Array.from(new Map([...shared, ...local].map((asset) => [asset?.id, asset])).values()).filter(Boolean).slice(0, 24);
};

const readLocalChatMemory = (agentId) => {
  try {
    const raw = localStorage.getItem(`${CHAT_MEMORY_KEY_PREFIX}.${agentId}`);
    return raw ? JSON.parse(raw) : { priorities: [], concerns: [], preferences: [], asset_refs: [], decision_log: [], diagnosis_log: [], playbooks: [], default_playbook_id: "", updated_at: "" };
  } catch {
    return { priorities: [], concerns: [], preferences: [], asset_refs: [], decision_log: [], diagnosis_log: [], playbooks: [], default_playbook_id: "", updated_at: "" };
  }
};

const inferLocalMemory = (text = "") => {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const priorities = [];
  const concerns = [];
  const preferences = [];
  const priorityMatch = raw.match(/(?:need|want|trying|goal is to|priority is to)\s+(.+?)(?:\.|,|$)/i);
  if (priorityMatch?.[1]) priorities.push(priorityMatch[1].trim());
  [
    ["cac", /cac|cost per acquisition|cost to acquire/],
    ["retention", /retention|churn|renewal/],
    ["runway", /runway|cash flow|burn rate/],
    ["inventory", /inventory|stock|overstock|stockout/],
    ["compliance", /compliance|gdpr|audit|privacy|regulation/],
    ["burnout", /burnout|attrition|engagement|morale/],
    ["quality", /quality|release|bug|defect|coverage|test/],
  ].forEach(([label, rx]) => {
    if (rx.test(t)) concerns.push(label);
  });
  if (/plan first|show me a plan|ask for a plan/.test(t)) preferences.push("plan-first");
  if (/analysis only|just analyze/.test(t)) preferences.push("analysis-only");
  if (/go ahead|run it|execute|ship it/.test(t)) preferences.push("execute-fast");
  return { priorities, concerns, preferences };
};

const mergeLocalMemory = (current = {}, delta = {}) => ({
  priorities: Array.from(new Set([...(current.priorities || []), ...(delta.priorities || [])])).slice(0, 5),
  concerns: Array.from(new Set([...(current.concerns || []), ...(delta.concerns || [])])).slice(0, 5),
  preferences: Array.from(new Set([...(current.preferences || []), ...(delta.preferences || [])])).slice(0, 5),
  asset_refs: Array.from(new Map([...(current.asset_refs || []), ...(delta.asset_refs || [])].map((asset) => [asset?.id, asset])).values()).filter(Boolean).slice(0, 24),
  decision_log: Array.isArray(current.decision_log) ? current.decision_log.slice(0, 12) : [],
  diagnosis_log: Array.isArray(current.diagnosis_log) ? current.diagnosis_log.slice(0, 12) : [],
  playbooks: Array.isArray(current.playbooks) ? current.playbooks.slice(0, 24) : [],
  default_playbook_id: String(current.default_playbook_id || delta.default_playbook_id || "").trim(),
  updated_at: new Date().toISOString(),
});

const summarizeLocalMemory = (memory = null) => ({
  priorities: memory?.priorities?.length ? `I remember your priorities: ${memory.priorities.slice(0, 2).join("; ")}.` : "",
  concerns: memory?.concerns?.length ? `Recurring themes: ${memory.concerns.slice(0, 4).join(", ")}.` : "",
  preferences: memory?.preferences?.length ? `Working style: ${memory.preferences.slice(0, 3).join(", ")}.` : "",
  references: memory?.asset_refs?.length ? `Reference assets on hand: ${memory.asset_refs.slice(0, 3).map((asset) => asset.role_label ? `${asset.role_label} (${asset.name})` : asset.name).join(", ")}.` : "",
});

const buildLocalMemoryNarrative = (memory = null) => {
  const parts = [];
  if (Array.isArray(memory?.priorities) && memory.priorities.length) {
    parts.push(`I’m keeping ${memory.priorities.slice(0, 2).join(" and ")} in view`);
  }
  if (Array.isArray(memory?.concerns) && memory.concerns.length) {
    parts.push(`I’m also noticing a pattern around ${memory.concerns.slice(0, 3).join(", ")}`);
  }
  if (Array.isArray(memory?.preferences) && memory.preferences.length) {
    parts.push(`and I know you prefer ${memory.preferences.slice(0, 2).join(" and ")}`);
  }
  if (Array.isArray(memory?.asset_refs) && memory.asset_refs.length) {
    parts.push(`with ${memory.asset_refs.slice(0, 2).map((asset) => asset?.role_label ? `${asset.role_label} (${asset.name})` : asset?.name).filter(Boolean).join(" and ")} available as reference`);
  }
  if (!parts.length) return "";
  return `${parts.join(", ")}.`;
};

const buildLocalLightGreeting = ({ agentName = "Agent", style = {}, knowledge = {}, businessContext = {}, memoryNarrative = "" } = {}) => {
  const opener = style.toneOpen || "Ready when you are.";
  const strippedOpener = String(opener)
    .replace(/^I am\s+/i, "")
    .replace(/^I['’]m\s+/i, "")
    .replace(/^I'll\s+/i, "")
    .replace(/\.$/, "")
    .trim();
  const offers = {
    nexus: "I can help sort the moving parts and pick the cleanest path forward.",
    maestro: "I can help shape the offer, audience, and next move.",
    prospect: "I can help tighten the target and build the outreach path.",
    "support-sage": "I can help untangle the issue and get to the fastest resolution path.",
    centsible: "I can help frame the decision and pressure-test the numbers behind it.",
    sage: "I can help sort the tradeoffs and define the strongest path.",
    chronos: "I can help find the scheduling pressure and clean up the cadence.",
    atlas: "I can help map the bottleneck and tighten the workflow.",
    scribe: "I can help capture what matters and make it easier to reuse.",
    sentinel: "I can help sort the exposure and decide what needs attention first.",
    compass: "I can help separate the market signal from the noise.",
    part: "I can help map the right partnership angle and next move.",
    pulse: "I can help read the people signals and decide what needs attention first.",
    merchant: "I can help sort the commercial pressure and choose the next lever.",
    canvas: "I can help shape the creative direction and turn it into assets.",
    inspect: "I can help figure out where confidence is weak and what to fix first.",
    veritas: "I can help make the risk clear and keep the path usable.",
  };
  const normalizedAgentId = String(agentName || "").toLowerCase();
  const asks = {
    nexus: "What are you trying to get done right now?",
    maestro: "What are we trying to move right now?",
    centsible: "What decision are you trying to make right now?",
    veritas: "What do you need help moving or de-risking right now?",
  };
  const ask = asks[normalizedAgentId] || knowledge.greeting || style.nextAsk || "What are you trying to get done right now?";
  return `${agentName}: ${strippedOpener ? `${strippedOpener}. ` : ""}${ask} ${offers[normalizedAgentId] || "I can help make sense of it and take it forward with you."}`.replace(/\s+/g, " ").trim();
};

const buildLocalHelpReply = ({ agentName = "Agent", style = {}, knowledge = {}, businessContext = {}, memoryNarrative = "", capability = {}, quickLine = "", taskHint = "", constraintHint = "" } = {}) => {
  return `${agentName}: I can think this through with you, help you choose a path, and step in to execute when it makes sense. My lens here is ${knowledge.domain || "the work in front of us"}. ${capability.actionsLine || ""} ${quickLine || ""} ${taskHint || ""} ${constraintHint || ""} ${pickLocalFollowUp(style.helpAsk, [knowledge.ask, knowledge.prompt])}`.replace(/\s+/g, " ").trim();
};

const buildLocalExplorationReply = ({ style = {}, knowledge = {}, specialty = {} } = {}) =>
  [
    pickLocalLead(
      "Let's open it up a bit first.",
      "Before we jump to a tactic, I'd narrow the real constraint.",
      "The right first move is usually to define the problem more tightly."
    ),
    specialty.lens || `From a ${knowledge.domain || specialty.domain || "business"} perspective, I'd start by identifying the pressure point before choosing a move.`,
    specialty.signals || "",
    pickLocalFollowUp(style.helpAsk, [knowledge.ask, knowledge.prompt, style.nextAsk]),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

const isLocalSmallTalkPrompt = (text = "") => /^(how are you|how was your day|how's your day|how is your day|what'?s up|whats up|sup|good morning|good afternoon|good evening|thanks|thank you)\b/i.test(String(text || "").trim());

const buildLocalSmallTalkReply = (agentName = "Agent", text = "") => {
  const raw = String(text || "").trim().toLowerCase();
  if (/^how are you|how was your day|how's your day|how is your day/.test(raw)) {
    return `${agentName}: Doing well. I’m here and ready to help. What are you working through right now?`;
  }
  if (/^thanks|^thank you/.test(raw)) {
    return `${agentName}: Anytime. What do you want to tackle next?`;
  }
  if (/^good morning|^good afternoon|^good evening/.test(raw)) {
    return `${agentName}: Hi. Good to see you. What do you want to work on?`;
  }
  return `${agentName}: I’m here with you. What do you want to dig into?`;
};

const fileToDataUrl = (file) =>
  new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    } catch {
      resolve("");
    }
  });

const inferUploadCategory = (fileName = "", mime = "") => {
  const lowerName = String(fileName || "").toLowerCase();
  const lowerMime = String(mime || "").toLowerCase();
  if (lowerMime.startsWith("image/")) {
    if (/logo|wordmark|brandmark|icon/.test(lowerName)) return "logo";
    if (/product|packshot|mockup/.test(lowerName)) return "product_image";
    return "image";
  }
  if (lowerMime.startsWith("video/")) return "video";
  if (lowerMime.includes("pdf")) return "document";
  if (/sheet|csv|xls/.test(lowerName) || /spreadsheet/.test(lowerMime)) return "spreadsheet";
  return "document";
};

const inferAssetRoleFromText = (text = "") => {
  const t = String(text || "").toLowerCase();
  if (!/(this|it'?s|it is|that|uploaded|save|store|use this|use that|reference this|reference that)/.test(t)) return null;
  if (/(business|brand|company)\s+logo|logo for (my|our) business|our logo|my logo/.test(t)) return { role: "business_logo", role_label: "Business Logo" };
  if (/brand guide|brand guideline|visual identity/.test(t)) return { role: "brand_guideline", role_label: "Brand Guideline" };
  if (/product photo|product image|packshot/.test(t)) return { role: "product_reference", role_label: "Product Reference" };
  if (/headshot|founder photo|team photo/.test(t)) return { role: "brand_persona", role_label: "Brand Persona" };
  return null;
};

const appendLocalTimelineEntry = (items = [], entry = {}) => [normalizeTimelineEntry({ id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), ...entry }), ...(items || []).map(normalizeTimelineEntry)].slice(0, 12);

const summarizeLocalChange = (memory = null) => {
  const decisions = Array.isArray(memory?.decision_log) ? memory.decision_log : [];
  const diagnoses = Array.isArray(memory?.diagnosis_log) ? memory.diagnosis_log : [];
  const currentDecision = decisions[0];
  const previousDecision = decisions[1];
  const currentDiagnosis = diagnoses[0];
  const previousDiagnosis = diagnoses[1];
  let decision = "";
  let diagnosis = "";
  if (currentDecision && previousDecision) {
    decision = currentDecision.title !== previousDecision.title
      ? `Decision changed from "${previousDecision.title}" to "${currentDecision.title}".`
      : `Decision remains centered on "${currentDecision.title}".`;
  } else if (currentDecision) {
    decision = `Latest decision: ${currentDecision.title}.`;
  }
  if (currentDiagnosis && previousDiagnosis) {
    diagnosis = currentDiagnosis.title !== previousDiagnosis.title
      ? `Diagnosis changed from "${previousDiagnosis.title}" to "${currentDiagnosis.title}".`
      : `Diagnosis remains centered on "${currentDiagnosis.title}".`;
  } else if (currentDiagnosis) {
    diagnosis = `Latest diagnosis: ${currentDiagnosis.title}.`;
  }
  return { decision, diagnosis };
};

const normalizeTimelineEntry = (entry = {}) => ({
  status: "draft",
  pinned: false,
  sources: [],
  ...entry,
});

const normalizeSource = (source) => {
  if (!source) return null;
  if (typeof source === "string") return { label: source, snippet: "", pinned: false, score: 0, item_id: "", library_key: "" };
  return {
    label: source.label || source.name || "Source",
    snippet: source.snippet || "",
    pinned: Boolean(source.pinned),
    score: Number(source.score || 0),
    item_id: source.item_id || source.id || "",
    library_key: source.library_key || "",
  };
};

const normalizePlaybook = (playbook) => {
  if (!playbook) return null;
  if (typeof playbook === "string") {
    const title = playbook.trim();
    if (!title) return null;
    return {
      id: `playbook_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      title,
      summary: "",
      type: "general",
      created_at: "",
      pinned: false,
      sources: [],
    };
  }
  const id = String(playbook.id || playbook.playbook_id || "").trim() || `playbook_${String(playbook.title || playbook.label || "item").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const title = String(playbook.title || playbook.label || playbook.name || "Playbook").trim();
  return {
    ...playbook,
    id,
    title,
    summary: String(playbook.summary || playbook.description || playbook.snippet || "").trim(),
    type: String(playbook.type || playbook.kind || "general").trim() || "general",
    created_at: String(playbook.created_at || playbook.updated_at || "").trim(),
    pinned: Boolean(playbook.pinned),
    sources: (Array.isArray(playbook.sources) ? playbook.sources : []).map(normalizeSource).filter(Boolean),
  };
};

const buildPlaybookPlanningPrompt = (playbook) => {
  const normalized = normalizePlaybook(playbook);
  if (!normalized) return "Map out the best next plan from here.";
  const summary = normalized.summary ? `\nCurrent playbook summary: ${normalized.summary}` : "";
  return `Map out a concrete plan using the "${normalized.title}" playbook as the anchor.${summary}\nKeep it practical, sequenced, and tailored to the current business context.`;
};

const buildPlaybookPromptContext = (playbook) => {
  const normalized = normalizePlaybook(playbook);
  if (!normalized) return "";
  const sourceLines = normalized.sources.slice(0, 4).map((source) => `- ${source.label}${source.snippet ? `: ${source.snippet}` : ""}`);
  const parts = [
    "",
    "Active playbook context:",
    `Playbook: ${normalized.title}`,
    normalized.summary ? `Summary: ${normalized.summary}` : "",
    sourceLines.length ? `Supporting sources:\n${sourceLines.join("\n")}` : "",
  ].filter(Boolean);
  return `\n\n${parts.join("\n")}`;
};

const mergeConsultedSources = (sources = [], playbook = null) => {
  const merged = [...(Array.isArray(sources) ? sources : [])].map(normalizeSource).filter(Boolean);
  const normalizedPlaybook = normalizePlaybook(playbook);
  if (!normalizedPlaybook) return merged;
  const playbookSource = {
    label: normalizedPlaybook.title,
    snippet: normalizedPlaybook.summary,
    pinned: Boolean(normalizedPlaybook.pinned),
    score: 100,
    item_id: normalizedPlaybook.id,
    library_key: "playbook",
  };
  const deduped = [playbookSource, ...normalizedPlaybook.sources, ...merged]
    .map(normalizeSource)
    .filter(Boolean)
    .filter((source, index, list) => list.findIndex((candidate) => candidate.item_id === source.item_id && candidate.label === source.label) === index);
  return deduped;
};

const decorateAssistantWithPlaybook = (text = "", playbook = null) => {
  const normalized = normalizePlaybook(playbook);
  if (!normalized) return text;
  const body = String(text || "");
  if (body.toLowerCase().includes(`following playbook "${normalized.title.toLowerCase()}"`)) return body;
  return `${body}\n\nFollowing playbook "${normalized.title}".`.trim();
};

const CHAT_FIELD_SCHEMA_COMMON = {
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
};

const CHAT_FIELD_SCHEMA_BY_AGENT = {
  maestro: {
    objective: { type: "select", label: "Campaign Objective", options: ["leads", "sales", "traffic", "awareness"] },
    channels: { type: "multiselect", label: "Ad Channels", options: ["meta", "google", "linkedin", "tiktok"] },
  },
  veritas: {
    contract_name_or_text: { type: "textarea", label: "Contract Name/Text" },
  },
  inspect: {
    suite_name_or_scope: { type: "text", label: "Test Suite/Scope" },
  },
  pulse: {
    audience: { type: "text", label: "Team/Population" },
  },
  merchant: {
    product_or_segment: { type: "text", label: "Product or Segment" },
    discount_or_offer: { type: "text", label: "Discount/Offer" },
  },
};

const CHAT_ACTION_SCHEMA_COMMON = {
  campaign_orchestration: {
    fields: ["objective", "budget", "audience", "channels"],
    help: "Provide campaign inputs to generate an executable ad setup.",
    fieldHelp: {
      objective: "Choose the primary KPI goal for this campaign.",
      budget: "Daily or weekly budget value.",
      audience: "Describe targeting (geo, persona, interests).",
      channels: "Select where ads should launch first.",
    },
  },
  contract_risk_review: {
    fields: ["contract_name_or_text"],
    help: "Provide contract name or paste key clauses for risk analysis.",
  },
  review_contract: {
    fields: ["contract_name_or_text"],
    help: "Provide contract name or paste key clauses for review.",
  },
  quality_gate: {
    fields: ["suite_name_or_scope"],
    help: "Specify release/test scope for readiness check.",
  },
  test_orchestration: {
    fields: ["suite_name_or_scope"],
    help: "Specify test suite or module scope to run.",
  },
  create_job_description: {
    fields: ["job_title", "department"],
    help: "Provide role title and team to generate a JD.",
  },
  create_promotion: {
    fields: ["product_or_segment", "discount_or_offer", "duration"],
    help: "Define target product/segment, offer, and campaign duration.",
  },
};

const AGENT_THEME = {
  nexus: { border: "border-blue-200", soft: "bg-blue-50", text: "text-blue-700", button: "bg-blue-600 hover:bg-blue-700", tab: "border-blue-600 text-blue-700" },
  maestro: { border: "border-violet-200", soft: "bg-violet-50", text: "text-violet-700", button: "bg-violet-600 hover:bg-violet-700", tab: "border-violet-600 text-violet-700" },
  prospect: { border: "border-cyan-200", soft: "bg-cyan-50", text: "text-cyan-700", button: "bg-cyan-600 hover:bg-cyan-700", tab: "border-cyan-600 text-cyan-700" },
  sentinel: { border: "border-red-200", soft: "bg-red-50", text: "text-red-700", button: "bg-red-600 hover:bg-red-700", tab: "border-red-600 text-red-700" },
  "support-sage": { border: "border-emerald-200", soft: "bg-emerald-50", text: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700", tab: "border-emerald-600 text-emerald-700" },
  centsible: { border: "border-green-200", soft: "bg-green-50", text: "text-green-700", button: "bg-green-600 hover:bg-green-700", tab: "border-green-600 text-green-700" },
  sage: { border: "border-amber-200", soft: "bg-amber-50", text: "text-amber-700", button: "bg-amber-600 hover:bg-amber-700", tab: "border-amber-600 text-amber-700" },
  chronos: { border: "border-sky-200", soft: "bg-sky-50", text: "text-sky-700", button: "bg-sky-600 hover:bg-sky-700", tab: "border-sky-600 text-sky-700" },
  veritas: { border: "border-indigo-200", soft: "bg-indigo-50", text: "text-indigo-700", button: "bg-indigo-600 hover:bg-indigo-700", tab: "border-indigo-600 text-indigo-700" },
  inspect: { border: "border-teal-200", soft: "bg-teal-50", text: "text-teal-700", button: "bg-teal-600 hover:bg-teal-700", tab: "border-teal-600 text-teal-700" },
  canvas: { border: "border-purple-200", soft: "bg-purple-50", text: "text-purple-700", button: "bg-purple-600 hover:bg-purple-700", tab: "border-purple-600 text-purple-700" },
  merchant: { border: "border-lime-200", soft: "bg-lime-50", text: "text-lime-700", button: "bg-lime-600 hover:bg-lime-700", tab: "border-lime-600 text-lime-700" },
  pulse: { border: "border-pink-200", soft: "bg-pink-50", text: "text-pink-700", button: "bg-pink-600 hover:bg-pink-700", tab: "border-pink-600 text-pink-700" },
  compass: { border: "border-teal-200", soft: "bg-teal-50", text: "text-teal-700", button: "bg-teal-600 hover:bg-teal-700", tab: "border-teal-600 text-teal-700" },
  part: { border: "border-blue-200", soft: "bg-blue-50", text: "text-blue-700", button: "bg-blue-600 hover:bg-blue-700", tab: "border-blue-600 text-blue-700" },
  atlas: { border: "border-orange-200", soft: "bg-orange-50", text: "text-orange-700", button: "bg-orange-600 hover:bg-orange-700", tab: "border-orange-600 text-orange-700" },
  scribe: { border: "border-slate-300", soft: "bg-slate-100", text: "text-slate-700", button: "bg-slate-700 hover:bg-slate-800", tab: "border-slate-700 text-slate-700" },
};

const AGENT_DASHBOARD_COPY = {
  nexus: { title: "Federation Command Deck", snapshot: "Orchestration Snapshot", queue: "Cross-Agent Execution Queue" },
  maestro: { title: "Campaign Performance Deck", snapshot: "Campaign Snapshot", queue: "Marketing Execution Queue" },
  prospect: { title: "Pipeline Intelligence Deck", snapshot: "Pipeline Snapshot", queue: "Prospecting Queue" },
  sentinel: { title: "Threat Defense Deck", snapshot: "Security Snapshot", queue: "Incident Response Queue" },
  "support-sage": { title: "Customer Experience Deck", snapshot: "Support Snapshot", queue: "Ticket Escalation Queue" },
  centsible: { title: "Finance Control Deck", snapshot: "Finance Snapshot", queue: "Finance Workflow Queue" },
  sage: { title: "Strategy Decision Deck", snapshot: "Strategy Snapshot", queue: "Strategic Initiative Queue" },
  chronos: { title: "Time Intelligence Deck", snapshot: "Scheduling Snapshot", queue: "Scheduling Queue" },
  veritas: { title: "Legal Risk Deck", snapshot: "Compliance Snapshot", queue: "Legal Obligation Queue" },
  inspect: { title: "Quality Readiness Deck", snapshot: "QA Snapshot", queue: "Quality Workflow Queue" },
  canvas: { title: "Creative Performance Deck", snapshot: "Creative Snapshot", queue: "Creative Production Queue" },
  merchant: { title: "Commerce Operations Deck", snapshot: "Commerce Snapshot", queue: "Store Operations Queue" },
  pulse: { title: "People Health Deck", snapshot: "People Snapshot", queue: "People Actions Queue" },
  compass: { title: "Market Signal Deck", snapshot: "Market Snapshot", queue: "Intelligence Queue" },
  part: { title: "Partnership Growth Deck", snapshot: "Partnership Snapshot", queue: "Partner Pipeline Queue" },
  atlas: { title: "Operations Control Deck", snapshot: "Operations Snapshot", queue: "Operational Queue" },
  scribe: { title: "Knowledge Operations Deck", snapshot: "Knowledge Snapshot", queue: "Knowledge Workflow Queue" },
};

const AGENT_VISUAL_PROFILE = {
  nexus: { lensA: "Federation Throughput", lensB: "Cross-Agent Risk Mix" },
  sentinel: { lensA: "Threat Vectors", lensB: "Incident Severity Mix" },
  "support-sage": { lensA: "Ticket Driver Trend", lensB: "Resolution Quality Mix" },
  centsible: { lensA: "Cashflow Projection", lensB: "Variance by Bucket" },
  sage: { lensA: "Strategic Progress Curve", lensB: "Opportunity-Risk Mix" },
  chronos: { lensA: "Focus vs Meeting Load", lensB: "Time Allocation Mix" },
  canvas: { lensA: "Asset Format Performance", lensB: "Creative Engagement Trend" },
  merchant: { lensA: "Commerce Funnel Trend", lensB: "Inventory Risk by Category" },
  veritas: { lensA: "Compliance Trajectory", lensB: "Obligation Risk Mix" },
  maestro: { lensA: "Campaign Channel Lift", lensB: "Creative Win Distribution" },
  prospect: { lensA: "Pipeline Stage Momentum", lensB: "Lead Quality Distribution" },
  inspect: { lensA: "Defect Trajectory", lensB: "Coverage-Risk Mix" },
  pulse: { lensA: "Engagement Trend", lensB: "Retention Risk Distribution" },
  compass: { lensA: "Signal Velocity", lensB: "Competitive Pressure Mix" },
  part: { lensA: "Partner Pipeline Momentum", lensB: "Partner Health Mix" },
  atlas: { lensA: "Flow Throughput", lensB: "Bottleneck Heatmap" },
  scribe: { lensA: "Knowledge Capture Trend", lensB: "Retrieval Success Mix" },
};

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#7c3aed"];

const AGENT_COLLABORATORS = {
  nexus: ["maestro", "atlas", "sage", "centsible", "veritas"],
  maestro: ["canvas", "prospect", "merchant", "atlas"],
  prospect: ["maestro", "centsible", "support-sage", "atlas"],
  sentinel: ["veritas", "inspect", "atlas", "nexus"],
  "support-sage": ["prospect", "merchant", "scribe", "atlas"],
  centsible: ["merchant", "prospect", "sage", "veritas"],
  sage: ["nexus", "compass", "centsible", "atlas"],
  chronos: ["atlas", "pulse", "support-sage", "nexus"],
  veritas: ["sentinel", "centsible", "merchant", "nexus"],
  inspect: ["sentinel", "atlas", "canvas", "merchant"],
  canvas: ["maestro", "merchant", "prospect", "part"],
  merchant: ["centsible", "maestro", "support-sage", "atlas"],
  pulse: ["atlas", "chronos", "support-sage", "nexus"],
  compass: ["sage", "part", "maestro", "nexus"],
  part: ["prospect", "maestro", "merchant", "compass"],
  atlas: ["nexus", "chronos", "pulse", "veritas"],
  scribe: ["support-sage", "atlas", "veritas", "nexus"],
};

const AGENT_INTEGRATIONS = {
  nexus: [{ id: "event_bus", label: "Event Bus", endpoint: "Kafka / NATS" }, { id: "orchestrator", label: "Orchestration Engine", endpoint: "Temporal / Camunda" }, { id: "graph_api", label: "Unified Graph API", endpoint: "GraphQL Gateway" }],
  maestro: [
    { id: "instagram_ads", label: "Instagram Ads", endpoint: "graph.facebook.com/instagram" },
    { id: "tiktok_ads", label: "TikTok Ads", endpoint: "business-api.tiktok.com" },
    { id: "meta_ads", label: "Meta Ads", endpoint: "graph.facebook.com" },
    { id: "google_ads", label: "Google Ads", endpoint: "googleads.googleapis.com" },
    { id: "klaviyo", label: "Klaviyo", endpoint: "a.klaviyo.com" },
    { id: "mailchimp", label: "Mailchimp", endpoint: "usX.api.mailchimp.com" },
    { id: "sendgrid", label: "SendGrid", endpoint: "api.sendgrid.com" },
  ],
  prospect: [
    { id: "hubspot", label: "HubSpot CRM", endpoint: "api.hubapi.com" },
    { id: "apollo", label: "Apollo", endpoint: "api.apollo.io" },
    { id: "outreach", label: "Outreach", endpoint: "api.outreach.io" },
    { id: "gmail", label: "Gmail", endpoint: "gmail.googleapis.com" },
    { id: "outlook_mail", label: "Outlook Mail", endpoint: "graph.microsoft.com/mail" },
  ],
  sentinel: [{ id: "crowdstrike", label: "CrowdStrike", endpoint: "api.crowdstrike.com" }, { id: "snyk", label: "Snyk", endpoint: "api.snyk.io" }, { id: "okta", label: "Okta", endpoint: "okta.com/api" }],
  "support-sage": [
    { id: "zendesk", label: "Zendesk", endpoint: "api.zendesk.com" },
    { id: "intercom", label: "Intercom", endpoint: "api.intercom.io" },
    { id: "twilio", label: "Twilio", endpoint: "api.twilio.com" },
    { id: "gmail", label: "Gmail", endpoint: "gmail.googleapis.com" },
    { id: "outlook_mail", label: "Outlook Mail", endpoint: "graph.microsoft.com/mail" },
  ],
  centsible: [
    { id: "quickbooks", label: "QuickBooks", endpoint: "quickbooks.api.intuit.com" },
    { id: "xero", label: "Xero", endpoint: "api.xero.com" },
    { id: "stripe", label: "Stripe", endpoint: "api.stripe.com" },
    { id: "smtp", label: "SMTP", endpoint: "smtp.your-provider.com" },
  ],
  sage: [{ id: "bigquery", label: "BigQuery", endpoint: "bigquery.googleapis.com" }, { id: "snowflake", label: "Snowflake", endpoint: "snowflakecomputing.com" }, { id: "notion", label: "Notion", endpoint: "api.notion.com" }],
  chronos: [{ id: "gcal", label: "Google Calendar", endpoint: "www.googleapis.com/calendar" }, { id: "outlook", label: "Outlook Calendar", endpoint: "graph.microsoft.com" }, { id: "zoom", label: "Zoom", endpoint: "api.zoom.us" }],
  veritas: [{ id: "ironclad", label: "Ironclad", endpoint: "api.ironcladapp.com" }, { id: "docusign", label: "DocuSign", endpoint: "account.docusign.com" }, { id: "onetrust", label: "OneTrust", endpoint: "onetrust.com/api" }],
  inspect: [{ id: "github_actions", label: "GitHub Actions", endpoint: "api.github.com" }, { id: "playwright", label: "Playwright CI", endpoint: "internal-runner" }, { id: "datadog_ci", label: "Datadog CI", endpoint: "api.datadoghq.com" }],
  canvas: [
    { id: "dalle", label: "DALL·E", endpoint: "api.openai.com/v1/images" },
    { id: "midjourney", label: "Midjourney", endpoint: "api.midjourney.com" },
    { id: "canva_api", label: "Canva", endpoint: "api.canva.com" },
    { id: "runway", label: "Runway", endpoint: "api.runwayml.com" },
    { id: "cloudinary", label: "Cloudinary", endpoint: "api.cloudinary.com" },
  ],
  merchant: [{ id: "shopify", label: "Shopify", endpoint: "your-store.myshopify.com/admin/api" }, { id: "stripe_checkout", label: "Stripe Checkout", endpoint: "api.stripe.com" }, { id: "shipstation", label: "ShipStation", endpoint: "ssapi.shipstation.com" }],
  pulse: [{ id: "workday", label: "Workday", endpoint: "workday.com/api" }, { id: "bamboohr", label: "BambooHR", endpoint: "api.bamboohr.com" }, { id: "slack", label: "Slack", endpoint: "slack.com/api" }],
  compass: [{ id: "gnews", label: "GNews", endpoint: "gnews.io/api" }, { id: "similarweb", label: "Similarweb", endpoint: "api.similarweb.com" }, { id: "google_trends", label: "Google Trends", endpoint: "trends.google.com" }],
  part: [
    { id: "gmail", label: "Gmail", endpoint: "gmail.googleapis.com" },
    { id: "outlook_mail", label: "Outlook Mail", endpoint: "graph.microsoft.com/mail" },
    { id: "affise", label: "Affise", endpoint: "api.affise.com" },
    { id: "impact", label: "Impact", endpoint: "api.impact.com" },
    { id: "linkedin", label: "LinkedIn", endpoint: "api.linkedin.com" },
  ],
  atlas: [{ id: "jira", label: "Jira", endpoint: "atlassian.net/rest/api" }, { id: "asana", label: "Asana", endpoint: "app.asana.com/api" }, { id: "zapier", label: "Zapier", endpoint: "hooks.zapier.com" }],
  scribe: [
    { id: "notion_docs", label: "Notion Docs", endpoint: "api.notion.com" },
    { id: "confluence", label: "Confluence", endpoint: "atlassian.net/wiki/api" },
    { id: "vector_db", label: "Vector DB", endpoint: "pinecone/weaviate endpoint" },
    { id: "s3_docs", label: "AWS S3", endpoint: "s3.amazonaws.com" },
    { id: "gdrive_docs", label: "Google Drive", endpoint: "www.googleapis.com/drive" },
    { id: "dropbox_docs", label: "Dropbox", endpoint: "api.dropboxapi.com" },
  ],
};

const AGENT_NEEDS_BACKLOG = {
  nexus: [{ id: "nexus_rbac_guardrails", title: "Add org-level RBAC for autonomy promotions and rollbacks", severity: "high", area: "governance", action: "policy_enforcement" }],
  maestro: [{ id: "maestro_publish_credentials", title: "Add per-channel publishing credentials vault and approval states", severity: "high", area: "integrations", action: "campaign_orchestration" }],
  prospect: [{ id: "prospect_deliverability_ops", title: "Implement SPF/DKIM warmup and deliverability health panel", severity: "high", area: "email", action: "outreach_sequence_builder" }],
  sentinel: [{ id: "sentinel_evidence_chain", title: "Add chain-of-custody export and incident SLA timers", severity: "high", area: "security", action: "autonomous_incident_response" }],
  "support-sage": [{ id: "support_kb_attribution", title: "Add KB version diff/rollback and deflection attribution", severity: "medium", area: "knowledge", action: "knowledge_base_studio" }],
  centsible: [{ id: "centsible_period_lock", title: "Add typed financial document schemas and period locking", severity: "high", area: "finance", action: "driver_based_planning" }],
  sage: [{ id: "sage_dependency_graph", title: "Build strategic dependency graph and scenario compare view", severity: "medium", area: "strategy", action: "scenario_modeling" }],
  chronos: [{ id: "chronos_fairness_history", title: "Add scheduling fairness simulator and historical scoring", severity: "medium", area: "time", action: "global_fairness_scheduler" }],
  veritas: [{ id: "veritas_clause_semantic", title: "Implement clause-level semantic search and obligation reminders sync", severity: "high", area: "legal", action: "contract_risk_review" }],
  inspect: [{ id: "inspect_traceability", title: "Link test case ? commit ? release with persistent RCA clusters", severity: "high", area: "quality", action: "release_readiness_gate" }],
  canvas: [{ id: "canvas_rights_expiry", title: "Add asset rights/license expiry alerts and render queue status", severity: "medium", area: "creative", action: "creative_ops_review" }],
  merchant: [{ id: "merchant_margin_waterfall", title: "Add SKU margin waterfall and returns taxonomy drilldown", severity: "medium", area: "commerce", action: "catalog_health_scan" }],
  pulse: [{ id: "pulse_privacy_masks", title: "Add PII masking and manager action follow-through tracking", severity: "high", area: "people", action: "workforce_forecasting" }],
  compass: [{ id: "compass_source_scoring", title: "Add source credibility scoring and alert suppression controls", severity: "medium", area: "intelligence", action: "trend_detection" }],
  part: [{ id: "part_tiering_mdf", title: "Add partner tier automation and MDF approval ledger", severity: "medium", area: "partnerships", action: "alliance_pipeline" }],
  atlas: [{ id: "atlas_workflow_diff_replay", title: "Add workflow version diff and checkpoint replay", severity: "high", area: "operations", action: "workflow_optimization" }],
  scribe: [{ id: "scribe_citation_retention", title: "Add citation-backed answer view and retention policy enforcement", severity: "medium", area: "knowledge", action: "knowledge_graph_builder" }],
};

const AGENT_NEED_BLUEPRINTS = {
  nexus_rbac_guardrails: {
    description: "Define approvers, scopes, and rollback SLA for autonomy promotions.",
    fields: [
      { key: "approverRoles", label: "Approver Roles", type: "text", placeholder: "cto, head_of_ops, security_lead" },
      { key: "scopePolicy", label: "Scope Policy", type: "text", placeholder: "org:all_agents / org:restricted" },
      { key: "requiresDualApproval", label: "Dual Approval", type: "checkbox" },
      { key: "rollbackSlaMinutes", label: "Rollback SLA (minutes)", type: "number", min: 5, max: 240 },
    ],
    required: ["approverRoles", "scopePolicy", "requiresDualApproval", "rollbackSlaMinutes"],
  },
  maestro_publish_credentials: {
    description: "Store channel credentials and enforce pre-publish approval state.",
    fields: [
      { key: "vaultProvider", label: "Vault Provider", type: "select", options: ["local-encrypted", "aws-secrets-manager", "gcp-secret-manager"] },
      { key: "channelsCovered", label: "Channels Covered", type: "text", placeholder: "instagram, tiktok, meta, email" },
      { key: "approvalState", label: "Approval State", type: "select", options: ["required", "optional", "auto-low-risk"] },
      { key: "rotationDays", label: "Credential Rotation (days)", type: "number", min: 7, max: 180 },
    ],
    required: ["vaultProvider", "channelsCovered", "approvalState", "rotationDays"],
  },
  prospect_deliverability_ops: {
    description: "Capture sender auth, warmup plan, and deliverability guardrails.",
    fields: [
      { key: "sendingDomain", label: "Sending Domain", type: "text", placeholder: "mail.company.com" },
      { key: "spfStatus", label: "SPF Status", type: "select", options: ["pass", "pending", "fail"] },
      { key: "dkimStatus", label: "DKIM Status", type: "select", options: ["pass", "pending", "fail"] },
      { key: "warmupDailyVolume", label: "Warmup Daily Volume", type: "number", min: 10, max: 5000 },
    ],
    required: ["sendingDomain", "spfStatus", "dkimStatus", "warmupDailyVolume"],
  },
  sentinel_evidence_chain: {
    description: "Track chain-of-custody artifacts and SLA timers for incidents.",
    fields: [
      { key: "exportFormat", label: "Evidence Export Format", type: "select", options: ["json", "pdf", "zip"] },
      { key: "hashAlgorithm", label: "Hash Algorithm", type: "select", options: ["sha256", "sha512"] },
      { key: "incidentSlaMinutes", label: "Incident SLA (minutes)", type: "number", min: 15, max: 1440 },
      { key: "tamperChecksEnabled", label: "Tamper Checks Enabled", type: "checkbox" },
    ],
    required: ["exportFormat", "hashAlgorithm", "incidentSlaMinutes", "tamperChecksEnabled"],
  },
  support_kb_attribution: {
    description: "Enable KB diff/rollback and connect article usage to deflection impact.",
    fields: [
      { key: "diffMode", label: "Version Diff Mode", type: "select", options: ["line", "semantic"] },
      { key: "rollbackEnabled", label: "Rollback Enabled", type: "checkbox" },
      { key: "deflectionEventSource", label: "Deflection Event Source", type: "text", placeholder: "ticket_resolution_events" },
      { key: "attributionWindowDays", label: "Attribution Window (days)", type: "number", min: 1, max: 90 },
    ],
    required: ["diffMode", "rollbackEnabled", "deflectionEventSource", "attributionWindowDays"],
  },
  centsible_period_lock: {
    description: "Define typed schemas and lock behavior per close period.",
    fields: [
      { key: "schemaSet", label: "Schema Set", type: "text", placeholder: "pnl_v2,balance_sheet_v2,cashflow_v2" },
      { key: "lockCadence", label: "Lock Cadence", type: "select", options: ["monthly", "quarterly", "annual"] },
      { key: "lockAfterDays", label: "Lock After (days)", type: "number", min: 1, max: 31 },
      { key: "overrideRole", label: "Override Role", type: "text", placeholder: "controller" },
    ],
    required: ["schemaSet", "lockCadence", "lockAfterDays", "overrideRole"],
  },
  sage_dependency_graph: {
    description: "Capture strategic dependency links and compare scenario outcomes.",
    fields: [
      { key: "graphNodesSource", label: "Node Source", type: "text", placeholder: "okr_portfolio" },
      { key: "dependencyDepth", label: "Dependency Depth", type: "number", min: 1, max: 5 },
      { key: "scenarioSets", label: "Scenario Sets", type: "text", placeholder: "base,bull,bear" },
      { key: "compareMetric", label: "Primary Compare Metric", type: "text", placeholder: "roi_12m" },
    ],
    required: ["graphNodesSource", "dependencyDepth", "scenarioSets", "compareMetric"],
  },
  chronos_fairness_history: {
    description: "Configure fairness scoring and keep historical scheduling snapshots.",
    fields: [
      { key: "fairnessModel", label: "Fairness Model", type: "select", options: ["rotation", "weighted", "hybrid"] },
      { key: "historyWindowDays", label: "History Window (days)", type: "number", min: 14, max: 365 },
      { key: "timezoneBiasCap", label: "Timezone Bias Cap (hours)", type: "number", min: 1, max: 12 },
      { key: "autoRebalance", label: "Auto Rebalance", type: "checkbox" },
    ],
    required: ["fairnessModel", "historyWindowDays", "timezoneBiasCap", "autoRebalance"],
  },
  veritas_clause_semantic: {
    description: "Set clause semantic indexing and obligation reminder synchronization.",
    fields: [
      { key: "semanticIndex", label: "Semantic Index", type: "text", placeholder: "veritas_clause_index_v1" },
      { key: "reminderSyncTarget", label: "Reminder Sync Target", type: "select", options: ["chronos", "atlas", "both"] },
      { key: "refreshHours", label: "Index Refresh (hours)", type: "number", min: 1, max: 72 },
      { key: "minConfidence", label: "Min Match Confidence (%)", type: "number", min: 50, max: 100 },
    ],
    required: ["semanticIndex", "reminderSyncTarget", "refreshHours", "minConfidence"],
  },
  inspect_traceability: {
    description: "Bind test cases to commits/releases and persist RCA cluster identities.",
    fields: [
      { key: "vcsProvider", label: "VCS Provider", type: "select", options: ["github", "gitlab", "bitbucket"] },
      { key: "releaseSource", label: "Release Source", type: "text", placeholder: "ci_release_tags" },
      { key: "rcaClusterModel", label: "RCA Cluster Model", type: "text", placeholder: "defect_cluster_v2" },
      { key: "traceabilityEnforced", label: "Traceability Enforced", type: "checkbox" },
    ],
    required: ["vcsProvider", "releaseSource", "rcaClusterModel", "traceabilityEnforced"],
  },
  canvas_rights_expiry: {
    description: "Track creative rights/license expiry and monitor render queue delays.",
    fields: [
      { key: "licenseRegistry", label: "License Registry", type: "text", placeholder: "creative_rights_registry" },
      { key: "expiryAlertDays", label: "Expiry Alert (days)", type: "number", min: 1, max: 180 },
      { key: "renderQueueSource", label: "Render Queue Source", type: "text", placeholder: "runway_queue" },
      { key: "blockOnExpiredAssets", label: "Block Expired Assets", type: "checkbox" },
    ],
    required: ["licenseRegistry", "expiryAlertDays", "renderQueueSource", "blockOnExpiredAssets"],
  },
  merchant_margin_waterfall: {
    description: "Capture SKU margin waterfall inputs and returns taxonomy mapping.",
    fields: [
      { key: "costSources", label: "Cost Sources", type: "text", placeholder: "cogs,shipping,fees,returns" },
      { key: "returnsTaxonomyVersion", label: "Returns Taxonomy Version", type: "text", placeholder: "v1.0" },
      { key: "drilldownGranularity", label: "Drilldown Granularity", type: "select", options: ["sku", "sku+channel", "sku+region"] },
      { key: "refreshCadenceHours", label: "Refresh Cadence (hours)", type: "number", min: 1, max: 168 },
    ],
    required: ["costSources", "returnsTaxonomyVersion", "drilldownGranularity", "refreshCadenceHours"],
  },
  pulse_privacy_masks: {
    description: "Apply PII masking defaults and manager follow-through tracking.",
    fields: [
      { key: "maskingMode", label: "Masking Mode", type: "select", options: ["strict", "balanced", "minimal"] },
      { key: "sensitiveFields", label: "Sensitive Fields", type: "text", placeholder: "email,phone,address,health_notes" },
      { key: "managerActionSlaDays", label: "Manager Action SLA (days)", type: "number", min: 1, max: 30 },
      { key: "auditTrailEnabled", label: "Audit Trail Enabled", type: "checkbox" },
    ],
    required: ["maskingMode", "sensitiveFields", "managerActionSlaDays", "auditTrailEnabled"],
  },
  compass_source_scoring: {
    description: "Set source credibility scoring and suppression thresholds for noisy alerts.",
    fields: [
      { key: "credibilityModel", label: "Credibility Model", type: "text", placeholder: "source_trust_v1" },
      { key: "minCredibility", label: "Min Credibility (%)", type: "number", min: 40, max: 100 },
      { key: "suppressionWindowHours", label: "Suppression Window (hours)", type: "number", min: 1, max: 168 },
      { key: "allowManualOverride", label: "Allow Manual Override", type: "checkbox" },
    ],
    required: ["credibilityModel", "minCredibility", "suppressionWindowHours", "allowManualOverride"],
  },
  part_tiering_mdf: {
    description: "Automate partner tiers and maintain auditable MDF approvals.",
    fields: [
      { key: "tierModel", label: "Tier Model", type: "text", placeholder: "revenue+health+training" },
      { key: "mdfLedgerOwner", label: "MDF Ledger Owner", type: "text", placeholder: "partnership_ops" },
      { key: "approvalStages", label: "Approval Stages", type: "number", min: 1, max: 5 },
      { key: "autoTierRecalc", label: "Auto Tier Recalc", type: "checkbox" },
    ],
    required: ["tierModel", "mdfLedgerOwner", "approvalStages", "autoTierRecalc"],
  },
  atlas_workflow_diff_replay: {
    description: "Track workflow version diffs and replay checkpoints safely.",
    fields: [
      { key: "diffStore", label: "Diff Store", type: "text", placeholder: "atlas_workflow_diffs" },
      { key: "checkpointRetentionDays", label: "Checkpoint Retention (days)", type: "number", min: 7, max: 365 },
      { key: "replayApprovalMode", label: "Replay Approval Mode", type: "select", options: ["manual", "risk-based", "auto-low-risk"] },
      { key: "snapshotBeforeReplay", label: "Snapshot Before Replay", type: "checkbox" },
    ],
    required: ["diffStore", "checkpointRetentionDays", "replayApprovalMode", "snapshotBeforeReplay"],
  },
  scribe_citation_retention: {
    description: "Enforce citation-backed answers and retention policy for knowledge assets.",
    fields: [
      { key: "citationRequired", label: "Citation Required", type: "checkbox" },
      { key: "retentionPolicyDays", label: "Retention Policy (days)", type: "number", min: 30, max: 3650 },
      { key: "policyScope", label: "Policy Scope", type: "text", placeholder: "all_docs,meeting_notes,external_content" },
      { key: "deletionReviewRole", label: "Deletion Review Role", type: "text", placeholder: "knowledge_admin" },
    ],
    required: ["citationRequired", "retentionPolicyDays", "policyScope", "deletionReviewRole"],
  },
};

const AGENT_ROLE_TOOLS = {
  nexus: [
    { id: "intent_routing", label: "Intent Routing", description: "Classify user intent and route to the right agent chain." },
    { id: "cross_agent_insights", label: "Cross-Agent Insights", description: "Correlate performance, risk, and growth signals across agents." },
    { id: "workflow_orchestration", label: "Workflow Orchestration", description: "Launch and supervise multi-agent workflows with approvals." },
    { id: "health_score_breakdown", label: "Health Score Breakdown", description: "Explain the business health score by contributing metrics." },
  ],
  maestro: [
    { id: "campaign_orchestration", label: "Campaign Orchestration", description: "Build and launch multi-channel campaigns with stage sequencing." },
    { id: "market_competitor_analysis", label: "Market & Competitor Analysis", description: "Analyze market movements, competitor positioning, and opportunity gaps." },
    { id: "trend_forecast_engine", label: "Trend Forecast Engine", description: "Forecast upcoming content, cultural, and demand trends by channel." },
    { id: "audience_segmentation_studio", label: "Audience Segmentation Studio", description: "Build personas and behavior cohorts for targeting." },
    { id: "content_calendar_builder", label: "Content Calendar Builder", description: "Generate weekly/monthly post plans by channel and audience." },
    { id: "copywriting_studio", label: "Copywriting Studio", description: "Generate channel-specific copy for social, ads, blogs, and lifecycle touchpoints." },
    { id: "video_reel_planner", label: "Video/Reel Planner", description: "Draft reel concepts, hooks, scripts, and storyboard sequences." },
    { id: "social_unified_inbox_ops", label: "Social Unified Inbox Ops", description: "Triage social DMs/comments and route engagement actions." },
    { id: "email_flow_automation", label: "Email Flow Automation", description: "Build and run lifecycle email flows with trigger logic." },
    { id: "ad_variant_generator", label: "Ad Variant Generator", description: "Generate ad copy variants for Instagram, TikTok, and Meta." },
    { id: "bid_budget_optimizer", label: "Bid/Budget Optimizer", description: "Recommend bid and spend distribution with performance constraints." },
    { id: "dynamic_creative_optimization", label: "Dynamic Creative Optimization", description: "Adapt creative by segment and performance signal." },
    { id: "channel_mix_optimizer", label: "Channel Mix Optimizer", description: "Optimize budget allocation and predicted ROAS by channel." },
    { id: "attribution_model_review", label: "Attribution Model Review", description: "Compare assisted conversion attribution across channels." },
    { id: "sentiment_social_listening", label: "Sentiment & Social Listening", description: "Track mention sentiment and identify escalation opportunities." },
    { id: "influencer_affiliate_coordination", label: "Influencer/Affiliate Coordination", description: "Source and coordinate influencer and affiliate campaign workflows." },
    { id: "brand_compliance_guard", label: "Brand Compliance Guard", description: "Check campaign messaging against brand voice and policy constraints." },
    { id: "cross_agent_handoff", label: "Cross-Agent Handoff", description: "Dispatch leads to Prospect, request Canvas assets, and push workflows to Atlas." },
  ],
  prospect: [
    { id: "lead_discovery", label: "Lead Discovery", description: "Find ICP-matched leads from configured sources." },
    { id: "lead_enrichment_360", label: "Lead Enrichment 360", description: "Enrich leads with contact, firmographic, and intent intelligence." },
    { id: "lead_scoring", label: "Lead Scoring", description: "Score leads by intent, fit, and conversion probability." },
    { id: "buying_signal_detection", label: "Buying Signal Detection", description: "Detect funding, hiring, and engagement triggers in real time." },
    { id: "outreach_sequence_builder", label: "Outreach Sequence Builder", description: "Build personalized email/DM sequences." },
    { id: "ai_cold_call_assistant", label: "AI Cold Call Assistant", description: "Run call scripts, qualification logic, and objection handling prompts." },
    { id: "abm_account_mapping", label: "ABM Account Mapping", description: "Build target account maps and buying committee views." },
    { id: "pipeline_velocity_monitor", label: "Pipeline Velocity Monitor", description: "Track stage movement and identify stuck opportunities." },
    { id: "sales_asset_library", label: "Sales Asset Library", description: "Manage templates, battle cards, and collateral by segment/stage." },
  ],
  sentinel: [
    { id: "threat_scan", label: "Threat Scan", description: "Scan active threat vectors and suspicious access patterns." },
    { id: "threat_hunting_console", label: "Threat Hunting Console", description: "Run proactive hunts across intelligence and telemetry." },
    { id: "zero_trust_access_review", label: "Zero-Trust Access Review", description: "Review adaptive trust and privileged access risk." },
    { id: "incident_triage", label: "Incident Triage", description: "Classify incident severity, blast radius, and next steps." },
    { id: "cloud_posture_scan", label: "Cloud Posture Scan", description: "Scan cloud controls and misconfiguration exposure." },
    { id: "compliance_evidence_pack", label: "Compliance Evidence Pack", description: "Compile control evidence for audit trails." },
    { id: "security_posture_report", label: "Security Posture Report", description: "Summarize control health and remediation priorities." },
    { id: "credential_drift_check", label: "Credential Drift Check", description: "Detect stale secrets and risky credential patterns." },
    { id: "security_library_manager", label: "Security Library Manager", description: "Manage incident reports, policies, and playbooks." },
  ],
  "support-sage": [
    { id: "ticket_triage", label: "Ticket Triage", description: "Categorize and prioritize incoming support tickets." },
    { id: "omnichannel_ingestion", label: "Omnichannel Ingestion", description: "Ingest and deduplicate tickets across chat, email, SMS, and social channels." },
    { id: "response_draft", label: "Response Draft", description: "Draft empathetic policy-aligned responses." },
    { id: "autonomous_resolution", label: "Autonomous Resolution", description: "Resolve known issues with KB-guided support workflows." },
    { id: "human_handoff_assist", label: "Human Handoff Assist", description: "Escalate to human with complete context and suggested next actions." },
    { id: "sla_monitoring", label: "SLA Monitoring", description: "Track SLA risk and recommend escalations." },
    { id: "csat_driver_analysis", label: "CSAT Driver Analysis", description: "Analyze key themes impacting customer satisfaction." },
    { id: "refund_credit_ops", label: "Refund & Credit Ops", description: "Process refund/credit actions within policy guardrails." },
    { id: "knowledge_base_studio", label: "Knowledge Base Studio", description: "Create, update, version, and publish support knowledge articles." },
    { id: "incident_broadcast", label: "Incident Broadcast", description: "Trigger crisis notifications and response coordination workflows." },
  ],
  centsible: [
    { id: "cash_flow_forecast", label: "Cash Flow Forecast", description: "Forecast cash position and runway scenarios." },
    { id: "budget_variance", label: "Budget Variance", description: "Analyze budget deviations by cost center." },
    { id: "revenue_leakage_scan", label: "Revenue Leakage Scan", description: "Find missed revenue and billing gaps." },
    { id: "margin_alerts", label: "Margin Alerts", description: "Detect deteriorating margins and likely drivers." },
    { id: "generate_board_deck", label: "Generate Board Deck", description: "Create board-ready financial narrative and KPI summary." },
    { id: "documents_manager", label: "Documents Manager", description: "Manage finance reports, forecasts, templates, and decks." },
  ],
  sage: [
    { id: "scenario_modeling", label: "Scenario Modeling", description: "Model growth and risk scenarios with confidence ranges." },
    { id: "macro_market_monitor", label: "Macro Market Monitor", description: "Track macroeconomic, policy, and disruption signals." },
    { id: "opportunity_white_space_scan", label: "White Space Opportunity Scan", description: "Identify adjacent and underserved market opportunities." },
    { id: "strategic_financial_model", label: "Strategic Financial Model", description: "Simulate strategy effects across revenue, margin, and runway." },
    { id: "okr_cascade_designer", label: "OKR Cascade Designer", description: "Translate strategic objectives into cascaded team OKRs." },
    { id: "risk_register_builder", label: "Strategic Risk Register", description: "Build and track strategic risk register and contingency plans." },
    { id: "initiative_prioritization", label: "Initiative Prioritization", description: "Rank strategic initiatives by impact and effort." },
    { id: "strategy_scorecard", label: "Strategy Scorecard", description: "Track execution quality of strategic bets." },
    { id: "board_brief", label: "Board Brief", description: "Generate concise strategy briefing for leadership." },
    { id: "strategy_library_manager", label: "Strategy Library Manager", description: "Save, search, and share plans, scenarios, and board materials." },
  ],
  chronos: [
    { id: "smart_scheduling", label: "Smart Scheduling", description: "Resolve scheduling conflicts and optimize timing." },
    { id: "meeting_cost_calculator", label: "Meeting Cost Calculator", description: "Calculate fully-loaded meeting cost by attendee and duration." },
    { id: "agenda_autobuilder", label: "Agenda Auto Builder", description: "Generate meeting agendas from goals and prior actions." },
    { id: "deep_work_guard", label: "Deep Work Guard", description: "Protect focus blocks and enforce no-meeting windows." },
    { id: "timezone_fairness_scheduler", label: "Timezone Fairness Scheduler", description: "Optimize meeting fairness across distributed teams." },
    { id: "meeting_culture_analytics", label: "Meeting Culture Analytics", description: "Track meeting load, interruptions, and time ROI." },
    { id: "focus_time_guard", label: "Focus Time Guard", description: "Protect deep-work blocks and reduce fragmentation." },
    { id: "meeting_load_audit", label: "Meeting Load Audit", description: "Assess meeting overhead and identify reclaimable time." },
    { id: "time_roi_dashboard", label: "Time ROI Dashboard", description: "Quantify return on time allocation decisions." },
    { id: "schedule_library_manager", label: "Schedule Library Manager", description: "Manage meeting templates, policies, and time audits." },
  ],
  veritas: [
    { id: "contract_risk_review", label: "Contract Risk Review", description: "Review clauses against policy and risk posture." },
    { id: "compliance_audit", label: "Compliance Audit", description: "Run legal/compliance checklist and gap report." },
    { id: "obligation_tracking", label: "Obligation Tracking", description: "Track deadlines and commitments from agreements." },
    { id: "regulatory_radar", label: "Regulatory Radar", description: "Monitor regulatory changes and impact." },
    { id: "review_contract", label: "Review Contract", description: "Analyze agreements for risk and generate redline recommendations." },
    { id: "legal_library_manager", label: "Legal Library Manager", description: "Manage contracts, clauses, policies, and legal evidence." },
  ],
  inspect: [
    { id: "test_orchestration", label: "Test Orchestration", description: "Run test suites and summarize pass/fail by surface." },
    { id: "quality_gate", label: "Quality Gate", description: "Evaluate release readiness against defined gates." },
    { id: "root_cause_analysis", label: "Root Cause Analysis", description: "Cluster recurring defects and probable root causes." },
    { id: "regression_scan", label: "Regression Scan", description: "Detect regression patterns across releases." },
    { id: "assess_release_readiness", label: "Assess Release Readiness", description: "Generate release readiness score from quality signals." },
    { id: "quality_library_manager", label: "Quality Library Manager", description: "Manage test cases, suites, defects, reports, and policies." },
  ],
  canvas: [
    { id: "create_brand_identity", label: "Create Brand Identity", description: "Generate logo, palette, typography, and brand system starters." },
    { id: "brand_guideline_builder", label: "Brand Guideline Builder", description: "Create and update practical brand guideline packs." },
    { id: "creative_generation", label: "Creative Generation", description: "Generate image/video/script assets by brief and platform." },
    { id: "text_to_image_engine", label: "Text-to-Image Engine", description: "Generate visual concepts and production-ready image variants." },
    { id: "image_edit_suite", label: "Image Edit Suite", description: "Retouch, remove background, inpaint/outpaint, and enhance imagery." },
    { id: "cinematic_video_command", label: "Reel/Video Generator", description: "Generate short-form creative concepts and reels." },
    { id: "voiceover_generation", label: "Voiceover Generator", description: "Generate narration scripts and playable voiceovers for creative assets." },
    { id: "video_post_production", label: "Video Post-Production", description: "Trim, subtitle, caption, and reformat video for target platforms." },
    { id: "three_d_ar_concepts", label: "3D/AR Concepts", description: "Generate 3D/AR concept assets and presentation mockups." },
    { id: "graphic_layout_studio", label: "Graphic Layout Studio", description: "Create social graphics, print layouts, decks, and promo kits." },
    { id: "ui_ux_mockup_builder", label: "UI/UX Mockup Builder", description: "Generate interface concepts, wireframes, and responsive variants." },
    { id: "creative_strategy_ideation", label: "Creative Strategy Ideation", description: "Generate campaign ideas, moodboards, and visual directions." },
    { id: "content_bank_upload", label: "Content Bank Upload", description: "Upload source media and register asset metadata into Content Bank." },
    { id: "content_bank_search", label: "Content Bank Search", description: "Search assets by tags, filename, type, and source history." },
    { id: "content_bank_derivatives", label: "Generate Derivatives", description: "Create reels, thumbnails, cutdowns, and variants from selected assets." },
    { id: "content_bank_share_maestro", label: "Share with Maestro", description: "Expose approved assets for Maestro campaign usage." },
    { id: "creative_ops_review", label: "Creative Ops Review", description: "Run review/approval workflows and version traceability." },
    { id: "brand_compliance_check", label: "Brand Compliance Check", description: "Validate tone, format, and style consistency." },
    { id: "creative_performance", label: "Creative Performance", description: "Analyze asset performance by channel and format." },
  ],
  merchant: [
    { id: "create_product", label: "Create Product", description: "Add a new SKU with catalog attributes and content." },
    { id: "check_inventory", label: "Check Inventory", description: "Get inventory depth by SKU and location." },
    { id: "optimize_pricing", label: "Optimize Pricing", description: "Recommend margin-aware pricing against competitors." },
    { id: "create_promotion", label: "Create Promotion", description: "Design flash sales, bundles, and discount plans." },
    { id: "inventory_risk", label: "Inventory Risk", description: "Forecast stockout/overstock risk by SKU." },
    { id: "conversion_optimization", label: "Conversion Optimization", description: "Identify checkout and funnel friction points." },
    { id: "cart_recovery", label: "Cart Recovery", description: "Run abandoned-cart recovery campaigns." },
    { id: "commerce_library_manager", label: "Commerce Library Manager", description: "Manage product, pricing, order, and supplier assets." },
  ],
  pulse: [
    { id: "analyze_workforce", label: "Analyze Workforce", description: "Generate workforce analytics for headcount, turnover, and risk." },
    { id: "create_job_description", label: "Create Job Description", description: "Generate role-ready job descriptions and requirements." },
    { id: "assess_burnout_risk", label: "Assess Burnout Risk", description: "Detect burnout signals and intervention needs." },
    { id: "identify_high_potential", label: "Identify High Potential", description: "Find succession and promotion-ready talent." },
    { id: "sentiment_monitor", label: "Sentiment Monitor", description: "Track team sentiment trends and confidence." },
    { id: "people_analytics", label: "People Analytics", description: "Analyze retention and performance risk factors." },
    { id: "recognition_tracker", label: "Recognition Tracker", description: "Track recognition balance across teams." },
    { id: "people_library_manager", label: "People Library Manager", description: "Manage employee profiles, reviews, and policy assets." },
  ],
  compass: [
    { id: "market_briefing", label: "Market Briefing", description: "Produce market and category intelligence briefings." },
    { id: "omnidirectional_signal_scan", label: "Omnidirectional Signal Scan", description: "Ingest and rank market signals across external channels." },
    { id: "competitor_dna_profile", label: "Competitor DNA Profile", description: "Build deep competitor profile including product, pricing, and talent shifts." },
    { id: "competitor_tracking", label: "Competitor Tracking", description: "Monitor competitor launches, messaging, and price moves." },
    { id: "predictive_competitive_model", label: "Predictive Competitive Model", description: "Forecast competitor next moves and disruption risk." },
    { id: "trend_detection", label: "Trend Detection", description: "Detect rising trends relevant to your business." },
    { id: "market_library_manager", label: "Market Library Manager", description: "Manage competitor profiles, trend reports, and battle cards." },
    { id: "opportunity_alerting", label: "Opportunity Alerting", description: "Surface actionable opportunities with confidence." },
  ],
  part: [
    { id: "discover_partners", label: "Discover Partners", description: "Find high-fit partners by strategic and commercial criteria." },
    { id: "create_outreach", label: "Create Outreach", description: "Generate and launch partner outreach sequences." },
    { id: "create_co_campaign", label: "Create Co-Marketing Campaign", description: "Plan co-marketing initiatives and shared assets." },
    { id: "partner_health", label: "Partner Health", description: "Monitor partner performance and health signals." },
    { id: "partner_discovery", label: "Partner Discovery", description: "Find relevant partnerships and alliance targets." },
    { id: "alliance_pipeline", label: "Alliance Pipeline", description: "Track partner outreach and stage progression." },
    { id: "partner_roi_review", label: "Partner ROI Review", description: "Measure ROI and renewal risk of partnerships." },
    { id: "partnership_library_manager", label: "Partnership Library Manager", description: "Manage partner profiles, agreements, campaigns, and deals." },
  ],
  atlas: [
    { id: "workflow_automation", label: "Workflow Automation", description: "Design and execute operational workflows." },
    { id: "process_discovery_map", label: "Process Discovery Map", description: "Discover as-is process maps from execution data." },
    { id: "workflow_simulation", label: "Workflow Simulation", description: "Simulate process variants before rollout." },
    { id: "approval_flow_designer", label: "Approval Flow Designer", description: "Create approval gates, routing rules, and escalations." },
    { id: "sla_breach_prevention", label: "SLA Breach Prevention", description: "Predict and prevent SLA breach conditions." },
    { id: "resource_pool_optimizer", label: "Resource Pool Optimizer", description: "Balance demand and capacity across teams." },
    { id: "task_routing", label: "Task Routing", description: "Route tasks to best-fit owners by capacity and skill." },
    { id: "capacity_planning", label: "Capacity Planning", description: "Forecast resource demand and constraints." },
    { id: "bottleneck_detection", label: "Bottleneck Detection", description: "Detect and remediate operational bottlenecks." },
    { id: "workflow_library_manager", label: "Workflow Library Manager", description: "Store templates, SOPs, and project plans with versioning." },
  ],
  scribe: [
    { id: "document_upload_ingest", label: "Document Upload & Ingest", description: "Upload documents and ingest metadata into the knowledge layer." },
    { id: "universal_capture", label: "Universal Capture", description: "Capture knowledge from meetings, chats, docs, and agent outputs." },
    { id: "knowledge_graph_builder", label: "Knowledge Graph Builder", description: "Link people, projects, decisions, and documents." },
    { id: "document_indexing", label: "Document Indexing", description: "Index uploaded files for semantic retrieval." },
    { id: "decision_log_manager", label: "Decision Log Manager", description: "Track key decisions, rationale, and downstream outcomes." },
    { id: "cloud_archive_sync", label: "Cloud Archive Sync", description: "Store documents to cloud storage with sync status tracking." },
    { id: "semantic_retrieval", label: "Semantic Retrieval", description: "Retrieve context-aware knowledge snippets from indexed docs." },
    { id: "sop_generation", label: "SOP Generation", description: "Generate SOP drafts from captured process evidence." },
    { id: "knowledge_gap_analysis", label: "Knowledge Gap Analysis", description: "Identify missing documentation based on search behavior." },
    { id: "knowledge_library_manager", label: "Knowledge Library Manager", description: "Manage docs, SOPs, decision logs, and templates." },
    { id: "audit_trail_export", label: "Audit Trail Export", description: "Export document history and knowledge activity for audits." },
  ],
};

const AGENT_ADVANCED_RUNBOOKS = {
  nexus: [
    { action: "command_center_full_self_test", label: "Federation Full Self-Test", risk: "high" },
    { action: "cross_agent_insights", label: "Cross-Agent Insight Fusion", risk: "medium" },
    { action: "what_if_simulation", label: "What-If Scenario Simulation", risk: "medium" },
    { action: "strategic_recommendations", label: "Strategic Recommendation Pack", risk: "medium" },
  ],
  maestro: [
    { action: "campaign_orchestration", label: "Campaign Orchestration Engine", risk: "medium" },
    { action: "lifecycle_automation", label: "Lifecycle Automation", risk: "medium" },
    { action: "channel_mix_optimizer", label: "Channel Mix Optimizer", risk: "medium" },
    { action: "creative_ab_test", label: "Creative A/B Test Launcher", risk: "low" },
  ],
  prospect: [
    { action: "intent_signal_harvesting", label: "Intent Signal Harvesting", risk: "low" },
    { action: "abm_account_intelligence", label: "ABM Account Intelligence", risk: "medium" },
    { action: "pipeline_velocity_monitor", label: "Pipeline Velocity Monitor", risk: "low" },
    { action: "deal_risk_forecast", label: "Deal Risk Forecast", risk: "medium" },
  ],
  sentinel: [
    { action: "autonomous_incident_response", label: "Autonomous Incident Response", risk: "high" },
    { action: "global_threat_intel_fusion", label: "Global Threat Intel Fusion", risk: "high" },
    { action: "zero_trust_policy_check", label: "Zero Trust Policy Check", risk: "medium" },
    { action: "security_posture_report", label: "Security Posture Report", risk: "medium" },
  ],
  "support-sage": [
    { action: "ticket_triage", label: "Intelligent Ticket Triage", risk: "low" },
    { action: "sla_breach_prevention", label: "SLA Breach Prevention", risk: "medium" },
    { action: "cx_sentiment_heatmap", label: "CX Sentiment Heatmap", risk: "low" },
    { action: "escalation_autopilot", label: "Escalation Autopilot", risk: "medium" },
  ],
  centsible: [
    { action: "driver_based_planning", label: "Driver-Based Planning", risk: "medium" },
    { action: "treasury_liquidity_optimizer", label: "Treasury Liquidity Optimizer", risk: "high" },
    { action: "arr_mrr_analytics", label: "ARR/MRR Analytics", risk: "low" },
    { action: "revenue_leakage_scan", label: "Revenue Leakage Scan", risk: "high" },
  ],
  sage: [
    { action: "macro_monitor", label: "Macro Signal Monitor", risk: "medium" },
    { action: "mna_target_scan", label: "M&A Target Scan", risk: "high" },
    { action: "real_options_model", label: "Real Options Model", risk: "medium" },
    { action: "board_narrative_pack", label: "Board Narrative Pack", risk: "medium" },
  ],
  chronos: [
    { action: "find_meeting_time", label: "AI Meeting Time Finder", risk: "low" },
    { action: "deep_work_guardian", label: "Deep Work Guardian", risk: "low" },
    { action: "time_roi_dashboard", label: "Time ROI Dashboard", risk: "low" },
    { action: "global_fairness_scheduler", label: "Global Fairness Scheduler", risk: "medium" },
  ],
  veritas: [
    { action: "contract_risk_review", label: "Contract Risk Review", risk: "high" },
    { action: "regulatory_radar", label: "Regulatory Radar", risk: "high" },
    { action: "obligation_tracking", label: "Obligation Tracking", risk: "medium" },
    { action: "policy_gap_audit", label: "Policy Gap Audit", risk: "high" },
  ],
  inspect: [
    { action: "test_orchestration", label: "Test Orchestration", risk: "low" },
    { action: "release_readiness_gate", label: "Release Readiness Gate", risk: "medium" },
    { action: "root_cause_analysis", label: "Root Cause Analysis", risk: "low" },
    { action: "compliance_qa_scan", label: "Compliance QA Scan", risk: "medium" },
  ],
  canvas: [
    { action: "brand_guardian_monitor", label: "Brand Guardian Monitor", risk: "medium" },
    { action: "multi_format_production_engine", label: "Multi-Format Production Engine", risk: "low" },
    { action: "cinematic_video_command", label: "Cinematic Video Command", risk: "medium" },
    { action: "voiceover_generation", label: "Voiceover Generation", risk: "low" },
    { action: "creative_roi_attribution", label: "Creative ROI Attribution", risk: "medium" },
  ],
  merchant: [
    { action: "catalog_health_scan", label: "Catalog Health Scan", risk: "medium" },
    { action: "dynamic_pricing_control", label: "Dynamic Pricing Control", risk: "high" },
    { action: "inventory_risk", label: "Inventory Risk", risk: "medium" },
    { action: "abandoned_cart_recovery", label: "Abandoned Cart Recovery", risk: "low" },
  ],
  pulse: [
    { action: "workforce_forecasting", label: "Workforce Forecasting", risk: "medium" },
    { action: "burnout_risk_detection", label: "Burnout Risk Detection", risk: "high" },
    { action: "attrition_prediction", label: "Attrition Prediction", risk: "high" },
    { action: "compensation_fairness_scan", label: "Compensation Fairness Scan", risk: "high" },
  ],
  compass: [
    { action: "trend_detection", label: "Trend Detection", risk: "low" },
    { action: "competitor_action_monitor", label: "Competitor Action Monitor", risk: "medium" },
    { action: "opportunity_alerting", label: "Opportunity Alerting", risk: "medium" },
    { action: "market_briefing", label: "Market Briefing", risk: "low" },
  ],
  part: [
    { action: "partner_discovery", label: "Partner Discovery", risk: "low" },
    { action: "alliance_pipeline", label: "Alliance Pipeline", risk: "medium" },
    { action: "partner_roi_review", label: "Partner ROI Review", risk: "medium" },
    { action: "co_marketing_orchestration", label: "Co-Marketing Orchestration", risk: "medium" },
  ],
  atlas: [
    { action: "create_workflow", label: "Workflow Creation", risk: "medium" },
    { action: "automate_process", label: "Process Automation", risk: "medium" },
    { action: "capacity_forecast", label: "Capacity Forecast", risk: "medium" },
    { action: "workflow_optimization", label: "Workflow Optimization", risk: "medium" },
  ],
  scribe: [
    { action: "semantic_search", label: "Semantic Search", risk: "low" },
    { action: "knowledge_graph_map", label: "Knowledge Graph Map", risk: "medium" },
    { action: "generate_sop", label: "SOP Generator", risk: "low" },
    { action: "knowledge_velocity_report", label: "Knowledge Velocity Report", risk: "low" },
  ],
};

const AGENT_ROLE_MODULES = {
  nexus: [
    { id: "routing_quality", title: "Routing Quality", metric: "ops_success_rate", action: "intent_routing" },
    { id: "federation_workflows", title: "Federated Workflows", metric: "workflow_active", action: "workflow_orchestration" },
    { id: "critical_queue", title: "Approval Queue", metric: "pending_approvals", action: "cross_agent_insights" },
  ],
  maestro: [
    { id: "campaign_velocity", title: "Campaign Velocity", metric: "execution_count", action: "campaign_orchestration" },
    { id: "channel_mix", title: "Channel Mix Confidence", metric: "ops_success_rate", action: "channel_mix_optimizer" },
    { id: "ad_variants", title: "Ad Variant Throughput", metric: "integrations_connected", action: "ad_variant_generator" },
  ],
  prospect: [
    { id: "active_sequences", title: "Active Sequences", metric: "prospect_sequences", action: "outreach_sequence_builder" },
    { id: "pipeline_health", title: "Pipeline Health", metric: "ops_success_rate", action: "pipeline_velocity_monitor" },
    { id: "lead_engine", title: "Lead Engine Runs", metric: "execution_count", action: "lead_discovery" },
  ],
  sentinel: [
    { id: "open_incidents", title: "Open Incidents", metric: "sentinel_open_cases", action: "incident_triage" },
    { id: "containment_reliability", title: "Containment Reliability", metric: "ops_success_rate", action: "autonomous_incident_response" },
    { id: "posture_runs", title: "Posture Scans", metric: "execution_count", action: "security_posture_report" },
  ],
  "support-sage": [
    { id: "sla_reliability", title: "SLA Reliability", metric: "ops_success_rate", action: "sla_monitoring" },
    { id: "ticket_automation", title: "Ticket Automation Runs", metric: "execution_count", action: "ticket_triage" },
    { id: "cx_escalations", title: "CX Escalations", metric: "pending_approvals", action: "escalation_autopilot" },
  ],
  centsible: [
    { id: "cash_forecast_runs", title: "Cash Forecast Runs", metric: "execution_count", action: "cash_flow_forecast" },
    { id: "finance_control", title: "Finance Control Score", metric: "ops_success_rate", action: "budget_variance" },
    { id: "connected_finance_rails", title: "Connected Finance Rails", metric: "integrations_connected", action: "revenue_leakage_scan" },
  ],
  sage: [
    { id: "strategy_simulations", title: "Scenario Simulations", metric: "execution_count", action: "scenario_modeling" },
    { id: "strategy_confidence", title: "Strategy Confidence", metric: "ops_success_rate", action: "strategy_scorecard" },
    { id: "active_initiatives", title: "Active Initiatives", metric: "workflow_active", action: "initiative_prioritization" },
  ],
  chronos: [
    { id: "schedule_efficiency", title: "Scheduling Efficiency", metric: "ops_success_rate", action: "smart_scheduling" },
    { id: "calendar_integrations", title: "Calendar Integrations", metric: "integrations_connected", action: "global_fairness_scheduler" },
    { id: "time_recovery_runs", title: "Time Recovery Runs", metric: "execution_count", action: "meeting_load_audit" },
  ],
  veritas: [
    { id: "contracts_under_watch", title: "Contracts Under Watch", metric: "veritas_contracts", action: "contract_risk_review" },
    { id: "compliance_reliability", title: "Compliance Reliability", metric: "ops_success_rate", action: "compliance_audit" },
    { id: "obligation_checks", title: "Obligation Checks", metric: "execution_count", action: "obligation_tracking" },
  ],
  inspect: [
    { id: "quality_gate_runs", title: "Quality Gate Runs", metric: "execution_count", action: "quality_gate" },
    { id: "release_confidence", title: "Release Confidence", metric: "ops_success_rate", action: "release_readiness_gate" },
    { id: "qa_integrations", title: "QA Integrations", metric: "integrations_connected", action: "test_orchestration" },
  ],
  canvas: [
    { id: "generated_assets", title: "Generated Assets", metric: "canvas_generated_assets", action: "creative_generation" },
    { id: "uploaded_sources", title: "Uploaded Source Media", metric: "canvas_source_assets", action: "multi_format_production_engine" },
    { id: "creative_reliability", title: "Creative Reliability", metric: "ops_success_rate", action: "creative_roi_attribution" },
  ],
  merchant: [
    { id: "catalog_depth", title: "Catalog SKUs", metric: "merchant_catalog_skus", action: "catalog_health_scan" },
    { id: "open_orders", title: "Open Orders", metric: "merchant_open_orders", action: "conversion_optimization" },
    { id: "commerce_reliability", title: "Commerce Reliability", metric: "ops_success_rate", action: "inventory_risk" },
  ],
  pulse: [
    { id: "people_signal_runs", title: "People Signal Runs", metric: "execution_count", action: "sentiment_monitor" },
    { id: "intervention_queue", title: "Intervention Queue", metric: "pending_approvals", action: "burnout_risk_detection" },
    { id: "people_reliability", title: "People Reliability", metric: "ops_success_rate", action: "people_analytics" },
  ],
  compass: [
    { id: "market_scans", title: "Market Scans", metric: "compass_scans", action: "market_briefing" },
    { id: "trend_reliability", title: "Trend Reliability", metric: "ops_success_rate", action: "trend_detection" },
    { id: "intel_runs", title: "Intel Runs", metric: "execution_count", action: "opportunity_alerting" },
  ],
  part: [
    { id: "partner_pipeline_runs", title: "Partner Pipeline Runs", metric: "execution_count", action: "alliance_pipeline" },
    { id: "mail_connectors", title: "Mail Connectors", metric: "integrations_connected", action: "partner_outreach" },
    { id: "alliance_reliability", title: "Alliance Reliability", metric: "ops_success_rate", action: "partner_roi_review" },
  ],
  atlas: [
    { id: "workflow_throughput", title: "Workflow Throughput", metric: "workflow_active", action: "workflow_automation" },
    { id: "ops_stability", title: "Ops Stability", metric: "ops_success_rate", action: "capacity_planning" },
    { id: "automation_runs", title: "Automation Runs", metric: "execution_count", action: "bottleneck_detection" },
  ],
  scribe: [
    { id: "docs_indexed", title: "Indexed Documents", metric: "scribe_docs_indexed", action: "document_indexing" },
    { id: "docs_synced", title: "Cloud Synced Docs", metric: "scribe_docs_synced", action: "cloud_archive_sync" },
    { id: "knowledge_reliability", title: "Knowledge Reliability", metric: "ops_success_rate", action: "semantic_retrieval" },
  ],
};

const AGENT_ANALYTICS_PLAYBOOK = {
  nexus: { northStar: "Orchestration Reliability", fixHint: "stabilize routing + clear approvals", integrationHint: "connect Event Bus + Orchestration Engine + Graph API" },
  maestro: { northStar: "Campaign ROI", fixHint: "improve channel mix + creative velocity", integrationHint: "connect Instagram/TikTok/Meta + email automation" },
  prospect: { northStar: "Pipeline Velocity", fixHint: "tighten lead scoring + sequence performance", integrationHint: "connect CRM + outreach providers" },
  sentinel: { northStar: "Incident Containment Time", fixHint: "reduce unresolved incidents and alert noise", integrationHint: "connect SIEM/identity/security sources" },
  "support-sage": { northStar: "SLA + CSAT", fixHint: "clear backlog and escalate sooner", integrationHint: "connect support desk + comms channels" },
  centsible: { northStar: "Cash Confidence", fixHint: "close variance leaks and monitor runway", integrationHint: "connect accounting + billing + payments" },
  sage: { northStar: "Strategic Confidence", fixHint: "run scenarios before committing budget", integrationHint: "connect warehouse/intel sources" },
  chronos: { northStar: "Time ROI", fixHint: "reduce conflict-heavy schedules", integrationHint: "connect calendars + meeting stack" },
  veritas: { northStar: "Compliance Coverage", fixHint: "review high-risk contracts and obligations", integrationHint: "connect contract + compliance platforms" },
  inspect: { northStar: "Release Readiness", fixHint: "raise pass rate and reduce regressions", integrationHint: "connect CI + test runners + quality telemetry" },
  canvas: { northStar: "Creative Throughput", fixHint: "increase asset conversion by platform", integrationHint: "connect generation/design/media platforms" },
  merchant: { northStar: "Commerce Conversion", fixHint: "reduce stock risk and checkout friction", integrationHint: "connect storefront + payments + shipping" },
  pulse: { northStar: "People Health", fixHint: "address burnout hotspots quickly", integrationHint: "connect HRIS + comms + performance systems" },
  compass: { northStar: "Signal-to-Action Rate", fixHint: "turn trend signals into prioritized actions", integrationHint: "connect market/news/competitor feeds" },
  part: { northStar: "Partner ROI", fixHint: "advance stalled alliances", integrationHint: "connect inbox + partner/affiliate systems" },
  atlas: { northStar: "Operational Throughput", fixHint: "remove bottlenecks and blocked flows", integrationHint: "connect PM/workflow platforms" },
  scribe: { northStar: "Knowledge Retrieval Success", fixHint: "index and sync all critical docs", integrationHint: "connect docs + cloud + vector layer" },
};

const LOCAL_WORKFLOW_PACKS = [
  { id: "sm_content_engine", name: "Influencer Content Engine", business_type: "social media influencer", category: "content", risk: "medium", autonomy_tier: "approve", description: "Trend-to-post workflow with approvals and publishing windows." },
  { id: "brand_deal_pipeline", name: "Brand Deal Pipeline", business_type: "social media influencer", category: "growth", risk: "high", autonomy_tier: "suggest", description: "Discover, qualify, and execute sponsor opportunities end-to-end." },
  { id: "shopify_order_to_cash", name: "Shopify Order-to-Cash", business_type: "shopify online store", category: "commerce", risk: "medium", autonomy_tier: "auto-low-risk", description: "Order processing, fulfillment updates, and payment reconciliation." },
  { id: "shopify_cart_recovery", name: "Abandoned Cart Recovery", business_type: "shopify online store", category: "growth", risk: "low", autonomy_tier: "auto-broad", description: "Automated reminder sequence for abandoned checkout recovery." },
  { id: "ndis_client_intake", name: "NDIS Client Intake", business_type: "ndis provider", category: "intake", risk: "medium", autonomy_tier: "approve", description: "Lead intake, secure document collection, and onboarding tasks." },
  { id: "ndis_claiming_cycle", name: "NDIS Claiming Cycle", business_type: "ndis provider", category: "finance", risk: "high", autonomy_tier: "suggest", description: "Service-to-claim workflow with compliance checks and reconciliation." },
  { id: "referral_partner_growth", name: "Referral Partner Growth", business_type: "services", category: "community", risk: "low", autonomy_tier: "auto-low-risk", description: "Partner discovery, outreach, follow-up, and performance tracking." },
  { id: "compliance_audit_ready", name: "Compliance Audit Readiness", business_type: "regulated business", category: "compliance", risk: "high", autonomy_tier: "suggest", description: "Evidence collection, gap remediation tasks, and audit prep reporting." },
];

function toActionId(label = "") {
  return String(label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function statusClass(status = "idle") {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "needs_attention") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function riskBadgeClass(risk = "low") {
  if (risk === "high") return "bg-red-100 text-red-700";
  if (risk === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function generateMetricValue(key, live, workflows) {
  const base = Math.max(0, String(live?.key_metric || "").length * 3 + (workflows?.length || 0));
  if (key.includes("Health") || key.includes("Score")) return `${80 + (base % 19)}`;
  if (key.includes("Risk")) return `${1 + (base % 7)}`;
  if (key.includes("Rate") || key.includes("Adherence") || key.includes("Compliance")) return `${70 + (base % 29)}%`;
  return `${10 + (base % 91)}`;
}

function metricToNumber(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isFieldSatisfied(value, type = "text") {
  if (type === "checkbox") return Boolean(value);
  if (type === "number") return Number.isFinite(Number(value));
  return String(value ?? "").trim().length > 0;
}

function needReadiness(needId, config = {}) {
  const spec = AGENT_NEED_BLUEPRINTS[needId];
  if (!spec) return { complete: false, progress: 0, total: 0, filled: 0 };
  const fields = spec.fields || [];
  const total = (spec.required || []).length;
  let filled = 0;
  (spec.required || []).forEach((key) => {
    const field = fields.find((x) => x.key === key);
    const value = config[key];
    if (isFieldSatisfied(value, field?.type || "text")) filled += 1;
  });
  const progress = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { complete: total > 0 && filled === total, progress, total, filled };
}

function defaultNeedChecklist(need = {}) {
  const high = String(need?.severity || "").toLowerCase() === "high";
  const base = [
    { key: "owner_assigned", label: "Owner assigned", required: true },
    { key: "validation_executed", label: "Validation executed", required: true },
    { key: "workflow_seeded", label: "Workflow seeded", required: true },
  ];
  if (high) base.push({ key: "rollback_plan_ready", label: "Rollback plan ready", required: true });
  return base;
}

async function fileSha256Hex(file) {
  const input = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", input);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nextAutonomyTier(current = "approve") {
  const idx = TIER_OPTIONS.indexOf(current);
  if (idx < 0) return "approve";
  return TIER_OPTIONS[Math.min(TIER_OPTIONS.length - 1, idx + 1)];
}

function inferToolZone(tool = {}, agentId = "") {
  const txt = `${tool.id || ""} ${tool.label || ""} ${tool.description || ""}`.toLowerCase();
  if (/scan|monitor|detect|check|audit|risk|compliance/.test(txt)) return "intel_and_risk";
  if (/workflow|automation|orchestration|routing|sequence|schedule|queue/.test(txt)) return "execution";
  if (/forecast|score|kpi|analytics|report|brief|insight|retrieval/.test(txt)) return "analytics";
  if (/generate|creative|content|draft|canvas|outreach|campaign/.test(txt)) return "creation";
  if (agentId === "scribe" && /document|index|archive|semantic/.test(txt)) return "knowledge";
  return "core";
}

function zoneLabel(zone) {
  if (zone === "execution") return "Execution Control";
  if (zone === "analytics") return "Analytics and Insights";
  if (zone === "creation") return "Creation and Output";
  if (zone === "intel_and_risk") return "Intel and Risk";
  if (zone === "knowledge") return "Knowledge Systems";
  return "Core Role Tools";
}

function chatCacheKey(agentId) {
  return `${CHAT_CACHE_PREFIX}.${agentId}.v1`;
}

function ComposedAdvancedChart({ agentId, data }) {
  if (["sentinel", "veritas", "inspect"].includes(agentId)) {
    return (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="alpha" stroke="#dc2626" strokeWidth={2} />
        <Line type="monotone" dataKey="beta" stroke="#f59e0b" strokeWidth={2} />
        <Line type="monotone" dataKey="gamma" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    );
  }

  if (["centsible", "merchant", "maestro", "prospect"].includes(agentId)) {
    return (
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area type="monotone" dataKey="alpha" stroke="#16a34a" fill="#86efac" />
        <Area type="monotone" dataKey="beta" stroke="#2563eb" fill="#93c5fd" />
      </AreaChart>
    );
  }

  return (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Bar dataKey="alpha" fill="#2563eb" radius={[5, 5, 0, 0]} />
      <Bar dataKey="beta" fill="#0ea5e9" radius={[5, 5, 0, 0]} />
    </BarChart>
  );
}

const BACKEND_TIMEOUT_MS = 800;
const BACKEND_COOLDOWN_MS = 300000;
let backendBlockedUntil = 0;
let backendDevToken = "";

async function ensureBackendDevToken() {
  if (backendDevToken) return backendDevToken;
  const base = getRemoteBackendBase();
  if (!base) return "";
  const res = await fetch(`${base}/auth/dev-token?role=admin&user_id=${encodeURIComponent(USER_ID)}&tenant_id=${encodeURIComponent(TENANT_ID)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  backendDevToken = String(json?.token || "");
  return backendDevToken;
}

function fetchBackend(path, options = {}, retryAuth = true) {
  if (!hasRemoteBackend()) return Promise.reject(new Error("Remote backend unavailable"));
  const base = getRemoteBackendBase();
  if (!base) return Promise.reject(new Error("No remote backend configured"));
  if (Date.now() < backendBlockedUntil) return Promise.reject(new Error("Remote backend unavailable (cooldown)"));

  const run = async () => {
    const token = await ensureBackendDevToken().catch(() => "");
    const controller = new AbortController();
    const outerSignal = options.signal;
    const onOuterAbort = () => controller.abort();
    if (outerSignal) outerSignal.addEventListener("abort", onOuterAbort, { once: true });

    const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    const requestOptions = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    };

    try {
      const res = await fetch(`${base}${path}`, requestOptions);
      if ((res.status === 401 || res.status === 403) && retryAuth) {
        backendDevToken = "";
        return await fetchBackend(path, options, false);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      backendBlockedUntil = 0;
      return await res.json();
    } catch (err) {
      const isNetworkIssue =
        err?.name === "AbortError" ||
        /Failed to fetch|NetworkError|ERR_|timeout/i.test(String(err?.message || err || ""));
      if (isNetworkIssue) {
        backendBlockedUntil = Date.now() + BACKEND_COOLDOWN_MS;
        markRemoteBackendUnavailable(BACKEND_COOLDOWN_MS);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
    }
  };

  return run();
}

const DETERMINISTIC_ACTIONS = new Set(["social_posting", "email_replies", "document_ingestion", "shop_operations"]);

function makeIdempotencyKey(functionName, action) {
  const stamp = new Date().toISOString().slice(0, 19);
  return `${functionName}:${action}:${stamp}`;
}

function normalizeBackendInvokeResponse(raw = {}) {
  if (!raw || typeof raw !== "object") return { data: { status: "error", error: "Invalid backend response" } };
  if (raw.status === "pending_approval") return { data: raw };
  if (raw.status === "success") return { data: raw.data || raw.result || raw };
  if (raw.status === "suggest_only") return { data: raw };
  if (raw.status === "error") return { data: raw };
  return { data: raw };
}

function deriveExecutionPath({ isRemote, action = "", data = {}, approvalMode = "manual" } = {}) {
  if (!isRemote) return "local";
  if (data?.status === "pending_approval") return "approval-gate";
  if (DETERMINISTIC_ACTIONS.has(String(action || "")) || data?.deterministic) return "backend-deterministic";
  if (approvalMode === "auto") return "backend-guarded-auto";
  return "backend-guarded";
}

function personalizationKey(agentId) {
  return `jarvis.personalization.${agentId}.v1`;
}

function readLocalPersonalization(agentId) {
  const raw = localStorage.getItem(personalizationKey(agentId));
  if (!raw) {
    return {
      brandVoice: "professional",
      objective: "growth",
      channels: "email,social,web",
      autonomyTier: "approve",
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      brandVoice: "professional",
      objective: "growth",
      channels: "email,social,web",
      autonomyTier: "approve",
    };
  }
}

function flattenObjectForDiff(value, path = "", out = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      const next = path ? `${path}[${idx}]` : `[${idx}]`;
      flattenObjectForDiff(item, next, out);
    });
    if (!value.length && path) out[path] = "[]";
    return out;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length && path) out[path] = "{}";
    keys.forEach((key) => {
      const next = path ? `${path}.${key}` : key;
      flattenObjectForDiff(value[key], next, out);
    });
    return out;
  }
  if (path) out[path] = JSON.stringify(value);
  return out;
}

function renderJsonLinesWithPaths(value, rootPath = "") {
  const lines = [];
  const walk = (node, indent, path) => {
    const pad = " ".repeat(indent);
    if (Array.isArray(node)) {
      lines.push({ text: `${pad}[`, path });
      node.forEach((item, idx) => {
        const itemPath = path ? `${path}[${idx}]` : `[${idx}]`;
        if (item && typeof item === "object") {
          walk(item, indent + 2, itemPath);
          if (idx < node.length - 1) lines[lines.length - 1].text += ",";
        } else {
          lines.push({
            text: `${" ".repeat(indent + 2)}${JSON.stringify(item)}${idx < node.length - 1 ? "," : ""}`,
            path: itemPath,
          });
        }
      });
      lines.push({ text: `${pad}]`, path });
      return;
    }
    if (node && typeof node === "object") {
      lines.push({ text: `${pad}{`, path });
      const keys = Object.keys(node);
      keys.forEach((key, idx) => {
        const keyPath = path ? `${path}.${key}` : key;
        const child = node[key];
        if (child && typeof child === "object") {
          lines.push({ text: `${" ".repeat(indent + 2)}"${key}":`, path: keyPath });
          walk(child, indent + 2, keyPath);
          if (idx < keys.length - 1) lines[lines.length - 1].text += ",";
        } else {
          lines.push({
            text: `${" ".repeat(indent + 2)}"${key}": ${JSON.stringify(child)}${idx < keys.length - 1 ? "," : ""}`,
            path: keyPath,
          });
        }
      });
      lines.push({ text: `${pad}}`, path });
      return;
    }
    lines.push({ text: `${pad}${JSON.stringify(node)}`, path });
  };
  walk(value ?? {}, 0, rootPath);
  return lines;
}

export default function AgentWorkspace() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();

  const agentId = normalizeAgentId(params.agentId || "nexus");
  const agent = AGENT_BY_ID[agentId] || AGENT_BY_ID.nexus;
  const availableTabs = AGENT_TAB_SETS[agent.id] || AGENT_TABS;
  const tab = availableTabs.includes(params.tab) ? params.tab : "overview";

  const [chatInput, setChatInput] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatImageModal, setChatImageModal] = useState(null);
  const [chatPendingAction, setChatPendingAction] = useState(null);
  const [chatCandidateActions, setChatCandidateActions] = useState([]);
  const [chatMemory, setChatMemory] = useState({ priorities: [], concerns: [], preferences: [], asset_refs: [], decision_log: [], diagnosis_log: [], playbooks: [], updated_at: "" });
  const [memoryEditor, setMemoryEditor] = useState({ priorities: "", concerns: "", preferences: "" });
  const [memoryEditorDirty, setMemoryEditorDirty] = useState(false);
  const [showChatMemoryPanel, setShowChatMemoryPanel] = useState(false);
  const [chatComposerUploads, setChatComposerUploads] = useState([]);
  const [chatCardInputs, setChatCardInputs] = useState({});
  const [activeChatPlaybook, setActiveChatPlaybook] = useState(null);
  const [playbookEditor, setPlaybookEditor] = useState({ id: "", title: "", summary: "" });
  const [playbookShareTargets, setPlaybookShareTargets] = useState({});
  const [chatTaskState, setChatTaskState] = useState({
    goal: "",
    constraints: [],
    approval_mode: "unspecified",
    mode: "execute",
    last_action: "",
    status: "active",
    turn_count: 0,
    updated_at: new Date().toISOString(),
  });
  const [lastResult, setLastResult] = useState(null);
  const [conversationId, setConversationId] = useState("");
  const [conversationReady, setConversationReady] = useState(false);
  const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [favorites, setFavorites] = useState(() => {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [personalization, setPersonalization] = useState(() => readLocalPersonalization(agent.id));
  const [toolPresets, setToolPresets] = useState([]);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [canvasType, setCanvasType] = useState("image");
  const [canvasTone, setCanvasTone] = useState("bold");
  const [canvasPlatform, setCanvasPlatform] = useState("instagram");
  const [canvasBrief, setCanvasBrief] = useState("");
  const [canvasBankQuery, setCanvasBankQuery] = useState("");
  const [canvasBankFilter, setCanvasBankFilter] = useState("all");
  const [scribeCloudTarget, setScribeCloudTarget] = useState("s3_docs");
  const [scribeDocs, setScribeDocs] = useState(() => {
    const raw = localStorage.getItem(SCRIBE_DOCS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [veritasContracts, setVeritasContracts] = useState(() => {
    const raw = localStorage.getItem(VERITAS_CONTRACTS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [sentinelCases, setSentinelCases] = useState(() => {
    const raw = localStorage.getItem(SENTINEL_CASES_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [merchantCatalog, setMerchantCatalog] = useState(() => {
    const raw = localStorage.getItem(MERCHANT_CATALOG_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [merchantOrders, setMerchantOrders] = useState(() => {
    const raw = localStorage.getItem(MERCHANT_ORDERS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [prospectSequences, setProspectSequences] = useState(() => {
    const raw = localStorage.getItem(PROSPECT_SEQUENCES_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [prospectDraft, setProspectDraft] = useState({ name: "", channel: "email", message: "" });
  const [supportKnowledgeBase, setSupportKnowledgeBase] = useState(() => {
    const raw = localStorage.getItem(SUPPORT_KB_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [supportKbSearch, setSupportKbSearch] = useState("");
  const [supportKbFilter, setSupportKbFilter] = useState("all");
  const [supportKbDraft, setSupportKbDraft] = useState({ title: "", category: "billing", content: "", tags: "" });
  const [prospectAssets, setProspectAssets] = useState(() => {
    const raw = localStorage.getItem(PROSPECT_ASSETS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [prospectAssetSearch, setProspectAssetSearch] = useState("");
  const [prospectAssetFilter, setProspectAssetFilter] = useState("all");
  const [sageLibrary, setSageLibrary] = useState(() => {
    const raw = localStorage.getItem(SAGE_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [sageLibrarySearch, setSageLibrarySearch] = useState("");
  const [sageLibraryFilter, setSageLibraryFilter] = useState("all");
  const [sageDraft, setSageDraft] = useState({ title: "", type: "plan", summary: "", tags: "" });
  const [chronosLibrary, setChronosLibrary] = useState(() => {
    const raw = localStorage.getItem(CHRONOS_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [chronosLibrarySearch, setChronosLibrarySearch] = useState("");
  const [chronosLibraryFilter, setChronosLibraryFilter] = useState("all");
  const [chronosDraft, setChronosDraft] = useState({ name: "", type: "template", details: "", tags: "" });
  const [atlasLibrary, setAtlasLibrary] = useState(() => {
    const raw = localStorage.getItem(ATLAS_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [atlasLibrarySearch, setAtlasLibrarySearch] = useState("");
  const [atlasLibraryFilter, setAtlasLibraryFilter] = useState("all");
  const [atlasDraft, setAtlasDraft] = useState({ name: "", type: "template", summary: "", tags: "" });
  const [scribeLibrary, setScribeLibrary] = useState(() => {
    const raw = localStorage.getItem(SCRIBE_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [scribeLibrarySearch, setScribeLibrarySearch] = useState("");
  const [scribeLibraryFilter, setScribeLibraryFilter] = useState("all");
  const [scribeDraft, setScribeDraft] = useState({ name: "", type: "document", summary: "", tags: "" });
  const [sentinelLibrary, setSentinelLibrary] = useState(() => {
    const raw = localStorage.getItem(SENTINEL_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [sentinelLibrarySearch, setSentinelLibrarySearch] = useState("");
  const [sentinelLibraryFilter, setSentinelLibraryFilter] = useState("all");
  const [sentinelDraft, setSentinelDraft] = useState({ title: "", type: "incident_report", summary: "", tags: "" });
  const [compassLibrary, setCompassLibrary] = useState(() => {
    const raw = localStorage.getItem(COMPASS_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [compassLibrarySearch, setCompassLibrarySearch] = useState("");
  const [compassLibraryFilter, setCompassLibraryFilter] = useState("all");
  const [compassDraft, setCompassDraft] = useState({ name: "", type: "competitor_profile", summary: "", tags: "" });
  const [pulseLibrary, setPulseLibrary] = useState(() => {
    const raw = localStorage.getItem(PULSE_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [pulseLibrarySearch, setPulseLibrarySearch] = useState("");
  const [pulseLibraryFilter, setPulseLibraryFilter] = useState("all");
  const [pulseDraft, setPulseDraft] = useState({ name: "", type: "employee_profile", summary: "", tags: "" });
  const [partLibrary, setPartLibrary] = useState(() => {
    const raw = localStorage.getItem(PART_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [partLibrarySearch, setPartLibrarySearch] = useState("");
  const [partLibraryFilter, setPartLibraryFilter] = useState("all");
  const [partDraft, setPartDraft] = useState({ name: "", type: "partner_profile", summary: "", tags: "" });
  const [merchantLibrary, setMerchantLibrary] = useState(() => {
    const raw = localStorage.getItem(MERCHANT_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [merchantLibrarySearch, setMerchantLibrarySearch] = useState("");
  const [merchantLibraryFilter, setMerchantLibraryFilter] = useState("all");
  const [merchantDraft, setMerchantDraft] = useState({ name: "", type: "product_catalog", summary: "", tags: "" });
  const [inspectLibrary, setInspectLibrary] = useState(() => {
    const raw = localStorage.getItem(INSPECT_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [inspectLibrarySearch, setInspectLibrarySearch] = useState("");
  const [inspectLibraryFilter, setInspectLibraryFilter] = useState("all");
  const [inspectDraft, setInspectDraft] = useState({ name: "", type: "test_case", summary: "", tags: "" });
  const [veritasLibrary, setVeritasLibrary] = useState(() => {
    const raw = localStorage.getItem(VERITAS_LIBRARY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [veritasLibrarySearch, setVeritasLibrarySearch] = useState("");
  const [veritasLibraryFilter, setVeritasLibraryFilter] = useState("all");
  const [veritasDraft, setVeritasDraft] = useState({ title: "", type: "contract", summary: "", tags: "" });
  const [centsibleDocuments, setCentsibleDocuments] = useState(() => {
    const raw = localStorage.getItem(CENTSIBLE_DOCUMENTS_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [centsibleDocumentsSearch, setCentsibleDocumentsSearch] = useState("");
  const [centsibleDocumentsFilter, setCentsibleDocumentsFilter] = useState("all");
  const [centsibleDraft, setCentsibleDraft] = useState({ name: "", type: "report", summary: "", tags: "" });
  const [canvasBank, setCanvasBank] = useState(() => {
    const rawBank = localStorage.getItem(CANVAS_BANK_KEY);
    try {
      return rawBank ? JSON.parse(rawBank) : [];
    } catch {
      return [];
    }
  });
  const [quickWorkflowName, setQuickWorkflowName] = useState("");
  const [quickWorkflowTrigger, setQuickWorkflowTrigger] = useState("manual");
  const [customWorkflowPacks, setCustomWorkflowPacks] = useState([]);
  const [integrationState, setIntegrationState] = useState(() => {
    const raw = localStorage.getItem(`jarvis.agent.integrations.${agent.id}.v1`);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [selectedCanvasMediaIds, setSelectedCanvasMediaIds] = useState([]);
  const [opsHistory, setOpsHistory] = useState(() => {
    const raw = localStorage.getItem(`jarvis.ops.history.${agent.id}.v1`);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [agentNeeds, setAgentNeeds] = useState(() => {
    const base = (AGENT_NEEDS_BACKLOG[agent.id] || []).map((x) => ({ ...x, done: false, updated_at: null }));
    const raw = localStorage.getItem(`${AGENT_NEEDS_KEY_PREFIX}.${agent.id}`);
    try {
      const saved = raw ? JSON.parse(raw) : [];
      const savedMap = new Map((saved || []).map((x) => [x.id, x]));
      return base.map((x) => ({ ...x, ...(savedMap.get(x.id) || {}) }));
    } catch {
      return base;
    }
  });
  const [needImplementation, setNeedImplementation] = useState(() => {
    const raw = localStorage.getItem(`${AGENT_NEED_IMPLEMENTATION_KEY_PREFIX}.${agent.id}`);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [needChecklistState, setNeedChecklistState] = useState(() => {
    const raw = localStorage.getItem(`${AGENT_NEED_CHECKLIST_KEY_PREFIX}.${agent.id}`);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [needChecklistEvidence, setNeedChecklistEvidence] = useState(() => {
    const raw = localStorage.getItem(`${AGENT_NEED_CHECKLIST_EVIDENCE_KEY_PREFIX}.${agent.id}`);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [emailConfig, setEmailConfig] = useState(() => {
    const raw = localStorage.getItem(`${AGENT_EMAIL_CONFIG_KEY_PREFIX}.${agent.id}`);
    try {
      return raw
        ? JSON.parse(raw)
        : {
            senderName: "",
            senderEmail: "",
            sendingDomain: "",
            spfStatus: "pending",
            dkimStatus: "pending",
            dmarcStatus: "pending",
            warmupDaily: 25,
          };
    } catch {
      return {
        senderName: "",
        senderEmail: "",
        sendingDomain: "",
        spfStatus: "pending",
        dkimStatus: "pending",
        dmarcStatus: "pending",
        warmupDaily: 25,
      };
    }
  });
  const tabsScrollRef = useRef(null);
  const [tabsScrollPct, setTabsScrollPct] = useState(0);
  const [tabsScrollable, setTabsScrollable] = useState(false);
  const [linkScanInput, setLinkScanInput] = useState("");
  const [linkScanResults, setLinkScanResults] = useState([]);
  const [functionOutputs, setFunctionOutputs] = useState([]);
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [scheduleDraft, setScheduleDraft] = useState({ id: "", name: "", action: "", cadenceMinutes: "15", enabled: true });
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalMode, setApprovalMode] = useState(() => {
    const raw = localStorage.getItem(APPROVAL_MODE_KEY);
    return raw === "auto" ? "auto" : "manual";
  });
  const [autonomyHistory, setAutonomyHistory] = useState(() => {
    const raw = localStorage.getItem(AUTONOMY_HISTORY_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [releaseGateSuite, setReleaseGateSuite] = useState("deterministic_contracts");
  const [releaseGateResult, setReleaseGateResult] = useState(null);
  const [deterministicAction, setDeterministicAction] = useState("social_posting");
  const [deterministicParamsText, setDeterministicParamsText] = useState('{\n  "platform": "instagram",\n  "content": "New post from ops runner"\n}');
  const [chatSchemaEditorText, setChatSchemaEditorText] = useState("");
  const [chatSchemaEditorError, setChatSchemaEditorError] = useState("");
  const [chatSchemaEditorDirty, setChatSchemaEditorDirty] = useState(false);
  const [selectedSchemaHistoryId, setSelectedSchemaHistoryId] = useState("");
  const [connectorWizardKey, setConnectorWizardKey] = useState("");
  const [connectorConfigText, setConnectorConfigText] = useState("{}");
  const [connectorSecretsText, setConnectorSecretsText] = useState("{}");
  const [connectorWizardError, setConnectorWizardError] = useState("");
  const [connectorWizardBulkSummary, setConnectorWizardBulkSummary] = useState("");
  const chatUploadInputRef = useRef(null);


  const registry = useQuery({
    queryKey: ["agent_registry_status_ui"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "agent_registry_status" });
      return res.data?.result || {};
    },
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  const capabilitiesQuery = useQuery({
    queryKey: ["agent_capabilities", agent.name],
    queryFn: async () => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", { action: "list_capabilities" });
      const entries = res.data?.agents || [];
      return (entries.find((x) => x.agent_name === agent.name)?.capabilities || []).map((c) => ({
        ...c,
        id: c.id,
      }));
    },
    staleTime: 120_000,
  });

  const workflowsQuery = useQuery({
    queryKey: ["workspace_workflows"],
    queryFn: async () => await base44.entities.Workflow.list("-created_date"),
    staleTime: 15_000,
  });

  const templatesQuery = useQuery({
    queryKey: ["workspace_templates"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/workflow-templates");
      return res?.result?.templates || [];
    },
    staleTime: 60_000,
  });

  const autonomyQuery = useQuery({
    queryKey: ["workspace_autonomy_matrix"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/autonomy/matrix");
      return res?.result || {};
    },
    staleTime: 60_000,
  });

  const reliabilityQuery = useQuery({
    queryKey: ["phase6_reliability_snapshot"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v4/reliability");
      return res?.result || {};
    },
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  const actionContractsQuery = useQuery({
    queryKey: ["phase6_action_contracts"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v7/contracts");
      return res?.result?.contracts || [];
    },
    staleTime: 120_000,
  });

  const deterministicRunsQuery = useQuery({
    queryKey: ["phase6_deterministic_runs"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v7/actions/runs?limit=100");
      return res?.result?.runs || [];
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const deadLettersQuery = useQuery({
    queryKey: ["phase6_dead_letters"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v7/actions/dead-letters?limit=100");
      return res?.result?.dead_letters || [];
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const userProfileQuery = useQuery({
    queryKey: ["phase4_user_profile", USER_ID],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchUserProfileRemote(USER_ID);
      return res?.result?.profile || {};
    },
    staleTime: 30_000,
  });

  const remoteFavoritesQuery = useQuery({
    queryKey: ["phase4_user_favorites", USER_ID],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchUserFavoritesRemote(USER_ID);
      return res?.result?.favorites || [];
    },
    staleTime: 30_000,
  });

  const remotePersonalizationQuery = useQuery({
    queryKey: ["phase4_user_personalization", USER_ID, agent.id],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchUserPersonalizationRemote(USER_ID, agent.id);
      return res?.result?.personalization || {};
    },
    staleTime: 30_000,
  });

  const remotePresetsQuery = useQuery({
    queryKey: ["phase4_tool_presets", USER_ID, agent.id],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchToolPresetsRemote(USER_ID, agent.id);
      return res?.result?.presets || [];
    },
    staleTime: 30_000,
  });

  const remoteMemoryQuery = useQuery({
    queryKey: ["phase4_agent_memory", USER_ID, agent.id],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchAgentMemoryRemote(USER_ID, agent.id);
      return res?.result?.memory || {};
    },
    staleTime: 30_000,
  });

  const chatSchemaQuery = useQuery({
    queryKey: ["chat_schema_registry", agent.id],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend(`/v1/chat/schema/${encodeURIComponent(agent.id)}`);
      return res?.result || null;
    },
    staleTime: 60_000,
  });

  const chatSchemaHistoryQuery = useQuery({
    queryKey: ["chat_schema_history"],
    enabled: hasRemoteBackend() && agent.id === "nexus",
    queryFn: async () => {
      const res = await fetchBackend("/v1/chat/schema-history?limit=40");
      return res?.result || { entries: [], count: 0 };
    },
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  const connectorWizardQuery = useQuery({
    queryKey: ["connector_wizard_catalog"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v3/connectors");
      return res?.result || { connectors: [], summary: { total: 0, ready: 0, pending: 0 } };
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const connectorTemplateQuery = useQuery({
    queryKey: ["connector_wizard_templates"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v3/connectors/templates");
      return res?.result || { templates: [] };
    },
    staleTime: 60_000,
  });

  const autonomyRuntimeQuery = useQuery({
    queryKey: ["autonomy_runtime_status"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/autonomy/runtime");
      return res?.result || null;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const autonomyQueueQuery = useQuery({
    queryKey: ["autonomy_queue"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/autonomy/queue?limit=200");
      return res?.result || { jobs: [] };
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const autonomySchedulesQuery = useQuery({
    queryKey: ["autonomy_schedules"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/autonomy/schedules?limit=200");
      return res?.result || { schedules: [] };
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const deterministicAuditQuery = useQuery({
    queryKey: ["deterministic_audit"],
    enabled: hasRemoteBackend() && agent.id === "nexus",
    queryFn: async () => {
      const res = await fetchBackend("/v1/agents/deterministic-audit");
      return res?.result || null;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const aiProviderSettingsQuery = useQuery({
    queryKey: ["ai_provider_settings", agent.id],
    enabled: hasRemoteBackend() && (agent.id === "nexus" || agent.id === "canvas"),
    queryFn: async () => {
      const res = await fetchBackend("/v1/ai/providers/settings");
      return res?.result || null;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const [aiProviderDraft, setAiProviderDraft] = useState({
    chat: {
      provider: "fallback",
      model: "gemini-2.5-flash",
      model_lite: "gemini-2.5-flash-lite",
      model_standard: "gemini-2.5-flash",
      model_premium: "gemini-2.5-pro",
      base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
      api_key: "",
    },
    image: { provider: "fallback", model: "gpt-image-1.5", base_url: "https://api.openai.com/v1", api_key: "", size: "1024x1024", quality: "high" },
    voice: { provider: "fallback", model: "gpt-4o-mini-tts", base_url: "https://api.openai.com/v1", api_key: "", voice: "alloy" },
    video: { provider: "fallback", model: "sora-1", base_url: "https://api.openai.com/v1", api_key: "", quality: "high" },
    agent_overrides: {},
  });
  const [aiProviderMessage, setAiProviderMessage] = useState("");

  useEffect(() => {
    if (!["nexus", "canvas"].includes(agent.id)) return;
    const editable = aiProviderSettingsQuery.data?.editable;
    if (!editable) return;
    setAiProviderDraft({
      chat: {
        provider: editable.chat?.provider || "fallback",
        model: editable.chat?.model || "gemini-2.5-flash",
        model_lite: editable.chat?.model_lite || "gemini-2.5-flash-lite",
        model_standard: editable.chat?.model_standard || editable.chat?.model || "gemini-2.5-flash",
        model_premium: editable.chat?.model_premium || "gemini-2.5-pro",
        base_url: editable.chat?.base_url || "https://generativelanguage.googleapis.com/v1beta/openai/",
        api_key: editable.chat?.api_key || "",
      },
      image: {
        provider: editable.image?.provider || "fallback",
        model: editable.image?.model || "gpt-image-1.5",
        base_url: editable.image?.base_url || "https://api.openai.com/v1",
        api_key: editable.image?.api_key || "",
        size: editable.image?.size || "1024x1024",
        quality: editable.image?.quality || "high",
      },
      voice: {
        provider: editable.voice?.provider || "fallback",
        model: editable.voice?.model || "gpt-4o-mini-tts",
        base_url: editable.voice?.base_url || "https://api.openai.com/v1",
        api_key: editable.voice?.api_key || "",
        voice: editable.voice?.voice || "alloy",
      },
      video: {
        provider: editable.video?.provider || "fallback",
        model: editable.video?.model || "sora-1",
        base_url: editable.video?.base_url || "https://api.openai.com/v1",
        api_key: editable.video?.api_key || "",
        quality: editable.video?.quality || "high",
      },
      agent_overrides: editable.agent_overrides || {},
    });
  }, [agent.id, aiProviderSettingsQuery.data]);

  const updateAgentProviderOverride = (agentKey, lane, field, value) => {
    setAiProviderDraft((prev) => ({
      ...prev,
      agent_overrides: {
        ...(prev.agent_overrides || {}),
        [agentKey]: {
          ...((prev.agent_overrides || {})[agentKey] || {}),
          [lane]: {
            ...(((prev.agent_overrides || {})[agentKey] || {})[lane] || {}),
            [field]: value,
          },
        },
      },
    }));
  };

  const saveAiProviderSettingsMutation = useMutation({
    mutationFn: async () => {
      return await fetchBackend("/v1/ai/providers/settings", {
        method: "POST",
        body: JSON.stringify({ settings: aiProviderDraft }),
      });
    },
    onSuccess: (res) => {
      const result = res?.result || {};
      const editable = result?.editable || {};
      if (editable && typeof editable === "object" && Object.keys(editable).length) {
        setAiProviderDraft((prev) => ({
          ...prev,
          ...editable,
        }));
      }
      queryClient.setQueryData(["ai_provider_settings"], result);
      const selectedProvider = String(aiProviderDraft?.chat?.provider || "").toLowerCase();
      const expectedLive = selectedProvider && selectedProvider !== "fallback" && String(aiProviderDraft?.chat?.api_key || "").trim();
      if (expectedLive && !result?.chat?.configured) {
        setAiProviderMessage("Provider settings reached the backend, but the chat API key did not persist. Paste it again and press Save.");
      } else {
        setAiProviderMessage("AI provider settings saved.");
      }
      queryClient.invalidateQueries({ queryKey: ["ai_provider_settings"] });
    },
    onError: (err) => setAiProviderMessage(String(err?.message || "Failed to save AI provider settings")),
  });

  const testAiProviderMutation = useMutation({
    mutationFn: async ({ kind, agentId = "" }) => {
      return await fetchBackend("/v1/ai/providers/test", {
        method: "POST",
        body: JSON.stringify({ kind, agent_id: agentId }),
      });
    },
    onSuccess: (res, variables) => {
      const kind = variables?.kind || "provider";
      const agentLabel = variables?.agentId ? ` for ${AGENT_BY_ID[variables.agentId]?.name || variables.agentId}` : "";
      const ok = Boolean(res?.result?.ok);
      setAiProviderMessage(ok ? `${kind} provider test passed${agentLabel}.` : `${kind} provider test failed${agentLabel}: ${res?.result?.reason || res?.result?.reply || "unavailable"}`);
      queryClient.invalidateQueries({ queryKey: ["ai_provider_settings"] });
    },
    onError: (err, variables) => {
      const kind = variables?.kind || "provider";
      const agentLabel = variables?.agentId ? ` for ${AGENT_BY_ID[variables.agentId]?.name || variables.agentId}` : "";
      setAiProviderMessage(`${kind} provider test failed${agentLabel}: ${String(err?.message || "unknown error")}`);
    },
  });

  const autonomyQueueJobs = useMemo(() => {
    const jobs = autonomyQueueQuery.data?.jobs || [];
    const fn = agent.functionName;
    return jobs.filter((job) => String(job.function_name || "") === String(fn || ""));
  }, [autonomyQueueQuery.data, agent.functionName]);

  const autonomySchedules = useMemo(() => {
    const schedules = autonomySchedulesQuery.data?.schedules || [];
    const fn = agent.functionName;
    return schedules.filter((schedule) => String(schedule.function_name || "") === String(fn || ""));
  }, [autonomySchedulesQuery.data, agent.functionName]);

  const queueActionMutation = useMutation({
    mutationFn: async ({ type, jobId }) => {
      if (type === "retry") {
        return await fetchBackend(`/v1/autonomy/queue/${encodeURIComponent(jobId)}/retry`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
      throw new Error(`Unsupported queue action: ${type}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autonomy_queue"] });
      queryClient.invalidateQueries({ queryKey: ["autonomy_runtime_status"] });
    },
  });

  const tickAutonomyRuntimeMutation = useMutation({
    mutationFn: async () => await fetchBackend("/v1/autonomy/runtime/tick", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autonomy_queue"] });
      queryClient.invalidateQueries({ queryKey: ["autonomy_runtime_status"] });
      queryClient.invalidateQueries({ queryKey: ["autonomy_schedules"] });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const cadenceMinutes = Math.max(1, Number(scheduleDraft.cadenceMinutes || 15));
      return await fetchBackend("/v1/autonomy/schedules", {
        method: "POST",
        body: JSON.stringify({
          schedule: {
            id: scheduleDraft.id || undefined,
            name: scheduleDraft.name || `${agent.name} schedule`,
            function_name: agent.functionName,
            action: scheduleDraft.action || "run",
            cadence_ms: cadenceMinutes * 60 * 1000,
            enabled: scheduleDraft.enabled !== false,
          },
        }),
      });
    },
    onSuccess: () => {
      setScheduleDraft({ id: "", name: "", action: "", cadenceMinutes: "15", enabled: true });
      queryClient.invalidateQueries({ queryKey: ["autonomy_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["autonomy_runtime_status"] });
    },
  });

  useEffect(() => {
    if (!chatSchemaQuery.data || chatSchemaEditorDirty) return;
    const payload = {
      version: chatSchemaQuery.data.version || "1.0.0",
      common: chatSchemaQuery.data.common || { fields: {}, actions: {} },
      agents: chatSchemaQuery.data.agents || {},
    };
    setChatSchemaEditorText(JSON.stringify(payload, null, 2));
    setChatSchemaEditorError("");
  }, [chatSchemaQuery.data, chatSchemaEditorDirty]);

  useEffect(() => {
    if (agent.id !== "nexus") return;
    const entries = chatSchemaHistoryQuery.data?.entries || [];
    if (!entries.length) {
      setSelectedSchemaHistoryId("");
      return;
    }
    if (!selectedSchemaHistoryId || !entries.some((x) => x.id === selectedSchemaHistoryId)) {
      setSelectedSchemaHistoryId(entries[0].id);
    }
  }, [agent.id, chatSchemaHistoryQuery.data, selectedSchemaHistoryId]);

  useEffect(() => {
    if (agent.id !== "nexus") return;
    const rows = connectorWizardQuery.data?.connectors || [];
    if (!rows.length) {
      setConnectorWizardKey("");
      setConnectorConfigText("{}");
      setConnectorSecretsText("{}");
      return;
    }
    const activeKey = rows.some((x) => x.key === connectorWizardKey) ? connectorWizardKey : rows[0].key;
    if (activeKey !== connectorWizardKey) setConnectorWizardKey(activeKey);
    const active = rows.find((x) => x.key === activeKey) || rows[0];
    setConnectorConfigText(JSON.stringify(active?.connector || {}, null, 2));
    setConnectorSecretsText(JSON.stringify(active?.secret_refs || {}, null, 2));
  }, [agent.id, connectorWizardQuery.data, connectorWizardKey]);

  useEffect(() => {
    let disposed = false;
    setConversationId("");
    setConversationReady(false);
    setRemoteSyncEnabled(false);
    setChatSchemaEditorDirty(false);
    setChatSchemaEditorError("");
    setSelectedSchemaHistoryId("");
    setConnectorWizardError("");
    setConnectorWizardKey("");
    setConnectorWizardBulkSummary("");
    setScheduleDraft({ id: "", name: "", action: "", cadenceMinutes: "15", enabled: true });
    try {
      const rawPending = localStorage.getItem(`${CHAT_PENDING_ACTION_KEY_PREFIX}.${agent.id}`);
      setChatPendingAction(rawPending ? JSON.parse(rawPending) : null);
    } catch {
      setChatPendingAction(null);
    }
    try {
      const rawTask = localStorage.getItem(`${CHAT_TASK_STATE_KEY_PREFIX}.${agent.id}`);
      setChatTaskState(
        rawTask
          ? { ...chatTaskState, ...JSON.parse(rawTask) }
          : {
              goal: "",
              constraints: [],
              approval_mode: "unspecified",
              mode: "execute",
              last_action: "",
              status: "active",
              turn_count: 0,
              updated_at: new Date().toISOString(),
            }
      );
    } catch {
      setChatTaskState({
        goal: "",
        constraints: [],
        approval_mode: "unspecified",
        mode: "execute",
        last_action: "",
        status: "active",
        turn_count: 0,
        updated_at: new Date().toISOString(),
      });
    }
    try {
      const rawCandidates = localStorage.getItem(`${CHAT_CANDIDATE_ACTIONS_KEY_PREFIX}.${agent.id}`);
      setChatCandidateActions(rawCandidates ? JSON.parse(rawCandidates) : []);
    } catch {
      setChatCandidateActions([]);
    }
    try {
      setChatMemory(readLocalChatMemory(agent.id));
    } catch {
      setChatMemory({ priorities: [], concerns: [], preferences: [], asset_refs: [], decision_log: [], diagnosis_log: [], playbooks: [], default_playbook_id: "", updated_at: "" });
    }
    try {
      const rawCustomPacks = localStorage.getItem(`${CUSTOM_WORKFLOW_PACKS_KEY_PREFIX}.${agent.id}`);
      setCustomWorkflowPacks(rawCustomPacks ? JSON.parse(rawCustomPacks) : []);
    } catch {
      setCustomWorkflowPacks([]);
    }
    setActiveChatPlaybook(null);
    setPlaybookEditor({ id: "", title: "", summary: "" });
    setChatCardInputs({});
    setChatComposerUploads([]);
    try {
      const rawMsgs = localStorage.getItem(chatCacheKey(agent.id));
      setMessages(rawMsgs ? JSON.parse(rawMsgs) : []);
    } catch {
      setMessages([]);
    }
    const rawIntegrations = localStorage.getItem(`jarvis.agent.integrations.${agent.id}.v1`);
    try {
      setIntegrationState(rawIntegrations ? JSON.parse(rawIntegrations) : {});
    } catch {
      setIntegrationState({});
    }
    const rawHistory = localStorage.getItem(`jarvis.ops.history.${agent.id}.v1`);
    try {
      setOpsHistory(rawHistory ? JSON.parse(rawHistory) : []);
    } catch {
      setOpsHistory([]);
    }
    const rawNeeds = localStorage.getItem(`${AGENT_NEEDS_KEY_PREFIX}.${agent.id}`);
    try {
      const baseNeeds = (AGENT_NEEDS_BACKLOG[agent.id] || []).map((x) => ({ ...x, done: false, updated_at: null }));
      const savedNeeds = rawNeeds ? JSON.parse(rawNeeds) : [];
      const savedMap = new Map((savedNeeds || []).map((x) => [x.id, x]));
      setAgentNeeds(baseNeeds.map((x) => ({ ...x, ...(savedMap.get(x.id) || {}) })));
    } catch {
      setAgentNeeds((AGENT_NEEDS_BACKLOG[agent.id] || []).map((x) => ({ ...x, done: false, updated_at: null })));
    }
    const rawNeedImpl = localStorage.getItem(`${AGENT_NEED_IMPLEMENTATION_KEY_PREFIX}.${agent.id}`);
    try {
      setNeedImplementation(rawNeedImpl ? JSON.parse(rawNeedImpl) : {});
    } catch {
      setNeedImplementation({});
    }
    const rawNeedChecklist = localStorage.getItem(`${AGENT_NEED_CHECKLIST_KEY_PREFIX}.${agent.id}`);
    try {
      setNeedChecklistState(rawNeedChecklist ? JSON.parse(rawNeedChecklist) : {});
    } catch {
      setNeedChecklistState({});
    }
    const rawNeedChecklistEvidence = localStorage.getItem(`${AGENT_NEED_CHECKLIST_EVIDENCE_KEY_PREFIX}.${agent.id}`);
    try {
      setNeedChecklistEvidence(rawNeedChecklistEvidence ? JSON.parse(rawNeedChecklistEvidence) : {});
    } catch {
      setNeedChecklistEvidence({});
    }
    const rawEmail = localStorage.getItem(`${AGENT_EMAIL_CONFIG_KEY_PREFIX}.${agent.id}`);
    try {
      setEmailConfig(
        rawEmail
          ? JSON.parse(rawEmail)
          : {
              senderName: "",
              senderEmail: "",
              sendingDomain: "",
              spfStatus: "pending",
              dkimStatus: "pending",
              dmarcStatus: "pending",
              warmupDaily: 25,
            }
      );
    } catch {
      setEmailConfig({
        senderName: "",
        senderEmail: "",
        sendingDomain: "",
        spfStatus: "pending",
        dkimStatus: "pending",
        dmarcStatus: "pending",
        warmupDaily: 25,
      });
    }
    setFunctionOutputs([]);
    setWorkflowRuns([]);
    if (hasRemoteBackend()) {
      Promise.allSettled([
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/integrations`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/ops-history`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/function-outputs`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/workflow-runs`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/chat-log`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-implementation`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-checklists`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-checklist-evidence`),
        fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/email-config`),
      ]).then(([integrationRes, historyRes, outputsRes, runsRes, chatRes, needsRes, needImplRes, needChecklistRes, needChecklistEvidenceRes, emailConfigRes]) => {
        if (disposed) return;
        const settled = [
          integrationRes,
          historyRes,
          outputsRes,
          runsRes,
          chatRes,
          needsRes,
          needImplRes,
          needChecklistRes,
          needChecklistEvidenceRes,
          emailConfigRes,
        ];
        const hasSuccess = settled.some((x) => x?.status === "fulfilled");
        setRemoteSyncEnabled(hasSuccess);
        if (!hasSuccess) markRemoteBackendUnavailable(BACKEND_COOLDOWN_MS);
        if (integrationRes.status === "fulfilled") {
          const integrations = integrationRes.value?.result?.integrations;
          if (integrations && typeof integrations === "object") setIntegrationState(integrations);
        }
        if (historyRes.status === "fulfilled") {
          const history = historyRes.value?.result?.history;
          if (Array.isArray(history)) setOpsHistory(history);
        }
        if (outputsRes?.status === "fulfilled") {
          const outputs = outputsRes.value?.result?.outputs;
          if (Array.isArray(outputs)) setFunctionOutputs(outputs);
        }
        if (runsRes?.status === "fulfilled") {
          const runs = runsRes.value?.result?.runs;
          if (Array.isArray(runs)) setWorkflowRuns(runs);
        }
        if (chatRes?.status === "fulfilled") {
          const remoteMsgs = chatRes.value?.result?.messages;
          if (Array.isArray(remoteMsgs) && remoteMsgs.length) setMessages(remoteMsgs);
        }
        if (needsRes?.status === "fulfilled") {
          const remoteNeeds = Array.isArray(needsRes.value?.result?.items) ? needsRes.value.result.items : [];
          if (remoteNeeds.length) {
            const baseNeeds = (AGENT_NEEDS_BACKLOG[agent.id] || []).map((x) => ({ ...x, done: false, updated_at: null }));
            const remoteMap = new Map(remoteNeeds.map((x) => [x.id, x]));
            setAgentNeeds(baseNeeds.map((x) => ({ ...x, ...(remoteMap.get(x.id) || {}) })));
          }
        }
        if (needImplRes?.status === "fulfilled") {
          const remoteNeedImpl = needImplRes.value?.result?.items;
          if (remoteNeedImpl && typeof remoteNeedImpl === "object") setNeedImplementation(remoteNeedImpl);
        }
        if (needChecklistRes?.status === "fulfilled") {
          const remoteNeedChecklist = needChecklistRes.value?.result?.items;
          if (remoteNeedChecklist && typeof remoteNeedChecklist === "object") setNeedChecklistState(remoteNeedChecklist);
        }
        if (needChecklistEvidenceRes?.status === "fulfilled") {
          const remoteNeedChecklistEvidence = needChecklistEvidenceRes.value?.result?.items;
          if (remoteNeedChecklistEvidence && typeof remoteNeedChecklistEvidence === "object") setNeedChecklistEvidence(remoteNeedChecklistEvidence);
        }
        if (emailConfigRes?.status === "fulfilled") {
          const remoteEmailConfig = emailConfigRes.value?.result?.config;
          if (remoteEmailConfig && typeof remoteEmailConfig === "object") setEmailConfig((prev) => ({ ...(prev || {}), ...remoteEmailConfig }));
        }
      }).catch(() => {
        if (disposed) return;
        setRemoteSyncEnabled(false);
        markRemoteBackendUnavailable(BACKEND_COOLDOWN_MS);
      });
    }
    if (!hasRemoteBackend()) {
      setPersonalization(readLocalPersonalization(agent.id));
      setRemoteSyncEnabled(false);
    }
    return () => {
      disposed = true;
    };
  }, [agent.id]);

  useEffect(() => {
    if (hasRemoteBackend() && Array.isArray(remoteFavoritesQuery.data)) setFavorites(remoteFavoritesQuery.data);
  }, [remoteFavoritesQuery.data]);

  useEffect(() => {
    if (hasRemoteBackend() && remotePersonalizationQuery.data && typeof remotePersonalizationQuery.data === "object") {
      setPersonalization((prev) => ({ ...prev, ...remotePersonalizationQuery.data }));
    }
  }, [remotePersonalizationQuery.data]);

  useEffect(() => {
    if (hasRemoteBackend() && remoteMemoryQuery.data && typeof remoteMemoryQuery.data === "object") {
      setChatMemory((prev) => ({ ...(prev || {}), ...remoteMemoryQuery.data }));
    }
  }, [remoteMemoryQuery.data]);

  useEffect(() => {
    try {
      localStorage.setItem(`${CUSTOM_WORKFLOW_PACKS_KEY_PREFIX}.${agent.id}`, JSON.stringify(customWorkflowPacks || []));
    } catch {
      // ignore local storage write failures
    }
  }, [agent.id, customWorkflowPacks]);

  useEffect(() => {
    const playbooks = Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks.map(normalizePlaybook).filter(Boolean) : [];
    const preferredId = String(chatMemory?.default_playbook_id || "").trim();
    const preferred = preferredId ? playbooks.find((item) => item.id === preferredId) : null;
    if (activeChatPlaybook && playbooks.some((item) => item.id === activeChatPlaybook.id)) return;
    setActiveChatPlaybook(preferred || null);
  }, [agent.id, chatMemory?.default_playbook_id, chatMemory?.playbooks]);

  useEffect(() => {
    if (hasRemoteBackend() && Array.isArray(remotePresetsQuery.data)) setToolPresets(remotePresetsQuery.data);
  }, [remotePresetsQuery.data]);

  useEffect(() => {
    setSelectedCanvasMediaIds((prev) => prev.filter((id) => canvasBank.some((x) => x.id === id)));
  }, [canvasBank]);

  useEffect(() => {
    const local = localStorage.getItem(BUSINESS_PROFILE_KEY);
    if (local) {
      try {
        setBusinessProfile(JSON.parse(local));
      } catch {
        setBusinessProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasRemoteBackend()) return;
    const settings = userProfileQuery.data?.settings || {};
    const bp = settings.business_profile;
    if (bp && typeof bp === "object") setBusinessProfile(bp);
  }, [userProfileQuery.data]);

  useEffect(() => {
    localStorage.setItem(CANVAS_BANK_KEY, JSON.stringify(canvasBank));
  }, [canvasBank]);

  useEffect(() => {
    if (!remoteSyncEnabled || agent.id !== "canvas") return;
    fetchBackend("/v6/canvas/assets", { method: "POST", body: JSON.stringify({ assets: canvasBank }) }).catch(() => {});
  }, [agent.id, canvasBank, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(SCRIBE_DOCS_KEY, JSON.stringify(scribeDocs.slice(0, 500)));
  }, [scribeDocs]);

  useEffect(() => {
    localStorage.setItem(VERITAS_CONTRACTS_KEY, JSON.stringify(veritasContracts.slice(0, 500)));
  }, [veritasContracts]);

  useEffect(() => {
    localStorage.setItem(SENTINEL_CASES_KEY, JSON.stringify(sentinelCases.slice(0, 500)));
  }, [sentinelCases]);

  useEffect(() => {
    localStorage.setItem(MERCHANT_CATALOG_KEY, JSON.stringify(merchantCatalog.slice(0, 500)));
  }, [merchantCatalog]);

  useEffect(() => {
    localStorage.setItem(MERCHANT_ORDERS_KEY, JSON.stringify(merchantOrders.slice(0, 500)));
  }, [merchantOrders]);

  useEffect(() => {
    localStorage.setItem(PROSPECT_SEQUENCES_KEY, JSON.stringify(prospectSequences.slice(0, 500)));
  }, [prospectSequences]);

  useEffect(() => {
    localStorage.setItem(SUPPORT_KB_KEY, JSON.stringify(supportKnowledgeBase.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "support-sage") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/knowledge-base`, {
        method: "POST",
        body: JSON.stringify({ articles: supportKnowledgeBase.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, supportKnowledgeBase, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(PROSPECT_ASSETS_KEY, JSON.stringify(prospectAssets.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "prospect") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/assets`, {
        method: "POST",
        body: JSON.stringify({ assets: prospectAssets.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, prospectAssets, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(SAGE_LIBRARY_KEY, JSON.stringify(sageLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "sage") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/strategy-library`, {
        method: "POST",
        body: JSON.stringify({ items: sageLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, sageLibrary, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(CHRONOS_LIBRARY_KEY, JSON.stringify(chronosLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "chronos") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/schedule-library`, {
        method: "POST",
        body: JSON.stringify({ items: chronosLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, chronosLibrary, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(ATLAS_LIBRARY_KEY, JSON.stringify(atlasLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "atlas") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/workflow-library`, {
        method: "POST",
        body: JSON.stringify({ items: atlasLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, atlasLibrary, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(SCRIBE_LIBRARY_KEY, JSON.stringify(scribeLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "scribe") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/knowledge-library`, {
        method: "POST",
        body: JSON.stringify({ items: scribeLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, scribeLibrary, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(SENTINEL_LIBRARY_KEY, JSON.stringify(sentinelLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "sentinel") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/security-library`, {
        method: "POST",
        body: JSON.stringify({ items: sentinelLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, sentinelLibrary, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(COMPASS_LIBRARY_KEY, JSON.stringify(compassLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "compass") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/market-library`, {
        method: "POST",
        body: JSON.stringify({ items: compassLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, compassLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(PULSE_LIBRARY_KEY, JSON.stringify(pulseLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "pulse") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/people-library`, {
        method: "POST",
        body: JSON.stringify({ items: pulseLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, pulseLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(PART_LIBRARY_KEY, JSON.stringify(partLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "part") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/partnership-library`, {
        method: "POST",
        body: JSON.stringify({ items: partLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, partLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(MERCHANT_LIBRARY_KEY, JSON.stringify(merchantLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "merchant") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/commerce-library`, {
        method: "POST",
        body: JSON.stringify({ items: merchantLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, merchantLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(INSPECT_LIBRARY_KEY, JSON.stringify(inspectLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "inspect") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/quality-library`, {
        method: "POST",
        body: JSON.stringify({ items: inspectLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, inspectLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(VERITAS_LIBRARY_KEY, JSON.stringify(veritasLibrary.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "veritas") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/legal-library`, {
        method: "POST",
        body: JSON.stringify({ items: veritasLibrary.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, veritasLibrary, remoteSyncEnabled]);
  useEffect(() => {
    localStorage.setItem(CENTSIBLE_DOCUMENTS_KEY, JSON.stringify(centsibleDocuments.slice(0, 1000)));
    if (remoteSyncEnabled && agent.id === "centsible") {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/documents`, {
        method: "POST",
        body: JSON.stringify({ items: centsibleDocuments.slice(0, 1000) }),
      }).catch(() => {});
    }
  }, [agent.id, centsibleDocuments, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`jarvis.ops.history.${agent.id}.v1`, JSON.stringify(opsHistory.slice(0, 100)));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/ops-history`, {
        method: "POST",
        body: JSON.stringify({ history: opsHistory.slice(0, 300) }),
      }).catch(() => {});
    }
  }, [agent.id, opsHistory, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${AGENT_NEEDS_KEY_PREFIX}.${agent.id}`, JSON.stringify(agentNeeds.slice(0, 200)));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs`, {
        method: "POST",
        body: JSON.stringify({ items: agentNeeds.slice(0, 200) }),
      }).catch(() => {});
    }
  }, [agent.id, agentNeeds, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${AGENT_NEED_IMPLEMENTATION_KEY_PREFIX}.${agent.id}`, JSON.stringify(needImplementation || {}));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-implementation`, {
        method: "POST",
        body: JSON.stringify({ items: needImplementation || {} }),
      }).catch(() => {});
    }
  }, [agent.id, needImplementation, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${AGENT_NEED_CHECKLIST_KEY_PREFIX}.${agent.id}`, JSON.stringify(needChecklistState || {}));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-checklists`, {
        method: "POST",
        body: JSON.stringify({ items: needChecklistState || {} }),
      }).catch(() => {});
    }
  }, [agent.id, needChecklistState, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${AGENT_NEED_CHECKLIST_EVIDENCE_KEY_PREFIX}.${agent.id}`, JSON.stringify(needChecklistEvidence || {}));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/needs-checklist-evidence`, {
        method: "POST",
        body: JSON.stringify({ items: needChecklistEvidence || {} }),
      }).catch(() => {});
    }
  }, [agent.id, needChecklistEvidence, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${AGENT_EMAIL_CONFIG_KEY_PREFIX}.${agent.id}`, JSON.stringify(emailConfig || {}));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/email-config`, {
        method: "POST",
        body: JSON.stringify({ config: emailConfig || {} }),
      }).catch(() => {});
    }
  }, [agent.id, emailConfig, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`jarvis.agent.integrations.${agent.id}.v1`, JSON.stringify(integrationState));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/integrations`, {
        method: "POST",
        body: JSON.stringify({ integrations: integrationState }),
      }).catch(() => {});
    }
  }, [agent.id, integrationState, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(chatCacheKey(agent.id), JSON.stringify(messages.slice(-300)));
    if (remoteSyncEnabled) {
      fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/chat-log`, {
        method: "POST",
        body: JSON.stringify({ messages: messages.slice(-500) }),
      }).catch(() => {});
    }
  }, [agent.id, messages, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(`${CHAT_TASK_STATE_KEY_PREFIX}.${agent.id}`, JSON.stringify(chatTaskState || {}));
  }, [agent.id, chatTaskState]);

  useEffect(() => {
    localStorage.setItem(`${CHAT_PENDING_ACTION_KEY_PREFIX}.${agent.id}`, JSON.stringify(chatPendingAction || null));
  }, [agent.id, chatPendingAction]);

  useEffect(() => {
    localStorage.setItem(`${CHAT_CANDIDATE_ACTIONS_KEY_PREFIX}.${agent.id}`, JSON.stringify(chatCandidateActions || []));
  }, [agent.id, chatCandidateActions]);

  useEffect(() => {
    localStorage.setItem(`${CHAT_MEMORY_KEY_PREFIX}.${agent.id}`, JSON.stringify(chatMemory || {}));
  }, [agent.id, chatMemory]);

  useEffect(() => {
    if (memoryEditorDirty) return;
    setMemoryEditor({
      priorities: Array.isArray(chatMemory?.priorities) ? chatMemory.priorities.join("\n") : "",
      concerns: Array.isArray(chatMemory?.concerns) ? chatMemory.concerns.join("\n") : "",
      preferences: Array.isArray(chatMemory?.preferences) ? chatMemory.preferences.join("\n") : "",
    });
  }, [chatMemory, memoryEditorDirty]);

  useEffect(() => {
    if (!remoteSyncEnabled) return;
    fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/function-outputs`, {
      method: "POST",
      body: JSON.stringify({ outputs: functionOutputs.slice(0, 400) }),
    }).catch(() => {});
  }, [agent.id, functionOutputs, remoteSyncEnabled]);

  useEffect(() => {
    if (!remoteSyncEnabled) return;
    fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/workflow-runs`, {
      method: "POST",
      body: JSON.stringify({ runs: workflowRuns.slice(0, 400) }),
    }).catch(() => {});
  }, [agent.id, workflowRuns, remoteSyncEnabled]);

  useEffect(() => {
    localStorage.setItem(APPROVAL_MODE_KEY, approvalMode);
  }, [approvalMode]);

  useEffect(() => {
    localStorage.setItem(AUTONOMY_HISTORY_KEY, JSON.stringify((autonomyHistory || []).slice(0, 200)));
  }, [autonomyHistory]);

  useEffect(() => {
    const measure = () => {
      const el = tabsScrollRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setTabsScrollable(max > 4);
      setTabsScrollPct(max > 0 ? el.scrollLeft / max : 0);
    };

    const el = tabsScrollRef.current;
    measure();
    if (el) el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      if (el) el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [agent.id]);

  const scrollTabsBy = (delta) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const executeWithApprovalGate = async (functionName, payload, actionLabel = "run") => {
    const manual = approvalMode === "manual";
    const action = payload?.action || actionLabel;
    const initialPayload = {
      ...(payload || {}),
      auto_approve: !manual,
      params: {
        ...((payload && payload.params) || {}),
        auto_approve: !manual,
        approval_handling: manual ? "manual" : "auto",
      },
    };

    const invokeOnce = async (bodyPayload) => {
      if (hasRemoteBackend()) {
        const idempotency =
          DETERMINISTIC_ACTIONS.has(String(action || ""))
            ? makeIdempotencyKey(functionName, String(action))
            : "";
        const out = await fetchBackend("/invoke", {
          method: "POST",
          headers: idempotency ? { "Idempotency-Key": idempotency } : {},
          body: JSON.stringify({
            functionName,
            payload: bodyPayload,
          }),
        });
        return normalizeBackendInvokeResponse(out);
      }
      return await base44.functions.invoke(functionName, bodyPayload);
    };

    let res = await invokeOnce(initialPayload);
    if (res?.data && typeof res.data === "object") {
      res.data.execution_path = deriveExecutionPath({
        isRemote: hasRemoteBackend(),
        action,
        data: res.data,
        approvalMode,
      });
    }
    const body = res?.data || {};
    if (body?.status !== "pending_approval") return res;
    const approval = body?.approval || null;
    if (!approval?.id || !hasRemoteBackend()) return res;

    setPendingApprovals((prev) => {
      const next = [
        {
          id: approval.id,
          functionName,
          action: payload?.action || actionLabel,
          payload: payload || {},
          reason: approval.reason || "Approval required",
          created_at: approval.created_at || new Date().toISOString(),
        },
        ...prev,
      ];
      return next.slice(0, 25);
    });

    pushHistory({
      type: "approval_requested",
      label: payload?.action || actionLabel,
      status: "pending_approval",
      summary: approval.reason || "Approval required before execution.",
    });

    if (!manual) {
      await fetchBackend(`/v1/approvals/${encodeURIComponent(approval.id)}/approve`, {
        method: "POST",
        body: JSON.stringify({ approver: USER_ID }),
      });

      setPendingApprovals((prev) => prev.filter((p) => p.id !== approval.id));

      res = await invokeOnce({
        ...(payload || {}),
        approval_id: approval.id,
        params: {
          ...((payload && payload.params) || {}),
          approval_id: approval.id,
        },
      });
      if (res?.data && typeof res.data === "object") {
        res.data.execution_path = deriveExecutionPath({
          isRemote: hasRemoteBackend(),
          action,
          data: res.data,
          approvalMode,
        });
      }

      pushHistory({
        type: "approval_applied",
        label: payload?.action || actionLabel,
        status: "success",
        summary: `Approved and executed (${approval.id}).`,
      });
    }

    return res;
  };

  const runCompassLinkScan = useMutation({
    mutationFn: async (links) => {
      if (hasRemoteBackend()) {
        const res = await fetchBackend("/v1/compass/link-scan", {
          method: "POST",
          body: JSON.stringify({ links }),
        });
        const rows = res?.result?.results || [];
        if (Array.isArray(rows) && rows.length) return rows;
      }

      try {
        const out = await base44.functions.invoke("compassMarketIntelligence", {
          action: "website_link_scan",
          params: { links },
        });
        const rows = out?.data?.result?.results || [];
        if (Array.isArray(rows) && rows.length) return rows;
      } catch {
      }

      return links.map((url) => ({
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url,
        status: "scanned",
        sentiment: "mixed",
        risk: "medium",
        summary: `Scanned ${url} in fallback mode.`,
        scanned_at: new Date().toISOString(),
      }));
    },
    onSuccess: (rows) => {
      setLinkScanResults((prev) => [...rows, ...prev].slice(0, 120));
      pushHistory({ type: "compass_link_scan", label: "Website Link Scan", status: "success", summary: `${rows.length} link(s) scanned` });
      setLinkScanInput("");
    },
    onError: (err) => {
      pushHistory({ type: "compass_link_scan", label: "Website Link Scan", status: "failed", summary: String(err?.message || "scan failed") });
    },
  });

  useEffect(() => {
    if (!hasRemoteBackend() || tab !== "chat" || conversationReady || userProfileQuery.isLoading) return;
    const boot = async () => {
      const profile = userProfileQuery.data || {};
      const settings = profile.settings && typeof profile.settings === "object" ? profile.settings : {};
      const convMap = settings.conversations && typeof settings.conversations === "object" ? settings.conversations : {};
      const convKey = `agent:${agent.id}`;
      const mapped = String(convMap[convKey] || "");

      try {
        if (mapped) {
          const existing = await getRemoteConversation(mapped);
          const conv = existing?.result?.conversation || existing?.conversation;
          if (conv) {
            setConversationId(conv.id);
            setMessages(toUiMessages(conv));
            if (conv?.metadata?.task_state && typeof conv.metadata.task_state === "object") {
              setChatTaskState((prev) => ({ ...prev, ...conv.metadata.task_state }));
              if (conv.metadata.task_state.agent_memory && typeof conv.metadata.task_state.agent_memory === "object") {
                setChatMemory(conv.metadata.task_state.agent_memory);
              }
              const candidates = Array.isArray(conv.metadata.task_state.candidate_actions) ? conv.metadata.task_state.candidate_actions : [];
              setChatCandidateActions(candidates);
            }
            setConversationReady(true);
            return;
          }
        }

        const created = await createRemoteConversation({
          agent_name: `${agent.id}_agent`,
        metadata: { user_id: USER_ID, tenant_id: TENANT_ID, agent_id: agent.id, business_profile: businessProfile || null },
        });
        const conv = created?.result?.conversation || created?.conversation;
        if (!conv?.id) {
          setConversationReady(true);
          return;
        }

        const nextProfile = {
          ...profile,
          settings: {
            ...settings,
            conversations: {
              ...convMap,
              [convKey]: conv.id,
            },
          },
        };
        await saveUserProfileRemote(USER_ID, nextProfile);
        queryClient.invalidateQueries({ queryKey: ["phase4_user_profile", USER_ID] });
        setConversationId(conv.id);
        setMessages(toUiMessages(conv));
        if (conv?.metadata?.task_state && typeof conv.metadata.task_state === "object") {
          setChatTaskState((prev) => ({ ...prev, ...conv.metadata.task_state }));
          if (conv.metadata.task_state.agent_memory && typeof conv.metadata.task_state.agent_memory === "object") {
            setChatMemory(conv.metadata.task_state.agent_memory);
          }
          const candidates = Array.isArray(conv.metadata.task_state.candidate_actions) ? conv.metadata.task_state.candidate_actions : [];
          setChatCandidateActions(candidates);
        }
      } catch {
        setMessages((prev) => (prev.length ? prev : [{ role: "assistant", text: "Conversation service unavailable; running in local mode." }]));
      } finally {
        setConversationReady(true);
      }
    };
    void boot();
  }, [agent.id, tab, conversationReady, userProfileQuery.data, userProfileQuery.isLoading, queryClient]);

  useEffect(() => {
    if (!hasRemoteBackend()) return;
    const loadRoleState = async () => {
      try {
        if (agent.id === "veritas") {
          const [contractsRes, libraryRes] = await Promise.allSettled([
            fetchBackend("/v6/veritas/contracts"),
            fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/legal-library`),
          ]);
          if (contractsRes.status === "fulfilled") setVeritasContracts(contractsRes.value?.result?.contracts || []);
          if (libraryRes.status === "fulfilled") setVeritasLibrary(libraryRes.value?.result?.items || []);
        } else if (agent.id === "sentinel") {
          const res = await fetchBackend("/v6/sentinel/cases");
          setSentinelCases(res?.result?.cases || []);
        } else if (agent.id === "merchant") {
          const [catalogRes, ordersRes, libraryRes] = await Promise.allSettled([
            fetchBackend("/v6/merchant/catalog"),
            fetchBackend("/v6/merchant/orders"),
            fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/commerce-library`),
          ]);
          if (catalogRes.status === "fulfilled") setMerchantCatalog(catalogRes.value?.result?.catalog || []);
          if (ordersRes.status === "fulfilled") setMerchantOrders(ordersRes.value?.result?.orders || []);
          if (libraryRes.status === "fulfilled") setMerchantLibrary(libraryRes.value?.result?.items || []);
        } else if (agent.id === "pulse") {
          const res = await fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/people-library`);
          setPulseLibrary(res?.result?.items || []);
        } else if (agent.id === "part") {
          const res = await fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/partnership-library`);
          setPartLibrary(res?.result?.items || []);
        } else if (agent.id === "inspect") {
          const res = await fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/quality-library`);
          setInspectLibrary(res?.result?.items || []);
        } else if (agent.id === "centsible") {
          const res = await fetchBackend(`/v6/agents/${encodeURIComponent(agent.id)}/documents`);
          setCentsibleDocuments(res?.result?.items || []);
        } else if (agent.id === "prospect") {
          const res = await fetchBackend("/v6/prospect/sequences");
          setProspectSequences(res?.result?.sequences || []);
        } else if (agent.id === "scribe") {
          const res = await fetchBackend("/v6/scribe/documents");
          setScribeDocs(res?.result?.documents || []);
        } else if (agent.id === "canvas") {
          const res = await fetchBackend("/v6/canvas/assets");
          setCanvasBank(res?.result?.assets || []);
        } else if (agent.id === "compass") {
          const res = await fetchBackend("/v6/compass/scans");
          setLinkScanResults(res?.result?.scans || []);
        }
      } catch {
      }
    };
    void loadRoleState();
  }, [agent.id]);

  function extractExecutionInsight(input, options = {}) {
    const fallbackAction = options.fallbackAction || options.fallbackLabel || "execution";
    const raw = input && typeof input === "object" ? input : {};
    const result = raw.result && typeof raw.result === "object" ? raw.result : {};
    const status = String(raw.status || result.status || options.fallbackStatus || "success");
    const action = String(
      raw.action ||
      raw.tool_action ||
      raw.kind ||
      options.fallbackAction ||
      "execution"
    );
    const titleBase = options.fallbackLabel || action || fallbackAction;
    const title = String(titleBase).replace(/_/g, " ");
    const summary = String(
      result.summary ||
      result.message ||
      raw.summary ||
      raw.message ||
      (status === "pending_approval"
        ? "Waiting for approval."
        : status === "failed"
          ? "Execution failed."
          : "Execution completed.")
    );

    let kpi = null;
    if (result.kpi?.key && result.kpi?.value !== undefined) {
      kpi = `${result.kpi.key}: ${result.kpi.value}`;
    } else {
      const scalarKey = ["health_score", "posture_score", "compliance_score", "confidence", "risk_score"].find(
        (k) => raw?.[k] !== undefined || result?.[k] !== undefined
      );
      if (scalarKey) {
        const scalarValue = result?.[scalarKey] ?? raw?.[scalarKey];
        kpi = `${scalarKey.replace(/_/g, " ")}: ${scalarValue}`;
      }
    }

    const recommendation = String(
      result.recommendation ||
      raw.recommendation ||
      (Array.isArray(result.next_actions) && result.next_actions[0]) ||
      ""
    );
    const nextActions = Array.isArray(result.next_actions)
      ? result.next_actions.slice(0, 3).map((x) => String(x))
      : [];

    return { title, status, action, summary, kpi, recommendation, nextActions };
  }

  function executionFingerprint(evt) {
    const label = String(evt?.label || "").toLowerCase().replace(/\s+/g, " ").trim();
    const status = String(evt?.status || "success");
    const ts = evt?.at ? new Date(evt.at).toISOString().slice(0, 19) : "";
    return `${label}|${status}|${ts}`;
  }

  const selfTest = useMutation({
    mutationFn: async () => {
      const action = agent.id === "nexus" ? "command_center_full_self_test" : `${agent.id.replace(/-/g, "_")}_full_self_test`;
      return await executeWithApprovalGate(agent.functionName, { action, params: { personalization } }, action);
    },
    onSuccess: (res) => {
      const insight = extractExecutionInsight(res?.data || {}, { fallbackAction: "full_self_test", fallbackLabel: "Full self test" });
      const executionPath = res?.data?.execution_path || deriveExecutionPath({ isRemote: hasRemoteBackend(), action: "full_self_test", data: res?.data || {}, approvalMode });
      setLastResult(res?.data || null);
      pushHistory({ type: "self_test", label: insight.title, status: insight.status, summary: insight.summary, payload: res?.data || null, insight, execution_path: executionPath });
      recordFunctionOutput({ kind: "self_test", action: "full_self_test", status: "success", payload: res?.data || null, insight, execution_path: executionPath });
    },
  });

  const runTool = useMutation({
    mutationFn: async (toolId) => {
      return await executeWithApprovalGate("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: agent.name, capability_id: toolId, personalization },
      }, "run_capability");
    },
    onSuccess: (res) => {
      if (res?.data?.status === "pending_approval") {
        const reason = res?.data?.approval?.reason || "Approval required.";
        setMessages((prev) => [...prev, { role: "assistant", text: `Approval required: ${reason}` }]);
        setLastResult(res?.data || null);
        return;
      }
      const insight = extractExecutionInsight(res?.data || {}, {
        fallbackAction: res?.data?.tool_action || "run_capability",
        fallbackLabel: res?.data?.capability?.label || "Tool Capability Run",
      });
      const executionPath = res?.data?.execution_path || deriveExecutionPath({ isRemote: hasRemoteBackend(), action: res?.data?.tool_action || "run_capability", data: res?.data || {}, approvalMode });
      const summary = insight.summary || "Tool completed.";
      setLastResult(res?.data || null);
      setMessages((prev) => [...prev, { role: "assistant", text: summary }]);
      pushHistory({ type: "capability", label: insight.title, status: "success", summary, payload: res?.data || null, insight, execution_path: executionPath });
      recordFunctionOutput({ kind: "tool", action: res?.data?.tool_action || "run_capability", status: "success", payload: res?.data || null, insight, execution_path: executionPath });
      navigate(`/agents/${agent.id}/chat`);
    },
  });

  const runOpsAction = useMutation({
    mutationFn: async (actionName) => {
      return await executeWithApprovalGate(agent.functionName, {
        action: actionName,
        params: {
          personalization,
          business_profile: businessProfile || null,
        },
      }, actionName);
    },
    onSuccess: (res, actionName) => {
      if (res?.data?.status === "pending_approval") {
        const reason = res?.data?.approval?.reason || "Approval required.";
        const summaryPending = `${agent.name} queued ${actionName} for approval. ${reason}`;
        const insightPending = extractExecutionInsight(res?.data || {}, { fallbackAction: actionName, fallbackLabel: actionName, fallbackStatus: "pending_approval" });
        setLastResult(res?.data || null);
        setMessages((prev) => [...prev, { role: "assistant", text: summaryPending }]);
        const executionPathPending = res?.data?.execution_path || deriveExecutionPath({ isRemote: hasRemoteBackend(), action: actionName, data: res?.data || {}, approvalMode });
        pushHistory({ type: "ops_action", label: actionName, status: "pending_approval", summary: summaryPending, payload: res?.data || null, insight: insightPending, execution_path: executionPathPending });
        recordFunctionOutput({ kind: "ops_action", action: actionName, status: "pending_approval", payload: res?.data || null, insight: insightPending, execution_path: executionPathPending });
        return;
      }
      const insight = extractExecutionInsight(res?.data || {}, { fallbackAction: actionName, fallbackLabel: actionName });
      const executionPath = res?.data?.execution_path || deriveExecutionPath({ isRemote: hasRemoteBackend(), action: actionName, data: res?.data || {}, approvalMode });
      const summary = insight.summary || `${agent.name} executed ${actionName}.`;
      setLastResult(res?.data || null);
      setMessages((prev) => [...prev, { role: "assistant", text: summary }]);
      pushHistory({ type: "ops_action", label: actionName, status: "success", summary, payload: res?.data || null, insight, execution_path: executionPath });
      recordFunctionOutput({ kind: "ops_action", action: actionName, status: "success", payload: res?.data || null, insight, execution_path: executionPath });
    },
    onError: (err, actionName) => {
      const summary = String(err?.message || "failed");
      const insight = extractExecutionInsight({ status: "failed", summary }, { fallbackAction: actionName, fallbackLabel: actionName, fallbackStatus: "failed" });
      pushHistory({ type: "ops_action", label: actionName, status: "failed", summary, insight });
      recordFunctionOutput({ kind: "ops_action", action: actionName, status: "failed", payload: { error: summary }, insight });
    },
  });

  const approveAndRun = useMutation({
    mutationFn: async (item) => {
      if (!item?.id || !item?.functionName) throw new Error("Invalid approval item");
      if (!hasRemoteBackend()) throw new Error("Remote backend required for approvals");
      await fetchBackend(`/v1/approvals/${encodeURIComponent(item.id)}/approve`, {
        method: "POST",
        body: JSON.stringify({ approver: USER_ID }),
      });
      const res = await base44.functions.invoke(item.functionName, {
        ...(item.payload || {}),
        approval_id: item.id,
        params: {
          ...((item.payload && item.payload.params) || {}),
          approval_id: item.id,
        },
      });
      return { res, item };
    },
    onSuccess: ({ res, item }) => {
      setPendingApprovals((prev) => prev.filter((p) => p.id !== item.id));
      const summary = res?.data?.result?.summary || res?.data?.result?.message || `Approved and executed ${item.action}.`;
      setLastResult(res?.data || null);
      setMessages((prev) => [...prev, { role: "assistant", text: summary }]);
      pushHistory({ type: "approval_applied", label: item.action || "approved_action", status: "success", summary });
      recordFunctionOutput({ kind: "approved_action", action: item.action || "approved_action", status: "success", payload: res?.data || null });
    },
    onError: (err, item) => {
      pushHistory({ type: "approval_applied", label: item?.action || "approved_action", status: "failed", summary: String(err?.message || "approval failed") });
    },
  });

  const generateCanvas = useMutation({
    mutationFn: async () => {
      if (!canvasBrief.trim()) throw new Error("Canvas brief is required");
      const action = canvasType === "reel" ? "cinematic_video_command" : "creative_generation";
      const res = await base44.functions.invoke("canvasCreativeGeneration", {
        action,
        params: {
          brief: canvasBrief,
          tone: canvasTone,
          platform: canvasPlatform,
        },
      });
      return { res, action };
    },
    onSuccess: ({ res, action }) => {
      const summary = res?.data?.result?.summary || res?.data?.result?.message || `Canvas generated ${canvasType}.`;
      const item = {
        id: `canvas_${Date.now()}`,
        created_at: new Date().toISOString(),
        type: canvasType,
        tone: canvasTone,
        platform: canvasPlatform,
        brief: canvasBrief,
        action,
        summary,
      };
      setCanvasBank((prev) => [item, ...prev].slice(0, 200));
      setLastResult(res?.data || null);
      setCanvasBrief("");
      pushHistory({ type: "canvas_generation", label: action, status: "success", summary });
      recordFunctionOutput({ kind: "canvas_generation", action, status: "success", payload: res?.data || null });
    },
  });

  const handleCanvasMediaUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => {
      const mime = f.type || "application/octet-stream";
      const mediaType = mime.startsWith("image/")
        ? "image"
        : mime.startsWith("video/")
          ? "video"
          : mime === "application/pdf"
            ? "flyer"
            : "file";
      return {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        asset_kind: "source_media",
        type: mediaType,
        name: f.name,
        mime,
        size: f.size || 0,
        uploaded_at: new Date().toISOString(),
        platform: "source_upload",
        tone: "raw",
        brief: `Source media uploaded: ${f.name}`,
        summary: `Uploaded ${mediaType} asset for Canvas generation.`,
      };
    });
    setCanvasBank((prev) => [...uploaded, ...prev].slice(0, 500));
    pushHistory({ type: "canvas_media_upload", label: "Canvas Media Upload", status: "success", summary: `${uploaded.length} asset(s) uploaded` });
    recordFunctionOutput({ kind: "canvas_media_upload", action: "upload_source_media", status: "success", payload: { count: uploaded.length, assets: uploaded.map((x) => ({ id: x.id, name: x.name, type: x.type })) } });
  };

  const handleChatUploadSelection = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const created = await Promise.all(list.map(async (file) => {
      const mime = file.type || "application/octet-stream";
      const category = inferUploadCategory(file.name, mime);
      const isPreviewable = mime.startsWith("image/");
      const preview_url = isPreviewable ? await fileToDataUrl(file) : "";
      return {
        id: `chat_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mime,
        size: file.size || 0,
        uploaded_at: new Date().toISOString(),
        source_agent: agent.id,
        source: "chat_upload",
        category,
        role: "reference_asset",
        role_label: "Reference Asset",
        summary: category === "logo" ? "Uploaded visual reference that may be a logo or brand mark." : `Uploaded ${category.replace(/_/g, " ")} for chat reference.`,
        preview_url,
      };
    }));

    const canvasAssets = created
      .filter((asset) => ["image", "logo", "product_image", "video", "document"].includes(asset.category))
      .map((asset) => ({
        id: asset.id,
        asset_kind: "source_media",
        type: asset.category === "video" ? "video" : asset.category === "document" ? "flyer" : "image",
        name: asset.name,
        mime: asset.mime,
        size: asset.size,
        uploaded_at: asset.uploaded_at,
        platform: "chat_upload",
        tone: "reference",
        brief: `Chat upload: ${asset.name}`,
        summary: asset.summary,
        preview_url: asset.preview_url,
        role: asset.role,
        role_label: asset.role_label,
      }));
    if (canvasAssets.length) {
      setCanvasBank((prev) => [...canvasAssets, ...prev.filter((item) => !canvasAssets.some((asset) => asset.id === item.id))].slice(0, 500));
    }

    const scribeAssets = created
      .filter((asset) => ["document", "spreadsheet"].includes(asset.category))
      .map((asset) => ({
        id: asset.id,
        name: asset.name,
        mime: asset.mime,
        size: asset.size,
        cloud: "pending",
        indexed: false,
        uploaded_at: asset.uploaded_at,
        summary: asset.summary,
      }));
    if (scribeAssets.length) {
      setScribeDocs((prev) => [...scribeAssets, ...prev.filter((doc) => !scribeAssets.some((asset) => asset.id === doc.id))].slice(0, 500));
    }

    const nextMemory = mergeLocalMemory(chatMemory, { asset_refs: created });
    await persistMemoryState(nextMemory);
    setChatComposerUploads(created);

    const nextProfile = {
      ...(businessProfile || {}),
      reference_assets: [
        ...created,
        ...(Array.isArray(businessProfile?.reference_assets) ? businessProfile.reference_assets.filter((asset) => !created.some((createdAsset) => createdAsset.id === asset?.id)) : []),
      ].filter(Boolean).slice(0, 48),
    };
    setBusinessProfile(nextProfile);
    localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(nextProfile));

    if (hasRemoteBackend()) {
      await Promise.allSettled(created.map((asset) =>
        fetchBackend("/v2/vector/upsert", {
          method: "POST",
          body: JSON.stringify({
            namespace: `agent:${agent.id}:assets`,
            text: `${asset.role_label}: ${asset.name}. ${asset.summary}`,
            metadata: {
              agent_id: agent.id,
              asset_id: asset.id,
              name: asset.name,
              mime: asset.mime,
              category: asset.category,
              role: asset.role,
              uploaded_at: asset.uploaded_at,
            },
          }),
        })
      ));
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `${agent.name}: I stored ${created.length} uploaded file${created.length > 1 ? "s" : ""} as reusable reference asset${created.length > 1 ? "s" : ""}. If you want, tell me what one is for, like "it's my business logo", and I’ll tag it for future work.`,
      },
    ]);
  };

  const applyChatUploadAnnotation = async (text = "") => {
    const annotation = inferAssetRoleFromText(text);
    if (!annotation) return null;
    const composerIds = new Set(chatComposerUploads.map((asset) => asset.id));
    const candidates = [
      ...chatComposerUploads,
      ...((chatMemory?.asset_refs || []).filter((asset) => !composerIds.has(asset.id))),
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
    const targets = (chatComposerUploads.length ? chatComposerUploads : candidates.slice(0, 1)).filter(Boolean);
    if (!targets.length) return null;
    const targetIds = new Set(targets.map((asset) => asset.id));
    const nextAssets = (chatMemory?.asset_refs || []).map((asset) =>
      targetIds.has(asset.id)
        ? {
            ...asset,
            ...annotation,
            summary: `Stored as ${annotation.role_label.toLowerCase()} reference.`,
            tagged_at: new Date().toISOString(),
          }
        : asset
    );
    const nextMemory = {
      ...(chatMemory || {}),
      asset_refs: nextAssets,
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(nextMemory);
    setCanvasBank((prev) => prev.map((item) => targetIds.has(item.id) ? { ...item, ...annotation, summary: `Stored as ${annotation.role_label.toLowerCase()} reference.` } : item));
    setChatComposerUploads((prev) => prev.map((item) => targetIds.has(item.id) ? { ...item, ...annotation, summary: `Stored as ${annotation.role_label.toLowerCase()} reference.` } : item));

    const profileTargets = nextAssets.filter((asset) => targetIds.has(asset.id));
    const primaryTarget = profileTargets[0] || null;
    const nextProfile = {
      ...(businessProfile || {}),
      reference_assets: [
        ...profileTargets,
        ...(Array.isArray(businessProfile?.reference_assets) ? businessProfile.reference_assets.filter((asset) => !targetIds.has(asset?.id)) : []),
      ].filter(Boolean).slice(0, 48),
      business_logo_asset_id: annotation.role === "business_logo"
        ? (primaryTarget?.id || businessProfile?.business_logo_asset_id || "")
        : (businessProfile?.business_logo_asset_id || ""),
    };
    setBusinessProfile(nextProfile);
    localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(nextProfile));

    return `${agent.name}: stored ${targets.map((asset) => asset.name).join(", ")} as ${annotation.role_label.toLowerCase()} reference${targets.length > 1 ? "s" : ""}. I’ll use ${targets.length > 1 ? "them" : "it"} in future brand and creative work.`;
  };

  const generateCanvasFromMedia = useMutation({
    mutationFn: async () => {
      const selected = canvasBank.filter((x) => selectedCanvasMediaIds.includes(x.id));
      if (!selected.length) throw new Error("Select at least one uploaded media asset");
      const brief = canvasBrief.trim() || "Create platform-ready content from uploaded media assets.";
      let res = null;
      let action = "generate_from_uploaded_media";
      try {
        res = await base44.functions.invoke("generateContentFromMedia", {
          action: "generate_from_media",
          params: {
            brief,
            tone: canvasTone,
            platform: canvasPlatform,
            output_type: canvasType,
            media_assets: selected.map((m) => ({ id: m.id, name: m.name, type: m.type, mime: m.mime })),
          },
        });
      } catch {
        action = canvasType === "reel" ? "cinematic_video_command" : "creative_generation";
        res = await base44.functions.invoke("canvasCreativeGeneration", {
          action,
          params: {
            brief,
            tone: canvasTone,
            platform: canvasPlatform,
            source_media_ids: selected.map((m) => m.id),
            source_media_names: selected.map((m) => m.name),
          },
        });
      }
      return { res, action, selected };
    },
    onSuccess: ({ res, action, selected }) => {
      const summary = res?.data?.result?.summary || res?.data?.result?.message || `Canvas generated ${canvasType} from uploaded media.`;
      const item = {
        id: `canvas_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        asset_kind: "generated",
        created_at: new Date().toISOString(),
        type: canvasType,
        tone: canvasTone,
        platform: canvasPlatform,
        brief: canvasBrief || "Generated from uploaded source media",
        action,
        source_media_ids: selected.map((m) => m.id),
        source_media_names: selected.map((m) => m.name),
        summary,
      };
      setCanvasBank((prev) => [item, ...prev].slice(0, 500));
      setSelectedCanvasMediaIds([]);
      setLastResult(res?.data || null);
      pushHistory({ type: "canvas_media_generation", label: "Canvas Generate From Media", status: "success", summary });
      recordFunctionOutput({ kind: "canvas_media_generation", action, status: "success", payload: res?.data || null });
    },
    onError: (err) => {
      pushHistory({ type: "canvas_media_generation", label: "Canvas Generate From Media", status: "failed", summary: String(err?.message || "generation failed") });
      recordFunctionOutput({ kind: "canvas_media_generation", action: "generate_from_uploaded_media", status: "failed", payload: { error: String(err?.message || "generation failed") } });
    },
  });

  const syncScribeDoc = useMutation({
    mutationFn: async ({ docId, target }) => {
      if (hasRemoteBackend()) {
        await fetchBackend("/v6/scribe/documents/sync", {
          method: "POST",
          body: JSON.stringify({ id: docId, target }),
        });
      } else {
        try {
          await base44.functions.invoke("scribeKnowledgeBase", {
            action: "cloud_archive_sync",
            params: { document_id: docId, target },
          });
        } catch {
        }
      }
      return { docId, target };
    },
    onSuccess: ({ docId, target }) => {
      if (hasRemoteBackend()) {
        fetchBackend("/v6/scribe/documents")
          .then((res) => setScribeDocs(res?.result?.documents || []))
          .catch(() =>
            setScribeDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, cloud: "synced", cloud_target: target, synced_at: new Date().toISOString() } : d)))
          );
      } else {
        setScribeDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, cloud: "synced", cloud_target: target, synced_at: new Date().toISOString() } : d))
        );
      }
      pushHistory({ type: "scribe_cloud_sync", label: "Scribe Cloud Sync", status: "success", summary: `Document synced to ${target}` });
    },
    onError: (err) => {
      pushHistory({ type: "scribe_cloud_sync", label: "Scribe Cloud Sync", status: "failed", summary: String(err?.message || "sync failed") });
    },
  });

  const indexScribeDoc = useMutation({
    mutationFn: async (docId) => {
      if (hasRemoteBackend()) {
        await fetchBackend("/v6/scribe/documents/index", {
          method: "POST",
          body: JSON.stringify({ id: docId }),
        });
      } else {
        try {
          await base44.functions.invoke("scribeKnowledgeBase", {
            action: "document_indexing",
            params: { document_id: docId },
          });
        } catch {
        }
      }
      return { docId };
    },
    onSuccess: ({ docId }) => {
      if (hasRemoteBackend()) {
        fetchBackend("/v6/scribe/documents")
          .then((res) => setScribeDocs(res?.result?.documents || []))
          .catch(() => setScribeDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, indexed: true, indexed_at: new Date().toISOString() } : d))));
      } else {
        setScribeDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, indexed: true, indexed_at: new Date().toISOString() } : d))
        );
      }
      pushHistory({ type: "scribe_indexing", label: "Scribe Indexing", status: "success", summary: "Document indexed for semantic retrieval" });
    },
    onError: (err) => {
      pushHistory({ type: "scribe_indexing", label: "Scribe Indexing", status: "failed", summary: String(err?.message || "indexing failed") });
    },
  });

  const handleScribeUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => ({
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      mime: f.type || "application/octet-stream",
      size: f.size || 0,
      cloud: "pending",
      indexed: false,
      uploaded_at: new Date().toISOString(),
    }));
    if (hasRemoteBackend()) {
      fetchBackend("/v6/scribe/documents", { method: "POST", body: JSON.stringify({ documents: uploaded }) })
        .then((res) => setScribeDocs(res?.result?.documents || uploaded))
        .catch(() => setScribeDocs((prev) => [...uploaded, ...prev].slice(0, 500)));
    } else {
      setScribeDocs((prev) => [...uploaded, ...prev].slice(0, 500));
    }
    pushHistory({ type: "scribe_upload", label: "Scribe Upload", status: "success", summary: `${uploaded.length} document(s) uploaded` });
  };

  const handleVeritasContractUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => ({
      id: `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      status: "uploaded",
      risk: "unknown",
      size: f.size || 0,
      uploaded_at: new Date().toISOString(),
    }));
    if (hasRemoteBackend()) {
      fetchBackend("/v6/veritas/contracts", { method: "POST", body: JSON.stringify({ contracts: uploaded }) })
        .then((res) => setVeritasContracts(res?.result?.contracts || uploaded))
        .catch(() => setVeritasContracts((prev) => [...uploaded, ...prev].slice(0, 500)));
    } else {
      setVeritasContracts((prev) => [...uploaded, ...prev].slice(0, 500));
    }
    pushHistory({ type: "veritas_contract_upload", label: "Contract Upload", status: "success", summary: `${uploaded.length} contract(s) uploaded` });
  };

  const handleCentsibleDocumentUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => ({
      id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      type: "report",
      summary: `Uploaded financial document (${f.type || "file"})`,
      tags: ["uploaded", "finance"],
      size: f.size || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    if (hasRemoteBackend()) {
      fetchBackend(`/v6/agents/centsible/documents`, { method: "POST", body: JSON.stringify({ items: uploaded }) })
        .then((res) => setCentsibleDocuments(res?.result?.items || [...uploaded, ...centsibleDocuments].slice(0, 1000)))
        .catch(() => setCentsibleDocuments((prev) => [...uploaded, ...prev].slice(0, 1000)));
    } else {
      setCentsibleDocuments((prev) => [...uploaded, ...prev].slice(0, 1000));
    }
    pushHistory({ type: "centsible_documents_upload", label: "Financial Document Upload", status: "success", summary: `${uploaded.length} file(s) uploaded` });
  };

  const handleInspectLibraryUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => ({
      id: `qly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      type: "quality_report",
      summary: `Uploaded QA artifact (${f.type || "file"})`,
      tags: ["uploaded", "qa"],
      size: f.size || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    if (hasRemoteBackend()) {
      fetchBackend(`/v6/agents/inspect/quality-library`, { method: "POST", body: JSON.stringify({ items: uploaded }) })
        .then((res) => setInspectLibrary(res?.result?.items || [...uploaded, ...inspectLibrary].slice(0, 1000)))
        .catch(() => setInspectLibrary((prev) => [...uploaded, ...prev].slice(0, 1000)));
    } else {
      setInspectLibrary((prev) => [...uploaded, ...prev].slice(0, 1000));
    }
    pushHistory({ type: "inspect_library_upload", label: "Quality Asset Upload", status: "success", summary: `${uploaded.length} file(s) uploaded` });
  };

  const handleVeritasLibraryUpload = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const uploaded = list.map((f) => ({
      id: `lgl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: f.name,
      type: "contract",
      summary: `Uploaded legal document (${f.type || "file"})`,
      tags: ["uploaded", "legal"],
      size: f.size || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    if (hasRemoteBackend()) {
      fetchBackend(`/v6/agents/veritas/legal-library`, { method: "POST", body: JSON.stringify({ items: uploaded }) })
        .then((res) => setVeritasLibrary(res?.result?.items || [...uploaded, ...veritasLibrary].slice(0, 1000)))
        .catch(() => setVeritasLibrary((prev) => [...uploaded, ...prev].slice(0, 1000)));
    } else {
      setVeritasLibrary((prev) => [...uploaded, ...prev].slice(0, 1000));
    }
    pushHistory({ type: "veritas_library_upload", label: "Legal Document Upload", status: "success", summary: `${uploaded.length} file(s) uploaded` });
  };

  const reviewVeritasContract = async (contractId) => {
    const riskBand = ["low", "medium", "high"][Math.floor(Math.random() * 3)];
    try {
      await base44.functions.invoke("veritasComplianceValidation", {
        action: "contract_risk_review",
        params: { contract_id: contractId },
      });
    } catch {
      // local fallback only
    }
    if (hasRemoteBackend()) {
      try {
        await fetchBackend("/v6/veritas/contracts/review", {
          method: "POST",
          body: JSON.stringify({ id: contractId, status: "reviewed", risk: riskBand }),
        });
        const latest = await fetchBackend("/v6/veritas/contracts");
        setVeritasContracts(latest?.result?.contracts || []);
      } catch {
        setVeritasContracts((prev) =>
          prev.map((c) => (c.id === contractId ? { ...c, status: "reviewed", risk: riskBand, reviewed_at: new Date().toISOString() } : c))
        );
      }
    } else {
      setVeritasContracts((prev) =>
        prev.map((c) => (c.id === contractId ? { ...c, status: "reviewed", risk: riskBand, reviewed_at: new Date().toISOString() } : c))
      );
    }
    pushHistory({ type: "veritas_contract_review", label: "Contract Risk Review", status: "success", summary: `Contract reviewed with ${riskBand} risk` });
  };

  const createSentinelCase = async () => {
    const caseItem = {
      id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Anomaly ${sentinelCases.length + 1}`,
      severity: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
      status: "open",
      created_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      try {
        const res = await fetchBackend("/v6/sentinel/cases", { method: "POST", body: JSON.stringify({ case: caseItem }) });
        setSentinelCases(res?.result?.cases || [caseItem, ...sentinelCases].slice(0, 500));
      } catch {
        setSentinelCases((prev) => [caseItem, ...prev].slice(0, 500));
      }
    } else {
      setSentinelCases((prev) => [caseItem, ...prev].slice(0, 500));
    }
    try {
      await base44.functions.invoke("sentinelSecurityMonitoring", { action: "incident_triage", params: { incident_id: caseItem.id } });
    } catch {
      // local fallback only
    }
    pushHistory({ type: "sentinel_case_create", label: "Incident Case Created", status: "success", summary: `${caseItem.title} (${caseItem.severity})` });
  };

  const updateSentinelCaseStatus = async (caseId, status) => {
    if (hasRemoteBackend()) {
      try {
        const res = await fetchBackend("/v6/sentinel/cases/status", { method: "POST", body: JSON.stringify({ id: caseId, status }) });
        setSentinelCases(res?.result?.cases || []);
      } catch {
        setSentinelCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status, updated_at: new Date().toISOString() } : c)));
      }
    } else {
      setSentinelCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, status, updated_at: new Date().toISOString() } : c)));
    }
    const action = status === "contained" ? "incident_triage" : status === "resolved" ? "security_posture_report" : "threat_scan";
    try {
      await base44.functions.invoke("sentinelSecurityMonitoring", { action, params: { incident_id: caseId } });
    } catch {
      // local fallback only
    }
    pushHistory({ type: "sentinel_case_update", label: "Incident Case Update", status: "success", summary: `Case ${caseId} moved to ${status}` });
  };

  const addMerchantSku = () => {
    const sku = {
      id: `sku_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `SKU ${merchantCatalog.length + 1}`,
      price: 49 + (merchantCatalog.length % 7) * 10,
      stock: 20 + (merchantCatalog.length % 5) * 6,
      status: "active",
      created_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      fetchBackend("/v6/merchant/catalog", { method: "POST", body: JSON.stringify({ sku }) })
        .then((res) => setMerchantCatalog(res?.result?.catalog || [sku, ...merchantCatalog].slice(0, 500)))
        .catch(() => setMerchantCatalog((prev) => [sku, ...prev].slice(0, 500)));
    } else {
      setMerchantCatalog((prev) => [sku, ...prev].slice(0, 500));
    }
    pushHistory({ type: "merchant_sku_add", label: "Catalog Update", status: "success", summary: `Added ${sku.name}` });
  };

  const addMerchantOrder = () => {
    const order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      customer: `Customer ${merchantOrders.length + 1}`,
      total: 79 + (merchantOrders.length % 6) * 25,
      status: "new",
      created_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      fetchBackend("/v6/merchant/orders", { method: "POST", body: JSON.stringify({ order }) })
        .then((res) => setMerchantOrders(res?.result?.orders || [order, ...merchantOrders].slice(0, 500)))
        .catch(() => setMerchantOrders((prev) => [order, ...prev].slice(0, 500)));
    } else {
      setMerchantOrders((prev) => [order, ...prev].slice(0, 500));
    }
    pushHistory({ type: "merchant_order_create", label: "Order Captured", status: "success", summary: `${order.id} captured ($${order.total})` });
  };

  const updateMerchantOrderStatus = (orderId, status) => {
    if (hasRemoteBackend()) {
      fetchBackend("/v6/merchant/orders/status", { method: "POST", body: JSON.stringify({ id: orderId, status }) })
        .then((res) => setMerchantOrders(res?.result?.orders || []))
        .catch(() => setMerchantOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o))));
    } else {
      setMerchantOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o)));
    }
    pushHistory({ type: "merchant_order_update", label: "Order Status", status: "success", summary: `${orderId} -> ${status}` });
  };

  const runProspectSequence = async () => {
    if (!prospectDraft.name.trim() || !prospectDraft.message.trim()) return;
    const run = {
      id: `seq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: prospectDraft.name.trim(),
      channel: prospectDraft.channel,
      message: prospectDraft.message.trim(),
      status: "running",
      started_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      try {
        const created = await fetchBackend("/v6/prospect/sequences", { method: "POST", body: JSON.stringify({ sequence: run }) });
        setProspectSequences(created?.result?.sequences || [run, ...prospectSequences].slice(0, 500));
      } catch {
        setProspectSequences((prev) => [run, ...prev].slice(0, 500));
      }
    } else {
      setProspectSequences((prev) => [run, ...prev].slice(0, 500));
    }
    try {
      await base44.functions.invoke("prospectLeadGeneration", {
        action: "outreach_sequence_builder",
        params: { name: run.name, channel: run.channel, message: run.message },
      });
    } catch {
      // local fallback only
    }
    if (hasRemoteBackend()) {
      try {
        await fetchBackend("/v6/prospect/sequences", {
          method: "POST",
          body: JSON.stringify({ sequence: { ...run, status: "completed", completed_at: new Date().toISOString() } }),
        });
        const latest = await fetchBackend("/v6/prospect/sequences");
        setProspectSequences(latest?.result?.sequences || []);
      } catch {
        setProspectSequences((prev) => prev.map((s) => (s.id === run.id ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s)));
      }
    } else {
      setProspectSequences((prev) => prev.map((s) => (s.id === run.id ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s)));
    }
    pushHistory({ type: "prospect_sequence_run", label: "Outreach Sequence", status: "success", summary: `${run.name} executed on ${run.channel}` });
    setProspectDraft((p) => ({ ...p, name: "", message: "" }));
  };

  const createSupportKbArticle = async () => {
    const title = supportKbDraft.title.trim();
    const content = supportKbDraft.content.trim();
    if (!title || !content) return;
    const article = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      category: supportKbDraft.category || "other",
      content,
      status: "draft",
      tags: supportKbDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      views: 0,
      helpful_rate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      try {
        await fetchBackend(`/v6/agents/support-sage/knowledge-base`, { method: "POST", body: JSON.stringify({ article }) });
      } catch {
        // keep local even if remote save fails
      }
    }
    try {
      await base44.functions.invoke("supportSageCustomerService", {
        action: "knowledge_article_create",
        params: { title: article.title, category: article.category, content: article.content, tags: article.tags },
      });
    } catch {
      // local fallback only
    }
    setSupportKnowledgeBase((prev) => [article, ...prev].slice(0, 1000));
    setSupportKbDraft({ title: "", category: "billing", content: "", tags: "" });
    pushHistory({ type: "support_kb_create", label: "Knowledge Article Created", status: "success", summary: article.title });
  };

  const publishSupportKbArticle = (id) => {
    setSupportKnowledgeBase((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "published", updated_at: new Date().toISOString() } : a))
    );
    pushHistory({ type: "support_kb_publish", label: "Knowledge Article Published", status: "success", summary: id });
  };

  const saveProspectAsset = async (type = "template") => {
    const baseName = prospectDraft.name?.trim() || "New Sales Asset";
    const content = prospectDraft.message?.trim();
    if (!content) return;
    const asset = {
      id: `pas_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: `${baseName}${type === "battle_card" ? " - Battle Card" : ""}`,
      content,
      tags: ["sales", prospectDraft.channel || "email", type],
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (hasRemoteBackend()) {
      try {
        await fetchBackend(`/v6/agents/prospect/assets`, { method: "POST", body: JSON.stringify({ asset }) });
      } catch {
        // keep local
      }
    }
    try {
      await base44.functions.invoke("prospectLeadGeneration", {
        action: type === "battle_card" ? "create_battle_card" : "save_template",
        params: { name: asset.name, content: asset.content, tags: asset.tags },
      });
    } catch {
      // local fallback only
    }
    setProspectAssets((prev) => [asset, ...prev].slice(0, 1000));
    pushHistory({ type: "prospect_asset_save", label: "Sales Asset Saved", status: "success", summary: asset.name });
  };

  const saveSageLibraryItem = async () => {
    const title = sageDraft.title.trim();
    const summary = sageDraft.summary.trim();
    if (!title || !summary) return;
    const item = {
      id: `sage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: sageDraft.type || "plan",
      summary,
      tags: sageDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("sageBussinessStrategy", { action: "save_to_library", params: item });
    } catch {}
    setSageLibrary((prev) => [item, ...prev].slice(0, 1000));
    setSageDraft({ title: "", type: "plan", summary: "", tags: "" });
    pushHistory({ type: "sage_library_save", label: "Strategy Item Saved", status: "success", summary: item.title });
  };

  const saveChronosLibraryItem = async () => {
    const name = chronosDraft.name.trim();
    const details = chronosDraft.details.trim();
    if (!name || !details) return;
    const item = {
      id: `chr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: chronosDraft.type || "template",
      details,
      tags: chronosDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("chronosSchedulingEngine", { action: "save_template", params: item });
    } catch {}
    setChronosLibrary((prev) => [item, ...prev].slice(0, 1000));
    setChronosDraft({ name: "", type: "template", details: "", tags: "" });
    pushHistory({ type: "chronos_library_save", label: "Schedule Item Saved", status: "success", summary: item.name });
  };

  const saveAtlasLibraryItem = async () => {
    const name = atlasDraft.name.trim();
    const summary = atlasDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `atl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: atlasDraft.type || "template",
      summary,
      tags: atlasDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("atlasWorkflowAutomation", { action: "save_template", params: item });
    } catch {}
    setAtlasLibrary((prev) => [item, ...prev].slice(0, 1000));
    setAtlasDraft({ name: "", type: "template", summary: "", tags: "" });
    pushHistory({ type: "atlas_library_save", label: "Workflow Item Saved", status: "success", summary: item.name });
  };

  const saveScribeLibraryItem = async () => {
    const name = scribeDraft.name.trim();
    const summary = scribeDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `scr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: scribeDraft.type || "document",
      summary,
      tags: scribeDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("scribeKnowledgeBase", { action: "save_to_library", params: item });
    } catch {}
    setScribeLibrary((prev) => [item, ...prev].slice(0, 1000));
    setScribeDraft({ name: "", type: "document", summary: "", tags: "" });
    pushHistory({ type: "scribe_library_save", label: "Knowledge Item Saved", status: "success", summary: item.name });
  };

  const saveSentinelLibraryItem = async () => {
    const title = sentinelDraft.title.trim();
    const summary = sentinelDraft.summary.trim();
    if (!title || !summary) return;
    const item = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: sentinelDraft.type || "incident_report",
      summary,
      tags: sentinelDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("sentinelSecurityMonitoring", { action: "save_to_library", params: item });
    } catch {}
    setSentinelLibrary((prev) => [item, ...prev].slice(0, 1000));
    setSentinelDraft({ title: "", type: "incident_report", summary: "", tags: "" });
    pushHistory({ type: "sentinel_library_save", label: "Security Item Saved", status: "success", summary: item.title });
  };

  const saveCompassLibraryItem = async () => {
    const name = compassDraft.name.trim();
    const summary = compassDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: compassDraft.type || "competitor_profile",
      summary,
      tags: compassDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("compassMarketIntelligence", { action: "save_to_library", params: item });
    } catch {}
    setCompassLibrary((prev) => [item, ...prev].slice(0, 1000));
    setCompassDraft({ name: "", type: "competitor_profile", summary: "", tags: "" });
    pushHistory({ type: "compass_library_save", label: "Market Item Saved", status: "success", summary: item.name });
  };
  const savePulseLibraryItem = async () => {
    const name = pulseDraft.name.trim();
    const summary = pulseDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `pls_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: pulseDraft.type || "employee_profile",
      summary,
      tags: pulseDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("pulseHREngine", { action: "save_to_library", params: item });
    } catch {}
    setPulseLibrary((prev) => [item, ...prev].slice(0, 1000));
    setPulseDraft({ name: "", type: "employee_profile", summary: "", tags: "" });
    pushHistory({ type: "pulse_library_save", label: "People Item Saved", status: "success", summary: item.name });
  };
  const savePartLibraryItem = async () => {
    const name = partDraft.name.trim();
    const summary = partDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `prt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: partDraft.type || "partner_profile",
      summary,
      tags: partDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("partPartnershipEngine", { action: "save_to_library", params: item });
    } catch {}
    setPartLibrary((prev) => [item, ...prev].slice(0, 1000));
    setPartDraft({ name: "", type: "partner_profile", summary: "", tags: "" });
    pushHistory({ type: "part_library_save", label: "Partnership Item Saved", status: "success", summary: item.name });
  };
  const saveMerchantLibraryItem = async () => {
    const name = merchantDraft.name.trim();
    const summary = merchantDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `mch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: merchantDraft.type || "product_catalog",
      summary,
      tags: merchantDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("merchantProductManagement", { action: "save_to_library", params: item });
    } catch {}
    setMerchantLibrary((prev) => [item, ...prev].slice(0, 1000));
    setMerchantDraft({ name: "", type: "product_catalog", summary: "", tags: "" });
    pushHistory({ type: "merchant_library_save", label: "Commerce Item Saved", status: "success", summary: item.name });
  };
  const saveInspectLibraryItem = async () => {
    const name = inspectDraft.name.trim();
    const summary = inspectDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `qly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: inspectDraft.type || "test_case",
      summary,
      tags: inspectDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("inspectQualityEngine", { action: "save_to_library", params: item });
    } catch {}
    setInspectLibrary((prev) => [item, ...prev].slice(0, 1000));
    setInspectDraft({ name: "", type: "test_case", summary: "", tags: "" });
    pushHistory({ type: "inspect_library_save", label: "Quality Item Saved", status: "success", summary: item.name });
  };
  const saveVeritasLibraryItem = async () => {
    const title = veritasDraft.title.trim();
    const summary = veritasDraft.summary.trim();
    if (!title || !summary) return;
    const item = {
      id: `lgl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: veritasDraft.type || "contract",
      summary,
      tags: veritasDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("veritasComplianceValidation", { action: "save_to_library", params: item });
    } catch {}
    setVeritasLibrary((prev) => [item, ...prev].slice(0, 1000));
    setVeritasDraft({ title: "", type: "contract", summary: "", tags: "" });
    pushHistory({ type: "veritas_library_save", label: "Legal Item Saved", status: "success", summary: item.title });
  };
  const saveCentsibleDocumentItem = async () => {
    const name = centsibleDraft.name.trim();
    const summary = centsibleDraft.summary.trim();
    if (!name || !summary) return;
    const item = {
      id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: centsibleDraft.type || "report",
      summary,
      tags: centsibleDraft.tags.split(",").map((x) => x.trim()).filter(Boolean),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await base44.functions.invoke("centsibleFinanceEngine", { action: "save_to_documents", params: item });
    } catch {}
    setCentsibleDocuments((prev) => [item, ...prev].slice(0, 1000));
    setCentsibleDraft({ name: "", type: "report", summary: "", tags: "" });
    pushHistory({ type: "centsible_documents_save", label: "Document Saved", status: "success", summary: item.name });
  };

    const isChatExecutionIntent = (text) =>
      /(run|execute|set up|setup|create|generate|analyz|check|optimiz|launch|schedule|review|assess|scan|monitor|build|draft|fix|triage|do it|go ahead)/i.test(String(text || ""));

    const isCanvasDirectGenerationPrompt = (text) => {
      if (agent.id !== "canvas") return false;
      const value = String(text || "").toLowerCase();
      return /(generate|create|make|design|draw|render|animate|storyboard)/.test(value)
        && /(image|picture|photo|illustration|visual|poster|cover|logo|video|reel|cinematic|motion|storyboard|animation|voice|voiceover|audio|tts|cat|dog|portrait)/.test(value);
    };

  const tokenizeChatText = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const localChatActionCatalog = useMemo(() => {
    const map = new Map();
    (AGENT_OPS_ACTIONS[agent.id] || []).forEach((x) => {
      map.set(x.action, { action: x.action, label: x.label, source: "ops" });
    });
    (AGENT_ADVANCED_RUNBOOKS[agent.id] || []).forEach((x) => {
      map.set(x.action, { action: x.action, label: x.label, source: "runbook" });
    });
    (AGENT_ROLE_TOOLS[agent.id] || []).slice(0, 20).forEach((x) => {
      const action = String(x.id || toActionId(x.label || "action"));
      if (!map.has(action)) map.set(action, { action, label: x.label || action.replace(/_/g, " "), source: "tool" });
    });
    return Array.from(map.values());
  }, [agent.id]);

  const rankLocalActions = (text) => {
    const toks = tokenizeChatText(text);
    const ranked = localChatActionCatalog.map((item) => {
      const bag = `${item.action} ${item.label}`.toLowerCase();
      const words = new Set(bag.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((x) => x.length > 2));
      let score = 0;
      toks.forEach((tok) => {
        if (words.has(tok)) score += 2;
        if (bag.includes(tok)) score += 1;
      });
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    return ranked;
  };

  const pickLocalBestAction = (text) => {
    const ranked = rankLocalActions(text);
    if (!ranked.length || ranked[0].score <= 0) return null;
    return ranked[0].item;
  };

  const resolveLocalCandidateSelection = (text = "") => {
    const t = String(text || "").trim().toLowerCase();
    const m = t.match(/^(?:option\s*)?([1-3])$/);
    if (m) {
      const idx = Number(m[1]) - 1;
      return chatCandidateActions[idx] || null;
    }
    return chatCandidateActions.find((x) => {
      const label = String(x?.label || "").toLowerCase();
      const action = String(x?.action || "").toLowerCase();
      return (label && t.includes(label)) || (action && t.includes(action));
    }) || null;
  };

  const normalizeLocalFollowUpTurn = (text = "") => {
    const raw = String(text || "").trim();
    const t = raw.toLowerCase();
    if (!raw) return raw;
    const pendingLabel = String(chatPendingAction?.label || chatPendingAction?.action || "").trim();
    const pendingAction = String(chatPendingAction?.action || "").trim();
    const firstCandidate = chatCandidateActions[0];

    if (/^(draft|draft please|plan|plan please|show plan|map it out)$/i.test(raw) && pendingLabel) {
      return `plan first for ${pendingLabel}`;
    }
    if (/^(next|what next|and then|what else)$/i.test(raw) && (pendingLabel || firstCandidate?.label)) {
      return `what do you recommend next for ${pendingLabel || firstCandidate.label}`;
    }
    if (/^(whichever you think|you choose|your call|best one)$/i.test(raw) && (pendingLabel || firstCandidate?.label)) {
      return `what do you recommend for ${pendingLabel || firstCandidate.label}`;
    }
    if (/^(why|why that|why that one|reason)$/i.test(raw) && (pendingLabel || firstCandidate?.label)) {
      return `why do you recommend ${pendingLabel || firstCandidate.label}`;
    }
    if (/^(details|more detail|explain more)$/i.test(raw) && pendingLabel) {
      return `give me more detail on ${pendingLabel}`;
    }
    if (/^(okay|ok|sure|alright|sounds good)$/i.test(raw) && pendingLabel) {
      return `plan first for ${pendingLabel}`;
    }
    if (/^(that one|the first one|go with the first one)$/i.test(raw) && firstCandidate?.label) {
      return firstCandidate.label;
    }
    if (/^(go with the safer one|safer one|lower risk one)$/i.test(raw) && (chatCandidateActions[1]?.label || firstCandidate?.label)) {
      return chatCandidateActions[1]?.label || firstCandidate.label;
    }
    if (/^(do it|go ahead|run it)$/i.test(raw) && !pendingAction && firstCandidate?.action) {
      return `run ${firstCandidate.label}`;
    }
    return raw;
  };

  const extractSimpleChatParams = (text = "") => {
    const lower = String(text || "").toLowerCase();
    const out = { user_request: text };
    const budget = lower.match(/\$?\s?(\d{2,7})\s*(\/\s*day|per day|daily|\/\s*week|per week|weekly)?/);
    if (budget?.[1]) {
      out.budget_hint = budget[1];
      out.budget = budget[1];
    }
    const channels = [];
    if (/meta|facebook|instagram/.test(lower)) channels.push("meta");
    if (/google/.test(lower)) channels.push("google");
    if (/tiktok/.test(lower)) channels.push("tiktok");
    if (/linkedin/.test(lower)) channels.push("linkedin");
    if (channels.length) {
      out.channel_hint = channels[0];
      out.channels = channels;
    }
    if (/lead/.test(lower)) {
      out.objective_hint = "leads";
      out.objective = "leads";
    } else if (/sales|purchase/.test(lower)) {
      out.objective_hint = "sales";
      out.objective = "sales";
    } else if (/traffic/.test(lower)) {
      out.objective_hint = "traffic";
      out.objective = "traffic";
    }
    if (/audience|target|geo|age|interest/.test(lower)) out.audience = "specified";
      if (/logo|brand identity|wordmark|brand mark/.test(lower)) {
      const refs = getSharedReferenceAssets(businessProfile, chatMemory).filter((asset) => asset?.role === "business_logo").slice(0, 3);
      if (refs.length) {
        out.reference_asset_ids = refs.map((asset) => asset.id);
        out.reference_asset_names = refs.map((asset) => asset.name);
      }
    }
    if (/contract|msa|nda|sow/.test(lower)) out.contract_name_or_text = "provided";
    if (/suite|regression|checkout|payment|auth|api/.test(lower)) out.suite_name_or_scope = "specified";
    return out;
  };

  const buildSharedReferencePromptContext = (text = "") => {
    const refs = getSharedReferenceAssets(businessProfile, chatMemory);
    if (!refs.length) return "";
    const t = String(text || "").toLowerCase();
    if (!/logo|brand|reference|use my|use our|based on|from previous|existing asset|uploaded/i.test(t)) return "";
    const topRefs = refs.slice(0, 4).map((asset) => `${asset.role_label || "Reference Asset"}: ${asset.name}`).join("; ");
    return `\n\nShared reference context:\n${topRefs}`;
  };

  const tokenizeForLibraryMatch = (text = "") =>
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token && token.length >= 3);

  const scoreLibraryItem = (query = "", item = {}) => {
    const q = tokenizeForLibraryMatch(query);
    if (!q.length) return 0;
    const hay = [
      item?.name,
      item?.title,
      item?.description,
      item?.summary,
      item?.notes,
      item?.type,
      item?.category,
      item?.tags,
      item?.folder,
      item?.status,
    ]
      .flat()
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let score = 0;
    q.forEach((token) => {
      if (hay.includes(token)) score += token.length > 5 ? 2 : 1;
    });
    const title = String(item?.title || item?.name || "").toLowerCase();
    q.forEach((token) => {
      if (title.includes(token)) score += 2;
    });
    if (item?.pinned) score += 5;
    return score;
  };

  const readAgentLibraryItems = (agentId) => {
    const key = AGENT_LIBRARY_KEYS[agentId];
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeAgentLibraryItems = (agentId, items = []) => {
    const key = AGENT_LIBRARY_KEYS[agentId];
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items.slice(0, 1000) : []));
  };

  const toggleLibrarySourcePin = (source = null) => {
    const normalized = normalizeSource(source);
    if (!normalized?.library_key) return;
    const items = readAgentLibraryItems(agent.id);
    const nextItems = items.map((item) => {
      const itemId = item?.id || "";
      const itemLabel = item?.title || item?.name || "";
      const match = (normalized.item_id && itemId === normalized.item_id) || (!normalized.item_id && itemLabel === normalized.label);
      return match ? { ...item, pinned: !normalized.pinned } : item;
    });
    writeAgentLibraryItems(agent.id, nextItems);
    setMessages((prev) =>
      prev.map((message) => ({
        ...message,
        sources: Array.isArray(message.sources)
          ? message.sources.map((entry) => {
              const s = normalizeSource(entry);
              if (!s) return entry;
              const match = (normalized.item_id && s.item_id === normalized.item_id) || (!normalized.item_id && s.label === normalized.label);
              return match ? { ...s, pinned: !normalized.pinned } : entry;
            })
          : message.sources,
      }))
    );
  };

  const buildAgentLibraryContextBundle = (text = "") => {
    const libraryKey = AGENT_LIBRARY_KEYS[agent.id] || "";
    const libraryItems = readAgentLibraryItems(agent.id);
    if (!libraryItems.length) return { prompt: "", sources: [] };
    const ranked = libraryItems
      .map((item) => ({ item, score: scoreLibraryItem(text, item) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const sources = ranked.map(({ item }) => ({
      item_id: item?.id || "",
      library_key: libraryKey,
      label: item?.title || item?.name || item?.id || "Library Item",
      snippet: String(item?.summary || item?.description || item?.notes || item?.type || item?.category || "").slice(0, 160),
      pinned: Boolean(item?.pinned),
      score: scoreLibraryItem(text, item),
    }));
    const lines = ranked.map(({ item }) => {
        const label = item?.title || item?.name || item?.id || "Library Item";
        const detail = item?.summary || item?.description || item?.notes || item?.type || item?.category || "";
        return detail ? `${label}: ${detail}` : `${label}`;
      });
    if (!lines.length) return { prompt: "", sources: [] };
    const libraryName = TAB_LABELS[AGENT_TAB_SETS[agent.id]?.find((tabId) => tabId.includes("library") || tabId === "documents" || tabId === "content-bank" || tabId === "knowledge-base")] || "Library";
    return {
      prompt: `\n\n${agent.name} ${libraryName} context:\n${lines.join("\n")}`,
      sources,
    };
  };

  const inferActionFromPhrase = (text = "") => {
    const t = String(text || "").toLowerCase();
    if (agent.id === "maestro") {
      if (/draft|creative|copy|variant/.test(t)) return localChatActionCatalog.find((x) => /creative|campaign|variant|brief/i.test(x.label || x.action)) || null;
      if (/lifecycle|journey|nurture|email flow/.test(t)) return localChatActionCatalog.find((x) => /lifecycle/i.test(x.label || x.action)) || null;
      if (/performance|optimi|roas|cpa|ctr/.test(t)) return localChatActionCatalog.find((x) => /performance|scorecard|optimizer/i.test(x.label || x.action)) || null;
    }
    if (agent.id === "canvas") {
      if (/voice|voiceover|narrat|tts|audio|read this/.test(t)) {
        return localChatActionCatalog.find((x) => /voiceover|voice|audio/i.test(x.label || x.action)) || null;
      }
      if (/image|picture|photo|illustration|draw|render|visual|poster|cover|cat|dog|portrait|logo/.test(t)) {
        return localChatActionCatalog.find((x) => /creative generation|creative_generation/i.test(x.label || x.action)) || null;
      }
      if (/video|reel|cinematic|motion|storyboard|animation/.test(t)) {
        return localChatActionCatalog.find((x) => /cinematic|video/i.test(x.label || x.action)) || null;
      }
    }
    return null;
  };

  const buildActionPlanText = (item, sourceText = "") => {
    const label = item?.label || item?.action || "selected action";
    const goal = (chatTaskState?.goal || sourceText || "").trim();
    const params = extractSimpleChatParams(sourceText || chatTaskState?.goal || "");
    const knowledge = LOCAL_CHAT_KNOWLEDGE[agent.id] || LOCAL_CHAT_KNOWLEDGE.nexus;
    const specialty = buildLocalSpecialtySummary(agent.id, sourceText || goal, rankLocalActions(sourceText || goal));
    const businessContext = summarizeBusinessContext(businessProfile, agent.id);
    const memory = summarizeLocalMemory({ ...chatMemory, asset_refs: getSharedReferenceAssets(businessProfile, chatMemory) });
    const hints = [];
    if (params.objective_hint) hints.push(`objective=${params.objective_hint}`);
    if (params.channel_hint) hints.push(`channel=${params.channel_hint}`);
    if (params.budget_hint) hints.push(`budget_hint=${params.budget_hint}`);
    return [
      `${agent.name}: here is how I would approach ${label}.`,
      `Domain lens: ${knowledge.domain}.`,
      businessContext.identity,
      businessContext.offer,
      businessContext.audience,
      businessContext.strategy,
      businessContext.channels,
      businessContext.economics,
      businessContext.brand,
      businessContext.overlay,
      businessContext.ops,
      memory.priorities,
      memory.references,
      specialty.relevance,
      specialty.lens,
      specialty.signals,
      specialty.heuristic,
      memory.concerns,
      goal ? `Goal: ${goal}` : "Goal: define objective and measurable KPI.",
      hints.length ? `Inputs detected: ${hints.join(", ")}` : "Inputs detected: none yet (will use defaults if you confirm).",
      `1. ${knowledge.frame?.[0] || "Validate objective, audience, channel, and constraints."}`,
      `2. ${knowledge.frame?.[1] || "Generate first-pass draft configuration and success metrics."}`,
      `3. ${knowledge.frame?.[2] || "Run action in controlled mode and capture output metrics."}`,
      "4. Review results and iterate one high-impact change.",
      "If this looks right, I can take the first step as soon as you want me to.",
    ].join("\n");
  };

  const getLocalToneAccent = () => ({
    maestro: "There’s real upside here if we stay sharp about message-market fit.",
    merchant: "I want to protect the economics while we improve the result.",
    pulse: "I want this to feel workable for the people living inside it, not just good on paper.",
    veritas: "I want the commercial path to stay usable without hiding the risk.",
    inspect: "I want the confidence to be real, not just optimistic.",
    centsible: "I want the recommendation to hold up financially, not just narratively.",
    nexus: "I want the system to stay coordinated while we move.",
  }[agent.id] || "I want this to be practical and defensible.");

  const recommendNextAction = (text = "") => {
    const ranked = rankLocalActions(text);
    const effectiveGoal = chatTaskState?.goal && !isLocalSmallTalkPrompt(chatTaskState.goal) ? chatTaskState.goal : "";
    const preferred = inferActionFromPhrase(text) || pickLocalBestAction(effectiveGoal || text) || null;
    const knowledge = LOCAL_CHAT_KNOWLEDGE[agent.id] || LOCAL_CHAT_KNOWLEDGE.nexus;
    const specialty = buildLocalSpecialtySummary(agent.id, text, ranked);
    const businessContext = summarizeBusinessContext(businessProfile, agent.id);
    const memory = summarizeLocalMemory({ ...chatMemory, asset_refs: getSharedReferenceAssets(businessProfile, chatMemory) });
    if (!preferred) return { text: `${agent.name}: I need a clearer goal before I recommend an action.`, item: null };
    const alternatives = localChatActionCatalog.filter((x) => x.action !== preferred.action).slice(0, 2);
    const closeCall = ranked?.[0]?.score > 0 && ranked?.[1]?.score > 0 && Math.abs((ranked?.[0]?.score || 0) - (ranked?.[1]?.score || 0)) <= 2;
    const lines = [
      `${agent.name}: ${closeCall ? `this is a close call, but I’d still lean toward ${preferred.label}.` : `my recommendation is ${preferred.label}.`}`,
      businessContext.identity,
      businessContext.offer,
      businessContext.audience,
      businessContext.overlay,
      businessContext.channels,
      memory.priorities,
      memory.references,
      specialty.relevance,
      specialty.lens,
      getLocalToneAccent(),
      `Reason: in ${knowledge.domain}, this is usually the fastest path to a useful signal or outcome.`,
      businessContext.strategy,
      memory.concerns,
      specialty.signals,
      specialty.heuristic,
    ];
    if (alternatives.length) lines.push(`Alternatives: ${alternatives.map((x) => x.label).join(", ")}.`);
    lines.push("If you want, I can take that forward now, or I can map the rollout first.");
    return { text: lines.join("\n"), item: preferred };
  };

  const runLocalChatTurn = async (text, consultedSources = []) => {
    const trimmed = normalizeLocalFollowUpTurn(String(text || "").trim());
    const t = trimmed.toLowerCase();
    const style = LOCAL_CHAT_STYLE[agent.id] || LOCAL_CHAT_STYLE.nexus;
    const knowledge = LOCAL_CHAT_KNOWLEDGE[agent.id] || LOCAL_CHAT_KNOWLEDGE.nexus;
    const rankedSignals = rankLocalActions(trimmed);
    const specialty = buildLocalSpecialtySummary(agent.id, trimmed, rankedSignals);
    const capability = buildLocalCapabilityGuidance(rankedSignals);
    const businessContext = summarizeBusinessContext(businessProfile, agent.id);
    const inferredMemory = inferLocalMemory(trimmed);
    const nextMemory = mergeLocalMemory(chatMemory, inferredMemory);
    if (trimmed && (inferredMemory.concerns?.length || /why|recommend|issue|problem|risk|declin|rising|drop|stuck|broken|not working/i.test(trimmed))) {
      nextMemory.diagnosis_log = appendLocalTimelineEntry(nextMemory.diagnosis_log, {
        type: "diagnosis",
        title: inferredMemory.concerns?.length ? `Focus areas: ${inferredMemory.concerns.join(", ")}` : `Diagnosis started for ${agent.name}`,
        summary: trimmed.slice(0, 220),
        sources: consultedSources,
      });
    }
    const memory = summarizeLocalMemory({ ...nextMemory, asset_refs: getSharedReferenceAssets(businessProfile, nextMemory) });
    const memoryNarrative = buildLocalMemoryNarrative({ ...nextMemory, asset_refs: getSharedReferenceAssets(businessProfile, nextMemory) });
    const memoryChange = summarizeLocalChange(nextMemory);
    setChatMemory(nextMemory);
    const quick = localChatActionCatalog.slice(0, 3).map((x) => x.label).join(", ");
    const quickLine = quick ? `The areas I'd naturally lean into here are ${quick}.` : "I can help think this through, map the work, and execute when you're ready.";
    const conversationMode = inferTaskConversationMode(trimmed, chatTaskState?.goal || "");

    if (isLocalSmallTalkPrompt(trimmed)) {
      return { assistantText: buildLocalSmallTalkReply(agent.name, trimmed) };
    }

    if (isGrowthClientAcquisitionPrompt(agent.id, trimmed)) {
      return { assistantText: buildGrowthClientAcquisitionReply({ agentName: agent.name, businessContext: businessContext.identity, riskContext: businessContext.risk, channels: businessContext.channels, memoryNarrative }) };
    }
    if (isGrowthFounderPrompt(agent.id, trimmed)) {
      return { assistantText: buildGrowthFounderGrowthReply({ agentName: agent.name, businessContext: businessContext.identity, memoryNarrative }) };
    }
    if (isGrowthSpecialistFounderPrompt(agent.id, trimmed)) {
      return { assistantText: buildGrowthSpecialistFounderGrowthReply({ agentId: agent.id, agentName: agent.name, businessContext: businessContext.identity, memoryNarrative }) };
    }

    const baseTask = computeLocalTaskState(chatTaskState || {}, trimmed, "");
    setChatTaskState(baseTask);
    const modeNow = baseTask.mode || "execute";
    const taskHint = baseTask.goal ? `Task: ${baseTask.goal}.` : "";
    const constraintHint = baseTask.constraints?.length ? `Constraints: ${baseTask.constraints.join("; ")}.` : "";
    const wantsExecution = isChatExecutionIntent(trimmed) || isCanvasDirectGenerationPrompt(trimmed);
    const asksRecommendation = /what do you recommend|recommend|best option|your pick|what should i do|why do you recommend/.test(t);
    const asksPlan = /ask for a plan|plan first|ask for a plan first|show me a plan|give me a plan|plan for it|ask for plan|draft plan|give me more detail on/.test(t);
    const threadContext = getRecentLocalThreadContext(chatTaskState || {});

    if (!trimmed) return { assistantText: buildLocalLightGreeting({ agentName: agent.name, style, knowledge, businessContext, memoryNarrative }) };
    if (/(^|\s)(\/mode|mode)\s*[:=]?\s*(plan|simulate|execute)\b/.test(t)) {
      return { assistantText: `${agent.name}: got it. We’ll work in ${modeNow} mode. ${modeNow === "execute" ? "I’ll act once you confirm." : "I’ll keep this in guidance mode for now."}` };
    }
    if (/^(hi|hello|hey|yo)\b/.test(t)) return { assistantText: buildLocalLightGreeting({ agentName: agent.name, style, knowledge, businessContext, memoryNarrative }) };
    if (/help|what can you do|capabilit|options/.test(t)) return { assistantText: buildLocalHelpReply({ agentName: agent.name, style, knowledge, businessContext, memoryNarrative, capability, quickLine, taskHint, constraintHint }) };
    if (isThreadRecapLocalPrompt(trimmed)) {
      return { assistantText: buildLocalThreadRecap({ businessContext, memoryChange, threadContext, specialty }) };
    }
    if (isVagueTensionLocalPrompt(trimmed) && !wantsExecution) {
      return { assistantText: buildLocalTensionResponse({ agentName: agent.name, businessContext, memoryNarrative, specialty, threadContext }) };
    }
    if (conversationMode === "explore" && !chatPendingAction?.action && !chatCandidateActions.length) {
      return { assistantText: buildLocalExplorationReply({ style, knowledge, businessContext, memoryNarrative, specialty }) };
    }
    if (isMessyLocalPrompt(trimmed) && !wantsExecution) {
      return {
        assistantText: buildLocalSynthesisResponse({ agentName: agent.name, specialty, knowledge, businessContext, memoryNarrative, memoryChange, threadContext }),
      };
    }

    const isConfirm = /^(yes|yep|yup|do it|go ahead|run it|execute( it)?|ship it|proceed)\b/.test(t) || /execute with defaults|run with defaults/.test(t);
    if (isConfirm && chatPendingAction?.action) {
      if (modeNow !== "execute") {
        return { assistantText: `${agent.name}: we're in ${modeNow} mode, so I'll hold off on applying changes. When you want me to act, switch back to execute.` };
      }
      const params = { ...(chatPendingAction.params || {}), user_request: trimmed, confirm_execution: true };
      try {
        const res = await executeWithApprovalGate(agent.functionName, { action: chatPendingAction.action, params }, chatPendingAction.action);
        if (String(res?.data?.status || "") === "pending_approval") {
          return { assistantText: buildApprovalCardText(chatPendingAction, res?.data || {}) };
        }
        const summary = summarizeLatestResult(res?.data || {});
        setChatPendingAction(null);
        const nextTask = computeLocalTaskState(chatTaskState || {}, trimmed, chatPendingAction.action);
        setChatTaskState(nextTask);
        return { assistantText: `${buildGroundedExecutionReceipt(chatPendingAction, res?.data || {}, summary)}\nWhere that leaves us: ${nextTask.status}.` };
      } catch (err) {
        return { assistantText: buildRecoveryPlaybookText(chatPendingAction, err) };
      }
    }

    const inferred = inferActionFromPhrase(trimmed);
    const selectedCandidate = resolveLocalCandidateSelection(trimmed);
    const ranked = rankedSignals;
    const best = selectedCandidate || inferred || (ranked[0]?.score > 0 ? ranked[0].item : null);
    const secondBest = ranked[1]?.score > 0 ? ranked[1] : null;
    const tightTradeoff = ranked[0]?.score > 0 && ranked[1]?.score > 0 && Math.abs((ranked[0]?.score || 0) - (ranked[1]?.score || 0)) <= 2;

    if ((isTradeoffLocalPrompt(trimmed) || tightTradeoff) && ranked.length >= 2 && !wantsExecution) {
      return {
        assistantText: buildLocalTradeoffResponse({
          agentName: agent.name,
          options: ranked,
          specialty,
          knowledge,
          businessContext,
          memoryNarrative,
          threadContext,
        }),
      };
    }

    if (isChallengeLocalPrompt(trimmed) && !wantsExecution) {
      return {
        assistantText: buildLocalChallengeResponse({
          agentName: agent.name,
          primary: ranked[0] || chatPendingAction,
          secondary: secondBest || chatCandidateActions[0],
          specialty,
          knowledge,
          businessContext,
          memoryNarrative,
          threadContext,
        }),
      };
    }

    if (isObjectionLocalPrompt(trimmed) && !wantsExecution) {
      return {
        assistantText: buildLocalObjectionResponse({
          agentName: agent.name,
          specialty,
          knowledge,
          businessContext,
          memoryNarrative,
          threadContext,
          ranked,
        }),
      };
    }

    if (asksRecommendation) {
      const hasSubstantiveContext = (rankedSignals[0]?.score || 0) > 0 || (!!chatTaskState?.goal && !isLocalSmallTalkPrompt(chatTaskState.goal));
      if (!hasSubstantiveContext) {
      return { assistantText: `${agent.name}: I can absolutely recommend a direction, but I need the actual problem or goal first. Tell me what you want help with and I’ll take it from there.` };
      }
      if (hasGrowthClientAcquisitionContext(chatTaskState?.goal || "")) {
        return { assistantText: buildGrowthClientAcquisitionRecommendation({ agentName: agent.name, businessContext: businessContext.identity, riskContext: businessContext.risk, memoryNarrative }) };
      }
      if (hasGrowthFounderGrowthContext(chatTaskState?.goal || "")) {
        return { assistantText: buildGrowthFounderGrowthRecommendation({ agentId: agent.id, agentName: agent.name, businessContext: businessContext.identity, memoryNarrative }) };
      }
      const rec = recommendNextAction(trimmed);
      if (rec.item) {
        setChatPendingAction({ action: rec.item.action, label: rec.item.label, params: extractSimpleChatParams(trimmed) });
        setChatTaskState(computeLocalTaskState(chatTaskState || {}, trimmed, rec.item.action));
        setChatMemory((prev) => ({
          ...nextMemory,
          decision_log: appendLocalTimelineEntry(prev?.decision_log || nextMemory.decision_log, {
            type: "decision",
            title: `Selected ${rec.item.action}`,
            summary: trimmed.slice(0, 220),
            sources: consultedSources,
          }),
        }));
      }
      if (/why do you recommend/i.test(t) && rec.item) {
        return {
        assistantText: `${agent.name}: I’m leaning toward ${rec.item.label} because ${specialty.relevance} ${specialty.lens} ${specialty.signals} ${specialty.heuristic} ${pickLocalFollowUp("If you want, I can lay out the plan behind it next.", ["If you'd like, I can compare it with the second-best option.", "If that helps, I can turn it into a concrete step-by-step plan."])}`.replace(/\s+/g, " ").trim(),
        };
      }
      return { assistantText: rec.text };
    }

    if (asksPlan) {
      if (hasGrowthClientAcquisitionContext(chatTaskState?.goal || "")) {
        return { assistantText: buildGrowthClientAcquisitionRecommendation({ agentName: agent.name, businessContext: businessContext.identity, riskContext: businessContext.risk, memoryNarrative }) };
      }
      if (hasGrowthFounderGrowthContext(chatTaskState?.goal || "")) {
        return { assistantText: buildGrowthFounderGrowthPlan({ agentId: agent.id, agentName: agent.name, businessContext: businessContext.identity, memoryNarrative }) };
      }
      const planItem = chatPendingAction?.action
        ? { action: chatPendingAction.action, label: chatPendingAction.label || chatPendingAction.action }
        : best || recommendNextAction(trimmed).item;
      if (!planItem) return { assistantText: `${agent.name}: I can map this out. Share the goal and any constraints, and I'll draft the plan. ${pickLocalFollowUp("What's the outcome you care about most?", [style.nextAsk, knowledge.ask])}`.trim() };
      setChatPendingAction({ action: planItem.action, label: planItem.label, params: extractSimpleChatParams(trimmed || chatTaskState?.goal || "") });
      setChatTaskState(computeLocalTaskState(chatTaskState || {}, trimmed, planItem.action));
      setChatMemory((prev) => ({
        ...nextMemory,
        decision_log: appendLocalTimelineEntry(prev?.decision_log || nextMemory.decision_log, {
          type: "decision",
          title: `Planned ${planItem.action}`,
          summary: (trimmed || chatTaskState?.goal || "").slice(0, 220),
          sources: consultedSources,
        }),
      }));
      return { assistantText: buildActionPlanText(planItem, trimmed) };
    }

    if (modeNow === "simulate" && best) {
      const previewParams = extractSimpleChatParams(trimmed);
      return {
        assistantText: [
          `${agent.name}: here's the dry run for ${best.label}.`,
          `What I’d run: ${best.action}`,
          `Inputs picked up: ${Object.keys(previewParams).filter((k) => k !== "user_request").join(", ") || "none yet"}`,
          "Nothing has been applied yet because we’re still in simulate mode.",
          "If this looks right, switch to execute mode and I can take it forward.",
        ].join("\n"),
      };
    }

    if (!wantsExecution && !best) {
      const options = ranked.filter((x) => x.score > 0).slice(0, 3).map((x) => ({ action: x.item.action, label: x.item.label }));
      if (options.length >= 2) {
        setChatCandidateActions(options);
        return {
          assistantText: [
            `${agent.name}: a few strong paths stand out here. I can take the lead on whichever feels closest to the outcome you want:`,
            ...options.map((x, i) => `${i + 1}. ${x.label}`),
            "You can reply with 1, 2, or 3, or tell me what matters most and I’ll choose for you.",
            buildLocalHandoffSuggestion(trimmed),
          ].join("\n"),
        };
      }
      return { assistantText: `${agent.name}: ${style.toneOpen || "Understood."} ${businessContext.identity} ${businessContext.strategy} ${businessContext.overlay} ${memoryNarrative} ${specialty.relevance} ${specialty.lens} ${memoryChange.decision} ${memoryChange.diagnosis} ${specialty.signals} ${specialty.heuristic} ${capability.actionsLine} ${capability.executionPath} ${taskHint} ${constraintHint} ${buildLocalHandoffSuggestion(trimmed)} ${pickLocalFollowUp(knowledge.ask || style.helpAsk, [style.nextAsk, specialty.pack?.prompt])}`.replace(/\s+/g, " ").trim() };
    }

    if (!best) {
    if (wantsExecution && hasGrowthFounderGrowthContext(chatTaskState?.goal || "")) {
      return { assistantText: buildGrowthFounderGrowthPlan({ agentId: agent.id, agentName: agent.name, businessContext: businessContext.identity, memoryNarrative }) };
    }

    if (hasGrowthClientAcquisitionContext(chatTaskState?.goal || "") && /hardest part|main issue|struggling|stuck|that's the issue|that is the issue|^yes\b/i.test(trimmed)) {
      return { assistantText: buildGrowthClientAcquisitionRecommendation({ agentName: agent.name, businessContext: businessContext.identity, riskContext: businessContext.risk, memoryNarrative }) };
    }
      return { assistantText: `${agent.name}: I can help with that. Tell me the outcome you want most, and I'll choose the best path. ${pickLocalFollowUp("What matters most here: speed, confidence, or upside?", [style.nextAsk, knowledge.ask])}`.trim() };
    }
    setChatCandidateActions([]);

    if (!wantsExecution) {
      setChatPendingAction({ action: best.action, label: best.label, params: extractSimpleChatParams(trimmed) });
      setChatTaskState(computeLocalTaskState(chatTaskState || {}, trimmed, best.action));
      setChatMemory((prev) => ({
        ...nextMemory,
        decision_log: appendLocalTimelineEntry(prev?.decision_log || nextMemory.decision_log, {
          type: "decision",
          title: `Recommended ${best.action}`,
          summary: trimmed.slice(0, 220),
          sources: consultedSources,
        }),
      }));
      return { assistantText: `${agent.name}: ${pickLocalLead(`I’d start with ${best.label}.`, `My first move would be ${best.label}.`, `The cleanest starting point is ${best.label}.`, `If I were sequencing this, I’d begin with ${best.label}.`)} ${businessContext.identity} ${businessContext.overlay} ${memoryNarrative} ${specialty.relevance} ${specialty.lens} In ${knowledge.domain}, that’s the cleanest next move from what you told me. ${specialty.signals} ${capability.actionsLine} ${capability.executionPath} ${specialty.heuristic} ${pickLocalFollowUp("If you want, I can map the plan first and then handle execution.", ["If you'd rather, I can pressure-test the plan before we act.", "If you're ready, I can turn that into a concrete next-step plan."])}`.replace(/\s+/g, " ").trim() };
    }

    const required = LOCAL_CHAT_ACTION_REQUIREMENTS[best.action] || [];
    const params = extractSimpleChatParams(trimmed);
    const missing = required.filter((r) => !(r in params));
    if (missing.length && !/execute with defaults|run with defaults/.test(t)) {
      setChatPendingAction({ action: best.action, label: best.label, params });
      setChatTaskState(computeLocalTaskState(chatTaskState || {}, trimmed, best.action));
      return {
        assistantText: `${agent.name}: I’m ready to run ${best.label}, but I still need a little more from you.\n${buildMissingContextQuestion(missing, "Send those details, or tell me to proceed with defaults.")}`,
      };
    }

    if (modeNow !== "execute") {
      setChatPendingAction({ action: best.action, label: best.label, params });
      return { assistantText: `${agent.name}: I’m ready to run ${best.label}, but we’re in ${modeNow} mode right now. Switch to execute when you want me to apply it.` };
    }

    try {
      const res = await executeWithApprovalGate(agent.functionName, { action: best.action, params }, best.action);
      if (String(res?.data?.status || "") === "pending_approval") {
        return { assistantText: buildApprovalCardText(best, res?.data || {}) };
      }
      const summary = summarizeLatestResult(res?.data || {});
      const nextTask = computeLocalTaskState(chatTaskState || {}, trimmed, best.action);
      setChatTaskState(nextTask);
      return {
        assistantText: `${buildGroundedExecutionReceipt(best, res?.data || {}, summary)}\n${summary.details?.[0] || pickLocalFollowUp("If you want, I can keep moving from here.", [style.nextAsk, knowledge.ask, specialty.pack?.prompt])}`,
      };
    } catch (err) {
      return { assistantText: buildRecoveryPlaybookText(best, err) };
    }
  };

  const saveMemoryMutation = useMutation({
    mutationFn: async (payload) => {
      const next = {
        priorities: payload.priorities.split("\n").map((x) => x.trim()).filter(Boolean),
        concerns: payload.concerns.split("\n").map((x) => x.trim()).filter(Boolean),
        preferences: payload.preferences.split("\n").map((x) => x.trim()).filter(Boolean),
        asset_refs: Array.isArray(chatMemory?.asset_refs) ? chatMemory.asset_refs : [],
        decision_log: Array.isArray(chatMemory?.decision_log) ? chatMemory.decision_log : [],
        diagnosis_log: Array.isArray(chatMemory?.diagnosis_log) ? chatMemory.diagnosis_log : [],
        playbooks: Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks : [],
        default_playbook_id: String(chatMemory?.default_playbook_id || "").trim(),
        updated_at: new Date().toISOString(),
      };
        setChatMemory((prev) => ({ ...(prev || {}), ...next }));
      if (hasRemoteBackend()) {
        await saveAgentMemoryRemote(USER_ID, agent.id, next);
        queryClient.invalidateQueries({ queryKey: ["phase4_agent_memory", USER_ID, agent.id] });
      }
      return next;
    },
    onSuccess: () => setMemoryEditorDirty(false),
  });

  const clearMemory = async () => {
    const next = { priorities: [], concerns: [], preferences: [], asset_refs: [], decision_log: [], diagnosis_log: [], playbooks: [], default_playbook_id: "", updated_at: new Date().toISOString() };
    setChatMemory(next);
    setMemoryEditor({ priorities: "", concerns: "", preferences: "" });
    setMemoryEditorDirty(false);
    setActiveChatPlaybook(null);
    if (hasRemoteBackend()) {
      await saveAgentMemoryRemote(USER_ID, agent.id, next);
      queryClient.invalidateQueries({ queryKey: ["phase4_agent_memory", USER_ID, agent.id] });
    }
  };

  const persistMemoryState = async (next) => {
    setChatMemory(next);
    if (hasRemoteBackend()) {
      await saveAgentMemoryRemote(USER_ID, agent.id, next);
      queryClient.invalidateQueries({ queryKey: ["phase4_agent_memory", USER_ID, agent.id] });
    }
  };

  const updateTimelineEntry = async (kind, entryId, patch) => {
    const key = kind === "decision" ? "decision_log" : "diagnosis_log";
    const next = {
      ...(chatMemory || {}),
      [key]: (Array.isArray(chatMemory?.[key]) ? chatMemory[key] : []).map((entry) =>
        entry.id === entryId ? { ...entry, ...patch, reviewed_at: new Date().toISOString() } : entry
      ),
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
  };

  const promoteTimelineEntryToPlaybook = async (kind, entry) => {
    if (!entry) return;
    const sources = (Array.isArray(entry.sources) ? entry.sources : []).map(normalizeSource).filter(Boolean);
    const playbook = {
      id: `playbook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: entry.title,
      type: kind,
      summary: entry.summary,
      created_at: new Date().toISOString(),
      sources,
      source_entry_id: entry.id,
    };
    const next = {
      ...(chatMemory || {}),
      playbooks: [playbook, ...(Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks : [])].slice(0, 24),
      default_playbook_id: String(chatMemory?.default_playbook_id || "").trim(),
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
  };

  const promoteSourceToPlaybook = async (source) => {
    const normalized = normalizeSource(source);
    if (!normalized) return;
    const playbook = {
      id: `playbook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: normalized.label,
      type: "source",
      summary: normalized.snippet || "Promoted source for future grounded reasoning.",
      created_at: new Date().toISOString(),
      sources: [normalized],
      source_entry_id: normalized.item_id || normalized.label,
      provenance: "source",
    };
    const next = {
      ...(chatMemory || {}),
      playbooks: [playbook, ...(Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks : [])].slice(0, 24),
      default_playbook_id: String(chatMemory?.default_playbook_id || "").trim(),
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
  };

  const activatePlaybookInChat = (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    setActiveChatPlaybook(playbook);
    setShowChatMemoryPanel(false);
  };

  const startPlaybookEdit = (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    setPlaybookEditor({ id: playbook.id, title: playbook.title, summary: playbook.summary || "" });
  };

  const cancelPlaybookEdit = () => setPlaybookEditor({ id: "", title: "", summary: "" });

  const savePlaybookEdit = async () => {
    const targetId = String(playbookEditor?.id || "").trim();
    if (!targetId) return;
    const title = String(playbookEditor?.title || "").trim();
    if (!title) return;
    const next = {
      ...(chatMemory || {}),
      playbooks: (Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks : []).map((item) => (
        item.id === targetId
          ? { ...item, title, summary: String(playbookEditor?.summary || "").trim() }
          : item
      )),
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
    if (activeChatPlaybook?.id === targetId) {
      setActiveChatPlaybook((prev) => prev ? { ...prev, title, summary: String(playbookEditor?.summary || "").trim() } : prev);
    }
    cancelPlaybookEdit();
  };

  const deletePlaybook = async (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    const remaining = (Array.isArray(chatMemory?.playbooks) ? chatMemory.playbooks : []).filter((entry) => entry.id !== playbook.id);
    const nextDefault = String(chatMemory?.default_playbook_id || "") === playbook.id ? "" : String(chatMemory?.default_playbook_id || "");
    const next = {
      ...(chatMemory || {}),
      playbooks: remaining,
      default_playbook_id: nextDefault,
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
    if (activeChatPlaybook?.id === playbook.id) setActiveChatPlaybook(null);
    if (playbookEditor?.id === playbook.id) cancelPlaybookEdit();
  };

  const setDefaultPlaybook = async (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    const next = {
      ...(chatMemory || {}),
      default_playbook_id: playbook.id,
      updated_at: new Date().toISOString(),
    };
    await persistMemoryState(next);
    setActiveChatPlaybook(playbook);
  };

  const sharePlaybookToAgent = async (item, targetAgentId) => {
    const playbook = normalizePlaybook(item);
    const targetId = normalizeAgentId(targetAgentId || "");
    if (!playbook || !targetId || targetId === agent.id) return;
    const sharedPlaybook = {
      ...playbook,
      id: `playbook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      shared_from_agent: agent.id,
      shared_from_label: agent.name,
      created_at: new Date().toISOString(),
    };
    let targetMemory = readLocalChatMemory(targetId);
    if (hasRemoteBackend()) {
      try {
        const remote = await fetchAgentMemoryRemote(USER_ID, targetId);
        targetMemory = { ...(targetMemory || {}), ...(remote?.result?.memory || {}) };
      } catch {
        // keep local fallback memory if remote read fails
      }
    }
    const next = {
      ...(targetMemory || {}),
      priorities: Array.isArray(targetMemory?.priorities) ? targetMemory.priorities : [],
      concerns: Array.isArray(targetMemory?.concerns) ? targetMemory.concerns : [],
      preferences: Array.isArray(targetMemory?.preferences) ? targetMemory.preferences : [],
      asset_refs: Array.isArray(targetMemory?.asset_refs) ? targetMemory.asset_refs : [],
      decision_log: Array.isArray(targetMemory?.decision_log) ? targetMemory.decision_log : [],
      diagnosis_log: Array.isArray(targetMemory?.diagnosis_log) ? targetMemory.diagnosis_log : [],
      playbooks: [sharedPlaybook, ...(Array.isArray(targetMemory?.playbooks) ? targetMemory.playbooks : [])].slice(0, 24),
      default_playbook_id: String(targetMemory?.default_playbook_id || "").trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${CHAT_MEMORY_KEY_PREFIX}.${targetId}`, JSON.stringify(next));
    } catch {
      // ignore local storage write failures
    }
    if (hasRemoteBackend()) {
      try {
        await saveAgentMemoryRemote(USER_ID, targetId, next);
      } catch {
        // local save already succeeded
      }
    }
    setPlaybookShareTargets((prev) => ({ ...prev, [playbook.id]: "" }));
    pushHistory({
      label: "Playbook Shared",
      status: "success",
      type: "playbook_share",
      summary: `${playbook.title} shared to ${(AGENT_BY_ID[targetId] || {}).name || targetId}.`,
    });
  };

  const convertPlaybookToWorkflowPack = async (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    const pack = {
      id: `custom_pack_${agent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${playbook.title} Pack`,
      business_type: String(businessProfile?.business_type || businessProfile?.industry || "general").trim().toLowerCase() || "general",
      category: playbook.type || "operations",
      risk: "medium",
      autonomy_tier: personalization.autonomyTier || "approve",
      description: playbook.summary || `Workflow pack generated from the "${playbook.title}" playbook.`,
      source_playbook_id: playbook.id,
      source_playbook_title: playbook.title,
      source_playbook_agent: agent.id,
      source_playbook_agent_name: agent.name,
      from_playbook: true,
      owner_agent: agent.id,
      steps: buildWorkflowStepsFromPlaybook(playbook),
      created_at: new Date().toISOString(),
    };
    setCustomWorkflowPacks((prev) => [pack, ...(Array.isArray(prev) ? prev : [])].slice(0, 32));
    recordWorkflowRun({ type: "playbook_pack_created", status: "success", workflow_id: pack.id, playbook_id: playbook.id, workflow: pack });
  };

  const applyPlaybookToPlan = (item) => {
    const playbook = normalizePlaybook(item);
    if (!playbook) return;
    setActiveChatPlaybook(playbook);
    setShowChatMemoryPanel(false);
    sendChat.mutate(buildPlaybookPlanningPrompt(playbook));
  };

  const sendChat = useMutation({
    mutationFn: async (text) => {
      const libraryContext = buildAgentLibraryContextBundle(text);
      const playbookContext = buildPlaybookPromptContext(activeChatPlaybook);
      const consultedSources = mergeConsultedSources(libraryContext.sources, activeChatPlaybook);
      const outboundText = `${text}${playbookContext}${buildBusinessProfilePromptContext(businessProfile, agent.id)}${buildSharedReferencePromptContext(text)}${libraryContext.prompt}`.trim();
      if (hasRemoteBackend()) {
        try {
          let convId = conversationId;
          if (!convId) {
            const created = await createRemoteConversation({
              agent_name: `${agent.id}_agent`,
        metadata: { user_id: USER_ID, tenant_id: TENANT_ID, agent_id: agent.id, business_profile: businessProfile || null },
            });
            const conv = created?.result?.conversation || created?.conversation;
            convId = conv?.id || "";
            if (convId) setConversationId(convId);
          }
          if (!convId) throw new Error("Could not create conversation");
          const updated = await addRemoteConversationMessage(convId, {
            role: "user",
            content: text,
            metadata: {
              user_id: USER_ID,
              tenant_id: TENANT_ID,
              business_profile: businessProfile || null,
              prompt_context: outboundText !== text ? outboundText.slice(text.length) : "",
            },
          });
          const conv = updated?.result?.conversation || updated?.conversation;
          return { mode: "remote", conversation: conv, text, outboundText, librarySources: consultedSources, activePlaybook: normalizePlaybook(activeChatPlaybook) };
        } catch {
          markRemoteBackendUnavailable();
        }
      }
      try {
        const local = await runLocalChatTurn(text, consultedSources);
        return { mode: "local", text, outboundText, librarySources: consultedSources, activePlaybook: normalizePlaybook(activeChatPlaybook), ...local };
      } catch (err) {
        const reason = String(err?.message || err || "unknown local chat error");
        return {
          mode: "local",
          text,
          outboundText,
          librarySources: consultedSources,
          activePlaybook: normalizePlaybook(activeChatPlaybook),
          assistantText: `${agent.name}: I hit a local chat issue while loading your business-aware reply. Error: ${reason}.`,
        };
      }
    },
    onSuccess: (payload) => {
      const actionPlan = buildActionPlanFromChat(payload?.text || "");
      if (payload.mode === "remote") {
        const next = toUiMessages(payload.conversation);
        const nextWithSources = Array.isArray(payload?.librarySources) && payload.librarySources.length
          ? next.map((message, idx) => (
            idx === next.length - 1 && message.role === "assistant"
              ? { ...message, text: decorateAssistantWithPlaybook(message.text, payload.activePlaybook), sources: [...(Array.isArray(message.sources) ? message.sources : []), ...payload.librarySources] }
              : message
          ))
          : next.map((message, idx) => (idx === next.length - 1 && message.role === "assistant" ? { ...message, text: decorateAssistantWithPlaybook(message.text, payload.activePlaybook) } : message));
        setMessages(actionPlan ? [...nextWithSources, { role: "assistant", text: actionPlan }] : nextWithSources);
        if (payload?.conversation?.metadata?.task_state && typeof payload.conversation.metadata.task_state === "object") {
          setChatTaskState((prev) => ({ ...prev, ...payload.conversation.metadata.task_state }));
          if (payload.conversation.metadata.task_state.agent_memory && typeof payload.conversation.metadata.task_state.agent_memory === "object") {
            setChatMemory(payload.conversation.metadata.task_state.agent_memory);
          }
          const candidates = Array.isArray(payload.conversation.metadata.task_state.candidate_actions)
            ? payload.conversation.metadata.task_state.candidate_actions
            : [];
          setChatCandidateActions(candidates);
        }
      } else {
        const reply = payload?.assistantText || `${agent.name}: ready. Tell me your goal and I’ll take it from there.`;
        setMessages((prev) => [
          ...prev,
          { role: "user", text: payload.text },
          { role: "assistant", text: decorateAssistantWithPlaybook(reply, payload.activePlaybook), sources: payload?.librarySources || [] },
          ...(actionPlan ? [{ role: "assistant", text: actionPlan }] : []),
        ]);
      }
      setChatInput("");
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `${agent.name}: chat request failed. Check backend connection in System Readiness, then retry.` },
      ]);
    },
  });

  const handleChatSubmit = async () => {
    const text = String(chatInput || "").trim();
    if (!text && !chatComposerUploads.length) return;

    const annotationReply = text ? await applyChatUploadAnnotation(text) : null;
    if (annotationReply) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: annotationReply },
      ]);
      setChatInput("");
      setChatComposerUploads([]);
      return;
    }

    if (!text && chatComposerUploads.length) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `${agent.name}: your files are stored. Tell me what they are for, or ask me to analyze or use them as references.`,
        },
      ]);
      return;
    }

    sendChat.mutate(text);
    setChatComposerUploads([]);
  };

  const importTemplate = useMutation({
    mutationFn: async (template) => {
      if (hasRemoteBackend() && !template?.from_playbook) {
        const res = await fetchBackend(`/v1/workflow-templates/${encodeURIComponent(template.id)}/instantiate`, {
          method: "POST",
          body: JSON.stringify({ overrides: { owner_agent: agent.name } }),
        });
        const wf = res?.result?.workflow;
        if (!wf) throw new Error("Template instantiate failed");
        return await base44.entities.Workflow.create(wf);
      }

      return await base44.entities.Workflow.create({
        name: template.name,
        trigger: "template_import",
        status: "active",
        owner_agent: agent.name,
        autonomy: template.autonomy_tier || "approve",
        risk: template.risk || "medium",
        description: template.description || "Imported local workflow pack",
        steps: Array.isArray(template.steps) ? template.steps : [],
        source_playbook_id: template.source_playbook_id || "",
        source_playbook_title: template.source_playbook_title || "",
        source_playbook_agent: template.source_playbook_agent || "",
        source_playbook_agent_name: template.source_playbook_agent_name || "",
      });
    },
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: ["workspace_workflows"] });
      recordWorkflowRun({ type: "template_import", status: "success", workflow: wf || null });
    },
  });
  const setWorkflowStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      return await base44.entities.Workflow.update(id, { status });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["workspace_workflows"] });
      recordWorkflowRun({ type: "status_change", status: "success", workflow_id: vars?.id, next_status: vars?.status });
    },
  });

  const createQuickWorkflow = useMutation({
    mutationFn: async () => {
      const name = quickWorkflowName.trim() || `${agent.name} Quick Workflow`;
      return await base44.entities.Workflow.create({
        name,
        trigger: quickWorkflowTrigger,
        status: "active",
        owner_agent: agent.name,
        autonomy: personalization.autonomyTier || "approve",
        risk: "medium",
        description: `Quick workflow created from ${agent.name} workspace.`,
      });
    },
    onSuccess: (wf) => {
      setQuickWorkflowName("");
      queryClient.invalidateQueries({ queryKey: ["workspace_workflows"] });
      recordWorkflowRun({ type: "quick_create", status: "success", workflow: wf || null });
    },
  });

  const createNeedsWorkpack = useMutation({
    mutationFn: async () => {
      const openNeeds = (agentNeeds || []).filter((n) => !n.done);
      if (!openNeeds.length) return [];
      const created = [];
      for (const need of openNeeds) {
        const config = needImplementation?.[need.id] || {};
        const readiness = needReadiness(need.id, config);
        const wf = await base44.entities.Workflow.create({
          name: `${agent.name}: ${need.title}`,
          trigger: "manual",
          status: "active",
          owner_agent: agent.name,
          autonomy: personalization.autonomyTier || "approve",
          risk: need.severity === "high" ? "high" : "medium",
          description: `Need workpack (${readiness.filled}/${readiness.total} required configured)`,
        });
        created.push(wf);
      }
      return created;
    },
    onSuccess: (items) => {
      queryClient.invalidateQueries({ queryKey: ["workspace_workflows"] });
      const count = Array.isArray(items) ? items.length : 0;
      recordWorkflowRun({ type: "needs_workpack", status: "success", workflow_id: `count_${count}` });
      pushHistory({
        type: "needs_workpack",
        label: "Needs Workpack Created",
        status: "success",
        summary: `${count} workflows created from open needs`,
      });
    },
  });

  const updateMatrix = useMutation({
    mutationFn: async (input) => {
      const matrix = input?.matrix || input || {};
      const res = await fetchBackend("/v1/autonomy/matrix", {
        method: "POST",
        body: JSON.stringify({ matrix }),
      });
      return res?.result || {};
    },
    onSuccess: (_result, vars) => {
      const nextMatrix = vars?.matrix || vars || {};
      const prevMatrix = vars?.prev_matrix || matrix || {};
      const lane = vars?.lane || "multiple";
      const fromTier = vars?.from_tier || (lane !== "multiple" ? prevMatrix?.[lane] : "");
      const toTier = vars?.to_tier || (lane !== "multiple" ? nextMatrix?.[lane] : "");
      setAutonomyHistory((prev) => ([
        {
          id: `autoh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          at: new Date().toISOString(),
          actor: USER_ID,
          reason: vars?.reason || "matrix_update",
          lane,
          from_tier: fromTier || "",
          to_tier: toTier || "",
          previous_matrix: prevMatrix,
          next_matrix: nextMatrix,
        },
        ...prev,
      ].slice(0, 200)));
      queryClient.invalidateQueries({ queryKey: ["workspace_autonomy_matrix"] });
    },
  });

  const live = useMemo(() => {
    const list = registry.data?.agents || [];
    return list.find((x) => normalizeAgentId(x.name) === agent.id) || { status: "idle", current_focus: "Awaiting instructions", key_metric: "--" };
  }, [registry.data, agent.id]);

  const capabilities = useMemo(() => {
    const remoteCaps = Array.isArray(capabilitiesQuery.data) ? capabilitiesQuery.data : [];
    const roleCaps = AGENT_ROLE_TOOLS[agent.id] || [];
    const staticCaps = (agent.capabilities || []).map((label) => ({
      id: toActionId(label),
      label,
      description: `${agent.name} role capability.`,
    }));
    const opsCaps = (AGENT_OPS_ACTIONS[agent.id] || []).map((x) => ({
      id: toActionId(`ops_${x.action}`),
      label: x.label,
      description: `${agent.name} ops action (${x.risk} risk).`,
    }));
    const runbookCaps = (AGENT_ADVANCED_RUNBOOKS[agent.id] || []).map((x) => ({
      id: toActionId(`runbook_${x.action}`),
      label: x.label,
      description: `${agent.name} advanced runbook (${x.risk} risk).`,
    }));
    const integrationCaps = (AGENT_INTEGRATIONS[agent.id] || []).map((x) => ({
      id: toActionId(`integration_${x.id}`),
      label: `Integration: ${x.label}`,
      description: `Connected system endpoint: ${x.endpoint}.`,
    }));
    const merged = [...roleCaps, ...opsCaps, ...runbookCaps, ...integrationCaps, ...remoteCaps, ...staticCaps];
    const seen = new Set();
    return merged.filter((c) => {
      const id = String(c.id || toActionId(c.label));
      if (!id || seen.has(id)) return false;
      seen.add(id);
      c.id = id;
      c.label = c.label || id.replace(/_/g, " ");
      c.description = c.description || `${agent.name} action`;
      return true;
    });
  }, [capabilitiesQuery.data, agent.capabilities, agent.id, agent.name]);
  const templates = useMemo(() => {
    const baseTemplates = (templatesQuery.data && templatesQuery.data.length ? templatesQuery.data : LOCAL_WORKFLOW_PACKS) || [];
    const merged = [...(Array.isArray(customWorkflowPacks) ? customWorkflowPacks : []), ...baseTemplates];
    const seen = new Set();
    return merged.filter((item) => {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [customWorkflowPacks, templatesQuery.data]);
  const workflows = workflowsQuery.data || [];
  const agentWorkflows = workflows.filter((w) => normalizeAgentId(w.owner_agent || "") === agent.id || String(w.owner_agent || "").toLowerCase() === agent.name.toLowerCase());
  const effectiveWorkflows = agent.id === "nexus" ? workflows : agentWorkflows;
  const matrix = autonomyQuery.data?.matrix || {};
  const baseOpsActions = AGENT_OPS_ACTIONS[agent.id] || [];
  const derivedOpsActions = capabilities.slice(0, 6).map((cap) => ({ action: toActionId(cap.label), label: cap.label, risk: "medium", derived: true }));
  const opsActions = [...baseOpsActions, ...derivedOpsActions.filter((d) => !baseOpsActions.some((b) => b.action === d.action))];
  const kpiLabels = AGENT_DASHBOARD_KPIS[agent.id] || ["Health Score", "Throughput", "Risk Index"];
  const opsBrief = AGENT_OPS_BRIEF[agent.id] || {
    mission: `Run ${agent.name} high-impact operations with business context.`,
    focus: "Execution quality, risk control, and measurable outcomes.",
  };
  const personality = AGENT_PERSONALITY[agent.id] || { title: "Specialist Agent", voice: "Focused and execution-oriented." };
  const theme = AGENT_THEME[agent.id] || AGENT_THEME.nexus;
  const dashboardCopy = AGENT_DASHBOARD_COPY[agent.id] || { title: `${agent.name} Performance Deck`, snapshot: "Performance Snapshot", queue: `${agent.name} Queue` };
  const advancedRunbooks = AGENT_ADVANCED_RUNBOOKS[agent.id] || [];
  const dashboardLenses = advancedRunbooks.slice(0, 3);
  const tabLabels = AGENT_TAB_LABELS[agent.id] || TAB_LABELS;
  const collaboratorIds = AGENT_COLLABORATORS[agent.id] || [];
  const collaborators = collaboratorIds.map((id) => AGENT_BY_ID[id]).filter(Boolean);
  const integrationCatalog = AGENT_INTEGRATIONS[agent.id] || [];

  const opsTrendData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), volume: 0, success: 0, failed: 0 };
    });
    const map = Object.fromEntries(days.map((d) => [d.key, d]));
    opsHistory.forEach((h) => {
      const key = String(h.at || "").slice(0, 10);
      if (!map[key]) return;
      map[key].volume += 1;
      if (h.status === "failed") map[key].failed += 1;
      else map[key].success += 1;
    });
    return days.map((d) => {
      const rate = d.volume ? Math.round((d.success / d.volume) * 100) : 0;
      return { day: d.label, volume: d.volume, successRate: rate, failed: d.failed };
    });
  }, [opsHistory]);

  const workflowMixData = useMemo(() => {
    const scoped = effectiveWorkflows;
    const active = scoped.filter((w) => w.status === "active").length;
    const paused = scoped.filter((w) => w.status === "paused").length;
    const other = Math.max(0, scoped.length - active - paused);
    return [
      { name: "Active", value: active },
      { name: "Paused", value: paused },
      { name: "Other", value: other },
    ];
  }, [effectiveWorkflows]);

  const kpiChartData = useMemo(() => {
    return kpiLabels.slice(0, 6).map((label) => {
      const value = metricToNumber(generateMetricValue(label, live, effectiveWorkflows));
      return { metric: label.length > 16 ? `${label.slice(0, 16)}...` : label, value };
    });
  }, [kpiLabels, live, effectiveWorkflows]);

  const agentSeed = useMemo(() => Array.from(agent.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0), [agent.id]);

  const advancedSeriesA = useMemo(() => {
    return opsTrendData.map((d, idx) => {
      const base = d.volume + (agentSeed % 5) + idx;
      return {
        day: d.day,
        alpha: base + (d.successRate % 7),
        beta: Math.max(0, Math.round((d.successRate || 0) / 10) + (agentSeed % 3)),
        gamma: Math.max(0, d.failed + (idx % 2)),
      };
    });
  }, [opsTrendData, agentSeed]);

  const advancedSeriesB = useMemo(() => {
    const scoped = effectiveWorkflows;
    const active = scoped.filter((w) => w.status === "active").length;
    const paused = scoped.filter((w) => w.status === "paused").length;
    const risky = scoped.filter((w) => ["high", "medium"].includes(String(w.risk || "").toLowerCase())).length;
    const fromHistoryFail = opsHistory.filter((h) => h.status === "failed").length;
    return [
      { name: "Active", value: active || (agentSeed % 4) + 1 },
      { name: "Paused", value: paused || (agentSeed % 3) + 1 },
      { name: "Risky", value: risky || (agentSeed % 5) + 1 },
      { name: "Failed Ops", value: fromHistoryFail || (agentSeed % 2) + 1 },
    ];
  }, [effectiveWorkflows, opsHistory, agentSeed]);

  const capabilityRadarData = useMemo(() => {
    return (kpiLabels.slice(0, 5).map((label, idx) => ({
      metric: label.length > 14 ? `${label.slice(0, 14)}...` : label,
      score: Math.min(100, metricToNumber(generateMetricValue(label, live, effectiveWorkflows)) + ((agentSeed + idx) % 9)),
    })));
  }, [kpiLabels, live, effectiveWorkflows, agentSeed]);

  const telemetryCards = useMemo(() => {
    return kpiLabels.slice(0, 6).map((label, idx) => {
      const valueRaw = generateMetricValue(label, live, effectiveWorkflows);
      const value = metricToNumber(valueRaw);
      const delta = ((agentSeed + idx * 7) % 13) - 6;
      return {
        id: `${label}-${idx}`,
        label,
        valueRaw,
        value,
        delta,
        direction: delta >= 0 ? "up" : "down",
      };
    });
  }, [kpiLabels, live, effectiveWorkflows, agentSeed]);

  const canvasMediaAssets = useMemo(
    () => canvasBank.filter((x) => x.asset_kind === "source_media"),
    [canvasBank]
  );
  const canvasGeneratedAssets = useMemo(
    () => canvasBank.filter((x) => x.asset_kind !== "source_media"),
    [canvasBank]
  );
  const filteredCanvasAssets = useMemo(() => {
    const q = canvasBankQuery.trim().toLowerCase();
    return canvasBank.filter((item) => {
      if (canvasBankFilter === "source" && item.asset_kind !== "source_media") return false;
      if (canvasBankFilter === "generated" && item.asset_kind === "source_media") return false;
      if (canvasBankFilter === "image" && !String(item.type || "").includes("image")) return false;
      if (canvasBankFilter === "video" && !String(item.type || "").includes("video")) return false;
      if (!q) return true;
      const hay = `${item.name || ""} ${item.brief || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [canvasBank, canvasBankFilter, canvasBankQuery]);
  const filteredSupportKb = useMemo(() => {
    const q = supportKbSearch.trim().toLowerCase();
    return supportKnowledgeBase.filter((a) => {
      if (supportKbFilter !== "all" && String(a.status || "draft") !== supportKbFilter) return false;
      if (!q) return true;
      const hay = `${a.title || ""} ${a.category || ""} ${a.content || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [supportKnowledgeBase, supportKbFilter, supportKbSearch]);
  const filteredProspectAssets = useMemo(() => {
    const q = prospectAssetSearch.trim().toLowerCase();
    return prospectAssets.filter((a) => {
      if (prospectAssetFilter !== "all" && String(a.type || "") !== prospectAssetFilter) return false;
      if (!q) return true;
      const hay = `${a.name || ""} ${a.type || ""} ${a.content || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [prospectAssets, prospectAssetFilter, prospectAssetSearch]);
  const filteredSageLibrary = useMemo(() => {
    const q = sageLibrarySearch.trim().toLowerCase();
    return sageLibrary.filter((x) => {
      if (sageLibraryFilter !== "all" && String(x.type || "") !== sageLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.title || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sageLibrary, sageLibraryFilter, sageLibrarySearch]);
  const filteredChronosLibrary = useMemo(() => {
    const q = chronosLibrarySearch.trim().toLowerCase();
    return chronosLibrary.filter((x) => {
      if (chronosLibraryFilter !== "all" && String(x.type || "") !== chronosLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.details || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chronosLibrary, chronosLibraryFilter, chronosLibrarySearch]);
  const filteredAtlasLibrary = useMemo(() => {
    const q = atlasLibrarySearch.trim().toLowerCase();
    return atlasLibrary.filter((x) => {
      if (atlasLibraryFilter !== "all" && String(x.type || "") !== atlasLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [atlasLibrary, atlasLibraryFilter, atlasLibrarySearch]);
  const filteredScribeLibrary = useMemo(() => {
    const q = scribeLibrarySearch.trim().toLowerCase();
    return scribeLibrary.filter((x) => {
      if (scribeLibraryFilter !== "all" && String(x.type || "") !== scribeLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scribeLibrary, scribeLibraryFilter, scribeLibrarySearch]);
  const filteredSentinelLibrary = useMemo(() => {
    const q = sentinelLibrarySearch.trim().toLowerCase();
    return sentinelLibrary.filter((x) => {
      if (sentinelLibraryFilter !== "all" && String(x.type || "") !== sentinelLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.title || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sentinelLibrary, sentinelLibraryFilter, sentinelLibrarySearch]);
  const filteredCompassLibrary = useMemo(() => {
    const q = compassLibrarySearch.trim().toLowerCase();
    return compassLibrary.filter((x) => {
      if (compassLibraryFilter !== "all" && String(x.type || "") !== compassLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [compassLibrary, compassLibraryFilter, compassLibrarySearch]);
  const filteredPulseLibrary = useMemo(() => {
    const q = pulseLibrarySearch.trim().toLowerCase();
    return pulseLibrary.filter((x) => {
      if (pulseLibraryFilter !== "all" && String(x.type || "") !== pulseLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pulseLibrary, pulseLibraryFilter, pulseLibrarySearch]);
  const filteredPartLibrary = useMemo(() => {
    const q = partLibrarySearch.trim().toLowerCase();
    return partLibrary.filter((x) => {
      if (partLibraryFilter !== "all" && String(x.type || "") !== partLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [partLibrary, partLibraryFilter, partLibrarySearch]);
  const filteredMerchantLibrary = useMemo(() => {
    const q = merchantLibrarySearch.trim().toLowerCase();
    return merchantLibrary.filter((x) => {
      if (merchantLibraryFilter !== "all" && String(x.type || "") !== merchantLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [merchantLibrary, merchantLibraryFilter, merchantLibrarySearch]);
  const filteredInspectLibrary = useMemo(() => {
    const q = inspectLibrarySearch.trim().toLowerCase();
    return inspectLibrary.filter((x) => {
      if (inspectLibraryFilter !== "all" && String(x.type || "") !== inspectLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inspectLibrary, inspectLibraryFilter, inspectLibrarySearch]);
  const filteredVeritasLibrary = useMemo(() => {
    const q = veritasLibrarySearch.trim().toLowerCase();
    return veritasLibrary.filter((x) => {
      if (veritasLibraryFilter !== "all" && String(x.type || "") !== veritasLibraryFilter) return false;
      if (!q) return true;
      const hay = `${x.title || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [veritasLibrary, veritasLibraryFilter, veritasLibrarySearch]);
  const filteredCentsibleDocuments = useMemo(() => {
    const q = centsibleDocumentsSearch.trim().toLowerCase();
    return centsibleDocuments.filter((x) => {
      if (centsibleDocumentsFilter !== "all" && String(x.type || "") !== centsibleDocumentsFilter) return false;
      if (!q) return true;
      const hay = `${x.name || ""} ${x.type || ""} ${x.summary || ""} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [centsibleDocuments, centsibleDocumentsFilter, centsibleDocumentsSearch]);

  const liveExecutionFeed = useMemo(() => {
    const ops = (opsHistory || []).map((x) => ({
      id: `ops_${x.id}`,
      at: x.at,
      kind: "ops",
      label: x.label || x.type || "ops action",
      status: x.status || "success",
      summary: x.summary || "",
      executionPath: x.execution_path || x.payload?.execution_path || "local",
      insight: x.insight || extractExecutionInsight(x.payload || x, { fallbackAction: x.label || x.type, fallbackLabel: x.label || x.type }),
    }));
    const fn = (functionOutputs || []).map((x) => ({
      id: `fn_${x.id}`,
      at: x.at,
      kind: "function",
      label: (x.insight?.title || x.action || x.kind || "function run"),
      status: x.status || "success",
      summary: x.insight?.summary || x.payload?.result?.summary || x.payload?.result?.message || "",
      executionPath: x.execution_path || x.payload?.execution_path || "local",
      insight: x.insight || extractExecutionInsight(x.payload || x, { fallbackAction: x.action || x.kind, fallbackLabel: x.action || x.kind }),
    }));
    const wf = (workflowRuns || []).map((x) => ({
      id: `wf_${x.id}`,
      at: x.at,
      kind: "workflow",
      label: x.type || "workflow run",
      status: x.status || "success",
      summary: x.workflow?.name || x.workflow_id || "",
      executionPath: "workflow",
      insight: extractExecutionInsight({ status: x.status, summary: x.workflow?.name || x.workflow_id || "Workflow executed" }, { fallbackAction: x.type || "workflow_run", fallbackLabel: x.type || "workflow run", fallbackStatus: x.status || "success" }),
    }));
    const ranked = { function: 3, workflow: 2, ops: 1 };
    const merged = [...ops, ...fn, ...wf]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 80);
    const deduped = new Map();
    for (const evt of merged) {
      const key = executionFingerprint(evt);
      const existing = deduped.get(key);
      if (!existing || (ranked[evt.kind] || 0) > (ranked[existing.kind] || 0)) deduped.set(key, evt);
    }
    return Array.from(deduped.values())
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30);
  }, [opsHistory, functionOutputs, workflowRuns]);

  const executionInsights = useMemo(() => {
    return (liveExecutionFeed || []).map((evt) => ({
      ...evt,
      insight: evt.insight || extractExecutionInsight({ status: evt.status, summary: evt.summary }, { fallbackAction: evt.label, fallbackLabel: evt.label }),
    }));
  }, [liveExecutionFeed]);

  const latestExecutionInsight = executionInsights[0] || null;
  const roleModules = AGENT_ROLE_MODULES[agent.id] || [];
  const roleModuleCards = useMemo(() => {
    const connectedCount = Object.values(integrationState || {}).filter((x) => x?.status === "connected").length;
    const opsDays = (opsTrendData || []).filter((d) => d.volume > 0);
    const avgSuccess = opsDays.length
      ? Math.round(opsDays.reduce((acc, d) => acc + (d.successRate || 0), 0) / opsDays.length)
      : 0;
    const openOrders = (merchantOrders || []).filter((o) => !["delivered", "cancelled"].includes(String(o.status || "").toLowerCase())).length;

    const getMetric = (metric) => {
      if (metric === "ops_success_rate") return `${avgSuccess}%`;
      if (metric === "execution_count") return `${executionInsights.length}`;
      if (metric === "workflow_active") return `${effectiveWorkflows.filter((w) => w.status === "active").length}`;
      if (metric === "integrations_connected") return `${connectedCount}`;
      if (metric === "pending_approvals") return `${pendingApprovals.length}`;
      if (metric === "veritas_contracts") return `${veritasContracts.length}`;
      if (metric === "sentinel_open_cases") return `${sentinelCases.filter((c) => String(c.status || "").toLowerCase() !== "resolved").length}`;
      if (metric === "merchant_catalog_skus") return `${merchantCatalog.length}`;
      if (metric === "merchant_open_orders") return `${openOrders}`;
      if (metric === "prospect_sequences") return `${prospectSequences.length}`;
      if (metric === "canvas_generated_assets") return `${canvasGeneratedAssets.length}`;
      if (metric === "canvas_source_assets") return `${canvasMediaAssets.length}`;
      if (metric === "scribe_docs_indexed") return `${scribeDocs.filter((d) => d.indexed).length}`;
      if (metric === "scribe_docs_synced") return `${scribeDocs.filter((d) => d.cloud === "synced").length}`;
      if (metric === "compass_scans") return `${linkScanResults.length}`;
      return String(generateMetricValue("Health Score", live, effectiveWorkflows));
    };

    return roleModules.map((m, idx) => {
      const signal = getMetric(m.metric);
      const spark = Math.max(8, Math.min(100, metricToNumber(signal)));
      const trend = ((agentSeed + idx * 5) % 9) - 4;
      return {
        ...m,
        value: signal,
        spark,
        trend,
        statusText: trend >= 0 ? "improving" : "watch",
      };
    });
  }, [
    roleModules,
    integrationState,
    opsTrendData,
    merchantOrders,
    executionInsights.length,
    effectiveWorkflows,
    pendingApprovals.length,
    veritasContracts.length,
    sentinelCases,
    merchantCatalog.length,
    prospectSequences.length,
    canvasGeneratedAssets.length,
    canvasMediaAssets.length,
    scribeDocs,
    linkScanResults.length,
    live,
    agentSeed,
  ]);
  const analyticsInsights = useMemo(() => {
    const connectedCount = Object.values(integrationState || {}).filter((x) => x?.status === "connected").length;
    const totalIntegrations = (integrationCatalog || []).length;
    const opsDays = (opsTrendData || []).filter((d) => d.volume > 0);
    const avgSuccess = opsDays.length
      ? Math.round(opsDays.reduce((acc, d) => acc + (d.successRate || 0), 0) / opsDays.length)
      : 0;
    const failCount = (opsHistory || []).filter((h) => h.status === "failed").length;
    const activeWorkflows = effectiveWorkflows.filter((w) => w.status === "active").length;
    const play = AGENT_ANALYTICS_PLAYBOOK[agent.id] || { northStar: "Execution Quality", fixHint: "stabilize role operations", integrationHint: "connect role APIs" };
    const recommendations = [];
    if (avgSuccess < 85) recommendations.push(`Execution quality is ${avgSuccess}%. Prioritize top failed actions to reach 90%+.`);
    else recommendations.push(`Execution quality is healthy at ${avgSuccess}%. Scale safe automations.`);
    if (connectedCount < totalIntegrations) recommendations.push(`Integrations are ${connectedCount}/${totalIntegrations}. Connect remaining systems to unlock full autonomy.`);
    else recommendations.push(`All listed integrations are connected. Run periodic connector health checks.`);
    if (activeWorkflows < 2) recommendations.push(`Active workflows are low (${activeWorkflows}). Deploy one workflow preset from Tools for throughput.`);
    recommendations.push(`Role focus: ${play.fixHint}.`);
    return {
      northStar: play.northStar,
      successRate: avgSuccess,
      failures: failCount,
      connectedCount,
      totalIntegrations,
      activeWorkflows,
      recommendations: recommendations.slice(0, 4),
    };
  }, [integrationState, integrationCatalog, opsTrendData, opsHistory, effectiveWorkflows, agent.id]);
  const deterministicRuns = Array.isArray(deterministicRunsQuery.data) ? deterministicRunsQuery.data : [];
  const deadLetters = Array.isArray(deadLettersQuery.data) ? deadLettersQuery.data : [];
  const contracts = Array.isArray(actionContractsQuery.data) ? actionContractsQuery.data : [];
  const reliability = reliabilityQuery.data || null;
  const escalationGate = useMemo(() => {
    const sloHealthy = String(reliability?.slo?.status || reliability?.status || "").toLowerCase() === "healthy";
    const deadClear = deadLetters.length === 0;
    const releasePass = Boolean(releaseGateResult?.gate?.pass);
    return {
      pass: sloHealthy && deadClear && releasePass,
      sloHealthy,
      deadClear,
      releasePass,
    };
  }, [reliability, deadLetters.length, releaseGateResult]);
  const autonomyHistoryRows = useMemo(() => {
    return (autonomyHistory || []).filter((entry) => {
      const lane = entry?.lane || "multiple";
      return lane === "multiple" || AUTONOMY_LANES.includes(lane);
    }).slice(0, 20);
  }, [autonomyHistory]);

  const applyMatrixChange = ({ lane = "multiple", nextMatrix = {}, reason = "matrix_update", fromTier = "", toTier = "" }) => {
    if (!hasRemoteBackend()) return;
    const safePrev = matrix || {};
    const safeNext = nextMatrix || {};
    const resolvedFrom = fromTier || (lane !== "multiple" ? safePrev?.[lane] || "approve" : "");
    const resolvedTo = toTier || (lane !== "multiple" ? safeNext?.[lane] || "approve" : "");
    updateMatrix.mutate({
      matrix: safeNext,
      prev_matrix: safePrev,
      lane,
      reason,
      from_tier: resolvedFrom,
      to_tier: resolvedTo,
    });
  };

  const rollbackAutonomyChange = (entry) => {
    if (!entry?.previous_matrix) return;
    const lane = entry?.lane || "multiple";
    const targetMatrix = entry.previous_matrix || {};
    const current = matrix || {};
    const fromTier = lane !== "multiple" ? current?.[lane] || "" : "";
    const toTier = lane !== "multiple" ? targetMatrix?.[lane] || "" : "";
    applyMatrixChange({
      lane,
      nextMatrix: targetMatrix,
      reason: `rollback:${entry.id || "manual"}`,
      fromTier,
      toTier,
    });
  };

  const favoriteSet = new Set(favorites);

  const filteredTools = capabilities.filter((t) => {
    const q = toolSearch.toLowerCase().trim();
    if (!q) return true;
    return String(t.label || "").toLowerCase().includes(q) || String(t.description || "").toLowerCase().includes(q);
  });

  const toolZones = useMemo(() => {
    const groups = {};
    filteredTools.forEach((tool) => {
      const zone = inferToolZone(tool, agent.id);
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(tool);
    });
    const order = ["core", "execution", "analytics", "creation", "intel_and_risk", "knowledge"];
    return order
      .filter((zone) => Array.isArray(groups[zone]) && groups[zone].length > 0)
      .map((zone) => ({ zone, label: zoneLabel(zone), tools: groups[zone] }));
  }, [filteredTools, agent.id]);

  const visibleTemplates = templates.filter((t) => {
    if (agent.id === "nexus" || agent.id === "atlas") return true;
    const aid = agent.id;
    if (aid === "maestro") return ["content", "growth", "community"].includes(t.category);
    if (aid === "merchant") return ["commerce", "finance", "growth", "service"].includes(t.category);
    if (aid === "veritas") return ["compliance", "finance", "service"].includes(t.category);
    if (aid === "support-sage") return ["service", "community", "intake"].includes(t.category);
    return t.business_type.toLowerCase().includes("startup");
  });
  const businessPresetTemplates = useMemo(() => {
    if (!businessProfile) return [];
    const hay = `${businessProfile.business_type || ""} ${businessProfile.industry || ""} ${businessProfile.company_name || ""}`.toLowerCase();
    if (!hay.trim()) return [];
    return visibleTemplates.filter((t) => {
      const bt = String(t.business_type || "").toLowerCase();
      return hay.includes(bt) || bt.includes("services") || bt.includes("startup");
    }).slice(0, 6);
  }, [businessProfile, visibleTemplates]);

  const pushHistory = (entry) => {
    const insight = entry?.insight || extractExecutionInsight(entry?.payload || entry || {}, { fallbackAction: entry?.label || entry?.type, fallbackLabel: entry?.label || entry?.type, fallbackStatus: entry?.status || "success" });
    setOpsHistory((prev) => [
      {
        id: `hist_${Date.now()}`,
        at: new Date().toISOString(),
        insight,
        ...entry,
      },
      ...prev,
    ].slice(0, 100));
  };

  const needsSummary = useMemo(() => {
    const total = agentNeeds.length;
    const done = agentNeeds.filter((x) => Boolean(x.done)).length;
    return { total, done, open: Math.max(0, total - done) };
  }, [agentNeeds]);

  const needCards = useMemo(() => {
    return agentNeeds.map((need) => {
      const spec = AGENT_NEED_BLUEPRINTS[need.id] || null;
      const config = needImplementation?.[need.id] || {};
      const readiness = spec ? needReadiness(need.id, config) : { complete: false, progress: 0, total: 0, filled: 0 };
      const checklistSpec = defaultNeedChecklist(need);
      const checklistState = needChecklistState?.[need.id] || {};
      const checklistEvidence = needChecklistEvidence?.[need.id] || {};
      const checklistDone = checklistSpec.filter((x) => Boolean(checklistState[x.key])).length;
      const checklistRequired = checklistSpec.filter((x) => x.required).length;
      const checklistReady = checklistSpec.every((x) => !x.required || Boolean(checklistState[x.key]));
      return { need, spec, config, readiness, checklistSpec, checklistState, checklistEvidence, checklistDone, checklistRequired, checklistReady };
    });
  }, [agentNeeds, needImplementation, needChecklistState, needChecklistEvidence]);

  const needsImplementationSummary = useMemo(() => {
    const total = needCards.length;
    const complete = needCards.filter((x) => x.readiness.complete).length;
    const checklistReady = needCards.filter((x) => x.checklistReady).length;
    const buildReady = needCards.filter((x) => x.readiness.complete && x.checklistReady).length;
    const avgProgress = total > 0 ? Math.round(needCards.reduce((acc, x) => acc + (x.readiness.progress || 0), 0) / total) : 0;
    return { total, complete, checklistReady, buildReady, avgProgress, blocked: Math.max(0, total - buildReady) };
  }, [needCards]);
  const releaseGateBlocked = useMemo(
    () => (agent.id === "nexus" || agent.id === "atlas") && needsImplementationSummary.blocked > 0,
    [agent.id, needsImplementationSummary.blocked]
  );

  const updateNeedField = (needId, key, value) => {
    setNeedImplementation((prev) => ({
      ...(prev || {}),
      [needId]: {
        ...((prev || {})[needId] || {}),
        [key]: value,
        updated_at: new Date().toISOString(),
      },
    }));
  };

  const toggleNeedChecklist = (needId, key, checked) => {
    const now = new Date().toISOString();
    setNeedChecklistState((prev) => ({
      ...(prev || {}),
      [needId]: {
        ...((prev || {})[needId] || {}),
        [key]: checked,
        updated_at: now,
      },
    }));
    setNeedChecklistEvidence((prev) => ({
      ...(prev || {}),
      [needId]: {
        ...((prev || {})[needId] || {}),
        [key]: checked
          ? {
              ...(((prev || {})[needId] || {})[key] || {}),
              checked_at: now,
              actor: USER_ID,
              proof_link: `ops://${agent.id}/${needId}/${key}/${now}`,
            }
          : null,
      },
    }));
    pushHistory({
      type: "agent_need_checklist",
      label: "Need Checklist Updated",
      status: "success",
      summary: `${needId}.${key} -> ${checked ? "checked" : "unchecked"}`,
    });
  };

  const attachNeedChecklistEvidence = async (needId, key, file) => {
    if (!file) return;
    const now = new Date().toISOString();
    const hash = await fileSha256Hex(file);
    const attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      sha256: hash,
      uploaded_at: now,
      actor: USER_ID,
    };
    setNeedChecklistEvidence((prev) => {
      const existing = (((prev || {})[needId] || {})[key] || {});
      const attachments = Array.isArray(existing.attachments) ? existing.attachments : [];
      return {
        ...(prev || {}),
        [needId]: {
          ...((prev || {})[needId] || {}),
          [key]: {
            ...existing,
            checked_at: existing.checked_at || now,
            actor: existing.actor || USER_ID,
            proof_link: existing.proof_link || `ops://${agent.id}/${needId}/${key}/${now}`,
            attachments: [attachment, ...attachments].slice(0, 10),
          },
        },
      };
    });
    pushHistory({
      type: "agent_need_evidence",
      label: "Checklist Evidence Attached",
      status: "success",
      summary: `${needId}.${key}: ${file.name}`,
    });
  };

  const applyNeedBuild = (needId) => {
    const config = needImplementation?.[needId] || {};
    const readiness = needReadiness(needId, config);
    const need = (agentNeeds || []).find((x) => x.id === needId) || {};
    const checklistSpec = defaultNeedChecklist(need);
    const checklistState = needChecklistState?.[needId] || {};
    const checklistReady = checklistSpec.every((x) => !x.required || Boolean(checklistState[x.key]));
    if (!readiness.complete) {
      pushHistory({
        type: "agent_need_apply",
        label: "Need Build Blocked",
        status: "failed",
        summary: `${needId}: ${readiness.filled}/${readiness.total} required fields configured`,
      });
      return;
    }
    if (!checklistReady) {
      const missing = checklistSpec.filter((x) => x.required && !checklistState[x.key]).map((x) => x.label);
      pushHistory({
        type: "agent_need_apply",
        label: "Need Build Blocked",
        status: "failed",
        summary: `${needId}: unblock checklist incomplete (${missing.join(", ")})`,
      });
      return;
    }
    setAgentNeeds((prev) =>
      prev.map((x) =>
        x.id === needId
          ? { ...x, done: true, updated_at: new Date().toISOString() }
          : x
      )
    );
    pushHistory({
      type: "agent_need_apply",
      label: "Need Build Applied",
      status: "success",
      summary: `${needId} configured and marked done`,
    });
    recordWorkflowRun({
      type: "need_build",
      status: "success",
      workflow_id: needId,
      workflow: { name: `Need Build: ${needId}` },
    });
  };

  const emailIntegrations = useMemo(
    () => integrationCatalog.filter((x) => /gmail|outlook|smtp|sendgrid|mailchimp/i.test(`${x.id} ${x.label}`)),
    [integrationCatalog]
  );
  const emailHealth = useMemo(() => {
    const statuses = [emailConfig?.spfStatus, emailConfig?.dkimStatus, emailConfig?.dmarcStatus];
    const passCount = statuses.filter((s) => s === "pass").length;
    return { passCount, total: statuses.length, healthy: passCount === statuses.length };
  }, [emailConfig]);

  const toggleNeedDone = (needId, doneValue) => {
    setAgentNeeds((prev) =>
      prev.map((x) =>
        x.id === needId
          ? { ...x, done: doneValue, updated_at: new Date().toISOString() }
          : x
      )
    );
    pushHistory({
      type: "agent_need_status",
      label: "Agent Need Updated",
      status: "success",
      summary: `${needId} -> ${doneValue ? "done" : "open"}`,
    });
  };

  const recordFunctionOutput = (entry) => {
    const insight = entry?.insight || extractExecutionInsight(entry?.payload || entry || {}, { fallbackAction: entry?.action || entry?.kind, fallbackLabel: entry?.action || entry?.kind, fallbackStatus: entry?.status || "success" });
    setFunctionOutputs((prev) => [
      {
        id: `fn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        insight,
        ...entry,
      },
      ...prev,
    ].slice(0, 400));
  };

  const recordWorkflowRun = (entry) => {
    setWorkflowRuns((prev) => [
      {
        id: `wfr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 400));
  };

  const connectIntegration = useMutation({
    mutationFn: async (integration) => {
      const next = {
        ...integrationState,
        [integration.id]: {
          status: "connected",
          connectedAt: new Date().toISOString(),
          endpoint: integration.endpoint,
        },
      };
      setIntegrationState(next);
      return next[integration.id];
    },
  });

  const testIntegration = useMutation({
    mutationFn: async (integration) => {
      await new Promise((r) => setTimeout(r, 300));
      const next = {
        ...integrationState,
        [integration.id]: {
          ...(integrationState[integration.id] || {}),
          status: "connected",
          lastTestAt: new Date().toISOString(),
          lastTestResult: "ok",
          endpoint: integration.endpoint,
        },
      };
      setIntegrationState(next);
      return next[integration.id];
    },
  });

  const disconnectIntegration = useMutation({
    mutationFn: async (integration) => {
      const next = { ...integrationState, [integration.id]: { status: "disconnected", endpoint: integration.endpoint } };
      setIntegrationState(next);
      return next[integration.id];
    },
  });

  const updateIntegrationConfig = (integrationId, patch) => {
    setIntegrationState((prev) => ({
      ...(prev || {}),
      [integrationId]: {
        ...((prev || {})[integrationId] || {}),
        ...patch,
        configUpdatedAt: new Date().toISOString(),
      },
    }));
  };

  const replayDeadLetterMutation = useMutation({
    mutationFn: async (deadLetterId) => {
      return await fetchBackend(`/v7/actions/dead-letters/${encodeURIComponent(deadLetterId)}/replay`, {
        method: "POST",
        body: JSON.stringify({ requested_by: USER_ID }),
      });
    },
    onSuccess: (_res, deadLetterId) => {
      pushHistory({
        type: "dead_letter_replay",
        label: "Dead Letter Replay",
        status: "success",
        summary: `Replayed ${deadLetterId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["phase6_dead_letters"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_deterministic_runs"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_reliability_snapshot"] });
    },
    onError: (err, deadLetterId) => {
      pushHistory({
        type: "dead_letter_replay",
        label: "Dead Letter Replay",
        status: "failed",
        summary: `Replay failed for ${deadLetterId}: ${String(err?.message || "error")}`,
      });
    },
  });

  const runDeterministicMutation = useMutation({
    mutationFn: async () => {
      let parsed = {};
      try {
        parsed = deterministicParamsText.trim() ? JSON.parse(deterministicParamsText) : {};
      } catch {
        throw new Error("Invalid JSON params");
      }
      return await fetchBackend("/v7/actions/execute", {
        method: "POST",
        body: JSON.stringify({
          action: deterministicAction,
          params: parsed,
          requested_by: USER_ID,
        }),
      });
    },
    onSuccess: (res) => {
      const result = res?.result || {};
      const ok = result?.status === "success";
      const summary = result?.result?.summary || result?.error || "Deterministic run completed";
      pushHistory({
        type: "deterministic_run",
        label: deterministicAction,
        status: ok ? "success" : "failed",
        summary,
        payload: { ...result, execution_path: "backend-deterministic" },
        execution_path: "backend-deterministic",
      });
      if (result?.result) setLastResult({ status: ok ? "success" : "error", result: result.result, execution_path: "backend-deterministic" });
      queryClient.invalidateQueries({ queryKey: ["phase6_dead_letters"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_deterministic_runs"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_reliability_snapshot"] });
    },
  });

  const runReleaseGateMutation = useMutation({
    mutationFn: async () => {
      if (releaseGateBlocked) {
        throw new Error(`Blocked by unresolved need checklists (${needsImplementationSummary.blocked})`);
      }
      return await fetchBackend("/v4/evals/release-gate", {
        method: "POST",
        body: JSON.stringify({ suite: releaseGateSuite }),
      });
    },
    onSuccess: (res) => {
      const gate = res?.result?.gate || null;
      setReleaseGateResult(res?.result || null);
      pushHistory({
        type: "release_gate",
        label: "Release Gate",
        status: gate?.pass ? "success" : "failed",
        summary: gate?.decision || "release gate evaluated",
      });
      queryClient.invalidateQueries({ queryKey: ["phase6_reliability_snapshot"] });
    },
    onError: (err) => {
      if (String(err?.message || "").includes("Blocked by unresolved need checklists")) {
        setReleaseGateResult({
          gate: {
            pass: false,
            score: 0,
            fail: needsImplementationSummary.blocked,
            decision: "blocked_by_needs_checklist",
            required_actions: [
              `${needsImplementationSummary.blocked} need(s) still blocked by unblock checklist`,
              "Complete checklist items and re-run release gate",
            ],
          },
        });
      }
      pushHistory({
        type: "release_gate",
        label: "Release Gate",
        status: "failed",
        summary: String(err?.message || "release gate failed"),
      });
    },
  });

  const saveChatSchemaMutation = useMutation({
    mutationFn: async () => {
      let parsed = {};
      try {
        parsed = chatSchemaEditorText.trim() ? JSON.parse(chatSchemaEditorText) : {};
      } catch {
        throw new Error("Schema JSON is invalid");
      }
      if (!parsed || typeof parsed !== "object") throw new Error("Schema payload must be a JSON object");
      if (!parsed.common || typeof parsed.common !== "object") throw new Error("Schema must include common object");
      if (!parsed.agents || typeof parsed.agents !== "object") throw new Error("Schema must include agents object");
      return await fetchBackend("/v1/chat/schema", {
        method: "POST",
        body: JSON.stringify({ registry: parsed }),
      });
    },
    onSuccess: (res) => {
      const version = res?.result?.version || "updated";
      setChatSchemaEditorError("");
      setChatSchemaEditorDirty(false);
      pushHistory({
        type: "chat_schema_update",
        label: "Chat Schema Registry",
        status: "success",
        summary: `Schema updated to version ${version}`,
      });
      queryClient.invalidateQueries({ queryKey: ["chat_schema_registry"] });
      queryClient.invalidateQueries({ queryKey: ["chat_schema_history"] });
    },
    onError: (err) => {
      const message = String(err?.message || "Schema save failed");
      setChatSchemaEditorError(message);
      pushHistory({
        type: "chat_schema_update",
        label: "Chat Schema Registry",
        status: "failed",
        summary: message,
      });
    },
  });

  const rollbackChatSchemaMutation = useMutation({
    mutationFn: async ({ entryId, target = "before" }) => {
      if (!entryId) throw new Error("History entry is required");
      return await fetchBackend("/v1/chat/schema/rollback", {
        method: "POST",
        body: JSON.stringify({ entry_id: entryId, target }),
      });
    },
    onSuccess: (res, vars) => {
      const version = res?.result?.registry?.version || "rolled_back";
      setChatSchemaEditorDirty(false);
      setChatSchemaEditorError("");
      pushHistory({
        type: "chat_schema_rollback",
        label: "Chat Schema Rollback",
        status: "success",
        summary: `Rollback applied from ${vars?.entryId || "entry"} (version ${version})`,
      });
      queryClient.invalidateQueries({ queryKey: ["chat_schema_registry"] });
      queryClient.invalidateQueries({ queryKey: ["chat_schema_history"] });
    },
    onError: (err) => {
      const message = String(err?.message || "Schema rollback failed");
      setChatSchemaEditorError(message);
      pushHistory({
        type: "chat_schema_rollback",
        label: "Chat Schema Rollback",
        status: "failed",
        summary: message,
      });
    },
  });

  const saveConnectorConfigMutation = useMutation({
    mutationFn: async () => {
      if (!connectorWizardKey) throw new Error("Select a connector");
      let parsed = {};
      try {
        parsed = connectorConfigText.trim() ? JSON.parse(connectorConfigText) : {};
      } catch {
        throw new Error("Connector config JSON is invalid");
      }
      return await fetchBackend(`/v3/connectors/${encodeURIComponent(connectorWizardKey)}/save`, {
        method: "POST",
        body: JSON.stringify({ connector: parsed }),
      });
    },
    onSuccess: () => {
      setConnectorWizardError("");
      queryClient.invalidateQueries({ queryKey: ["connector_wizard_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["deterministic_audit"] });
      pushHistory({ type: "connector_save", label: `Connector ${connectorWizardKey}`, status: "success", summary: "Connector config saved" });
    },
    onError: (err) => {
      const msg = String(err?.message || "Connector config save failed");
      setConnectorWizardError(msg);
      pushHistory({ type: "connector_save", label: `Connector ${connectorWizardKey}`, status: "failed", summary: msg });
    },
  });

  const saveConnectorSecretsMutation = useMutation({
    mutationFn: async () => {
      if (!connectorWizardKey) throw new Error("Select a connector");
      let parsed = {};
      try {
        parsed = connectorSecretsText.trim() ? JSON.parse(connectorSecretsText) : {};
      } catch {
        throw new Error("Connector secret refs JSON is invalid");
      }
      return await fetchBackend(`/v3/connectors/${encodeURIComponent(connectorWizardKey)}/secrets`, {
        method: "POST",
        body: JSON.stringify({ secret_refs: parsed }),
      });
    },
    onSuccess: () => {
      setConnectorWizardError("");
      queryClient.invalidateQueries({ queryKey: ["connector_wizard_catalog"] });
      pushHistory({ type: "connector_secrets", label: `Connector ${connectorWizardKey}`, status: "success", summary: "Connector secret refs saved" });
    },
    onError: (err) => {
      const msg = String(err?.message || "Connector secret refs save failed");
      setConnectorWizardError(msg);
      pushHistory({ type: "connector_secrets", label: `Connector ${connectorWizardKey}`, status: "failed", summary: msg });
    },
  });

  const testConnectorWizardMutation = useMutation({
    mutationFn: async () => {
      if (!connectorWizardKey) throw new Error("Select a connector");
      return await fetchBackend(`/v3/connectors/${encodeURIComponent(connectorWizardKey)}/test`, { method: "POST", body: JSON.stringify({}) });
    },
    onSuccess: (res) => {
      const connected = Boolean(res?.result?.probe?.connected);
      setConnectorWizardError("");
      queryClient.invalidateQueries({ queryKey: ["connector_wizard_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["deterministic_audit"] });
      pushHistory({
        type: "connector_test",
        label: `Connector ${connectorWizardKey}`,
        status: connected ? "success" : "failed",
        summary: connected ? "Connector probe connected" : "Connector probe failed",
      });
    },
    onError: (err) => {
      const msg = String(err?.message || "Connector test failed");
      setConnectorWizardError(msg);
      pushHistory({ type: "connector_test", label: `Connector ${connectorWizardKey}`, status: "failed", summary: msg });
    },
  });

  const autoConfigureConnectorsMutation = useMutation({
    mutationFn: async () => {
      const templates = connectorTemplateQuery.data?.templates || [];
      if (!templates.length) throw new Error("No connector templates available");
      const results = [];
      for (const template of templates) {
        const key = String(template?.key || "");
        if (!key) continue;
        await fetchBackend(`/v3/connectors/${encodeURIComponent(key)}/save`, {
          method: "POST",
          body: JSON.stringify({ connector: template?.defaults || {} }),
        });
        let connected = false;
        let error = "";
        try {
          const testRes = await fetchBackend(`/v3/connectors/${encodeURIComponent(key)}/test`, { method: "POST", body: JSON.stringify({}) });
          connected = Boolean(testRes?.result?.probe?.connected);
        } catch (err) {
          connected = false;
          error = String(err?.message || "test failed");
        }
        results.push({ key, connected, error });
      }
      return { results };
    },
    onSuccess: (out) => {
      const rows = out?.results || [];
      const connected = rows.filter((r) => r.connected).length;
      const total = rows.length;
      setConnectorWizardError("");
      setConnectorWizardBulkSummary(`Auto-config complete: ${connected}/${total} connectors passed test.`);
      queryClient.invalidateQueries({ queryKey: ["connector_wizard_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["deterministic_audit"] });
      pushHistory({
        type: "connector_autoconfigure",
        label: "Connector Auto-configure",
        status: connected === total ? "success" : "failed",
        summary: `Configured ${total} connectors, ${connected} passed.`,
      });
    },
    onError: (err) => {
      const msg = String(err?.message || "Auto-configure failed");
      setConnectorWizardError(msg);
      setConnectorWizardBulkSummary("");
      pushHistory({ type: "connector_autoconfigure", label: "Connector Auto-configure", status: "failed", summary: msg });
    },
  });

  const schemaHistoryEntries = chatSchemaHistoryQuery.data?.entries || [];
  const selectedSchemaHistoryEntry = schemaHistoryEntries.find((x) => x.id === selectedSchemaHistoryId) || null;
  const selectedSchemaHistoryAgentDiffs = useMemo(() => {
    const entry = selectedSchemaHistoryEntry;
    if (!entry) return [];
    const beforeAgents = entry?.before?.agents || {};
    const afterAgents = entry?.after?.agents || {};
    const keys = Array.from(new Set([...Object.keys(beforeAgents), ...Object.keys(afterAgents)])).sort();
    return keys
      .map((key) => {
        const before = beforeAgents[key] || {};
        const after = afterAgents[key] || {};
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        if (!changed) return null;
        return {
          id: key,
          beforeFields: Object.keys(before?.fields || {}).length,
          afterFields: Object.keys(after?.fields || {}).length,
          beforeActions: Object.keys(before?.actions || {}).length,
          afterActions: Object.keys(after?.actions || {}).length,
        };
      })
      .filter(Boolean);
  }, [selectedSchemaHistoryEntry]);
  const selectedSchemaDiff = useMemo(() => {
    const entry = selectedSchemaHistoryEntry;
    if (!entry) return { added: new Set(), removed: new Set(), changed: new Set() };
    const beforeFlat = flattenObjectForDiff(entry.before || {});
    const afterFlat = flattenObjectForDiff(entry.after || {});
    const keys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
    const added = new Set();
    const removed = new Set();
    const changed = new Set();
    keys.forEach((k) => {
      const inBefore = Object.prototype.hasOwnProperty.call(beforeFlat, k);
      const inAfter = Object.prototype.hasOwnProperty.call(afterFlat, k);
      if (!inBefore && inAfter) {
        added.add(k);
        return;
      }
      if (inBefore && !inAfter) {
        removed.add(k);
        return;
      }
      if (beforeFlat[k] !== afterFlat[k]) changed.add(k);
    });
    return { added, removed, changed };
  }, [selectedSchemaHistoryEntry]);
  const selectedSchemaBeforeLines = useMemo(
    () => renderJsonLinesWithPaths(selectedSchemaHistoryEntry?.before || {}),
    [selectedSchemaHistoryEntry]
  );
  const selectedSchemaAfterLines = useMemo(
    () => renderJsonLinesWithPaths(selectedSchemaHistoryEntry?.after || {}),
    [selectedSchemaHistoryEntry]
  );
  const connectorWizardRows = connectorWizardQuery.data?.connectors || [];
  const selectedConnectorWizard = connectorWizardRows.find((x) => x.key === connectorWizardKey) || null;
  const connectorTemplates = connectorTemplateQuery.data?.templates || [];
  const selectedConnectorTemplate = connectorTemplates.find((t) => t.key === connectorWizardKey) || null;
  const deterministicSummary = deterministicAuditQuery.data?.summary || null;
  const liveReadinessPct = Number(deterministicSummary?.live_readiness_pct || 0);

  const replayAllDeadLettersMutation = useMutation({
    mutationFn: async () => {
      for (const dlq of deadLetters.slice(0, 20)) {
         
        await fetchBackend(`/v7/actions/dead-letters/${encodeURIComponent(dlq.id)}/replay`, {
          method: "POST",
          body: JSON.stringify({ requested_by: USER_ID }),
        });
      }
      return true;
    },
    onSuccess: () => {
      pushHistory({
        type: "dead_letter_replay_all",
        label: "Dead Letter Replay All",
        status: "success",
        summary: "Replayed pending dead letters",
      });
      queryClient.invalidateQueries({ queryKey: ["phase6_dead_letters"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_deterministic_runs"] });
      queryClient.invalidateQueries({ queryKey: ["phase6_reliability_snapshot"] });
    },
    onError: (err) => {
      pushHistory({
        type: "dead_letter_replay_all",
        label: "Dead Letter Replay All",
        status: "failed",
        summary: String(err?.message || "replay all failed"),
      });
    },
  });

  const toggleFavorite = async (id) => {
    const next = favoriteSet.has(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavorites(next);
    if (hasRemoteBackend()) {
      try {
        await saveUserFavoritesRemote(USER_ID, next);
        queryClient.invalidateQueries({ queryKey: ["phase4_user_favorites", USER_ID] });
      } catch {
        localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(next));
      }
      return;
    }
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(next));
  };

  const savePersonalization = async () => {
    if (hasRemoteBackend()) {
      try {
        await saveUserPersonalizationRemote(USER_ID, agent.id, personalization);
        queryClient.invalidateQueries({ queryKey: ["phase4_user_personalization", USER_ID, agent.id] });
        return;
      } catch {
      }
    }
    localStorage.setItem(personalizationKey(agent.id), JSON.stringify(personalization));
  };

  const saveCurrentPreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    const preset = {
      agent_id: agent.id,
      name,
      capability_id: "",
      payload: { personalization },
    };
    if (hasRemoteBackend()) {
      await saveToolPresetRemote(USER_ID, preset);
      queryClient.invalidateQueries({ queryKey: ["phase4_tool_presets", USER_ID, agent.id] });
      setPresetName("");
      return;
    }
    const key = `jarvis.tool.presets.${agent.id}.v1`;
    const local = JSON.parse(localStorage.getItem(key) || "[]");
    local.unshift({ ...preset, id: `preset_${Date.now()}` });
    const clipped = local.slice(0, 100);
    localStorage.setItem(key, JSON.stringify(clipped));
    setToolPresets(clipped);
    setPresetName("");
  };

  const removePreset = async (presetId) => {
    if (hasRemoteBackend()) {
      await deleteToolPresetRemote(USER_ID, presetId);
      queryClient.invalidateQueries({ queryKey: ["phase4_tool_presets", USER_ID, agent.id] });
      return;
    }
    const key = `jarvis.tool.presets.${agent.id}.v1`;
    const local = JSON.parse(localStorage.getItem(key) || "[]").filter((x) => x.id !== presetId);
    localStorage.setItem(key, JSON.stringify(local));
    setToolPresets(local);
  };

  const applyPreset = (preset) => {
    const next = preset?.payload?.personalization;
    if (!next) return;
    setPersonalization((p) => ({ ...p, ...next }));
  };

  const buildActionPlanFromChat = (text) => {
    const prompt = String(text || "").toLowerCase();
    const play = AGENT_ANALYTICS_PLAYBOOK[agent.id] || { northStar: "Execution Quality", fixHint: "stabilize core operations", integrationHint: "connect required APIs" };
    const connectedCount = Object.values(integrationState || {}).filter((x) => x?.status === "connected").length;
    const totalIntegrations = (integrationCatalog || []).length;
    const opsDays = (opsTrendData || []).filter((d) => d.volume > 0);
    const successRate = opsDays.length
      ? Math.round(opsDays.reduce((acc, d) => acc + (d.successRate || 0), 0) / opsDays.length)
      : 0;
    const needsFix = /fix|broken|not working|error|issue|glitch|problem/.test(prompt);
    const needsIntegration = /integrat|api|connect|setup|configure|sync/.test(prompt);

    if (!needsFix && !needsIntegration) return "";

    const actions = [];
    if (needsFix) {
      actions.push(`Check latest failed runs in Ops Timeline and rerun top failing action.`);
      actions.push(`Raise execution success from ${successRate}% to >90% by addressing repeated failures first.`);
      actions.push(`Focus for ${agent.name}: ${play.fixHint}.`);
    }
    if (needsIntegration) {
      actions.push(`Connected integrations: ${connectedCount}/${totalIntegrations}. Connect missing critical endpoints first.`);
      actions.push(`Priority integration path: ${play.integrationHint}.`);
      actions.push(`After connecting, run Self Test and one role runbook to validate end-to-end flow.`);
    }

    return [
      `Action Plan (${agent.name})`,
      `North Star: ${play.northStar}`,
      ...actions.map((a, idx) => `${idx + 1}. ${a}`),
    ].join("\n");
  };

  const summarizeLatestResult = (result) => {
    if (!result || typeof result !== "object") {
      return {
        title: "No result yet",
        status: "idle",
        summary: "Run a function to see its outcome.",
        action: "",
        details: [],
      };
    }
    const status = String(result.status || result.result?.status || "success");
    const action = String(result.action || result.functionName || result.function_name || "");
    const payload = result.result || result.data || {};
    const summary =
      payload?.summary ||
      payload?.message ||
      result?.message ||
      (status === "pending_approval"
        ? "Awaiting approval before execution."
        : status === "suggest_only"
          ? "Suggestion generated. No action executed."
          : "Action completed.");
    const details = [];
    if (payload?.recommendation) details.push(`Recommendation: ${payload.recommendation}`);
    if (payload?.kpi?.key && payload?.kpi?.value !== undefined) details.push(`KPI: ${payload.kpi.key} = ${payload.kpi.value}`);
    if (Array.isArray(payload?.next_actions) && payload.next_actions.length) details.push(`Next: ${payload.next_actions[0]}`);
    if (result?.approval?.id) details.push(`Approved by ${result.approval.approved_by || "operator"}`);
    return {
      title: action ? action.replace(/_/g, " ") : "Latest function result",
      status,
      summary: String(summary),
      action,
      details: details.slice(0, 3),
    };
  };

  const deriveChatQuickActions = (messageText = "") => {
    const text = String(messageText || "");
    const actions = [];
    const push = (label, command, type = "command") => {
      if (!label) return;
      const key = `${type}:${label}:${command || ""}`;
      if (actions.some((a) => `${a.type}:${a.label}:${a.command || ""}` === key)) return;
      actions.push({ label, command, type });
    };

    if (/Reply with 1,\s*2,\s*or\s*3\./i.test(text)) {
      push("Option 1", "1");
      push("Option 2", "2");
      push("Option 3", "3");
    }
    if (/Say "run it"/i.test(text) || /run it/i.test(text)) push("Run It", "run it");
    if (/mode set to/i.test(text) || /mode is/i.test(text)) {
      push("Mode: Plan", "mode plan");
      push("Mode: Simulate", "mode simulate");
      push("Mode: Execute", "mode execute");
    }
    if (/pending approval|Approve in the approvals panel/i.test(text)) {
      push("Open Ops", "", "tab:ops");
    }
    if (/simulate mode|dry run|No execution performed/i.test(text)) push("Simulate", "mode simulate");
    if (/plan for|ask for a plan|plan first/i.test(text)) push("Plan", "ask for a plan");
    return actions.slice(0, 5);
  };

  const deriveStructuredChatCard = (messageText = "") => {
    const text = String(messageText || "");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const read = (prefix) => {
      const hit = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
      if (!hit) return "";
      return hit.slice(prefix.length).trim();
    };
    const action = read("Action:");
    const runRef = read("Run Ref:");
    const status = read("Status:");
    const kpi = read("KPI:");
    const nextBest = read("Next Best Action:");
    const approvalId = read("Approval ID:");
    const reason = read("Reason:");
    const task = read("Task:");
    const constraints = read("Constraints:");
    const modeSet = /mode set to\s+([a-z]+)/i.exec(text)?.[1] || "";
    const missingLine = lines.find((l) => /^.*still need:/i.test(l)) || "";
    const missingFields = missingLine
      ? missingLine
          .replace(/^.*still need:\s*/i, "")
          .replace(/\.$/, "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    const hasPlan = lines.some((l) => /^\d+\.\s+/.test(l));
    const steps = lines.filter((l) => /^\d+\.\s+/.test(l)).slice(0, 6);
    const simulate = /No execution performed \(simulate mode\)/i.test(text);
    const hasStructured = Boolean(action || runRef || status || kpi || nextBest || approvalId || reason || task || constraints || modeSet || hasPlan || simulate);
    if (!hasStructured) return null;
    return {
      title: lines[0],
      action,
      runRef,
      status,
      kpi,
      nextBest,
      approvalId,
      reason,
      task,
      constraints,
      modeSet,
      missingFields,
      steps,
      simulate,
    };
  };

  const getFieldSchema = (field) => {
    const remoteCommon = chatSchemaQuery.data?.common?.fields || {};
    const remoteAgent = chatSchemaQuery.data?.agent?.fields || {};
    const agentSchema = CHAT_FIELD_SCHEMA_BY_AGENT[agent.id] || {};
    return remoteAgent[field] || remoteCommon[field] || agentSchema[field] || CHAT_FIELD_SCHEMA_COMMON[field] || { type: "text", label: field.replace(/_/g, " ") };
  };

  const getActionSchema = (action = "") => {
    const key = String(action || "").trim().toLowerCase();
    if (!key) return null;
    const remoteCommon = chatSchemaQuery.data?.common?.actions || {};
    return remoteCommon[key] || CHAT_ACTION_SCHEMA_COMMON[key] || null;
  };

  const getOrderedMissingFields = (missingFields = [], action = "") => {
    const fields = Array.isArray(missingFields) ? missingFields : [];
    const schema = getActionSchema(action);
    if (!schema?.fields?.length) return fields;
    const inOrder = schema.fields.filter((f) => fields.includes(f));
    const extras = fields.filter((f) => !inOrder.includes(f));
    return [...inOrder, ...extras];
  };

  const normalizeFieldValueForCommand = (field, value) => {
    if (value == null) return "";
    if (Array.isArray(value)) return value.join(",");
    if (field === "budget") return String(value).replace(/[^0-9.]/g, "");
    return String(value).trim();
  };

  const triggerChatQuickAction = (action) => {
    if (!action) return;
    if (String(action.type || "").startsWith("tab:")) {
      const tabName = String(action.type || "").split(":")[1] || "ops";
      goTab(tabName);
      return;
    }
    const cmd = String(action.command || "").trim();
    if (!cmd) return;
    if (sendChat.isPending || (hasRemoteBackend() && !conversationReady)) return;
    setChatInput(cmd);
    sendChat.mutate(cmd);
  };

  const submitStructuredCardInputs = (messageKey, structured) => {
    const fields = Array.isArray(structured?.missingFields) ? structured.missingFields : [];
    if (!fields.length) return;
    const values = chatCardInputs[messageKey] || {};
    const missing = fields.filter((f) => {
      const v = values[f];
      if (Array.isArray(v)) return v.length === 0;
      return !String(v || "").trim();
    });
    if (missing.length) {
      setMessages((prev) => [...prev, { role: "assistant", text: `${agent.name}: please fill: ${missing.join(", ")}` }]);
      return;
    }
    const phrase = fields
      .map((f) => {
        const normalized = normalizeFieldValueForCommand(f, values[f]);
        return `${f} ${normalized}`.trim();
      })
      .join(", ");
    const cmd = `${phrase}. run it`;
    if (sendChat.isPending || (hasRemoteBackend() && !conversationReady)) return;
    setChatInput(cmd);
    sendChat.mutate(cmd);
  };

  const goTab = (nextTab) => navigate(nextTab === "overview" ? `/agents/${agent.id}` : `/agents/${agent.id}/${nextTab}`);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6">
      <div className={`app-card p-6 border ${theme.border} relative overflow-hidden`}>
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <agent.icon className={`w-6 h-6 ${agent.color}`} />
              <h1 className="text-2xl font-semibold text-slate-900">{agent.name}</h1>
              <Badge className={statusClass(live.status)}>{String(live.status || "idle").replace("_", " ")}</Badge>
            </div>
            <p className="text-slate-600 mt-2 max-w-3xl">{agent.tagline}</p>
            {businessProfile?.company_name && <p className="text-xs text-slate-500 mt-1">Business context: {businessProfile.company_name}</p>}
          </div>
          <Button onClick={() => selfTest.mutate()} className={`${theme.button} text-white rounded-lg`}>
            {selfTest.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run Self Test
          </Button>
        </div>

        <div className="border-b border-slate-200 mt-6">
          <div ref={tabsScrollRef} className="flex gap-6 overflow-x-auto pb-1">
            {availableTabs.map((t) => (
              <button
                key={t}
                className={`py-3 text-sm whitespace-nowrap border-b-2 ${tab === t ? `${theme.tab} font-semibold` : "border-transparent text-slate-500 hover:text-slate-700"}`}
                onClick={() => goTab(t)}
              >
                {tabLabels[t] || TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
              <Button size="sm" variant="outline" className="h-6 px-2 rounded-md text-[10px]" onClick={() => scrollTabsBy(-160)} disabled={!tabsScrollable}>
                ?
              </Button>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">Swipe tabs</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(tabsScrollPct * 100)}
                onChange={(e) => {
                  const el = tabsScrollRef.current;
                  if (!el) return;
                  const max = Math.max(0, el.scrollWidth - el.clientWidth);
                  const next = (Number(e.target.value) / 100) * max;
                  el.scrollTo({ left: next, behavior: "smooth" });
                }}
                className="w-full h-1 accent-blue-600"
                aria-label="Swipe tabs"
                disabled={!tabsScrollable}
              />
              <Button size="sm" variant="outline" className="h-6 px-2 rounded-md text-[10px]" onClick={() => scrollTabsBy(160)} disabled={!tabsScrollable}>
                ?
              </Button>
            </div>
        </div>

        {tab === "overview" && (
          <div className="pt-6 grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 app-soft p-4">
              <h2 className="text-lg font-medium text-slate-900">Overview</h2>
              <div className="mt-2 mb-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-900">{personality.title}</p>
                <p className="text-xs text-slate-600 mt-1">Conversational mode with execution-aware responses.</p>
                {collaborators.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] text-slate-500 mb-1">Primary collaborators</p>
                    <div className="flex flex-wrap gap-1">
                      {collaborators.map((c) => (
                        <Badge key={c.id} className="bg-white border border-slate-200 text-slate-700">{c.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <ul className="mt-3 space-y-2 text-slate-700 text-sm">
                {capabilities.slice(0, 30).map((c) => <li key={c.id}>• {c.label}</li>)}
              </ul>
              <p className="mt-4 text-sm text-slate-500">Current focus: {live.current_focus}</p>
            </div>
            <div className="app-soft p-4">
              <h3 className="text-sm font-semibold text-slate-900">Quick Stats</h3>
              <p className="text-sm text-slate-600 mt-2">Key metric: {live.key_metric}</p>
              <p className="text-sm text-slate-600">Capabilities: {capabilities.length || agent.capabilities.length}</p>
              <p className="text-sm text-slate-600">Workflow packs: {visibleTemplates.length}</p>
              <p className="text-sm text-slate-600">Ops actions: {opsActions.length}</p>
              <Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={() => navigate("/BusinessProfile")}>
                Open Business Profile
              </Button>
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div className="pt-6 h-[70vh] flex flex-col">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Chat with {agent.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {summarizeBusinessContext(businessProfile, agent.id).identity || `A clean conversation view for ${agent.name}.`} {summarizeBusinessContext(businessProfile, agent.id).references}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {agent.id === "canvas" && (
                  <Button size="sm" variant="outline" className="rounded h-8 text-[11px] px-3" onClick={() => goTab("integrations")}>
                    Providers
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded h-8 text-[11px] px-3" onClick={() => setShowChatMemoryPanel(true)}>
                  Memory & Context
                </Button>
              </div>
            </div>
            {activeChatPlaybook && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-violet-900">Using playbook: {activeChatPlaybook.title}</p>
                  <p className="text-[11px] text-violet-700 truncate">{activeChatPlaybook.summary || "This playbook is guiding the conversation quietly in the background."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" onClick={() => applyPlaybookToPlan(activeChatPlaybook)}>
                    Apply to Plan
                  </Button>
                  <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" onClick={() => setActiveChatPlaybook(null)}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              {messages.length === 0 && <p className="text-sm text-slate-500">Ask {agent.name} what you want to figure out, change, or execute.</p>}
              {messages.map((m, i) => {
                const structured = m.role === "assistant" ? deriveStructuredChatCard(m.text) : null;
                const embeddedImages = m.role === "assistant" ? extractMarkdownImages(m.text) : [];
                const embeddedMedia = m.role === "assistant" ? extractEmbeddedMedia(m.text) : [];
                const messageText = m.role === "assistant" ? stripMarkdownImages(m.text) : m.text;
                return (
                  <div key={`${m.role}-${i}`} className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${m.role === "user" ? "ml-auto bg-[#2563EB] text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"}`}>
                    {m.role === "assistant" && m.routedTier && (
                      <div className="mb-2 flex items-center gap-2">
                        <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                          {m.routedTier} tier
                        </Badge>
                        {m.routedProvider && m.routedProvider !== "fallback" && (
                          <span className="text-[10px] text-slate-500">
                            {m.routedProvider}{m.routedModel ? ` · ${m.routedModel}` : ""}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{messageText}</div>
                    {embeddedImages.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {embeddedImages.map((img, ii) => (
                          <button
                            type="button"
                            key={`${i}-img-${ii}`}
                            onClick={() => setChatImageModal(img)}
                            className="block text-left"
                          >
                            <img
                              src={img.url}
                              alt={img.alt || "generated"}
                              className="w-full max-w-md rounded-lg border border-slate-200 object-cover transition hover:shadow-md"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {embeddedMedia.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {embeddedMedia.map((media, mi) => (
                          <div key={`${i}-media-${mi}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-2 text-[11px] font-medium text-slate-700">{media.alt || media.kind}</p>
                            {media.kind === "audio" ? (
                              <audio controls className="w-full" src={media.url} />
                            ) : (
                              <video controls playsInline className="w-full max-w-md rounded-lg border border-slate-200 bg-black" src={media.url} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && structured && (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                        <summary className="cursor-pointer list-none font-medium text-slate-600">Details</summary>
                        <div className="mt-2 space-y-1">
                        {structured.modeSet && <div><span className="font-semibold">Mode</span>: {structured.modeSet}</div>}
                        {structured.action && <div><span className="font-semibold">Action</span>: {structured.action}</div>}
                        {structured.runRef && <div><span className="font-semibold">Run Ref</span>: {structured.runRef}</div>}
                        {structured.status && <div><span className="font-semibold">Status</span>: {structured.status}</div>}
                        {structured.kpi && <div><span className="font-semibold">KPI</span>: {structured.kpi}</div>}
                        {structured.nextBest && <div><span className="font-semibold">Next Best Action</span>: {structured.nextBest}</div>}
                        {structured.approvalId && <div><span className="font-semibold">Approval ID</span>: {structured.approvalId}</div>}
                        {structured.reason && <div><span className="font-semibold">Reason</span>: {structured.reason}</div>}
                        {structured.task && <div><span className="font-semibold">Task</span>: {structured.task}</div>}
                        {structured.constraints && <div><span className="font-semibold">Constraints</span>: {structured.constraints}</div>}
                        {structured.simulate && <div><span className="font-semibold">Simulation</span>: No execution performed</div>}
                        {structured.steps.length > 0 && (
                          <div>
                            <div className="font-semibold">Steps</div>
                            {structured.steps.map((s, si) => <div key={`${i}-step-${si}`}>{s}</div>)}
                          </div>
                        )}
                        {Array.isArray(structured.missingFields) && structured.missingFields.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <div className="font-semibold">Missing Inputs</div>
                            {getActionSchema(structured.action || chatPendingAction?.action || "")?.help && (
                              <p className="text-[10px] text-slate-600">
                                {getActionSchema(structured.action || chatPendingAction?.action || "")?.help}
                              </p>
                            )}
                            <div className="grid md:grid-cols-2 gap-1.5">
                              {getOrderedMissingFields(
                                structured.missingFields,
                                structured.action || chatPendingAction?.action || ""
                              ).map((field) => {
                                const spec = getFieldSchema(field);
                                const actionSchema = getActionSchema(structured.action || chatPendingAction?.action || "");
                                const fieldHelp = actionSchema?.fieldHelp?.[field] || "";
                                const currentVal = (chatCardInputs[`${i}`] || {})[field];
                                const setVal = (val) => {
                                  setChatCardInputs((prev) => ({
                                    ...prev,
                                    [`${i}`]: {
                                      ...(prev[`${i}`] || {}),
                                      [field]: val,
                                    },
                                  }));
                                };
                                if (spec.type === "select") {
                                  return (
                                    <div key={`${i}-field-${field}`} className="space-y-1">
                                      <select
                                        className="border border-slate-300 rounded px-2 py-1 text-[11px] w-full"
                                        value={String(currentVal || "")}
                                        onChange={(e) => setVal(e.target.value)}
                                      >
                                        <option value="">{spec.label || field}</option>
                                        {(spec.options || []).map((opt) => <option key={`${field}-${opt}`} value={opt}>{opt}</option>)}
                                      </select>
                                      {fieldHelp && <p className="text-[10px] text-slate-500">{fieldHelp}</p>}
                                    </div>
                                  );
                                }
                                if (spec.type === "multiselect") {
                                  const active = Array.isArray(currentVal) ? currentVal : [];
                                  return (
                                    <div key={`${i}-field-${field}`} className="border border-slate-300 rounded px-2 py-1">
                                      <p className="text-[10px] text-slate-600 mb-1">{spec.label || field}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(spec.options || []).map((opt) => {
                                          const on = active.includes(opt);
                                          return (
                                            <button
                                              type="button"
                                              key={`${field}-${opt}`}
                                              className={`px-1.5 py-0.5 rounded text-[10px] border ${on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}
                                              onClick={() => {
                                                const next = on ? active.filter((x) => x !== opt) : [...active, opt];
                                                setVal(next);
                                              }}
                                            >
                                              {opt}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {fieldHelp && <p className="text-[10px] text-slate-500 mt-1">{fieldHelp}</p>}
                                    </div>
                                  );
                                }
                                if (spec.type === "textarea") {
                                  return (
                                    <div key={`${i}-field-${field}`} className="space-y-1">
                                      <textarea
                                        className="border border-slate-300 rounded px-2 py-1 text-[11px] min-h-[64px] w-full"
                                        placeholder={spec.label || field}
                                        value={String(currentVal || "")}
                                        onChange={(e) => setVal(e.target.value)}
                                      />
                                      {fieldHelp && <p className="text-[10px] text-slate-500">{fieldHelp}</p>}
                                    </div>
                                  );
                                }
                                return (
                                  <div key={`${i}-field-${field}`} className="space-y-1">
                                    <input
                                      className="border border-slate-300 rounded px-2 py-1 text-[11px] w-full"
                                      type={spec.type === "number" || spec.type === "date" ? spec.type : "text"}
                                      placeholder={spec.label || field}
                                      value={String(currentVal || "")}
                                      onChange={(e) => setVal(e.target.value)}
                                    />
                                    {fieldHelp && <p className="text-[10px] text-slate-500">{fieldHelp}</p>}
                                  </div>
                                );
                              })}
                            </div>
                            <Button
                              size="sm"
                              className="rounded h-7 text-[11px] px-2 bg-slate-900 hover:bg-slate-800 text-white"
                              onClick={() => submitStructuredCardInputs(`${i}`, structured)}
                              disabled={sendChat.isPending || (hasRemoteBackend() && !conversationReady)}
                            >
                              Submit & Run
                            </Button>
                          </div>
                        )}
                        </div>
                      </details>
                    )}
                    {m.role === "assistant" && deriveChatQuickActions(m.text).length > 0 && (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-600">Suggested actions</summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {deriveChatQuickActions(m.text).map((qa, idx) => (
                            <Button
                              key={`${i}-qa-${idx}-${qa.label}`}
                              size="sm"
                              variant="outline"
                              className="rounded h-7 text-[11px] px-2"
                              onClick={() => triggerChatQuickAction(qa)}
                              disabled={sendChat.isPending || (hasRemoteBackend() && !conversationReady)}
                            >
                              {qa.label}
                            </Button>
                          ))}
                        </div>
                      </details>
                    )}
                    {m.role === "assistant" && Array.isArray(m.sources) && m.sources.length > 0 && (
                      <details className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                        <summary className="cursor-pointer list-none text-[11px] font-medium text-blue-800">Sources consulted ({m.sources.length})</summary>
                        <div className="mt-2 space-y-2">
                          {m.sources.slice(0, 3).map((source, idx) => {
                            const normalized = normalizeSource(source);
                            if (!normalized) return null;
                            return (
                              <div key={`${i}-source-${idx}`} className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-medium text-slate-800">{normalized.label}</p>
                                  <div className="flex items-center gap-1.5">
                                    {normalized.score > 0 && <Badge className="bg-slate-100 text-slate-700 border border-slate-200">score {normalized.score}</Badge>}
                                    {normalized.pinned && <Badge className="bg-amber-50 text-amber-700 border border-amber-200">pinned</Badge>}
                                    {normalized.library_key && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded h-6 text-[10px] px-2"
                                        onClick={() => toggleLibrarySourcePin(normalized)}
                                      >
                                        {normalized.pinned ? "Unpin" : "Pin"}
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded h-6 text-[10px] px-2"
                                      onClick={() => void promoteSourceToPlaybook(normalized)}
                                    >
                                      Promote
                                    </Button>
                                  </div>
                                </div>
                                {normalized.snippet && <p className="text-[11px] text-slate-600 mt-1">{normalized.snippet}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {chatComposerUploads.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chatComposerUploads.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm">
                    {asset.preview_url ? <img src={asset.preview_url} alt={asset.name} className="h-6 w-6 rounded-full object-cover border border-slate-200" /> : <Paperclip className="h-3.5 w-3.5 text-slate-400" />}
                    <span className="max-w-[180px] truncate">{asset.name}</span>
                    {asset.role_label && <Badge className="bg-slate-100 text-slate-700">{asset.role_label}</Badge>}
                    <button type="button" onClick={() => setChatComposerUploads((prev) => prev.filter((item) => item.id !== asset.id))} className="text-slate-400 hover:text-slate-700">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2 items-end">
              <input
                ref={chatUploadInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  void handleChatUploadSelection(files);
                  e.target.value = "";
                }}
              />
                <Button
                type="button"
                variant="outline"
                className="rounded-xl h-11 px-3"
                onClick={() => chatUploadInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <textarea
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm min-h-[56px] max-h-44"
                placeholder={`Message ${agent.name}...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleChatSubmit();
                  }
                }}
              />
              <Button
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg h-11"
                onClick={() => void handleChatSubmit()}
                disabled={sendChat.isPending || (hasRemoteBackend() && !conversationReady)}
              >
                {sendChat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {showChatMemoryPanel && (
              <div className="fixed inset-0 z-50 bg-slate-900/35 px-4 py-6" onClick={() => setShowChatMemoryPanel(false)}>
                <div
                  className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{agent.name} Memory & Context</p>
                      <p className="text-xs text-slate-500">Persistent memory, decision history, and context controls live here without taking over the chat.</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded h-8 text-[11px]" onClick={() => setShowChatMemoryPanel(false)}>
                      Close
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">What {agent.name} Remembers</p>
                            <p className="text-[11px] text-slate-500">Persistent memory across conversations for this agent.</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="rounded h-8 text-[11px]" onClick={() => void clearMemory()}>Clear</Button>
                            <Button size="sm" className={`rounded h-8 text-[11px] ${theme.button} text-white`} onClick={() => saveMemoryMutation.mutate(memoryEditor)} disabled={saveMemoryMutation.isPending || !memoryEditorDirty}>
                              Save Memory
                            </Button>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-2">
                          <div>
                            <p className="text-[11px] font-medium text-slate-700 mb-1">Priorities</p>
                            <textarea
                              className="w-full min-h-[88px] border border-slate-300 rounded-lg px-2 py-2 text-[11px]"
                              value={memoryEditor.priorities}
                              onChange={(e) => {
                                setMemoryEditor((prev) => ({ ...prev, priorities: e.target.value }));
                                setMemoryEditorDirty(true);
                              }}
                              placeholder="One per line"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-slate-700 mb-1">Recurring Concerns</p>
                            <textarea
                              className="w-full min-h-[88px] border border-slate-300 rounded-lg px-2 py-2 text-[11px]"
                              value={memoryEditor.concerns}
                              onChange={(e) => {
                                setMemoryEditor((prev) => ({ ...prev, concerns: e.target.value }));
                                setMemoryEditorDirty(true);
                              }}
                              placeholder="One per line"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-slate-700 mb-1">Working Preferences</p>
                            <textarea
                              className="w-full min-h-[88px] border border-slate-300 rounded-lg px-2 py-2 text-[11px]"
                              value={memoryEditor.preferences}
                              onChange={(e) => {
                                setMemoryEditor((prev) => ({ ...prev, preferences: e.target.value }));
                                setMemoryEditorDirty(true);
                              }}
                              placeholder="plan-first, risk-aware, execute-fast"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900 mb-2">Live Context</p>
                        <div className="space-y-2 text-[11px] text-slate-600">
                          <p>{summarizeBusinessContext(businessProfile, agent.id).identity || "No business profile context loaded yet."}</p>
                          <p>{summarizeBusinessContext(businessProfile, agent.id).references || "No shared reference assets yet."}</p>
                          <p>{summarizeLocalMemory(chatMemory).priorities || "No saved priorities yet."}</p>
                          <p>{summarizeLocalMemory(chatMemory).concerns || "No recurring concerns tracked yet."}</p>
                          <p>{summarizeLocalMemory(chatMemory).preferences || "No working preferences tracked yet."}</p>
                          <p>{summarizeLocalChange(chatMemory).decision || "No decision shift recorded yet."}</p>
                          <p>{summarizeLocalChange(chatMemory).diagnosis || "No diagnosis shift recorded yet."}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900 mb-2">Decision Timeline</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Array.isArray(chatMemory?.decision_log) && chatMemory.decision_log.length > 0 ? chatMemory.decision_log.slice(0, 4).map((entry) => (
                              <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[11px] font-medium text-slate-800">{entry.title}</p>
                                  <div className="flex items-center gap-1">
                                    <Badge className={`text-[9px] ${entry.status === "approved" ? "bg-emerald-100 text-emerald-700" : entry.status === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{entry.status || "draft"}</Badge>
                                    {entry.pinned && <Badge className="bg-amber-100 text-amber-700 text-[9px]">pinned</Badge>}
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{entry.summary}</p>
                                {Array.isArray(entry.sources) && entry.sources.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {entry.sources.map((source, idx) => {
                                      const s = normalizeSource(source);
                                      if (!s) return null;
                                      return (
                                        <div key={`${entry.id}-src-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                          <p className="text-[10px] font-medium text-slate-700">{s.label}</p>
                                          {s.snippet && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("decision", entry.id, { status: "approved" })}>Approve</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("decision", entry.id, { status: "rejected" })}>Reject</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("decision", entry.id, { pinned: !entry.pinned })}>{entry.pinned ? "Unpin" : "Pin"}</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void promoteTimelineEntryToPlaybook("decision", entry)}>Promote</Button>
                                </div>
                              </div>
                            )) : <p className="text-[11px] text-slate-500">No recent decisions yet.</p>}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900 mb-2">Diagnosis Timeline</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Array.isArray(chatMemory?.diagnosis_log) && chatMemory.diagnosis_log.length > 0 ? chatMemory.diagnosis_log.slice(0, 4).map((entry) => (
                              <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[11px] font-medium text-slate-800">{entry.title}</p>
                                  <div className="flex items-center gap-1">
                                    <Badge className={`text-[9px] ${entry.status === "approved" ? "bg-emerald-100 text-emerald-700" : entry.status === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{entry.status || "draft"}</Badge>
                                    {entry.pinned && <Badge className="bg-amber-100 text-amber-700 text-[9px]">pinned</Badge>}
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{entry.summary}</p>
                                {Array.isArray(entry.sources) && entry.sources.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {entry.sources.map((source, idx) => {
                                      const s = normalizeSource(source);
                                      if (!s) return null;
                                      return (
                                        <div key={`${entry.id}-src-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                          <p className="text-[10px] font-medium text-slate-700">{s.label}</p>
                                          {s.snippet && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("diagnosis", entry.id, { status: "approved" })}>Approve</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("diagnosis", entry.id, { status: "rejected" })}>Reject</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void updateTimelineEntry("diagnosis", entry.id, { pinned: !entry.pinned })}>{entry.pinned ? "Unpin" : "Pin"}</Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void promoteTimelineEntryToPlaybook("diagnosis", entry)}>Promote</Button>
                                </div>
                              </div>
                            )) : <p className="text-[11px] text-slate-500">No recent diagnoses yet.</p>}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900 mb-2">Trusted Memory</p>
                          <div className="space-y-2 max-h-28 overflow-y-auto">
                            {[
                              ...(Array.isArray(chatMemory?.decision_log) ? chatMemory.decision_log : []),
                              ...(Array.isArray(chatMemory?.diagnosis_log) ? chatMemory.diagnosis_log : []),
                            ].filter((entry) => entry?.status === "approved" || entry?.pinned).slice(0, 4).map((entry) => (
                              <div key={`trusted-${entry.id}`} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[11px] font-medium text-emerald-900">{entry.title}</p>
                                <p className="text-[10px] text-emerald-800 mt-0.5 line-clamp-2">{entry.summary}</p>
                              </div>
                            ))}
                            {[
                              ...(Array.isArray(chatMemory?.decision_log) ? chatMemory.decision_log : []),
                              ...(Array.isArray(chatMemory?.diagnosis_log) ? chatMemory.diagnosis_log : []),
                            ].filter((entry) => entry?.status === "approved" || entry?.pinned).length === 0 && <p className="text-[11px] text-slate-500">No trusted memory yet.</p>}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900 mb-2">Draft Queue</p>
                          <div className="space-y-2 max-h-28 overflow-y-auto">
                            {[
                              ...(Array.isArray(chatMemory?.decision_log) ? chatMemory.decision_log : []),
                              ...(Array.isArray(chatMemory?.diagnosis_log) ? chatMemory.diagnosis_log : []),
                            ].filter((entry) => !entry?.pinned && entry?.status !== "approved").slice(0, 4).map((entry) => (
                              <div key={`draft-${entry.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                                <p className="text-[11px] font-medium text-amber-900">{entry.title}</p>
                                <p className="text-[10px] text-amber-800 mt-0.5 line-clamp-2">{entry.summary}</p>
                              </div>
                            ))}
                            {[
                              ...(Array.isArray(chatMemory?.decision_log) ? chatMemory.decision_log : []),
                              ...(Array.isArray(chatMemory?.diagnosis_log) ? chatMemory.diagnosis_log : []),
                            ].filter((entry) => !entry?.pinned && entry?.status !== "approved").length === 0 && <p className="text-[11px] text-slate-500">No draft items waiting.</p>}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900 mb-2">Memory Playbooks</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Array.isArray(chatMemory?.playbooks) && chatMemory.playbooks.length > 0 ? chatMemory.playbooks.slice(0, 4).map((item) => (
                              <div key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-medium text-blue-900">{item.title}</p>
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-white text-blue-700 border border-blue-200 text-[9px]">{item.type}</Badge>
                                    {chatMemory?.default_playbook_id === item.id && <Badge className="bg-violet-50 text-violet-700 border border-violet-200 text-[9px]">default</Badge>}
                                    {item.provenance === "source" && <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px]">from source</Badge>}
                                  </div>
                                </div>
                                {playbookEditor.id === item.id ? (
                                  <div className="mt-2 space-y-2">
                                    <input
                                      className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-[11px] text-slate-800"
                                      value={playbookEditor.title}
                                      onChange={(e) => setPlaybookEditor((prev) => ({ ...prev, title: e.target.value }))}
                                      placeholder="Playbook title"
                                    />
                                    <textarea
                                      className="w-full min-h-[64px] rounded border border-blue-200 bg-white px-2 py-1 text-[11px] text-slate-800"
                                      value={playbookEditor.summary}
                                      onChange={(e) => setPlaybookEditor((prev) => ({ ...prev, summary: e.target.value }))}
                                      placeholder="What should this playbook guide?"
                                    />
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-blue-800 mt-0.5 line-clamp-2">{item.summary}</p>
                                )}
                                {Array.isArray(item.sources) && item.sources.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    <p className="text-[10px] text-blue-700">Sources: {item.sources.map((s) => normalizeSource(s)?.label).filter(Boolean).join(", ")}</p>
                                    {item.sources.slice(0, 2).map((source, idx) => {
                                      const s = normalizeSource(source);
                                      if (!s) return null;
                                      return (
                                        <div key={`${item.id}-src-${idx}`} className="rounded border border-blue-100 bg-white/80 px-2 py-1">
                                          <p className="text-[10px] font-medium text-slate-700">{s.label}</p>
                                          {s.snippet && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => activatePlaybookInChat(item)}>
                                    Use in Chat
                                  </Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => applyPlaybookToPlan(item)}>
                                    Apply to Plan
                                  </Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void convertPlaybookToWorkflowPack(item)}>
                                    Create Pack
                                  </Button>
                                  {playbookEditor.id === item.id ? (
                                    <>
                                      <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void savePlaybookEdit()}>
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => cancelPlaybookEdit()}>
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => startPlaybookEdit(item)}>
                                      Edit
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void setDefaultPlaybook(item)}>
                                    Set Default
                                  </Button>
                                  <Button size="sm" variant="outline" className="rounded h-6 px-2 text-[10px]" onClick={() => void deletePlaybook(item)}>
                                    Delete
                                  </Button>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <select
                                    className="rounded border border-blue-200 bg-white px-2 py-1 text-[10px] text-slate-700"
                                    value={playbookShareTargets[item.id] || ""}
                                    onChange={(e) => setPlaybookShareTargets((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  >
                                    <option value="">Share to agent...</option>
                                    {Object.values(AGENT_BY_ID).filter((candidate) => candidate.id !== agent.id).map((candidate) => (
                                      <option key={`${item.id}-share-${candidate.id}`} value={candidate.id}>{candidate.name}</option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded h-6 px-2 text-[10px]"
                                    disabled={!playbookShareTargets[item.id]}
                                    onClick={() => void sharePlaybookToAgent(item, playbookShareTargets[item.id])}
                                  >
                                    Share
                                  </Button>
                                </div>
                              </div>
                            )) : <p className="text-[11px] text-slate-500">No playbooks promoted yet.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {chatImageModal && (
              <div
                className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-6"
                onClick={() => setChatImageModal(null)}
              >
                <div
                  className="relative max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setChatImageModal(null)}
                    className="absolute top-3 right-3 rounded-full bg-white/90 border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-white"
                  >
                    Close
                  </button>
                  <div className="p-4 border-b border-slate-200">
                    <p className="text-sm font-medium text-slate-900">{chatImageModal.alt || "Generated asset"}</p>
                  </div>
                  <div className="bg-slate-100 p-4 flex items-center justify-center">
                    <img
                      src={chatImageModal.url}
                      alt={chatImageModal.alt || "Generated asset"}
                      className="max-h-[80vh] w-auto rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "tools" && (
          <div className="pt-6 space-y-5">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <p className={`text-xs font-semibold ${theme.text}`}>{agent.name} Tooling Profile</p>
              <p className="text-xs text-slate-600 mt-1">
                {personality.title}: {opsBrief.focus}
              </p>
            </div>
            <div className="app-soft p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Operating Profile</h3>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
                <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="brand voice" value={personalization.brandVoice} onChange={(e) => setPersonalization((p) => ({ ...p, brandVoice: e.target.value }))} />
                <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="objective" value={personalization.objective} onChange={(e) => setPersonalization((p) => ({ ...p, objective: e.target.value }))} />
                <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="channels" value={personalization.channels} onChange={(e) => setPersonalization((p) => ({ ...p, channels: e.target.value }))} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={personalization.autonomyTier} onChange={(e) => setPersonalization((p) => ({ ...p, autonomyTier: e.target.value }))}>
                  {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void savePersonalization()}>Save Personalization</Button>
                <input className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs w-56" placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                <Button size="sm" className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white" onClick={() => void saveCurrentPreset()}>Save Preset</Button>
              </div>

              {toolPresets.length > 0 && (
                <div className="mt-3 space-y-2">
                  {toolPresets.slice(0, 6).map((p) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-700">{p.name}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => applyPreset(p)}>Apply</Button>
                        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => void removePreset(p.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {businessPresetTemplates.length > 0 && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Business-Fit Workflow Presets</h3>
                  <Badge className="bg-slate-100 text-slate-700">{businessPresetTemplates.length}</Badge>
                </div>
                <p className="text-xs text-slate-600 mb-3">Based on your business profile, these packs are prioritized for fast deployment.</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {businessPresetTemplates.map((t) => (
                    <div key={`biz-preset-${t.id}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{t.name}</p>
                        <Badge className={riskBadgeClass(t.risk)}>{t.risk}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{t.business_type} · {t.category}</p>
                      {t.from_playbook && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge className="bg-violet-50 text-violet-700 border border-violet-200">from playbook</Badge>
                          {t.source_playbook_title && <span className="text-[11px] text-violet-700">{t.source_playbook_title}</span>}
                        </div>
                      )}
                      <p className="text-xs text-slate-600 mt-1">{t.description}</p>
                      <Button size="sm" className={`mt-2 rounded-lg ${theme.button} text-white`} onClick={() => importTemplate.mutate(t)} disabled={importTemplate.isPending}>
                        {importTemplate.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Download className="w-3 h-3 mr-2" />}
                        Deploy Preset
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={toolSearch} onChange={(e) => setToolSearch(e.target.value)} placeholder="Search role tools" className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm" />
            </div>

            {toolZones.length > 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Role Tool Zones</h3>
                <p className="text-xs text-slate-600 mb-3">Tools are grouped by operating function for faster execution.</p>
                <div className="space-y-3">
                  {toolZones.map((zone) => (
                    <div key={`zone-${zone.zone}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-slate-900">{zone.label}</p>
                        <Badge className="bg-slate-100 text-slate-700">{zone.tools.length}</Badge>
                      </div>
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {zone.tools.map((tool) => (
                          <div key={`zone-tool-${zone.zone}-${tool.id}`} className="border border-slate-200 rounded-md p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-slate-900">{tool.label}</p>
                              <button
                                className={`text-slate-400 hover:${theme.text}`}
                                onClick={() => void toggleFavorite(tool.id)}
                                title="Toggle favorite"
                              >
                                <Star className={`w-3.5 h-3.5 ${favoriteSet.has(tool.id) ? "fill-amber-400 text-amber-500" : ""}`} />
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{tool.description}</p>
                            <div className="mt-2 flex gap-1">
                              <Button size="sm" className={`rounded h-7 text-[11px] px-2 ${theme.button} text-white`} disabled={runTool.isPending} onClick={() => runTool.mutate(tool.id)}>
                                {runTool.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                                Run
                              </Button>
                              <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" onClick={() => { setChatInput(`Use ${tool.label} for ${personalization.objective || "current objective"}`); goTab("chat"); }}>
                                Prompt
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {toolZones.length === 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Role Tool Zones</h3>
                <p className="text-xs text-slate-600 mb-3">No tools loaded yet for this profile. Use chat mode to trigger role actions.</p>
                <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={() => goTab("chat")}>
                  Open Chat
                </Button>
              </div>
            )}

            {agent.id === "scribe" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Knowledge Capture Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("knowledge-library")}>Open Knowledge Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Document / knowledge item name" value={scribeDraft.name} onChange={(e) => setScribeDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={scribeDraft.type} onChange={(e) => setScribeDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="document">Document</option>
                    <option value="article">Article</option>
                    <option value="sop">SOP</option>
                    <option value="decision">Decision Log</option>
                    <option value="meeting_note">Meeting Note</option>
                    <option value="template">Template</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveScribeLibraryItem}>Save Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={scribeDraft.tags} onChange={(e) => setScribeDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Summary, context, and key takeaways..." value={scribeDraft.summary} onChange={(e) => setScribeDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "canvas" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Canvas Studio</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("content-bank")}>
                    Open Content Bank
                  </Button>
                </div>
                <p className="text-xs text-slate-600">Quick-generate creative here. Use Content Bank for full upload management, tagging, derivative generation, and sharing to Maestro.</p>
                <div className="grid md:grid-cols-4 gap-2">
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={canvasType} onChange={(e) => setCanvasType(e.target.value)}>
                    <option value="image">Image</option>
                    <option value="reel">Reel</option>
                    <option value="carousel">Carousel</option>
                    <option value="script">Script</option>
                  </select>
                  <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tone" value={canvasTone} onChange={(e) => setCanvasTone(e.target.value)} />
                  <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="platform" value={canvasPlatform} onChange={(e) => setCanvasPlatform(e.target.value)} />
                  <Button className="rounded-lg bg-violet-700 hover:bg-violet-600 text-white" disabled={generateCanvas.isPending} onClick={() => generateCanvas.mutate()}>
                    {generateCanvas.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}Generate
                  </Button>
                </div>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Describe the creative: product, message, style, CTA, references..." value={canvasBrief} onChange={(e) => setCanvasBrief(e.target.value)} />

                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-2">Source Media Library ({canvasMediaAssets.length})</h4>
                  <div className="grid md:grid-cols-3 gap-2 mb-2">
                    <label className="md:col-span-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer">
                      Upload images, videos, flyers
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          handleCanvasMediaUpload(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <Button
                      className={`rounded-lg ${theme.button} text-white`}
                      disabled={generateCanvasFromMedia.isPending || selectedCanvasMediaIds.length === 0}
                      onClick={() => generateCanvasFromMedia.mutate()}
                    >
                      {generateCanvasFromMedia.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Generate From Selected ({selectedCanvasMediaIds.length})
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-auto">
                    {canvasMediaAssets.length === 0 && <p className="text-xs text-slate-500">No source media uploaded yet.</p>}
                    {canvasMediaAssets.slice(0, 24).map((item) => {
                      const checked = selectedCanvasMediaIds.includes(item.id);
                      return (
                        <label key={`media-${item.id}`} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedCanvasMediaIds((prev) =>
                                  checked ? prev.filter((id) => id !== item.id) : [item.id, ...prev].slice(0, 25)
                                )
                              }
                            />
                            <div>
                              <p className="text-xs font-medium text-slate-900">{item.name}</p>
                              <p className="text-[11px] text-slate-500">{item.type} · {(Number(item.size || 0) / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button className="text-slate-500 hover:text-red-600" onClick={(e) => { e.preventDefault(); setCanvasBank((prev) => prev.filter((x) => x.id !== item.id)); setSelectedCanvasMediaIds((prev) => prev.filter((id) => id !== item.id)); }}><Trash2 className="w-3 h-3" /></button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-2">Content Bank ({canvasGeneratedAssets.length} generated / {canvasBank.length} total)</h4>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {canvasGeneratedAssets.length === 0 && <p className="text-xs text-slate-500">No generated content yet.</p>}
                    {canvasGeneratedAssets.slice(0, 20).map((item) => (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-900">{item.type} · {item.platform} · {item.tone}</p>
                          <button className="text-slate-500 hover:text-red-600" onClick={() => setCanvasBank((prev) => prev.filter((x) => x.id !== item.id))}><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.brief}</p>
                        {Array.isArray(item.source_media_names) && item.source_media_names.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1">Sources: {item.source_media_names.join(", ")}</p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-1">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {agent.id === "veritas" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Contract Intake and Review Queue</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("legal-library")}>Open Legal Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Legal asset title" value={veritasDraft.title} onChange={(e) => setVeritasDraft((p) => ({ ...p, title: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={veritasDraft.type} onChange={(e) => setVeritasDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="contract">Contract</option>
                    <option value="clause">Clause</option>
                    <option value="policy">Policy</option>
                    <option value="compliance_evidence">Compliance Evidence</option>
                    <option value="risk_register">Risk Register</option>
                    <option value="ip_portfolio">IP Portfolio</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveVeritasLibraryItem}>Save Legal Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={veritasDraft.tags} onChange={(e) => setVeritasDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[70px]" placeholder="Legal/compliance summary..." value={veritasDraft.summary} onChange={(e) => setVeritasDraft((p) => ({ ...p, summary: e.target.value }))} />
                <label className="border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer inline-block">
                  Upload contracts
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleVeritasContractUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {veritasContracts.length === 0 && <p className="text-xs text-slate-500">No contracts uploaded yet.</p>}
                  {veritasContracts.slice(0, 30).map((c) => (
                    <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{c.name}</p>
                        <div className="flex gap-1">
                          <Badge className={c.status === "reviewed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{c.status}</Badge>
                          <Badge className={c.risk === "high" ? "bg-red-100 text-red-700" : c.risk === "medium" ? "bg-amber-100 text-amber-700" : c.risk === "low" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{c.risk}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" className={`rounded-lg h-7 text-xs ${theme.button} text-white`} onClick={() => reviewVeritasContract(c.id)}>
                          Review Risk
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => setVeritasContracts((prev) => prev.filter((x) => x.id !== c.id))}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agent.id === "inspect" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Quality Automation Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("quality-library")}>Open Quality Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Quality asset name" value={inspectDraft.name} onChange={(e) => setInspectDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={inspectDraft.type} onChange={(e) => setInspectDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="test_case">Test Case</option>
                    <option value="test_suite">Test Suite</option>
                    <option value="test_result">Test Result</option>
                    <option value="defect">Defect</option>
                    <option value="quality_report">Quality Report</option>
                    <option value="policy_standard">Policy/Standard</option>
                    <option value="audit_trail">Audit Trail</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveInspectLibraryItem}>Save Quality Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={inspectDraft.tags} onChange={(e) => setInspectDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Quality issue or test summary..." value={inspectDraft.summary} onChange={(e) => setInspectDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "centsible" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Financial Reporting Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("documents")}>Open Documents</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Document name" value={centsibleDraft.name} onChange={(e) => setCentsibleDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={centsibleDraft.type} onChange={(e) => setCentsibleDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="report">Report</option>
                    <option value="budget">Budget</option>
                    <option value="forecast">Forecast</option>
                    <option value="board_deck">Board Deck</option>
                    <option value="template">Template</option>
                    <option value="tax_document">Tax Document</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveCentsibleDocumentItem}>Save Document</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={centsibleDraft.tags} onChange={(e) => setCentsibleDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Financial summary or notes..." value={centsibleDraft.summary} onChange={(e) => setCentsibleDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "sentinel" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Incident Caseboard</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("security-library")}>Open Security Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Incident/policy title" value={sentinelDraft.title} onChange={(e) => setSentinelDraft((p) => ({ ...p, title: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={sentinelDraft.type} onChange={(e) => setSentinelDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="incident_report">Incident Report</option>
                    <option value="policy">Policy</option>
                    <option value="playbook">Playbook</option>
                    <option value="compliance_evidence">Compliance Evidence</option>
                    <option value="risk_register">Risk Register</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveSentinelLibraryItem}>Save Security Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={sentinelDraft.tags} onChange={(e) => setSentinelDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[70px]" placeholder="Incident summary / security context..." value={sentinelDraft.summary} onChange={(e) => setSentinelDraft((p) => ({ ...p, summary: e.target.value }))} />
                <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={createSentinelCase}>
                  Create Incident Case
                </Button>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {sentinelCases.length === 0 && <p className="text-xs text-slate-500">No incidents logged yet.</p>}
                  {sentinelCases.slice(0, 30).map((ic) => (
                    <div key={ic.id} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{ic.title}</p>
                        <div className="flex gap-1">
                          <Badge className={ic.severity === "high" ? "bg-red-100 text-red-700" : ic.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>{ic.severity}</Badge>
                          <Badge className={ic.status === "resolved" ? "bg-emerald-100 text-emerald-700" : ic.status === "contained" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}>{ic.status}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => updateSentinelCaseStatus(ic.id, "triaged")}>Triage</Button>
                        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => updateSentinelCaseStatus(ic.id, "contained")}>Contain</Button>
                        <Button size="sm" className={`rounded-lg h-7 text-xs ${theme.button} text-white`} onClick={() => updateSentinelCaseStatus(ic.id, "resolved")}>Resolve</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agent.id === "merchant" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Catalog and Order Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("commerce-library")}>Open Commerce Library</Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={addMerchantSku}>Add SKU</Button>
                  <Button size="sm" className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white" onClick={addMerchantOrder}>Create Order</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Commerce asset name" value={merchantDraft.name} onChange={(e) => setMerchantDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={merchantDraft.type} onChange={(e) => setMerchantDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="product_catalog">Product Catalog</option>
                    <option value="inventory_record">Inventory Record</option>
                    <option value="pricing_rule">Pricing Rule</option>
                    <option value="promotion_template">Promotion Template</option>
                    <option value="order_archive">Order Archive</option>
                    <option value="supplier_profile">Supplier Profile</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveMerchantLibraryItem}>Save Commerce Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={merchantDraft.tags} onChange={(e) => setMerchantDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[70px]" placeholder="Commerce context summary..." value={merchantDraft.summary} onChange={(e) => setMerchantDraft((p) => ({ ...p, summary: e.target.value }))} />
                <div className="grid md:grid-cols-2 gap-2">
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Catalog ({merchantCatalog.length})</p>
                    <div className="space-y-2 max-h-52 overflow-auto">
                      {merchantCatalog.slice(0, 20).map((sku) => (
                        <div key={sku.id} className="border border-slate-200 rounded-md p-2">
                          <p className="text-xs text-slate-900">{sku.name}</p>
                          <p className="text-[11px] text-slate-500">${sku.price} · stock {sku.stock}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Orders ({merchantOrders.length})</p>
                    <div className="space-y-2 max-h-52 overflow-auto">
                      {merchantOrders.slice(0, 20).map((ord) => (
                        <div key={ord.id} className="border border-slate-200 rounded-md p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-slate-900">{ord.id}</p>
                            <Badge className={ord.status === "fulfilled" ? "bg-emerald-100 text-emerald-700" : ord.status === "shipped" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}>{ord.status}</Badge>
                          </div>
                          <p className="text-[11px] text-slate-500">{ord.customer} · ${ord.total}</p>
                          <div className="mt-1 flex gap-1">
                            <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => updateMerchantOrderStatus(ord.id, "shipped")}>Ship</Button>
                            <Button size="sm" className="rounded h-6 text-[10px] px-2 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => updateMerchantOrderStatus(ord.id, "fulfilled")}>Fulfill</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {agent.id === "pulse" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-700" />
                    <h3 className="text-sm font-semibold text-slate-900">People Operations Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("people-library")}>Open People Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="People asset name" value={pulseDraft.name} onChange={(e) => setPulseDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={pulseDraft.type} onChange={(e) => setPulseDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="employee_profile">Employee Profile</option>
                    <option value="candidate_profile">Candidate Profile</option>
                    <option value="job_description">Job Description</option>
                    <option value="training_material">Training Material</option>
                    <option value="performance_review">Performance Review</option>
                    <option value="culture_policy">Culture & Policy</option>
                    <option value="exit_interview">Exit Interview</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={savePulseLibraryItem}>Save People Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={pulseDraft.tags} onChange={(e) => setPulseDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="People operations summary..." value={pulseDraft.summary} onChange={(e) => setPulseDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "part" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-blue-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Partnership Operations Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("partnership-library")}>Open Partnership Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Partnership asset name" value={partDraft.name} onChange={(e) => setPartDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={partDraft.type} onChange={(e) => setPartDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="partner_profile">Partner Profile</option>
                    <option value="agreement_contract">Agreement/Contract</option>
                    <option value="co_marketing_campaign">Co-Marketing Campaign</option>
                    <option value="deal_registration">Deal Registration</option>
                    <option value="training_material">Training Material</option>
                    <option value="influencer_campaign">Influencer Campaign</option>
                    <option value="mdf_request">MDF Request</option>
                    <option value="ecosystem_map">Ecosystem Map</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={savePartLibraryItem}>Save Partnership Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={partDraft.tags} onChange={(e) => setPartDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Partnership context summary..." value={partDraft.summary} onChange={(e) => setPartDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "prospect" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Outreach Composer and Sequence Runner</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("assets")}>Open Sales Assets</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => saveProspectAsset("template")}>Save as Template</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => saveProspectAsset("battle_card")}>Create Battle Card</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:col-span-2" placeholder="Sequence name" value={prospectDraft.name} onChange={(e) => setProspectDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={prospectDraft.channel} onChange={(e) => setProspectDraft((p) => ({ ...p, channel: e.target.value }))}>
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="sms">SMS</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={runProspectSequence}>Run Sequence</Button>
                </div>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Write personalized outreach body and CTA..." value={prospectDraft.message} onChange={(e) => setProspectDraft((p) => ({ ...p, message: e.target.value }))} />
                <div className="space-y-2 max-h-56 overflow-auto">
                  {prospectSequences.length === 0 && <p className="text-xs text-slate-500">No sequence runs yet.</p>}
                  {prospectSequences.slice(0, 25).map((s) => (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{s.name}</p>
                        <Badge className={s.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>{s.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{s.channel} · {new Date(s.started_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agent.id === "support-sage" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Support Resolution + Knowledge Studio</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("knowledge-base")}>Open Knowledge Base</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setChatInput("Show me all open high-priority tickets and recommend actions.")}>Draft Ticket Brief</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:col-span-2" placeholder="Article title" value={supportKbDraft.title} onChange={(e) => setSupportKbDraft((p) => ({ ...p, title: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={supportKbDraft.category} onChange={(e) => setSupportKbDraft((p) => ({ ...p, category: e.target.value }))}>
                    <option value="billing">Billing</option>
                    <option value="account">Account</option>
                    <option value="technical">Technical</option>
                    <option value="shipping">Shipping</option>
                    <option value="other">Other</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={createSupportKbArticle}>Create KB Draft</Button>
                </div>
                <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs w-full" placeholder="tags (comma separated)" value={supportKbDraft.tags} onChange={(e) => setSupportKbDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Article content or troubleshooting flow..." value={supportKbDraft.content} onChange={(e) => setSupportKbDraft((p) => ({ ...p, content: e.target.value }))} />
                <div className="space-y-2 max-h-56 overflow-auto">
                  {supportKnowledgeBase.length === 0 && <p className="text-xs text-slate-500">No knowledge articles yet.</p>}
                  {supportKnowledgeBase.slice(0, 20).map((a) => (
                    <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{a.title}</p>
                        <Badge className={a.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{a.status || "draft"}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{a.category} · {new Date(a.updated_at || a.created_at).toLocaleString()}</p>
                      <div className="mt-1 flex gap-2">
                        <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => publishSupportKbArticle(a.id)}>Publish</Button>
                        <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setSupportKnowledgeBase((prev) => prev.filter((x) => x.id !== a.id))}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agent.id === "sage" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Strategic Modeling Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("strategy-library")}>Open Strategy Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Document title" value={sageDraft.title} onChange={(e) => setSageDraft((p) => ({ ...p, title: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={sageDraft.type} onChange={(e) => setSageDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="plan">Strategic Plan</option>
                    <option value="market_analysis">Market Analysis</option>
                    <option value="okr">OKR</option>
                    <option value="board_deck">Board Deck</option>
                    <option value="scenario">Scenario Model</option>
                    <option value="risk_register">Risk Register</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveSageLibraryItem}>Save to Library</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={sageDraft.tags} onChange={(e) => setSageDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Strategic summary, assumptions, and recommended actions..." value={sageDraft.summary} onChange={(e) => setSageDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "chronos" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Scheduling Policy Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("schedule-library")}>Open Schedule Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Template/policy name" value={chronosDraft.name} onChange={(e) => setChronosDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={chronosDraft.type} onChange={(e) => setChronosDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="template">Meeting Template</option>
                    <option value="policy">Scheduling Policy</option>
                    <option value="audit">Time Audit</option>
                    <option value="travel">Travel Itinerary</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveChronosLibraryItem}>Save Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={chronosDraft.tags} onChange={(e) => setChronosDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Agenda sections, rules, or audit findings..." value={chronosDraft.details} onChange={(e) => setChronosDraft((p) => ({ ...p, details: e.target.value }))} />
              </div>
            )}

            {agent.id === "atlas" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-orange-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Workflow Design Console</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("workflow-library")}>Open Workflow Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Workflow/template name" value={atlasDraft.name} onChange={(e) => setAtlasDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={atlasDraft.type} onChange={(e) => setAtlasDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="template">Process Template</option>
                    <option value="sop">SOP</option>
                    <option value="project_plan">Project Plan</option>
                    <option value="approval_flow">Approval Flow</option>
                    <option value="resource_model">Resource Model</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveAtlasLibraryItem}>Save Workflow Asset</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={atlasDraft.tags} onChange={(e) => setAtlasDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]" placeholder="Workflow scope, key steps, owners, dependencies..." value={atlasDraft.summary} onChange={(e) => setAtlasDraft((p) => ({ ...p, summary: e.target.value }))} />
              </div>
            )}

            {agent.id === "compass" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Website Link Scanner</h3>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => goTab("market-library")}>Open Market Library</Button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Profile/report name" value={compassDraft.name} onChange={(e) => setCompassDraft((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={compassDraft.type} onChange={(e) => setCompassDraft((p) => ({ ...p, type: e.target.value }))}>
                    <option value="competitor_profile">Competitor Profile</option>
                    <option value="market_report">Market Report</option>
                    <option value="trend_analysis">Trend Analysis</option>
                    <option value="battle_card">Battle Card</option>
                    <option value="regulatory_update">Regulatory Update</option>
                  </select>
                  <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveCompassLibraryItem}>Save Market Item</Button>
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="tags (comma separated)" value={compassDraft.tags} onChange={(e) => setCompassDraft((p) => ({ ...p, tags: e.target.value }))} />
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[70px]" placeholder="Market insight summary..." value={compassDraft.summary} onChange={(e) => setCompassDraft((p) => ({ ...p, summary: e.target.value }))} />
                <p className="text-xs text-slate-600">Paste one URL per line to scan pages for trend signals, sentiment, and risk cues.</p>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[90px]"
                  placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
                  value={linkScanInput}
                  onChange={(e) => setLinkScanInput(e.target.value)}
                />
                <Button
                  className={`rounded-lg ${theme.button} text-white`}
                  disabled={runCompassLinkScan.isPending}
                  onClick={() => {
                    const links = linkScanInput.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                    if (links.length) runCompassLinkScan.mutate(links);
                  }}
                >
                  {runCompassLinkScan.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}Scan Links
                </Button>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {linkScanResults.length === 0 && <p className="text-xs text-slate-500">No scans yet.</p>}
                  {linkScanResults.slice(0, 25).map((r) => (
                    <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900 truncate">{r.url}</p>
                        <div className="flex gap-1">
                          <Badge className={r.risk === "high" ? "bg-red-100 text-red-700" : r.risk === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>{r.risk}</Badge>
                          <Badge className="bg-slate-100 text-slate-700">{r.sentiment}</Badge>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{r.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Autonomy Matrix</h3>
                {!hasRemoteBackend() && <p className="text-xs text-amber-700 mb-2">Local mode: changes are visible locally; connect backend for persistent policy enforcement.</p>}
                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-2">
                  {AUTONOMY_LANES.map((k) => (
                    <div key={k} className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[10px] text-slate-500 mb-1">{k.replace(/_/g, " ")}</p>
                      <select
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        value={matrix[k] || "approve"}
                        onChange={(e) => applyMatrixChange({
                          lane: k,
                          reason: "manual_lane_update",
                          nextMatrix: { ...matrix, [k]: e.target.value },
                          fromTier: matrix[k] || "approve",
                          toTier: e.target.value,
                        })}
                      >
                        {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {tab === "integrations" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{agent.name} Integration Fabric</h3>
              <p className="text-xs text-slate-600">Role-specific APIs and connectors for {agent.name}. Configure and test from this tab.</p>
            </div>

            {(agent.id === "nexus" || agent.id === "canvas") && (
              <AgentProviderFabric
                agent={agent}
                theme={theme}
                aiProviderSettings={aiProviderSettingsQuery.data}
                aiProviderDraft={aiProviderDraft}
                setAiProviderDraft={setAiProviderDraft}
                saveAiProviderSettingsMutation={saveAiProviderSettingsMutation}
                testAiProviderMutation={testAiProviderMutation}
                aiProviderMessage={aiProviderMessage}
                updateAgentProviderOverride={updateAgentProviderOverride}
              />
            )}

            <AgentExecutionReadinessPanel
              agent={agent}
              connectors={connectorWizardQuery.data?.connectors || []}
              queueJobs={autonomyQueueJobs}
              runtime={autonomyRuntimeQuery.data}
            />

            {agent.id === "nexus" && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Connector Live Readiness Wizard</h3>
                  <Badge className={liveReadinessPct >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                    {liveReadinessPct}% live ready
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Configure and test required connectors to move deterministic actions from simulated to live mode.
                </p>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-3">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, liveReadinessPct))}%` }} />
                </div>
                <div className="grid lg:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-2 max-h-72 overflow-auto">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Connectors</p>
                    {connectorWizardRows.length === 0 && <p className="text-[11px] text-slate-500">No connector catalog found.</p>}
                    <div className="space-y-1">
                      {connectorWizardRows.map((row) => (
                        <button
                          type="button"
                          key={`wiz-conn-${row.key}`}
                          className={`w-full text-left rounded border px-2 py-1.5 ${
                            connectorWizardKey === row.key ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setConnectorWizardKey(row.key);
                            setConnectorWizardError("");
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-slate-900">{row.label}</p>
                            <Badge className={row.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                              {row.ready ? "ready" : "pending"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{row.key}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2 lg:col-span-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">
                        {selectedConnectorWizard ? `${selectedConnectorWizard.label} (${selectedConnectorWizard.key})` : "Select connector"}
                      </p>
                      {selectedConnectorWizard && (
                        <Badge className={selectedConnectorWizard.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {selectedConnectorWizard.ready ? "configured" : "needs setup"}
                        </Badge>
                      )}
                    </div>
                    {selectedConnectorTemplate && (
                      <p className="text-[11px] text-slate-600">
                        Template ready · required: {(selectedConnectorTemplate.required_fields || []).join(", ") || "none"}
                      </p>
                    )}
                    <div className="grid lg:grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-slate-600 mb-1">Connector config (JSON)</p>
                        <textarea
                          className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] min-h-[120px] font-mono"
                          value={connectorConfigText}
                          onChange={(e) => {
                            setConnectorConfigText(e.target.value);
                            if (connectorWizardError) setConnectorWizardError("");
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-600 mb-1">Secret refs (JSON)</p>
                        <textarea
                          className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] min-h-[120px] font-mono"
                          value={connectorSecretsText}
                          onChange={(e) => {
                            setConnectorSecretsText(e.target.value);
                            if (connectorWizardError) setConnectorWizardError("");
                          }}
                        />
                      </div>
                    </div>
                    {connectorWizardError && <p className="text-[11px] text-red-600">{connectorWizardError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className={`rounded-lg ${theme.button} text-white`}
                        disabled={!hasRemoteBackend() || autoConfigureConnectorsMutation.isPending || connectorTemplates.length === 0}
                        onClick={() => autoConfigureConnectorsMutation.mutate()}
                      >
                        {autoConfigureConnectorsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        Auto-configure All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={!selectedConnectorTemplate}
                        onClick={() => {
                          let current = {};
                          try {
                            current = connectorConfigText.trim() ? JSON.parse(connectorConfigText) : {};
                          } catch {
                            current = {};
                          }
                          const merged = { ...(selectedConnectorTemplate?.defaults || {}), ...(current || {}) };
                          setConnectorConfigText(JSON.stringify(merged, null, 2));
                          setConnectorWizardError("");
                        }}
                      >
                        <Wand2 className="w-3 h-3 mr-1" />
                        Autofill Template
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={!selectedConnectorTemplate}
                        onClick={() => {
                          const next = selectedConnectorTemplate?.defaults || {};
                          setConnectorConfigText(JSON.stringify(next, null, 2));
                          setConnectorWizardError("");
                        }}
                      >
                        <Settings2 className="w-3 h-3 mr-1" />
                        Reset to Template
                      </Button>
                      <Button
                        size="sm"
                        className={`rounded-lg ${theme.button} text-white`}
                        disabled={!hasRemoteBackend() || !selectedConnectorWizard || saveConnectorConfigMutation.isPending}
                        onClick={() => saveConnectorConfigMutation.mutate()}
                      >
                        {saveConnectorConfigMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                        Save Config
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={!hasRemoteBackend() || !selectedConnectorWizard || saveConnectorSecretsMutation.isPending}
                        onClick={() => saveConnectorSecretsMutation.mutate()}
                      >
                        {saveConnectorSecretsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                        Save Secret Refs
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={!hasRemoteBackend() || !selectedConnectorWizard || testConnectorWizardMutation.isPending}
                        onClick={() => testConnectorWizardMutation.mutate()}
                      >
                        {testConnectorWizardMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                        Test Connector
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={!hasRemoteBackend() || connectorWizardQuery.isFetching}
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ["connector_wizard_catalog"] });
                          queryClient.invalidateQueries({ queryKey: ["deterministic_audit"] });
                        }}
                      >
                        {connectorWizardQuery.isFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                        Refresh
                      </Button>
                    </div>
                    {connectorWizardBulkSummary && <p className="text-[11px] text-slate-600">{connectorWizardBulkSummary}</p>}
                    {deterministicSummary && (
                      <p className="text-[11px] text-slate-600">
                        Deterministic coverage: {deterministicSummary.deterministic_coverage_pct}% · Live readiness: {deterministicSummary.live_readiness_pct}% ({deterministicSummary.live_ready_actions}/{deterministicSummary.total_core_actions})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {opsActions.map((op) => (
                <div key={`ops-${op.action}`} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{op.label}</p>
                    <Badge className={riskBadgeClass(op.risk)}>{op.risk}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{op.action}</p>
                  <Button size="sm" className={`mt-3 rounded-lg ${theme.button} text-white`} disabled={runOpsAction.isPending} onClick={() => runOpsAction.mutate(op.action)}>
                    {runOpsAction.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}Execute
                  </Button>
                </div>
              ))}
            </div>
            {opsActions.length === 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Ops Actions</h3>
                <p className="text-xs text-slate-600 mb-3">No explicit ops actions are mapped. Run a baseline self test to initialize operations.</p>
                <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={() => selfTest.mutate()} disabled={selfTest.isPending}>
                  {selfTest.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}
                  Run Self Test
                </Button>
              </div>
            )}

            {roleModuleCards.length > 0 && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Role Ops Cockpit</h3>
                  <Badge className="bg-slate-100 text-slate-700">{roleModuleCards.length} modules</Badge>
                </div>
                <p className="text-xs text-slate-600 mb-3">Role-specific controls and telemetry modules for {agent.name}.</p>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {roleModuleCards.map((mod) => (
                    <div key={`role-ops-${mod.id}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{mod.title}</p>
                        <Badge className={mod.trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {mod.statusText}
                        </Badge>
                      </div>
                      <p className="text-xl font-semibold text-slate-900 mt-1">{mod.value}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`${theme.button.split(" ")[0]} h-full`} style={{ width: `${mod.spark}%` }} />
                      </div>
                      <Button
                        size="sm"
                        className={`mt-3 rounded-lg ${theme.button} text-white`}
                        disabled={runOpsAction.isPending}
                        onClick={() => runOpsAction.mutate(mod.action)}
                      >
                        {runOpsAction.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}
                        Run {mod.action.replace(/_/g, " ")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {advancedRunbooks.length > 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Advanced Runbooks (Integrated)</h3>
                <p className="text-xs text-slate-600 mb-3">These are integrated from legacy Ops Hub actions, now available in this unified UI.</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {advancedRunbooks.map((rb) => (
                    <div key={`rb-${rb.action}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{rb.label}</p>
                        <Badge className={riskBadgeClass(rb.risk)}>{rb.risk}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{rb.action}</p>
                      <Button size="sm" className={`mt-2 rounded-lg ${theme.button} text-white`} disabled={runOpsAction.isPending} onClick={() => runOpsAction.mutate(rb.action)}>
                        {runOpsAction.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}Run
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingApprovals.length > 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Approval Queue</h3>
                <div className="space-y-2">
                  {pendingApprovals.map((p) => (
                    <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-amber-900">{p.action}</p>
                        <Badge className="bg-amber-100 text-amber-800">{p.id}</Badge>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-1">{p.reason}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          className={`rounded-lg h-7 ${theme.button} text-white`}
                          disabled={approveAndRun.isPending}
                          onClick={() => approveAndRun.mutate(p)}
                        >
                          {approveAndRun.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                          Approve & Run
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg h-7"
                          disabled={approveAndRun.isPending}
                          onClick={() => setPendingApprovals((prev) => prev.filter((x) => x.id !== p.id))}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="app-soft p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Live Execution Console</h3>
                <Badge className="bg-slate-100 text-slate-700">{liveExecutionFeed.length} events</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">Watch tools, ops actions, and workflow runs as they execute.</p>
              <div className="space-y-2 max-h-56 overflow-auto mt-3">
                {liveExecutionFeed.length === 0 && <p className="text-xs text-slate-500">No execution events yet. Run a tool or action to see activity.</p>}
                {liveExecutionFeed.map((evt) => (
                  <div key={evt.id} className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{evt.label}</p>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-slate-100 text-slate-700">{evt.kind}</Badge>
                        <Badge className="bg-blue-100 text-blue-700">{evt.executionPath || "local"}</Badge>
                        <Badge className={evt.status === "failed" ? "bg-red-100 text-red-700" : evt.status === "pending_approval" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>{evt.status}</Badge>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(evt.at).toLocaleString()}</p>
                    {evt.summary && <p className="text-[11px] text-slate-600 mt-1">{evt.summary}</p>}
                  </div>
                ))}
              </div>
            </div>

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Deterministic Action Runner</h3>
                  <Badge className={hasRemoteBackend() ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>{hasRemoteBackend() ? "backend-deterministic" : "local-preview"}</Badge>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    value={deterministicAction}
                    onChange={(e) => setDeterministicAction(e.target.value)}
                  >
                    {["social_posting", "email_replies", "document_ingestion", "shop_operations"].map((a) => (
                      <option key={`det-${a}`} value={a}>{a}</option>
                    ))}
                  </select>
                  <Button
                    className={`rounded-lg ${theme.button} text-white md:col-span-2`}
                    disabled={!hasRemoteBackend() || runDeterministicMutation.isPending}
                    onClick={() => runDeterministicMutation.mutate()}
                  >
                    {runDeterministicMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Execute Deterministic Action
                  </Button>
                </div>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs min-h-[110px] mt-2"
                  value={deterministicParamsText}
                  onChange={(e) => setDeterministicParamsText(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 mt-1">Params must be valid JSON and follow the selected action contract.</p>
                {!hasRemoteBackend() && <p className="text-[11px] text-amber-700 mt-1">Connect backend APIs to execute deterministic actions.</p>}
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="app-soft p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Reliability Snapshot</h3>
                    <Badge className={reliability?.status === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                      {reliability?.status || "loading"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[10px] text-slate-500">SLO</p>
                      <p className="text-xs font-semibold text-slate-900">{reliability?.slo?.status || "--"}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[10px] text-slate-500">Failed Exec</p>
                      <p className="text-xs font-semibold text-slate-900">{reliability?.failed_executions_recent ?? "--"}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[10px] text-slate-500">Dead Letters</p>
                      <p className="text-xs font-semibold text-slate-900">{reliability?.dead_letters ?? "--"}</p>
                    </div>
                  </div>
                  {Array.isArray(reliability?.warnings) && reliability.warnings.length > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                      {reliability.warnings.map((w, i) => (
                        <p key={`warn-${i}`} className="text-[11px] text-amber-800">• {w}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="app-soft p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Deterministic Runs</h3>
                    <Badge className="bg-slate-100 text-slate-700">{deterministicRuns.length}</Badge>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-auto">
                    {deterministicRuns.length === 0 && <p className="text-xs text-slate-500">No deterministic runs yet.</p>}
                    {deterministicRuns.slice(0, 12).map((r) => (
                      <div key={`detrun-${r.id}`} className="bg-white border border-slate-200 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-900">{r.action}</p>
                          <Badge className={r.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{r.status}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">attempt {r.attempt}/{r.max_attempts} · {new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Dead-Letter Queue</h3>
                  <Badge className={deadLetters.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                    {deadLetters.length ? `${deadLetters.length} pending` : "clear"}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {deadLetters.length === 0 && <p className="text-xs text-slate-500">No dead letters. Execution queue is healthy.</p>}
                  {deadLetters.slice(0, 20).map((dlq) => (
                    <div key={`dlq-${dlq.id}`} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{dlq.action}</p>
                        <Button
                          size="sm"
                          className={`rounded-lg h-7 text-xs ${theme.button} text-white`}
                          disabled={!hasRemoteBackend() || replayDeadLetterMutation.isPending}
                          onClick={() => replayDeadLetterMutation.mutate(dlq.id)}
                        >
                          {replayDeadLetterMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                          Replay
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{dlq.reason}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(dlq.created_at).toLocaleString()} · {dlq.compensation?.strategy || "manual_review"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Release Gate</h3>
                  <Badge className={releaseGateResult?.gate?.pass ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                    {releaseGateResult?.gate?.decision || "not run"}
                  </Badge>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    value={releaseGateSuite}
                    onChange={(e) => setReleaseGateSuite(e.target.value)}
                  >
                    <option value="deterministic_contracts">deterministic_contracts</option>
                    <option value="agent_smoke_17">agent_smoke_17</option>
                    <option value="command_center_core">command_center_core</option>
                  </select>
                  <Button
                    className={`rounded-lg ${theme.button} text-white md:col-span-2`}
                    disabled={!hasRemoteBackend() || runReleaseGateMutation.isPending || releaseGateBlocked}
                    onClick={() => runReleaseGateMutation.mutate()}
                  >
                    {runReleaseGateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Run Release Gate
                  </Button>
                </div>
                {releaseGateResult?.gate && (
                  <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2">
                    <p className="text-xs text-slate-700">score: {releaseGateResult.gate.score} · fail: {releaseGateResult.gate.fail}</p>
                    <div className="mt-1">
                      {(releaseGateResult.gate.required_actions || []).map((step, idx) => (
                        <p key={`gate-step-${idx}`} className="text-[11px] text-slate-600">• {step}</p>
                      ))}
                    </div>
                  </div>
                )}
                {releaseGateBlocked && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    Release gate blocked: {needsImplementationSummary.blocked} need(s) have unresolved unblock checklist items.
                  </p>
                )}
                {!hasRemoteBackend() && <p className="text-[11px] text-amber-700 mt-2">Connect backend APIs to run release gate checks.</p>}
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Autonomy Escalation Guardrails</h3>
                  <Badge className={escalationGate.pass ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                    {escalationGate.pass ? "eligible" : "blocked"}
                  </Badge>
                </div>
                <div className="grid md:grid-cols-3 gap-2 mb-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">SLO Healthy</p>
                    <p className={`text-xs font-semibold ${escalationGate.sloHealthy ? "text-emerald-700" : "text-amber-700"}`}>{String(escalationGate.sloHealthy)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">Dead Letters Clear</p>
                    <p className={`text-xs font-semibold ${escalationGate.deadClear ? "text-emerald-700" : "text-amber-700"}`}>{String(escalationGate.deadClear)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">Release Gate Pass</p>
                    <p className={`text-xs font-semibold ${escalationGate.releasePass ? "text-emerald-700" : "text-amber-700"}`}>{String(escalationGate.releasePass)}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-2">
                  {AUTONOMY_LANES.map((k) => {
                    const current = matrix[k] || "approve";
                    const next = nextAutonomyTier(current);
                    const atMax = current === "auto-broad";
                    return (
                      <div key={`escalate-${k}`} className="bg-white border border-slate-200 rounded-lg p-2">
                        <p className="text-[10px] text-slate-500 mb-1">{k.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-900 mb-1">current: <span className="font-semibold">{current}</span></p>
                        <Button
                          size="sm"
                          className={`rounded h-7 text-[11px] px-2 ${theme.button} text-white`}
                          disabled={!hasRemoteBackend() || atMax || !escalationGate.pass || updateMatrix.isPending}
                          onClick={() => applyMatrixChange({
                            lane: k,
                            reason: "guardrail_promotion",
                            nextMatrix: { ...matrix, [k]: next },
                            fromTier: current,
                            toTier: next,
                          })}
                        >
                          {atMax ? "Max Tier" : `Promote ? ${next}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {!hasRemoteBackend() && <p className="text-[11px] text-amber-700 mt-2">Local mode: connect backend to apply escalation promotions.</p>}
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Promotion History & Rollback</h3>
                  <Badge className="bg-slate-100 text-slate-700">{autonomyHistoryRows.length} events</Badge>
                </div>
                <p className="text-xs text-slate-600 mb-3">Every autonomy change is tracked with before/after tiers. Roll back any entry in one click.</p>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {autonomyHistoryRows.length === 0 && <p className="text-xs text-slate-500">No autonomy changes recorded yet.</p>}
                  {autonomyHistoryRows.map((entry) => {
                    const lane = entry?.lane || "multiple";
                    const laneLabel = lane === "multiple" ? "multi-lane snapshot" : lane.replace(/_/g, " ");
                    const hasRollback = Boolean(entry?.previous_matrix);
                    const fromTier = entry?.from_tier || (lane !== "multiple" ? entry?.previous_matrix?.[lane] : "");
                    const toTier = entry?.to_tier || (lane !== "multiple" ? entry?.next_matrix?.[lane] : "");
                    return (
                      <div key={entry.id} className="bg-white border border-slate-200 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{laneLabel}</p>
                            <p className="text-[11px] text-slate-500">{new Date(entry.at || Date.now()).toLocaleString()} · {entry.reason || "matrix_update"}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded h-7 text-[11px] px-2"
                            disabled={!hasRemoteBackend() || !hasRollback || updateMatrix.isPending}
                            onClick={() => rollbackAutonomyChange(entry)}
                          >
                            Rollback
                          </Button>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          {lane === "multiple" ? (
                            <span className="text-slate-600">Snapshot change applied across multiple lanes.</span>
                          ) : (
                            <>
                              <Badge className="bg-slate-100 text-slate-700">{fromTier || "n/a"}</Badge>
                              <span className="text-slate-400">?</span>
                              <Badge className="bg-emerald-100 text-emerald-700">{toTier || "n/a"}</Badge>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!hasRemoteBackend() && <p className="text-[11px] text-amber-700 mt-2">Connect backend to enable rollback operations.</p>}
              </div>
            )}

            {(agent.id === "nexus" || agent.id === "atlas") && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Reliability Runbooks</h3>
                  <Badge className="bg-slate-100 text-slate-700">{(reliability?.warnings || []).length} warnings</Badge>
                </div>
                <div className="space-y-2">
                  {(reliability?.warnings || []).length === 0 && <p className="text-xs text-slate-500">No active warnings. Keep monitoring cadence.</p>}
                  {(reliability?.warnings || []).map((w, idx) => (
                    <div key={`rw-${idx}`} className="bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-xs text-slate-800">{w}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" onClick={() => goTab("integrations")}>
                          Open Integrations
                        </Button>
                        <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" disabled={!hasRemoteBackend() || runReleaseGateMutation.isPending || releaseGateBlocked} onClick={() => runReleaseGateMutation.mutate()}>
                          Re-run Release Gate
                        </Button>
                        <Button size="sm" variant="outline" className="rounded h-7 text-[11px] px-2" onClick={() => selfTest.mutate()} disabled={selfTest.isPending}>
                          Run Self Test
                        </Button>
                        <Button size="sm" className={`rounded h-7 text-[11px] px-2 ${theme.button} text-white`} onClick={() => replayAllDeadLettersMutation.mutate()} disabled={!hasRemoteBackend() || replayAllDeadLettersMutation.isPending || deadLetters.length === 0}>
                          {replayAllDeadLettersMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Replay Dead Letters
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {!hasRemoteBackend() && <p className="text-[11px] text-amber-700 mt-2">Connect backend APIs to run reliability remediations.</p>}
              </div>
            )}

            <div className="app-soft p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-900">Need Implementation Readiness</h3>
                <Badge className={needsImplementationSummary.blocked === 0 && needsImplementationSummary.total > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                  {needsImplementationSummary.buildReady}/{needsImplementationSummary.total} build-ready
                </Badge>
              </div>
              <div className="grid md:grid-cols-4 gap-2">
                <div className="bg-white border border-slate-200 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">Avg readiness</p>
                  <p className="text-sm font-semibold text-slate-900">{needsImplementationSummary.avgProgress}%</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">Open needs</p>
                  <p className="text-sm font-semibold text-slate-900">{needsSummary.open}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">Configured needs</p>
                  <p className="text-sm font-semibold text-slate-900">{needsImplementationSummary.complete}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">Blocked by checklist</p>
                  <p className="text-sm font-semibold text-slate-900">{needsImplementationSummary.blocked}</p>
                </div>
              </div>
            </div>

            <div className="app-soft p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-900">{agent.name} Needs Backlog</h3>
                <Badge className={needsSummary.open > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                  {needsSummary.done}/{needsSummary.total} complete
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mb-3">Track and execute all remaining implementation needs for this agent.</p>
              <div className="space-y-2 max-h-72 overflow-auto">
                {needCards.length === 0 && <p className="text-xs text-slate-500">No backlog items defined for this agent.</p>}
                {needCards.map(({ need, spec, config, readiness, checklistSpec, checklistState, checklistEvidence, checklistDone, checklistRequired, checklistReady }) => (
                  <div key={need.id} className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{need.title}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{need.area} · {need.severity} priority{need.updated_at ? ` · ${new Date(need.updated_at).toLocaleString()}` : ""}</p>
                      </div>
                      <Badge className={need.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{need.done ? "done" : "open"}</Badge>
                    </div>
                    {spec && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-700">{spec.description}</p>
                          <Badge className={readiness.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                            {readiness.filled}/{readiness.total} required
                          </Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 mt-2">
                          {spec.fields.map((field) => (
                            <div key={`${need.id}-${field.key}`} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                              {field.type === "select" ? (
                                <select
                                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] bg-white"
                                  value={config[field.key] ?? ""}
                                  onChange={(e) => updateNeedField(need.id, field.key, e.target.value)}
                                >
                                  <option value="">Select {field.label}</option>
                                  {(field.options || []).map((opt) => (
                                    <option key={`${need.id}-${field.key}-${opt}`} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : field.type === "checkbox" ? (
                                <label className="flex items-center gap-2 text-[11px] text-slate-700 border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(config[field.key])}
                                    onChange={(e) => updateNeedField(need.id, field.key, e.target.checked)}
                                  />
                                  {field.label}
                                </label>
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  min={field.min}
                                  max={field.max}
                                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] bg-white"
                                  placeholder={field.placeholder || field.label}
                                  value={config[field.key] ?? ""}
                                  onChange={(e) =>
                                    updateNeedField(
                                      need.id,
                                      field.key,
                                      field.type === "number" ? Number(e.target.value || 0) : e.target.value
                                    )
                                  }
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`${theme.button.split(" ")[0]} h-full`} style={{ width: `${Math.max(4, readiness.progress)}%` }} />
                        </div>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[11px] font-medium text-slate-800">Unblock Checklist</p>
                            <Badge className={checklistReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                              {checklistDone}/{checklistRequired} required
                            </Badge>
                          </div>
                          <div className="grid md:grid-cols-2 gap-1">
                            {checklistSpec.map((ck) => (
                              <div key={`${need.id}-ck-${ck.key}`} className="border border-slate-200 rounded px-2 py-1 bg-slate-50">
                                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(checklistState[ck.key])}
                                    onChange={(e) => toggleNeedChecklist(need.id, ck.key, e.target.checked)}
                                  />
                                  <span>{ck.label}{ck.required ? " *" : ""}</span>
                                </label>
                                {checklistState[ck.key] && checklistEvidence?.[ck.key] && (
                                  <div className="mt-1 space-y-1">
                                    <p className="text-[10px] text-slate-500">
                                                                                              by {checklistEvidence[ck.key].actor || "unknown"} · {new Date(checklistEvidence[ck.key].checked_at || Date.now()).toLocaleString()} · {checklistEvidence[ck.key].proof_link || "proof:none"}
                                    </p>
                                    <label className="inline-flex items-center gap-1 text-[10px] text-slate-600 border border-slate-300 rounded px-2 py-1 bg-white cursor-pointer">
                                      Attach Evidence
                                      <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) attachNeedChecklistEvidence(need.id, ck.key, file);
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                    {Array.isArray(checklistEvidence[ck.key].attachments) && checklistEvidence[ck.key].attachments.length > 0 && (
                                      <div className="space-y-0.5">
                                        {checklistEvidence[ck.key].attachments.slice(0, 3).map((att) => (
                                          <p key={att.id} className="text-[10px] text-slate-500">
                                                                                                        {att.name} · {(Number(att.size || 0) / 1024).toFixed(1)}KB · sha256:{String(att.sha256 || "").slice(0, 12)}...
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" className={`rounded h-7 text-[11px] px-2 ${theme.button} text-white`} onClick={() => toggleNeedDone(need.id, !need.done)}>
                        {need.done ? "Reopen" : "Mark Done"}
                      </Button>
                      {spec && (
                        <Button
                          size="sm"
                          className={`rounded h-7 text-[11px] px-2 ${theme.button} text-white`}
                          disabled={!readiness.complete || !checklistReady}
                          onClick={() => applyNeedBuild(need.id)}
                        >
                          Apply Need Build
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded h-7 text-[11px] px-2"
                        onClick={() => {
                          setQuickWorkflowName(`${agent.name}: ${need.title}`);
                          setQuickWorkflowTrigger("manual");
                          goTab("workflows");
                        }}
                      >
                        Build Workflow
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded h-7 text-[11px] px-2"
                        onClick={() => {
                          setChatInput(`Create an implementation plan for this ${agent.name} need: ${need.title}. Start by executing ${need.action}.`);
                          goTab("chat");
                        }}
                      >
                        Plan in Chat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {agent.id === "scribe" && (
              <div className="app-soft p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Scribe Document Pipeline</h3>
                </div>
                <p className="text-xs text-slate-600">Upload, index, and sync documents to cloud storage while keeping retrieval-ready metadata.</p>

                <div className="grid md:grid-cols-3 gap-2">
                  <label className="md:col-span-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer">
                    Upload document(s)
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleScribeUpload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={scribeCloudTarget} onChange={(e) => setScribeCloudTarget(e.target.value)}>
                    <option value="s3_docs">AWS S3</option>
                    <option value="gdrive_docs">Google Drive</option>
                    <option value="dropbox_docs">Dropbox</option>
                  </select>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-2">Stored Documents ({scribeDocs.length})</h4>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {scribeDocs.length === 0 && <p className="text-xs text-slate-500">No documents uploaded yet.</p>}
                    {scribeDocs.slice(0, 30).map((doc) => (
                      <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-slate-900">{doc.name}</p>
                            <p className="text-[11px] text-slate-500">
                                                                                           {(doc.size / 1024).toFixed(1)} KB · {doc.mime}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Badge className={doc.indexed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                              {doc.indexed ? "indexed" : "not indexed"}
                            </Badge>
                            <Badge className={doc.cloud === "synced" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                              {doc.cloud === "synced" ? "cloud synced" : "local only"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-7 text-xs"
                            disabled={indexScribeDoc.isPending}
                            onClick={() => indexScribeDoc.mutate(doc.id)}
                          >
                            Index
                          </Button>
                          <Button
                            size="sm"
                            className={`rounded-lg h-7 text-xs ${theme.button} text-white`}
                            disabled={syncScribeDoc.isPending}
                            onClick={() => syncScribeDoc.mutate({ docId: doc.id, target: scribeCloudTarget })}
                          >
                            Store to Cloud
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-7 text-xs"
                            onClick={() => setScribeDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                          >
                            Remove
                          </Button>
                        </div>
                        {doc.synced_at && <p className="text-[11px] text-slate-500 mt-1">Synced: {new Date(doc.synced_at).toLocaleString()}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="app-soft p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Ops Timeline</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {opsHistory.length === 0 && <p className="text-xs text-slate-500">No ops runs logged yet.</p>}
                {opsHistory.slice(0, 20).map((h) => (
                  <div key={h.id} className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{h.label}</p>
                      <Badge className={h.status === "failed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{h.status}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(h.at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1">{h.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <p className={`text-xs font-semibold ${theme.text}`}>{dashboardCopy.title}</p>
              <p className="text-sm text-slate-700 mt-1">{opsBrief.mission}</p>
              <p className="text-xs text-slate-500 mt-1">Focus: {live.current_focus || opsBrief.focus}</p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {telemetryCards.map((card) => (
                <div key={card.id} className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">{card.label}</p>
                    <div className={`text-[11px] font-semibold flex items-center gap-1 ${card.direction === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                      {card.direction === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {card.delta > 0 ? "+" : ""}{card.delta}%
                    </div>
                  </div>
                  <p className="text-xl font-semibold text-slate-900 mt-1">{card.valueRaw}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`${theme.button.split(" ")[0]} h-full`} style={{ width: `${Math.min(100, Math.max(8, card.value % 101))}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {roleModuleCards.length > 0 && (
              <div className="app-soft p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Role Systems</h3>
                  <Badge className="bg-slate-100 text-slate-700">{agent.role}</Badge>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {roleModuleCards.map((mod) => (
                    <div key={`role-dash-${mod.id}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{mod.title}</p>
                        <p className={`text-[11px] font-semibold ${mod.trend >= 0 ? "text-emerald-600" : "text-amber-700"}`}>
                          {mod.trend >= 0 ? "+" : ""}{mod.trend}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mt-1">{mod.value}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Action: {mod.action}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`${theme.button.split(" ")[0]} h-full`} style={{ width: `${mod.spark}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="app-soft p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-900">Analytics and Insights</h3>
                <Badge className="bg-slate-100 text-slate-700">{analyticsInsights.northStar}</Badge>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Execution Success</p>
                  <p className="text-lg font-semibold text-slate-900">{analyticsInsights.successRate}%</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Failed Runs (recent)</p>
                  <p className="text-lg font-semibold text-slate-900">{analyticsInsights.failures}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Integrations</p>
                  <p className="text-lg font-semibold text-slate-900">{analyticsInsights.connectedCount}/{analyticsInsights.totalIntegrations}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Active Workflows</p>
                  <p className="text-lg font-semibold text-slate-900">{analyticsInsights.activeWorkflows}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-900 mb-1">What to do next</p>
                <div className="space-y-1">
                  {analyticsInsights.recommendations.map((rec, idx) => (
                    <p key={`rec-${idx}`} className="text-xs text-blue-900">{idx + 1}. {rec}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <Cpu className="w-3.5 h-3.5" /> Neural Signal Bus
              </div>
              <div className="mt-2 grid md:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-slate-400">Inference Latency</p>
                  <p className="text-sm font-semibold">{120 + (agentSeed % 60)} ms</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-slate-400">Tool Throughput</p>
                  <p className="text-sm font-semibold">{10 + (telemetryCards.length * 3)} req/min</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-slate-400">Autonomy Confidence</p>
                  <p className="text-sm font-semibold">{78 + (agentSeed % 20)}%</p>
                </div>
              </div>
            </div>

            <div className="app-soft p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-900">Execution Results Board</h3>
                <Badge className="bg-slate-100 text-slate-700">{executionInsights.length} recent runs</Badge>
              </div>
              {!latestExecutionInsight && <p className="text-xs text-slate-500">Run a tool or ops action to populate execution outcomes.</p>}
              {latestExecutionInsight && (
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{latestExecutionInsight.insight.title}</p>
                    <div className="flex items-center gap-1">
                      <Badge className="bg-blue-100 text-blue-700">{latestExecutionInsight.executionPath || "local"}</Badge>
                      <Badge className={latestExecutionInsight.status === "failed" ? "bg-red-100 text-red-700" : latestExecutionInsight.status === "pending_approval" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                        {latestExecutionInsight.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">{latestExecutionInsight.insight.summary}</p>
                  <div className="mt-2 grid md:grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <p className="text-[11px] text-slate-500">KPI Impact</p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5">{latestExecutionInsight.insight.kpi || "No KPI returned"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <p className="text-[11px] text-slate-500">Recommendation</p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5">{latestExecutionInsight.insight.recommendation || "No recommendation returned"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <p className="text-[11px] text-slate-500">Executed At</p>
                      <p className="text-xs font-medium text-slate-900 mt-0.5">{new Date(latestExecutionInsight.at).toLocaleString()}</p>
                    </div>
                  </div>
                  {latestExecutionInsight.insight.nextActions.length > 0 && (
                    <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 p-2">
                      <p className="text-[11px] text-blue-700 font-semibold">Next Actions</p>
                      <div className="mt-1 space-y-1">
                        {latestExecutionInsight.insight.nextActions.map((step, idx) => (
                          <p key={`next-action-${idx}`} className="text-xs text-blue-900">• {step}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2 max-h-56 overflow-auto mt-3">
                {executionInsights.slice(0, 12).map((evt) => (
                  <div key={`insight-${evt.id}`} className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{evt.insight.title}</p>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-slate-100 text-slate-700">{evt.kind}</Badge>
                        <Badge className="bg-blue-100 text-blue-700">{evt.executionPath || "local"}</Badge>
                        <Badge className={evt.status === "failed" ? "bg-red-100 text-red-700" : evt.status === "pending_approval" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                          {evt.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">{evt.insight.summary}</p>
                    {(evt.insight.kpi || evt.insight.recommendation) && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {[evt.insight.kpi, evt.insight.recommendation].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(evt.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">{(AGENT_VISUAL_PROFILE[agent.id] || {}).lensA || "Advanced Lens A"}</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedAdvancedChart agentId={agent.id} data={advancedSeriesA} />
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">{(AGENT_VISUAL_PROFILE[agent.id] || {}).lensB || "Advanced Lens B"}</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    {["sentinel", "veritas", "centsible", "merchant", "canvas"].includes(agent.id) ? (
                      <PieChart>
                        <Pie data={advancedSeriesB} dataKey="value" nameKey="name" innerRadius={38} outerRadius={70} paddingAngle={2}>
                          {advancedSeriesB.map((_, i) => <Cell key={`pie-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    ) : (
                      <RadarChart outerRadius={72} data={capabilityRadarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis />
                        <Radar dataKey="score" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.5} />
                        <Tooltip />
                      </RadarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {dashboardLenses.length > 0 && (
              <div className="app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Legacy Lenses (Integrated)</h3>
                <div className="grid md:grid-cols-3 gap-2">
                  {dashboardLenses.map((lens) => (
                    <div key={`lens-${lens.action}`} className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-900">{lens.label}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{lens.action}</p>
                      <p className="text-lg font-semibold text-slate-900 mt-2">{generateMetricValue(lens.label, live, effectiveWorkflows)}</p>
                      <Button size="sm" className={`mt-2 rounded-lg ${theme.button} text-white`} disabled={runOpsAction.isPending} onClick={() => runOpsAction.mutate(lens.action)}>
                        {runOpsAction.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}Refresh
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="md:col-span-2 app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">Ops Velocity (7d)</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={opsTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="volume" stroke="#2563eb" fill="#bfdbfe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="md:col-span-2 app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">Execution Quality (7d)</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={opsTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="successRate" stroke="#16a34a" strokeWidth={2} />
                      <Line type="monotone" dataKey="failed" stroke="#dc2626" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">{dashboardCopy.snapshot}</p>
                <p className="text-lg font-semibold text-slate-900 mt-1 capitalize">{String(live.status || "idle").replace("_", " ")}</p>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Primary Metric</p>
                <p className="text-sm text-slate-900 mt-1">{live.key_metric || "--"}</p>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Active Workflows</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{effectiveWorkflows.filter((w) => w.status === "active").length}</p>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Business Alignment</p>
                <p className="text-sm text-slate-900 mt-1">{businessProfile?.company_name ? "Profile linked" : "Profile missing"}</p>
              </div>

              <div className="md:col-span-2 app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">Workflow Mix</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workflowMixData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="md:col-span-2 app-soft p-4">
                <p className="text-xs text-slate-500 mb-2">KPI Distribution</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpiChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {kpiLabels.map((label) => (
                <div key={label} className="app-soft p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{generateMetricValue(label, live, effectiveWorkflows)}</p>
                </div>
              ))}

              {agent.id === "canvas" && (
                <div className="md:col-span-2 xl:col-span-4 app-soft p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Canvas Content Bank</h3>
                  <div className="grid md:grid-cols-3 gap-2">
                    <div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Total Assets</p><p className="text-xl font-semibold text-slate-900">{canvasBank.length}</p></div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Source Media</p><p className="text-xl font-semibold text-slate-900">{canvasMediaAssets.length}</p></div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Generated</p><p className="text-xl font-semibold text-slate-900">{canvasGeneratedAssets.length}</p></div>
                  </div>
                </div>
              )}


              <div className="md:col-span-2 xl:col-span-4 app-soft p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Recent Ops Activity</h3>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {opsHistory.length === 0 && <p className="text-xs text-slate-500">No recent activity yet.</p>}
                  {opsHistory.slice(0, 8).map((h) => (
                    <div key={`dash-${h.id}`} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{h.label}</p>
                        <Badge className={h.status === "failed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{h.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(h.at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "workflows" && (
          <AgentWorkflowsTab
            agent={agent}
            theme={theme}
            dashboardCopy={dashboardCopy}
            quickWorkflowName={quickWorkflowName}
            setQuickWorkflowName={setQuickWorkflowName}
            quickWorkflowTrigger={quickWorkflowTrigger}
            setQuickWorkflowTrigger={setQuickWorkflowTrigger}
            createQuickWorkflow={createQuickWorkflow}
            createNeedsWorkpack={createNeedsWorkpack}
            needsSummary={needsSummary}
            visibleTemplates={visibleTemplates}
            importTemplate={importTemplate}
            effectiveWorkflows={effectiveWorkflows}
            setWorkflowStatus={setWorkflowStatus}
            workflowRuns={workflowRuns}
            autonomyQueueJobs={autonomyQueueJobs}
            autonomySchedules={autonomySchedules}
            queueActionMutation={queueActionMutation}
            saveScheduleMutation={saveScheduleMutation}
            tickAutonomyRuntimeMutation={tickAutonomyRuntimeMutation}
            scheduleDraft={scheduleDraft}
            setScheduleDraft={setScheduleDraft}
          />
        )}

        {tab === "content-bank" && agent.id === "canvas" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Canvas Content Bank</h3>
              <p className="text-xs text-slate-600">Upload source media, tag assets, generate derivatives, and share approved creative with Maestro.</p>
            </div>

            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <label className="md:col-span-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer">
                  Upload assets (images, videos, flyers)
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      handleCanvasMediaUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={canvasBankFilter} onChange={(e) => setCanvasBankFilter(e.target.value)}>
                  <option value="all">All Assets</option>
                  <option value="source">Source Media</option>
                  <option value="generated">Generated</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </select>
                <input
                  className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                  placeholder="Search by name, brief, tag..."
                  value={canvasBankQuery}
                  onChange={(e) => setCanvasBankQuery(e.target.value)}
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-semibold text-slate-900">Asset Library</h4>
                    <Badge className="bg-slate-100 text-slate-700">{filteredCanvasAssets.length} shown</Badge>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {filteredCanvasAssets.length === 0 && <p className="text-xs text-slate-500">No assets match your current filters.</p>}
                    {filteredCanvasAssets.slice(0, 80).map((item) => {
                      const selected = selectedCanvasMediaIds.includes(item.id);
                      return (
                        <label key={`bank-${item.id}`} className="border border-slate-200 rounded-md p-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                setSelectedCanvasMediaIds((prev) =>
                                  selected ? prev.filter((id) => id !== item.id) : [item.id, ...prev].slice(0, 50)
                                )
                              }
                            />
                            <div>
                              <p className="text-xs font-medium text-slate-900">{item.name || "untitled asset"}</p>
                          <p className="text-[11px] text-slate-500">{item.asset_kind === "source_media" ? "source" : "generated"} · {item.type || "asset"}</p>
                              {item.summary ? <p className="text-[11px] text-slate-500 line-clamp-2">{item.summary}</p> : null}
                            </div>
                          </div>
                          <button
                            className="text-slate-500 hover:text-red-600"
                            onClick={(e) => {
                              e.preventDefault();
                              setCanvasBank((prev) => prev.filter((x) => x.id !== item.id));
                              setSelectedCanvasMediaIds((prev) => prev.filter((id) => id !== item.id));
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">Derivative Studio</h4>
                  <select className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={canvasType} onChange={(e) => setCanvasType(e.target.value)}>
                    <option value="image">Image Variation</option>
                    <option value="reel">Reel</option>
                    <option value="carousel">Carousel</option>
                    <option value="script">Script</option>
                  </select>
                  <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="tone" value={canvasTone} onChange={(e) => setCanvasTone(e.target.value)} />
                  <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="platform" value={canvasPlatform} onChange={(e) => setCanvasPlatform(e.target.value)} />
                  <textarea className="w-full border border-slate-300 rounded px-2 py-1 text-xs min-h-[96px]" placeholder="creative brief..." value={canvasBrief} onChange={(e) => setCanvasBrief(e.target.value)} />
                  <Button
                    className={`w-full rounded-lg ${theme.button} text-white`}
                    disabled={generateCanvasFromMedia.isPending || selectedCanvasMediaIds.length === 0}
                    onClick={() => generateCanvasFromMedia.mutate()}
                  >
                    {generateCanvasFromMedia.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    Generate Derivatives ({selectedCanvasMediaIds.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-lg"
                    onClick={() => {
                      setChatInput("Share selected approved assets with Maestro for campaign execution.");
                      goTab("chat");
                    }}
                  >
                    Share with Maestro
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Total Assets</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{canvasBank.length}</p>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Source Media</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{canvasMediaAssets.length}</p>
              </div>
              <div className="app-soft p-4">
                <p className="text-xs text-slate-500">Generated Assets</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{canvasGeneratedAssets.length}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "knowledge-base" && agent.id === "support-sage" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Support Sage Knowledge Base</h3>
              <p className="text-xs text-slate-600">Central support library for FAQs, troubleshooting guides, and policy-aware response content.</p>
            </div>

            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search articles, tags, topics..." value={supportKbSearch} onChange={(e) => setSupportKbSearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={supportKbFilter} onChange={(e) => setSupportKbFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={createSupportKbArticle}>Create Article</Button>
              </div>
              <div className="grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-900">Article Repository</h4>
                    <Badge className="bg-slate-100 text-slate-700">{filteredSupportKb.length} items</Badge>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {filteredSupportKb.length === 0 && <p className="text-xs text-slate-500">No articles found for the current filter.</p>}
                    {filteredSupportKb.slice(0, 120).map((a) => (
                      <div key={a.id} className="border border-slate-200 rounded-md p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">{a.title}</p>
                          <Badge className={a.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{a.status || "draft"}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{a.category} · {new Date(a.updated_at || a.created_at).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => publishSupportKbArticle(a.id)}>Publish</Button>
                          <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share article '${a.title}' with Maestro and Prospect for cross-functional use.`); goTab("chat"); }}>Share Cross-Agent</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">Article Draft</h4>
                  <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Title" value={supportKbDraft.title} onChange={(e) => setSupportKbDraft((p) => ({ ...p, title: e.target.value }))} />
                  <select className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={supportKbDraft.category} onChange={(e) => setSupportKbDraft((p) => ({ ...p, category: e.target.value }))}>
                    <option value="billing">Billing</option>
                    <option value="account">Account</option>
                    <option value="technical">Technical</option>
                    <option value="shipping">Shipping</option>
                    <option value="other">Other</option>
                  </select>
                  <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Tags: refund, billing, duplicate" value={supportKbDraft.tags} onChange={(e) => setSupportKbDraft((p) => ({ ...p, tags: e.target.value }))} />
                  <textarea className="w-full border border-slate-300 rounded px-2 py-1 text-xs min-h-[110px]" placeholder="Content..." value={supportKbDraft.content} onChange={(e) => setSupportKbDraft((p) => ({ ...p, content: e.target.value }))} />
                  <Button className={`w-full rounded-lg ${theme.button} text-white`} onClick={createSupportKbArticle}>Save Draft</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "assets" && agent.id === "prospect" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Prospect Sales Assets</h3>
              <p className="text-xs text-slate-600">Central library for outreach templates, battle cards, collateral, and reusable sales assets.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search templates, battle cards, collateral..." value={prospectAssetSearch} onChange={(e) => setProspectAssetSearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={prospectAssetFilter} onChange={(e) => setProspectAssetFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="template">Templates</option>
                  <option value="battle_card">Battle Cards</option>
                  <option value="collateral">Collateral</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={() => saveProspectAsset("template")}>Save Current Draft</Button>
              </div>
              <div className="grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-900">Asset Repository</h4>
                    <Badge className="bg-slate-100 text-slate-700">{filteredProspectAssets.length} items</Badge>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {filteredProspectAssets.length === 0 && <p className="text-xs text-slate-500">No assets yet. Save a sequence draft as a template.</p>}
                    {filteredProspectAssets.slice(0, 120).map((a) => (
                      <div key={a.id} className="border border-slate-200 rounded-md p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">{a.name}</p>
                          <Badge className="bg-slate-100 text-slate-700">{a.type}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">used {a.usage_count || 0}x · {new Date(a.updated_at || a.created_at).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setProspectDraft((p) => ({ ...p, name: a.name, message: a.content })); goTab("tools"); }}>Use in Sequence</Button>
                          <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share asset '${a.name}' with Maestro for message alignment.`); goTab("chat"); }}>Share with Maestro</Button>
                          <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setProspectAssets((prev) => prev.filter((x) => x.id !== a.id))}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">Quick Create</h4>
                  <Button className="w-full rounded-lg" variant="outline" onClick={() => saveProspectAsset("template")}>Create Template</Button>
                  <Button className="w-full rounded-lg" variant="outline" onClick={() => saveProspectAsset("battle_card")}>Create Battle Card</Button>
                  <Button className="w-full rounded-lg" variant="outline" onClick={() => saveProspectAsset("collateral")}>Save Collateral Note</Button>
                  <p className="text-[11px] text-slate-500">Uses current sequence draft content from Tools as source material.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "strategy-library" && agent.id === "sage" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Sage Strategy Library</h3>
              <p className="text-xs text-slate-600">Repository for strategic plans, market analyses, scenarios, OKRs, and board materials.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search plans, reports, OKRs..." value={sageLibrarySearch} onChange={(e) => setSageLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={sageLibraryFilter} onChange={(e) => setSageLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="plan">Plans</option>
                  <option value="market_analysis">Market Analyses</option>
                  <option value="okr">OKRs</option>
                  <option value="board_deck">Board Decks</option>
                  <option value="scenario">Scenarios</option>
                  <option value="risk_register">Risk Registers</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveSageLibraryItem}>Save Strategy Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredSageLibrary.length === 0 && <p className="text-xs text-slate-500">No strategy documents yet.</p>}
                {filteredSageLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share strategic document '${item.title}' with Nexus, Maestro, and Centsible.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setSageLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "schedule-library" && agent.id === "chronos" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Chronos Schedule Library</h3>
              <p className="text-xs text-slate-600">Repository for meeting templates, scheduling policies, time audits, and productivity patterns.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search templates, policies, audits..." value={chronosLibrarySearch} onChange={(e) => setChronosLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={chronosLibraryFilter} onChange={(e) => setChronosLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="template">Templates</option>
                  <option value="policy">Policies</option>
                  <option value="audit">Time Audits</option>
                  <option value="travel">Travel</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveChronosLibraryItem}>Save Schedule Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredChronosLibrary.length === 0 && <p className="text-xs text-slate-500">No schedule assets yet.</p>}
                {filteredChronosLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()} · used {item.usage_count || 0}x</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.details}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Apply schedule asset '${item.name}' and share implications with Atlas and Pulse.`); goTab("chat"); }}>Use/Share</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setChronosLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "workflow-library" && agent.id === "atlas" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Atlas Workflow Library</h3>
              <p className="text-xs text-slate-600">Repository for process templates, SOPs, project plans, approval flows, and resource models.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search workflows, SOPs, project plans..." value={atlasLibrarySearch} onChange={(e) => setAtlasLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={atlasLibraryFilter} onChange={(e) => setAtlasLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="template">Process Templates</option>
                  <option value="sop">SOPs</option>
                  <option value="project_plan">Project Plans</option>
                  <option value="approval_flow">Approval Flows</option>
                  <option value="resource_model">Resource Models</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveAtlasLibraryItem}>Save Workflow Asset</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredAtlasLibrary.length === 0 && <p className="text-xs text-slate-500">No workflow assets yet.</p>}
                {filteredAtlasLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()} · used {item.usage_count || 0}x</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Execute workflow asset '${item.name}' and coordinate with Nexus + Pulse.`); goTab("chat"); }}>Run/Share</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setAtlasLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "knowledge-library" && agent.id === "scribe" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Scribe Knowledge Library</h3>
              <p className="text-xs text-slate-600">Repository for documents, articles, SOPs, decisions, meeting notes, and templates.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search docs, SOPs, decisions..." value={scribeLibrarySearch} onChange={(e) => setScribeLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={scribeLibraryFilter} onChange={(e) => setScribeLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="document">Documents</option>
                  <option value="article">Articles</option>
                  <option value="sop">SOPs</option>
                  <option value="decision">Decisions</option>
                  <option value="meeting_note">Meeting Notes</option>
                  <option value="template">Templates</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveScribeLibraryItem}>Save Knowledge Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredScribeLibrary.length === 0 && <p className="text-xs text-slate-500">No knowledge assets yet.</p>}
                {filteredScribeLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share knowledge item '${item.name}' with Maestro, Atlas, and Veritas.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setScribeLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "security-library" && agent.id === "sentinel" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Sentinel Security Library</h3>
              <p className="text-xs text-slate-600">Repository for incident reports, threat intel, policies, playbooks, and compliance evidence.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search incidents, policies, playbooks..." value={sentinelLibrarySearch} onChange={(e) => setSentinelLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={sentinelLibraryFilter} onChange={(e) => setSentinelLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="incident_report">Incident Reports</option>
                  <option value="policy">Policies</option>
                  <option value="playbook">Playbooks</option>
                  <option value="compliance_evidence">Compliance Evidence</option>
                  <option value="risk_register">Risk Register</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveSentinelLibraryItem}>Save Security Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredSentinelLibrary.length === 0 && <p className="text-xs text-slate-500">No security assets yet.</p>}
                {filteredSentinelLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share security item '${item.title}' with Veritas and Scribe.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setSentinelLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "market-library" && agent.id === "compass" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Compass Market Library</h3>
              <p className="text-xs text-slate-600">Repository for competitor profiles, market reports, trend analyses, battle cards, and regulatory updates.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search competitor profiles, reports, trends..." value={compassLibrarySearch} onChange={(e) => setCompassLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={compassLibraryFilter} onChange={(e) => setCompassLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="competitor_profile">Competitor Profiles</option>
                  <option value="market_report">Market Reports</option>
                  <option value="trend_analysis">Trend Analyses</option>
                  <option value="battle_card">Battle Cards</option>
                  <option value="regulatory_update">Regulatory Updates</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveCompassLibraryItem}>Save Market Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredCompassLibrary.length === 0 && <p className="text-xs text-slate-500">No market assets yet.</p>}
                {filteredCompassLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share market item '${item.name}' with Maestro, Prospect, and Sage.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setCompassLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "people-library" && agent.id === "pulse" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Pulse People Library</h3>
              <p className="text-xs text-slate-600">Repository for employee profiles, candidates, job descriptions, reviews, training, and culture documents.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search profiles, reviews, policies..." value={pulseLibrarySearch} onChange={(e) => setPulseLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={pulseLibraryFilter} onChange={(e) => setPulseLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="employee_profile">Employee Profiles</option>
                  <option value="candidate_profile">Candidate Profiles</option>
                  <option value="job_description">Job Descriptions</option>
                  <option value="training_material">Training Materials</option>
                  <option value="performance_review">Performance Reviews</option>
                  <option value="culture_policy">Culture & Policy</option>
                  <option value="exit_interview">Exit Interviews</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={savePulseLibraryItem}>Save People Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredPulseLibrary.length === 0 && <p className="text-xs text-slate-500">No people assets yet.</p>}
                {filteredPulseLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share people item '${item.name}' with Sage and Atlas for planning alignment.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setPulseLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "partnership-library" && agent.id === "part" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Part Partnership Library</h3>
              <p className="text-xs text-slate-600">Repository for partner profiles, agreements, campaigns, deal registrations, and ecosystem assets.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search partners, agreements, campaigns..." value={partLibrarySearch} onChange={(e) => setPartLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={partLibraryFilter} onChange={(e) => setPartLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="partner_profile">Partner Profiles</option>
                  <option value="agreement_contract">Agreements & Contracts</option>
                  <option value="co_marketing_campaign">Co-Marketing Campaigns</option>
                  <option value="deal_registration">Deal Registrations</option>
                  <option value="training_material">Training Materials</option>
                  <option value="influencer_campaign">Influencer Campaigns</option>
                  <option value="mdf_request">MDF Requests</option>
                  <option value="ecosystem_map">Ecosystem Maps</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={savePartLibraryItem}>Save Partnership Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredPartLibrary.length === 0 && <p className="text-xs text-slate-500">No partnership assets yet.</p>}
                {filteredPartLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share partnership item '${item.name}' with Prospect, Maestro, and Compass.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setPartLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "commerce-library" && agent.id === "merchant" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Merchant Commerce Library</h3>
              <p className="text-xs text-slate-600">Repository for product catalog records, inventory snapshots, pricing rules, promotions, orders, and suppliers.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search products, promotions, pricing rules..." value={merchantLibrarySearch} onChange={(e) => setMerchantLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={merchantLibraryFilter} onChange={(e) => setMerchantLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="product_catalog">Product Catalog</option>
                  <option value="inventory_record">Inventory Records</option>
                  <option value="pricing_rule">Pricing Rules</option>
                  <option value="promotion_template">Promotion Templates</option>
                  <option value="order_archive">Order Archives</option>
                  <option value="supplier_profile">Supplier Profiles</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveMerchantLibraryItem}>Save Commerce Item</Button>
              </div>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredMerchantLibrary.length === 0 && <p className="text-xs text-slate-500">No commerce assets yet.</p>}
                {filteredMerchantLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share commerce item '${item.name}' with Maestro, Atlas, and Compass.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setMerchantLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "quality-library" && agent.id === "inspect" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Inspect Quality Library</h3>
              <p className="text-xs text-slate-600">Repository for test cases, suites, results, defects, quality reports, and quality policies.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search test cases, defects, reports..." value={inspectLibrarySearch} onChange={(e) => setInspectLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={inspectLibraryFilter} onChange={(e) => setInspectLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="test_case">Test Cases</option>
                  <option value="test_suite">Test Suites</option>
                  <option value="test_result">Test Results</option>
                  <option value="defect">Defects</option>
                  <option value="quality_report">Quality Reports</option>
                  <option value="policy_standard">Policies & Standards</option>
                  <option value="audit_trail">Audit Trails</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveInspectLibraryItem}>Save Quality Item</Button>
              </div>
              <label className="inline-flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer w-fit">
                Upload QA Asset
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleInspectLibraryUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredInspectLibrary.length === 0 && <p className="text-xs text-slate-500">No quality assets yet.</p>}
                {filteredInspectLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share quality item '${item.name}' with Atlas, Merchant, and Sage.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setInspectLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "legal-library" && agent.id === "veritas" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Veritas Legal Library</h3>
              <p className="text-xs text-slate-600">Repository for contracts, clauses, policies, compliance evidence, risk registers, and legal research.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search contracts, clauses, policies..." value={veritasLibrarySearch} onChange={(e) => setVeritasLibrarySearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={veritasLibraryFilter} onChange={(e) => setVeritasLibraryFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="contract">Contracts</option>
                  <option value="clause">Clauses</option>
                  <option value="policy">Policies</option>
                  <option value="compliance_evidence">Compliance Evidence</option>
                  <option value="risk_register">Risk Register</option>
                  <option value="ip_portfolio">IP Portfolio</option>
                  <option value="litigation_file">Litigation Files</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveVeritasLibraryItem}>Save Legal Item</Button>
              </div>
              <label className="inline-flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer w-fit">
                Upload Legal Document
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleVeritasLibraryUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredVeritasLibrary.length === 0 && <p className="text-xs text-slate-500">No legal assets yet.</p>}
                {filteredVeritasLibrary.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share legal item '${item.title}' with Part, Pulse, and Centsible.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setVeritasLibrary((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "documents" && agent.id === "centsible" && (
          <div className="pt-6 space-y-4">
            <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Centsible Documents</h3>
              <p className="text-xs text-slate-600">Repository for reports, budgets, forecasts, board decks, and financial templates.</p>
            </div>
            <div className="app-soft p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <input className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" placeholder="Search reports, budgets, forecasts..." value={centsibleDocumentsSearch} onChange={(e) => setCentsibleDocumentsSearch(e.target.value)} />
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={centsibleDocumentsFilter} onChange={(e) => setCentsibleDocumentsFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="report">Reports</option>
                  <option value="budget">Budgets</option>
                  <option value="forecast">Forecasts</option>
                  <option value="board_deck">Board Decks</option>
                  <option value="template">Templates</option>
                  <option value="tax_document">Tax Documents</option>
                </select>
                <Button className={`rounded-lg ${theme.button} text-white`} onClick={saveCentsibleDocumentItem}>Save Document</Button>
              </div>
              <label className="inline-flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white cursor-pointer w-fit">
                Upload Financial Document
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleCentsibleDocumentUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {filteredCentsibleDocuments.length === 0 && <p className="text-xs text-slate-500">No financial documents yet.</p>}
                {filteredCentsibleDocuments.slice(0, 150).map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <Badge className="bg-slate-100 text-slate-700">{item.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => { setChatInput(`Share financial document '${item.name}' with Sage, Prospect, and Maestro.`); goTab("chat"); }}>Share Cross-Agent</Button>
                      <Button size="sm" variant="outline" className="rounded h-6 text-[10px] px-2" onClick={() => setCentsibleDocuments((prev) => prev.filter((x) => x.id !== item.id))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "functions" && (
          <div className="pt-6 space-y-3">
            {capabilities.map((fn) => (
              <div key={fn.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{fn.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{fn.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => { setChatInput(`Run ${fn.label}`); goTab("chat"); }}>Try in Chat</Button>
                    <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={() => runTool.mutate(fn.id)} disabled={runTool.isPending}>Run</Button>
                  </div>
                </div>
              </div>
            ))}

            {lastResult && (
              <div className="app-soft p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Latest Function Output</h4>
                {(() => {
                  const v = summarizeLatestResult(lastResult);
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{v.title}</p>
                        <Badge className={v.status === "failed" ? "bg-red-100 text-red-700" : v.status === "pending_approval" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                          {v.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-700 mt-1">{v.summary}</p>
                      {v.details.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {v.details.map((d, idx) => (
                            <p key={`latest-detail-${idx}`} className="text-[11px] text-slate-500">• {d}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="app-soft p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent Function Outputs</h4>
              <div className="space-y-2 max-h-56 overflow-auto">
                {functionOutputs.length === 0 && <p className="text-xs text-slate-500">No function outputs recorded yet.</p>}
                {functionOutputs.slice(0, 20).map((o) => (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{o.kind || "action"} · {o.action || "run"}</p>
                      <Badge className={o.status === "failed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{o.status || "success"}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(o.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}













































