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
import { ArrowLeft, Bot, Loader2, PlayCircle, Sparkles, ShieldAlert, BarChart3, RadioTower, Building2 } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "health_scorecard", label: "Health Scorecard" },
  { id: "growth_forecast", label: "Growth Forecast" },
  { id: "scenario_modeling", label: "Scenario Model" },
  { id: "market_gap_analysis", label: "Market Gap" },
  { id: "macro_monitor", label: "Macro Monitor" },
  { id: "regulatory_radar", label: "Regulatory Radar" },
  { id: "mna_target_scan", label: "M&A Scan" },
  { id: "real_options_model", label: "Real Options" },
  { id: "strategic_risk_register", label: "Risk Register" },
  { id: "board_narrative_pack", label: "Board Pack" },
  { id: "cross_agent_strategy_sync", label: "Agent Sync" },
  { id: "sage_full_self_test", label: "Full Self Test" },
];

export default function SageOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [horizon, setHorizon] = useState("12 months");
  const [region, setRegion] = useState("Australia");
  const [thesis, setThesis] = useState("capability expansion + geographic scale");
  const [initiative, setInitiative] = useState("New enterprise service line");
  const [investment, setInvestment] = useState(250000);

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["sage_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("sageBussinessStrategy", { action: "health_scorecard" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Sage", capability_id: capabilityId },
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
      const res = await base44.functions.invoke("sageBussinessStrategy", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const healthScore = useMemo(() => {
    if (!healthData) return "--";
    const values = [healthData.financial_score, healthData.customer_score, healthData.process_score, healthData.growth_score]
      .filter((v) => typeof v === "number");
    if (!values.length) return "--";
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  }, [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("SageAI")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Sage
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Sage Ops Hub</h1>
            <p className="text-sm text-slate-400">Strategic intelligence, risk control, board communication, and cross-agent alignment.</p>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("sage_full_self_test"); runTool.mutate({ action: "sage_full_self_test" }); }}>
            {activeRun === "sage_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Strategy Health</p><p className="text-2xl font-semibold text-white">{healthScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Red Alerts</p><p className="text-2xl font-semibold text-rose-300">{healthData?.red_alerts?.length ?? 0}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Green Wins</p><p className="text-2xl font-semibold text-emerald-300">{healthData?.green_wins?.length ?? 0}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="intel">Intelligence</TabsTrigger>
            <TabsTrigger value="modeling">Modeling</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }}>
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
                <p className="text-sm font-semibold text-white">Global Macro Monitor</p>
                <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} className="bg-black/30 border-white/10" placeholder="Horizon" />
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("macro_monitor"); runTool.mutate({ action: "macro_monitor", params: { horizon } }); }}>
                  {activeRun === "macro_monitor" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RadioTower className="w-4 h-4 mr-2" />}Run Macro Monitor
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Regulatory Radar</p>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} className="bg-black/30 border-white/10" placeholder="Region" />
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("regulatory_radar"); runTool.mutate({ action: "regulatory_radar", params: { region } }); }}>
                  {activeRun === "regulatory_radar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}Run Regulatory Radar
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modeling" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">M&A Target Scan</p>
                <Textarea value={thesis} onChange={(e) => setThesis(e.target.value)} className="bg-black/30 border-white/10 min-h-[120px]" />
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("mna_target_scan"); runTool.mutate({ action: "mna_target_scan", params: { thesis } }); }}>
                  {activeRun === "mna_target_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}Run M&A Scan
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Real Options Model</p>
                <Input value={initiative} onChange={(e) => setInitiative(e.target.value)} className="bg-black/30 border-white/10" placeholder="Initiative" />
                <Input type="number" value={investment} onChange={(e) => setInvestment(Number(e.target.value || 0))} className="bg-black/30 border-white/10" placeholder="Investment" />
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("real_options_model"); runTool.mutate({ action: "real_options_model", params: { initiative, investment } }); }}>
                  {activeRun === "real_options_model" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Run Real Options
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Strategic Risk + Agent Sync</p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("strategic_risk_register"); runTool.mutate({ action: "strategic_risk_register" }); }}>
                  {activeRun === "strategic_risk_register" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}Risk Register
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("cross_agent_strategy_sync"); runTool.mutate({ action: "cross_agent_strategy_sync" }); }}>
                  {activeRun === "cross_agent_strategy_sync" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Cross-Agent Sync
                </Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("board_narrative_pack"); runTool.mutate({ action: "board_narrative_pack" }); }}>
                  {activeRun === "board_narrative_pack" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}Board Narrative
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


