import React from "react";
import { motion } from "framer-motion";
import { Mail, Share2, DollarSign, CheckSquare, Bell, Bot } from "lucide-react";
import { format } from "date-fns";

const typeConfig = {
  email: { icon: Mail, color: "text-blue-400", bg: "bg-blue-500/15" },
  social: { icon: Share2, color: "text-violet-400", bg: "bg-violet-500/15" },
  finance: { icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  task: { icon: CheckSquare, color: "text-cyan-400", bg: "bg-cyan-500/15" },
  alert: { icon: Bell, color: "text-amber-400", bg: "bg-amber-500/15" },
  ai_action: { icon: Bot, color: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
};

const statusDot = {
  completed: "bg-emerald-400",
  pending: "bg-amber-400",
  failed: "bg-red-400",
};

export default function ActivityItem({ activity, index = 0 }) {
  const config = typeConfig[activity.type] || typeConfig.task;
  const IconComp = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-start gap-3 py-3 px-1 group"
    >
      <div className="relative flex-shrink-0">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <IconComp className={`w-3.5 h-3.5 ${config.color}`} />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDot[activity.status]} ring-2 ring-[hsl(222,40%,10%)]`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 font-medium truncate">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{activity.description}</p>
        )}
      </div>
      <span className="text-[10px] text-slate-600 whitespace-nowrap mt-1">
        {activity.created_date ? format(new Date(activity.created_date), "h:mm a") : ""}
      </span>
    </motion.div>
  );
}