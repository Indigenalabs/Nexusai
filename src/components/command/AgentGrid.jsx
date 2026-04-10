import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Megaphone, Target, Users, DollarSign, TrendingUp, Calendar,
  Zap, FileText, Shield, Compass, Handshake, Heart, ShoppingBag,
  Sparkles, BarChart3, Scale, ChevronRight
} from "lucide-react";

const AGENTS = [
  { name: "Maestro",      domain: "Marketing",       icon: Megaphone,    color: "violet",  page: "Maestro",      status: "active" },
  { name: "Prospect",     domain: "Acquisition",     icon: Target,       color: "blue",    page: "Prospect",     status: "active" },
  { name: "Support Sage", domain: "Support",         icon: Users,        color: "emerald", page: "SupportSage",  status: "active" },
  { name: "Centsible",    domain: "Finance",         icon: DollarSign,   color: "amber",   page: "Centsible",    status: "active" },
  { name: "Sage",         domain: "Strategy",        icon: TrendingUp,   color: "cyan",    page: "SageAI",       status: "active" },
  { name: "Chronos",      domain: "Scheduling",      icon: Calendar,     color: "indigo",  page: "Chronos",      status: "active" },
  { name: "Atlas",        domain: "Operations",      icon: Zap,          color: "orange",  page: "Atlas",        status: "active" },
  { name: "Scribe",       domain: "Knowledge",       icon: FileText,     color: "slate",   page: "Scribe",       status: "active" },
  { name: "Sentinel",     domain: "Security",        icon: Shield,       color: "red",     page: "Sentinel",     status: "active" },
  { name: "Compass",      domain: "Market Intel",    icon: Compass,      color: "teal",    page: "Compass",      status: "active" },
  { name: "Part",         domain: "Partnerships",    icon: Handshake,    color: "blue",    page: "Part",         status: "active" },
  { name: "Pulse",        domain: "People",          icon: Heart,        color: "pink",    page: "Pulse",        status: "active" },
  { name: "Merchant",     domain: "Commerce",        icon: ShoppingBag,  color: "green",   page: "Merchant",     status: "active" },
  { name: "Canvas",       domain: "Creative",        icon: Sparkles,     color: "purple",  page: "Canvas",       status: "active" },
  { name: "Inspect",      domain: "Quality",         icon: BarChart3,    color: "yellow",  page: "Inspect",      status: "active" },
  { name: "Veritas",      domain: "Legal",           icon: Scale,        color: "indigo",  page: "Veritas",      status: "active" },
];

const COLOR_MAP = {
  violet: { dot: "bg-violet-400",  border: "border-violet-500/20", bg: "bg-violet-500/10", text: "text-violet-400" },
  blue:   { dot: "bg-blue-400",    border: "border-blue-500/20",   bg: "bg-blue-500/10",   text: "text-blue-400" },
  emerald:{ dot: "bg-emerald-400", border: "border-emerald-500/20",bg: "bg-emerald-500/10",text: "text-emerald-400" },
  amber:  { dot: "bg-amber-400",   border: "border-amber-500/20",  bg: "bg-amber-500/10",  text: "text-amber-400" },
  cyan:   { dot: "bg-cyan-400",    border: "border-cyan-500/20",   bg: "bg-cyan-500/10",   text: "text-cyan-400" },
  indigo: { dot: "bg-indigo-400",  border: "border-indigo-500/20", bg: "bg-indigo-500/10", text: "text-indigo-400" },
  orange: { dot: "bg-orange-400",  border: "border-orange-500/20", bg: "bg-orange-500/10", text: "text-orange-400" },
  slate:  { dot: "bg-slate-400",   border: "border-slate-500/20",  bg: "bg-slate-500/10",  text: "text-slate-400" },
  red:    { dot: "bg-red-400",     border: "border-red-500/20",    bg: "bg-red-500/10",    text: "text-red-400" },
  teal:   { dot: "bg-teal-400",    border: "border-teal-500/20",   bg: "bg-teal-500/10",   text: "text-teal-400" },
  pink:   { dot: "bg-pink-400",    border: "border-pink-500/20",   bg: "bg-pink-500/10",   text: "text-pink-400" },
  green:  { dot: "bg-green-400",   border: "border-green-500/20",  bg: "bg-green-500/10",  text: "text-green-400" },
  purple: { dot: "bg-purple-400",  border: "border-purple-500/20", bg: "bg-purple-500/10", text: "text-purple-400" },
  yellow: { dot: "bg-yellow-400",  border: "border-yellow-500/20", bg: "bg-yellow-500/10", text: "text-yellow-400" },
};

export default function AgentGrid() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Federation - 17 Active</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400">Federation Online</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {AGENTS.map((agent, i) => {
          const colors = COLOR_MAP[agent.color] || COLOR_MAP.blue;
          const Icon = agent.icon;
          return (
            <motion.div key={agent.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
              <Link to={createPageUrl(agent.page)}
                className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl border ${colors.border} ${colors.bg} hover:border-white/20 transition-all cursor-pointer`}>
                <div className="relative">
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                </div>
                <p className="text-[9px] font-medium text-slate-300 text-center leading-tight">{agent.name}</p>
                <p className="text-[8px] text-slate-600 text-center">{agent.domain}</p>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-xl">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { AGENTS };
