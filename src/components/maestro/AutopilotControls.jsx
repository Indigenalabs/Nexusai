import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap, BarChart3, Calendar, Target, Loader2,
  CheckCircle2, RefreshCw, AlertTriangle
} from "lucide-react";

const AUTOPILOT_ACTIONS = [
  {
    id: "morning_scan",
    label: "Morning Scan",
    description: "Scan all campaigns, trends & performance. Generate priority actions.",
    icon: RefreshCw,
    color: "blue",
    fn: "maestroAutopilot",
  },
  {
    id: "auto_schedule_posts",
    label: "Auto-Schedule Posts",
    description: "Automatically schedule all draft posts at optimal times.",
    icon: Calendar,
    color: "violet",
    fn: "maestroAutopilot",
  },
  {
    id: "performance_analysis",
    label: "Performance Analysis",
    description: "Analyze all active campaigns. Auto-pause anything over budget.",
    icon: BarChart3,
    color: "emerald",
    fn: "maestroAutopilot",
  },
  {
    id: "content_calendar_gaps",
    label: "Find Calendar Gaps",
    description: "Identify days with no content scheduled in the next 30 days.",
    icon: Target,
    color: "amber",
    fn: "socialIntelligence",
  },
];

const COLOR_MAP = {
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   btn: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", btn: "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border-violet-500/30" },
  emerald:{ bg: "bg-emerald-500/10",border: "border-emerald-500/20",text: "text-emerald-400",btn: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30" },
  amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-400",  btn: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30" },
};

export default function AutopilotControls({ campaignId, onResult }) {
  const [running, setRunning] = useState({});
  const [results, setResults] = useState({});

  const runAction = async (action) => {
    setRunning(r => ({ ...r, [action.id]: true }));
    try {
      const res = await base44.functions.invoke(action.fn, {
        action: action.id,
        campaignId,
      });
      setResults(r => ({ ...r, [action.id]: res.data }));
      if (onResult) onResult(action.id, res.data);
    } catch (e) {
      setResults(r => ({ ...r, [action.id]: { error: e.message } }));
    }
    setRunning(r => ({ ...r, [action.id]: false }));
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1">Autopilot Actions</p>
      {AUTOPILOT_ACTIONS.map((action) => {
        const c = COLOR_MAP[action.color];
        const isRunning = running[action.id];
        const result = results[action.id];
        const Icon = action.icon;

        return (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border ${c.border} ${c.bg} p-3`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                <span className={`text-xs font-semibold ${c.text}`}>{action.label}</span>
              </div>
              <Button
                size="sm"
                onClick={() => runAction(action)}
                disabled={isRunning}
                className={`h-6 text-[10px] px-2 border ${c.btn}`}
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {isRunning ? "Running..." : "Run"}
              </Button>
            </div>
            <p className="text-[10px] text-slate-500">{action.description}</p>
            {result && !result.error && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {result.scheduled !== undefined && `${result.scheduled} posts scheduled`}
                {result.assets_created !== undefined && `${result.assets_created} assets created`}
                {result.analysis !== undefined && `${result.analysis.length} campaigns analyzed`}
                {result.gap_days !== undefined && `${result.gap_days} days without content`}
                {result.scan !== undefined && `Scan complete · ${result.scan.alerts?.length || 0} alerts`}
              </div>
            )}
            {result?.error && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {result.error}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}