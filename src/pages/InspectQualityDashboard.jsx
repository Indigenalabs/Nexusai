import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Search, Shield, Activity, BarChart3 } from "lucide-react";

export default function InspectQualityDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["inspect_quality_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("inspectQualityEngine", { action: "inspect_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const operations = data?.operations || {};
  const readiness = data?.readiness || {};
  const priorities = data?.priorities_7d || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("InspectOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Inspect Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Inspect Quality Dashboard</h1>
            <p className="text-sm text-slate-400">Executive quality status across incidents, backlog health, release gate posture, and observability readiness.</p>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Open</p><p className="text-2xl font-semibold text-rose-300">{operations?.open_critical_incidents ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">High Open</p><p className="text-2xl font-semibold text-amber-300">{operations?.open_high_incidents ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Release Posture</p><p className="text-2xl font-semibold text-cyan-300">{readiness?.release_gate_posture || "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Priority Actions (7 Days)</p></div>
            <div className="space-y-2">
              {priorities.length === 0 && <p className="text-xs text-slate-500">No priority actions generated yet.</p>}
              {priorities.map((item, i) => (
                <div key={i} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Readiness Summary</p></div>
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">Recommended next run: {readiness?.recommended_next_run || "24h"}</div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">Open support tickets: {operations?.open_support_tickets ?? "--"}</div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Open QA tasks: {operations?.open_qa_tasks ?? "--"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Checks</p></div>
            <HumanDataPanel data={checks} emptyText="Checks not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Search className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Operations Module</p></div>
            <HumanDataPanel data={operations} emptyText="Operations data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Readiness Module</p></div>
            <HumanDataPanel data={readiness} emptyText="Readiness data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
