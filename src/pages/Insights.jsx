import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, TrendingUp, AlertTriangle, Lightbulb,
  Zap, Target, Check, X, ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const categoryConfig = {
  growth: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Growth" },
  risk: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15", label: "Risk" },
  opportunity: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/15", label: "Opportunity" },
  anomaly: { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/15", label: "Anomaly" },
  recommendation: { icon: Target, color: "text-blue-400", bg: "bg-blue-500/15", label: "Recommendation" },
};

const priorityColors = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function Insights() {
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: insights = [] } = useQuery({
    queryKey: ["insights"],
    queryFn: () => base44.entities.Insight.list("-created_date", 50),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Insight.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insights"] }),
  });

  const filtered = filter === "all" ? insights : insights.filter(i => i.category === filter);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Brain className="w-5 h-5 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Proactive Insights</h1>
          <Badge className="ml-2 bg-violet-500/20 text-violet-400 text-[10px]">
            {insights.filter(i => i.status === "new").length} new
          </Badge>
        </div>
        <p className="text-sm text-slate-500 mb-6 ml-8">AI-generated insights and recommendations for your business</p>

        {/* Filters */}
        <div className="mb-6">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-white/[0.04] border border-white/[0.06]">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/[0.1]">All</TabsTrigger>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <TabsTrigger key={key} value={key} className="text-xs data-[state=active]:bg-white/[0.1]">
                  {cfg.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Insights List */}
        <div className="space-y-3">
          {filtered.map((insight, i) => {
            const config = categoryConfig[insight.category] || categoryConfig.recommendation;
            const IconComp = config.icon;

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 p-3 rounded-xl ${config.bg}`}>
                    <IconComp className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[insight.priority]}`}>
                        {insight.priority}
                      </Badge>
                      {insight.status === "new" && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse-glow" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{insight.description}</p>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {insight.metric_value && (
                          <span className={`text-xs font-semibold ${config.color}`}>{insight.metric_value}</span>
                        )}
                        {insight.module && (
                          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">
                            {insight.module}
                          </Badge>
                        )}
                        <span className="text-[10px] text-slate-600">
                          {insight.created_date && format(new Date(insight.created_date), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {insight.status === "new" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateMutation.mutate({ id: insight.id, status: "actioned" })}
                              className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Check className="w-3 h-3 mr-1" /> Action
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateMutation.mutate({ id: insight.id, status: "dismissed" })}
                              className="h-7 text-xs text-slate-500 hover:bg-slate-500/10"
                            >
                              <X className="w-3 h-3 mr-1" /> Dismiss
                            </Button>
                          </>
                        )}
                        {insight.status !== "new" && (
                          <Badge className={`text-[10px] ${
                            insight.status === "actioned" ? "bg-emerald-500/15 text-emerald-400" :
                            insight.status === "acknowledged" ? "bg-blue-500/15 text-blue-400" :
                            "bg-slate-500/15 text-slate-400"
                          }`}>
                            {insight.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No insights yet</h3>
            <p className="text-sm text-slate-500">Nexus will generate insights as it learns your business.</p>
          </div>
        )}
      </div>
    </div>
  );
}