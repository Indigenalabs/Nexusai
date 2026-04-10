import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Heart, Bell, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function JarvisStatus({ briefing, healthScore }) {
  const statusItems = [
    { 
      label: "Business Intelligence", 
      status: "active", 
      icon: Sparkles,
      action: "View Briefing",
      page: "Briefing",
      color: "violet"
    },
    { 
      label: "Financial Health", 
      status: healthScore >= 80 ? "excellent" : "good", 
      icon: Heart,
      action: "Check Health",
      page: "BusinessHealth",
      color: "emerald"
    },
    { 
      label: "Learning Engine", 
      status: "learning", 
      icon: Brain,
      action: "View Preferences",
      page: "Preferences",
      color: "blue"
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-violet-500/[0.08] border border-blue-500/20 p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Nexus Command Status</h3>
        <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px]">
          All Systems Online
        </Badge>
      </div>

      <div className="space-y-3">
        {statusItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${item.color}-500/15`}>
                <item.icon className={`w-4 h-4 text-${item.color}-400`} />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{item.label}</p>
                <p className="text-[10px] text-slate-500 capitalize">{item.status}</p>
              </div>
            </div>
            <Link to={createPageUrl(item.page)}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                {item.action}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ))}
      </div>

      {briefing?.priority_alerts && briefing.priority_alerts.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-3 h-3 text-amber-400" />
            <p className="text-xs font-semibold text-white">
              {briefing.priority_alerts.length} priority alerts require attention
            </p>
          </div>
          <Link to={createPageUrl("Briefing")}>
            <Button size="sm" className="h-7 text-xs w-full bg-amber-600 hover:bg-amber-700 mt-2">
              Review Briefing
            </Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
