import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Brain, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Forecasting() {
  const [forecastPeriod, setForecastPeriod] = useState("3m");
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: financials = [] } = useQuery({
    queryKey: ["financials_forecast"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 12),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients_forecast"],
    queryFn: () => base44.entities.Client.list("-created_date", 50),
  });
  const { data: metrics = [] } = useQuery({
    queryKey: ["metrics_forecast"],
    queryFn: () => base44.entities.Metric.list("-created_date", 20),
  });

  const generateForecast = async () => {
    setLoading(true);
    const activeClients = clients.filter(c => c.status === "active").length;
    const leadClients = clients.filter(c => c.status === "lead").length;
    const totalRevenue = financials.reduce((s, f) => s + (f.revenue || 0), 0);
    const avgRevenue = financials.length ? (totalRevenue / financials.length) : 0;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a business forecasting AI. Based on the following data, generate a ${forecastPeriod} forecast.

Business Data:
- Active clients: ${activeClients}
- Leads in pipeline: ${leadClients}
- Average monthly revenue: $${avgRevenue.toFixed(0)}
- Recent financial snapshots: ${JSON.stringify(financials.slice(0,3))}
- Key metrics: ${JSON.stringify(metrics.slice(0,5))}

Generate a realistic forecast with:
1. Monthly revenue projections for the next ${forecastPeriod === "3m" ? 3 : forecastPeriod === "6m" ? 6 : 12} months
2. Key risks that could affect the forecast
3. Key opportunities to accelerate growth
4. Confidence score (0-100)
5. One key recommendation

Return as JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          monthly_projections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                month: { type: "string" },
                projected_revenue: { type: "number" },
                optimistic: { type: "number" },
                pessimistic: { type: "number" }
              }
            }
          },
          risks: { type: "array", items: { type: "string" } },
          opportunities: { type: "array", items: { type: "string" } },
          confidence_score: { type: "number" },
          recommendation: { type: "string" }
        }
      }
    });
    setForecast(result);
    setLoading(false);
  };

  const chartData = forecast?.monthly_projections?.map(p => ({
    name: p.month,
    projected: p.projected_revenue,
    optimistic: p.optimistic,
    pessimistic: p.pessimistic,
  })) || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Predictive Forecasting</h1>
              <p className="text-sm text-slate-500">AI-powered business predictions and scenario planning</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={forecastPeriod} onValueChange={setForecastPeriod}>
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
                <SelectItem value="3m">3 Months</SelectItem>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="12m">12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateForecast} disabled={loading}
              className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Forecasting...</> : <><Brain className="w-4 h-4 mr-2" />Generate Forecast</>}
            </Button>
          </div>
        </div>

        {!forecast && !loading && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center">
            <TrendingUp className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">AI Business Forecasting</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">Generate AI-powered predictions for revenue, growth, risks and opportunities based on your live business data.</p>
            <Button onClick={generateForecast} className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500">
              <Brain className="w-4 h-4 mr-2" /> Generate {forecastPeriod} Forecast
            </Button>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center">
            <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
            <p className="text-white font-medium">AI is analysing your business data...</p>
            <p className="text-sm text-slate-500 mt-2">Scanning financials, clients, and market trends</p>
          </div>
        )}

        {forecast && (
          <div className="space-y-6">
            {/* Confidence + Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <p className="text-xs text-slate-400 mb-2">Forecast Confidence</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-white">{forecast.confidence_score}%</span>
                  <span className="text-sm text-slate-500 mb-1">confidence</span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-2 mt-3">
                  <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${forecast.confidence_score}%` }} />
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-5">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-400 mb-1 font-medium">AI Recommendation</p>
                    <p className="text-sm text-slate-200">{forecast.recommendation}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Revenue Projection</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="projected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(222,42%,8%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }} />
                    <Area type="monotone" dataKey="optimistic" stroke="#10b981" strokeDasharray="5 5" fill="none" strokeWidth={1} />
                    <Area type="monotone" dataKey="projected" stroke="#3b82f6" fill="url(#projected)" strokeWidth={2} />
                    <Area type="monotone" dataKey="pessimistic" stroke="#f59e0b" strokeDasharray="5 5" fill="none" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-6 mt-2 justify-center text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-400 inline-block border-dashed"></span> Optimistic</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-400 inline-block"></span> Projected</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-amber-400 inline-block border-dashed"></span> Pessimistic</span>
                </div>
              </motion.div>
            )}

            {/* Risks & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Risks</h3>
                </div>
                <ul className="space-y-2">
                  {forecast.risks?.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="text-amber-400 mt-0.5">•</span> {risk}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Opportunities</h3>
                </div>
                <ul className="space-y-2">
                  {forecast.opportunities?.map((opp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="text-emerald-400 mt-0.5">•</span> {opp}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}