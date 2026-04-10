import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FlaskConical, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function CommandScenarioPlanner() {
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runScenario = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('commandCenterIntelligence', {
        action: 'scenario_modeling',
        params: { scenario, variables: {} }
      });
      setResult(res.data?.result);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const EXAMPLE_SCENARIOS = [
    "What if we increase marketing budget by 30%?",
    "What happens if we launch a new service line next quarter?",
    "What if we hire 3 more support workers in the next 6 weeks?",
    "Model the impact of raising prices by 10% across all services",
  ];

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
        <p className="text-xs font-semibold text-white">Multi-Agent Scenario Modeler</p>
      </div>

      {!result ? (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {EXAMPLE_SCENARIOS.map((s, i) => (
              <button key={i} onClick={() => setScenario(s)}
                className="text-[9px] px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea value={scenario} onChange={e => setScenario(e.target.value)}
              placeholder="Describe a scenario to model across all agents..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 text-xs resize-none min-h-[60px]"
              rows={2} />
            <Button onClick={runScenario} disabled={!scenario.trim() || loading}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 flex-shrink-0 self-end" size="sm">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Model"}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-slate-400 mb-1">Summary</p>
            <p className="text-xs text-slate-200">{result.scenario_summary}</p>
          </div>

          {result.financial_model && (
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Optimistic", value: result.financial_model.optimistic_revenue, color: "text-emerald-400" },
                { label: "Base Case", value: result.financial_model.base_revenue, color: "text-blue-400" },
                { label: "Pessimistic", value: result.financial_model.pessimistic_revenue, color: "text-red-400" },
              ].map(s => (
                <div key={s.label} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className={`text-sm font-bold ${s.color}`}>
                    {s.value ? `$${(s.value / 1000).toFixed(0)}k` : '—'}
                  </p>
                  <p className="text-[8px] text-slate-600">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {result.recommendation && (
            <div className={`flex items-start gap-2 p-2 rounded-xl ${result.recommendation.toLowerCase().includes('go') ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              {result.recommendation.toLowerCase().includes('go') ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-[10px] text-slate-200">{result.recommendation}</p>
            </div>
          )}

          <div className="flex gap-2">
            {result.key_risks?.slice(0, 2).map((r, i) => (
              <div key={i} className="flex-1 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-[8px] text-red-400 font-medium mb-0.5">Risk</p>
                <p className="text-[9px] text-slate-400">{r.slice(0, 60)}</p>
              </div>
            ))}
          </div>

          <button onClick={() => { setResult(null); setScenario(""); }}
            className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
            ← Run another scenario
          </button>
        </div>
      )}
    </div>
  );
}
