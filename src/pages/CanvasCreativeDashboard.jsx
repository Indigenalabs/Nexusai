import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Palette, Sparkles, Film, BarChart3 } from "lucide-react";

export default function CanvasCreativeDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["canvas_creative_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("canvasCreativeGeneration", { action: "canvas_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const operations = data?.operations || {};
  const strategy = data?.strategy || {};
  const governance = data?.governance || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("CanvasOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Canvas Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Canvas Creative Dashboard</h1>
            <p className="text-sm text-slate-400">Executive creative health across asset readiness, campaign coverage, and brand governance posture.</p>
          </div>
          <Button className="bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Total Assets</p><p className="text-2xl font-semibold text-fuchsia-300">{operations?.total_assets ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Active Campaigns</p><p className="text-2xl font-semibold text-cyan-300">{operations?.active_campaigns ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Covered Campaigns</p><p className="text-2xl font-semibold text-emerald-300">{operations?.covered_campaigns ?? "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-fuchsia-300" /><p className="text-sm font-semibold text-white">Next 7 Days Priorities</p></div>
            <div className="space-y-2">
              {(strategy?.next_7_day_priorities || []).length === 0 && <p className="text-xs text-slate-500">No strategy priorities generated yet.</p>}
              {(strategy?.next_7_day_priorities || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-200">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Palette className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Governance Posture</p></div>
            <div className="space-y-2">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">Brand guardrail status: {governance?.brand_guardrail_status || "unknown"}</div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Recommended audit frequency: {governance?.recommended_audit_frequency || "weekly"}</div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">Image pipeline assets: {operations?.image_assets ?? "--"} | Template assets: {operations?.template_assets ?? "--"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Checks</p></div>
            <HumanDataPanel data={checks} emptyText="Checks not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Palette className="w-4 h-4 text-fuchsia-300" /><p className="text-sm font-semibold text-white">Operations Module</p></div>
            <HumanDataPanel data={operations} emptyText="Operations data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Film className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Strategy/Governance</p></div>
            <HumanDataPanel data={{ strategy, governance }} emptyText="Strategy/governance data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
