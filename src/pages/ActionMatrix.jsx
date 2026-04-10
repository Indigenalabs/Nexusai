import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Play, Loader2, CheckCircle2, AlertTriangle, Download, Trash2 } from "lucide-react";

const runPreview = (result) => {
  if (!result) return "No output";
  const payload = result?.result || result;
  if (typeof payload === "string") return payload;
  if (payload.summary) return payload.summary;
  if (payload.message) return payload.message;
  if (payload.recommendation) return payload.recommendation;
  return Object.keys(payload).slice(0, 4).join(", ") || "Output received";
};

export default function ActionMatrix() {
  const [query, setQuery] = useState("");
  const [activeFn, setActiveFn] = useState("all");
  const [runState, setRunState] = useState({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const matrixQuery = useQuery({
    queryKey: ["action_matrix_page"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "system_action_matrix" });
      return res.data?.result || { functions: [], total_actions: 0, total_functions: 0 };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const functions = matrixQuery.data?.functions || [];

  const visibleFunctions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return functions
      .filter((row) => activeFn === "all" || row.function_name === activeFn)
      .map((row) => ({
        ...row,
        actions: (row.actions || []).filter((a) => !q || a.toLowerCase().includes(q) || row.function_name.toLowerCase().includes(q)),
      }))
      .filter((row) => row.actions.length > 0);
  }, [functions, query, activeFn]);

  const flatVisibleActions = useMemo(
    () => visibleFunctions.flatMap((row) => row.actions.map((action) => ({ functionName: row.function_name, action }))),
    [visibleFunctions]
  );

  const globalSummary = useMemo(() => {
    const entries = Object.values(runState);
    const success = entries.filter((x) => x?.status === "success").length;
    const error = entries.filter((x) => x?.status === "error").length;
    const running = entries.filter((x) => x?.status === "running").length;
    return { total: entries.length, success, error, running };
  }, [runState]);

  const executeAction = async (functionName, action) => {
    const key = `${functionName}:${action}`;
    setRunState((prev) => ({
      ...prev,
      [key]: { status: "running", at: new Date().toISOString(), preview: "Running..." },
    }));

    try {
      const res = await base44.functions.invoke(functionName, { action, params: { source: "action_matrix_page", smoke: true } });
      if (res?.data?.status === "error" || res?.data?.error) {
        throw new Error(res?.data?.run_error || res?.data?.error || "Action failed");
      }
      setRunState((prev) => ({
        ...prev,
        [key]: {
          status: "success",
          at: new Date().toISOString(),
          preview: runPreview(res?.data),
          raw: res?.data || null,
        },
      }));
      return { ok: true };
    } catch (error) {
      setRunState((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          at: new Date().toISOString(),
          preview: error?.message || "Action failed",
        },
      }));
      return { ok: false, error: String(error?.message || error || "Action failed") };
    }
  };

  const runBulk = async () => {
    if (bulkRunning || flatVisibleActions.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: flatVisibleActions.length });

    let done = 0;
    for (const row of flatVisibleActions) {
      // Sequential execution keeps runtime load stable and logs readable.
       
      await executeAction(row.functionName, row.action);
      done += 1;
      setBulkProgress({ done, total: flatVisibleActions.length });
    }

    setBulkRunning(false);
  };

  const runSelectedFunction = async () => {
    if (bulkRunning || activeFn === "all") return;
    const selectedFn = visibleFunctions.find((row) => row.function_name === activeFn);
    if (!selectedFn || selectedFn.actions.length === 0) return;

    const scope = selectedFn.actions.map((action) => ({ functionName: selectedFn.function_name, action }));
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: scope.length });

    let done = 0;
    for (const row of scope) {
      // Sequential execution keeps runtime load stable and logs readable.
       
      await executeAction(row.functionName, row.action);
      done += 1;
      setBulkProgress({ done, total: scope.length });
    }

    setBulkRunning(false);
  };

  const clearResults = () => {
    setRunState({});
    setBulkProgress({ done: 0, total: 0 });
  };

  const exportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      filters: { query, active_function: activeFn },
      matrix_totals: {
        total_functions: matrixQuery.data?.total_functions || 0,
        total_actions: matrixQuery.data?.total_actions || 0,
      },
      visible_scope: {
        functions: visibleFunctions.map((f) => f.function_name),
        action_count: flatVisibleActions.length,
      },
      results: runState,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `action-matrix-report-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <Link to={createPageUrl("SystemReadiness")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to System Readiness
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Action Matrix</h1>
          <p className="text-sm text-slate-400">Inspect mapped runtime actions, run smoke checks, and export validation reports.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-slate-500">Functions</p>
            <p className="text-xl font-semibold text-white">{matrixQuery.data?.total_functions ?? "--"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Actions</p>
            <p className="text-xl font-semibold text-white">{matrixQuery.data?.total_actions ?? "--"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Visible Scope</p>
            <p className="text-xl font-semibold text-white">{flatVisibleActions.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold text-slate-200">
              {bulkRunning ? `Running ${bulkProgress.done}/${bulkProgress.total}` : (matrixQuery.isFetching ? "Refreshing..." : "Live")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action or function"
              className="w-full md:w-80 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <select
              value={activeFn}
              onChange={(e) => setActiveFn(e.target.value)}
              className="w-full md:w-96 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All functions</option>
              {functions.map((row) => (
                <option key={row.function_name} value={row.function_name}>{row.function_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={runBulk}
              disabled={bulkRunning || flatVisibleActions.length === 0}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-blue-500/35 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 disabled:opacity-50"
            >
              {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Visible ({flatVisibleActions.length})
            </button>
            <button
              onClick={runSelectedFunction}
              disabled={bulkRunning || activeFn === "all" || !visibleFunctions.find((row) => row.function_name === activeFn)?.actions?.length}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-indigo-500/35 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50"
            >
              {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Function ({activeFn === "all" ? "Select function" : activeFn})
            </button>
            <button
              onClick={exportReport}
              disabled={Object.keys(runState).length === 0}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export Report
            </button>
            <button
              onClick={clearResults}
              disabled={Object.keys(runState).length === 0}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-white/20 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Results
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-md border border-white/15 bg-white/5 text-slate-300">Runs: {globalSummary.total}</span>
            <span className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Pass: {globalSummary.success}</span>
            <span className="px-2 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">Fail: {globalSummary.error}</span>
            <span className="px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">Running: {globalSummary.running}</span>
          </div>
        </div>

        <div className="space-y-3">
          {visibleFunctions.map((row) => (
            <div key={row.function_name} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-white">{row.function_name}</p>
                <p className="text-xs text-slate-500">{row.actions.length} actions</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-2 text-[11px]">
                <span className="px-2 py-1 rounded-md border border-white/15 bg-white/5 text-slate-300">
                  Runs: {row.actions.filter((action) => Boolean(runState[`${row.function_name}:${action}`])).length}
                </span>
                <span className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  Pass: {row.actions.filter((action) => runState[`${row.function_name}:${action}`]?.status === "success").length}
                </span>
                <span className="px-2 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
                  Fail: {row.actions.filter((action) => runState[`${row.function_name}:${action}`]?.status === "error").length}
                </span>
                <span className="px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  Running: {row.actions.filter((action) => runState[`${row.function_name}:${action}`]?.status === "running").length}
                </span>
              </div>
              <div className="space-y-2">
                {row.actions.map((action) => {
                  const key = `${row.function_name}:${action}`;
                  const state = runState[key];
                  const isRunning = state?.status === "running";
                  const isSuccess = state?.status === "success";
                  const isError = state?.status === "error";
                  return (
                    <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-200">{action}</p>
                        <button
                          onClick={() => executeAction(row.function_name, action)}
                          disabled={isRunning || bulkRunning}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-white/20 hover:bg-white/10 disabled:opacity-50"
                        >
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}Run
                        </button>
                      </div>
                      {state?.preview && (
                        <div className="mt-2 text-[11px] text-slate-400 flex items-start gap-1.5">
                          {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 mt-0.5" />}
                          {isError && <AlertTriangle className="w-3.5 h-3.5 text-rose-300 mt-0.5" />}
                          {!isSuccess && !isError && <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin" />}
                          <span>{state.preview}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
