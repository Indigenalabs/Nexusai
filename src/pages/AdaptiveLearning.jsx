import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, Loader2, CheckCircle2, XCircle, Minus, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdaptiveLearning() {
  const [scanning, setScanning] = useState(false);
  const [suggestedWorkflows, setSuggestedWorkflows] = useState([]);
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ["learning_logs"],
    queryFn: () => base44.entities.LearningLog.list("-created_date", 20),
  });

  const { data: adaptiveWorkflows = [] } = useQuery({
    queryKey: ["adaptive_workflows"],
    queryFn: () => base44.entities.AdaptiveWorkflow.list("-created_date", 10),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities_learning"],
    queryFn: () => base44.entities.Activity.list("-created_date", 30),
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["insights_learning"],
    queryFn: () => base44.entities.Insight.list("-created_date", 20),
  });

  const scanAndLearn = async () => {
    setScanning(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Nexus AI's self-improvement engine. Analyse the following business activity patterns and suggest intelligent workflow automations.

Recent Activities (${activities.length}):
${JSON.stringify(activities.slice(0, 10))}

Recent Insights (${insights.length}):
${JSON.stringify(insights.slice(0, 5))}

Learning Logs (${logs.length}):
${JSON.stringify(logs.slice(0, 5))}

Based on the patterns you observe, suggest 3 intelligent adaptive workflows that could be auto-created to improve business operations. For each, provide a trigger condition and what actions it should execute. Be specific and practical.`,
      response_json_schema: {
        type: "object",
        properties: {
          patterns_detected: { type: "array", items: { type: "string" } },
          suggested_workflows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                observed_pattern: { type: "string" },
                trigger: { type: "string" },
                actions_summary: { type: "string" }
              }
            }
          },
          learning_summary: { type: "string" }
        }
      }
    });

    setSuggestedWorkflows(result.suggested_workflows || []);

    await base44.entities.LearningLog.create({
      action_taken: "AI self-scan for adaptive patterns",
      outcome: "success",
      learned_pattern: result.learning_summary,
      module: "adaptive_learning"
    });

    queryClient.invalidateQueries({ queryKey: ["learning_logs"] });
    setScanning(false);
  };

  const approveWorkflow = async (wf) => {
    await base44.entities.AdaptiveWorkflow.create({
      name: wf.name,
      description: wf.description,
      observed_pattern: wf.observed_pattern,
      trigger: wf.trigger,
      suggested_by: "ai",
      status: "active"
    });
    setSuggestedWorkflows(prev => prev.filter(w => w.name !== wf.name));
    queryClient.invalidateQueries({ queryKey: ["adaptive_workflows"] });
  };

  const outcomeColors = { success: "emerald", failure: "red", neutral: "slate" };
  const outcomeIcons = { success: CheckCircle2, failure: XCircle, neutral: Minus };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Brain className="w-5 h-5 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Adaptive Learning Engine</h1>
              <p className="text-sm text-slate-500">AI that improves itself by learning from your business patterns</p>
            </div>
          </div>
          <Button onClick={scanAndLearn} disabled={scanning}
            className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500">
            {scanning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <><Brain className="w-4 h-4 mr-2" />Scan & Learn</>}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <p className="text-xs text-slate-400 mb-1">Learning Events</p>
              <p className="text-3xl font-bold text-white">{logs.length}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <p className="text-xs text-slate-400 mb-1">Active Adaptive Workflows</p>
              <p className="text-3xl font-bold text-white">{adaptiveWorkflows.filter(w => w.status === "active").length}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <p className="text-xs text-slate-400 mb-1">Success Rate</p>
              <p className="text-3xl font-bold text-emerald-400">
                {logs.length ? Math.round((logs.filter(l => l.outcome === "success").length / logs.length) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Suggested Workflows */}
          <div className="lg:col-span-2 space-y-4">
            {suggestedWorkflows.length > 0 && (
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">AI-Suggested Automations</h3>
                  <Badge className="bg-violet-500/20 text-violet-400 text-[10px]">New</Badge>
                </div>
                <div className="space-y-3">
                  {suggestedWorkflows.map((wf, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="bg-white/[0.04] rounded-xl p-4 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{wf.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{wf.description}</p>
                        <p className="text-[11px] text-violet-400 mt-1">Pattern: {wf.observed_pattern}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => approveWorkflow(wf)}
                          className="h-7 text-[11px] bg-emerald-600/80 hover:bg-emerald-600">
                          <Zap className="w-3 h-3 mr-1" />Activate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSuggestedWorkflows(prev => prev.filter(w => w.name !== wf.name))}
                          className="h-7 text-[11px] text-slate-400">
                          Dismiss
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Adaptive Workflows */}
            {adaptiveWorkflows.length > 0 && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Active AI Workflows</h3>
                <div className="space-y-2">
                  {adaptiveWorkflows.map(wf => (
                    <div key={wf.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-sm text-white">{wf.name}</p>
                        <p className="text-xs text-slate-500">{wf.observed_pattern}</p>
                      </div>
                      <Badge className={`text-[10px] ${wf.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                        {wf.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Log */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Learning History</h3>
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No learning events yet. Click "Scan & Learn" to begin.</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 8).map(log => {
                    const Icon = outcomeIcons[log.outcome] || Minus;
                    const color = outcomeColors[log.outcome] || "slate";
                    return (
                      <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                        <Icon className={`w-4 h-4 text-${color}-400 shrink-0 mt-0.5`} />
                        <div className="flex-1">
                          <p className="text-xs text-white">{log.action_taken}</p>
                          {log.learned_pattern && <p className="text-[11px] text-slate-500 mt-0.5">{log.learned_pattern}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}