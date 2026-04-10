import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Brain } from "lucide-react";

const agents = [
  { label: "Maestro", color: "pink", page: "Maestro", domain: "Marketing" },
  { label: "Prospect", color: "blue", page: "Prospect", domain: "Sales" },
  { label: "Centsible", color: "emerald", page: "Centsible", domain: "Finance" },
  { label: "Support Sage", color: "teal", page: "SupportSage", domain: "Support" },
  { label: "Atlas", color: "violet", page: "Atlas", domain: "Operations" },
  { label: "Chronos", color: "cyan", page: "Chronos", domain: "Schedule" },
  { label: "Scribe", color: "amber", page: "Scribe", domain: "Knowledge" },
  { label: "Sentinel", color: "red", page: "Sentinel", domain: "Security" },
  { label: "Compass", color: "orange", page: "Compass", domain: "Intel" },
  { label: "Sage", color: "violet", page: "SageAI", domain: "Strategy" },
  { label: "Part", color: "blue", page: "Part", domain: "Partners" },
  { label: "Pulse", color: "pink", page: "Pulse", domain: "People" },
  { label: "Canvas", color: "purple", page: "Canvas", domain: "Creative" },
  { label: "Merchant", color: "emerald", page: "Merchant", domain: "E-com" },
  { label: "Inspect", color: "cyan", page: "Inspect", domain: "QA" },
  { label: "Veritas", color: "indigo", page: "Veritas", domain: "Legal" },
];

const colorMap = {
  pink: "border-pink-500/20 hover:bg-pink-500/10 hover:border-pink-500/30",
  blue: "border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/30",
  emerald: "border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30",
  teal: "border-teal-500/20 hover:bg-teal-500/10 hover:border-teal-500/30",
  violet: "border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/30",
  cyan: "border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/30",
  amber: "border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30",
  red: "border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30",
  orange: "border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/30",
  purple: "border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/30",
  indigo: "border-indigo-500/20 hover:bg-indigo-500/10 hover:border-indigo-500/30",
};

export default function NexusStatus() {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Agent Team - 17 Active</h3>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
          All Online
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              to={createPageUrl(agent.page)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border bg-white/[0.02] transition-all cursor-pointer ${colorMap[agent.color]}`}
            >
              <span className="text-[9px] text-slate-400 font-medium leading-tight text-center">{agent.label}</span>
              <span className="text-[8px] text-slate-600 leading-tight">{agent.domain}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <p className="text-[10px] text-slate-500 text-center">
          Coordinated by <span className="text-blue-400 font-medium">Nexus</span> - click any agent to open their department
        </p>
      </div>
    </div>
  );
}
