import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Package, Tag, Truck, BarChart3 } from "lucide-react";

export default function MerchantCommerceDashboard() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["merchant_commerce_dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("merchantProductManagement", { action: "merchant_full_self_test" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const checks = data?.checks || {};
  const passCount = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);
  const totalChecks = useMemo(() => Object.keys(checks).length, [checks]);

  const health = data?.health || {};
  const inventory = data?.inventory || {};
  const pricing = data?.pricing || {};
  const fulfillment = data?.fulfillment || {};
  const loyalty = data?.loyalty || [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("MerchantOpsHub")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Merchant Ops
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Merchant Commerce Dashboard</h1>
            <p className="text-sm text-slate-400">Executive view across store health, inventory pressure, pricing posture, fulfillment readiness, and loyalty growth.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Self-Test</p><p className="text-2xl font-semibold text-white">{passCount}/{totalChecks || "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-rose-300">{health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Stockout Risk</p><p className="text-2xl font-semibold text-emerald-300">{(inventory?.stockout_risk || []).length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Pricing Opportunities</p><p className="text-2xl font-semibold text-amber-300">{(pricing?.opportunities || []).length}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-rose-300" /><p className="text-sm font-semibold text-white">Inventory and Fulfillment Alerts</p></div>
            <div className="space-y-2">
              {(inventory?.stockout_risk || []).length === 0 && <p className="text-xs text-slate-500">No stockout alerts generated yet.</p>}
              {(inventory?.stockout_risk || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{item}</div>
              ))}
              {(fulfillment?.bottlenecks || []).slice(0, 3).map((item, i) => (
                <div key={`f-${i}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-violet-300" /><p className="text-sm font-semibold text-white">Pricing and Loyalty Opportunities</p></div>
            <div className="space-y-2">
              {(pricing?.opportunities || []).length === 0 && <p className="text-xs text-slate-500">No pricing opportunities generated yet.</p>}
              {(pricing?.opportunities || []).map((item, i) => (
                <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">{item}</div>
              ))}
              {(loyalty?.win_back_priorities || []).slice(0, 3).map((item, i) => (
                <div key={`l-${i}`} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-200">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Health Module</p></div>
            <HumanDataPanel data={health} emptyText="Health data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold text-white">Inventory and Pricing Module</p></div>
            <HumanDataPanel data={{ inventory, pricing }} emptyText="Inventory/pricing data not available yet." />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><Truck className="w-4 h-4 text-amber-300" /><p className="text-sm font-semibold text-white">Fulfillment and Loyalty Module</p></div>
            <HumanDataPanel data={{ fulfillment, loyalty }} emptyText="Fulfillment/loyalty data not available yet." />
          </div>
        </div>
      </div>
    </div>
  );
}


