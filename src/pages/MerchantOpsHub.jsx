import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { formatRuntimeOutput } from "@/lib/resultFormatter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShoppingBag, Loader2, PlayCircle, Sparkles, Package, Tag, Truck, Users } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "store_health", label: "Store Health" },
  { id: "commerce_kpi_command", label: "KPI Command" },
  { id: "sync_inventory", label: "Inventory Sync" },
  { id: "multi_echelon_forecast", label: "Multi-Echelon Forecast" },
  { id: "slow_mover_analysis", label: "Slow Movers" },
  { id: "dynamic_pricing", label: "Dynamic Pricing" },
  { id: "margin_analysis", label: "Margin Analysis" },
  { id: "promotion_planning", label: "Promotion Planning" },
  { id: "conversion_audit", label: "Conversion Audit" },
  { id: "personalization_engine", label: "Personalization" },
  { id: "order_fulfillment_optimizer", label: "Fulfillment" },
  { id: "fraud_analysis", label: "Fraud Analysis" },
  { id: "returns_command_center", label: "Returns Command" },
  { id: "loyalty_clv_engine", label: "Loyalty CLV" },
  { id: "marketplace_command_center", label: "Marketplace" },
  { id: "merchant_full_self_test", label: "Full Self Test" },
];

export default function MerchantOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [horizonDays, setHorizonDays] = useState(45);
  const [targetMargin, setTargetMargin] = useState("40%+");
  const [promotionType, setPromotionType] = useState("Flash sale + bundle");
  const [marketplaces, setMarketplaces] = useState("Amazon, eBay, TikTok Shop");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["merchant_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("merchantProductManagement", { action: "store_health" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Merchant", capability_id: capabilityId, runtime_params: runtimeParams },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("merchantProductManagement", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const healthScore = useMemo(() => healthData?.health_score ?? "--", [healthData]);
  const criticalAlerts = useMemo(() => healthData?.critical_alerts?.length ?? 0, [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Merchant")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Merchant
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Merchant Ops Hub</h1>
            <p className="text-sm text-slate-400">Autonomous commerce operations across product lifecycle, inventory, pricing, fulfillment, channels, and loyalty.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("merchant_full_self_test"); runTool.mutate({ action: "merchant_full_self_test" }); }}>
            {activeRun === "merchant_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Health Score</p><p className="text-2xl font-semibold text-cyan-300">{healthScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Critical Alerts</p><p className="text-2xl font-semibold text-rose-300">{criticalAlerts}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Top Actions</p><p className="text-2xl font-semibold text-amber-300">{healthData?.top_actions?.length ?? 0}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="pricing">Pricing/CX</TabsTrigger>
            <TabsTrigger value="fulfillment">Fulfillment/Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "multi_echelon_forecast") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { horizon_days: horizonDays } });
                      return;
                    }
                    if (cap.id === "dynamic_pricing") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { target_margin: targetMargin } });
                      return;
                    }
                    if (cap.id === "promotion_planning") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { promotion_type: promotionType } });
                      return;
                    }
                    if (cap.id === "marketplace_command_center") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { marketplaces } });
                      return;
                    }
                    runCapability.mutate({ capabilityId: cap.id });
                  }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Inventory Command</p>
              <Input type="number" value={horizonDays} onChange={(e) => setHorizonDays(Number(e.target.value || 0))} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("sync_inventory"); runTool.mutate({ action: "sync_inventory" }); }}>
                  {activeRun === "sync_inventory" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}Sync Inventory
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("multi_echelon_forecast"); runTool.mutate({ action: "multi_echelon_forecast", params: { horizon_days: horizonDays } }); }}>
                  {activeRun === "multi_echelon_forecast" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}Multi-Echelon Forecast
                </Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("slow_mover_analysis"); runTool.mutate({ action: "slow_mover_analysis" }); }}>
                  {activeRun === "slow_mover_analysis" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}Slow Movers
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Pricing + Conversion Engine</p>
              <Input value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} className="bg-black/30 border-white/10" />
              <Textarea value={promotionType} onChange={(e) => setPromotionType(e.target.value)} className="bg-black/30 border-white/10 min-h-[90px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("dynamic_pricing"); runTool.mutate({ action: "dynamic_pricing", params: { target_margin: targetMargin } }); }}>
                  {activeRun === "dynamic_pricing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tag className="w-4 h-4 mr-2" />}Dynamic Pricing
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("conversion_audit"); runTool.mutate({ action: "conversion_audit" }); }}>
                  {activeRun === "conversion_audit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingBag className="w-4 h-4 mr-2" />}Conversion Audit
                </Button>
                <Button variant="outline" className="border-pink-500/40 text-pink-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("promotion_planning"); runTool.mutate({ action: "promotion_planning", params: { promotion_type: promotionType } }); }}>
                  {activeRun === "promotion_planning" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tag className="w-4 h-4 mr-2" />}Promo Plan
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fulfillment" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Fulfillment + Channel Command</p>
              <Input value={marketplaces} onChange={(e) => setMarketplaces(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("order_fulfillment_optimizer"); runTool.mutate({ action: "order_fulfillment_optimizer" }); }}>
                  {activeRun === "order_fulfillment_optimizer" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}Fulfillment
                </Button>
                <Button className="bg-orange-600 hover:bg-orange-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("returns_command_center"); runTool.mutate({ action: "returns_command_center" }); }}>
                  {activeRun === "returns_command_center" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}Returns Command
                </Button>
                <Button variant="outline" className="border-violet-500/40 text-violet-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("marketplace_command_center"); runTool.mutate({ action: "marketplace_command_center", params: { marketplaces } }); }}>
                  {activeRun === "marketplace_command_center" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}Marketplace Command
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Capability Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(capabilityResult, "No capability run yet.")}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tool Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(toolResult, "No tool run yet.")}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}


