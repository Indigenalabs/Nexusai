import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Loader2, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function WorkflowMonitor({ onCommand }) {
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["command_tasks"],
    queryFn: () => base44.entities.Task.list("-created_date", 50),
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ["command_workflows"],
    queryFn: () => base44.entities.Workflow.list("-created_date", 20),
  });

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await base44.functions.invoke('commandCenterIntelligence', { action: 'workflow_health', params: {} });
      setHealthData(res.data?.result);
    } catch {
      setHealthData(null);
    }
    setHealthLoading(false);
  };

  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const critical = tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          <p className="text-xs font-semibold text-white">Workflow Monitor</p>
        </div>
        <button onClick={checkHealth} disabled={healthLoading}
          className="text-slate-600 hover:text-orange-400 transition-colors disabled:opacity-40">
          {healthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Task Stats */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: "Pending",    value: pending,    color: "text-amber-400",  bg: "bg-amber-500/10" },
          { label: "In Progress", value: inProgress, color: "text-blue-400",  bg: "bg-blue-500/10" },
          { label: "Done",       value: completed,  color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Critical",   value: critical,   color: critical > 0 ? "text-red-400" : "text-slate-600", bg: critical > 0 ? "bg-red-500/10" : "bg-white/[0.03]" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg p-2 text-center`}>
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[8px] text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Health Data */}
      {healthData && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Health Score</span>
            <span className={`text-[10px] font-bold ${(healthData.health_score || 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {healthData.health_score}/100
            </span>
          </div>
          {healthData.bottlenecks?.slice(0, 2).map((b, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-300">{b.step}: {b.cause?.slice(0, 60)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active Workflows */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {workflows.slice(0, 5).map((w, i) => (
          <motion.button key={w.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            onClick={() => onCommand?.(`Check the status and health of workflow: ${w.name}. What's the progress, are there any blockers, and what's the next step?`)}
            className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all text-left">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.status === 'completed' ? 'bg-emerald-400' : w.status === 'in_progress' ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] text-slate-400 flex-1 truncate">{w.name}</span>
            <span className="text-[8px] text-slate-600">{w.status}</span>
          </motion.button>
        ))}
        {workflows.length === 0 && (
          <p className="text-[10px] text-slate-600 text-center py-3">No active workflows</p>
        )}
      </div>

      <button onClick={() => onCommand?.("Run a comprehensive workflow health check across all agents. What's overdue, what's blocked, where are the bottlenecks, and what automation opportunities do you see?")}
        className="mt-3 w-full text-[10px] text-orange-400 hover:text-orange-300 transition-colors text-center py-1">
        Full workflow health analysis →
      </button>
    </div>
  );
}
