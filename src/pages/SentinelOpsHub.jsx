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
import { ArrowLeft, Shield, Loader2, PlayCircle, Sparkles, AlertTriangle, Lock, Radar } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "full_threat_scan", label: "Full Threat Scan" },
  { id: "security_posture_report", label: "Security Posture" },
  { id: "global_threat_intel_fusion", label: "Intel Fusion" },
  { id: "attack_surface_mapping", label: "Attack Surface" },
  { id: "dark_web_monitoring", label: "Dark Web" },
  { id: "identity_access_monitoring", label: "Identity Monitor" },
  { id: "insider_threat_watch", label: "Insider Watch" },
  { id: "cloud_saas_posture_unified", label: "Cloud+SaaS" },
  { id: "data_protection_control_plane", label: "Data Protection" },
  { id: "vulnerability_scan", label: "Vulnerability Scan" },
  { id: "penetration_test_simulation", label: "Pentest Sim" },
  { id: "autonomous_incident_response", label: "Auto Response" },
  { id: "compliance_framework_audit", label: "Compliance Audit" },
  { id: "essential_eight_assessment", label: "Essential Eight" },
  { id: "brand_protection", label: "Brand Protection" },
  { id: "sentinel_full_self_test", label: "Full Self Test" },
];

export default function SentinelOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [incidentType, setIncidentType] = useState("ransomware");
  const [framework, setFramework] = useState("ISO27001");
  const [context, setContext] = useState("Multi-site SME with cloud + M365 + payment workflows");

  const { data: postureData, refetch: refetchPosture } = useQuery({
    queryKey: ["sentinel_ops_posture"],
    queryFn: async () => {
      const res = await base44.functions.invoke("sentinelSecurityMonitoring", { action: "security_posture_report" });
      return res.data || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Sentinel", capability_id: capabilityId, runtime_params: runtimeParams },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchPosture();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, payload = {} }) => {
      const res = await base44.functions.invoke("sentinelSecurityMonitoring", { action, ...payload });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchPosture();
    },
    onError: () => setActiveRun(""),
  });

  const securityScore = useMemo(() => postureData?.security_score ?? postureData?.result?.security_score ?? "--", [postureData]);
  const threatLevel = useMemo(() => postureData?.threat_level || postureData?.result?.threat_level || "--", [postureData]);
  const openCritical = useMemo(() => postureData?.incident_summary?.open_critical ?? postureData?.result?.incident_summary?.open_critical ?? 0, [postureData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Sentinel")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Sentinel
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Sentinel Ops Hub</h1>
            <p className="text-sm text-slate-400">Autonomous SOC controls for threat hunting, zero-trust, incident response, and compliance.</p>
          </div>
          <Button className="bg-red-600 hover:bg-red-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("sentinel_full_self_test"); runTool.mutate({ action: "sentinel_full_self_test" }); }}>
            {activeRun === "sentinel_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Security Score</p><p className="text-2xl font-semibold text-cyan-300">{securityScore}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Threat Level</p><p className="text-2xl font-semibold text-amber-300">{threatLevel}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Open Critical</p><p className="text-2xl font-semibold text-rose-300">{openCritical}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="incident">Incident</TabsTrigger>
            <TabsTrigger value="identity">Identity/Data</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "autonomous_incident_response") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { incident_type: incidentType } });
                      return;
                    }
                    if (cap.id === "compliance_framework_audit") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { framework } });
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

          <TabsContent value="incident" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Autonomous Incident Response</p>
              <Input value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="bg-black/30 border-white/10" placeholder="ransomware, phishing, data_breach" />
              <Textarea value={context} onChange={(e) => setContext(e.target.value)} className="bg-black/30 border-white/10 min-h-[100px]" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("autonomous_incident_response"); runTool.mutate({ action: "autonomous_incident_response", payload: { incident_type: incidentType, context } }); }}>
                  {activeRun === "autonomous_incident_response" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Auto Response
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("global_threat_intel_fusion"); runTool.mutate({ action: "global_threat_intel_fusion" }); }}>
                  {activeRun === "global_threat_intel_fusion" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radar className="w-4 h-4 mr-2" />}Intel Fusion
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="identity" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Identity + Data Control Plane</p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("insider_threat_watch"); runTool.mutate({ action: "insider_threat_watch" }); }}>
                  {activeRun === "insider_threat_watch" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Insider Watch
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("zero_trust_trust_scoring"); runTool.mutate({ action: "zero_trust_trust_scoring" }); }}>
                  {activeRun === "zero_trust_trust_scoring" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}Zero Trust
                </Button>
                <Button variant="outline" className="border-emerald-500/40 text-emerald-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("data_protection_control_plane"); runTool.mutate({ action: "data_protection_control_plane" }); }}>
                  {activeRun === "data_protection_control_plane" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Data Protection
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Compliance + Assurance</p>
              <Input value={framework} onChange={(e) => setFramework(e.target.value)} className="bg-black/30 border-white/10" placeholder="ISO27001, SOC2, NIST..." />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("compliance_framework_audit"); runTool.mutate({ action: "compliance_framework_audit", payload: { framework } }); }}>
                  {activeRun === "compliance_framework_audit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Framework Audit
                </Button>
                <Button variant="outline" className="border-orange-500/40 text-orange-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("essential_eight_assessment"); runTool.mutate({ action: "essential_eight_assessment" }); }}>
                  {activeRun === "essential_eight_assessment" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Essential Eight
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


