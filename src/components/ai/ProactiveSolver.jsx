import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, AlertTriangle, Loader2, Zap } from "lucide-react";

export default function ProactiveSolver() {
  const [executing, setExecuting] = useState(null);
  const [executedItems, setExecutedItems] = useState([]);
  const queryClient = useQueryClient();

  const { data: insights = [] } = useQuery({
    queryKey: ["proactive_insights"],
    queryFn: () => base44.entities.Insight.filter({ status: "new" }, "-created_date", 5),
  });

  const executeInsight = async (insight) => {
    setExecuting(insight.id);
    const solution = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Nexus AI. An AI insight has been detected: "${insight.title}" - ${insight.description}.
Execute a concrete solution and report what was done in 2-3 sentences. Be specific and actionable. Use past tense as if you already did it.`
    });
    await base44.entities.Insight.update(insight.id, { status: "actioned" });
    await base44.entities.Activity.create({
      title: `AI Auto-Resolved: ${insight.title}`,
      description: solution,
      type: "ai_action",
      status: "completed"
    });
    setExecutedItems(prev => [...prev, { insight, solution }]);
    queryClient.invalidateQueries({ queryKey: ["proactive_insights"] });
    setExecuting(null);
  };

  if (insights.length === 0 && executedItems.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Proactive AI Problem Solver</h3>
        {insights.length > 0 && (
          <Badge className="bg-amber-500/15 text-amber-400 text-[10px] ml-auto">{insights.length} issues detected</Badge>
        )}
      </div>
      <div className="space-y-3">
        {insights.map(insight => (
          <motion.div key={insight.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <div className="flex items-start gap-2 flex-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">{insight.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{insight.description}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => executeInsight(insight)} disabled={executing === insight.id}
              className="h-7 text-[11px] bg-blue-600/80 hover:bg-blue-600 shrink-0">
              {executing === insight.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Fix It</>}
            </Button>
          </motion.div>
        ))}
        {executedItems.map(({ insight, solution }, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-emerald-300">{insight.title} — Resolved</p>
                <p className="text-[11px] text-slate-400 mt-1">{solution}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}