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
import { ArrowLeft, Palette, Loader2, PlayCircle, Sparkles, Film, Wand2, BarChart3 } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "creative_ops_command_center", label: "Ops Command" },
  { id: "brand_identity", label: "Brand Identity" },
  { id: "brand_guardian_monitor", label: "Brand Guardian" },
  { id: "generate_images", label: "Image Studio" },
  { id: "multi_format_production_engine", label: "Multi-Format" },
  { id: "create_video", label: "Video Brief" },
  { id: "cinematic_video_command", label: "Cinematic" },
  { id: "campaign_concept", label: "Campaign Concept" },
  { id: "creative_performance", label: "Performance" },
  { id: "trend_forecast", label: "Trend Forecast" },
  { id: "ab_test_plan", label: "A/B Test" },
  { id: "creative_roi_attribution", label: "Creative ROI" },
  { id: "canvas_full_self_test", label: "Full Self Test" },
];

export default function CanvasOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [campaignName, setCampaignName] = useState("Q2 Brand Momentum");
  const [channels, setChannels] = useState("instagram,linkedin,email,web");
  const [sampleSize, setSampleSize] = useState(25);
  const [videoTopic, setVideoTopic] = useState("Narrative launch film for our core product");
  const [videoDuration, setVideoDuration] = useState(45);
  const [spend, setSpend] = useState(12000);
  const [revenue, setRevenue] = useState(54000);

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["canvas_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("canvasCreativeGeneration", { action: "creative_performance" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Canvas", capability_id: capabilityId, runtime_params: runtimeParams },
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
      const res = await base44.functions.invoke("canvasCreativeGeneration", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const perfSignals = useMemo(() => {
    const wins = healthData?.winning_patterns || healthData?.top_winners || [];
    const gaps = healthData?.gaps || healthData?.underperforming_areas || [];
    return { wins: wins.length || 0, gaps: gaps.length || 0 };
  }, [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Canvas")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Canvas
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Canvas Ops Hub</h1>
            <p className="text-sm text-slate-400">Creative operations command center for brand, production, strategy, and performance optimization.</p>
          </div>
          <Button className="bg-fuchsia-600 hover:bg-fuchsia-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("canvas_full_self_test"); runTool.mutate({ action: "canvas_full_self_test" }); }}>
            {activeRun === "canvas_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Winning Signals</p><p className="text-2xl font-semibold text-fuchsia-300">{perfSignals.wins}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Gap Signals</p><p className="text-2xl font-semibold text-rose-300">{perfSignals.gaps}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Status</p><p className="text-2xl font-semibold text-cyan-300">Ops Online</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="strategy">Strategy/Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "brand_guardian_monitor") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { sample_size: sampleSize } });
                      return;
                    }
                    if (cap.id === "multi_format_production_engine") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { campaign_name: campaignName, channels } });
                      return;
                    }
                    if (cap.id === "cinematic_video_command") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { topic: videoTopic, duration_seconds: videoDuration } });
                      return;
                    }
                    if (cap.id === "creative_roi_attribution") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { creative_spend: spend, influenced_revenue: revenue } });
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

          <TabsContent value="brand" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Brand Identity + Guardrails</p>
              <Input type="number" value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("brand_identity"); runTool.mutate({ action: "brand_identity" }); }}>
                  {activeRun === "brand_identity" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}Brand Identity
                </Button>
                <Button className="bg-fuchsia-600 hover:bg-fuchsia-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("brand_guardian_monitor"); runTool.mutate({ action: "brand_guardian_monitor", params: { sample_size: sampleSize } }); }}>
                  {activeRun === "brand_guardian_monitor" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}Brand Guardian
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="production" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Production Engine</p>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={channels} onChange={(e) => setChannels(e.target.value)} className="bg-black/30 border-white/10" />
              <Textarea value={videoTopic} onChange={(e) => setVideoTopic(e.target.value)} className="bg-black/30 border-white/10 min-h-[90px]" />
              <Input type="number" value={videoDuration} onChange={(e) => setVideoDuration(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("multi_format_production_engine"); runTool.mutate({ action: "multi_format_production_engine", params: { campaign_name: campaignName, channels } }); }}>
                  {activeRun === "multi_format_production_engine" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}Multi-Format Plan
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("cinematic_video_command"); runTool.mutate({ action: "cinematic_video_command", params: { topic: videoTopic, duration_seconds: videoDuration } }); }}>
                  {activeRun === "cinematic_video_command" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}Cinematic Brief
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Creative Strategy + ROI</p>
              <Input type="number" value={spend} onChange={(e) => setSpend(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <Input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("campaign_concept"); runTool.mutate({ action: "campaign_concept" }); }}>
                  {activeRun === "campaign_concept" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}Campaign Concepts
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("creative_roi_attribution"); runTool.mutate({ action: "creative_roi_attribution", params: { creative_spend: spend, influenced_revenue: revenue } }); }}>
                  {activeRun === "creative_roi_attribution" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Creative ROI
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


