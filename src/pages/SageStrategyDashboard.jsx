import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { ArrowLeft, BarChart3, ShieldAlert, Sparkles, BriefcaseBusiness, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";

export default function SageStrategyDashboard() {
  const { data: fullTest, refetch, isFetching } = useQuery({
    queryKey: ["sage_strategy_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("sageBussinessStrategy", { action: "sage_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = fullTest?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const riskItems = fullTest?.risk?.risks || [];
  const directives = fullTest?.comms?.board_decisions_requested || [];
  const forecast = fullTest?.forecast || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("SageOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Sage Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Sage Strategy Dashboard</h1>
            <p className="text-sm text-slate-400">Executive strategy signal board across health, forecast, risk, and board narrative.</p>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Conservative 12M</p><p className="text-xl font-semibold text-cyan-300">{forecast.conservative_12m ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Optimistic 12M</p><p className="text-xl font-semibold text-emerald-300">{forecast.optimistic_12m ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Breakthrough 12M</p><p className="text-xl font-semibold text-amber-300">{forecast.breakthrough_12m ?? "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Top Strategic Risks</p></div>
            <div className="space-y-2 max-h-96 overflow-auto pr-1">
              {riskItems.length === 0 && <p className="text-xs text-slate-500">No risk register data yet.</p>}
              {riskItems.slice(0, 8).map((risk, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-white">{risk.risk || `Risk ${i + 1}`}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{risk.domain} | {risk.likelihood} | {risk.impact}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{Array.isArray(risk.mitigation) ? risk.mitigation[0] : "No mitigation provided"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><BriefcaseBusiness className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Board Decision Queue</p></div>
            <div className="space-y-2">
              {directives.length === 0 && <p className="text-xs text-slate-500">No board decisions queued yet.</p>}
              {directives.map((decision, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-xs text-slate-200">{decision}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Health Module</p></div>
            <HumanDataPanel data={fullTest?.health} emptyText="Health data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Forecast Module</p></div>
            <HumanDataPanel data={fullTest?.forecast} emptyText="Forecast data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Roadmap Module</p></div>
            <HumanDataPanel data={fullTest?.roadmap} emptyText="Roadmap data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
