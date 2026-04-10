import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { 
  PenLine, FileText, Mail, 
  BarChart3, Zap, TrendingUp, Brain, Shield
} from "lucide-react";

const actions = [
  { label: "Draft Content", icon: PenLine, color: "from-violet-600 to-violet-500", page: "ContentCreator" },
  { label: "New Invoice", icon: FileText, color: "from-emerald-600 to-emerald-500", page: "InvoiceManager" },
  { label: "Email Hub", icon: Mail, color: "from-cyan-600 to-cyan-500", page: "EmailHub" },
  { label: "Analytics", icon: BarChart3, color: "from-amber-600 to-amber-500", page: "Insights" },
  { label: "Automate", icon: Zap, color: "from-orange-600 to-orange-500", page: "Workflows" },
  { label: "Forecasting", icon: TrendingUp, color: "from-blue-600 to-blue-500", page: "Forecasting" },
  { label: "Command", icon: Brain, color: "from-blue-700 to-violet-600", page: "AICommandCenter" },
  { label: "Security", icon: Shield, color: "from-red-600 to-red-500", page: "Sentinel" },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action, i) => (
        <motion.button
          key={action.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(createPageUrl(action.page))}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group cursor-pointer"
        >
          <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
            <action.icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
