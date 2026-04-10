import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, ArrowLeft, Calendar, TrendingUp, TrendingDown, 
  AlertTriangle, Target, Zap, CheckCircle2, ArrowRight, Loader2
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import NexusBrain from "@/components/dashboard/NexusBrain";
import { format } from "date-fns";

export default function Briefing() {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: briefings = [] } = useQuery({
    queryKey: ["briefings"],
    queryFn: () => base44.entities.Briefing.list("-date", 30),
  });

  const latestBriefing = briefings[0];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a proactive business briefing for today. Analyze current business data and provide:
        1. Priority alerts (3-5 items that need immediate attention)
        2. Key metrics snapshot
        3. Opportunities to capitalize on
        4. Risks to mitigate
        5. One suggested focus for today
        
        Return as JSON with: priority_alerts (array of {title, message, action}), key_metrics (revenue, expenses, profit, cash_flow), opportunities (array), risks (array), suggested_focus (string)`,
        response_json_schema: {
          type: "object",
          properties: {
            priority_alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  message: { type: "string" },
                  action: { type: "string" }
                }
              }
            },
            key_metrics: {
              type: "object",
              properties: {
                revenue: { type: "number" },
                expenses: { type: "number" },
                profit: { type: "number" },
                cash_flow: { type: "string" }
              }
            },
            opportunities: {
              type: "array",
              items: { type: "string" }
            },
            risks: {
              type: "array",
              items: { type: "string" }
            },
            suggested_focus: { type: "string" }
          }
        }
      });
      
      return base44.entities.Briefing.create({
        date: new Date().toISOString().split('T')[0],
        type: "daily",
        ...response,
        status: "unread"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
      setGenerating(false);
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    await generateMutation.mutateAsync();
  };

  const handleAlertAction = (actionText) => {
    const t = String(actionText || "").toLowerCase();
    if (t.includes("cash") || t.includes("revenue") || t.includes("budget") || t.includes("expense")) {
      navigate(createPageUrl("Centsible"));
      return;
    }
    if (t.includes("ticket") || t.includes("support") || t.includes("customer")) {
      navigate(createPageUrl("SupportSage"));
      return;
    }
    if (t.includes("lead") || t.includes("pipeline") || t.includes("outreach")) {
      navigate(createPageUrl("Prospect"));
      return;
    }
    navigate(createPageUrl("AICommandCenter"));
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <NexusBrain size={32} isThinking={generating} />
            <div>
              <h1 className="text-2xl font-bold text-white">AI Briefing</h1>
              <p className="text-sm text-slate-500">Your daily business intelligence report</p>
            </div>
          </div>
          <Button 
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate Briefing</>
            )}
          </Button>
        </div>

        {latestBriefing ? (
          <div className="space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-violet-400" />
                  <h2 className="text-xl font-bold text-white">
                    {latestBriefing.date && format(new Date(latestBriefing.date), "EEEE, MMMM d, yyyy")}
                  </h2>
                </div>
                <Badge className="bg-violet-500/20 text-violet-400">
                  {latestBriefing.type} briefing
                </Badge>
              </div>
              {latestBriefing.suggested_focus && (
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-white">Suggested Focus</span>
                  </div>
                  <p className="text-sm text-slate-300">{latestBriefing.suggested_focus}</p>
                </div>
              )}
            </motion.div>

            {/* Key Metrics */}
            {latestBriefing.key_metrics && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Today's Snapshot
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
                    <p className="text-xs text-slate-400 mb-1">Revenue</p>
                    <p className="text-xl font-bold text-emerald-400">
                      ${latestBriefing.key_metrics.revenue?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                    <p className="text-xs text-slate-400 mb-1">Expenses</p>
                    <p className="text-xl font-bold text-red-400">
                      ${latestBriefing.key_metrics.expenses?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-500/[0.08] border border-blue-500/20">
                    <p className="text-xs text-slate-400 mb-1">Profit</p>
                    <p className="text-xl font-bold text-blue-400">
                      ${latestBriefing.key_metrics.profit?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-violet-500/[0.08] border border-violet-500/20">
                    <p className="text-xs text-slate-400 mb-1">Cash Flow</p>
                    <p className="text-xl font-bold text-violet-400">
                      {latestBriefing.key_metrics.cash_flow || "Healthy"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Priority Alerts */}
            {latestBriefing.priority_alerts && latestBriefing.priority_alerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Priority Alerts
                </h3>
                <div className="space-y-3">
                  {latestBriefing.priority_alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{alert.message}</p>
                      {alert.action && (
                        <Button size="sm" onClick={() => handleAlertAction(alert.action)} className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
                          {alert.action} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Opportunities */}
              {latestBriefing.opportunities && latestBriefing.opportunities.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Opportunities
                  </h3>
                  <div className="space-y-2">
                    {latestBriefing.opportunities.map((opp, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-300">{opp}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Risks */}
              {latestBriefing.risks && latestBriefing.risks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Risks to Monitor
                  </h3>
                  <div className="space-y-2">
                    {latestBriefing.risks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-300">{risk}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <Sparkles className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No briefing yet</h3>
            <p className="text-sm text-slate-500 mb-4">Generate your first AI briefing to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}





