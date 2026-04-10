import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Megaphone, AlertTriangle, BarChart3 } from "lucide-react";

function MetricCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

export default function MaestroPerformanceDashboard() {
  const health = useQuery({
    queryKey: ["maestro_dashboard_health"],
    queryFn: async () => (await base44.functions.invoke("maestroSocialOps", { action: "unified_social_health" })).data?.result || {},
    staleTime: 60000,
  });

  const history = useQuery({
    queryKey: ["maestro_dashboard_history"],
    queryFn: async () => (await base44.functions.invoke("maestroSocialOps", { action: "run_history" })).data?.history || [],
    staleTime: 30000,
  });

  const selfTest = useQuery({
    queryKey: ["maestro_dashboard_self_test"],
    queryFn: async () => (await base44.functions.invoke("maestroSocialOps", { action: "full_ops_self_test" })).data?.result || {},
    staleTime: 60000,
  });

  const loading = health.isLoading || history.isLoading || selfTest.isLoading;
  const refresh = () => {
    health.refetch();
    history.refetch();
    selfTest.refetch();
  };

  const alerts = health.data?.alerts || [];
  const posts = health.data?.posts || {};
  const community = health.data?.community || {};
  const trends = health.data?.trends || {};

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to={createPageUrl("MaestroOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Maestro Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Maestro Performance Dashboard</h1>
            <p className="text-sm text-slate-400">Executive marketing operations, content execution, and social signal posture.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-slate-200" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-500" asChild>
              <Link to={createPageUrl("MaestroOpsHub")}>Open Ops Hub</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard title="Ops Self-Test" value={`${selfTest.data?.passed ?? "--"}/${(selfTest.data?.passed ?? 0) + (selfTest.data?.failed ?? 0) || "--"}`} hint="Operational checks passing" />
          <MetricCard title="Scheduled Posts" value={posts.scheduled ?? "--"} hint="Queued publishing volume" />
          <MetricCard title="Unread Community" value={community.unread ?? "--"} hint="Messages awaiting response" />
          <MetricCard title="Trend Momentum" value={trends.momentum || "--"} hint="External trend velocity signal" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-violet-300" />
              <p className="text-sm font-semibold text-white">Ops Snapshot</p>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Published (7d): {posts.published_last_7d ?? "--"}</p>
              <p>Failed Posts: {posts.failed ?? "--"}</p>
              <p>Response SLA (mins): {community.response_sla_mins ?? "--"}</p>
              <p>Negative Mentions: {community.negative_mentions ?? "--"}</p>
              <p>Trend Opportunities: {trends.opportunities ?? "--"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <p className="text-sm font-semibold text-white">Alerts & Priorities</p>
            </div>
            <div className="space-y-2">
              {alerts.length === 0 && <p className="text-xs text-slate-500">No critical alerts reported.</p>}
              {alerts.slice(0, 8).map((a, i) => (
                <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <p className="font-semibold">{a.title || "Operational alert"}</p>
                  <p className="mt-1 text-amber-100/90">{a.action || "No action provided."}</p>
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
            {(history.data || []).length === 0 && <p className="text-xs text-slate-500">No recent ops records.</p>}
            {(history.data || []).slice(0, 20).map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-white">{item.title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{item.created_date ? new Date(item.created_date).toLocaleString() : ""}</p>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{String(item.description || "").replace("[maestro_ops]", "").trim()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
