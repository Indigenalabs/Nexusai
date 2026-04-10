import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, ArrowLeft, RefreshCw, Trash2, Mail, Users, Sparkles, Zap, Play, Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const categoryIcons = {
  workflow: { icon: Zap, color: "blue" },
  ai_behavior: { icon: Brain, color: "violet" },
  notifications: { icon: Mail, color: "amber" },
  communication: { icon: Users, color: "emerald" },
  ui: { icon: Sparkles, color: "cyan" },
};

const keyLabels = {
  auto_approve_invoice_threshold: "Auto-approve Invoice Threshold",
  optimal_post_time: "Optimal Post Time",
  best_content_type: "Best Content Type",
  best_platform: "Best Social Platform",
  email_response_rate_pct: "Email Response Rate",
  default_followup_interval_days: "Client Follow-up Interval",
};

export default function Preferences() {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: preferences = [] } = useQuery({
    queryKey: ["preferences"],
    queryFn: () => base44.entities.UserPreference.list("-created_date", 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserPreference.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["preferences"] }),
  });

  const handleRunLearning = async () => {
    setRunning(true);
    setRunResult(null);
    const res = await base44.functions.invoke("learningEngine", {});
    setRunResult(res.data);
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ["preferences"] });
  };

  const grouped = preferences.reduce((acc, pref) => {
    if (!acc[pref.category]) acc[pref.category] = [];
    acc[pref.category].push(pref);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Brain className="w-5 h-5 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">AI Learned Preferences</h1>
              <p className="text-sm text-slate-500">What Nexus has learned from your behaviour</p>
            </div>
          </div>
          <Button
            onClick={handleRunLearning}
            disabled={running}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {running ? "Learning..." : "Run Learning Engine"}
          </Button>
        </div>

        {runResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20"
          >
            <p className="text-sm text-violet-300 font-medium">
              ✓ Learning complete — {runResult.learnings_count} new preferences learned
            </p>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Preferences", value: preferences.length, color: "violet" },
            { label: "From Behaviour", value: preferences.filter(p => p.learned_from === 'behavior').length, color: "blue" },
            { label: "High Confidence", value: preferences.filter(p => (p.confidence || 0) >= 80).length, color: "emerald" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Preferences by Category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No preferences learned yet</h3>
            <p className="text-sm text-slate-500 mb-4">Run the Learning Engine to have Nexus analyse your behaviour</p>
            <Button onClick={handleRunLearning} className="bg-violet-600 hover:bg-violet-500">
              <Play className="w-4 h-4 mr-2" /> Run Now
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, prefs]) => {
              const cat = categoryIcons[category] || { icon: Brain, color: "slate" };
              const CatIcon = cat.icon;
              return (
                <div key={category} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CatIcon className={`w-4 h-4 text-${cat.color}-400`} />
                    <h3 className="text-sm font-semibold text-white capitalize">{category.replace('_', ' ')}</h3>
                    <Badge className="ml-auto bg-white/[0.05] text-slate-400 text-[10px]">
                      {prefs.length} preferences
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {prefs.map((pref, i) => (
                      <motion.div
                        key={pref.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">
                            {keyLabels[pref.key] || pref.key}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-xs font-mono text-${cat.color}-400`}>{pref.value}</span>
                            {pref.confidence && (
                              <Badge className="bg-white/[0.05] text-slate-500 text-[9px]">
                                {pref.confidence}% confidence
                              </Badge>
                            )}
                            {pref.learned_from && (
                              <span className="text-[10px] text-slate-600 capitalize">
                                learned from {pref.learned_from}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Confidence bar */}
                          <div className="w-16 h-1 rounded-full bg-white/[0.08]">
                            <div
                              className={`h-full bg-${cat.color}-400 rounded-full`}
                              style={{ width: `${pref.confidence || 50}%` }}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(pref.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}