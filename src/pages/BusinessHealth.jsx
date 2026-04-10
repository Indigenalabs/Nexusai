import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, ArrowLeft, DollarSign, TrendingUp, 
  AlertTriangle, Calendar, Clock, Droplet
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockFinancialData = [
  { date: "Jan 20", revenue: 38000, expenses: 18000, profit: 20000, cash: 85000 },
  { date: "Jan 27", revenue: 42000, expenses: 19500, profit: 22500, cash: 87500 },
  { date: "Feb 3", revenue: 45000, expenses: 21000, profit: 24000, cash: 91500 },
  { date: "Feb 10", revenue: 48000, expenses: 20500, profit: 27500, cash: 99000 },
  { date: "Feb 17", revenue: 51000, expenses: 22000, profit: 29000, cash: 108000 },
  { date: "Feb 24", revenue: 54000, expenses: 23500, profit: 30500, cash: 118500 },
];

export default function BusinessHealth() {
  const { data: snapshots = [] } = useQuery({
    queryKey: ["financialSnapshots"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 30),
  });

  const latestSnapshot = snapshots[0] || {
    revenue: 54000,
    expenses: 23500,
    profit: 30500,
    cash_balance: 118500,
    accounts_receivable: 42000,
    accounts_payable: 18500,
    runway_days: 156,
    burn_rate: 3200,
    health_score: 87
  };

  const healthColor = latestSnapshot.health_score >= 80 ? "emerald" : latestSnapshot.health_score >= 60 ? "amber" : "red";

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-8">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Heart className="w-5 h-5 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Business Health</h1>
            <p className="text-sm text-slate-500">Real-time financial vitals and predictions</p>
          </div>
        </div>

        {/* Health Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-1">Overall Health Score</h2>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold text-${healthColor}-400`}>{latestSnapshot.health_score}</span>
                <span className="text-xl text-slate-500">/100</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Heart className={`w-12 h-12 text-${healthColor}-400 animate-pulse-glow`} />
            </div>
          </div>
          <Badge className={`bg-${healthColor}-500/20 text-${healthColor}-400`}>
            {latestSnapshot.health_score >= 80 ? "Excellent" : latestSnapshot.health_score >= 60 ? "Good" : "Needs Attention"}
          </Badge>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { 
              label: "Cash Balance", 
              value: `$${latestSnapshot.cash_balance.toLocaleString()}`, 
              icon: DollarSign, 
              color: "blue",
              change: "+12.5%"
            },
            { 
              label: "Monthly Burn Rate", 
              value: `$${latestSnapshot.burn_rate.toLocaleString()}`, 
              icon: Droplet, 
              color: "violet",
              change: "-5.2%"
            },
            { 
              label: "Runway", 
              value: `${latestSnapshot.runway_days} days`, 
              icon: Calendar, 
              color: "emerald",
              change: "+18 days"
            },
            { 
              label: "Profit Margin", 
              value: `${((latestSnapshot.profit / latestSnapshot.revenue) * 100).toFixed(1)}%`, 
              icon: TrendingUp, 
              color: "cyan",
              change: "+2.3%"
            },
          ].map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-${metric.color}-500/15`}>
                  <metric.icon className={`w-4 h-4 text-${metric.color}-400`} />
                </div>
                <Badge className={`text-[10px] ${metric.change.startsWith('+') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {metric.change}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
              <p className="text-xl font-bold text-white">{metric.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cash Flow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4">Cash Flow Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockFinancialData}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 42%, 8%)", 
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff"
                  }} 
                />
                <Area type="monotone" dataKey="cash" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCash)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Profit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Expenses</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mockFinancialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 42%, 8%)", 
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff"
                  }} 
                />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444" }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Financial Alerts
          </h3>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Cash flow is strong</h4>
                  <p className="text-xs text-slate-400">Your runway increased by 18 days this month. Great work controlling expenses.</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Receivables aging</h4>
                  <p className="text-xs text-slate-400">$12,400 in invoices are over 30 days old. Consider sending reminders.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}