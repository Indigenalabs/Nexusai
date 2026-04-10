import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Shield, AlertTriangle, Radar, Lock } from "lucide-react";

export default function SentinelThreatDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["sentinel_threat_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("sentinelSecurityMonitoring", { action: "sentinel_full_self_test" });
      return res.data || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const threatLevel = data?.posture?.threat_level || data?.posture?.result?.threat_level || "--";
  const securityScore = data?.posture?.security_score || data?.posture?.result?.security_score || "--";
  const risks = data?.posture?.top_5_risks || data?.posture?.result?.top_5_risks || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("SentinelOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Sentinel Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Sentinel Threat Dashboard</h1>
            <p className="text-sm text-slate-400">Executive threat board across posture, intel fusion, incident response readiness, and data protection controls.</p>
          </div>
          <Button className="bg-red-600 hover:bg-red-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Security Score</p><p className="text-2xl font-semibold text-cyan-300">{securityScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Threat Level</p><p className="text-2xl font-semibold text-amber-300">{threatLevel}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Top Risks</p><p className="text-2xl font-semibold text-rose-300">{risks.length}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Top Risk Queue</p></div>
            <div className="space-y-2">
              {risks.length === 0 && <p className="text-xs text-slate-500">No risk queue generated yet.</p>}
              {risks.map((risk, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{risk}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Radar className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Readiness Signals</p></div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">Intel Fusion: {data?.checks?.intel_fusion_ok ? "Operational" : "Missing"}</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">Incident Response: {data?.checks?.incident_response_ok ? "Operational" : "Missing"}</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">Insider Watch: {data?.checks?.insider_watch_ok ? "Operational" : "Missing"}</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">Data Protection Plane: {data?.checks?.data_plane_ok ? "Operational" : "Missing"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Posture Module</p></div>
            <HumanDataPanel data={data?.posture} emptyText="Posture data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Radar className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Threat Fusion Module</p></div>
            <HumanDataPanel data={data?.intelFusion} emptyText="Threat fusion data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Data/Identity Module</p></div>
            <HumanDataPanel data={{ insiderWatch: data?.insiderWatch || {}, dataPlane: data?.dataPlane || {} }} emptyText="Data/identity data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
