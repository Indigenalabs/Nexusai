import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { formatRuntimeOutput } from "@/lib/resultFormatter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clapperboard,
  MessageSquare,
  TrendingUp,
  Bot,
  PlayCircle,
  Sparkles,
  Loader2,
  BarChart3,
  CalendarClock,
} from "lucide-react";

const MODULE_LINKS = [
  { title: "Social Command", page: "SocialCommand", desc: "Publishing, planning, and audience intelligence", icon: CalendarClock },
  { title: "Video Studio", page: "VideoStudio", desc: "Reels and short-form generation workflows", icon: Clapperboard },
  { title: "Social Inbox", page: "SocialInbox", desc: "Community response and DM triage", icon: MessageSquare },
  { title: "Trend Explorer", page: "TrendExplorer", desc: "Trend detection and opportunity scanning", icon: TrendingUp },
];

const QUICK_CAPABILITIES = [
  { id: "ops_autonomous_day_run", label: "Autonomous Day Run" },
  { id: "ops_execution_calendar_queue", label: "Queue Engine" },
  { id: "ops_guardrail_policy_check", label: "Guardrail Check" },
  { id: "ops_attribution_feedback_loop", label: "Attribution Loop" },
  { id: "ops_experiment_orchestrator", label: "Experiment Orchestrator" },
  { id: "ops_alerting_escalation", label: "Alert Escalation" },
  { id: "ops_full_self_test", label: "Full Ops Self Test" },
  { id: "trend_signal_scan", label: "Trend Signal Scan" },
  { id: "optimal_social_schedule", label: "Posting Time Prediction" },
  { id: "social_sentiment_warroom", label: "Sentiment War Room" },
  { id: "cross_platform_social_dashboard", label: "Cross-Platform Dashboard" },
  { id: "social_content_repurpose_automation", label: "Repurpose Automation" },
  { id: "social_monthly_gameplan", label: "Monthly Gameplan" },
];

export default function MaestroOpsHub() {
  const [tab, setTab] = useState("overview");
  const [reelTopic, setReelTopic] = useState("AI agents for social growth");
  const [reelTone, setReelTone] = useState("high-energy and credible");
  const [reelObjective, setReelObjective] = useState("engagement + inbound leads");
  const [messagesRaw, setMessagesRaw] = useState("How much is this?\nLove this post\nThis is misleading");
  const [activeRun, setActiveRun] = useState("");
  const [toolResult, setToolResult] = useState(null);
  const [capabilityResult, setCapabilityResult] = useState(null);

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["maestro_social_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("maestroSocialOps", { action: "unified_social_health" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const { data: runHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["maestro_ops_run_history"],
    queryFn: async () => {
      const res = await base44.functions.invoke("maestroSocialOps", { action: "run_history" });
      return res.data?.history || [];
    },
    staleTime: 30000,
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("maestroSocialOps", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
      refetchHistory();
    },
    onError: () => {
      setActiveRun("");
    },
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Maestro", capability_id: capabilityId },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchHealth();
      refetchHistory();
    },
    onError: () => {
      setActiveRun("");
    },
  });

  const messages = useMemo(
    () => messagesRaw.split("\n").map((m) => m.trim()).filter(Boolean),
    [messagesRaw]
  );

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Maestro")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/25">
              <Bot className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Maestro Ops Hub</h1>
              <p className="text-sm text-slate-500">Video, trends, community, analytics, and autonomous execution in one workspace</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetchHealth()} className="border-white/10 text-slate-300">
            Refresh Health
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
            <p className="text-[11px] text-slate-400">Ops Score</p>
            <p className="text-2xl font-bold text-violet-300">{healthLoading ? "..." : (healthData?.ops_score ?? "-")}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="text-[11px] text-slate-400">Scheduled Posts</p>
            <p className="text-2xl font-bold text-blue-300">{healthData?.posts?.scheduled ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-[11px] text-slate-400">Unread Community</p>
            <p className="text-2xl font-bold text-amber-300">{healthData?.community?.unread ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-[11px] text-slate-400">Flagged Items</p>
            <p className="text-2xl font-bold text-rose-300">{healthData?.community?.flagged ?? "-"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {MODULE_LINKS.map((module) => (
            <Link key={module.page} to={createPageUrl(module.page)} className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] p-4 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <module.icon className="w-4 h-4 text-cyan-300" />
                <p className="text-sm font-semibold text-white">{module.title}</p>
              </div>
              <p className="text-xs text-slate-500">{module.desc}</p>
            </Link>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08]">
            <TabsTrigger value="overview">Quick Run</TabsTrigger>
            <TabsTrigger value="video">Video Blueprint</TabsTrigger>
            <TabsTrigger value="community">Community Pack</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-white font-semibold mb-3">Maestro Social Capabilities</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button
                    key={cap.id}
                    size="sm"
                    onClick={() => {
                      setActiveRun(cap.id);
                      runCapability.mutate(cap.id);
                    }}
                    className="bg-indigo-600/80 hover:bg-indigo-500 text-white"
                    disabled={runCapability.isPending || runTool.isPending}
                  >
                    {activeRun === cap.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}
                    {cap.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-300"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("daily_execution_plan");
                    runTool.mutate({ action: "daily_execution_plan", params: {} });
                  }}
                >
                  {activeRun === "daily_execution_plan" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  Daily Execution Plan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="video" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">AI Reel Blueprint Generator</p>
              <Input value={reelTopic} onChange={(e) => setReelTopic(e.target.value)} placeholder="Topic" className="bg-black/30 border-white/10" />
              <Input value={reelTone} onChange={(e) => setReelTone(e.target.value)} placeholder="Tone" className="bg-black/30 border-white/10" />
              <Input value={reelObjective} onChange={(e) => setReelObjective(e.target.value)} placeholder="Objective" className="bg-black/30 border-white/10" />
              <Button
                onClick={() => {
                  setActiveRun("video_reel_blueprint");
                  runTool.mutate({
                    action: "video_reel_blueprint",
                    params: { topic: reelTopic, tone: reelTone, objective: reelObjective, platforms: ["instagram_reel", "tiktok", "youtube_shorts"] },
                  });
                }}
                disabled={runTool.isPending || runCapability.isPending}
                className="bg-violet-600 hover:bg-violet-500"
              >
                {activeRun === "video_reel_blueprint" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clapperboard className="w-4 h-4 mr-2" />}
                Generate Blueprint
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="community" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Community Response Pack</p>
              <Textarea
                value={messagesRaw}
                onChange={(e) => setMessagesRaw(e.target.value)}
                placeholder="One incoming message per line"
                className="bg-black/30 border-white/10 min-h-[120px]"
              />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-white/20 text-slate-300">{messages.length} messages</Badge>
                <Badge variant="outline" className="border-white/20 text-slate-300">Instagram</Badge>
              </div>
              <Button
                onClick={() => {
                  setActiveRun("community_response_pack");
                  runTool.mutate({ action: "community_response_pack", params: { platform: "instagram", incoming_messages: messages } });
                }}
                disabled={!messages.length || runTool.isPending || runCapability.isPending}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {activeRun === "community_response_pack" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                Build Response Pack
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyan-300" />
              <p className="text-sm font-semibold text-white">Tool Output</p>
            </div>
            <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-auto">{formatRuntimeOutput(toolResult, "No tool run yet.")}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-300" />
              <p className="text-sm font-semibold text-white">Capability Output</p>
            </div>
            <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-auto">{formatRuntimeOutput(capabilityResult, "No capability run yet.")}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Ops Run Timeline</p>
              <Button variant="outline" size="sm" className="h-7 border-white/10 text-slate-300" onClick={() => refetchHistory()}>
                Refresh
              </Button>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto pr-1">
              {runHistory.length === 0 && (
                <p className="text-[11px] text-slate-500">No ops runs logged yet.</p>
              )}
              {runHistory.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-white leading-tight">{item.title}</p>
                    <Badge className={`text-[10px] ${item.status === "failed" ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                      {item.status || "completed"}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{item.created_date ? new Date(item.created_date).toLocaleString() : ""}</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-3">{String(item.description || "").replace("[maestro_ops]", "").trim()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}














