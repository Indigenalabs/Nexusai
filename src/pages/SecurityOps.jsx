import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle,
  Plus, CheckCircle2, Eye, Lock, Sparkles, Info
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const SEV_CONFIG = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: ShieldAlert },
  high: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: AlertTriangle },
  medium: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: AlertCircle },
  low: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: Info },
};

const INCIDENT_CATEGORIES = ["fraud", "data_breach", "unauthorized_access", "phishing", "malware", "compliance", "brand_safety", "supply_chain", "physical", "other"];

export default function SecurityOps() {
  const [tab, setTab] = useState("incidents");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", severity: "medium", category: "other", description: "", status: "open" });
  const queryClient = useQueryClient();

  const { data: incidents = [] } = useQuery({
    queryKey: ["security_incidents_all"],
    queryFn: () => base44.entities.SecurityIncident.list("-created_date", 100),
    refetchInterval: 10000,
  });

  const { data: threatLogs = [] } = useQuery({
    queryKey: ["threat_logs"],
    queryFn: () => base44.entities.ThreatLog.list("-created_date", 50),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SecurityIncident.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["security_incidents_all"] }); setIsOpen(false); setForm({ title: "", severity: "medium", category: "other", description: "", status: "open" }); },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.SecurityIncident.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["security_incidents_all"] }),
  });

  const openIncidents = incidents.filter(i => i.status === "open");
  const resolvedIncidents = incidents.filter(i => i.status === "resolved");
  const criticalCount = incidents.filter(i => i.severity === "critical" && i.status === "open").length;
  const highCount = incidents.filter(i => i.severity === "high" && i.status === "open").length;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Security Operations</h1>
              <p className="text-sm text-slate-500">Sentinel-powered incident management, threat logs & compliance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl("Sentinel")}>
              <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Open Sentinel
              </Button>
            </Link>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-red-700 to-orange-700 hover:from-red-600 hover:to-orange-600 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Log Incident
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[hsl(222,40%,10%)] border-white/[0.1] text-white">
                <DialogHeader><DialogTitle>Log Security Incident</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs text-slate-400">Title</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" placeholder="Brief description of the incident" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-400">Severity</Label>
                      <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["critical", "high", "medium", "low"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Category</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INCIDENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Description</Label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] text-white rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-red-500/40"
                      placeholder="Describe what happened, impact, and any initial observations..." />
                  </div>
                  <Button onClick={() => createMutation.mutate(form)} disabled={!form.title} className="w-full bg-red-700 hover:bg-red-600">Log Incident</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Security Score Bar */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            {criticalCount > 0 ? <ShieldAlert className="w-8 h-8 text-red-400" /> : <ShieldCheck className="w-8 h-8 text-emerald-400" />}
            <div>
              <p className="text-sm font-semibold text-white">{criticalCount > 0 ? `${criticalCount} Critical Incidents Open` : "No Critical Incidents"}</p>
              <p className="text-xs text-slate-500">{openIncidents.length} open · {resolvedIncidents.length} resolved · {threatLogs.length} threat signals</p>
            </div>
          </div>
          <div className="ml-auto flex gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-[10px] text-red-400/70">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{highCount}</p>
              <p className="text-[10px] text-orange-400/70">High</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{incidents.filter(i => i.severity === "medium" && i.status === "open").length}</p>
              <p className="text-[10px] text-amber-400/70">Medium</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{resolvedIncidents.length}</p>
              <p className="text-[10px] text-emerald-400/70">Resolved</p>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.06] mb-6">
            <TabsTrigger value="incidents" className="text-xs data-[state=active]:bg-white/[0.1]">
              <Shield className="w-3.5 h-3.5 mr-1" /> Open Incidents ({openIncidents.length})
            </TabsTrigger>
            <TabsTrigger value="threats" className="text-xs data-[state=active]:bg-white/[0.1]">
              <Eye className="w-3.5 h-3.5 mr-1" /> Threat Log ({threatLogs.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs data-[state=active]:bg-white/[0.1]">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolved ({resolvedIncidents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incidents">
            <div className="space-y-3 mb-6">
              {openIncidents.length === 0 && (
                <div className="text-center py-16 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20">
                  <ShieldCheck className="w-12 h-12 text-emerald-400/40 mx-auto mb-3" />
                  <p className="text-emerald-400 font-medium">All clear — no open incidents</p>
                  <p className="text-xs text-slate-500 mt-1">Run a scan in Sentinel to detect threats</p>
                </div>
              )}
              <AnimatePresence>
                {openIncidents.map((inc, i) => {
                  const cfg = SEV_CONFIG[inc.severity] || SEV_CONFIG.low;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={inc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex items-start gap-3`}>
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold uppercase ${cfg.text}`}>{inc.severity}</span>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{inc.category?.replace(/_/g, " ")}</Badge>
                          {inc.created_date && <span className="text-[10px] text-slate-600">{format(new Date(inc.created_date), "MMM d HH:mm")}</span>}
                        </div>
                        <p className="text-sm font-medium text-white">{inc.title}</p>
                        {inc.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{inc.description}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => resolveMutation.mutate({ id: inc.id, status: "investigating" })}
                          variant="outline" className="h-7 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                          Investigate
                        </Button>
                        <Button size="sm" onClick={() => resolveMutation.mutate({ id: inc.id, status: "resolved" })}
                          className="h-7 text-[10px] bg-emerald-700/80 hover:bg-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </TabsContent>

          <TabsContent value="threats">
            <div className="space-y-3 mb-6">
              {threatLogs.length === 0 && (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <Eye className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">No threat signals logged yet</p>
                  <p className="text-xs text-slate-500 mt-1">Sentinel will log signals here as it monitors</p>
                </div>
              )}
              {threatLogs.map((log, i) => (
                <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
                  <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${log.severity === "high" ? "border-orange-500/30 text-orange-400" : log.severity === "critical" ? "border-red-500/30 text-red-400" : "border-white/10 text-slate-400"}`}>{log.severity}</Badge>
                      {log.category && <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{log.category}</Badge>}
                      {log.created_date && <span className="text-[10px] text-slate-600">{format(new Date(log.created_date), "MMM d HH:mm")}</span>}
                    </div>
                    <p className="text-sm text-white">{log.title || log.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="resolved">
            <div className="space-y-3 mb-6">
              {resolvedIncidents.length === 0 && (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <CheckCircle2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">No resolved incidents yet</p>
                </div>
              )}
              {resolvedIncidents.map((inc, i) => (
                <motion.div key={inc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3 opacity-60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{inc.severity}</Badge>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{inc.category?.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-sm text-slate-300">{inc.title}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => resolveMutation.mutate({ id: inc.id, status: "open" })}
                    className="h-7 text-[10px] text-slate-500 hover:text-white">Reopen</Button>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Agent Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage={`Security status: ${criticalCount} critical, ${highCount} high, ${openIncidents.length} total open incidents, ${threatLogs.length} threat signals logged. Give me an immediate threat assessment and the top priority actions I must take right now.`}
            quickCommands={[
              { label: "Full threat scan", text: "Run a comprehensive threat scan across all business data. Check financials, access patterns, social, brand, and operations. Report every finding." },
              { label: "Incident response plan", text: `We have ${criticalCount} critical incidents. For each one, give me the full incident response playbook — containment, eradication, recovery steps.` },
              { label: "Security posture report", text: "Generate a full security posture report with our overall security score, top risks, compliance status, and 30/60/90 day improvement roadmap." },
              { label: "Essential Eight audit", text: "Audit our ACSC Essential Eight maturity level. Rate each strategy and tell me exactly what to do to reach the next maturity level." },
            ]}
          />
          <AgentPanel
            agentName="centsible_agent"
            agentLabel="Centsible"
            agentEmoji="💰"
            accentColor="emerald"
            startMessage={`Security operations view: we have ${openIncidents.length} open security incidents including ${criticalCount} critical. From a financial risk perspective, what is the potential financial impact of these security incidents? What insurance, legal, or financial provisions should we consider?`}
            quickCommands={[
              { label: "Financial impact of incidents", text: "Assess the financial risk exposure from our current open security incidents. What could these cost us in fines, remediation, legal fees, and reputational damage?" },
              { label: "Cyber insurance check", text: "What cyber insurance coverage should we have given our current risk profile? Are there financial provisions we need to make?" },
              { label: "Breach cost estimate", text: "If our worst open incident became a full data breach, what would the total cost be? Include regulatory fines, notification costs, legal fees, and reputational impact." },
            ]}
          />
        </div>
      </div>
    </div>
  );
}