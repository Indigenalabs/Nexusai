import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FlaskConical, Loader2, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PRESET_SCENARIOS = [
  { title: "Launch a new product line", description: "Introduce a new product with $50K marketing budget" },
  { title: "Increase prices by 15%", description: "Raise pricing across all tiers" },
  { title: "Hire 3 new team members", description: "Expand sales and operations team" },
  { title: "Enter a new geographic market", description: "Expand to a new city or country" },
  { title: "Cut marketing spend by 30%", description: "Reduce marketing budget due to cash constraints" },
];

export default function ScenarioPlanner() {
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [_history, setHistory] = useState([]);

  const { data: financials = [] } = useQuery({
    queryKey: ["financials_scenario"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 6),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients_scenario"],
    queryFn: () => base44.entities.Client.list("-updated_date", 30),
  });

  const runSimulation = async () => {
    if (!scenarioTitle.trim()) return;
    setLoading(true);
    const avgRevenue = financials.length ? financials.reduce((s, f) => s + (f.revenue || 0), 0) / financials.length : 0;
    const activeClients = clients.filter(c => c.status === "active").length;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a business simulation AI. Run a what-if scenario for this business.

Current Business State:
- Average monthly revenue: $${avgRevenue.toFixed(0)}
- Active clients: ${activeClients}
- Cash balance (latest): $${financials[0]?.cash_balance || "unknown"}
- Financial health score: ${financials[0]?.health_score || "unknown"}

Scenario to Simulate:
Title: "${scenarioTitle}"
Description: "${scenarioDesc}"

Simulate the realistic impact of this scenario over 3, 6, and 12 months. Be specific with numbers.

Return as JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          impact_3m: { type: "object", properties: { revenue_change_pct: { type: "number" }, description: { type: "string" } } },
          impact_6m: { type: "object", properties: { revenue_change_pct: { type: "number" }, description: { type: "string" } } },
          impact_12m: { type: "object", properties: { revenue_change_pct: { type: "number" }, description: { type: "string" } } },
          pros: { type: "array", items: { type: "string" } },
          cons: { type: "array", items: { type: "string" } },
          verdict: { type: "string", enum: ["strongly_recommended", "recommended", "neutral", "risky", "not_recommended"] },
          next_steps: { type: "array", items: { type: "string" } }
        }
      }
    });

    const simulation = { title: scenarioTitle, result: res, timestamp: new Date() };
    setResult(res);
    setHistory(prev => [simulation, ...prev.slice(0, 4)]);
    setLoading(false);
  };

  const verdictConfig = {
    strongly_recommended: { color: "emerald", label: "Strongly Recommended", icon: CheckCircle2 },
    recommended: { color: "blue", label: "Recommended", icon: CheckCircle2 },
    neutral: { color: "slate", label: "Neutral", icon: AlertTriangle },
    risky: { color: "amber", label: "Risky", icon: AlertTriangle },
    not_recommended: { color: "red", label: "Not Recommended", icon: TrendingDown },
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-8">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FlaskConical className="w-5 h-5 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Scenario Planner</h1>
            <p className="text-sm text-slate-500">Simulate business decisions before you make them</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Define Scenario</h3>
              <div className="space-y-3">
                <Input value={scenarioTitle} onChange={e => setScenarioTitle(e.target.value)}
                  placeholder="e.g. Launch new product" className="bg-white/[0.04] border-white/[0.08] text-white" />
                <Textarea value={scenarioDesc} onChange={e => setScenarioDesc(e.target.value)}
                  placeholder="Describe the scenario in detail..." className="bg-white/[0.04] border-white/[0.08] text-white h-24" />
                <Button onClick={runSimulation} disabled={loading || !scenarioTitle.trim()} className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Simulating...</> : <><FlaskConical className="w-4 h-4 mr-2" />Run Simulation</>}
                </Button>
              </div>
            </div>

            {/* Presets */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-xs text-slate-400 mb-3">Quick Scenarios</h3>
              <div className="space-y-2">
                {PRESET_SCENARIOS.map((s, i) => (
                  <button key={i} onClick={() => { setScenarioTitle(s.title); setScenarioDesc(s.description); }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-xs text-slate-400 hover:text-white transition-all">
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {!result && !loading && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center h-full flex items-center justify-center flex-col">
                <FlaskConical className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Run a scenario simulation to see AI-powered predictions</p>
              </div>
            )}
            {loading && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center h-full flex items-center justify-center flex-col">
                <Loader2 className="w-10 h-10 text-violet-400 animate-spin mb-4" />
                <p className="text-white font-medium">Running simulation...</p>
              </div>
            )}
            {result && (() => {
              const vConfig = verdictConfig[result.verdict] || verdictConfig.neutral;
              const VerdictIcon = vConfig.icon;
              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Verdict */}
                  <div className={`rounded-2xl bg-${vConfig.color}-500/10 border border-${vConfig.color}-500/20 p-5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <VerdictIcon className={`w-5 h-5 text-${vConfig.color}-400`} />
                      <span className={`font-semibold text-${vConfig.color}-300`}>{vConfig.label}</span>
                    </div>
                    <p className="text-sm text-slate-300">{result.summary}</p>
                  </div>

                  {/* Impact Timeline */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "3 Month Impact", data: result.impact_3m },
                      { label: "6 Month Impact", data: result.impact_6m },
                      { label: "12 Month Impact", data: result.impact_12m },
                    ].map(({ label, data }) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <p className="text-xs text-slate-400 mb-1">{label}</p>
                        <p className={`text-xl font-bold ${data?.revenue_change_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {data?.revenue_change_pct >= 0 ? "+" : ""}{data?.revenue_change_pct}%
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">{data?.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs text-emerald-400 font-medium mb-2">✓ Pros</p>
                      <ul className="space-y-1.5">{result.pros?.map((p, i) => <li key={i} className="text-xs text-slate-400">• {p}</li>)}</ul>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs text-red-400 font-medium mb-2">✗ Cons</p>
                      <ul className="space-y-1.5">{result.cons?.map((c, i) => <li key={i} className="text-xs text-slate-400">• {c}</li>)}</ul>
                    </div>
                  </div>

                  {/* Next Steps */}
                  {result.next_steps?.length > 0 && (
                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                      <p className="text-xs text-blue-400 font-medium mb-2">Recommended Next Steps</p>
                      <ol className="space-y-1">{result.next_steps.map((s, i) => <li key={i} className="text-xs text-slate-300">{i+1}. {s}</li>)}</ol>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
