import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Users, DollarSign, Target } from "lucide-react";

const phaseColors = {
  1: { bg: "from-blue-500/20 to-blue-600/5", border: "border-blue-500/20", text: "text-blue-400", badge: "bg-blue-500/15 text-blue-400" },
  2: { bg: "from-violet-500/20 to-violet-600/5", border: "border-violet-500/20", text: "text-violet-400", badge: "bg-violet-500/15 text-violet-400" },
  3: { bg: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400" },
  4: { bg: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/20", text: "text-amber-400", badge: "bg-amber-500/15 text-amber-400" },
};

const statusIcons = {
  completed: CheckCircle2,
  in_progress: Clock,
  planned: Circle,
};

export default function PhaseCard({ phase, index = 0, onClick }) {
  const colors = phaseColors[phase.number] || phaseColors[1];
  const StatusIcon = statusIcons[phase.status] || Circle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onClick={() => onClick?.(phase)}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -translate-y-8 translate-x-8 rounded-full bg-white/[0.03]" />
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-2xl font-bold ${colors.text}`}>Phase {phase.number}</span>
            <Badge className={`text-[10px] ${colors.badge}`}>{phase.status}</Badge>
          </div>
          <h3 className="text-base font-semibold text-white mb-1">{phase.name}</h3>
          <p className="text-xs text-slate-500">{phase.timeline}</p>
        </div>
        <StatusIcon className={`w-6 h-6 ${colors.text}`} />
      </div>

      <p className="text-xs text-slate-400 mb-4 line-clamp-2">{phase.description}</p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>Progress</span>
          <span>{phase.completion}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${phase.completion}%` }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
            className={`h-full bg-gradient-to-r ${colors.bg.replace('/20', '/60').replace('/5', '/40')}`}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-slate-600" />
          <div>
            <p className="text-[10px] text-slate-600">Users</p>
            <p className="text-xs font-semibold text-white">{phase.users}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 text-slate-600" />
          <div>
            <p className="text-[10px] text-slate-600">ARR</p>
            <p className="text-xs font-semibold text-white">{phase.arr}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-slate-600" />
          <div>
            <p className="text-[10px] text-slate-600">Team</p>
            <p className="text-xs font-semibold text-white">{phase.team}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}