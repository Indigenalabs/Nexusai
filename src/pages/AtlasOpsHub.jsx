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
import { ArrowLeft, Loader2, PlayCircle, Sparkles, Workflow, Users, Activity, ClipboardList } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "status_briefing", label: "Status Briefing" },
  { id: "create_workflow", label: "Workflow Architect" },
  { id: "map_process", label: "Process Mapping" },
  { id: "automate_process", label: "Automation Blueprint" },
  { id: "assign_tasks", label: "Assign Tasks" },
  { id: "track_workload", label: "Track Workload" },
  { id: "capacity_forecast", label: "Capacity Forecast" },
  { id: "predictive_allocation", label: "Predictive Allocation" },
  { id: "project_status", label: "Project Status" },
  { id: "prioritize_tasks", label: "Prioritize Tasks" },
  { id: "dependency_check", label: "Dependency Check" },
  { id: "process_analytics", label: "Process Analytics" },
  { id: "process_mining", label: "Process Mining" },
  { id: "workflow_optimization", label: "Workflow Optimization" },
  { id: "atlas_full_self_test", label: "Full Self Test" },
];

export default function AtlasOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [workflowTrigger, setWorkflowTrigger] = useState("lead.qualified -> onboarding workflow");
  const [processName, setProcessName] = useState("Incident to Resolution");
  const [painPoints, setPainPoints] = useState("Delayed triage, duplicate data entry, manual escalations");
  const [requestType, setRequestType] = useState("Procurement approval");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["atlas_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("atlasWorkflowAutomation", { action: "atlas_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Atlas", capability_id: capabilityId, runtime_params: runtimeParams },
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
      const payload = { action, ...(params || {}) };
      const res = await base44.functions.invoke("atlasWorkflowAutomation", payload);
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
            <Link to={createPageUrl("Atlas")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Atlas
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Atlas Ops Hub</h1>
            <p className="text-sm text-slate-400">Operational command center for process design, orchestration, allocation, and continuous improvement.</p>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("atlas_full_self_test"); runTool.mutate({ action: "atlas_full_self_test" }); }}>
            {activeRun === "atlas_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-orange-300">{health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Active Tasks</p><p className="text-2xl font-semibold text-cyan-300">{health?.active_tasks ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Blocked / Overdue</p><p className="text-2xl font-semibold text-rose-300">{(health?.blocked_tasks ?? 0) + (health?.overdue_tasks ?? 0)}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
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

          <TabsContent value="workflow" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Workflow Architecture + Automation</p>
              <Input value={workflowTrigger} onChange={(e) => setWorkflowTrigger(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={processName} onChange={(e) => setProcessName(e.target.value)} className="bg-black/30 border-white/10" />
              <Textarea value={painPoints} onChange={(e) => setPainPoints(e.target.value)} className="bg-black/30 border-white/10 min-h-[90px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("create_workflow"); runTool.mutate({ action: "create_workflow", params: { workflow_trigger: workflowTrigger } }); }}>
                  {activeRun === "create_workflow" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Workflow className="w-4 h-4 mr-2" />}Create Workflow
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("automate_process"); runTool.mutate({ action: "automate_process", params: { process_name: processName, current_pain_points: painPoints } }); }}>
                  {activeRun === "automate_process" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}Automation Blueprint
                </Button>
                <Button variant="outline" className="border-orange-500/40 text-orange-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("workflow_optimization"); runTool.mutate({ action: "workflow_optimization" }); }}>
                  {activeRun === "workflow_optimization" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Optimize Workflows
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Capacity + Allocation Command</p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("track_workload"); runTool.mutate({ action: "track_workload" }); }}>
                  {activeRun === "track_workload" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Track Workload
                </Button>
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("capacity_forecast"); runTool.mutate({ action: "capacity_forecast" }); }}>
                  {activeRun === "capacity_forecast" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Capacity Forecast
                </Button>
                <Button variant="outline" className="border-violet-500/40 text-violet-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("predictive_allocation"); runTool.mutate({ action: "predictive_allocation" }); }}>
                  {activeRun === "predictive_allocation" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Predictive Allocation
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Project + Governance Controls</p>
              <Input value={requestType} onChange={(e) => setRequestType(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-orange-600 hover:bg-orange-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("project_status"); runTool.mutate({ action: "project_status" }); }}>
                  {activeRun === "project_status" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}Project Status
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("prioritize_tasks"); runTool.mutate({ action: "prioritize_tasks" }); }}>
                  {activeRun === "prioritize_tasks" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}Prioritize Tasks
                </Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("approval_flow"); runTool.mutate({ action: "approval_flow", params: { request_type: requestType, requester: "Ops Lead" } }); }}>
                  {activeRun === "approval_flow" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}Approval Flow
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




