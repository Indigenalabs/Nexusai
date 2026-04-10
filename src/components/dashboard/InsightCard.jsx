import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, AlertTriangle, Lightbulb, Zap, Target, ChevronRight
} from "lucide-react";

const categoryConfig = {
  growth: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  risk: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15" },
  opportunity: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/15" },
  anomaly: { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/15" },
  recommendation: { icon: Target, color: "text-blue-400", bg: "bg-blue-500/15" },
};

const priorityColors = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function InsightCard({ insight, index = 0, onAction }) {
  const config = categoryConfig[insight.category] || categoryConfig.recommendation;
  const IconComp = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="group relative flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 cursor-pointer"
    >
      <div className={`flex-shrink-0 p-2.5 rounded-xl ${config.bg} self-start`}>
        <IconComp className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-white truncate">{insight.title}</h4>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[insight.priority]}`}>
            {insight.priority}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{insight.description}</p>
        <div className="flex items-center justify-between">
          {insight.metric_value && (
            <span className={`text-xs font-medium ${config.color}`}>{insight.metric_value}</span>
          )}
          {insight.action_label && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction?.(insight)}
              className="h-6 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2"
            >
              {insight.action_label}
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}