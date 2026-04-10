import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Clock3, Focus, BarChart3, AlertTriangle, Sparkles } from "lucide-react";

export default function ChronosTimeDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["chronos_time_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("chronosSchedulingEngine", { action: "chronos_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const improvements = data?.audit?.recommendations || [];
  const effectiveness = data?.effectiveness || {};
  const forecast = data?.forecast || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("ChronosOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Chronos Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Chronos Time Dashboard</h1>
            <p className="text-sm text-slate-400">Executive time intelligence across audit, meeting effectiveness, forecast, and deep-work guardrails.</p>
          </div>
          <Button className="bg-sky-600 hover:bg-sky-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Time Health</p><p className="text-2xl font-semibold text-cyan-300">{data?.audit?.time_health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Meeting Effectiveness</p><p className="text-2xl font-semibold text-amber-300">{effectiveness?.effectiveness_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">2W Pressure</p><p className="text-2xl font-semibold text-rose-300">{forecast?.pressure_level || "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Top Improvement Queue</p></div>
            <div className="space-y-2">
              {improvements.length === 0 && <p className="text-xs text-slate-500">No recommendations available yet.</p>}
              {improvements.map((item, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-200">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Risk & Forecast Alerts</p></div>
            <div className="space-y-2">
              {(forecast?.pressure_points || []).map((x, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-200">{x}</div>
              ))}
              {(forecast?.at_risk_windows || []).map((x, i) => (
                <div key={`r-${i}`} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{x}</div>
              ))}
              {!(forecast?.pressure_points?.length || forecast?.at_risk_windows?.length) && <p className="text-xs text-slate-500">No alerts generated yet.</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Clock3 className="w-4 h-4 text-blue-300" /><p className="text-sm font-semibold text-white">Audit Module</p></div>
            <HumanDataPanel data={data?.audit} emptyText="Audit data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Focus className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Deep Work Module</p></div>
            <HumanDataPanel data={data?.deepwork} emptyText="Deep-work data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">ROI Module</p></div>
            <HumanDataPanel data={data?.roi} emptyText="ROI data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
