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
import { ArrowLeft, Compass, Loader2, PlayCircle, Radar, ShieldAlert, Sparkles, Network, Eye } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "market_briefing", label: "Market Briefing" },
  { id: "monitor_trends", label: "Trend Monitor" },
  { id: "analyze_competitors", label: "Competitor Analysis" },
  { id: "competitor_dna_profile", label: "Competitor DNA" },
  { id: "competitor_prediction", label: "Move Prediction" },
  { id: "war_game_simulation", label: "War Game" },
  { id: "sector_analysis", label: "Sector Analysis" },
  { id: "niche_discovery", label: "Niche Discovery" },
  { id: "policy_watch", label: "Policy Watch" },
  { id: "macro_intelligence", label: "Macro Intelligence" },
  { id: "disruption_risk", label: "Disruption Risk" },
  { id: "early_warning_radar", label: "Early Warning Radar" },
  { id: "intelligence_fusion_graph", label: "Fusion Graph" },
  { id: "source_quality_calibration", label: "Source Calibration" },
  { id: "compass_full_self_test", label: "Full Self Test" },
];

export default function CompassOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [competitorName, setCompetitorName] = useState("Primary competitor");
  const [ourMove, setOurMove] = useState("Launch enterprise tier with aggressive onboarding guarantee");
  const [focusArea, setFocusArea] = useState("B2B SaaS workflow automation");

  const { data: briefingData, refetch: refetchBriefing } = useQuery({
    queryKey: ["compass_ops_briefing"],
    queryFn: async () => {
      const res = await base44.functions.invoke("compassMarketIntelligence", { action: "market_briefing" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: {
          agent_name: "Compass",
          capability_id: capabilityId,
          runtime_params: runtimeParams,
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchBriefing();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("compassMarketIntelligence", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchBriefing();
    },
    onError: () => setActiveRun(""),
  });

  const criticalCount = useMemo(() => briefingData?.critical_alerts?.length ?? 0, [briefingData]);
  const opportunityCount = useMemo(() => briefingData?.opportunities?.length ?? 0, [briefingData]);
  const actionCount = useMemo(() => briefingData?.top_3_actions?.length ?? 0, [briefingData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Compass")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Compass
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Compass Ops Hub</h1>
            <p className="text-sm text-slate-400">Competitive radar operations, trend sensing, predictive war gaming, and strategic alerting.</p>
          </div>
          <Button
            className="bg-cyan-600 hover:bg-cyan-500"
            disabled={runTool.isPending || runCapability.isPending}
            onClick={() => {
              setActiveRun("compass_full_self_test");
              runTool.mutate({ action: "compass_full_self_test" });
            }}
          >
            {activeRun === "compass_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Alerts</p><p className="text-2xl font-semibold text-rose-300">{criticalCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Opportunities</p><p className="text-2xl font-semibold text-emerald-300">{opportunityCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Top Actions</p><p className="text-2xl font-semibold text-cyan-300">{actionCount}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="intel">Intel</TabsTrigger>
            <TabsTrigger value="predictive">Predictive</TabsTrigger>
            <TabsTrigger value="alerts">Alerts/Fusion</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button
                    key={cap.id}
                    variant="outline"
                    className="justify-start border-white/15 text-slate-300"
                    disabled={runCapability.isPending || runTool.isPending}
                    onClick={() => {
                      setActiveRun(cap.id);
                      if (cap.id === "competitor_dna_profile") {
                        runCapability.mutate({ capabilityId: cap.id, runtimeParams: { competitor_name: competitorName } });
                        return;
                      }
                      if (cap.id === "war_game_simulation") {
                        runCapability.mutate({ capabilityId: cap.id, runtimeParams: { our_move: ourMove } });
                        return;
                      }
                      runCapability.mutate({ capabilityId: cap.id });
                    }}
                  >
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />}
                    {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="intel" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Competitor DNA Profile</p>
                <Input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} className="bg-black/30 border-white/10" placeholder="Competitor name" />
                <Button
                  className="bg-blue-600 hover:bg-blue-500"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("competitor_dna_profile");
                    runTool.mutate({ action: "competitor_dna_profile", params: { competitor_name: competitorName } });
                  }}
                >
                  {activeRun === "competitor_dna_profile" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                  Build DNA Profile
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Signal Intake Hub</p>
                <Textarea value={focusArea} onChange={(e) => setFocusArea(e.target.value)} className="bg-black/30 border-white/10 min-h-[110px]" />
                <Button
                  className="bg-violet-600 hover:bg-violet-500"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("signal_intake_hub");
                    runTool.mutate({ action: "signal_intake_hub", params: { sector: focusArea } });
                  }}
                >
                  {activeRun === "signal_intake_hub" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Compass className="w-4 h-4 mr-2" />}
                  Run Intake Scan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="predictive" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">War Game + Disruption Posture</p>
              <Textarea value={ourMove} onChange={(e) => setOurMove(e.target.value)} className="bg-black/30 border-white/10 min-h-[120px]" placeholder="Describe our planned strategic move" />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-amber-600 hover:bg-amber-500"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("war_game_simulation");
                    runTool.mutate({ action: "war_game_simulation", params: { our_move: ourMove } });
                  }}
                >
                  {activeRun === "war_game_simulation" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                  Run War Game
                </Button>
                <Button
                  variant="outline"
                  className="border-rose-500/40 text-rose-300"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("disruption_risk");
                    runTool.mutate({ action: "disruption_risk" });
                  }}
                >
                  {activeRun === "disruption_risk" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radar className="w-4 h-4 mr-2" />}
                  Disruption Risk
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Early Warning + Intelligence Fusion</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-rose-600 hover:bg-rose-500"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("early_warning_radar");
                    runTool.mutate({ action: "early_warning_radar" });
                  }}
                >
                  {activeRun === "early_warning_radar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                  Early Warning Radar
                </Button>
                <Button
                  className="bg-cyan-600 hover:bg-cyan-500"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("intelligence_fusion_graph");
                    runTool.mutate({ action: "intelligence_fusion_graph" });
                  }}
                >
                  {activeRun === "intelligence_fusion_graph" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}
                  Intelligence Fusion Graph
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-300"
                  disabled={runTool.isPending || runCapability.isPending}
                  onClick={() => {
                    setActiveRun("source_quality_calibration");
                    runTool.mutate({ action: "source_quality_calibration" });
                  }}
                >
                  {activeRun === "source_quality_calibration" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Calibrate Sources
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


