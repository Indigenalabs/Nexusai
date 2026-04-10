import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, Zap, Target } from "lucide-react";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#ef4444", "#94a3b8"];

export default function PipelineAnalytics({ leads }) {
  const [funnelAnalysis, setFunnelAnalysis] = useState(null);
  const [icpAnalysis, setIcpAnalysis] = useState(null);
  const [loading, setLoading] = useState(null);

  const byStatus = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});
  const bySource = leads.reduce((acc, l) => { acc[l.source || "unknown"] = (acc[l.source || "unknown"] || 0) + 1; return acc; }, {});

  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const sourceData = Object.entries(bySource).map(([name, value]) => ({ name, value }));

  const hotLeads = leads.filter(l => (l.score || 0) >= 80).length;
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length) : 0;
  const convRate = leads.length > 0 ? ((byStatus.converted || 0) / leads.length * 100).toFixed(1) : 0;

  const runFunnelAnalysis = async () => {
    setLoading("funnel");
    const res = await base44.functions.invoke('prospectLeadGeneration', { action: 'funnel_analysis' });
    setFunnelAnalysis(res.data?.analysis);
    setLoading(null);
  };

  const runIcpAnalysis = async () => {
    setLoading("icp");
    const res = await base44.functions.invoke('prospectLeadGeneration', { action: 'analyze_icp' });
    setIcpAnalysis(res.data?.analysis);
    setLoading(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: leads.length, color: "text-white" },
          { label: "Hot Leads 🔥", value: hotLeads, color: "text-orange-400" },
          { label: "Avg Score", value: avgScore, color: "text-violet-400" },
          { label: "Conv. Rate", value: `${convRate}%`, color: "text-emerald-400" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 mb-4">Leads by Status</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusData} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip contentStyle={{ background: "hsl(222,42%,8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 mb-4">Leads by Source</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(222,42%,8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Analysis Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">Funnel Analysis</p>
              <p className="text-xs text-slate-500">Identify drop-off points & optimize conversion</p>
            </div>
            <Button size="sm" onClick={runFunnelAnalysis} disabled={loading === "funnel"}
              className="bg-violet-600/80 hover:bg-violet-600 text-white text-xs">
              {loading === "funnel" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            </Button>
          </div>
          {funnelAnalysis && (
            <div className="space-y-2 mt-3">
              {funnelAnalysis.top_recommendations?.map((r, i) => (
                <p key={i} className="text-[10px] text-slate-400 flex gap-2"><span className="text-violet-400 flex-shrink-0">→</span>{r}</p>
              ))}
              {funnelAnalysis.pipeline_value_estimate && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 mt-2">
                  <p className="text-[10px] text-emerald-400">Pipeline Value: {funnelAnalysis.pipeline_value_estimate}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">ICP Analysis</p>
              <p className="text-xs text-slate-500">Learn who converts best & refine targeting</p>
            </div>
            <Button size="sm" onClick={runIcpAnalysis} disabled={loading === "icp"}
              className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs">
              {loading === "icp" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
            </Button>
          </div>
          {icpAnalysis && (
            <div className="space-y-2 mt-3">
              {icpAnalysis.recommendations?.map((r, i) => (
                <p key={i} className="text-[10px] text-slate-400 flex gap-2"><span className="text-blue-400 flex-shrink-0">→</span>{r}</p>
              ))}
              {icpAnalysis.ideal_profile?.titles?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {icpAnalysis.ideal_profile.titles.map((t, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
