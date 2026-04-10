import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, RefreshCw, BarChart3, AlertTriangle, DollarSign } from "lucide-react";

function Card({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

export default function CentsibleCFODashboard() {
  const health = useQuery({ queryKey: ["cfo_health"], queryFn: async () => (await base44.functions.invoke("centsibleFinanceEngine", { action: "financial_health_check" })).data?.result || {}, staleTime: 60000 });
  const cash = useQuery({ queryKey: ["cfo_cash"], queryFn: async () => (await base44.functions.invoke("centsibleFinanceEngine", { action: "forecast_cash_flow", months: 6 })).data?.result || {}, staleTime: 60000 });
  const risk = useQuery({ queryKey: ["cfo_risk"], queryFn: async () => (await base44.functions.invoke("centsibleFinanceEngine", { action: "anomaly_detection" })).data?.result || {}, staleTime: 60000 });
  const leak = useQuery({ queryKey: ["cfo_leak"], queryFn: async () => (await base44.functions.invoke("centsibleFinanceEngine", { action: "revenue_leakage_scan" })).data?.result || {}, staleTime: 60000 });

  const loading = health.isLoading || cash.isLoading || risk.isLoading || leak.isLoading;
  const refresh = () => { health.refetch(); cash.refetch(); risk.refetch(); leak.refetch(); };

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to={createPageUrl("CentsibleOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Centsible Ops</Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">CFO Dashboard</h1>
            <p className="text-sm text-slate-400">Executive financial intelligence: liquidity, risk, leakage, and strategic action signals.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-slate-200" onClick={refresh} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-500" asChild><Link to={createPageUrl("CentsibleOpsHub")}>Open Ops Hub</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card title="Health Score" value={health.data?.health_score ?? "--"} hint={health.data?.grade ? `Grade ${health.data.grade}` : "Financial grade pending"} />
          <Card title="Runway (Months)" value={cash.data?.runway_months ?? "--"} hint="Projected cash runway" />
          <Card title="Fraud Risk" value={risk.data?.fraud_risk_score ?? "--"} hint="Anomaly engine risk score" />
          <Card title="Leakage ($)" value={leak.data?.estimated_leakage_amount ?? "--"} hint="Estimated revenue leakage" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Cash & Finance Summary</p></div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Revenue: {health.data?.revenue ?? "--"}</p>
              <p>Expenses: {health.data?.expenses ?? "--"}</p>
              <p>Net Profit: {health.data?.net_profit ?? "--"}</p>
              <p>Cash Flow Status: {health.data?.cash_flow_status || "pending"}</p>
              <p>Lowest Cash Point: {cash.data?.lowest_point_date || "pending"} / {cash.data?.lowest_point_amount ?? "--"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Risk & Leakage Signals</p></div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Anomalies Found: {risk.data?.anomalies_found ?? "--"}</p>
              <p>High-Risk Items: {(risk.data?.high_risk_items || []).length}</p>
              <p>Leakage Cases: {(leak.data?.leakage_cases || []).length}</p>
            </div>
            <div className="mt-3 space-y-1">
              {(leak.data?.fix_plan || []).slice(0, 5).map((item, i) => <p key={i} className="text-xs text-slate-300">- {item}</p>)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Snapshot</p></div>
          <HumanDataPanel data={{ health: health.data || {}, cash: cash.data || {}, risk: risk.data || {}, leakage: leak.data || {} }} emptyText="Snapshot not available yet." />
        </div>
      </div>
    </div>
  );
}
