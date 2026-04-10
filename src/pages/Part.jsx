import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import AgentPanel from "@/components/agents/AgentPanel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Handshake, Users, TrendingUp,
  Zap, Star, AlertTriangle, Globe, Megaphone, Network,
  ChevronRight, BarChart2, Heart, Search
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

const STATUS_CONFIG = {
  prospect:    { label: "Prospect",    color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  outreach:    { label: "Outreach",    color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  negotiating: { label: "Negotiating", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  active:      { label: "Active",      color: "bg-green-500/15 text-green-400 border-green-500/20" },
  paused:      { label: "Paused",      color: "bg-slate-500/15 text-slate-500 border-slate-500/10" },
  ended:       { label: "Ended",       color: "bg-red-500/10 text-red-500 border-red-500/10" },
};

const TYPE_ICONS = {
  integration: Globe, reseller: TrendingUp, affiliate: Star,
  co_marketing: Megaphone, influencer: Users, referral: Network,
  strategic: Handshake, event: Star,
};

const CAPABILITY_GROUPS = [
  {
    label: "Partner Discovery",
    icon: Search,
    color: "text-indigo-400",
    commands: [
      { label: "Find new partners", text: "Search for high-potential business partners for my company. Ask me about our industry, what we do, and what kind of partners we're looking for." },
      { label: "Scout influencers", text: "Scout for relevant influencers and content creators for a partnership program. Ask me about our target audience and preferred platforms." },
      { label: "Competitor partner map", text: "Map the partner ecosystems of my competitors — who are they partnered with, and where are the gaps we can exploit?" },
      { label: "Intent-based discovery", text: "Find companies actively looking for partners in our space — companies hiring partnership roles, launching integration marketplaces, or attending partner events." },
    ]
  },
  {
    label: "Outreach & Agreements",
    icon: Handshake,
    color: "text-blue-400",
    commands: [
      { label: "Draft outreach message", text: "Help me draft a personalized partnership outreach message. Ask me who I want to reach out to and what I know about them." },
      { label: "Generate partner agreement", text: "Generate a partnership agreement template. Ask me the partner type (referral, reseller, affiliate, technology) and any specific terms." },
      { label: "Onboarding plan", text: "Create a partner onboarding plan for a new partner. Ask me about their type and what they need to get started effectively." },
      { label: "Partner training brief", text: "Create a partner training and enablement plan. Ask me what they need to know to represent us effectively." },
    ]
  },
  {
    label: "Relationship Management",
    icon: Heart,
    color: "text-pink-400",
    commands: [
      { label: "Health audit", text: "Perform a full health audit of all our partnerships — score each relationship, flag at-risk ones, and give me this week's priority actions." },
      { label: "Prepare QBR", text: "Prepare a quarterly business review for a partner. Ask me which partner and I'll generate the full QBR package." },
      { label: "Conflict detection", text: "Scan for channel conflicts or deal overlaps in our partner ecosystem — are any partners competing with us or with each other?" },
      { label: "Re-engagement strategy", text: "Generate a re-engagement strategy for partners we haven't spoken to in a while. Which ones are at risk and how should we reconnect?" },
    ]
  },
  {
    label: "Co-Marketing & Co-Selling",
    icon: Megaphone,
    color: "text-violet-400",
    commands: [
      { label: "Co-marketing campaign", text: "Plan a joint co-marketing campaign with a partner. Ask me which partner and what type of campaign (webinar, content, social, event)." },
      { label: "Co-branded content", text: "Generate a co-branded content piece with a partner. Ask me which partner, the topic, and the format." },
      { label: "Cross-sell opportunities", text: "Identify cross-selling opportunities across our partner ecosystem — where can we sell to each other's customers?" },
      { label: "Event strategy", text: "Develop an event strategy for an upcoming conference or trade show. Ask me about the event and our goals." },
    ]
  },
  {
    label: "Influencer & Affiliates",
    icon: Star,
    color: "text-amber-400",
    commands: [
      { label: "Vet an influencer", text: "Vet an influencer for a brand partnership — assess authenticity, audience fit, brand safety, and give me a recommend/pass verdict." },
      { label: "Campaign brief", text: "Create a detailed campaign brief for an influencer partnership. Ask me about the influencer, goals, and key messages." },
      { label: "Affiliate setup plan", text: "Design an affiliate program structure — commission rates, tracking, payouts, and how to recruit affiliates." },
      { label: "Influencer performance review", text: "Analyze the performance of our influencer and affiliate partnerships — who's delivering ROI and who needs to be re-evaluated?" },
    ]
  },
  {
    label: "Analytics & Finance",
    icon: BarChart2,
    color: "text-emerald-400",
    commands: [
      { label: "Partner performance report", text: "Generate a full partner performance analytics report — top performers, underperformers, revenue by type, and portfolio optimization recommendations." },
      { label: "Partner LTV modeling", text: "Model the lifetime value of each active partner — 12-month and 36-month projections with investment recommendations." },
      { label: "Commission calculation", text: "Calculate and structure the right commission for a partner deal. Ask me about the partner type, deal value, and any agreed rates." },
      { label: "ROI by partner type", text: "Analyze ROI across our different partner categories — which types are delivering the most value and where should we invest more?" },
    ]
  },
  {
    label: "Ecosystem Strategy",
    icon: Network,
    color: "text-cyan-400",
    commands: [
      { label: "Cross-partner opportunities", text: "Identify opportunities for our partners to collaborate with each other — introductions I should facilitate and ecosystem plays we could build." },
      { label: "Ecosystem positioning", text: "Analyze our position in the broader ecosystem — where do we sit, who should we integrate with next, and what's our ecosystem strategy?" },
      { label: "Technology partner scan", text: "Scan for technology integration partners — companies with APIs or platforms that could integrate with us to create joint value." },
      { label: "Partnership roadmap", text: "Build a 90-day partnership development roadmap — which types to prioritize, targets to pursue, and milestones to hit." },
    ]
  },
];

function PartnerCard({ partner, onSelect, selected }) {
  const status = STATUS_CONFIG[partner.status] || STATUS_CONFIG.prospect;
  const TypeIcon = TYPE_ICONS[partner.type] || Handshake;
  const isAtRisk = partner.status === "active" && partner.last_contact &&
    differenceInDays(new Date(), parseISO(partner.last_contact)) > 60;
  const isOverdue = partner.next_contact && differenceInDays(new Date(), parseISO(partner.next_contact)) > 0;

  return (
    <button onClick={() => onSelect(partner)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-3 h-3 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{partner.company_name}</p>
          {partner.contact_name && <p className="text-[9px] text-slate-600">{partner.contact_name}</p>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
            {partner.opportunity_score > 0 && <span className="text-[9px] text-violet-400">{partner.opportunity_score}/100</span>}
            {partner.revenue_attributed > 0 && <span className="text-[9px] text-green-400">${partner.revenue_attributed.toLocaleString()}</span>}
            {isAtRisk && <span className="text-[9px] text-red-400 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />At risk</span>}
            {isOverdue && !isAtRisk && <span className="text-[9px] text-amber-400">Follow-up due</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Handshake className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? "bg-slate-700 text-white" : "bg-white/[0.05] border border-white/[0.08] text-slate-200"
      }`}>
        {isUser
          ? <p className="leading-relaxed">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{message.content}</ReactMarkdown>
        }
      </div>
    </div>
  );
}

export default function Part() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: partners = [], refetch } = useQuery({
    queryKey: ["partners"],
    queryFn: () => base44.entities.Partner.list("-created_date", 100),
  });

  const active = partners.filter(p => p.status === "active");
  const inOutreach = partners.filter(p => p.status === "outreach" || p.status === "negotiating");
  const atRisk = partners.filter(p =>
    p.status === "active" && p.last_contact &&
    differenceInDays(new Date(), parseISO(p.last_contact)) > 60
  );
  const totalRevenue = partners.reduce((sum, p) => sum + (p.revenue_attributed || 0), 0);

  const filtered = partners.filter(p => {
    if (statusFilter === "all") return true;
    if (statusFilter === "at_risk") return atRisk.includes(p);
    return p.status === statusFilter;
  });

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "part_agent",
      metadata: { name: "Part Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handlePartnerSelect = (partner) => {
    setSelectedPartner(partner);
    sendMessage(`Give me a full relationship analysis for ${partner.company_name}${partner.contact_name ? ` (contact: ${partner.contact_name})` : ""}. Status: ${partner.status}. ${partner.last_contact ? `Last contact: ${partner.last_contact}.` : "No contact logged."} Revenue attributed: $${partner.revenue_attributed || 0}. Leads: ${partner.leads_generated || 0}. ${partner.notes ? `Notes: ${partner.notes}` : ""} What's the health of this relationship, what should I do next, and what opportunities am I missing with them?`);
  };

  const statusFilters = [
    { id: "all", label: "All" },
    { id: "prospect", label: "Prospects" },
    { id: "outreach", label: "Outreach" },
    { id: "active", label: "Active" },
    { id: "at_risk", label: "At Risk" },
  ];

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Handshake className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Part</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-[10px] text-indigo-400">Chief Partnership Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Active", value: active.length, color: "text-green-400" },
              { label: "In Outreach", value: inOutreach.length, color: "text-blue-400" },
              { label: "At Risk", value: atRisk.length, color: atRisk.length > 0 ? "text-red-400" : "text-slate-600" },
              { label: "Revenue", value: totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(1)}k` : "$0", color: "text-indigo-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {atRisk.length > 0 && (
            <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{atRisk.length} relationship{atRisk.length > 1 ? "s" : ""} at risk</span>
              <button onClick={() => sendMessage("Which partner relationships are at risk right now and what should I do to re-engage them?")}
                className="ml-auto text-[10px] text-red-400 hover:underline">Fix →</button>
            </div>
          )}
        </div>

        {/* Status Filters */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex gap-1 flex-wrap">
            {statusFilters.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`text-[9px] px-2 py-1 rounded-full transition-all ${
                  statusFilter === f.id ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-slate-600 hover:text-slate-400"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Partner List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Network className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No partners here</p>
              <button onClick={() => sendMessage("Help me find potential partners. Ask me about our industry and what we're looking for.")}
                className="mt-1 text-[10px] text-indigo-400 hover:underline">Find partners →</button>
            </div>
          ) : (
            filtered.map(p => (
              <PartnerCard key={p.id} partner={p} selected={selectedPartner?.id === p.id} onSelect={handlePartnerSelect} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I want to add a new partner or contact to track. Ask me for the details.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-indigo-500/30 transition-all">
            <Plus className="w-3 h-3" /> Add partner
          </button>
          <button onClick={() => sendMessage("Run a full health audit on all our partnerships — score each one, flag at-risk relationships, and tell me this week's priority actions.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-indigo-500/30 transition-all">
            <BarChart2 className="w-3 h-3" /> Health audit
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedPartner ? `Analyzing: ${selectedPartner.company_name}` : "Part — Partnership Engine"}
            </h1>
            <p className="text-xs text-slate-500">
              {selectedPartner
                ? `${selectedPartner.type || "partner"} · ${selectedPartner.status}`
                : "Discover · Cultivate · Co-market · Manage · Optimize your entire partner ecosystem"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capabilities */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Part capabilities — expand to explore</p>
            <div className="space-y-2">
              {CAPABILITY_GROUPS.map(group => {
                const Icon = group.icon;
                const isExpanded = expandedGroup === group.label;
                return (
                  <div key={group.label} className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <button onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-all">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${group.color}`} />
                      <span className="text-xs font-medium text-slate-300 flex-1">{group.label}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] p-2 space-y-1">
                        {group.commands.map(cmd => (
                          <button key={cmd.label} onClick={() => sendMessage(cmd.text)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-indigo-500/20 hover:bg-indigo-500/5 transition-all flex items-center gap-2">
                            <Zap className={`w-3 h-3 flex-shrink-0 ${group.color}`} />
                            {cmd.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Handshake className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Part is ready to grow your network</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {partners.length > 0
                  ? `${partners.length} partners tracked${atRisk.length > 0 ? `, ${atRisk.length} need attention` : ""}. Click any partner for a full analysis, or expand a capability group above.`
                  : "Your network is your net worth. Expand a capability above or ask Part to find your first strategic partners."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Handshake className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400">Building your ecosystem...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Find partners · Draft outreach · Health audit · Co-marketing plan · Influencer vetting · Commission calc · Cross-sell opportunities..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click any partner for a relationship deep-dive · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar — Connected Agents */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Partner market intel", text: "Give me market intelligence on potential partners in our space — who's active, who's growing, and who we should approach first." },
            { label: "Competitor partner moves", text: "What partnership moves are our competitors making? Who are they partnering with and how should we respond?" },
          ]} />
        <AgentPanel agentName="prospect_agent" agentLabel="Prospect" agentEmoji="🎯" accentColor="blue"
          quickCommands={[
            { label: "Route partner leads", text: "We have partner-sourced leads coming in. Help me route and prioritize them for the sales pipeline." },
            { label: "Find partners from prospects", text: "Looking at our prospect database, which companies would make better partners than customers?" },
          ]} />
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Launch co-marketing campaign", text: "We have a partner ready for a co-marketing campaign. Help us plan and launch it across our channels." },
            { label: "Co-branded content", text: "Create co-branded content for a partner announcement — social posts, email, and blog content." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="green"
          quickCommands={[
            { label: "Archive partner agreements", text: "Archive our latest partner agreements and QBR documents into the knowledge base." },
            { label: "Partner enablement docs", text: "Create partner enablement documentation — what partners need to know to represent us effectively." },
          ]} />
      </div>
    </div>
  );
}