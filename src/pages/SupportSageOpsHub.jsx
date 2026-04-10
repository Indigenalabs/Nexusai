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
import { ArrowLeft, Loader2, PlayCircle, Mail, AlertTriangle, Plug, ShieldCheck, Bot, Sparkles, TrendingUp, Shield } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "support_analytics", label: "Support Analytics" },
  { id: "customer_health", label: "Customer Health" },
  { id: "csat_analysis", label: "CSAT Analysis" },
  { id: "omnichannel_intake_hub", label: "Omnichannel Intake" },
  { id: "autonomous_email_manager", label: "Autonomous Email" },
  { id: "email_thread_autonomy", label: "Email Thread AI" },
  { id: "proactive_issue_predictor", label: "Issue Predictor" },
  { id: "outage_communication_orchestrator", label: "Outage Comms" },
  { id: "revenue_support_command", label: "Revenue Support" },
  { id: "handoff_quality_monitor", label: "Handoff QA" },
  { id: "self_service_gap_mapper", label: "Self-Service Gap" },
  { id: "refund_risk_engine", label: "Refund Risk" },
  { id: "pii_compliance_guard", label: "PII Guard" },
  { id: "escalation_crisis_command", label: "Crisis Command" },
  { id: "support_kpi_command_center", label: "KPI Command" },
  { id: "support_connector_test", label: "Connector Test" },
  { id: "support_full_self_test", label: "Full Self Test" },
];

const DEFAULT_CONNECTOR = {
  provider: "gmail",
  inbox_address: "support@company.com",
  auth_type: "oauth2",
  host: "",
  port: 993,
  username: "",
  secure: true,
  client_id: "",
  tenant_id: "",
  api_base_url: "",
  token_secret_name: "SUPPORT_EMAIL_TOKEN",
  client_secret_name: "SUPPORT_CLIENT_SECRET",
  password_secret_name: "SUPPORT_IMAP_PASSWORD",
};

export default function SupportSageOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [inquiriesRaw, setInquiriesRaw] = useState("email|billing|Charged twice this month\nchat|technical|App keeps logging me out");
  const [emailInboxRaw, setEmailInboxRaw] = useState("customer@acme.com | Refund help | I was charged twice and need this fixed.\nuser@globex.com | Login issue | My 2FA codes keep failing.");
  const [emailThreadRaw, setEmailThreadRaw] = useState("customer@acme.com | Issue still unresolved after last reply\nsupport@company.com | We are checking billing logs now\ncustomer@acme.com | Please escalate if this takes longer than today");
  const [telemetryRaw, setTelemetryRaw] = useState("error_rate|payments|spike_17pct\nlatency|api|p95_2800ms");
  const [conversationsRaw, setConversationsRaw] = useState("negative|enterprise|Considering cancellation due to repeated outages\nneutral|pro|Can I upgrade to annual with discount?");
  const [transcriptsRaw, setTranscriptsRaw] = useState("Agent asked for full card number in chat\nCustomer shared home address and DOB in one message");

  const [emailVoice, setEmailVoice] = useState("empathetic, clear, accountable");
  const [emailSignature, setEmailSignature] = useState("Support Team");
  const [crisisWindowHours, setCrisisWindowHours] = useState(6);
  const [incidentTitle, setIncidentTitle] = useState("API Latency Incident");
  const [incidentEta, setIncidentEta] = useState("45 minutes");
  const [incidentSeverity, setIncidentSeverity] = useState("high");
  const [connector, setConnector] = useState(DEFAULT_CONNECTOR);

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["support_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("supportSageCustomerService", { action: "support_kpi_command_center" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Support Sage", capability_id: capabilityId },
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
      const res = await base44.functions.invoke("supportSageCustomerService", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
      if (data?.action === "support_connector_load" && data?.result?.exists && data?.result?.connector) {
        const loaded = data.result.connector;
        const refs = data.result.secret_refs || {};
        setConnector((prev) => ({
          ...prev,
          ...loaded,
          token_secret_name: refs.token_secret_name || prev.token_secret_name,
          client_secret_name: refs.client_secret_name || prev.client_secret_name,
          password_secret_name: refs.password_secret_name || prev.password_secret_name,
        }));
      }
    },
    onError: () => setActiveRun(""),
  });

  const parsedInquiries = useMemo(() => inquiriesRaw.split("\n").map((line) => {
    const [channel, topic, body] = line.split("|").map((s) => s?.trim());
    if (!body) return null;
    return { channel: channel || "web", topic: topic || "general", body };
  }).filter(Boolean), [inquiriesRaw]);

  const parsedInbox = useMemo(() => emailInboxRaw.split("\n").map((line) => {
    const [from, subject, body] = line.split("|").map((s) => s?.trim());
    if (!body) return null;
    return { from: from || "unknown@example.com", subject: subject || "Support request", body };
  }).filter(Boolean), [emailInboxRaw]);

  const parsedThread = useMemo(() => emailThreadRaw.split("\n").map((line, i) => {
    const [from, body] = line.split("|").map((s) => s?.trim());
    if (!body) return null;
    return { index: i + 1, from: from || "unknown@example.com", body };
  }).filter(Boolean), [emailThreadRaw]);

  const parsedTelemetry = useMemo(() => telemetryRaw.split("\n").map((line) => {
    const [signal, area, detail] = line.split("|").map((s) => s?.trim());
    if (!detail) return null;
    return { signal: signal || "signal", area: area || "general", detail };
  }).filter(Boolean), [telemetryRaw]);

  const parsedConversations = useMemo(() => conversationsRaw.split("\n").map((line) => {
    const [sentiment, tier, text] = line.split("|").map((s) => s?.trim());
    if (!text) return null;
    return { sentiment: sentiment || "neutral", tier: tier || "mixed", text };
  }).filter(Boolean), [conversationsRaw]);

  const parsedTranscripts = useMemo(() => transcriptsRaw.split("\n").map((line, i) => {
    const text = line?.trim();
    if (!text) return null;
    return { index: i + 1, text };
  }).filter(Boolean), [transcriptsRaw]);

  const connectorStatus = toolResult?.action === "support_connector_test" ? toolResult?.result : null;
  const updateConnector = (key, value) => setConnector((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[hsl(222,47%,6%)] text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link to={createPageUrl("SupportSage")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Support Sage
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Support Sage Ops Hub</h1>
            <p className="text-sm text-slate-400">Autonomous CX operations: proactive support, revenue assist, compliance guardrails, and secure omnichannel connectors.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("support_full_self_test"); runTool.mutate({ action: "support_full_self_test" }); }}>
            {activeRun === "support_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-slate-400">KPI Snapshot</p>
            <p className="text-xl font-semibold text-white mt-1">{healthData?.kpi_snapshot?.health_score || "--"}</p>
            <p className="text-xs text-slate-500 mt-1">Support health score</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-slate-400">Forecast Risk</p>
            <p className="text-lg font-medium text-white mt-1">{healthData?.forecast_risk || "pending analysis"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-slate-400">Ops Actions</p>
            <p className="text-lg font-medium text-white mt-1">{Array.isArray(healthData?.executive_actions) ? healthData.executive_actions.length : 0}</p>
            <p className="text-xs text-slate-500 mt-1">Recommended executive actions</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/10 h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="intake">Intake Hub</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="proactive">Proactive</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="crisis">Crisis</TabsTrigger>
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Support Sage Capability Launcher</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />}
                    {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="intake" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Omnichannel Intake Hub</p>
              <Textarea value={inquiriesRaw} onChange={(e) => setInquiriesRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[130px]" placeholder="channel|topic|message" />
              <Badge variant="outline" className="border-white/20 text-slate-300">{parsedInquiries.length} inquiries parsed</Badge>
              <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={!parsedInquiries.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("omnichannel_intake_hub"); runTool.mutate({ action: "omnichannel_intake_hub", params: { inquiries: parsedInquiries } }); }}>
                {activeRun === "omnichannel_intake_hub" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}Run Intake Triage
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm text-white font-semibold">Autonomous Email Manager</p>
                <Input value={emailVoice} onChange={(e) => setEmailVoice(e.target.value)} placeholder="Brand voice" className="bg-black/30 border-white/10" />
                <Input value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} placeholder="Signature" className="bg-black/30 border-white/10" />
                <Textarea value={emailInboxRaw} onChange={(e) => setEmailInboxRaw(e.target.value)} placeholder="from | subject | body" className="bg-black/30 border-white/10 min-h-[130px]" />
                <Badge variant="outline" className="border-white/20 text-slate-300">{parsedInbox.length} emails parsed</Badge>
                <Button className="bg-pink-600 hover:bg-pink-500" disabled={!parsedInbox.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("autonomous_email_manager"); runTool.mutate({ action: "autonomous_email_manager", params: { inbox: parsedInbox, brand_voice: emailVoice, signature: emailSignature, auto_execute: false } }); }}>
                  {activeRun === "autonomous_email_manager" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Run Email Autonomy
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm text-white font-semibold">Email Thread Autonomy</p>
                <Textarea value={emailThreadRaw} onChange={(e) => setEmailThreadRaw(e.target.value)} placeholder="from | message" className="bg-black/30 border-white/10 min-h-[170px]" />
                <Badge variant="outline" className="border-white/20 text-slate-300">{parsedThread.length} thread messages</Badge>
                <Button className="bg-fuchsia-600 hover:bg-fuchsia-500" disabled={!parsedThread.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("email_thread_autonomy"); runTool.mutate({ action: "email_thread_autonomy", params: { thread: parsedThread, brand_voice: emailVoice, signature: emailSignature } }); }}>
                  {activeRun === "email_thread_autonomy" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Thread Autonomy
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="proactive" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Proactive Support Intelligence</p>
              <Textarea value={telemetryRaw} onChange={(e) => setTelemetryRaw(e.target.value)} placeholder="signal|area|detail" className="bg-black/30 border-white/10 min-h-[130px]" />
              <Badge variant="outline" className="border-white/20 text-slate-300">{parsedTelemetry.length} telemetry events</Badge>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={!parsedTelemetry.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("proactive_issue_predictor"); runTool.mutate({ action: "proactive_issue_predictor", params: { telemetry_events: parsedTelemetry } }); }}>
                  {activeRun === "proactive_issue_predictor" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}Predict Issues
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("outage_communication_orchestrator"); runTool.mutate({ action: "outage_communication_orchestrator", params: { incident_title: incidentTitle, severity: incidentSeverity, eta: incidentEta, affected_systems: ["api", "billing"] } }); }}>
                  {activeRun === "outage_communication_orchestrator" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Generate Outage Comms
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <Input value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} placeholder="Incident title" className="bg-black/30 border-white/10" />
                <Input value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value)} placeholder="Severity" className="bg-black/30 border-white/10" />
                <Input value={incidentEta} onChange={(e) => setIncidentEta(e.target.value)} placeholder="ETA" className="bg-black/30 border-white/10" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Revenue-Focused Support</p>
              <Textarea value={conversationsRaw} onChange={(e) => setConversationsRaw(e.target.value)} placeholder="sentiment|tier|conversation" className="bg-black/30 border-white/10 min-h-[130px]" />
              <Badge variant="outline" className="border-white/20 text-slate-300">{parsedConversations.length} conversations parsed</Badge>
              <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={!parsedConversations.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("revenue_support_command"); runTool.mutate({ action: "revenue_support_command", params: { conversations: parsedConversations } }); }}>
                {activeRun === "revenue_support_command" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}Run Revenue Command
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Compliance & PII Guard</p>
              <Textarea value={transcriptsRaw} onChange={(e) => setTranscriptsRaw(e.target.value)} placeholder="Transcript lines" className="bg-black/30 border-white/10 min-h-[130px]" />
              <Badge variant="outline" className="border-white/20 text-slate-300">{parsedTranscripts.length} transcript entries</Badge>
              <Button className="bg-amber-600 hover:bg-amber-500" disabled={!parsedTranscripts.length || runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("pii_compliance_guard"); runTool.mutate({ action: "pii_compliance_guard", params: { transcripts: parsedTranscripts, framework: "GDPR/CCPA" } }); }}>
                {activeRun === "pii_compliance_guard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Run PII Compliance Guard
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="crisis" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white font-semibold">Escalation & Crisis Command</p>
              <Input type="number" value={crisisWindowHours} onChange={(e) => setCrisisWindowHours(Number(e.target.value || 6))} placeholder="Window (hours)" className="bg-black/30 border-white/10" />
              <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("escalation_crisis_command"); runTool.mutate({ action: "escalation_crisis_command", params: { window_hours: crisisWindowHours } }); }}>
                {activeRun === "escalation_crisis_command" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Run Crisis Command
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="connectors" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2"><Plug className="w-4 h-4 text-cyan-300" /><p className="text-sm text-white font-semibold">Support Inbox Connector</p></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Input value={connector.provider} onChange={(e) => updateConnector("provider", e.target.value)} placeholder="Provider" className="bg-black/30 border-white/10" />
                <Input value={connector.inbox_address} onChange={(e) => updateConnector("inbox_address", e.target.value)} placeholder="Inbox address" className="bg-black/30 border-white/10" />
                <Input value={connector.auth_type} onChange={(e) => updateConnector("auth_type", e.target.value)} placeholder="Auth type" className="bg-black/30 border-white/10" />
                <Input value={connector.token_secret_name} onChange={(e) => updateConnector("token_secret_name", e.target.value)} placeholder="Token secret ref" className="bg-black/30 border-white/10" />
                <Input value={connector.client_secret_name} onChange={(e) => updateConnector("client_secret_name", e.target.value)} placeholder="Client secret ref" className="bg-black/30 border-white/10" />
                <Input value={connector.password_secret_name} onChange={(e) => updateConnector("password_secret_name", e.target.value)} placeholder="Password secret ref" className="bg-black/30 border-white/10" />
                <Input value={connector.host} onChange={(e) => updateConnector("host", e.target.value)} placeholder="Host (IMAP)" className="bg-black/30 border-white/10" />
                <Input type="number" value={connector.port} onChange={(e) => updateConnector("port", Number(e.target.value || 0))} placeholder="Port" className="bg-black/30 border-white/10" />
                <Input value={connector.username} onChange={(e) => updateConnector("username", e.target.value)} placeholder="Username" className="bg-black/30 border-white/10" />
                <Input value={connector.client_id} onChange={(e) => updateConnector("client_id", e.target.value)} placeholder="OAuth client id" className="bg-black/30 border-white/10" />
                <Input value={connector.tenant_id} onChange={(e) => updateConnector("tenant_id", e.target.value)} placeholder="Tenant id" className="bg-black/30 border-white/10" />
                <Input value={connector.api_base_url} onChange={(e) => updateConnector("api_base_url", e.target.value)} placeholder="API base URL" className="bg-black/30 border-white/10" />
              </div>
              <p className="text-[11px] text-slate-500">Secret values are never stored. Register secret references only.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-white/20 text-slate-300" onClick={() => updateConnector("secure", !connector.secure)}>Secure: {connector.secure ? "ON" : "OFF"}</Button>
                {connectorStatus && <Badge className={connectorStatus.connected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}>{connectorStatus.connected ? "Connected" : "Needs Fix"}</Badge>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("support_connector_load"); runTool.mutate({ action: "support_connector_load" }); }}>{activeRun === "support_connector_load" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Load Current</Button>
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("support_connector_save"); runTool.mutate({ action: "support_connector_save", params: { connector } }); }}>{activeRun === "support_connector_save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Save Settings</Button>
                <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("support_connector_register_secret_refs"); runTool.mutate({ action: "support_connector_register_secret_refs", params: { secret_refs: { token_secret_name: connector.token_secret_name, client_secret_name: connector.client_secret_name, password_secret_name: connector.password_secret_name } } }); }}>{activeRun === "support_connector_register_secret_refs" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}Register Secret Refs</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("support_connector_test"); runTool.mutate({ action: "support_connector_test" }); }}>{activeRun === "support_connector_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Test Connection</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {(capabilityResult || toolResult) && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Last Result</p>
            <HumanDataPanel data={toolResult || capabilityResult} emptyText="No result yet." />
          </div>
        )}
      </div>
    </div>
  );
}

