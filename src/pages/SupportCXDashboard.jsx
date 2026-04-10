import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, RefreshCw, Activity, Smile, AlertTriangle, BarChart3, Users, Bot } from "lucide-react";

function MetricCard({ title, value, hint, tone = "slate" }) {
  const toneMap = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    cyan: "text-cyan-300",
    slate: "text-slate-200",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className={`text-2xl font-semibold mt-1 ${toneMap[tone] || toneMap.slate}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

export default function SupportCXDashboard() {
  const kpi = useQuery({
    queryKey: ["support_cx_kpi"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "support_kpi_command_center" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const analytics = useQuery({
    queryKey: ["support_cx_analytics"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "support_analytics" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const sentiment = useQuery({
    queryKey: ["support_cx_sentiment"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "sentiment_analysis" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const csat = useQuery({
    queryKey: ["support_cx_csat"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "csat_analysis" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const churn = useQuery({
    queryKey: ["support_cx_churn"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "churn_risk" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const loading = kpi.isLoading || analytics.isLoading || sentiment.isLoading || csat.isLoading || churn.isLoading;

  const refreshAll = () => {
    kpi.refetch();
    analytics.refetch();
    sentiment.refetch();
    csat.refetch();
    churn.refetch();
  };

  const healthScore = kpi.data?.kpi_snapshot?.health_score ?? analytics.data?.health_score ?? "--";
  const csatScore = csat.data?.csat_score ?? "--";
  const nps = csat.data?.nps_estimate ?? "--";
  const churnRisk = churn.data?.overall_churn_risk_score ?? "--";
  const sentimentScore = sentiment.data?.overall_sentiment_score ?? "--";
  const deflection = analytics.data?.ai_deflection_rate ?? "--";

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link to={createPageUrl("SupportSageOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Support Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Unified CX Dashboard</h1>
            <p className="text-sm text-slate-400">Real-time customer experience intelligence across support quality, sentiment, churn risk, and operational health.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-slate-200" onClick={refreshAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-500" asChild>
              <Link to={createPageUrl("SupportSageOpsHub")}>Open Ops Hub</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <MetricCard title="CX Health" value={healthScore} hint="Composite support health score" tone="cyan" />
          <MetricCard title="CSAT" value={csatScore} hint="Estimated satisfaction score" tone="emerald" />
          <MetricCard title="NPS" value={nps} hint="Estimated promoter score" tone="cyan" />
          <MetricCard title="Sentiment" value={sentimentScore} hint={sentiment.data?.trend || "Trend pending"} tone="amber" />
          <MetricCard title="Churn Risk" value={churnRisk} hint="Higher means higher risk" tone="rose" />
          <MetricCard title="AI Deflection" value={deflection} hint="Estimated AI resolution share" tone="emerald" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">KPI Signals</p></div>
            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Volume trend:</span> {analytics.data?.volume_trend || "pending"}</p>
              <p><span className="text-slate-500">Priority signals:</span> {analytics.data?.priority_signals || "pending"}</p>
              <p><span className="text-slate-500">Forecast risk:</span> {kpi.data?.forecast_risk || "pending"}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(kpi.data?.executive_actions || []).slice(0, 4).map((item, i) => (
                <Badge key={i} variant="outline" className="border-white/20 text-slate-300">{String(item)}</Badge>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><Smile className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Sentiment & Experience</p></div>
            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Trend:</span> {sentiment.data?.trend || "pending"}</p>
              <p><span className="text-slate-500">Churn estimate:</span> {sentiment.data?.churn_risk_estimate || "pending"}</p>
            </div>
            <div className="mt-3 space-y-1">
              {(sentiment.data?.recommended_actions || []).slice(0, 4).map((a, i) => (
                <p key={i} className="text-xs text-slate-300">- {a}</p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-fuchsia-300" /><p className="text-sm font-semibold text-white">At-Risk Customers</p></div>
            <div className="space-y-2">
              {(churn.data?.at_risk_customers || []).slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-xs text-white">{c.customer || "Unknown"}</p>
                  <p className="text-[11px] text-slate-400">{c.risk_level || "risk"} - {c.reasoning || "no reasoning"}</p>
                </div>
              ))}
              {(!(churn.data?.at_risk_customers || []).length) && <p className="text-xs text-slate-500">No at-risk customers returned.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Action Center</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start border-white/15 text-slate-300" asChild><Link to={createPageUrl("SupportSageOpsHub")}>Run Crisis Command</Link></Button>
              <Button variant="outline" className="justify-start border-white/15 text-slate-300" asChild><Link to={createPageUrl("SupportSageOpsHub")}>Run PII Guard</Link></Button>
              <Button variant="outline" className="justify-start border-white/15 text-slate-300" asChild><Link to={createPageUrl("SupportSageOpsHub")}>Run Revenue Command</Link></Button>
              <Button variant="outline" className="justify-start border-white/15 text-slate-300" asChild><Link to={createPageUrl("SupportSage")}>Open Support Chat</Link></Button>
            </div>
            <div className="mt-3 text-xs text-slate-500 inline-flex items-center gap-2">
              <Bot className="w-3.5 h-3.5" />Use Support Ops Hub for execution; this page is read/briefing optimized.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Snapshot</p></div>
          <HumanDataPanel
            data={{
              kpi: kpi.data || {},
              analytics: analytics.data || {},
              sentiment: sentiment.data || {},
              csat: csat.data || {},
              churn: churn.data || {},
            }}
            emptyText="Snapshot not available yet."
          />
        </div>
      </div>
    </div>
  );
}
