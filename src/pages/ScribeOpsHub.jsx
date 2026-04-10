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
import { ArrowLeft, BookOpen, Loader2, PlayCircle, Search, Network, ShieldCheck, Sparkles } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "knowledge_health", label: "Knowledge Health" },
  { id: "weekly_digest", label: "Weekly Digest" },
  { id: "semantic_search", label: "Semantic Search" },
  { id: "question_answer", label: "Q&A (RAG)" },
  { id: "knowledge_gap_analysis", label: "Gap Analysis" },
  { id: "generate_sop", label: "Generate SOP" },
  { id: "summarize_meeting", label: "Summarize Meeting" },
  { id: "log_decision", label: "Log Decision" },
  { id: "knowledge_graph_map", label: "Graph Mapper" },
  { id: "expertise_locator", label: "Expertise Locator" },
  { id: "decision_rationale_tracker", label: "Decision Tracker" },
  { id: "sop_version_guard", label: "SOP Guard" },
  { id: "proactive_knowledge_delivery", label: "Proactive Delivery" },
  { id: "governance_guard", label: "Governance Guard" },
  { id: "knowledge_velocity_report", label: "Knowledge Velocity" },
  { id: "lessons_learned", label: "Lessons Learned" },
  { id: "scribe_full_self_test", label: "Full Self Test" },
];

export default function ScribeOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [query, setQuery] = useState("What was the rationale behind our latest strategy change?");
  const [topic, setTopic] = useState("NDIS compliance");
  const [taskContext, setTaskContext] = useState("Preparing board strategy pack");
  const [processName] = useState("Client onboarding handover");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["scribe_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("scribeKnowledgeBase", { action: "knowledge_health" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Scribe", capability_id: capabilityId },
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
      const res = await base44.functions.invoke("scribeKnowledgeBase", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const quickScore = useMemo(() => healthData?.health_score ?? "--", [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Scribe")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Scribe
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Scribe Ops Hub</h1>
            <p className="text-sm text-slate-400">Knowledge ingestion, retrieval, governance, and institutional memory operations.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("scribe_full_self_test"); runTool.mutate({ action: "scribe_full_self_test" }); }}>
            {activeRun === "scribe_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Knowledge Score</p><p className="text-2xl font-semibold text-white">{quickScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Strengths</p><p className="text-2xl font-semibold text-cyan-300">{healthData?.strengths?.length ?? 0}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Weaknesses</p><p className="text-2xl font-semibold text-rose-300">{healthData?.weaknesses?.length ?? 0}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Improvements</p><p className="text-2xl font-semibold text-amber-300">{healthData?.improvements?.length ?? 0}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
            <TabsTrigger value="graph">Graph/Expertise</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="retrieval" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Semantic Search</p>
                <Textarea value={query} onChange={(e) => setQuery(e.target.value)} className="bg-black/30 border-white/10 min-h-[120px]" />
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("semantic_search"); runTool.mutate({ action: "semantic_search", params: { query } }); }}>
                  {activeRun === "semantic_search" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}Run Semantic Search
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Proactive Knowledge Delivery</p>
                <Input value={taskContext} onChange={(e) => setTaskContext(e.target.value)} className="bg-black/30 border-white/10" />
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("proactive_knowledge_delivery"); runTool.mutate({ action: "proactive_knowledge_delivery", params: { task_context: taskContext } }); }}>
                  {activeRun === "proactive_knowledge_delivery" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}Build Knowledge Pack
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="graph" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Knowledge Graph Mapper</p>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("knowledge_graph_map"); runTool.mutate({ action: "knowledge_graph_map" }); }}>
                  {activeRun === "knowledge_graph_map" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}Map Knowledge Graph
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Expertise Locator</p>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-black/30 border-white/10" />
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("expertise_locator"); runTool.mutate({ action: "expertise_locator", params: { topic } }); }}>
                  {activeRun === "expertise_locator" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}Find Experts
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Governance + SOP Guard</p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("governance_guard"); runTool.mutate({ action: "governance_guard" }); }}>
                  {activeRun === "governance_guard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Run Governance Guard
                </Button>
                <Button variant="outline" className="border-emerald-500/40 text-emerald-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("sop_version_guard"); runTool.mutate({ action: "sop_version_guard" }); }}>
                  {activeRun === "sop_version_guard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}Run SOP Guard
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("knowledge_velocity_report"); runTool.mutate({ action: "knowledge_velocity_report" }); }}>
                  {activeRun === "knowledge_velocity_report" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Knowledge Velocity
                </Button>
                <Button variant="outline" className="border-violet-500/40 text-violet-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("generate_sop"); runTool.mutate({ action: "generate_sop", params: { process_name: processName } }); }}>
                  {activeRun === "generate_sop" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}Generate SOP
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


