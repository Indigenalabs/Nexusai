import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone, Send, Sparkles, RefreshCw, Target, Mail,
  TrendingUp, BarChart3, DollarSign, Zap, Loader2,
  CheckCircle2, Clock, PauseCircle, PlayCircle, Users
} from "lucide-react";
import AutopilotControls from "@/components/maestro/AutopilotControls";
import AgentPanel from "@/components/agents/AgentPanel";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STATUS_CONFIG = {
  draft: { color: "text-slate-400", bg: "bg-slate-500/15", border: "border-slate-500/20", icon: Clock },
  active: { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/20", icon: PlayCircle },
  paused: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/20", icon: PauseCircle },
  completed: { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/20", icon: CheckCircle2 },
  cancelled: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/20", icon: CheckCircle2 },
};

const QUICK_COMMANDS = [
  { label: "Full marketing briefing", cmd: "Run my full autonomous marketing briefing. Give me marketing health score, active campaign status, channel performance rankings, lead pipeline health, top opportunities, risks, and this week's priority actions.", icon: Target },
  { label: "Launch campaign", cmd: "Plan a complete multi-channel campaign. Ask me: what's the goal, target audience, budget, and duration — then build the full strategy including email sequence, social posts, paid ad strategy, landing page copy, timeline, and KPIs.", icon: Megaphone },
  { label: "Competitor analysis", cmd: "Deep competitive intelligence scan. Who are my top competitors? What channels are they using, what's their messaging, where are they weak, and what gaps can I exploit immediately? Search the web for current data.", icon: BarChart3 },
  { label: "Trend forecast", cmd: "Forecast emerging marketing trends for my industry right now. What hashtags, content formats, and campaign angles are gaining momentum? Give me 3 campaign ideas I can launch this week.", icon: TrendingUp },
  { label: "Audience segments", cmd: "Build detailed audience segments and buyer personas for my business. Give me 4-6 segments with demographics, psychographics, pain points, preferred channels, and a messaging matrix for each.", icon: Users },
  { label: "Budget allocation", cmd: "Optimize my marketing budget allocation. Based on my business objectives, recommend the optimal channel split with projected ROI, expected leads, and a phased scaling plan.", icon: DollarSign },
  { label: "Generate copy", cmd: "Generate high-converting marketing copy for me. Ask me: what type (ad, email, landing page, social), product/service, audience, tone, and how many variations — then produce ready-to-use copy with A/B test rationale.", icon: Sparkles },
  { label: "Social content suite", cmd: "Create a full social content suite. Ask me the topic and I'll produce 5 platform-native posts each for Instagram, TikTok, LinkedIn, Facebook, and Twitter — with captions, hashtags, visual briefs, and optimal posting times.", icon: Mail },
  { label: "Social trend scan", cmd: "Run a cross-platform trend scan for Instagram, TikTok, YouTube Shorts, LinkedIn, and X. Return top 10 trend signals, urgency windows, and the best content angle for our brand.", icon: TrendingUp },
  { label: "Video reel concepts", cmd: "Generate 10 short-form video concepts with hooks, shot list, script beats, captions, and CTA variants for Reels/TikTok/Shorts.", icon: Sparkles },
  { label: "Community response playbook", cmd: "Build a social community management playbook for comments and DMs: auto-response templates, escalation rules, sentiment tiers, and crisis triggers.", icon: Users },
  { label: "Social ROI dashboard", cmd: "Create a cross-platform social analytics and attribution briefing showing reach, engagement, traffic, conversion contribution, and ROI by platform.", icon: BarChart3 },
  { label: "Email lifecycle", cmd: "Design a complete email lifecycle automation system: welcome series, lead nurture, trial-to-paid conversion, onboarding, re-engagement, upsell, churn prevention, and referral sequences — with triggers, timing, and message copy.", icon: Zap },
  { label: "Paid ads strategy", cmd: "Build a complete paid advertising strategy. Ask me which platforms, budget, and product — then deliver campaign structure, audience targeting, ad copy variations, creative brief, bidding strategy, A/B tests, and projected performance.", icon: Target },
  { label: "SEO strategy", cmd: "Build a 12-month SEO and content marketing strategy. Give me keyword clusters, content calendar, quick win keywords, link building tactics, and technical SEO priorities to dominate search.", icon: BarChart3 },
  { label: "Influencer strategy", cmd: "Design a full influencer marketing strategy. Include tier recommendations (nano/micro/macro), ideal influencer profile, outreach DM and email templates, content brief template, and KPIs.", icon: TrendingUp },
  { label: "Optimize ROAS", cmd: "Analyze all my campaigns and optimize for maximum ROAS. What should I pause, scale, and A/B test? Where should I reallocate budget? Give me quick wins to implement today.", icon: DollarSign },
  { label: "CRO analysis", cmd: "Run a conversion rate optimization audit. Give me the top 10 conversion killers to fix, a prioritized A/B test roadmap, social proof strategy, and projected CVR improvement.", icon: Sparkles },
  { label: "Customer journey", cmd: "Map my complete customer journey from awareness to advocacy. For each stage: customer emotion, key message, channel mix, content type, automation trigger, and success metric.", icon: Users },
  { label: "Compliance check", cmd: "Check my marketing content for compliance. Share your copy and I'll review it against GDPR, Privacy Act, SPAM Act, ACCC/FTC rules, and brand safety standards — then give you the approved version.", icon: Megaphone },
  { label: "Brand voice", cmd: "Define my brand voice and tone guidelines. Give me voice attributes, vocabulary guide (use/avoid), platform-specific tone adjustments, 10 examples, and a content scoring checklist.", icon: Mail },
  { label: "Attribution model", cmd: "Build a cross-channel attribution model. Analyse my channel mix, recommend the right attribution model, map top conversion paths, reveal true ROI per channel, and tell me how this should change my spend.", icon: BarChart3 },
  { label: "Marketing mix model", cmd: "Run a marketing mix modelling analysis. What's the optimal channel weighting for maximum revenue? Show me diminishing returns, synergy effects, seasonal allocation, and scenario planning (conservative / base / aggressive).", icon: TrendingUp },
  { label: "Repurpose content", cmd: "Repurpose my content across all formats. Share a blog post, video script, or any content — I'll transform it into LinkedIn post, Twitter thread, Instagram caption, email intro, TikTok script, YouTube description, and SMS.", icon: Sparkles },
];

const IMPACT_BADGE = {
  high: "bg-rose-500/15 border-rose-500/30 text-rose-300",
  medium: "bg-amber-500/15 border-amber-500/30 text-amber-300",
  low: "bg-sky-500/15 border-sky-500/30 text-sky-300",
};

const summarizeCapabilityResult = (runResult) => {
  if (!runResult) return "Capability executed.";
  if (typeof runResult === "string") return runResult.slice(0, 220);
  if (runResult.summary) return String(runResult.summary).slice(0, 220);
  if (runResult.message) return String(runResult.message).slice(0, 220);
  if (runResult.insights && Array.isArray(runResult.insights) && runResult.insights[0]) {
    return String(runResult.insights[0]).slice(0, 220);
  }
  const keys = Object.keys(runResult);
  return keys.length ? `Updated: ${keys.slice(0, 4).join(", ")}` : "Capability executed.";
};
function CampaignCard({ campaign }) {
  const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white leading-tight">{campaign.name}</p>
        <div className={`flex items-center gap-1 flex-shrink-0 ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          <span className="text-[10px] font-semibold uppercase">{campaign.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{campaign.objective}</Badge>
        {campaign.budget && (
          <span className="text-[10px] text-slate-500">${campaign.budget?.toLocaleString()} budget</span>
        )}
      </div>
      {campaign.channels?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {campaign.channels.slice(0, 4).map(ch => (
            <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-300">{ch}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-pink-500/30 border border-violet-500/20 flex items-center justify-center mt-1">
          <Megaphone className="w-3.5 h-3.5 text-violet-300" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-slate-700/80 text-white" : "bg-white/[0.04] border border-white/[0.08] text-slate-200"}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span className="text-xs text-violet-400 font-semibold tracking-wide">MAESTRO</span>
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed text-slate-200">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-slate-300">{children}</li>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              h1: ({ children }) => <h1 className="text-base font-bold text-white my-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold text-white my-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-violet-300 my-1">{children}</h3>,
              code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-pink-300">{children}</code>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
}

export default function Maestro() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [capabilitySearch, setCapabilitySearch] = useState("");
  const [runningCapabilityId, setRunningCapabilityId] = useState("");
  const [capabilityRuns, setCapabilityRuns] = useState({});
  const [runtimeDrafts, setRuntimeDrafts] = useState({});
  const [expandedCapabilityId, setExpandedCapabilityId] = useState("");
  const [isRunningSweep, setIsRunningSweep] = useState(false);
  const [sweepLabel, setSweepLabel] = useState("");
  const [conversation, setConversation] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list("-created_date", 20),
    refetchInterval: 8000,
  });

  const { data: maestroBlueprint, isLoading: isBlueprintLoading, refetch: refetchBlueprint } = useQuery({
    queryKey: ["maestro_capability_blueprint"],
    queryFn: async () => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "get_agent_blueprint",
        params: { agent_name: "Maestro" },
      });
      return res.data || { categories: [] };
    },
    staleTime: 120000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: {
          agent_name: "Maestro",
          capability_id: capabilityId,
          runtime_params: runtimeParams,
        },
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      const outcome = data?.status === "success" ? "success" : "error";
      const summary = outcome === "success"
        ? summarizeCapabilityResult(data?.run_result || {})
        : (data?.run_error || "Capability failed");

      setCapabilityRuns((prev) => ({
        ...prev,
        [variables.capabilityId]: {
          status: outcome,
          summary,
          at: new Date().toISOString(),
        },
      }));

      setMessages((prev) => ([
        ...prev,
        {
          id: `capability-${variables.capabilityId}-${Date.now()}`,
          role: "assistant",
          content: outcome === "success"
            ? `**Capability Complete:** ${data?.capability?.label || variables.capabilityId}\n\n${summary}`
            : `**Capability Failed:** ${data?.capability?.label || variables.capabilityId}\n\n${summary}`,
        },
      ]));

      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error, variables) => {
      setCapabilityRuns((prev) => ({
        ...prev,
        [variables.capabilityId]: {
          status: "error",
          summary: error?.message || "Capability failed",
          at: new Date().toISOString(),
        },
      }));
    },
    onSettled: () => {
      setRunningCapabilityId("");
    },
  });

  const blueprintCategories = useMemo(() => maestroBlueprint?.categories || [], [maestroBlueprint]);
  const categoryList = useMemo(() => ["All", ...blueprintCategories.map((c) => c.category)], [blueprintCategories]);

  const visibleCapabilities = useMemo(() => {
    const allCapabilities = blueprintCategories.flatMap((c) => (c.capabilities || []).map((cap) => ({ ...cap, category: c.category })));
    const byCategory = selectedCategory === "All"
      ? allCapabilities
      : allCapabilities.filter((cap) => cap.category === selectedCategory);

    const q = capabilitySearch.trim().toLowerCase();
    if (!q) return byCategory;

    return byCategory.filter((cap) => (
      String(cap.label || "").toLowerCase().includes(q)
      || String(cap.description || "").toLowerCase().includes(q)
      || String(cap.category || "").toLowerCase().includes(q)
    ));
  }, [blueprintCategories, selectedCategory, capabilitySearch]);

  const categoryCapabilityMap = useMemo(
    () => blueprintCategories.reduce((acc, category) => {
      acc[category.category] = category.capabilities || [];
      return acc;
    }, {}),
    [blueprintCategories]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    base44.agents.createConversation({
      agent_name: "maestro_agent",
      metadata: { name: "Maestro Campaign Session" }
    }).then(conv => {
      setConversation(conv);
      setIsReady(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const filtered = data.messages
        .filter(m => (m.role === "user" || m.role === "assistant") && m.content)
        .map(m => ({ role: m.role, content: m.content, id: m.id }));
      setMessages(filtered);
      const last = data.messages[data.messages.length - 1];
      if (last?.role === "assistant" && last?.content) {
        setIsLoading(false);
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      }
    });
    return unsubscribe;
  }, [conversation?.id]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const newSession = async () => {
    setMessages([]);
    setIsLoading(false);
    setIsReady(false);
    const conv = await base44.agents.createConversation({
      agent_name: "maestro_agent",
      metadata: { name: "Maestro Campaign Session" }
    });
    setConversation(conv);
    setIsReady(true);
  };

  const runCapabilityAction = async (capability) => {
    const capabilityId = capability.id;
    const runtimeParams = normalizeRuntimeParams(capability.runtime_fields || [], runtimeDrafts[capabilityId] || {});

    setRunningCapabilityId(capabilityId);
    setCapabilityRuns((prev) => ({
      ...prev,
      [capabilityId]: {
        status: "running",
        summary: "Executing capability...",
        at: new Date().toISOString(),
      },
    }));

    await runCapability.mutateAsync({ capabilityId, runtimeParams });
  };

  const runCapabilityListSequential = async (capabilities, label) => {
    if (!Array.isArray(capabilities) || capabilities.length === 0) return;
    setIsRunningSweep(true);
    setSweepLabel(label);
    for (const capability of capabilities) {
      // Run sequentially to keep execution trace readable and avoid request spikes.
      try {
         
        await runCapabilityAction(capability);
      } catch {
        // Continue sweep even when one capability fails.
      }
    }
    setIsRunningSweep(false);
    setSweepLabel("");
  };

  const runSelectedCategory = async () => {
    if (selectedCategory === "All") {
      await runCapabilityListSequential(visibleCapabilities, "Running full filtered set");
      return;
    }
    const categoryCapabilities = categoryCapabilityMap[selectedCategory] || [];
    await runCapabilityListSequential(
      categoryCapabilities.map((cap) => ({ ...cap, category: selectedCategory })),
      `Running ${selectedCategory}`
    );
  };

  const runFullSweep = async () => {
    const allCapabilities = blueprintCategories.flatMap((category) =>
      (category.capabilities || []).map((cap) => ({ ...cap, category: category.category }))
    );
    await runCapabilityListSequential(allCapabilities, "Running full Maestro sweep");
  };

  const updateRuntimeDraft = (capabilityId, fieldId, value) => {
    setRuntimeDrafts((prev) => ({
      ...prev,
      [capabilityId]: {
        ...(prev[capabilityId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const draftCampaigns = campaigns.filter(c => c.status === "draft");

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex flex-col lg:flex-row">
      {/* Left Panel — Campaigns */}
      <div className="lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Maestro</h1>
              <p className="text-xs text-slate-500">Autonomous Social Media & Growth Conductor · Video · Community · Attribution</p>
            </div>
            <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isReady ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald-400" : "bg-slate-500/15 border border-slate-500/20 text-slate-400"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isReady ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
              {isReady ? "Active" : "Init..."}
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{activeCampaigns.length}</p>
              <p className="text-[10px] text-emerald-400/70 mt-0.5">Active</p>
            </div>
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-violet-400">{draftCampaigns.length}</p>
              <p className="text-[10px] text-violet-400/70 mt-0.5">Drafts</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to={createPageUrl("MaestroOpsHub")}
            className="inline-flex w-full items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
          >
            Maestro Ops Hub
          </Link>
          <Link
            to={createPageUrl("MaestroPerformanceDashboard")}
            className="inline-flex w-full items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
          >
            Performance Dashboard
          </Link>
        </div>
        </div>

        {/* Autopilot */}
        <div className="p-4 border-b border-white/[0.06]">
          <AutopilotControls />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Capability Engine */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capability Engine</span>
              <button
                onClick={() => refetchBlueprint()}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                type="button"
              >
                Refresh
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Blueprint-driven actions mapped to Maestro's MCP and channel stack.</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={runSelectedCategory}
                type="button"
                disabled={isBlueprintLoading || isRunningSweep || runCapability.isPending || visibleCapabilities.length === 0}
                className="px-2 py-1.5 rounded-lg text-[11px] bg-cyan-600/70 hover:bg-cyan-500 text-white disabled:opacity-50"
              >
                {isRunningSweep && sweepLabel ? sweepLabel : "Run Category"}
              </button>
              <button
                onClick={runFullSweep}
                type="button"
                disabled={isBlueprintLoading || isRunningSweep || runCapability.isPending || blueprintCategories.length === 0}
                className="px-2 py-1.5 rounded-lg text-[11px] bg-fuchsia-600/70 hover:bg-fuchsia-500 text-white disabled:opacity-50"
              >
                Run Full Sweep
              </button>
            </div>

            <input
              type="text"
              value={capabilitySearch}
              onChange={(e) => setCapabilitySearch(e.target.value)}
              placeholder="Search capabilities..."
              className="w-full mb-3 bg-black/30 border border-white/[0.08] rounded px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600"
            />

            <div className="flex gap-1.5 flex-wrap mb-3">
              {categoryList.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  type="button"
                  className={`px-2 py-1 rounded-full text-[10px] border transition-all ${selectedCategory === category ? "bg-violet-500/20 border-violet-500/40 text-violet-200" : "bg-white/[0.02] border-white/[0.08] text-slate-500 hover:text-slate-300"}`}
                >
                  {category}
                </button>
              ))}
            </div>

            {isBlueprintLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading capability blueprint...
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {visibleCapabilities.map((capability) => {
                  const runInfo = capabilityRuns[capability.id];
                  const isRunning = runningCapabilityId === capability.id && runCapability.isPending;
                  return (
                    <div key={capability.id} className="rounded-lg border border-white/[0.08] bg-black/20 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-white leading-tight">{capability.label}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${IMPACT_BADGE[capability.impact] || IMPACT_BADGE.medium}`}>
                          {capability.impact}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{capability.description}</p>

                      {(capability.tools || []).length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {capability.tools.slice(0, 3).map((tool) => (
                            <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">{tool}</span>
                          ))}
                        </div>
                      )}

                      {(capability.runtime_fields || []).length > 0 && (
                        <div className="mt-2 space-y-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCapabilityId(expandedCapabilityId === capability.id ? "" : capability.id)}
                            className="text-[10px] px-2 py-1 rounded border border-white/[0.12] text-slate-400 hover:text-slate-200"
                          >
                            {expandedCapabilityId === capability.id ? "Hide Inputs" : "Configure Inputs"}
                          </button>

                          {expandedCapabilityId === capability.id && (
                            <div className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                              {capability.runtime_fields.map((field) => (
                                <div key={field.id} className="space-y-1">
                                  <label className="text-[10px] text-slate-400">{field.label}</label>
                                  {field.type === "select" ? (
                                    <select
                                      value={runtimeDrafts[capability.id]?.[field.id] || ""}
                                      onChange={(e) => updateRuntimeDraft(capability.id, field.id, e.target.value)}
                                      className="w-full bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-slate-200"
                                    >
                                      <option value="">Select...</option>
                                      {(field.options || []).map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </select>
                                  ) : field.type === "long_text" ? (
                                    <textarea
                                      value={runtimeDrafts[capability.id]?.[field.id] || ""}
                                      onChange={(e) => updateRuntimeDraft(capability.id, field.id, e.target.value)}
                                      placeholder={field.placeholder || ""}
                                      rows={3}
                                      className="w-full bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                                    />
                                  ) : (
                                    <input
                                      type={field.type === "number" ? "number" : "text"}
                                      value={runtimeDrafts[capability.id]?.[field.id] || ""}
                                      onChange={(e) => updateRuntimeDraft(capability.id, field.id, e.target.value)}
                                      placeholder={field.placeholder || ""}
                                      className="w-full bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => runCapabilityAction(capability)}
                          disabled={isRunning || runCapability.isPending || isRunningSweep}
                          type="button"
                          className="px-2.5 py-1 rounded-lg text-[11px] bg-violet-600/80 hover:bg-violet-500 text-white disabled:opacity-50 flex items-center gap-1"
                        >
                          {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Run
                        </button>
                        {runInfo?.summary && (
                          <span className={`text-[10px] ${runInfo.status === "error" ? "text-rose-300" : runInfo.status === "success" ? "text-emerald-300" : "text-slate-500"}`}>
                            {runInfo.summary}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!visibleCapabilities.length && (
                  <p className="text-xs text-slate-500 py-2">No capabilities in this category.</p>
                )}
              </div>
            )}
          </div>

          {/* Campaign List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaigns</span>
              <span className="text-xs text-slate-600">{campaigns.length} total</span>
            </div>
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-white/[0.08] bg-white/[0.02]">
                <Megaphone className="w-10 h-10 text-violet-400/30 mb-3" />
                <p className="text-sm text-slate-500">No campaigns yet</p>
                <p className="text-xs text-slate-600 mt-1">Ask Maestro to plan one</p>
              </div>
            ) : (
              <AnimatePresence>
                {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-l border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Market trends for content", text: "What market trends should Maestro be creating content around right now? Give me the top 5 with urgency windows and specific content angles." },
            { label: "Competitor campaign analysis", text: "Analyze competitor marketing campaigns. What messaging, channels, and creative are working for them? What gaps can Maestro exploit?" },
          ]} />
        <AgentPanel agentName="canvas_agent" agentLabel="Canvas" agentEmoji="🎨" accentColor="purple"
          quickCommands={[
            { label: "Campaign creative brief", text: "Maestro needs creative assets for the current campaign. Generate the creative brief with specs, copy direction, and visual requirements." },
            { label: "A/B creative variants", text: "Create two creative direction variants to A/B test for the current campaign. Make them meaningfully different." },
          ]} />
        <AgentPanel agentName="prospect_agent" agentLabel="Prospect" agentEmoji="🎯" accentColor="blue"
          quickCommands={[
            { label: "Lead handoff from campaigns", text: "Send me the latest campaign-sourced leads. Which ones are warm enough to move to outreach?" },
            { label: "ICP for campaign targeting", text: "Give me the latest ICP data so Maestro can refine campaign targeting audiences." },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Marketing budget status", text: "How is our marketing budget tracking? What's spent, what's remaining, and are we on track for planned ROAS?" },
            { label: "Campaign ROI analysis", text: "Calculate the ROI on our active campaigns. What's the revenue generated vs. spend?" },
          ]} />
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Maestro Campaign Console</h2>
            <p className="text-xs text-slate-500">
              {isLoading ? "🎯 Working on it..." : "Plan · Create · Execute · Optimise"}
            </p>
          </div>
          <button onClick={newSession} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>

        {/* Quick Commands */}
        <div className="px-5 py-3 border-b border-white/[0.04] overflow-x-auto">
          <div className="flex gap-2">
            {QUICK_COMMANDS.map((qc, i) => (
              <button key={i} onClick={() => sendMessage(qc.cmd)} disabled={isLoading || !isReady}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-xs text-violet-300 hover:text-violet-100 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                <qc.icon className="w-3 h-3" />
                {qc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 lg:px-8 py-6 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-violet-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Maestro ready</h3>
                <p className="text-sm text-slate-500 max-w-sm">Your autonomous marketing manager. Give me a brief, a goal, or a channel — I'll build the entire campaign.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_COMMANDS.slice(0, 3).map((qc, i) => (
                  <button key={i} onClick={() => sendMessage(qc.cmd)} disabled={!isReady}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-40">
                    {qc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => <MessageBubble key={msg.id || i} message={msg} />)}
            {isLoading && (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-pink-500/30 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Megaphone className="w-3.5 h-3.5 text-violet-300" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                  {[0, 1, 2].map(j => (
                    <motion.div key={j} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.2 }} />
                  ))}
                  <span className="text-xs text-slate-500 ml-1">Maestro planning...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 lg:px-8 py-3 border-t border-white/[0.06]">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Brief Maestro — campaign goals, channels, audience, budget..."
              rows={1}
              style={{ resize: "none", minHeight: "48px", maxHeight: "120px" }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all"
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              disabled={isLoading || !conversation}
            />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading || !conversation}
              className="bg-violet-600 hover:bg-violet-500 text-white px-4 rounded-xl self-end h-12">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            Maestro has access to your business profile, financials, trends & content history
          </p>
        </div>
      </div>
    </div>
  );
}


























