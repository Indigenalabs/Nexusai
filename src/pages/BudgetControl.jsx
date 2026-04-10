import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PiggyBank, Plus, DollarSign, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const CATEGORIES = ["marketing", "payroll", "rent", "utilities", "software", "travel", "meals", "office", "tax", "other"];

function BudgetBar({ budget }) {
  const pct = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 100 ? "text-red-400" : pct >= 80 ? "text-orange-400" : pct >= 60 ? "text-amber-400" : "text-emerald-400";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {pct >= 90 && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-sm font-medium text-white capitalize">{budget.category}</span>
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
          <span className="text-xs text-slate-500 ml-1">used</span>
        </div>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>${(budget.spent || 0).toLocaleString()} spent</span>
        <span>${budget.amount.toLocaleString()} budget</span>
      </div>
      {budget.period && <p className="text-[10px] text-slate-600 mt-1">{budget.period}</p>}
    </motion.div>
  );
}

export default function BudgetControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ category: "", amount: "", period: "monthly", spent: "" });
  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => base44.entities.Budget.list(),
    refetchInterval: 15000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions_recent"],
    queryFn: () => base44.entities.Transaction.list("-date", 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.create({
      ...data,
      amount: Number(data.amount),
      spent: Number(data.spent) || 0,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budgets"] }); setIsOpen(false); setForm({ category: "", amount: "", period: "monthly", spent: "" }); },
  });

  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const overBudget = budgets.filter(b => b.spent >= b.amount);
  const atRisk = budgets.filter(b => b.amount > 0 && (b.spent / b.amount) >= 0.8 && (b.spent / b.amount) < 1);

  const anomalies = transactions.filter(t => t.is_anomaly);
  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Budget Control</h1>
              <p className="text-sm text-slate-500">Centsible-powered budget management & spend analysis</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl("Centsible")}>
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Open Centsible
              </Button>
            </Link>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Budget
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[hsl(222,40%,10%)] border-white/[0.1] text-white">
                <DialogHeader><DialogTitle>Add Budget Category</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs text-slate-400">Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-400">Budget Amount ($)</Label>
                      <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" placeholder="10000" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Spent So Far ($)</Label>
                      <Input type="number" value={form.spent} onChange={e => setForm({ ...form, spent: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Period</Label>
                    <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["monthly", "quarterly", "annual"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => createMutation.mutate(form)} disabled={!form.category || !form.amount} className="w-full bg-emerald-600 hover:bg-emerald-700">Add Budget</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Budget", value: `$${totalBudget.toLocaleString()}`, color: "blue", icon: DollarSign },
            { label: "Total Spent", value: `$${totalSpent.toLocaleString()}`, color: "amber", icon: TrendingUp },
            { label: "Over Budget", value: overBudget.length, color: "red", icon: AlertTriangle },
            { label: "Anomalies", value: anomalies.length, color: "orange", icon: AlertTriangle },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`p-5 rounded-2xl bg-${k.color}-500/[0.07] border border-${k.color}-500/20`}>
              <div className={`p-2 rounded-lg bg-${k.color}-500/15 w-fit mb-3`}><k.icon className={`w-4 h-4 text-${k.color}-400`} /></div>
              <p className="text-xs text-slate-500 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold text-${k.color}-400`}>{k.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Alerts */}
        {(overBudget.length > 0 || atRisk.length > 0) && (
          <div className="mb-6 space-y-2">
            {overBudget.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-300 capitalize"><strong>{b.category}</strong> is over budget — ${(b.spent - b.amount).toLocaleString()} overspent</span>
              </div>
            ))}
            {atRisk.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-amber-300 capitalize"><strong>{b.category}</strong> at {((b.spent / b.amount) * 100).toFixed(0)}% — approaching limit</span>
              </div>
            ))}
          </div>
        )}

        {/* Budget Bars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {budgets.map(b => <BudgetBar key={b.id} budget={b} />)}
          {budgets.length === 0 && (
            <div className="col-span-3 text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <PiggyBank className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No budgets set — add categories to start tracking</p>
            </div>
          )}
        </div>

        {/* Agent Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentPanel
            agentName="centsible_agent"
            agentLabel="Centsible"
            agentEmoji="💰"
            accentColor="emerald"
            startMessage={`Review our budget data: ${budgets.length} budget categories, $${totalBudget.toLocaleString()} total budget, $${totalSpent.toLocaleString()} spent. ${overBudget.length} categories are over budget. ${anomalies.length} transaction anomalies flagged. Give me a full budget health assessment and the top 3 immediate actions.`}
            quickCommands={[
              { label: "Budget optimisation", text: "Analyse all budget categories. Which should I cut, where should I invest more, and what are the biggest savings opportunities?" },
              { label: "Anomaly investigation", text: `We have ${anomalies.length} flagged transaction anomalies. Investigate each one and tell me what action to take for every single one.` },
              { label: "Spend forecast", text: "Based on current spend rates, forecast our burn across all budget categories for the next 90 days. Flag any that will run out." },
              { label: "Vendor audit", text: "Audit our recurring vendor payments. Find subscriptions to cancel, vendors to renegotiate, and duplicates to eliminate." },
            ]}
          />
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage={`Scan our financial data for security threats. We have ${anomalies.length} transaction anomalies and ${budgets.length} budget categories. Run a financial fraud scan — look for round-number transactions, velocity anomalies, unusual vendors, and any patterns that could indicate fraud or financial abuse.`}
            quickCommands={[
              { label: "Fraud scan", text: "Run a full financial fraud scan across all transactions. Look for fraud patterns, duplicate payments, round-number anomalies, and unusual vendor transactions." },
              { label: "Budget manipulation check", text: "Are there any signs of budget manipulation or financial misconduct? Check for unusual budget-to-actual variances." },
              { label: "Vendor risk check", text: "Assess the risk profile of our top vendors. Any with unusual payment patterns or potential fraud signals?" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
