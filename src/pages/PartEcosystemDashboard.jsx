import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Handshake, ShieldAlert, Network, BarChart3 } from "lucide-react";

export default function PartEcosystemDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["part_ecosystem_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("partPartnershipEngine", { action: "part_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const atRisk = data?.health?.at_risk || [];
  const topPotential = data?.health?.highest_potential || [];
  const conflicts = data?.conflict?.conflicts || [];
  const ecosystemMoves = data?.ecosystem?.ninety_day_moves || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("PartOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Part Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Part Ecosystem Dashboard</h1>
            <p className="text-sm text-slate-400">Executive partnership command view across health, conflicts, tiering, and ecosystem strategy.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">At Risk Partners</p><p className="text-2xl font-semibold text-rose-300">{atRisk.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Top Potential</p><p className="text-2xl font-semibold text-emerald-300">{topPotential.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Open Conflicts</p><p className="text-2xl font-semibold text-amber-300">{conflicts.length}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Conflict Queue</p></div>
            <div className="space-y-2">
              {conflicts.length === 0 && <p className="text-xs text-slate-500">No channel conflicts currently detected.</p>}
              {conflicts.map((item, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-xs text-rose-200">{item.conflict || `Conflict ${i + 1}`}</p>
                  <p className="text-[11px] text-rose-300/80 mt-1">{item.severity || "--"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Network className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">90-Day Ecosystem Moves</p></div>
            <div className="space-y-2">
              {ecosystemMoves.length === 0 && <p className="text-xs text-slate-500">No ecosystem moves generated yet.</p>}
              {ecosystemMoves.map((move, i) => (
                <div key={i} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{move}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Analytics Module</p></div>
            <HumanDataPanel data={data?.analytics} emptyText="Analytics data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Handshake className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Health Module</p></div>
            <HumanDataPanel data={data?.health} emptyText="Health data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Tiering/Ecosystem Module</p></div>
            <HumanDataPanel data={{ tiering: data?.tiering || {}, ecosystem: data?.ecosystem || {} }} emptyText="Tiering/ecosystem data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
