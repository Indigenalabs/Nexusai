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
import { ArrowLeft, Heart, Loader2, PlayCircle, Sparkles, Users, ShieldCheck, Activity } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "people_analytics", label: "People Analytics" },
  { id: "talent_intelligence_hub", label: "Talent Intelligence" },
  { id: "skills_inventory_mapping", label: "Skills Mapping" },
  { id: "workforce_forecasting", label: "Workforce Forecast" },
  { id: "succession_planning", label: "Succession Planning" },
  { id: "recruitment_funnel_intelligence", label: "Recruitment Funnel" },
  { id: "onboarding_command_center", label: "Onboarding Command" },
  { id: "performance_signal_scan", label: "Performance Signals" },
  { id: "burnout_risk_detection", label: "Burnout Detection" },
  { id: "retention_risk", label: "Retention Risk" },
  { id: "attrition_prediction", label: "Attrition Prediction" },
  { id: "manager_effectiveness_coach", label: "Manager Coach" },
  { id: "compensation_fairness_scan", label: "Comp Fairness" },
  { id: "culture_alignment_monitor", label: "Culture Alignment" },
  { id: "compliance_policy_audit", label: "Policy Audit" },
  { id: "employee_journey_map", label: "Journey Map" },
  { id: "pulse_full_self_test", label: "Full Self Test" },
];

export default function PulseOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [focusRole, setFocusRole] = useState("Support Worker");
  const [hiringHorizon, setHiringHorizon] = useState("12 months");
  const [targetTeam, setTargetTeam] = useState("Support and Operations");
  const [careerContext, setCareerContext] = useState("Improve progression pathways and mentorship consistency");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["pulse_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("pulseHREngine", { action: "people_analytics" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: {
          agent_name: "Pulse",
          capability_id: capabilityId,
          runtime_params: runtimeParams,
        },
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
      const res = await base44.functions.invoke("pulseHREngine", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const engagementScore = useMemo(() => healthData?.engagement_score ?? "--", [healthData]);
  const wellbeingScore = useMemo(() => healthData?.wellbeing_score ?? "--", [healthData]);
  const retentionHealth = useMemo(() => healthData?.retention_health_score ?? "--", [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Pulse")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Pulse
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Pulse Ops Hub</h1>
            <p className="text-sm text-slate-400">Talent intelligence, hiring velocity, performance signals, culture health, and workforce risk controls.</p>
          </div>
          <Button className="bg-pink-600 hover:bg-pink-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("pulse_full_self_test"); runTool.mutate({ action: "pulse_full_self_test" }); }}>
            {activeRun === "pulse_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Engagement</p><p className="text-2xl font-semibold text-cyan-300">{engagementScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Wellbeing</p><p className="text-2xl font-semibold text-emerald-300">{wellbeingScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Retention Health</p><p className="text-2xl font-semibold text-amber-300">{retentionHealth}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="workforce">Workforce</TabsTrigger>
            <TabsTrigger value="performance">Performance/Wellbeing</TabsTrigger>
            <TabsTrigger value="culture">Culture/Compliance</TabsTrigger>
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
                      if (cap.id === "workforce_forecasting") {
                        runCapability.mutate({ capabilityId: cap.id, runtimeParams: { horizon: hiringHorizon, role_focus: focusRole } });
                        return;
                      }
                      if (cap.id === "recruitment_funnel_intelligence") {
                        runCapability.mutate({ capabilityId: cap.id, runtimeParams: { role: focusRole } });
                        return;
                      }
                      if (cap.id === "employee_journey_map") {
                        runCapability.mutate({ capabilityId: cap.id, runtimeParams: { team_context: targetTeam } });
                        return;
                      }
                      runCapability.mutate({ capabilityId: cap.id });
                    }}
                  >
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workforce" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Workforce Forecast + Skills Mapping</p>
                <Input value={focusRole} onChange={(e) => setFocusRole(e.target.value)} className="bg-black/30 border-white/10" placeholder="Role focus" />
                <Input value={hiringHorizon} onChange={(e) => setHiringHorizon(e.target.value)} className="bg-black/30 border-white/10" placeholder="Horizon" />
                <div className="flex gap-2 flex-wrap">
                  <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("workforce_forecasting"); runTool.mutate({ action: "workforce_forecasting", params: { horizon: hiringHorizon, role_focus: focusRole } }); }}>
                    {activeRun === "workforce_forecasting" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Run Forecast
                  </Button>
                  <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("skills_inventory_mapping"); runTool.mutate({ action: "skills_inventory_mapping", params: { role_focus: focusRole } }); }}>
                    {activeRun === "skills_inventory_mapping" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Skills Map
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Recruitment + Succession</p>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("recruitment_funnel_intelligence"); runTool.mutate({ action: "recruitment_funnel_intelligence", params: { role: focusRole } }); }}>
                  {activeRun === "recruitment_funnel_intelligence" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}Recruitment Intelligence
                </Button>
                <Button variant="outline" className="border-purple-500/40 text-purple-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("succession_planning"); runTool.mutate({ action: "succession_planning", params: { role_focus: focusRole } }); }}>
                  {activeRun === "succession_planning" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Succession Plan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Performance, Burnout, and Manager Signals</p>
              <Textarea value={careerContext} onChange={(e) => setCareerContext(e.target.value)} className="bg-black/30 border-white/10 min-h-[110px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("performance_signal_scan"); runTool.mutate({ action: "performance_signal_scan", params: { context: careerContext } }); }}>
                  {activeRun === "performance_signal_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Performance Signals
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("burnout_risk_detection"); runTool.mutate({ action: "burnout_risk_detection" }); }}>
                  {activeRun === "burnout_risk_detection" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}Burnout Detection
                </Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("manager_effectiveness_coach"); runTool.mutate({ action: "manager_effectiveness_coach" }); }}>
                  {activeRun === "manager_effectiveness_coach" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Manager Coach
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("attrition_prediction"); runTool.mutate({ action: "attrition_prediction" }); }}>
                  {activeRun === "attrition_prediction" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Attrition Prediction
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="culture" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Culture, Fairness, and Policy Controls</p>
              <Input value={targetTeam} onChange={(e) => setTargetTeam(e.target.value)} className="bg-black/30 border-white/10" placeholder="Team context" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("culture_alignment_monitor"); runTool.mutate({ action: "culture_alignment_monitor" }); }}>
                  {activeRun === "culture_alignment_monitor" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}Culture Alignment
                </Button>
                <Button className="bg-pink-600 hover:bg-pink-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("compensation_fairness_scan"); runTool.mutate({ action: "compensation_fairness_scan", params: { role_focus: focusRole } }); }}>
                  {activeRun === "compensation_fairness_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Comp Fairness
                </Button>
                <Button variant="outline" className="border-emerald-500/40 text-emerald-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("compliance_policy_audit"); runTool.mutate({ action: "compliance_policy_audit" }); }}>
                  {activeRun === "compliance_policy_audit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Policy Audit
                </Button>
                <Button variant="outline" className="border-violet-500/40 text-violet-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("employee_journey_map"); runTool.mutate({ action: "employee_journey_map", params: { team_context: targetTeam } }); }}>
                  {activeRun === "employee_journey_map" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Journey Map
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


