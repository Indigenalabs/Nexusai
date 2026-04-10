import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, AlertCircle, Code, Package, Briefcase, Users as UsersIcon } from "lucide-react";

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  in_progress: { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/15" },
  planned: { icon: Circle, color: "text-slate-500", bg: "bg-slate-500/15" },
  blocked: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15" },
};

const categoryIcons = {
  technical: Code,
  product: Package,
  business: Briefcase,
  team: UsersIcon,
};

export default function MilestoneItem({ milestone, index = 0 }) {
  const statusCfg = statusConfig[milestone.status] || statusConfig.planned;
  const StatusIcon = statusCfg.icon;
  const CategoryIcon = categoryIcons[milestone.category] || Code;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all group"
    >
      <div className={`p-2 rounded-lg ${statusCfg.bg} flex-shrink-0`}>
        <StatusIcon className={`w-3.5 h-3.5 ${statusCfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-medium text-white truncate">{milestone.title}</h4>
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">
            <CategoryIcon className="w-2.5 h-2.5 mr-1" />
            {milestone.category}
          </Badge>
        </div>
        {milestone.description && (
          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{milestone.description}</p>
        )}
        <div className="flex items-center gap-3">
          {milestone.completion_percentage > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500/60 rounded-full transition-all"
                  style={{ width: `${milestone.completion_percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-600">{milestone.completion_percentage}%</span>
            </div>
          )}
          {milestone.target_date && (
            <span className="text-[10px] text-slate-600">
              Target: {new Date(milestone.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}