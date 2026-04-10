import { useState, useEffect, useRef } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, CheckCircle, AlertTriangle, BookOpen, RefreshCw, Zap, HeartHandshake,
  MailOpen, Globe, Phone, MessageCircle, ChevronRight,
  BarChart3, Shield, Brain, AlertCircle
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  open:            { label: "Open",        color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  pending:         { label: "Pending",     color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  ai_responded:    { label: "AI Done",     color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  assigned_to_ai:  { label: "AI Active",   color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  escalated:       { label: "Escalated",   color: "bg-red-500/10 text-red-400 border-red-500/20" },
  resolved:        { label: "Resolved",    color: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed:          { label: "Closed",      color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const PRIORITY_CONFIG = {
  low:      { color: "text-slate-400", dot: "bg-slate-400" },
  medium:   { color: "text-blue-400",  dot: "bg-blue-400" },
  high:     { color: "text-orange-400", dot: "bg-orange-400" },
  critical: { color: "text-red-400",   dot: "bg-red-400" },
  urgent:   { color: "text-red-400",   dot: "bg-red-400" },
};

const CHANNEL_ICONS = {
  email:   MailOpen,
  chat:    MessageCircle,
  social:  Globe,
  web:     Globe,
  phone:   Phone,
  whatsapp: MessageCircle,
};

const CAPABILITY_GROUPS = [
  {
    label: "Triage & Resolution",
    icon: HeartHandshake,
    color: "text-teal-400",
    commands: [
      { label: "Triage all open tickets", text: "Analyze and triage all open tickets. Prioritize by urgency, sentiment, and business impact. Flag any VIP or churn-risk customers." },
      { label: "Analyze sentiment across all tickets", text: "Perform a comprehensive sentiment analysis across all recent tickets. What are customers feeling and why?" },
      { label: "Spot recurring issues", text: "Identify the most common recurring issues from recent tickets. What are the root causes and how do we fix them for good?" },
      { label: "Troubleshoot a specific issue", text: "Help me build a step-by-step troubleshooting guide. Ask me what issue the customer is experiencing." },
    ]
  },
  {
    label: "Knowledge & Self-Service",
    icon: BookOpen,
    color: "text-emerald-400",
    commands: [
      { label: "Identify knowledge gaps", text: "Analyze all unresolved tickets to identify knowledge base gaps. What articles should we create to deflect common questions?" },
      { label: "Draft KB article", text: "Draft a new knowledge base article. Ask me which topic and I'll generate a customer-friendly article." },
      { label: "Generate FAQ document", text: "Generate a comprehensive FAQ from our most common support questions. Include clear answers and tag each by topic." },
      { label: "KB health check", text: "Assess the health of our knowledge base. Is it comprehensive? What's missing? What needs updating?" },
    ]
  },
  {
    label: "Customer Intelligence",
    icon: Brain,
    color: "text-purple-400",
    commands: [
      { label: "CSAT & NPS analysis", text: "Analyze customer satisfaction across all resolved tickets. Calculate estimated CSAT, NPS, and first-contact resolution rate. Top improvements?" },
      { label: "Churn risk assessment", text: "Identify customers at high churn risk based on their support history. Who needs proactive outreach right now?" },
      { label: "Customer health scores", text: "Score the health of our customer portfolio based on support patterns. Who is thriving and who is at risk?" },
      { label: "Root cause analysis", text: "Perform a root cause analysis on all support tickets. What underlying issues are generating the most tickets and which agent should fix each?" },
    ]
  },
  {
    label: "Analytics & Crisis",
    icon: BarChart3,
    color: "text-amber-400",
    commands: [
      { label: "Full support analytics", text: "Generate a comprehensive support performance report — KPIs, resolution rates, escalation rates, AI deflection, health score, and top improvements." },
      { label: "Incident detection", text: "Check for active support incidents. Is there a spike in tickets suggesting a widespread product or billing problem?" },
      { label: "Volume forecast", text: "Forecast support ticket volume for the next 2 weeks. When will we be busiest and what categories should we prepare for?" },
      { label: "Proactive outreach", text: "Help me send proactive outreach to a customer. Ask me for the customer details and reason for outreach." },
    ]
  },
  {
    label: "Financial & Compliance",
    icon: Shield,
    color: "text-cyan-400",
    commands: [
      { label: "Process refund", text: "I need to process a refund. Ask me for the customer details, order ID, and amount — I'll run a fraud check and approve." },
      { label: "Issue goodwill credit", text: "I need to issue a goodwill credit to a customer. Ask me for the details." },
      { label: "Escalation report", text: "Review all escalated tickets and provide a full summary with recommended actions, owner assignments, and resolution paths." },
      { label: "Post-interaction summary", text: "Generate a post-interaction summary. Paste the conversation and I'll extract action items, quality score, and lessons learned." },
    ]
  },
];

function TicketCard({ ticket, onClick, isSelected }) {
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const ChannelIcon = CHANNEL_ICONS[ticket.channel] || Globe;
  const date = ticket.created_date ? format(new Date(ticket.created_date), "MMM d, h:mm a") : "";

  return (
    <div onClick={() => onClick(ticket)}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        isSelected ? "bg-teal-500/10 border-teal-500/30" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
      }`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChannelIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-300 truncate font-medium">{ticket.customer_name || ticket.customer_email || "Anonymous"}</span>
        </div>
        <Badge className={`text-[9px] px-1.5 py-0 border flex-shrink-0 ${status.color}`}>{status.label}</Badge>
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 mb-2">{ticket.subject || ticket.message}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          <span className={`text-[10px] font-medium ${priority.color}`}>{ticket.priority || "medium"}</span>
          {ticket.category && <span className="text-[9px] text-slate-600">· {ticket.category}</span>}
        </div>
        <div className="flex items-center gap-1">
          {(ticket.sentiment === "frustrated" || ticket.sentiment === "angry") && <AlertTriangle className="w-3 h-3 text-red-400" />}
          <span className="text-[9px] text-slate-600">{date}</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />
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

export default function SupportSage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", statusFilter],
    queryFn: () => statusFilter === "all"
      ? base44.entities.Ticket.list("-created_date", 100)
      : base44.entities.Ticket.filter({ status: statusFilter }, "-created_date", 50),
    refetchInterval: 30000,
  });

  const { data: kbCount = 0 } = useQuery({
    queryKey: ["kb_count"],
    queryFn: async () => {
      const items = await base44.entities.KnowledgeBase.list().catch(() => []);
      return items.length;
    },
  });

  const stats = {
    open: tickets.filter(t => t.status === "open" || t.status === "pending").length,
    escalated: tickets.filter(t => t.status === "escalated").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    frustrated: tickets.filter(t => t.sentiment === "angry" || t.sentiment === "frustrated").length,
  };

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "support_sage_agent",
      metadata: { name: "Support Sage Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    });
  };

  const resolveTicketMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Ticket.update(id, { status: "resolved", resolved_at: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tickets"] }); setSelectedTicket(null); },
  });

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleTicketSelect = (ticket) => {
    setSelectedTicket(ticket);
    sendMessage(`Analyze this support ticket and provide: 1) A recommended response to send, 2) Root cause assessment, 3) Priority and sentiment evaluation, 4) Whether to escalate or resolve, 5) Any churn risk signals.

**Customer:** ${ticket.customer_name || ticket.customer_email || "Unknown"}
**Channel:** ${ticket.channel || "unknown"}
**Subject:** ${ticket.subject || "N/A"}
**Message:** ${ticket.message || ticket.subject || "No message"}
**Status:** ${ticket.status}
**Priority:** ${ticket.priority || "not set"}
**Sentiment:** ${ticket.sentiment || "unknown"}
**Category:** ${ticket.category || "unknown"}`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <HeartHandshake className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Support Sage</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[10px] text-teal-400">Chief Customer Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            {[
              { label: "Open", value: stats.open, color: "text-blue-400" },
              { label: "Escalated", value: stats.escalated, color: "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Resolved", value: stats.resolved, color: "text-green-400" },
              { label: "Frustrated", value: stats.frustrated, color: stats.frustrated > 0 ? "text-orange-400" : "text-slate-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {stats.escalated > 0 && (
            <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{stats.escalated} ticket{stats.escalated > 1 ? "s" : ""} need attention</span>
              <button onClick={() => sendMessage("Review all escalated tickets and give me a full summary with recommended actions for each.")} className="ml-auto text-[10px] text-red-400 hover:underline">Review →</button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex gap-1 flex-wrap">
            {["open", "escalated", "resolved", "closed", "all"].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`text-[9px] px-2 py-1 rounded-lg capitalize transition-all ${
                  statusFilter === f ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <HeartHandshake className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              No tickets found
            </div>
          ) : (
            tickets.map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={handleTicketSelect} isSelected={selectedTicket?.id === ticket.id} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{kbCount} KB Articles</span>
            </div>
            <button onClick={() => sendMessage("Identify knowledge gaps from recent tickets and suggest the top 5 articles to create to reduce ticket volume.")}
              className="text-teal-400 hover:text-teal-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => sendMessage("Check for active support incidents — is there a spike in tickets suggesting a widespread product or billing issue right now?")}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-teal-400 hover:border-teal-500/30 transition-all">
            <AlertCircle className="w-3 h-3" /> Incident Check
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedTicket ? `Analyzing: ${selectedTicket.customer_name || selectedTicket.customer_email || "Ticket"}` : "Support Sage — Chief Customer Officer"}
            </h1>
            <p className="text-xs text-slate-500">
              {selectedTicket
                ? `${selectedTicket.channel || "web"} · ${selectedTicket.priority || "medium"} priority · ${selectedTicket.category || "general"}`
                : "Triage · Resolution · CSAT · Root Cause · Churn Risk · Knowledge · Crisis Management"}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedTicket && (
              <Button size="sm" onClick={() => resolveTicketMutation.mutate({ id: selectedTicket.id })}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-xs">
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Session
            </Button>
          </div>
        </div>

        {/* Capabilities */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Support Sage capabilities — expand to explore</p>
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
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-teal-500/20 hover:bg-teal-500/5 transition-all flex items-center gap-2">
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
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
                <HeartHandshake className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Support Sage is ready</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {tickets.length > 0
                  ? `${stats.open} open tickets. Click any ticket to analyze it, or expand a capability above.`
                  : "No tickets yet. Expand a capability above or ask Support Sage to analyze patterns, build a knowledge base, or prepare for customer interactions."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                <span className="text-xs text-slate-400">Helping your customers...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Triage tickets · Draft responses · CSAT analysis · Root cause · Churn risk · Process refund · Incident detection..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click any ticket for AI analysis · Expand capabilities above</p>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="inspect_agent" agentLabel="Inspect" agentEmoji="🔍" accentColor="cyan"
          quickCommands={[
            { label: "Link tickets to bugs", text: `${stats.open} open support tickets. Are any matching known product bugs? What should we file?` },
            { label: "Suggest tests from tickets", text: "Based on common support issues, what new test cases should we add to prevent regressions?" },
          ]} />
        <AgentPanel agentName="sentinel_agent" agentLabel="Sentinel" agentEmoji="🛡️" accentColor="red"
          quickCommands={[
            { label: "Security scan tickets", text: "Scan support tickets for security patterns — phishing reports, account compromise attempts, data concerns." },
            { label: "Incident check", text: "Are any current support tickets suggesting a security incident or unauthorized access attempt?" },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="green"
          quickCommands={[
            { label: "Archive ticket insights", text: "Archive the key insights and patterns from this week's support tickets into the knowledge base." },
            { label: "Find past resolution", text: "Search the knowledge base for past resolutions to our most common ticket types this week." },
          ]} />
      </div>
    </div>
  );
}