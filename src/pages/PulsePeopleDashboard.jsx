import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Heart, Users, ShieldCheck, Activity } from "lucide-react";

export default function PulsePeopleDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["pulse_people_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("pulseHREngine", { action: "pulse_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const people = data?.people || {};
  const attrition = data?.attrition || {};
  const burnout = data?.burnout || {};
  const culture = data?.culture || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("PulseOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Pulse Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Pulse People Dashboard</h1>
            <p className="text-sm text-slate-400">Executive people intelligence across workforce health, attrition pressure, wellbeing signals, and compliance posture.</p>
          </div>
          <Button className="bg-pink-600 hover:bg-pink-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Engagement</p><p className="text-2xl font-semibold text-cyan-300">{people?.engagement_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Wellbeing</p><p className="text-2xl font-semibold text-emerald-300">{people?.wellbeing_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Retention Health</p><p className="text-2xl font-semibold text-amber-300">{people?.retention_health_score ?? "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Attrition & Burnout Alerts</p></div>
            <div className="space-y-2">
              {(attrition?.high_risk || []).length === 0 && <p className="text-xs text-slate-500">No high-risk attrition alerts right now.</p>}
              {(attrition?.high_risk || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {item.name || "Team member"}: {item.primary_risk_factor || item.signal || "Risk signal detected"}
                </div>
              ))}
              {(burnout?.priority_actions || []).slice(0, 3).map((item, i) => (
                <div key={`b-${i}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {item.person || "Team"}: {item.action || "Targeted intervention required"}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Heart className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Culture + Manager Signals</p></div>
            <div className="space-y-2">
              {(culture?.risk_areas || []).length === 0 && <p className="text-xs text-slate-500">No major culture risks surfaced.</p>}
              {(culture?.risk_areas || []).map((risk, i) => (
                <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">{risk}</div>
              ))}
              {(data?.managerCoach?.priority_manager_actions || []).slice(0, 2).map((x, i) => (
                <div key={`m-${i}`} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{x}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">People Module</p></div>
            <HumanDataPanel data={people} emptyText="People data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Forecast Module</p></div>
            <HumanDataPanel data={data?.forecast} emptyText="Forecast data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Governance Module</p></div>
            <HumanDataPanel data={data?.compliance} emptyText="Governance data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
