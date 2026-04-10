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
  Megaphone, Plus, Target, DollarSign,
  PlayCircle, PauseCircle, CheckCircle2, Clock, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STATUS_CONFIG = {
  draft: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: Clock, label: "Draft" },
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: PlayCircle, label: "Active" },
  paused: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: PauseCircle, label: "Paused" },
  completed: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CheckCircle2, label: "Completed" },
};

const CHANNEL_COLORS = {
  email: "bg-blue-500/15 text-blue-300",
  social: "bg-pink-500/15 text-pink-300",
  google_ads: "bg-yellow-500/15 text-yellow-300",
  seo: "bg-emerald-500/15 text-emerald-300",
  content: "bg-violet-500/15 text-violet-300",
  linkedin: "bg-blue-600/15 text-blue-300",
};

export default function CampaignHub() {
  const [tab, setTab] = useState("campaigns");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", objective: "", budget: "", channels: [], status: "draft" });
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list("-created_date", 50),
    refetchInterval: 10000,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 20),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Campaign.create({ ...data, budget: Number(data.budget) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campaigns"] }); setIsOpen(false); setForm({ name: "", objective: "", budget: "", channels: [], status: "draft" }); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Campaign.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const hotLeads = leads.filter(l => l.status === "qualified" || l.status === "proposal");

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20">
              <Megaphone className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Campaign Hub</h1>
              <p className="text-sm text-slate-500">Maestro-powered campaign management & lead pipeline</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl("Maestro")}>
              <Button variant="outline" className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Open Maestro
              </Button>
            </Link>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[hsl(222,40%,10%)] border-white/[0.1] text-white">
                <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs text-slate-400">Campaign Name</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" placeholder="Q1 Lead Gen Campaign" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Objective</Label>
                    <Select value={form.objective} onValueChange={v => setForm({ ...form, objective: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1">
                        <SelectValue placeholder="Select objective..." />
                      </SelectTrigger>
                      <SelectContent>
                        {["brand_awareness", "lead_generation", "conversion", "retention", "upsell", "referral"].map(o => (
                          <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Budget ($)</Label>
                    <Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1" placeholder="5000" />
                  </div>
                  <Button onClick={() => createMutation.mutate(form)} disabled={!form.name} className="w-full bg-violet-600 hover:bg-violet-700">Create Campaign</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Campaigns", value: campaigns.length, icon: Megaphone, color: "violet" },
            { label: "Active", value: activeCampaigns.length, icon: PlayCircle, color: "emerald" },
            { label: "Total Budget", value: `$${totalBudget.toLocaleString()}`, icon: DollarSign, color: "blue" },
            { label: "Hot Leads", value: hotLeads.length, icon: Target, color: "orange" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`p-5 rounded-2xl bg-${kpi.color}-500/[0.07] border border-${kpi.color}-500/20`}>
              <div className={`p-2 rounded-lg bg-${kpi.color}-500/15 w-fit mb-3`}>
                <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
              </div>
              <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold text-${kpi.color}-400`}>{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.06] mb-6">
            <TabsTrigger value="campaigns" className="text-xs data-[state=active]:bg-white/[0.1]">Campaigns</TabsTrigger>
            <TabsTrigger value="leads" className="text-xs data-[state=active]:bg-white/[0.1]">Lead Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <div className="space-y-3 mb-6">
              {campaigns.length === 0 && (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">No campaigns yet — ask Maestro to plan one</p>
                </div>
              )}
              <AnimatePresence>
                {campaigns.map((c, i) => {
                  const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className={`p-5 rounded-2xl border ${cfg.border} ${cfg.bg} flex items-start justify-between gap-4`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
                          <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{c.objective?.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {c.channels?.map(ch => (
                            <span key={ch} className={`text-[10px] px-2 py-0.5 rounded-full ${CHANNEL_COLORS[ch] || "bg-slate-500/15 text-slate-400"}`}>{ch}</span>
                          ))}
                          {c.budget > 0 && <span className="text-[10px] text-slate-500">${c.budget.toLocaleString()} budget</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {c.status !== "active" && (
                          <Button size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "active" })} className="h-7 text-[10px] bg-emerald-600/80 hover:bg-emerald-600">Activate</Button>
                        )}
                        {c.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: "paused" })} className="h-7 text-[10px] border-amber-500/30 text-amber-400">Pause</Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </TabsContent>

          <TabsContent value="leads">
            <div className="space-y-3 mb-6">
              {leads.length === 0 && (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <Target className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">No leads yet — ask Maestro to run a lead gen campaign</p>
                </div>
              )}
              {leads.map((lead, i) => (
                <motion.div key={lead.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{lead.name || lead.company}</p>
                    <p className="text-xs text-slate-500">{lead.email} · {lead.source}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.score && <span className={`text-xs font-bold ${lead.score >= 70 ? "text-emerald-400" : lead.score >= 40 ? "text-amber-400" : "text-slate-400"}`}>{lead.score}/100</span>}
                    <Badge className={`text-[10px] ${lead.status === "qualified" ? "bg-emerald-500/15 text-emerald-400" : lead.status === "proposal" ? "bg-blue-500/15 text-blue-400" : "bg-slate-500/15 text-slate-400"}`}>{lead.status}</Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Agent Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <AgentPanel
            agentName="maestro_agent"
            agentLabel="Maestro"
            agentEmoji="🎯"
            accentColor="purple"
            startMessage={`I'm in the Campaign Hub. We have ${campaigns.length} total campaigns, ${activeCampaigns.length} active, and ${hotLeads.length} hot leads in the pipeline. Give me a campaign performance briefing and tell me exactly what I should prioritise this week to drive more pipeline.`}
            quickCommands={[
              { label: "Launch new campaign", text: "Plan a complete multi-channel campaign for me. Ask me the goal, audience, and budget — then give me the full strategy." },
              { label: "Optimise active campaigns", text: `We have ${activeCampaigns.length} active campaigns. Which should I scale, pause, or adjust? Give me specific budget reallocation recommendations.` },
              { label: "Lead nurture sequence", text: `We have ${hotLeads.length} hot leads in the pipeline. Design a personalised nurture sequence to move them to close.` },
              { label: "Channel ROAS analysis", text: "Analyse our campaign channel mix. Which channels have the best ROAS? Where should I reallocate budget?" },
            ]}
          />
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage={`Review our ${campaigns.length} campaigns for compliance and brand safety risks. Flag any campaigns that might have legal exposure, misleading claims, SPAM Act issues, or brand safety concerns.`}
            quickCommands={[
              { label: "Campaign compliance check", text: "Check all active campaigns for compliance risks — SPAM Act, Privacy Act, misleading advertising, ACCC/FTC rules, and brand safety." },
              { label: "Lead data privacy", text: "Are we handling lead data correctly? Review our lead capture and storage practices against the Privacy Act APPs." },
              { label: "Ad fraud scan", text: "Scan our paid campaigns for click fraud, ad fraud signals, or invalid traffic that may be wasting budget." },
            ]}
          />
        </div>
      </div>
    </div>
  );
}