import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Zap, TrendingUp,
  BarChart3, Brain, Activity as ActivityIcon, Users
} from "lucide-react";

import KPICard from "@/components/dashboard/KPICard";
import InsightCard from "@/components/dashboard/InsightCard";
import ActivityItem from "@/components/dashboard/ActivityItem";
import ModuleCard from "@/components/dashboard/ModuleCard";
import NexusBrain from "@/components/dashboard/NexusBrain";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import CommandBar from "@/components/dashboard/CommandBar";
import QuickActions from "@/components/dashboard/QuickActions";
import JarvisStatus from "@/components/dashboard/JarvisStatus";
import NexusStatus from "@/components/dashboard/NexusStatus";
import ProactiveSolver from "@/components/ai/ProactiveSolver";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: () => base44.entities.Module.list(),
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["insights"],
    queryFn: () => base44.entities.Insight.list("-created_date", 6),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => base44.entities.Activity.list("-created_date", 10),
  });

  const { data: briefings = [] } = useQuery({
    queryKey: ["briefings"],
    queryFn: () => base44.entities.Briefing.list("-date", 1),
  });

  const { data: healthSnapshots = [] } = useQuery({
    queryKey: ["healthSnapshots"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 1),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 100),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_dash"],
    queryFn: () => base44.entities.Task.list("-created_date", 100),
  });

  const hotLeads = leads.filter(l => (l.score || 0) >= 80).length;
  const openTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
  const urgentTasks = tasks.filter(t => t.priority === "critical" && (t.status === "pending" || t.status === "in_progress")).length;
  const totalLeads = leads.length;

  const kpis = [
    { title: "Agents Active", value: "17 / 17", change: 100, changeLabel: "all departments online", icon: BarChart3, color: "blue" },
    { title: "Total Leads", value: totalLeads, change: totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 0, changeLabel: "hot leads", icon: Users, color: "violet" },
    { title: "Open Tasks", value: openTasks, change: urgentTasks, changeLabel: `${urgentTasks} critical`, icon: Zap, color: urgentTasks > 0 ? "amber" : "cyan" },
    { title: "Hot Leads 🔥", value: hotLeads, change: 32, changeLabel: "need contact <1hr", icon: TrendingUp, color: "emerald" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-8 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-5">
            <NexusBrain size={56} isThinking={false} />
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl lg:text-3xl font-bold text-white tracking-tight"
              >
                {greeting}{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-slate-500 mt-1"
              >
17 agents running autonomously · Cross-industry AI operating system
              </motion.p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              <span className="text-xs text-emerald-400 font-medium">All Systems Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 lg:px-10 pb-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <KPICard key={kpi.title} {...kpi} index={i} />
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart + Command */}
          <div className="lg:col-span-2 space-y-6">
            <PerformanceChart />
            <CommandBar />
          </div>

          {/* Right Column - Jarvis Status + Insights + Activity */}
          <div className="space-y-6">
            <JarvisStatus 
              briefing={briefings[0]} 
              healthScore={healthSnapshots[0]?.health_score || 85} 
            />
            <NexusStatus />
            <ProactiveSolver />
            {/* Proactive Insights */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Proactive Insights</h3>
                {insights.filter(i => i.status === "new").length > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-[10px] text-violet-400 font-medium">
                    {insights.filter(i => i.status === "new").length} new
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {insights.length > 0 ? (
                  insights.slice(0, 4).map((insight, i) => (
                    <InsightCard key={insight.id} insight={insight} index={i} />
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <Brain className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Nexus is analyzing your data...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4">
                <ActivityIcon className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {activities.length > 0 ? (
                  activities.slice(0, 6).map((activity, i) => (
                    <ActivityItem key={activity.id} activity={activity} index={i} />
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <ActivityIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">No recent activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modules + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">AI Modules</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {modules.length > 0 ? (
                modules.map((mod, i) => (
                  <ModuleCard key={mod.id} module={mod} index={i} />
                ))
              ) : (
                <div className="col-span-3 py-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <Zap className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">Enable modules to supercharge your business</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
            </div>
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}