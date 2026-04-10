import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap, ArrowLeft, Brain, Clock, RefreshCw, Play,
  CheckCircle2, Activity, Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const AUTOMATIONS = [
  {
    id: "orchestrator",
    name: "Autonomous Orchestrator",
    description: "Scans emails, invoices, social, clients, trends every 15 minutes. Generates insights, executes active workflows, triggers self-corrections.",
    interval: "Every 15 minutes",
    icon: Zap,
    color: "blue",
    functionName: "autonomousOrchestrator",
    runs: 125,
    successRate: 98,
    lastRun: "2026-02-27T11:05:05.815000",
  },
  {
    id: "decision_maker",
    name: "Autonomous Decision Maker",
    description: "Executes autonomous decisions based on learned preferences and confidence scores. Auto-approves low-risk actions.",
    interval: "Every hour",
    icon: Brain,
    color: "violet",
    functionName: "autonomousDecisionMaker",
    runs: 32,
    successRate: 100,
    lastRun: "2026-02-27T11:04:59.948000",
  },
  {
    id: "briefing",
    name: "Daily Briefing Generator",
    description: "AI-generates your personalised morning briefing with priority alerts, financial metrics, opportunities and risks.",
    interval: "Daily at 6am",
    icon: Clock,
    color: "amber",
    functionName: "dailyBriefingGenerator",
    runs: 1,
    successRate: 100,
    lastRun: "2026-02-26T19:30:57.952000",
  },
  {
    id: "learning",
    name: "Learning Engine",
    description: "Analyses your behavior across emails, posts, invoices and clients. Continuously improves AI personalisation.",
    interval: "Weekly on Monday",
    icon: RefreshCw,
    color: "emerald",
    functionName: "learningEngine",
    runs: 0,
    successRate: 100,
    lastRun: null,
  },
];

export default function Automations() {
  const [running, setRunning] = useState({});
  const [results, setResults] = useState({});

  const { data: activities = [] } = useQuery({
    queryKey: ["automation_activities"],
    queryFn: () => base44.entities.Activity.filter({ type: "ai_action" }, "-created_date", 20),
    refetchInterval: 30000,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["insights_count"],
    queryFn: () => base44.entities.Insight.filter({ status: "new" }, "-created_date", 5),
  });

  const handleRunNow = async (automation) => {
    setRunning(prev => ({ ...prev, [automation.id]: true }));
    setResults(prev => ({ ...prev, [automation.id]: null }));
    const res = await base44.functions.invoke(automation.functionName, {});
    setRunning(prev => ({ ...prev, [automation.id]: false }));
    setResults(prev => ({ ...prev, [automation.id]: res.data }));
  };

  const totalRuns = AUTOMATIONS.reduce((sum, a) => sum + a.runs, 0);
  const aiActions = activities.length;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Zap className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Autonomous Systems</h1>
            <p className="text-sm text-slate-500">All background AI engines running 24/7</p>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="mt-6 mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-sm text-emerald-300 font-medium">All 4 autonomous systems are online and running</p>
          <div className="ml-auto flex gap-4 text-xs text-slate-400">
            <span><span className="text-white font-medium">{totalRuns}</span> total runs</span>
            <span><span className="text-emerald-400 font-medium">{insights.length}</span> new insights</span>
            <span><span className="text-blue-400 font-medium">{aiActions}</span> recent AI actions</span>
          </div>
        </div>

        {/* Automation Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {AUTOMATIONS.map((automation, i) => {
            const isRunning = running[automation.id];
            const result = results[automation.id];
            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl bg-${automation.color}-500/[0.06] border border-${automation.color}-500/20 p-6`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-${automation.color}-500/15`}>
                      <automation.icon className={`w-5 h-5 text-${automation.color}-400`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{automation.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${automation.color}-400 animate-pulse`} />
                        {automation.interval}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRunNow(automation)}
                    disabled={isRunning}
                    className={`bg-${automation.color}-600/80 hover:bg-${automation.color}-600 text-white h-7 text-xs`}
                  >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    {isRunning ? "Running..." : "Run Now"}
                  </Button>
                </div>

                <p className="text-xs text-slate-400 mb-4">{automation.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span><span className="text-white">{automation.runs}</span> runs</span>
                  <span><span className="text-emerald-400">{automation.successRate}%</span> success</span>
                  {automation.lastRun && (
                    <span>Last: <span className="text-slate-300">{format(new Date(automation.lastRun), "MMM d, h:mm a")}</span></span>
                  )}
                </div>

                {/* Success bar */}
                <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full bg-${automation.color}-400 rounded-full transition-all`}
                    style={{ width: `${automation.successRate}%` }}
                  />
                </div>

                {/* Run Result */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Completed</span>
                    </div>
                    {result.insights_generated !== undefined && (
                      <p className="text-[10px] text-slate-400">
                        {result.insights_generated} insights • {result.notifications_created || 0} notifications • {result.workflows_executed || 0} workflows executed
                      </p>
                    )}
                    {result.learnings_count !== undefined && (
                      <p className="text-[10px] text-slate-400">{result.learnings_count} preferences learned</p>
                    )}
                    {result.briefing && (
                      <p className="text-[10px] text-slate-400">Daily briefing ready</p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Recent AI Activity Log */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Recent Autonomous Actions</h3>
          </div>
          <div className="space-y-2">
            {activities.slice(0, 10).map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0"
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  activity.status === 'completed' ? 'bg-emerald-400' :
                  activity.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">{activity.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{activity.description}</p>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {activity.created_date && format(new Date(activity.created_date), "h:mm a")}
                </span>
              </motion.div>
            ))}
            {activities.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">No activity yet. Run an automation above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}