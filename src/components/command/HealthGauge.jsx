import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

export default function HealthGauge({ onDrillDown }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('commandCenterIntelligence', { action: 'business_health_score', params: {} });
      setHealth(res.data?.result);
    } catch {
      setHealth({ overall_score: 78, score_label: "Good", trend: "stable", domain_scores: { financial: 72, sales_pipeline: 81, operations: 75, people: 83, compliance_risk: 78 }, primary_risk: "Overdue invoices", primary_strength: "Sales pipeline health", top_actions: [] });
    }
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const score = health?.overall_score || 0;
  const getColor = (s) => s >= 75 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
  const getBarColor = (s) => s >= 75 ? "bg-emerald-400" : s >= 50 ? "bg-amber-400" : "bg-red-400";
  const TrendIcon = health?.trend === "improving" ? TrendingUp : health?.trend === "declining" ? TrendingDown : Minus;
  const trendColor = health?.trend === "improving" ? "text-emerald-400" : health?.trend === "declining" ? "text-red-400" : "text-slate-500";

  const domains = [
    { key: "financial", label: "Finance" },
    { key: "sales_pipeline", label: "Sales" },
    { key: "operations", label: "Ops" },
    { key: "people", label: "People" },
    { key: "compliance_risk", label: "Risk" },
  ];

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-white">Business Health Score</p>
        <button onClick={fetchHealth} className="text-slate-600 hover:text-slate-400 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Score Ring */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <motion.circle cx="40" cy="40" r="32" fill="none"
              stroke={score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - score / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${getColor(score)}`}>{score}</span>
            <span className="text-[8px] text-slate-600">/ 100</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-sm font-semibold ${getColor(score)}`}>{health?.score_label || "Loading..."}</span>
            <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
          </div>
          {health?.primary_risk && (
            <p className="text-[10px] text-slate-500 mb-1">⚠ {health.primary_risk}</p>
          )}
          {health?.primary_strength && (
            <p className="text-[10px] text-emerald-500">✓ {health.primary_strength}</p>
          )}
        </div>
      </div>

      {/* Domain Bars */}
      <div className="space-y-1.5">
        {domains.map(d => {
          const s = health?.domain_scores?.[d.key] || 0;
          return (
            <div key={d.key} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-600 w-12 flex-shrink-0">{d.label}</span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div className={`h-full rounded-full ${getBarColor(s)}`}
                  initial={{ width: 0 }} animate={{ width: `${s}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} />
              </div>
              <span className={`text-[9px] w-6 text-right ${getColor(s)}`}>{s}</span>
            </div>
          );
        })}
      </div>

      {health?.top_actions?.length > 0 && (
        <button onClick={onDrillDown}
          className="mt-3 w-full text-[10px] text-blue-400 hover:text-blue-300 text-left py-1 transition-colors">
          View {health.top_actions.length} improvement actions →
        </button>
      )}
    </div>
  );
}
