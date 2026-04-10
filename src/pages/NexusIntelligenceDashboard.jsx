import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Brain, AlertTriangle, Workflow, Activity } from "lucide-react";

export default function NexusIntelligenceDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["nexus_intelligence_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", { action: "command_center_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const health = data?.health || {};
  const recommendations = data?.recommendations || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("NexusOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Nexus Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Nexus Intelligence Dashboard</h1>
            <p className="text-sm text-slate-400">Unified command intelligence for federation health, orchestration risk, and top intervention priorities.</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-blue-300">{health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Alerts</p><p className="text-2xl font-semibold text-rose-300">{health?.unread_critical_alerts ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Blocked Tasks</p><p className="text-2xl font-semibold text-amber-300">{health?.blocked_tasks ?? "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-orange-300" /><p className="text-sm font-semibold text-white">Immediate Actions</p></div>
            <div className="space-y-2">
              {(recommendations?.immediate_actions || []).length === 0 && <p className="text-xs text-slate-500">No immediate actions generated yet.</p>}
              {(recommendations?.immediate_actions || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 text-xs text-orange-200">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Workflow className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Orchestration + Risk Controls</p></div>
            <div className="space-y-2">
              {(recommendations?.orchestration_optimizations || []).length === 0 && <p className="text-xs text-slate-500">No orchestration optimization insights generated yet.</p>}
              {(recommendations?.orchestration_optimizations || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">{item}</div>
              ))}
              {(recommendations?.risk_controls || []).slice(0, 3).map((item, i) => (
                <div key={`r-${i}`} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Health Module</p></div>
            <HumanDataPanel data={health} emptyText="Health data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Brain className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Checks Module</p></div>
            <HumanDataPanel data={checks} emptyText="Checks not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Workflow className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Recommendations Module</p></div>
            <HumanDataPanel data={recommendations} emptyText="Recommendations not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
