import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, AlertCircle, Info, RefreshCw, Loader2, GitMerge } from "lucide-react";
import { motion } from "framer-motion";

const PRIORITY_CONFIG = {
  critical: { icon: AlertCircle,   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    dot: "bg-red-400" },
  high:     { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  medium:   { icon: Info,          color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",   dot: "bg-blue-400" },
  low:      { icon: Info,          color: "text-slate-400",  bg: "bg-slate-500/10 border-slate-500/20", dot: "bg-slate-400" },
};

export default function AlertCenter({ onAlertCommand }) {
  const [correlating, setCorrelating] = useState(false);
  const [correlated, setCorrelated] = useState(null);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["command_alerts"],
    queryFn: () => base44.entities.Notification.list("-created_date", 30),
  });

  const unread = notifications.filter(n => !n.is_read);

  const runCorrelation = async () => {
    setCorrelating(true);
    try {
      const res = await base44.functions.invoke('commandCenterIntelligence', { action: 'alert_correlation', params: {} });
      setCorrelated(res.data?.result);
    } catch {
      setCorrelated(null);
    }
    setCorrelating(false);
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs font-semibold text-white">Alert Center</p>
          {unread.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-[9px] text-red-400 font-medium">{unread.length}</span>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={runCorrelation} disabled={correlating} title="Correlate alerts"
            className="text-slate-600 hover:text-violet-400 transition-colors disabled:opacity-40">
            {correlating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {correlated && (
        <div className="mb-3 p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <p className="text-[10px] text-violet-400 font-medium mb-1">Correlation Result</p>
          <p className="text-[9px] text-slate-300">{correlated.summary}</p>
          {correlated.incidents?.length > 0 && (
            <div className="mt-2 space-y-1">
              {correlated.incidents.slice(0, 2).map((inc, i) => (
                <button key={i} onClick={() => onAlertCommand?.(`Investigate this incident and give me a full analysis and resolution plan: ${inc.incident_name}. Root cause hypothesis: ${inc.root_cause_hypothesis}`)}
                  className="w-full text-left p-2 rounded-lg bg-white/[0.04] text-[9px] text-slate-300 hover:bg-violet-500/10 transition-all">
                  <span className={`inline-block px-1.5 py-0.5 rounded mr-1.5 ${inc.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'} text-[8px]`}>
                    {inc.severity}
                  </span>
                  {inc.incident_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {unread.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-6 h-6 text-slate-700 mx-auto mb-1" />
            <p className="text-[10px] text-slate-600">No unread alerts</p>
          </div>
        ) : (
          unread.slice(0, 8).map((n, i) => {
            const cfg = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.medium;
            const Icon = cfg.icon;
            return (
              <motion.button key={n.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }} onClick={() => onAlertCommand?.(`Investigate this alert and give me context, root cause, and a specific action plan: ${n.title}. Details: ${n.message}`)}
                className={`w-full text-left p-2.5 rounded-xl border ${cfg.bg} hover:opacity-80 transition-all`}>
                <div className="flex items-start gap-2">
                  <Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-white leading-tight truncate">{n.title}</p>
                    {n.message && <p className="text-[9px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{n.message}</p>}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
