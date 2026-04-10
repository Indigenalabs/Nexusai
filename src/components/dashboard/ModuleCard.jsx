import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Megaphone, Settings, BarChart3, Lock
} from "lucide-react";

const categoryIcons = {
  communication: Mail,
  marketing: Megaphone,
  operations: Settings,
  analytics: BarChart3,
};

const categoryColors = {
  communication: { text: "text-blue-400", bg: "from-blue-500/20 to-blue-600/5", border: "border-blue-500/20", dot: "bg-blue-400" },
  marketing: { text: "text-violet-400", bg: "from-violet-500/20 to-violet-600/5", border: "border-violet-500/20", dot: "bg-violet-400" },
  operations: { text: "text-cyan-400", bg: "from-cyan-500/20 to-cyan-600/5", border: "border-cyan-500/20", dot: "bg-cyan-400" },
  analytics: { text: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/20", dot: "bg-emerald-400" },
};

export default function ModuleCard({ module, index = 0, onClick }) {
  const colors = categoryColors[module.category] || categoryColors.communication;
  const IconComp = categoryIcons[module.category] || Settings;
  const isActive = module.status === "active";
  const isComingSoon = module.status === "coming_soon";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={() => !isComingSoon && onClick?.(module)}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} p-5 cursor-pointer transition-all duration-300 ${
        isComingSoon ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-lg"
      }`}
    >
      {isComingSoon && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl bg-white/[0.06] ${colors.text}`}>
          <IconComp className="w-4.5 h-4.5" />
        </div>
        <div className={`w-2 h-2 rounded-full ${isActive ? colors.dot : "bg-slate-600"} ${isActive ? "animate-pulse-glow" : ""}`} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{module.name}</h3>
      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{module.description}</p>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
          isActive ? "border-emerald-500/30 text-emerald-400" :
          isComingSoon ? "border-slate-500/30 text-slate-500" :
          "border-slate-500/30 text-slate-400"
        }`}>
          {isActive ? "Active" : isComingSoon ? "Coming Soon" : "Inactive"}
        </Badge>
        {isActive && module.tasks_completed > 0 && (
          <span className="text-[10px] text-slate-500">
            {module.tasks_completed} tasks done
          </span>
        )}
      </div>
    </motion.div>
  );
}