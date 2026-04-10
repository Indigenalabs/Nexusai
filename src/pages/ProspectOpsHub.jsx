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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, Loader2, PlayCircle, Sparkles, Radar, Database, Send, CalendarClock, PhoneCall, Mail, Plug } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "prospect_health_snapshot", label: "Health Snapshot" },
  { id: "signal_radar_scan", label: "Signal Radar" },
  { id: "enrichment_queue_engine", label: "Enrichment Queue" },
  { id: "intent_scoring_matrix", label: "Intent Matrix" },
  { id: "outreach_sequence_orchestrator", label: "Outreach Orchestrator" },
  { id: "crm_sync_hygiene", label: "CRM Hygiene" },
  { id: "abm_command_center", label: "ABM Command" },
  { id: "meeting_handoff_router", label: "Meeting Router" },
  { id: "prospect_alerting_escalation", label: "Alert Escalation" },
  { id: "prospect_full_self_test", label: "Full Self Test" },
  { id: "omnichannel_discovery_grid", label: "Discovery Grid" },
  { id: "lookalike_model_builder", label: "Lookalike Builder" },
  { id: "psychographic_profile", label: "Psychographic" },
  { id: "buying_committee_mapper", label: "Committee Mapper" },
  { id: "deliverability_guardian", label: "Deliverability" },
  { id: "ai_voice_call_playbook", label: "Voice Playbook" },
  { id: "deal_stage_prediction", label: "Stage Prediction" },
  { id: "revenue_forecast_engine", label: "Revenue Forecast" },
  { id: "partner_channel_command", label: "Partner Command" },
  { id: "sales_conversation_console", label: "Conversation Console" },
  { id: "autonomous_email_manager", label: "Email Manager" },
  { id: "inbox_connector_test", label: "Connector Test" },
  { id: "prospect_autonomous_revenue_run", label: "Autonomous Revenue Run" },
];

const DEFAULT_CONNECTOR = {
  provider: "gmail",
  inbox_address: "sales@company.com",
  auth_type: "oauth2",
  host: "",
  port: 993,
  username: "",
  secure: true,
  client_id: "",
  tenant_id: "",
  api_base_url: "",
  token_secret_name: "PROSPECT_EMAIL_TOKEN",
  client_secret_name: "PROSPECT_CLIENT_SECRET",
  password_secret_name: "PROSPECT_IMAP_PASSWORD",
};

export default function ProspectOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [industry, setIndustry] = useState("B2B SaaS");
  const [urgencyBias, setUrgencyBias] = useState("balanced");
  const [segment, setSegment] = useState("Qualified leads with score 70+");
  const [goal, setGoal] = useState("Book meetings in the next 7 days");
  const [notes, setNotes] = useState("Focus on warm intros and high-intent triggers.");

  const [persona, setPersona] = useState("Head of Operations");
  const [framework, setFramework] = useState("BANT");
  const [objection, setObjection] = useState("too expensive");

  const [emailVoice, setEmailVoice] = useState("confident, concise, helpful");
  const [emailSignature, setEmailSignature] = useState("Prospect Revenue Team");
  const [emailInboxRaw, setEmailInboxRaw] = useState(
    "lead@acme.com | Pricing question | Can you share pricing tiers and onboarding timeline?\n" +
    "ops@globex.com | Demo request | We are evaluating tools this week and want a walkthrough."
  );

  const [connector, setConnector] = useState(DEFAULT_CONNECTOR);

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["prospect_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("prospectLeadGeneration", { action: "prospect_health_snapshot" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const { data: runHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["prospect_ops_history"],
    queryFn: async () => {
      const res = await base44.functions.invoke("prospectLeadGeneration", { action: "prospect_run_history" });
      return res.data?.history || [];
    },
    staleTime: 30000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Prospect", capability_id: capabilityId },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchHealth();
      refetchHistory();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("prospectLeadGeneration", { action, ...params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      if (data?.action === "inbox_connector_load" && data?.result?.exists && data?.result?.connector) {
        setConnector((prev) => ({ ...prev, ...data.result.connector, token_secret_name: data.result.secret_refs?.token_secret_name || prev.token_secret_name, client_secret_name: data.result.secret_refs?.client_secret_name || prev.client_secret_name, password_secret_name: data.result.secret_refs?.password_secret_name || prev.password_secret_name }));
      }
      setActiveRun("");
      refetchHealth();
      refetchHistory();
    },
    onError: () => setActiveRun(""),
  });

  const priorities = useMemo(() => {
    if (!healthData) return [];
    const items = [];
    if ((healthData.lead_health?.hot || 0) > 0) items.push(`Prioritize ${healthData.lead_health.hot} hot leads for immediate outreach.`);
    if ((healthData.by_status?.new || 0) > 20) items.push("Large new-lead backlog detected. Run enrichment queue + scoring sweep.");
    if ((healthData.conversion_rate || 0) < 8) items.push("Conversion rate is low. Run funnel analysis and sequence optimization.");
    return items;
  }, [healthData]);

  const parsedInbox = useMemo(() => {
    return emailInboxRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          from: parts[0] || "unknown@domain.com",
          subject: parts[1] || "General inquiry",
          body: parts.slice(2).join(" | ") || "No body provided",
        };
      });
  }, [emailInboxRaw]);

  const connectorStatus = toolResult?.action === "inbox_connector_test" ? toolResult?.result : null;

  const updateConnector = (field, value) => {
    setConnector((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Prospect")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/25">
              <Bot className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Prospect Ops Hub</h1>
              <p className="text-sm text-slate-500">Discovery, conversation console, email autonomy, connectors, ABM, and revenue intelligence</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetchHealth()} className="border-white/10 text-slate-300">Refresh Health</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4"><p className="text-[11px] text-slate-400">Health Score</p><p className="text-2xl font-bold text-blue-300">{healthLoading ? "..." : (healthData?.health_score ?? "-")}</p></div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4"><p className="text-[11px] text-slate-400">Total Leads</p><p className="text-2xl font-bold text-violet-300">{healthData?.lead_health?.total ?? "-"}</p></div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"><p className="text-[11px] text-slate-400">Hot Leads</p><p className="text-2xl font-bold text-amber-300">{healthData?.lead_health?.hot ?? "-"}</p></div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"><p className="text-[11px] text-slate-400">Conversion Rate</p><p className="text-2xl font-bold text-emerald-300">{healthData?.conversion_rate ? `${healthData.conversion_rate}%` : "-"}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] flex-wrap h-auto">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="radar">Signal Radar</TabsTrigger>
            <TabsTrigger value="outreach">Outreach Plan</TabsTrigger>
            <TabsTrigger value="conversations">Conversation Console</TabsTrigger>
            <TabsTrigger value="email">Autonomous Email</TabsTrigger>
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><p className="text-sm text-white font-semibold">Prospect Capabilities</p><div className="flex gap-2 flex-wrap">{QUICK_CAPABILITIES.map((cap) => (<Button key={cap.id} size="sm" onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }} className="bg-blue-600/80 hover:bg-blue-500 text-white" disabled={runCapability.isPending || runTool.isPending}>{activeRun === cap.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}{cap.label}</Button>))}</div>{priorities.length > 0 && (<div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-white font-semibold mb-2">Priority Queue</p>{priorities.map((p, i) => <p key={i} className="text-xs text-slate-400">{i + 1}. {p}</p>)}</div>)}</div></TabsContent>

          <TabsContent value="radar" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><p className="text-sm text-white font-semibold">Real-Time Signal Radar</p><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="bg-black/30 border-white/10" /><Input value={urgencyBias} onChange={(e) => setUrgencyBias(e.target.value)} placeholder="Urgency bias (balanced/aggressive/conservative)" className="bg-black/30 border-white/10" /><Button onClick={() => { setActiveRun("signal_radar_scan"); runTool.mutate({ action: "signal_radar_scan", params: { industry, urgency_bias: urgencyBias } }); }} disabled={runTool.isPending || runCapability.isPending} className="bg-violet-600 hover:bg-violet-500">{activeRun === "signal_radar_scan" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radar className="w-4 h-4 mr-2" />}Run Radar Scan</Button><Button variant="outline" className="border-purple-500/40 text-purple-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("prospect_autonomous_revenue_run"); runTool.mutate({ action: "prospect_autonomous_revenue_run", params: { industry, urgency_bias: urgencyBias } }); }}>{activeRun === "prospect_autonomous_revenue_run" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Autonomous Revenue Run</Button></div></TabsContent>

          <TabsContent value="outreach" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><p className="text-sm text-white font-semibold">Outreach Sequence Control</p><Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Segment" className="bg-black/30 border-white/10" /><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className="bg-black/30 border-white/10" /><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="bg-black/30 border-white/10 min-h-[100px]" /><div className="flex gap-2"><Button onClick={() => { setActiveRun("outreach_sequence_orchestrator"); runTool.mutate({ action: "outreach_sequence_orchestrator", params: { segment, goal, notes } }); }} disabled={runTool.isPending || runCapability.isPending} className="bg-emerald-600 hover:bg-emerald-500">{activeRun === "outreach_sequence_orchestrator" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Build Sequence</Button><Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("meeting_handoff_router"); runTool.mutate({ action: "meeting_handoff_router", params: {} }); }}>{activeRun === "meeting_handoff_router" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}Route Meetings</Button></div></div></TabsContent>

          <TabsContent value="conversations" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><p className="text-sm text-white font-semibold">Sales Conversation Console</p><Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Persona" className="bg-black/30 border-white/10" /><Input value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="Framework (BANT/MEDDIC/SPICED)" className="bg-black/30 border-white/10" /><Input value={objection} onChange={(e) => setObjection(e.target.value)} placeholder="Primary objection" className="bg-black/30 border-white/10" /><Button onClick={() => { setActiveRun("sales_conversation_console"); runTool.mutate({ action: "sales_conversation_console", params: { persona, framework, objection, offer: goal } }); }} disabled={runTool.isPending || runCapability.isPending} className="bg-orange-600 hover:bg-orange-500">{activeRun === "sales_conversation_console" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhoneCall className="w-4 h-4 mr-2" />}Build Conversation Pack</Button></div></TabsContent>

          <TabsContent value="email" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><p className="text-sm text-white font-semibold">Autonomous Email Manager</p><Input value={emailVoice} onChange={(e) => setEmailVoice(e.target.value)} placeholder="Brand voice" className="bg-black/30 border-white/10" /><Input value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} placeholder="Signature" className="bg-black/30 border-white/10" /><Textarea value={emailInboxRaw} onChange={(e) => setEmailInboxRaw(e.target.value)} placeholder="One email per line: from | subject | body" className="bg-black/30 border-white/10 min-h-[120px]" /><div className="flex items-center gap-2"><Badge variant="outline" className="border-white/20 text-slate-300">{parsedInbox.length} emails parsed</Badge></div><Button onClick={() => { setActiveRun("autonomous_email_manager"); runTool.mutate({ action: "autonomous_email_manager", params: { inbox: parsedInbox, brand_voice: emailVoice, signature: emailSignature, auto_execute: false } }); }} disabled={!parsedInbox.length || runTool.isPending || runCapability.isPending} className="bg-pink-600 hover:bg-pink-500">{activeRun === "autonomous_email_manager" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Run Email Autonomy</Button></div></TabsContent>

          <TabsContent value="connectors" className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"><div className="flex items-center gap-2"><Plug className="w-4 h-4 text-cyan-300" /><p className="text-sm text-white font-semibold">Inbox Connector Settings</p></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><Input value={connector.provider} onChange={(e) => updateConnector("provider", e.target.value)} placeholder="Provider (gmail/outlook/zendesk/imap)" className="bg-black/30 border-white/10" /><Input value={connector.inbox_address} onChange={(e) => updateConnector("inbox_address", e.target.value)} placeholder="Inbox address" className="bg-black/30 border-white/10" /><Input value={connector.auth_type} onChange={(e) => updateConnector("auth_type", e.target.value)} placeholder="Auth type (oauth2/api_key/basic)" className="bg-black/30 border-white/10" /><Input value={connector.token_secret_name} onChange={(e) => updateConnector("token_secret_name", e.target.value)} placeholder="Token secret name" className="bg-black/30 border-white/10" /><Input value={connector.client_secret_name} onChange={(e) => updateConnector("client_secret_name", e.target.value)} placeholder="Client secret name" className="bg-black/30 border-white/10" /><Input value={connector.password_secret_name} onChange={(e) => updateConnector("password_secret_name", e.target.value)} placeholder="Password secret name" className="bg-black/30 border-white/10" /><Input value={connector.host} onChange={(e) => updateConnector("host", e.target.value)} placeholder="Host (for IMAP)" className="bg-black/30 border-white/10" /><Input type="number" value={connector.port} onChange={(e) => updateConnector("port", Number(e.target.value || 0))} placeholder="Port" className="bg-black/30 border-white/10" /><Input value={connector.username} onChange={(e) => updateConnector("username", e.target.value)} placeholder="Username" className="bg-black/30 border-white/10" /><Input value={connector.client_id} onChange={(e) => updateConnector("client_id", e.target.value)} placeholder="OAuth client id" className="bg-black/30 border-white/10" /><Input value={connector.tenant_id} onChange={(e) => updateConnector("tenant_id", e.target.value)} placeholder="Tenant id (Outlook)" className="bg-black/30 border-white/10" /><Input value={connector.api_base_url} onChange={(e) => updateConnector("api_base_url", e.target.value)} placeholder="API base URL (Zendesk)" className="bg-black/30 border-white/10" /></div><p className="text-[11px] text-slate-500">Secret values are never stored in app config. Register secret references only.</p><div className="flex items-center gap-2"><Button variant="outline" className="border-white/20 text-slate-300" onClick={() => updateConnector("secure", !connector.secure)}>Secure: {connector.secure ? "ON" : "OFF"}</Button>{connectorStatus && (<Badge className={connectorStatus.connected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}>{connectorStatus.connected ? "Connected" : "Needs Fix"}</Badge>)}</div><div className="flex gap-2 flex-wrap"><Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("inbox_connector_load"); runTool.mutate({ action: "inbox_connector_load", params: {} }); }}>{activeRun === "inbox_connector_load" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Load Current</Button><Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("inbox_connector_save"); runTool.mutate({ action: "inbox_connector_save", params: { connector } }); }}>{activeRun === "inbox_connector_save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}Save Settings</Button><Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("inbox_connector_register_secret_refs"); runTool.mutate({ action: "inbox_connector_register_secret_refs", params: { secret_refs: { token_secret_name: connector.token_secret_name, client_secret_name: connector.client_secret_name, password_secret_name: connector.password_secret_name } } }); }}>{activeRun === "inbox_connector_register_secret_refs" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Register Secret Refs</Button><Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("inbox_connector_test"); runTool.mutate({ action: "inbox_connector_test", params: {} }); }}>{activeRun === "inbox_connector_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Test Connection</Button></div></div></TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-cyan-300" /><p className="text-sm font-semibold text-white">Tool Output</p></div><pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-auto">{formatRuntimeOutput(toolResult, "No tool run yet.")}</pre></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-blue-300" /><p className="text-sm font-semibold text-white">Capability Output</p></div><pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-auto">{formatRuntimeOutput(capabilityResult, "No capability run yet.")}</pre></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-white">Ops Timeline</p><Button variant="outline" size="sm" className="h-7 border-white/10 text-slate-300" onClick={() => refetchHistory()}>Refresh</Button></div><div className="space-y-2 max-h-96 overflow-auto pr-1">{runHistory.length === 0 && <p className="text-[11px] text-slate-500">No ops runs logged yet.</p>}{runHistory.map((item) => (<div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-white leading-tight">{item.title}</p><Badge className={`text-[10px] ${item.status === "failed" ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{item.status || "completed"}</Badge></div><p className="text-[10px] text-slate-500 mt-1">{item.created_date ? new Date(item.created_date).toLocaleString() : ""}</p><p className="text-[10px] text-slate-400 mt-1 line-clamp-3">{String(item.description || "").replace("[prospect_ops]", "").trim()}</p></div>))}</div></div></div>
      </div>
    </div>
  );
}


