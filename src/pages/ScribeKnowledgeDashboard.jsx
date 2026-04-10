import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, BarChart3, ShieldCheck, Network, Sparkles } from "lucide-react";

export default function ScribeKnowledgeDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["scribe_knowledge_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("scribeKnowledgeBase", { action: "scribe_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const improvements = data?.health?.improvements || [];
  const gaps = data?.gaps?.critical_gaps || [];
  const governance = data?.governance || {};

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("ScribeOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Scribe Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Scribe Knowledge Dashboard</h1>
            <p className="text-sm text-slate-400">Executive view of knowledge health, gaps, synthesis readiness, and governance posture.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-cyan-300">{data?.health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Gaps</p><p className="text-2xl font-semibold text-rose-300">{gaps.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Audit Trail Score</p><p className="text-2xl font-semibold text-amber-300">{governance?.audit_trail_score ?? "--"}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Improvement Backlog</p></div>
            <div className="space-y-2">
              {improvements.length === 0 && <p className="text-xs text-slate-500">No improvements surfaced yet.</p>}
              {improvements.map((x, i) => <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-200">{x}</div>)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Network className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Critical Knowledge Gaps</p></div>
            <div className="space-y-2">
              {gaps.length === 0 && <p className="text-xs text-slate-500">No critical gaps reported.</p>}
              {gaps.map((g, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-xs text-rose-200">{typeof g === "string" ? g : `${g.area || "Gap"}: ${g.why_critical || "Needs coverage"}`}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Digest Module</p></div>
            <HumanDataPanel data={data?.digest} emptyText="Digest data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Synthesis Module</p></div>
            <HumanDataPanel data={data?.synth} emptyText="Synthesis data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Governance Module</p></div>
            <HumanDataPanel data={data?.governance} emptyText="Governance data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}
