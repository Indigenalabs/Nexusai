import React from "react";
import { motion } from "framer-motion";
import { Zap, Brain, Clock, RefreshCw } from "lucide-react";

const automations = [
  { name: "Orchestrator", interval: "15 min", icon: Zap, color: "blue", status: "running" },
  { name: "Decision Maker", interval: "1 hr", icon: Brain, color: "violet", status: "running" },
  { name: "Daily Briefing", interval: "Daily", icon: Clock, color: "amber", status: "running" },
  { name: "Learning Engine", interval: "Weekly", icon: RefreshCw, color: "emerald", status: "running" },
];

export default function AutomationStatusBar() {
  return (
    <div className="flex flex-wrap gap-2">
      {automations.map((a, i) => (
        <motion.div
          key={a.name}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${a.color}-500/10 border border-${a.color}-500/20`}
        >
          <div className={`w-1.5 h-1.5 rounded-full bg-${a.color}-400 animate-pulse`} />
          <a.icon className={`w-3 h-3 text-${a.color}-400`} />
          <span className={`text-xs text-${a.color}-300 font-medium`}>{a.name}</span>
          <span className="text-[10px] text-slate-500">{a.interval}</span>
        </motion.div>
      ))}
    </div>
  );
}