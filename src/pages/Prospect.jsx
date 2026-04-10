import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Send, Plus, Loader2, Target, Zap, Search, RefreshCw, BarChart3, Flame,
  Mail, Globe, Sparkles
} from "lucide-react";
import LeadDetailPanel from "@/components/prospect/LeadDetailPanel";
import PipelineAnalytics from "@/components/prospect/PipelineAnalytics";
import OutreachStudio from "@/components/prospect/OutreachStudio";
import ABMIntelligence from "@/components/prospect/ABMIntelligence";
import AgentPanel from "@/components/agents/AgentPanel";

const STATUS_CONFIG = {
  new:          { label: "New",          color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  contacted:    { label: "Contacted",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  qualified:    { label: "Qualified",    color: "bg-green-500/15 text-green-400 border-green-500/20" },
  nurturing:    { label: "Nurturing",    color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  proposal:     { label: "Proposal",     color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  converted:    { label: "Converted",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  disqualified: { label: "Disqualified", color: "bg-red-500/15 text-red-400 border-red-500/20" },
  lost:         { label: "Lost",         color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
};

const SOURCE_ICONS = {
  linkedin: "in", twitter: "𝕏", website: "🌐", referral: "🤝",
  apollo: "🚀", manual: "✍️", email: "📧", event: "🎪", other: "•"
};

const QUICK_COMMANDS = [
  { label: "Pipeline report",       text: "Give me a complete pipeline intelligence report: total leads, hot leads needing immediate contact, pipeline health score, conversion rates, top opportunities, and the 3 most urgent actions I need to take right now." },
  { label: "Score all leads",       text: "Score all unscored leads in the database. Use firmographics, source quality, title seniority, and urgency signals. Flag hot leads (80+) for immediate outreach." },
  { label: "Bulk enrich leads",     text: "Enrich the top 10 leads that have incomplete profiles. Add company info, pain points, buying signals, and personalization angles for outreach." },
  { label: "Hospital discharge",    text: "Check for any hospital discharge leads — these are urgent (24-48 hour window). Who hasn't been contacted? Draft urgent outreach for them now." },
  { label: "ICP analysis",          text: "Analyze who converts best from our lead data. Build our Ideal Customer Profile, identify patterns in successful conversions, and tell me what to change in our targeting strategy." },
  { label: "Referral partner plan", text: "Build a referral partner strategy. Identify the best types of referral partners for NDIS and Aged Care, how to approach them, and how to structure a partnership tier system." },
  { label: "Funnel audit",          text: "Run a full funnel audit. Where are leads dropping off? What's our conversion rate at each stage? What are the top 3 improvements I should make this week?" },
  { label: "Competitor scan",       text: "Identify our top 3 competitors and tell me: what are their weaknesses, what do their customers complain about, and how should I position against them in outreach?" },
];

function ScoreBadge({ score }) {
  if (score === undefined || score === null) return <span className="text-[10px] text-slate-600">—</span>;
  const s = Number(score);
  if (s >= 80) return <span className="flex items-center gap-0.5 text-xs font-bold text-orange-400"><Flame className="w-3 h-3" />{s}</span>;
  if (s >= 60) return <span className="text-xs font-bold text-yellow-400">⚡{s}</span>;
  if (s >= 40) return <span className="text-xs font-bold text-blue-400">🌤️{s}</span>;
  return <span className="text-xs font-bold text-slate-500">❄️{s}</span>;
}

function LeadRow({ lead, onSelect, selected }) {
  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unknown";
  return (
    <button onClick={() => onSelect(lead)}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
        selected ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{name}</p>
          <p className="text-[10px] text-slate-500 truncate">{lead.title}{lead.title && lead.company ? " · " : ""}{lead.company}</p>
        </div>
        <ScoreBadge score={lead.score} />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
        {lead.source && <span className="text-[10px] text-slate-600">{SOURCE_ICONS[lead.source] || "•"} {lead.source}</span>}
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  if (!message.content) return null;
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Target className="w-3.5 h-3.5 text-violet-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? "bg-slate-700 text-white" : "bg-white/[0.05] border border-white/[0.08] text-slate-200"
      }`}>
        {isUser ? (
          <p className="leading-relaxed">{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function Prospect() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("chat");
  const [scoringAll, setScoringAll] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: leads = [], refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-score", 200),
    refetchInterval: 15000,
  });

  const hotLeads  = leads.filter(l => (l.score || 0) >= 80).length;
  const newLeads  = leads.filter(l => l.status === "new").length;
  const avgScore  = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length) : 0;

  const filtered = leads.filter(l => {
    const name = `${l.first_name || ""} ${l.last_name || ""} ${l.company || ""}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "prospect_agent",
      metadata: { name: "Prospect Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      const filtered = data.messages.filter(m => (m.role === "user" || m.role === "assistant") && m.content);
      setMessages(filtered);
      const last = data.messages[data.messages.length - 1];
      if (last?.role === "assistant" && last?.content) {
        setIsLoading(false);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    setActiveTab("chat");
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleLeadSelect = (lead) => {
    setSelectedLead(lead);
    const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
    sendMessage(`Deep-dive analysis on this lead: ${name}, ${lead.title || "Unknown title"} at ${lead.company || "Unknown company"}. Score: ${lead.score || "unscored"}. Status: ${lead.status}. Source: ${lead.source}. Email: ${lead.email || "none"}. Notes: ${lead.notes || "none"}.\n\nGive me:\n1. Lead quality assessment\n2. Buying signals or red flags\n3. Personalization angle for outreach\n4. Exact next 3 actions I should take\n5. Score justification`);
  };

  const scoreAllLeads = async () => {
    setScoringAll(true);
    await base44.functions.invoke('prospectLeadGeneration', { action: 'score_leads' });
    await refetch();
    setScoringAll(false);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel — Lead List */}
      <div className="w-64 xl:w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Header & Stats */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Target className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Prospect</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[10px] text-violet-400">Lead machine active</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Total",    value: leads.length,  color: "text-slate-300" },
              { label: "Hot 🔥",   value: hotLeads,      color: "text-orange-400" },
              { label: "New",      value: newLeads,      color: "text-blue-400" },
              { label: "Avg Score",value: avgScore,      color: "text-violet-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2.5 py-2">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Score Button */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <button onClick={scoreAllLeads} disabled={scoringAll}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400 hover:bg-violet-500/20 transition-all disabled:opacity-50">
            {scoringAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {scoringAll ? "Scoring..." : "AI Score All Leads"}
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-3 py-2 border-b border-white/[0.06] space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
              className="pl-7 h-7 text-xs bg-white/[0.03] border-white/[0.08] text-slate-300 placeholder:text-slate-600" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all", "new", "qualified", "nurturing", "converted"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  statusFilter === s ? "bg-violet-500/20 border-violet-500/30 text-violet-400" : "border-white/[0.06] text-slate-600 hover:text-slate-400"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Leads List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <Target className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No leads found</p>
              <button onClick={() => sendMessage("Help me build a referral partner network and discover new leads for NDIS and Aged Care services in my area.")}
                className="mt-2 text-[10px] text-violet-400 hover:underline">
                Start hunting →
              </button>
            </div>
          )}
          {filtered.map(lead => (
            <LeadRow key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} onSelect={handleLeadSelect} />
          ))}
        </div>

        {/* Add Lead */}
        <div className="p-3 border-t border-white/[0.06]">
          <button onClick={() => sendMessage("I want to manually add a new lead. Walk me through the fields one by one and create the record for me.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-violet-500/30 transition-all">
            <Plus className="w-3 h-3" /> Add Lead
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white">Prospect — Autonomous Lead Generation</h1>
            <p className="text-xs text-slate-500">Discover · Enrich · Score · Outreach · Convert</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => refetch()} className="text-slate-400 hover:text-white text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Session
            </Button>
            <Link to={createPageUrl("ProspectOpsHub")}>
              <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Prospect Ops Hub
              </Button>
            </Link>
            <Link to={createPageUrl("ProspectRevenueDashboard")}>
              <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1" /> Revenue Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b border-white/[0.06] flex-shrink-0">
            <TabsList className="bg-transparent p-0 h-auto gap-0">
              {[
                { value: "chat",     label: "AI Chat",       icon: Target },
                { value: "pipeline", label: "Pipeline",      icon: BarChart3 },
                { value: "outreach", label: "Outreach",      icon: Mail },
                { value: "abm",      label: "ABM & Intel",   icon: Globe },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded-none border-b-2 data-[state=active]:border-violet-500 data-[state=active]:text-violet-400 data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500 bg-transparent hover:text-slate-300 transition-all">
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.value === "pipeline" && hotLeads > 0 && (
                    <span className="ml-0.5 text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/20 px-1 py-0.5 rounded-full">{hotLeads}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0">
            {/* Quick Commands */}
            {messages.length === 0 && (
              <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
                <p className="text-xs text-slate-500 mb-3">Quick commands</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_COMMANDS.map(cmd => (
                    <button key={cmd.label} onClick={() => sendMessage(cmd.text)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/10 transition-all flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-violet-400" />
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-1 min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                      <Target className="w-8 h-8 text-violet-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Prospect is on the hunt</h3>
                    <p className="text-slate-500 text-sm max-w-sm">
                      {leads.length > 0
                        ? `${leads.length} leads in pipeline. ${hotLeads} are hot 🔥 — click one to analyze, or use a quick command.`
                        : "No leads yet. Ask me to discover leads, build a referral network, or set up ABM targeting."}
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                      <Target className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                      <span className="text-xs text-slate-400">Prospect hunting...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Lead Detail Sidebar */}
              {selectedLead && (
                <div className="w-72 flex-shrink-0">
                  <LeadDetailPanel
                    lead={selectedLead}
                    onEnrich={refetch}
                    onGenerateOutreach={() => {}}
                    onClose={() => setSelectedLead(null)}
                  />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Prospect to discover leads, score pipeline, generate outreach, run competitive intel, build ABM lists..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all resize-none min-h-[44px] max-h-32"
                  rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px"; }}
                />
                <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                  className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 flex-shrink-0 h-11 w-11 p-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Pipeline Analytics Tab */}
          <TabsContent value="pipeline" className="flex-1 overflow-y-auto mt-0">
            <PipelineAnalytics leads={leads} />
          </TabsContent>

          {/* Outreach Studio Tab */}
          <TabsContent value="outreach" className="flex-1 overflow-y-auto mt-0">
            <OutreachStudio leads={leads} />
          </TabsContent>

          {/* ABM & Intelligence Tab */}
          <TabsContent value="abm" className="flex-1 overflow-y-auto mt-0">
            <ABMIntelligence />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Sidebar — Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-l border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Enroll leads in nurture", text: "I have new leads from Prospect that need nurturing. Build me a personalised email nurture sequence for leads at the qualified stage." },
            { label: "Campaign for lead source", text: "Build a campaign targeting the top-converting lead source Prospect has identified. Use our best messaging and push hard." },
          ]} />
        <AgentPanel agentName="chronos_agent" agentLabel="Chronos" agentEmoji="⏱" accentColor="sky"
          quickCommands={[
            { label: "Book hot lead meetings", text: "Book discovery meetings for the top 3 hot leads in our pipeline. Find available slots and send calendar invites." },
            { label: "Follow-up reminders", text: "Set reminders for all leads that were contacted more than 48 hours ago with no response." },
          ]} />
        <AgentPanel agentName="sage_agent" agentLabel="Sage" agentEmoji="🧠" accentColor="amber"
          quickCommands={[
            { label: "ICP refinement from wins", text: "Analyze our recently converted leads to refine our ICP. What patterns predict conversion success?" },
            { label: "CAC by channel", text: "Calculate our customer acquisition cost by lead source. Which channels give us the best CAC and LTV ratio?" },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Pipeline revenue forecast", text: "Based on current pipeline velocity, forecast expected revenue from leads in the next 30, 60, and 90 days." },
            { label: "CAC vs LTV analysis", text: "What's our current CAC across channels and how does it compare to customer LTV? Is our acquisition strategy profitable?" },
          ]} />
      </div>
    </div>
  );
}

