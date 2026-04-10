import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Radar, ShieldAlert, Network, Sparkles } from "lucide-react";

export default function CompassIntelDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["compass_intel_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("compassMarketIntelligence", { action: "compass_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const criticalAlerts = data?.warning?.critical_alerts || [];
  const opportunities = data?.briefing?.opportunities || [];
  const hypotheses = data?.fusion?.hypotheses_to_test || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("CompassOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Compass Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Compass Intelligence Dashboard</h1>
            <p className="text-sm text-slate-400">Executive early-warning board across competitor pressure, trend velocity, and fused intelligence hypotheses.</p>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Alerts</p><p className="text-2xl font-semibold text-rose-300">{criticalAlerts.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Market Opportunities</p><p className="text-2xl font-semibold text-emerald-300">{opportunities.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Fusion Hypotheses</p><p className="text-2xl font-semibold text-cyan-300">{hypotheses.length}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Critical Early Warnings</p></div>
            <div className="space-y-2">
              {criticalAlerts.length === 0 && <p className="text-xs text-slate-500">No critical alerts surfaced.</p>}
              {criticalAlerts.map((alert, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-xs text-rose-200">{alert.alert || `Alert ${i + 1}`}</p>
                  <p className="text-[11px] text-rose-300/80 mt-1">{alert.horizon || "--"} | {alert.owner_agent || "unassigned"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Radar className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Top Opportunities</p></div>
            <div className="space-y-2">
              {opportunities.length === 0 && <p className="text-xs text-slate-500">No opportunities generated yet.</p>}
              {opportunities.map((item, i) => (
                <div key={i} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-200">{item.opportunity || `Opportunity ${i + 1}`}</p>
                  <p className="text-[11px] text-emerald-300/80 mt-1">{item.potential || "impact pending"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Briefing Module</p></div>
            <HumanDataPanel data={data?.briefing} emptyText="Briefing data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Warning Module</p></div>
            <HumanDataPanel data={data?.warning} emptyText="Warning data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Fusion Module</p></div>
            <HumanDataPanel data={data?.fusion} emptyText="Fusion data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
