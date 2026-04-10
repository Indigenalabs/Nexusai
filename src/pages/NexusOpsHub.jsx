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
import { ArrowLeft, Loader2, PlayCircle, Sparkles, Brain, AlertTriangle, Workflow, Target } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "business_health_score", label: "Business Health" },
  { id: "cross_agent_insights", label: "Cross-Agent Insights" },
  { id: "intent_routing", label: "Intent Routing" },
  { id: "agent_registry_status", label: "Agent Registry" },
  { id: "workflow_health", label: "Workflow Health" },
  { id: "alert_correlation", label: "Alert Correlation" },
  { id: "scenario_modeling", label: "Scenario Modeling" },
  { id: "causal_analysis", label: "Causal Analysis" },
  { id: "strategic_brief", label: "Strategic Brief" },
  { id: "okr_progress", label: "OKR Progress" },
  { id: "board_deck", label: "Board Deck" },
  { id: "command_center_full_self_test", label: "Full Self Test" },
];

export default function NexusOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [userRequest, setUserRequest] = useState("Launch a new product and coordinate marketing, pricing, legal, and support rollout.");
  const [scenarioText, setScenarioText] = useState("Increase marketing spend by 20% and adjust pricing by +5%.");
  const [effectText, setEffectText] = useState("drop in conversion quality");
  const [briefType, setBriefType] = useState("weekly");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["nexus_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "command_center_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Nexus", capability_id: capabilityId, runtime_params: runtimeParams },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const health = healthData?.health || {};
  const checks = healthData?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("AICommandCenter")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Nexus Command
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Nexus Ops Hub</h1>
            <p className="text-sm text-slate-400">Unified command orchestration for routing, cross-agent intelligence, incidents, and strategic execution.</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("command_center_full_self_test"); runTool.mutate({ action: "command_center_full_self_test" }); }}>
            {activeRun === "command_center_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-blue-300">{health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Alerts</p><p className="text-2xl font-semibold text-rose-300">{health?.unread_critical_alerts ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Active Workflows</p><p className="text-2xl font-semibold text-cyan-300">{health?.active_workflows ?? "--"}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="routing">Routing</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    runCapability.mutate({ capabilityId: cap.id });
                  }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="routing" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Intent Routing + Registry</p>
              <Textarea value={userRequest} onChange={(e) => setUserRequest(e.target.value)} className="bg-black/30 border-white/10 min-h-[90px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("intent_routing"); runTool.mutate({ action: "intent_routing", params: { user_request: userRequest } }); }}>
                  {activeRun === "intent_routing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}Route Request
                </Button>
                <Button variant="outline" className="border-blue-500/40 text-blue-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("agent_registry_status"); runTool.mutate({ action: "agent_registry_status" }); }}>
                  {activeRun === "agent_registry_status" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}Agent Registry
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="intelligence" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Cross-Agent Intelligence</p>
              <Input value={effectText} onChange={(e) => setEffectText(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={scenarioText} onChange={(e) => setScenarioText(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("cross_agent_insights"); runTool.mutate({ action: "cross_agent_insights" }); }}>
                  {activeRun === "cross_agent_insights" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}Cross-Agent Insights
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("causal_analysis"); runTool.mutate({ action: "causal_analysis", params: { effect_to_analyze: effectText } }); }}>
                  {activeRun === "causal_analysis" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Workflow className="w-4 h-4 mr-2" />}Causal Analysis
                </Button>
                <Button variant="outline" className="border-emerald-500/40 text-emerald-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("scenario_modeling"); runTool.mutate({ action: "scenario_modeling", params: { scenario: scenarioText } }); }}>
                  {activeRun === "scenario_modeling" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Workflow className="w-4 h-4 mr-2" />}Scenario Model
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Strategic Command + Governance</p>
              <Input value={briefType} onChange={(e) => setBriefType(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("strategic_brief"); runTool.mutate({ action: "strategic_brief", params: { brief_type: briefType, audience: "leadership" } }); }}>
                  {activeRun === "strategic_brief" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}Strategic Brief
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("alert_correlation"); runTool.mutate({ action: "alert_correlation" }); }}>
                  {activeRun === "alert_correlation" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Alert Correlation
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("board_deck"); runTool.mutate({ action: "board_deck" }); }}>
                  {activeRun === "board_deck" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}Board Deck
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Capability Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(capabilityResult, "No capability run yet.")}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tool Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(toolResult, "No tool run yet.")}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}


