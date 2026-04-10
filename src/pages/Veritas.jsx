import { useState, useEffect, useRef } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Scale, FileText, Clock, Shield, Zap, Calendar, ChevronRight,
  Lock, Globe, Users, AlertCircle
} from "lucide-react";

const DOC_TYPE_CONFIG = {
  contract:        { label: "Contract",    color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  proposal:        { label: "Proposal",    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  sop:             { label: "SOP",         color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  note:            { label: "Note",        color: "text-slate-400",  bg: "bg-white/[0.03] border-white/[0.06]" },
  report:          { label: "Report",      color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  faq:             { label: "FAQ",         color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
  other:           { label: "Policy",      color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  compliance_report:{ label: "Compliance", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Contract Lifecycle",
    icon: FileText,
    color: "text-amber-400",
    commands: [
      { label: "Generate NDA", text: "Generate a mutual NDA. Ask me the parties involved, jurisdiction, and any special terms — then draft a complete NDA with clause-by-clause explanations." },
      { label: "Generate MSA / services agreement", text: "Generate a Master Services Agreement. Ask me the parties, the nature of services, jurisdiction, and key commercial terms — then draft a complete MSA." },
      { label: "Review a contract", text: "I need to review a contract before signing. Ask me to paste the contract text or describe the key terms — then give me a full risk analysis with a SIGN / NEGOTIATE / DO NOT SIGN recommendation." },
      { label: "Analyze a specific clause", text: "I want to analyze a specific contract clause. Ask me to paste the clause — then give me plain-language translation, risk rating, and three alternative language options." },
      { label: "Negotiation strategy", text: "I need help negotiating a contract. Ask me the deal context, our priorities, and what the counterparty is pushing back on — then give me a clause-by-clause negotiation playbook." },
      { label: "Track contract obligations", text: "Extract and track all key obligations from our contracts. Review the document library and identify deliverables, payment dates, notice requirements, and renewal deadlines." },
    ]
  },
  {
    label: "Regulatory & Compliance",
    icon: Globe,
    color: "text-blue-400",
    commands: [
      { label: "Full compliance gap analysis", text: "Perform a comprehensive compliance gap analysis. Review our business type and document library — then identify all regulatory gaps, rate them by priority, and give me a remediation plan." },
      { label: "Regulatory change monitoring", text: "What regulatory changes should we be aware of right now? Give me a current regulatory intelligence briefing relevant to our business with an action plan for this quarter." },
      { label: "Jurisdiction compliance check", text: "Check our compliance requirements for a specific jurisdiction. Ask me which country/state we're expanding into — then give me the full legal and regulatory requirements." },
      { label: "Generate compliance report", text: "Generate a full compliance status report for leadership. Include executive summary, compliance score, key findings, risk assessment, and remediation timeline." },
    ]
  },
  {
    label: "Data Privacy & GDPR",
    icon: Lock,
    color: "text-violet-400",
    commands: [
      { label: "Generate privacy policy", text: "Generate a comprehensive, GDPR/Privacy Act compliant privacy policy for our business. Ask me what data we collect and where we operate — then draft the full policy." },
      { label: "Handle a DSAR / deletion request", text: "I've received a data subject request. Ask me the type of request, who it's from, and what data we hold — then give me the full response plan, deadlines, and draft response letter." },
      { label: "Vendor privacy due diligence", text: "I need to do a privacy due diligence on a new vendor. Ask me the vendor name, what services they provide, and what data we'd share — then give me a full vendor privacy assessment." },
      { label: "Data breach response", text: "We may have experienced a data breach. Ask me what happened and what data was affected — then analyze notification obligations, deadlines, and draft the required notifications." },
    ]
  },
  {
    label: "IP & Intellectual Property",
    icon: Shield,
    color: "text-green-400",
    commands: [
      { label: "IP portfolio audit", text: "Audit our intellectual property portfolio. Identify what IP we have, what's protected, what's at risk, and what we should register — with cost estimates and priority actions." },
      { label: "Open source compliance check", text: "Check our open source license compliance. Ask me about our codebase and what open source components we use — then identify license obligations and risks." },
      { label: "Trademark infringement assessment", text: "I need to assess trademark risk. Ask me our brand name and what we're launching — then analyze potential conflicts and registration recommendations." },
      { label: "IP assignment review", text: "Review our IP assignment practices. Are contractors and employees properly assigning IP to the company? What agreements do we need?" },
    ]
  },
  {
    label: "Employment & HR Law",
    icon: Users,
    color: "text-cyan-400",
    commands: [
      { label: "Generate employment contract", text: "Generate a compliant employment agreement. Ask me the role, employment type, compensation, and jurisdiction — then draft a complete contract with jurisdiction-specific mandatory clauses." },
      { label: "Worker classification analysis", text: "Analyze whether a worker should be classified as employee or contractor. Ask me about the engagement — then apply the legal test and give me a risk-rated recommendation." },
      { label: "Leave policy compliance", text: "Review our leave policies for legal compliance. Check annual leave, sick leave, parental leave, and carer's leave against applicable law — flag any shortfalls." },
      { label: "Termination and severance guidance", text: "I need guidance on terminating an employee. Ask me the situation and jurisdiction — then walk me through the legally compliant process, notice periods, and severance." },
    ]
  },
  {
    label: "Risk & Governance",
    icon: AlertCircle,
    color: "text-orange-400",
    commands: [
      { label: "Legal risk assessment — new initiative", text: "Assess the legal risk of a new business initiative. Ask me what we're planning — then evaluate regulatory, contractual, IP, and liability risks with a GO/NO-GO recommendation." },
      { label: "Compliance risk dashboard", text: "Give me a compliance risk dashboard. Summarize our current legal risk posture, open compliance gaps, upcoming deadlines, and top actions needed this month." },
      { label: "Just-in-time compliance tips", text: "I'm about to do something that might have compliance implications. Ask me what activity — then give me a quick compliance checklist: dos, don'ts, required disclosures, and when to escalate." },
      { label: "Remediation plan", text: "Create a detailed compliance remediation plan. Ask me what areas need fixing — then give me a prioritized action plan with owners, timelines, and success criteria." },
    ]
  },
];

function DocumentRow({ doc, onSelect, selected }) {
  const cfg = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.note;
  return (
    <button onClick={() => onSelect(doc)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-indigo-500/10 border-indigo-500/30" : `${cfg.bg} hover:opacity-90`
      }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-200 truncate flex-1">{doc.title}</p>
        <span className={`text-[9px] flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      </div>
      {doc.status && <p className="text-[9px] text-slate-600 mt-0.5">{doc.status}</p>}
    </button>
  );
}

function EventRow({ event }) {
  const daysUntil = Math.ceil((new Date(event.start_time) - new Date()) / (1000 * 60 * 60 * 24));
  const urgentColor = daysUntil <= 7 ? "text-red-400" : daysUntil <= 30 ? "text-amber-400" : "text-slate-500";
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <p className="text-xs font-medium text-slate-200 truncate">{event.title}</p>
      <p className={`text-[9px] mt-0.5 ${urgentColor}`}>
        {daysUntil <= 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
      </p>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Scale className="w-3.5 h-3.5 text-indigo-400" />
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

export default function Veritas() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState("docs");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [], refetch } = useQuery({
    queryKey: ["veritas_docs"],
    queryFn: () => base44.entities.Document.list("-created_date", 60),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["veritas_events"],
    queryFn: async () => {
      const all = await base44.entities.CalendarEvent.list("start_time", 20);
      return all.filter(e => new Date(e.start_time) > new Date());
    },
  });

  const contracts = documents.filter(d => d.type === "contract" || d.type === "proposal");
  const policies = documents.filter(d => ["sop", "faq", "other", "compliance_report"].includes(d.type));
  const upcomingEvents = events.slice(0, 10);
  const urgentDeadlines = events.filter(e => {
    const days = Math.ceil((new Date(e.start_time) - new Date()) / 86400000);
    return days <= 30 && days >= 0;
  });

  const tabs = [
    { id: "docs",     label: "All",       count: documents.length },
    { id: "contracts",label: "Contracts", count: contracts.length },
    { id: "policies", label: "Policies",  count: policies.length },
    { id: "calendar", label: "Deadlines", count: upcomingEvents.length },
  ];

  const displayed = activeTab === "contracts" ? contracts : activeTab === "policies" ? policies : activeTab === "calendar" ? [] : documents;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "veritas_agent",
      metadata: { name: "Veritas Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["veritas_docs"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    sendMessage(`Review this document for legal risk and compliance: "${doc.title}" (type: ${doc.type}). ${doc.content ? `Content: ${doc.content.slice(0, 2000)}` : "Ask me for the content if needed."} Give me: risk-rated clause analysis, key obligations, missing provisions, and your SIGN / NEGOTIATE / DO NOT SIGN recommendation.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Scale className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Veritas</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-[10px] text-indigo-400">General Counsel</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Documents",  value: documents.length,        color: "text-indigo-400" },
              { label: "Contracts",  value: contracts.length,        color: "text-amber-400" },
              { label: "Policies",   value: policies.length,         color: "text-blue-400" },
              { label: "Deadlines",  value: upcomingEvents.length,   color: urgentDeadlines.length > 0 ? "text-red-400" : "text-slate-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {urgentDeadlines.length > 0 && (
            <button onClick={() => sendMessage(`There are ${urgentDeadlines.length} legal deadlines in the next 30 days. Give me a prioritized review of each with recommended actions.`)}
              className="mt-2 w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/15 transition-all">
              <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-400">{urgentDeadlines.length} deadlines in next 30 days</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 min-w-[44px] ${
                activeTab === t.id ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-slate-600 hover:text-slate-400"
              }`}>
              {t.label}{t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {activeTab === "calendar" ? (
            upcomingEvents.length === 0 ? (
              <div className="text-center py-10">
                <Calendar className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">No upcoming deadlines</p>
                <button onClick={() => sendMessage("Help me set up compliance deadline tracking. Ask me about my key contracts, obligations, and filing requirements.")}
                  className="mt-1 text-[10px] text-indigo-400 hover:underline">Track a deadline →</button>
              </div>
            ) : upcomingEvents.map(e => <EventRow key={e.id} event={e} />)
          ) : displayed.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">{activeTab === "contracts" ? "No contracts yet" : activeTab === "policies" ? "No policies yet" : "No documents yet"}</p>
              <button onClick={() => sendMessage(activeTab === "contracts" ? "Generate a contract for me. Ask what type." : "Generate a privacy policy for our business.")}
                className="mt-1 text-[10px] text-indigo-400 hover:underline">
                {activeTab === "contracts" ? "Generate a contract →" : "Generate a policy →"}
              </button>
            </div>
          ) : (
            displayed.map(d => (
              <DocumentRow key={d.id} doc={d} selected={selectedDoc?.id === d.id} onSelect={handleDocSelect} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I have a contract to review. Ask me to paste the text or describe the key terms — then give me a full risk analysis.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-indigo-500/30 transition-all">
            <Shield className="w-3 h-3" /> Review contract
          </button>
          <button onClick={() => sendMessage("Run a full compliance gap analysis. Review our document library and business context, then identify all gaps with a prioritized remediation plan.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-indigo-500/30 transition-all">
            <Scale className="w-3 h-3" /> Compliance audit
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedDoc ? `Reviewing: ${selectedDoc.title?.slice(0, 50)}` : "Veritas — General Counsel"}
            </h1>
            <p className="text-xs text-slate-500">Contracts · Compliance · Data privacy · IP · Employment law · Risk assessment</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Veritas capabilities — expand to explore</p>
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
                <Scale className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Veritas — your General Counsel</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {documents.length > 0
                  ? `${documents.length} documents on file. Click any document for a risk analysis, or expand a capability above.`
                  : "Legal protection starts here. Review contracts, generate compliant policies, assess legal risk, handle privacy requests, audit IP, and navigate employment law — expand a capability above to begin."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Scale className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400">Reviewing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Review contracts · Generate policies · Privacy compliance · IP protection · Employment law · Risk assessment..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click a document for risk analysis · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="sentinel_agent" agentLabel="Sentinel" agentEmoji="🛡️" accentColor="red"
          quickCommands={[
            { label: "Data breach legal response", text: "A potential data breach has been detected. Work with Veritas to determine notification obligations, timeline, and draft the required regulatory and individual notifications." },
            { label: "Legal hold coordination", text: "We anticipate litigation. Issue a legal hold on relevant data — coordinate with Veritas on what to preserve and who to notify." },
          ]} />
        <AgentPanel agentName="inspect_agent" agentLabel="Inspect" agentEmoji="🔍" accentColor="cyan"
          quickCommands={[
            { label: "Compliance testing rules", text: "Veritas has completed a regulatory review. Send Inspect the compliance requirements that need to be built into automated testing and QA processes." },
            { label: "Content compliance check", text: "Before publishing, run a compliance check on the latest content. Flag any regulatory issues for Veritas to review." },
          ]} />
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Create compliance tasks", text: "Veritas has completed a compliance gap analysis. Create tasks in Atlas for the top remediation actions with owners and deadlines." },
            { label: "Contract renewal workflow", text: "Set up automated contract renewal workflows in Atlas. Trigger 90-day and 30-day advance notifications for all contracts in the document library." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="blue"
          quickCommands={[
            { label: "Archive legal documents", text: "Archive all executed contracts, compliance reports, and legal policies in the knowledge base with proper tagging for future retrieval." },
            { label: "Audit trail documentation", text: "Document the compliance review process and findings for the audit trail — ensuring all regulatory requirements for record-keeping are met." },
          ]} />
      </div>
    </div>
  );
}
