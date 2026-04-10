import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { hasRemoteBackend, getRemoteBackendBase, pingRemoteBackend } from "@/lib/remoteAgentClient";
import { agentFabric } from "@/lib/agentFabric";
import { workflowEngine } from "@/lib/workflowEngine";
import { telemetry } from "@/lib/telemetry";
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock3, RefreshCw } from "lucide-react";

async function fetchRemoteJson(path) {
  const base = getRemoteBackendBase();
  if (!base) throw new Error("No remote backend base URL");
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

const checklist = (ctx) => [
  {
    key: "kafka",
    title: "Event bus implementation",
    status: ctx.events > 0 ? "done" : "in_progress",
    detail: `${ctx.events} events captured in local bus`,
  },
  {
    key: "registry",
    title: "Agent capability registry",
    status: ctx.registry > 0 ? "done" : "in_progress",
    detail: `${ctx.registry} agents registered`,
  },
  {
    key: "mcp",
    title: "MCP tool wiring",
    status: ctx.actionHandlers > 0 ? "done" : "in_progress",
    detail: "All agent pages call unified function invoke layer",
  },
  {
    key: "db",
    title: "Persistent app state",
    status: ctx.persistenceOnline ? "done" : "in_progress",
    detail: ctx.persistenceOnline
      ? `Execution/audit persistence online (${ctx.executionCount} executions)`
      : "Persistence endpoint not reachable",
  },
  {
    key: "vector",
    title: "Shared memory/vector layer",
    status: ctx.vectorOnline ? "done" : "in_progress",
    detail: ctx.vectorOnline
      ? `Vector memory adapter online (${ctx.vectorDocs} docs)`
      : "Vector endpoint not reachable",
  },
  {
    key: "temporal",
    title: "Workflow engine",
    status: ctx.workflowEngineOnline ? "done" : "in_progress",
    detail: ctx.workflowEngineOnline
      ? `Workflow orchestration endpoint online (${ctx.remoteWorkflows} records)`
      : `${ctx.workflows} local workflow records`,
  },
  {
    key: "remote",
    title: "Real backend integration",
    status: ctx.remoteHealthOk ? "done" : (ctx.remoteConfigured ? "in_progress" : "blocked"),
    detail: ctx.remoteHealthOk ? `Connected: ${ctx.remoteBase}` : (ctx.remoteConfigured ? "Backend configured but not reachable" : "Set VITE_AGENT_BACKEND_URL"),
  },
  {
    key: "security",
    title: "Security controls",
    status: ctx.securityOnline ? "done" : "in_progress",
    detail: ctx.securityOnline
      ? "Approval gates and policy-control endpoints online"
      : "Security control endpoints not reachable",
  },
  {
    key: "obs",
    title: "Observability",
    status: ctx.obsOnline ? "done" : "in_progress",
    detail: ctx.obsOnline
      ? `Observability + SLO online (${ctx.obsTraces} traces)`
      : `${ctx.logs} local telemetry logs captured`,
  },
  {
    key: "tests",
    title: "Automated QA",
    status: ctx.evalOnline ? "done" : "in_progress",
    detail: ctx.evalOnline
      ? `Eval harness online (${ctx.evalSuites} suites)`
      : "Build validation active; eval endpoint pending",
  },
  {
    key: "actions",
    title: "Action handler coverage",
    status: ctx.actionHandlers > 0 ? "done" : "in_progress",
    detail: `${ctx.actionFunctions} functions / ${ctx.actionHandlers} explicit actions mapped`,
  },
];

export default function SystemReadiness() {
  const fabricCtx = useMemo(() => ({
    events: agentFabric.listEvents(200).length,
    workflows: workflowEngine.list(200).length,
    logs: telemetry.list(200).length,
    registry: agentFabric.getRegistry().length,
  }), []);

  const actionMatrix = useQuery({
    queryKey: ["system_readiness_action_matrix"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "system_action_matrix" });
      return res.data?.result || null;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const backendHealth = useQuery({
    queryKey: ["system_readiness_backend_health"],
    queryFn: async () => await pingRemoteBackend(),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const persistenceQuery = useQuery({
    queryKey: ["system_readiness_persistence"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v2/persistence/status"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const vectorQuery = useQuery({
    queryKey: ["system_readiness_vector"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v2/vector/status"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const workflowsQuery = useQuery({
    queryKey: ["system_readiness_workflows_remote"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/workflows?limit=20"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const approvalsQuery = useQuery({
    queryKey: ["system_readiness_approvals"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v1/approvals"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const obsQuery = useQuery({
    queryKey: ["system_readiness_obs"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v4/observability?limit=30"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const sloQuery = useQuery({
    queryKey: ["system_readiness_slo"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v4/slo"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const evalQuery = useQuery({
    queryKey: ["system_readiness_eval_suites"],
    enabled: hasRemoteBackend(),
    queryFn: async () => await fetchRemoteJson("/v4/evals/suites"),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const ctx = {
    ...fabricCtx,
    remoteConfigured: hasRemoteBackend(),
    remoteBase: getRemoteBackendBase() || "not configured",
    remoteHealthOk: Boolean(backendHealth.data?.ok),
    actionFunctions: actionMatrix.data?.total_functions || 0,
    actionHandlers: actionMatrix.data?.total_actions || 0,
    persistenceOnline: Boolean(persistenceQuery.data?.status === "success"),
    executionCount: persistenceQuery.data?.result?.execution_count || 0,
    vectorOnline: Boolean(vectorQuery.data?.status === "success"),
    vectorDocs: vectorQuery.data?.result?.docs || 0,
    remoteWorkflows: workflowsQuery.data?.result?.count || 0,
    workflowEngineOnline: Boolean(workflowsQuery.data?.status === "success"),
    securityOnline: Boolean(approvalsQuery.data?.status === "success"),
    obsOnline: Boolean(obsQuery.data?.status === "success" && sloQuery.data?.status === "success"),
    obsTraces: (obsQuery.data?.result?.traces || []).length,
    evalOnline: Boolean(evalQuery.data?.status === "success"),
    evalSuites: (evalQuery.data?.result?.suites || []).length,
  };

  const items = useMemo(() => checklist(ctx), [ctx]);
  const complete = items.filter((x) => x.status === "done").length;

  const statusStyle = (s) => {
    if (s === "done") return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
    if (s === "blocked") return "text-rose-300 border-rose-500/30 bg-rose-500/10";
    return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  };

  const StatusIcon = ({ status }) => {
    if (status === "done") return <CheckCircle2 className="w-4 h-4" />;
    if (status === "blocked") return <AlertTriangle className="w-4 h-4" />;
    return <Clock3 className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <Link to={createPageUrl("Dashboard")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">System Readiness</h1>
          <p className="text-sm text-slate-400">Execution status for full 17-agent integration and production hardening.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">Completion</p>
            <p className="text-2xl font-semibold text-white">{complete}/{items.length}</p>
          </div>
          <div className="text-xs text-slate-400">
            <p>Remote backend: <span className={ctx.remoteHealthOk ? "text-emerald-300" : "text-rose-300"}>{ctx.remoteHealthOk ? "Connected" : (ctx.remoteConfigured ? "Configured / unreachable" : "Not configured")}</span></p>
            <p className="mt-1 text-slate-500 break-all">{ctx.remoteBase}</p>
            <p className="mt-1 text-slate-500">Action matrix: {ctx.actionFunctions} functions, {ctx.actionHandlers} actions</p>
          </div>
          <button
            onClick={() => backendHealth.refetch()}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${backendHealth.isFetching ? "animate-spin" : ""}`} />
            Check Backend
          </button>
          <Link
            to={createPageUrl("ActionMatrix")}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
          >
            Open Action Matrix
          </Link>
        </div>

        {backendHealth.data?.ok === false && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            Backend check error: {backendHealth.data?.error || "unknown"}
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className={`rounded-xl border p-3 ${statusStyle(item.status)}`}>
              <div className="flex items-center gap-2">
                <StatusIcon status={item.status} />
                <p className="text-sm font-semibold">{item.title}</p>
              </div>
              <p className="text-xs mt-1 opacity-90">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
