import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw, Loader2, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CrossAgentInsights({ onInsightCommand }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('commandCenterIntelligence', { action: 'cross_agent_insights', params: {} });
      setInsights(res.data?.result?.insights || []);
      setFetched(true);
    } catch {
      setInsights([]);
      setFetched(true);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <p className="text-xs font-semibold text-white">Cross-Agent Intelligence</p>
        </div>
        <button onClick={fetchInsights} disabled={loading}
          className="text-slate-600 hover:text-violet-400 transition-colors disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!fetched ? (
        <button onClick={fetchInsights} disabled={loading}
          className="w-full py-6 rounded-xl border border-dashed border-violet-500/20 text-violet-400 text-xs hover:bg-violet-500/5 transition-all flex flex-col items-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? "Synthesizing cross-domain intelligence..." : "Generate cross-agent insights"}
        </button>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {insights.slice(0, 4).map((insight, i) => (
              <motion.button key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }} onClick={() => onInsightCommand?.(`Tell me more about this cross-agent insight and what specific actions I should take: ${insight.title}. Observation: ${insight.observation}`)}
                className="w-full text-left p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-violet-500/5 hover:border-violet-500/20 transition-all group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[10px] font-semibold text-white leading-tight">{insight.title}</p>
                  <LinkIcon className="w-3 h-3 text-slate-700 group-hover:text-violet-400 flex-shrink-0 mt-0.5 transition-colors" />
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed mb-1.5">{insight.observation?.slice(0, 100)}...</p>
                <div className="flex gap-1 flex-wrap">
                  {insight.domains_involved?.slice(0, 3).map((d, j) => (
                    <span key={j} className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{d}</span>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
