import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { formatRuntimeOutput } from "@/lib/resultFormatter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Scale, Loader2, PlayCircle, Sparkles, Shield, BarChart3, FileText } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "audit_compliance", label: "Compliance Audit" },
  { id: "regulatory_horizon_scan", label: "Regulatory Scan" },
  { id: "contract_risk_review", label: "Contract Risk" },
  { id: "contract_obligation_tracker", label: "Obligations" },
  { id: "privacy_dsar_command", label: "DSAR Command" },
  { id: "privacy_pia_assessment", label: "PIA" },
  { id: "ip_risk_scan", label: "IP Risk" },
  { id: "governance_compliance_command", label: "Governance" },
  { id: "employment_law_guard", label: "Employment Guard" },
  { id: "compliance_training_command", label: "Training" },
  { id: "legal_risk_register", label: "Risk Register" },
  { id: "incident_legal_response", label: "Incident Legal" },
  { id: "generate_report", label: "Legal Report" },
  { id: "veritas_full_self_test", label: "Full Self Test" },
];

export default function VeritasOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [industry, setIndustry] = useState("AI SaaS");
  const [complianceArea, setComplianceArea] = useState("privacy + contracts");
  const [contractType, setContractType] = useState("MSA");
  const [counterparty, setCounterparty] = useState("Enterprise customer");
  const [regions, setRegions] = useState("US,AU,EU");
  const [incidentType, setIncidentType] = useState("data_incident");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["veritas_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("veritasComplianceValidation", { action: "legal_risk_register" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async ({ capabilityId, runtimeParams = {} }) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Veritas", capability_id: capabilityId, runtime_params: runtimeParams },
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
      const res = await base44.functions.invoke("veritasComplianceValidation", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const topRisks = useMemo(() => healthData?.legal_risk_summary?.top_risks?.length ?? 0, [healthData]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Veritas")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Veritas
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Veritas Ops Hub</h1>
            <p className="text-sm text-slate-400">Legal operations command center for contracts, compliance, privacy, governance, and risk response.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("veritas_full_self_test"); runTool.mutate({ action: "veritas_full_self_test" }); }}>
            {activeRun === "veritas_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Top Legal Risks</p><p className="text-2xl font-semibold text-rose-300">{topRisks}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Contract Exposure</p><p className="text-2xl font-semibold text-amber-300">{healthData?.legal_risk_summary?.contract_exposure ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Remediation Backlog</p><p className="text-2xl font-semibold text-cyan-300">{healthData?.legal_risk_summary?.remediation_backlog ?? "--"}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="compliance">Compliance/Privacy</TabsTrigger>
            <TabsTrigger value="risk">Risk/Governance</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => {
                    setActiveRun(cap.id);
                    if (cap.id === "contract_risk_review") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { contract_type: contractType, counterparty } });
                      return;
                    }
                    if (cap.id === "regulatory_horizon_scan") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { industry, regions } });
                      return;
                    }
                    if (cap.id === "incident_legal_response") {
                      runCapability.mutate({ capabilityId: cap.id, runtimeParams: { incident_type: incidentType } });
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

          <TabsContent value="contracts" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Contract Lifecycle Controls</p>
              <Input value={contractType} onChange={(e) => setContractType(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("contract_risk_review"); runTool.mutate({ action: "contract_risk_review", params: { contract_type: contractType, counterparty } }); }}>
                  {activeRun === "contract_risk_review" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}Contract Risk Review
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("contract_obligation_tracker"); runTool.mutate({ action: "contract_obligation_tracker" }); }}>
                  {activeRun === "contract_obligation_tracker" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}Obligation Tracker
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Regulatory and Privacy Command</p>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={complianceArea} onChange={(e) => setComplianceArea(e.target.value)} className="bg-black/30 border-white/10" />
              <Input value={regions} onChange={(e) => setRegions(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("audit_compliance"); runTool.mutate({ action: "audit_compliance", params: { industry, compliance_area: complianceArea } }); }}>
                  {activeRun === "audit_compliance" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Compliance Audit
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("privacy_pia_assessment"); runTool.mutate({ action: "privacy_pia_assessment", params: { data_type: "PII", data_flow: "collection->processing->storage" } }); }}>
                  {activeRun === "privacy_pia_assessment" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}PIA Assessment
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Risk and Governance Controls</p>
              <Input value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="bg-black/30 border-white/10" />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-rose-600 hover:bg-rose-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("legal_risk_register"); runTool.mutate({ action: "legal_risk_register" }); }}>
                  {activeRun === "legal_risk_register" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Legal Risk Register
                </Button>
                <Button className="bg-orange-600 hover:bg-orange-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("incident_legal_response"); runTool.mutate({ action: "incident_legal_response", params: { incident_type: incidentType } }); }}>
                  {activeRun === "incident_legal_response" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Incident Legal Response
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


