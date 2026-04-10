import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DollarSign, ArrowLeft, TrendingUp, TrendingDown, Plus, Wallet, Loader2, Brain, Sparkles, CreditCard
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "hsl(222, 42%, 8%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: 12 }
};

const EMPTY_SNAPSHOT = { date: format(new Date(), "yyyy-MM-dd"), revenue: "", expenses: "", profit: "", cash_balance: "", accounts_receivable: "", accounts_payable: "", runway_days: "", burn_rate: "" };

export default function FinancialHub() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_SNAPSHOT);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: snapshots = [] } = useQuery({
    queryKey: ["financialSnapshots"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 12),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const processed = { ...data };
      ["revenue", "expenses", "profit", "cash_balance", "accounts_receivable", "accounts_payable", "runway_days", "burn_rate"].forEach(k => {
        if (processed[k] !== "") processed[k] = Number(processed[k]);
      });
      if (!processed.profit && processed.revenue && processed.expenses) {
        processed.profit = processed.revenue - processed.expenses;
      }
      const healthScore = Math.min(100, Math.max(0, 
        (processed.profit > 0 ? 40 : 0) + 
        (processed.runway_days > 90 ? 30 : processed.runway_days > 30 ? 15 : 0) +
        ((processed.revenue - processed.expenses) / (processed.revenue || 1)) * 30
      ));
      processed.health_score = Math.round(healthScore);
      return base44.entities.FinancialSnapshot.create(processed);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["financialSnapshots"] }); setIsAddOpen(false); setFormData(EMPTY_SNAPSHOT); },
  });

  const latest = snapshots[0];
  const previous = snapshots[1];

  const chartData = snapshots.slice().reverse().map(s => ({
    date: s.date ? format(new Date(s.date), "MMM d") : "",
    revenue: s.revenue || 0,
    expenses: s.expenses || 0,
    profit: s.profit || 0,
    cash: s.cash_balance || 0,
  }));

  const pct = (a, b) => b ? (((a - b) / b) * 100).toFixed(1) : 0;

  const handleAIAnalysis = async () => {
    if (!latest) return;
    setAiLoading(true);
    const insight = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this financial snapshot and provide a brief CFO-level insight (3-4 sentences):
      Revenue: $${latest.revenue?.toLocaleString()}, Expenses: $${latest.expenses?.toLocaleString()}, Profit: $${latest.profit?.toLocaleString()}, 
      Cash Balance: $${latest.cash_balance?.toLocaleString()}, AR: $${latest.accounts_receivable?.toLocaleString()}, AP: $${latest.accounts_payable?.toLocaleString()},
      Runway: ${latest.runway_days} days, Burn Rate: $${latest.burn_rate?.toLocaleString()}/mo, Health Score: ${latest.health_score}/100.
      Focus on cash health, profitability, and one specific recommendation.`,
    });
    setAiInsight(insight);
    setAiLoading(false);
  };

  const kpis = latest ? [
    { label: "Revenue", value: `$${(latest.revenue || 0).toLocaleString()}`, change: previous ? pct(latest.revenue, previous.revenue) : null, icon: DollarSign, color: "emerald" },
    { label: "Expenses", value: `$${(latest.expenses || 0).toLocaleString()}`, change: previous ? pct(latest.expenses, previous.expenses) : null, icon: CreditCard, color: "red", invert: true },
    { label: "Net Profit", value: `$${(latest.profit || 0).toLocaleString()}`, change: previous ? pct(latest.profit, previous.profit) : null, icon: TrendingUp, color: "blue" },
    { label: "Cash Balance", value: `$${(latest.cash_balance || 0).toLocaleString()}`, change: previous ? pct(latest.cash_balance, previous.cash_balance) : null, icon: Wallet, color: "amber" },
  ] : [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Financial Hub</h1>
              <p className="text-sm text-slate-500">Track revenue, expenses & cash flow</p>
            </div>
          </div>
          <div className="flex gap-2">
            {latest && (
              <Button onClick={handleAIAnalysis} disabled={aiLoading} variant="outline" className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />} AI Analysis
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500">
                  <Plus className="w-4 h-4 mr-2" /> Add Snapshot
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white max-w-lg">
                <DialogHeader><DialogTitle>Add Financial Snapshot</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div>
                    <Label className="text-xs text-slate-400">Date</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" />
                  </div>
                  {[
                    ["revenue", "Revenue ($)"], ["expenses", "Expenses ($)"], ["profit", "Profit (auto-calc if blank)"],
                    ["cash_balance", "Cash Balance ($)"], ["accounts_receivable", "Accounts Receivable ($)"],
                    ["accounts_payable", "Accounts Payable ($)"], ["runway_days", "Runway (days)"], ["burn_rate", "Monthly Burn Rate ($)"],
                  ].map(([field, label]) => (
                    <div key={field}>
                      <Label className="text-xs text-slate-400">{label}</Label>
                      <Input type="number" value={formData[field]} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} placeholder="0" className="bg-white/[0.04] border-white/[0.08] text-white mt-1" />
                    </div>
                  ))}
                  <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Snapshot"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* AI Insight */}
        {aiInsight && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">{aiInsight}</p>
          </motion.div>
        )}

        {/* Health Score Banner */}
        {latest?.health_score !== undefined && (
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={latest.health_score >= 70 ? "#10b981" : latest.health_score >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3" strokeDasharray={`${latest.health_score} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{latest.health_score}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Financial Health Score</p>
              <p className="text-xs text-slate-400">
                {latest.health_score >= 70 ? "Strong financial position" : latest.health_score >= 40 ? "Moderate — some areas need attention" : "Critical — immediate action required"}
              </p>
            </div>
            {latest.runway_days && (
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Cash Runway</p>
                <p className={`text-lg font-bold ${latest.runway_days > 90 ? "text-emerald-400" : latest.runway_days > 30 ? "text-amber-400" : "text-red-400"}`}>{latest.runway_days} days</p>
              </div>
            )}
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi, i) => {
              const positive = kpi.invert ? Number(kpi.change) < 0 : Number(kpi.change) > 0;
              return (
                <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-${kpi.color}-500/15`}><kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} /></div>
                    {kpi.change !== null && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
                        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(kpi.change)}%
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        {chartData.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={v => [`$${v.toLocaleString()}`, ""]} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Net Profit Trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={v => [`$${v.toLocaleString()}`, "Profit"]} />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Snapshot History Table */}
        {snapshots.length > 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">Snapshot History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Date", "Revenue", "Expenses", "Profit", "Cash", "AR", "Runway", "Health"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(s => (
                    <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-400">{s.date}</td>
                      <td className="px-4 py-3 text-emerald-400">${(s.revenue || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-400">${(s.expenses || 0).toLocaleString()}</td>
                      <td className={`px-4 py-3 font-medium ${(s.profit || 0) >= 0 ? "text-blue-400" : "text-red-400"}`}>${(s.profit || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-white">${(s.cash_balance || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-400">${(s.accounts_receivable || 0).toLocaleString()}</td>
                      <td className={`px-4 py-3 font-medium ${(s.runway_days || 0) > 90 ? "text-emerald-400" : (s.runway_days || 0) > 30 ? "text-amber-400" : "text-red-400"}`}>{s.runway_days || "-"}d</td>
                      <td className="px-4 py-3">
                        {s.health_score !== undefined && (
                          <span className={`font-bold ${s.health_score >= 70 ? "text-emerald-400" : s.health_score >= 40 ? "text-amber-400" : "text-red-400"}`}>{s.health_score}/100</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {snapshots.length === 0 && (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <DollarSign className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No financial data yet</h3>
            <p className="text-sm text-slate-500">Add your first snapshot to start tracking</p>
          </div>
        )}

        {/* Agent Panels */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentPanel
            agentName="centsible_agent"
            agentLabel="Centsible"
            agentEmoji="💰"
            accentColor="emerald"
            startMessage={latest ? `Review our latest financial snapshot: Revenue $${latest.revenue?.toLocaleString()}, Expenses $${latest.expenses?.toLocaleString()}, Cash Balance $${latest.cash_balance?.toLocaleString()}, Runway ${latest.runway_days} days, Health Score ${latest.health_score}/100. Give me your financial watchdog assessment — what's the most important thing I need to act on right now?` : "We don't have any financial data yet. What should I track to get started?"}
            quickCommands={[
              { label: "Cash flow analysis", text: "Analyze our cash flow position. Are we at risk? What's our runway?" },
              { label: "Spot anomalies", text: "Look at our financial data and flag any anomalies or unusual patterns." },
              { label: "Budget recommendations", text: "Based on our financials, where should I cut or invest more?" },
              { label: "Forecast next 90 days", text: "Forecast our financial position for the next 90 days based on current trends." },
              { label: "KPI dashboard", text: "Build my executive KPI dashboard with all financial ratios, health score, and traffic light status for each metric." },
              { label: "Tax preparation", text: "Prepare my tax summary with GST, BAS, taxable income, and ATO compliance checklist." },
            ]}
          />
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage={latest ? `Run a financial security scan on our latest data: Revenue $${latest.revenue?.toLocaleString()}, Expenses $${latest.expenses?.toLocaleString()}, Cash $${latest.cash_balance?.toLocaleString()}. Scan for financial fraud, anomalies, suspicious patterns, and any financial risks that need immediate attention.` : "Run a financial threat scan. Check for fraud patterns, anomalies, and financial security risks."}
            quickCommands={[
              { label: "Financial fraud scan", text: "Scan our financial data for fraud indicators — unusual transactions, round-number patterns, velocity anomalies, duplicate payments, and suspicious vendors." },
              { label: "Financial risk assessment", text: "Assess the financial security risks across our P&L. What financial controls are missing? What are the regulatory compliance risks?" },
              { label: "Data integrity check", text: "Check the integrity of our financial records. Are there gaps, inconsistencies, or missing data that could indicate tampering or error?" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}