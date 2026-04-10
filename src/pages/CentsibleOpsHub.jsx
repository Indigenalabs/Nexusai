import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import HumanDataPanel from "@/components/ui/HumanDataPanel";
import { ArrowLeft, Loader2, PlayCircle, TrendingUp, Shield, DollarSign, Plug } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "finance_health", label: "Finance Health" },
  { id: "cash_forecast", label: "Cash Forecast" },
  { id: "anomaly_detection", label: "Anomaly Detection" },
  { id: "driver_based_planning", label: "Driver Planning" },
  { id: "long_range_planning", label: "Long-Range Plan" },
  { id: "treasury_liquidity_optimizer", label: "Treasury Optimizer" },
  { id: "arr_mrr_analytics", label: "ARR/MRR" },
  { id: "revenue_leakage_scan", label: "Leakage Scan" },
  { id: "internal_controls_monitor", label: "Controls Monitor" },
  { id: "board_deck_briefing", label: "Board Briefing" },
  { id: "centsible_connector_test", label: "Connector Test" },
];

const DEFAULT_CONNECTOR = {
  provider: "quickbooks",
  auth_type: "oauth2",
  account_label: "Primary Finance Org",
  tenant_id: "",
  realm_id: "",
  api_base_url: "",
  client_id: "",
  api_key_secret_name: "CENTSIBLE_API_KEY",
  client_secret_name: "CENTSIBLE_CLIENT_SECRET",
  refresh_token_secret_name: "CENTSIBLE_REFRESH_TOKEN",
};

export default function CentsibleOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [result, setResult] = useState(null);

  const [driversRaw, setDriversRaw] = useState('{"new_customers":40,"churn_pct":3,"avg_revenue_per_customer":1200}');
  const [strategyRaw, setStrategyRaw] = useState('{"expansion":"APAC","hiring_plan":"10 headcount"}');
  const [controlsRaw, setControlsRaw] = useState('{"segregation_of_duties":true,"approval_threshold":5000}');
  const [boardFocus, setBoardFocus] = useState("growth efficiency and runway");
  const [connector, setConnector] = useState(DEFAULT_CONNECTOR);

  const { data: health, refetch } = useQuery({
    queryKey: ["centsible_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("centsibleFinanceEngine", { action: "financial_health_check" });
      return res.data?.result || {};
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Centsible", capability_id: capabilityId },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveRun("");
      refetch();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("centsibleFinanceEngine", { action, ...params });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveRun("");
      refetch();
      if (data?.action === "centsible_connector_load" && data?.result?.exists && data?.result?.connector) {
        const loaded = data.result.connector;
        const refs = data.result.secret_refs || {};
        setConnector((prev) => ({
          ...prev,
          ...loaded,
          api_key_secret_name: refs.api_key_secret_name || prev.api_key_secret_name,
          client_secret_name: refs.client_secret_name || prev.client_secret_name,
          refresh_token_secret_name: refs.refresh_token_secret_name || prev.refresh_token_secret_name,
        }));
      }
    },
    onError: () => setActiveRun(""),
  });

  const parsedDrivers = useMemo(() => { try { return JSON.parse(driversRaw || "{}"); } catch { return {}; } }, [driversRaw]);
  const parsedStrategy = useMemo(() => { try { return JSON.parse(strategyRaw || "{}"); } catch { return {}; } }, [strategyRaw]);
  const parsedControls = useMemo(() => { try { return JSON.parse(controlsRaw || "{}"); } catch { return {}; } }, [controlsRaw]);

  const connectorStatus = result?.action === "centsible_connector_test" ? result?.result : null;
  const updateConnector = (key, value) => setConnector((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to={createPageUrl("Centsible")} className="inline-flex items-center text-xs text-slate-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Centsible</Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Centsible Ops Hub</h1>
            <p className="text-sm text-slate-400">Autonomous FP&A, treasury, risk, and stakeholder finance operations.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("financial_health_check"); runTool.mutate({ action: "financial_health_check" }); }}>
            {activeRun === "financial_health_check" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Run Health Cycle
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Finance Health</p><p className="text-xl font-semibold text-white">{health?.health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Net Profit</p><p className="text-xl font-semibold text-white">{health?.net_profit ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Cash Flow</p><p className="text-xl font-semibold text-white">{health?.cash_flow_status || "pending"}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.03] border border-white/10 h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="treasury">Treasury</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/20 text-slate-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="planning" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Driver-Based Planning</p>
                <Textarea value={driversRaw} onChange={(e) => setDriversRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[140px]" />
                <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => { setActiveRun("driver_based_planning"); runTool.mutate({ action: "driver_based_planning", params: { drivers: parsedDrivers } }); }} disabled={runTool.isPending || runCapability.isPending}>
                  {activeRun === "driver_based_planning" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}Run Driver Plan
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Long-Range Planning</p>
                <Textarea value={strategyRaw} onChange={(e) => setStrategyRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[140px]" />
                <Button className="bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => { setActiveRun("long_range_planning"); runTool.mutate({ action: "long_range_planning", params: { strategy: parsedStrategy } }); }} disabled={runTool.isPending || runCapability.isPending}>
                  {activeRun === "long_range_planning" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}Run LRP
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="treasury" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Treasury & Revenue Quality</p>
              <div className="flex gap-2 flex-wrap">
                <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => { setActiveRun("treasury_liquidity_optimizer"); runTool.mutate({ action: "treasury_liquidity_optimizer", params: { rate_environment: "current" } }); }} disabled={runTool.isPending || runCapability.isPending}>{activeRun === "treasury_liquidity_optimizer" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}Treasury Optimizer</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => { setActiveRun("arr_mrr_analytics"); runTool.mutate({ action: "arr_mrr_analytics" }); }} disabled={runTool.isPending || runCapability.isPending}>{activeRun === "arr_mrr_analytics" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}ARR/MRR Analytics</Button>
                <Button className="bg-amber-600 hover:bg-amber-500" onClick={() => { setActiveRun("revenue_leakage_scan"); runTool.mutate({ action: "revenue_leakage_scan" }); }} disabled={runTool.isPending || runCapability.isPending}>{activeRun === "revenue_leakage_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Leakage Scan</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Internal Controls Monitor</p>
                <Textarea value={controlsRaw} onChange={(e) => setControlsRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[130px]" />
                <Button className="bg-rose-600 hover:bg-rose-500" onClick={() => { setActiveRun("internal_controls_monitor"); runTool.mutate({ action: "internal_controls_monitor", params: { controls: parsedControls } }); }} disabled={runTool.isPending || runCapability.isPending}>{activeRun === "internal_controls_monitor" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Run Controls Audit</Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Board Deck Briefing</p>
                <Input value={boardFocus} onChange={(e) => setBoardFocus(e.target.value)} className="bg-black/30 border-white/10" />
                <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => { setActiveRun("board_deck_briefing"); runTool.mutate({ action: "board_deck_briefing", params: { board_focus: boardFocus } }); }} disabled={runTool.isPending || runCapability.isPending}>{activeRun === "board_deck_briefing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}Generate Board Brief</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connectors" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2"><Plug className="w-4 h-4 text-cyan-300" /><p className="text-sm text-white font-semibold">Finance Connector</p></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Input value={connector.provider} onChange={(e) => updateConnector("provider", e.target.value)} placeholder="Provider (quickbooks/xero/plaid/stripe)" className="bg-black/30 border-white/10" />
                <Input value={connector.auth_type} onChange={(e) => updateConnector("auth_type", e.target.value)} placeholder="Auth type (oauth2/api_key)" className="bg-black/30 border-white/10" />
                <Input value={connector.account_label} onChange={(e) => updateConnector("account_label", e.target.value)} placeholder="Account label" className="bg-black/30 border-white/10" />
                <Input value={connector.client_id} onChange={(e) => updateConnector("client_id", e.target.value)} placeholder="Client ID" className="bg-black/30 border-white/10" />
                <Input value={connector.tenant_id} onChange={(e) => updateConnector("tenant_id", e.target.value)} placeholder="Tenant ID (Xero)" className="bg-black/30 border-white/10" />
                <Input value={connector.realm_id} onChange={(e) => updateConnector("realm_id", e.target.value)} placeholder="Realm ID (QuickBooks)" className="bg-black/30 border-white/10" />
                <Input value={connector.api_base_url} onChange={(e) => updateConnector("api_base_url", e.target.value)} placeholder="API base URL" className="bg-black/30 border-white/10" />
                <Input value={connector.api_key_secret_name} onChange={(e) => updateConnector("api_key_secret_name", e.target.value)} placeholder="API key secret ref" className="bg-black/30 border-white/10" />
                <Input value={connector.client_secret_name} onChange={(e) => updateConnector("client_secret_name", e.target.value)} placeholder="Client secret ref" className="bg-black/30 border-white/10" />
                <Input value={connector.refresh_token_secret_name} onChange={(e) => updateConnector("refresh_token_secret_name", e.target.value)} placeholder="Refresh token secret ref" className="bg-black/30 border-white/10" />
              </div>
              <p className="text-[11px] text-slate-500">Secret values are never stored. Register secret references only.</p>
              <div className="flex items-center gap-2">
                {connectorStatus && <Badge className={connectorStatus.connected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}>{connectorStatus.connected ? "Connected" : "Needs Fix"}</Badge>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("centsible_connector_load"); runTool.mutate({ action: "centsible_connector_load" }); }}>{activeRun === "centsible_connector_load" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Load Current</Button>
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("centsible_connector_save"); runTool.mutate({ action: "centsible_connector_save", params: { connector } }); }}>{activeRun === "centsible_connector_save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Save Settings</Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("centsible_connector_register_secret_refs"); runTool.mutate({ action: "centsible_connector_register_secret_refs", params: { secret_refs: { api_key_secret_name: connector.api_key_secret_name, client_secret_name: connector.client_secret_name, refresh_token_secret_name: connector.refresh_token_secret_name } } }); }}>{activeRun === "centsible_connector_register_secret_refs" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Register Secret Refs</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("centsible_connector_test"); runTool.mutate({ action: "centsible_connector_test" }); }}>{activeRun === "centsible_connector_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}Test Connection</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Last Result</p>
            <HumanDataPanel data={result} emptyText="No result yet." />
          </div>
        )}
      </div>
    </div>
  );
}

