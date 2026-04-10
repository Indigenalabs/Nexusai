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
import { ArrowLeft, Handshake, Loader2, PlayCircle, Sparkles, Network, ShieldAlert, BarChart3 } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "discover_partners", label: "Discover Partners" },
  { id: "strategic_fit_scoring", label: "Strategic Fit" },
  { id: "intent_discovery", label: "Intent Discovery" },
  { id: "competitor_partner_map", label: "Competitor Map" },
  { id: "draft_outreach", label: "Draft Outreach" },
  { id: "generate_agreement", label: "Generate Agreement" },
  { id: "health_audit", label: "Health Audit" },
  { id: "prepare_qbr", label: "Prepare QBR" },
  { id: "partner_tiering_engine", label: "Tiering Engine" },
  { id: "co_marketing_plan", label: "Co-Marketing Plan" },
  { id: "cross_sell_opportunities", label: "Cross-Sell" },
  { id: "partner_analytics", label: "Partner Analytics" },
  { id: "partner_ltv", label: "Partner LTV" },
  { id: "channel_conflict_detection", label: "Conflict Detection" },
  { id: "ecosystem_positioning", label: "Ecosystem Positioning" },
  { id: "part_full_self_test", label: "Full Self Test" },
];

export default function PartOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [candidateName, setCandidateName] = useState("Strategic partner candidate");
  const [candidateProfile, setCandidateProfile] = useState("Strong overlap with our ICP and integration potential");
  const [partnerName, setPartnerName] = useState("Priority Partner");
  const [ourGoal, setOurGoal] = useState("Launch co-marketing + co-selling motion in 90 days");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["part_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("partPartnershipEngine", { action: "health_audit" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: {
          agent_name: "Part",
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
      const res = await base44.functions.invoke("partPartnershipEngine", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const portfolioScore = useMemo(() => healthData?.portfolio_health_score ?? "--", [healthData]);
  const atRiskCount = useMemo(() => healthData?.at_risk?.length ?? 0, [healthData]);
  const highPotential = useMemo(() => healthData?.highest_potential?.length ?? 0, [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Part")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Part
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Part Ops Hub</h1>
            <p className="text-sm text-slate-400">Partnership discovery, lifecycle management, co-selling orchestration, and ecosystem optimization.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("part_full_self_test"); runTool.mutate({ action: "part_full_self_test" }); }}>
            {activeRun === "part_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Portfolio Health</p><p className="text-2xl font-semibold text-cyan-300">{portfolioScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">At Risk</p><p className="text-2xl font-semibold text-rose-300">{atRiskCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">High Potential</p><p className="text-2xl font-semibold text-emerald-300">{highPotential}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="discovery">Discovery</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            <TabsTrigger value="ecosystem">Ecosystem</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "strategic_fit_scoring") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { candidate_name: candidateName, candidate_profile: candidateProfile } });
                      return;
                    }
                    if (cap.id === "draft_outreach" || cap.id === "prepare_qbr" || cap.id === "co_marketing_plan") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { partner_name: partnerName } });
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

          <TabsContent value="discovery" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Strategic Fit Scoring</p>
                <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="bg-black/30 border-white/10" />
                <Textarea value={candidateProfile} onChange={(e) => setCandidateProfile(e.target.value)} className="bg-black/30 border-white/10 min-h-[100px]" />
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("strategic_fit_scoring"); runTool.mutate({ action: "strategic_fit_scoring", params: { candidate_name: candidateName, candidate_profile: candidateProfile } }); }}>
                  {activeRun === "strategic_fit_scoring" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}Run Fit Score
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Intent Discovery</p>
                <Textarea value={ourGoal} onChange={(e) => setOurGoal(e.target.value)} className="bg-black/30 border-white/10 min-h-[100px]" />
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("intent_discovery"); runTool.mutate({ action: "intent_discovery", params: { goal: ourGoal } }); }}>
                  {activeRun === "intent_discovery" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}Run Intent Scan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lifecycle" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Partner Lifecycle Controls</p>
              <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="bg-black/30 border-white/10" placeholder="Partner name" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("health_audit"); runTool.mutate({ action: "health_audit" }); }}>
                  {activeRun === "health_audit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Health Audit
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("partner_tiering_engine"); runTool.mutate({ action: "partner_tiering_engine" }); }}>
                  {activeRun === "partner_tiering_engine" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Tiering Engine
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("prepare_qbr"); runTool.mutate({ action: "prepare_qbr", params: { partner_name: partnerName } }); }}>
                  {activeRun === "prepare_qbr" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}Prepare QBR
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ecosystem" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Ecosystem + Risk Controls</p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("ecosystem_positioning"); runTool.mutate({ action: "ecosystem_positioning" }); }}>
                  {activeRun === "ecosystem_positioning" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}Ecosystem Positioning
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("channel_conflict_detection"); runTool.mutate({ action: "channel_conflict_detection" }); }}>
                  {activeRun === "channel_conflict_detection" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}Conflict Detection
                </Button>
                <Button variant="outline" className="border-emerald-500/40 text-emerald-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("cross_partner_opportunities"); runTool.mutate({ action: "cross_partner_opportunities" }); }}>
                  {activeRun === "cross_partner_opportunities" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}Cross-Partner Opportunities
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


