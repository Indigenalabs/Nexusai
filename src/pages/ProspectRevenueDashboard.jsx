import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Target, AlertTriangle, BarChart3 } from "lucide-react";

function MetricCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

export default function ProspectRevenueDashboard() {
  const health = useQuery({
    queryKey: ["prospect_dashboard_health"],
    queryFn: async () => (await base44.functions.invoke("prospectLeadGeneration", { action: "prospect_health_snapshot" })).data?.result || {},
    staleTime: 60000,
  });

  const analytics = useQuery({
    queryKey: ["prospect_dashboard_pipeline"],
    queryFn: async () => (await base44.functions.invoke("prospectLeadGeneration", { action: "pipeline_analytics" })).data?.result || {},
    staleTime: 60000,
  });

  const history = useQuery({
    queryKey: ["prospect_dashboard_history"],
    queryFn: async () => (await base44.functions.invoke("prospectLeadGeneration", { action: "prospect_run_history" })).data?.history || [],
    staleTime: 30000,
  });

  const loading = health.isLoading || analytics.isLoading || history.isLoading;
  const refresh = () => {
    health.refetch();
    analytics.refetch();
    history.refetch();
  };

  const leadHealth = health.data?.lead_health || {};
  const byStatus = health.data?.by_status || {};
  const pipeline = analytics.data || {};
  const risks = health.data?.risk_signals || pipeline?.risk_signals || [];

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to={createPageUrl("ProspectOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Prospect Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Prospect Revenue Dashboard</h1>
            <p className="text-sm text-slate-400">Pipeline quality, conversion velocity, and sales orchestration risk posture.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-slate-200" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-500" asChild>
              <Link to={createPageUrl("ProspectOpsHub")}>Open Ops Hub</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard title="Lead Health Score" value={health.data?.health_score ?? "--"} hint="Unified lead-quality score" />
          <MetricCard title="Total Leads" value={leadHealth.total ?? "--"} hint="Current pipeline volume" />
          <MetricCard title="Hot Leads" value={leadHealth.hot ?? "--"} hint="Immediate follow-up demand" />
          <MetricCard title="Conversion Rate" value={health.data?.conversion_rate ? `${health.data.conversion_rate}%` : "--"} hint="Pipeline-to-conversion performance" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-blue-300" />
              <p className="text-sm font-semibold text-white">Pipeline Snapshot</p>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>New: {byStatus.new ?? "--"}</p>
              <p>Qualified: {byStatus.qualified ?? "--"}</p>
              <p>Nurturing: {byStatus.nurturing ?? "--"}</p>
              <p>Proposal: {byStatus.proposal ?? "--"}</p>
              <p>Converted: {byStatus.converted ?? "--"}</p>
              <p>Projected Revenue: {pipeline.projected_revenue ?? "--"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <p className="text-sm font-semibold text-white">Risk & Intervention Queue</p>
            </div>
            <div className="space-y-2">
              {risks.length === 0 && <p className="text-xs text-slate-500">No major pipeline risks detected.</p>}
              {risks.slice(0, 8).map((risk, i) => (
                <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {typeof risk === "string" ? risk : (risk?.message || risk?.title || "Pipeline risk signal")}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-cyan-300" />
            <p className="text-sm font-semibold text-white">Recent Ops Timeline</p>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {(history.data || []).length === 0 && <p className="text-xs text-slate-500">No recent prospect ops records.</p>}
            {(history.data || []).slice(0, 20).map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-white">{item.title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{item.created_date ? new Date(item.created_date).toLocaleString() : ""}</p>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{String(item.description || "").replace("[prospect_ops]", "").trim()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
