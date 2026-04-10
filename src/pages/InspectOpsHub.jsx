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
import { ArrowLeft, Search, Loader2, PlayCircle, Sparkles, Shield, Activity, BarChart3 } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "quality_strategy_command", label: "Quality Strategy" },
  { id: "run_tests", label: "Run Tests" },
  { id: "regression_test", label: "Regression" },
  { id: "performance_test", label: "Performance" },
  { id: "security_scan", label: "Security Scan" },
  { id: "api_test", label: "API Test" },
  { id: "accessibility_audit", label: "Accessibility" },
  { id: "process_audit", label: "Process Audit" },
  { id: "sla_check", label: "SLA Check" },
  { id: "root_cause_analysis", label: "Root Cause" },
  { id: "release_readiness", label: "Release Readiness" },
  { id: "quality_gate_orchestrator", label: "Quality Gate" },
  { id: "quality_dashboard", label: "Quality Dashboard" },
  { id: "predictive_defect_risk", label: "Predictive Risk" },
  { id: "cost_of_quality", label: "Cost of Quality" },
  { id: "inspect_full_self_test", label: "Full Self Test" },
];

export default function InspectOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [scope, setScope] = useState("Core workflows + release pipeline");
  const [releaseName, setReleaseName] = useState("2026.03.1");
  const [minPassRate, setMinPassRate] = useState(90);
  const [changeSummary, setChangeSummary] = useState("Checkout + auth refactor");
  const [issueSummary, setIssueSummary] = useState("Intermittent checkout timeout after payment success");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["inspect_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("inspectQualityEngine", { action: "quality_strategy_command" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Inspect", capability_id: capabilityId, runtime_params: runtimeParams },
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
      const res = await base44.functions.invoke("inspectQualityEngine", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const qualityScore = useMemo(() => healthData?.quality_score ?? "--", [healthData]);
  const posture = useMemo(() => healthData?.posture ?? "unknown", [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Inspect")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Inspect
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Inspect Ops Hub</h1>
            <p className="text-sm text-slate-400">Unified quality strategy, testing orchestration, release gates, and defect risk controls.</p>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("inspect_full_self_test"); runTool.mutate({ action: "inspect_full_self_test" }); }}>
            {activeRun === "inspect_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Quality Score</p><p className="text-2xl font-semibold text-cyan-300">{qualityScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Posture</p><p className="text-2xl font-semibold text-amber-300">{String(posture)}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Priority Actions</p><p className="text-2xl font-semibold text-rose-300">{healthData?.strategic_priorities?.length ?? 0}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="release">Release Gates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "quality_gate_orchestrator") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { release_name: releaseName, min_pass_rate: minPassRate } });
                      return;
                    }
                    if (cap.id === "predictive_defect_risk") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { change_summary: changeSummary } });
                      return;
                    }
                    runCapability.mutate({ capabilityId: cap.id });
                  }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="testing" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Testing Command</p>
              <Textarea value={scope} onChange={(e) => setScope(e.target.value)} className="bg-black/30 border-white/10 min-h-[100px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("run_tests"); runTool.mutate({ action: "run_tests", params: { scope } }); }}>
                  {activeRun === "run_tests" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}Run Tests
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("regression_test"); runTool.mutate({ action: "regression_test", params: { changed_areas: scope } }); }}>
                  {activeRun === "regression_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Regression
                </Button>
                <Button variant="outline" className="border-rose-500/40 text-rose-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("security_scan"); runTool.mutate({ action: "security_scan", params: { components: scope } }); }}>
                  {activeRun === "security_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Security Scan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="release" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Release Governance</p>
              <Input value={releaseName} onChange={(e) => setReleaseName(e.target.value)} className="bg-black/30 border-white/10" />
              <Input type="number" value={minPassRate} onChange={(e) => setMinPassRate(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("release_readiness"); runTool.mutate({ action: "release_readiness", params: { release_scope: releaseName } }); }}>
                  {activeRun === "release_readiness" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Release Readiness
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("quality_gate_orchestrator"); runTool.mutate({ action: "quality_gate_orchestrator", params: { release_name: releaseName, min_pass_rate: minPassRate } }); }}>
                  {activeRun === "quality_gate_orchestrator" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Quality Gate
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Risk and Analytics</p>
              <Textarea value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} className="bg-black/30 border-white/10 min-h-[80px]" />
              <Textarea value={issueSummary} onChange={(e) => setIssueSummary(e.target.value)} className="bg-black/30 border-white/10 min-h-[80px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("predictive_defect_risk"); runTool.mutate({ action: "predictive_defect_risk", params: { change_summary: changeSummary } }); }}>
                  {activeRun === "predictive_defect_risk" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Predictive Risk
                </Button>
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("quality_dashboard"); runTool.mutate({ action: "quality_dashboard" }); }}>
                  {activeRun === "quality_dashboard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Quality Dashboard
                </Button>
                <Button variant="outline" className="border-orange-500/40 text-orange-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("root_cause_analysis"); runTool.mutate({ action: "root_cause_analysis", params: { issue_summary: issueSummary } }); }}>
                  {activeRun === "root_cause_analysis" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Root Cause
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


