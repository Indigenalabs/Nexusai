import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function KPICard({ title, value, change, changeLabel, icon: Icon, color = "blue", index = 0 }) {
  const colorMap = {
    blue: { bg: "from-blue-500/20 to-blue-600/5", text: "text-blue-400", border: "border-blue-500/20", glow: "shadow-blue-500/10" },
    violet: { bg: "from-violet-500/20 to-violet-600/5", text: "text-violet-400", border: "border-violet-500/20", glow: "shadow-violet-500/10" },
    cyan: { bg: "from-cyan-500/20 to-cyan-600/5", text: "text-cyan-400", border: "border-cyan-500/20", glow: "shadow-cyan-500/10" },
    emerald: { bg: "from-emerald-500/20 to-emerald-600/5", text: "text-emerald-400", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
    amber: { bg: "from-amber-500/20 to-amber-600/5", text: "text-amber-400", border: "border-amber-500/20", glow: "shadow-amber-500/10" },
  };

  const c = colorMap[color] || colorMap.blue;
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} p-6 shadow-lg ${c.glow}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -translate-y-8 translate-x-8 rounded-full bg-white/[0.03]" />
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl bg-white/[0.06] ${c.text}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? "+" : ""}{change}%
          </div>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {changeLabel && <p className="text-xs text-slate-500 mt-1">{changeLabel}</p>}
    </motion.div>
  );
}