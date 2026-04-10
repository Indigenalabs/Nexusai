import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Loader2, BookOpen, FileText, Search, Upload,
  Zap, ClipboardList, FolderOpen, ChevronRight, Brain, BarChart3, RefreshCw, Shield, AlertCircle
} from "lucide-react";
import AgentPanel from "@/components/agents/AgentPanel";
import { format } from "date-fns";

const TYPE_CONFIG = {
  meeting_notes:  { label: "Meeting",     color: "bg-blue-500/15 text-blue-400 border-blue-500/20",    dot: "bg-blue-400" },
  proposal:       { label: "Proposal",    color: "bg-violet-500/15 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  contract:       { label: "Contract",    color: "bg-amber-500/15 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
  report:         { label: "Report",      color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",    dot: "bg-cyan-400" },
  sop:            { label: "SOP",         color: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  faq:            { label: "FAQ",         color: "bg-orange-500/15 text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
  note:           { label: "Note",        color: "bg-slate-500/15 text-slate-400 border-slate-500/20", dot: "bg-slate-400" },
  email:          { label: "Email",       color: "bg-pink-500/15 text-pink-400 border-pink-500/20",    dot: "bg-pink-400" },
  decision_log:   { label: "Decision",    color: "bg-red-500/15 text-red-400 border-red-500/20",       dot: "bg-red-400" },
  presentation:   { label: "Slides",      color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20", dot: "bg-indigo-400" },
  other:          { label: "Other",       color: "bg-slate-500/15 text-slate-400 border-slate-500/20", dot: "bg-slate-400" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Capture & Store",
    icon: FileText,
    color: "text-emerald-400",
    commands: [
      { label: "Upload & process file", text: "I want to upload a document for Scribe to process, classify, and index. What file formats do you support and what will you extract?" },
      { label: "Summarize meeting notes", text: "I have meeting notes to document. Ask me for the details and I'll paste the notes — generate a structured summary with decisions and action items." },
      { label: "Log a decision", text: "I need to log an important decision. Ask me for the decision, the rationale, and what alternatives were considered." },
      { label: "Archive communication", text: "I have an email or message thread to archive. Ask me for the content and I'll organize it into the knowledge base." },
    ]
  },
  {
    label: "Search & Retrieve",
    icon: Search,
    color: "text-sky-400",
    commands: [
      { label: "Search knowledge base", text: "I need to find something in the knowledge base. What would you like to search for?" },
      { label: "Answer a question", text: "I have a question about our organizational history or processes. Ask me what you want to know and I'll search everything we have." },
      { label: "Synthesize a topic", text: "I want a deep synthesis of everything we know about a specific topic. Ask me which topic and I'll compile everything from the knowledge base." },
      { label: "Surface lessons learned", text: "I'm starting something new and want to learn from past experience. Tell me what the project or topic is and I'll surface relevant lessons." },
    ]
  },
  {
    label: "Generate Documents",
    icon: Brain,
    color: "text-purple-400",
    commands: [
      { label: "Write an SOP", text: "I need a Standard Operating Procedure written. Ask me for the process name, description, and any compliance requirements." },
      { label: "Generate any document", text: "I need a professional document created from scratch. Ask me what type of document and what it should cover." },
      { label: "Create easy-read version", text: "I need to convert a complex document into easy-read format. Ask me which document or paste the content." },
      { label: "Write formal minutes", text: "I need to convert raw meeting notes into formal governance-standard minutes. Ask me for the meeting details and notes." },
    ]
  },
  {
    label: "Compliance & Audit",
    icon: Shield,
    color: "text-amber-400",
    commands: [
      { label: "Compliance package", text: "I need to prepare a compliance documentation package. Ask me which standard (NDIS, ISO, etc.) and the audit scope." },
      { label: "Audit trail", text: "I need an audit trail report. Ask me for the entity type and date range to cover." },
      { label: "Knowledge gap analysis", text: "Run a knowledge gap analysis — tell me what critical documentation is missing and what should be our priority to create." },
      { label: "Extract action items", text: "I have a document or notes with action items buried in them. I'll paste the text and you extract every action, decision, and follow-up." },
    ]
  },
  {
    label: "Analytics & Health",
    icon: BarChart3,
    color: "text-cyan-400",
    commands: [
      { label: "Knowledge health score", text: "Assess the health of our knowledge base — score it, identify strengths and weaknesses, and recommend the top improvements." },
      { label: "Weekly knowledge digest", text: "Generate this week's knowledge digest — what was documented, key decisions recorded, and next week's documentation priorities." },
      { label: "Organize & categorize", text: "Organize and categorize our knowledge base — suggest taxonomy improvements, cross-references, and a coverage map." },
      { label: "Who knows what", text: "Help me identify who in the organization has expertise on specific topics based on their documents and contributions." },
    ]
  },
];

const TYPE_FILTERS = ["all", "meeting_notes", "sop", "decision_log", "proposal", "report", "note", "faq"];

function DocCard({ doc, onSelect, selected }) {
  const cfg = TYPE_CONFIG[doc.type] || TYPE_CONFIG.other;
  const date = doc.created_date ? format(new Date(doc.created_date), "MMM d") : "";

  return (
    <button onClick={() => onSelect(doc)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start gap-2">
        <div className={`w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} style={{ minHeight: 14, minWidth: 6, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{doc.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[9px] text-slate-600">{date}</span>
            {doc.action_items?.length > 0 && (
              <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                <ClipboardList className="w-2.5 h-2.5" />{doc.action_items.length}
              </span>
            )}
          </div>
          {doc.tags?.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {doc.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[9px] text-slate-600 bg-white/[0.03] px-1 rounded">{t}</span>
              ))}
            </div>
          )}
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
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
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

export default function Scribe() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);

  const { data: documents = [], refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list("-created_date", 100),
  });

  const filtered = documents.filter(d => {
    const matchType = filterType === "all" || d.type === filterType;
    const matchSearch = !searchQuery ||
      d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      d.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const stats = {
    total: documents.length,
    meetings: documents.filter(d => d.type === "meeting_notes").length,
    sops: documents.filter(d => d.type === "sop").length,
    decisions: documents.filter(d => d.type === "decision_log").length,
    actions: documents.reduce((sum, d) => sum + (d.action_items?.length || 0), 0),
  };

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "scribe_agent",
      metadata: { name: "Scribe Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
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
    sendMessage(`Analyse this document and surface everything useful from it: "${doc.title}" (type: ${doc.type}). Summary: ${doc.summary || "none"}. Content: ${doc.content || "no content stored"}. Tags: ${doc.tags?.join(", ") || "none"}. ${doc.action_items?.length ? `Action items: ${doc.action_items.join(", ")}` : ""} Tell me what this document contains, what decisions or actions are in it, and what related knowledge exists in the knowledge base.`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sendMessage(`I've uploaded a file for you to ingest: "${file.name}". File URL: ${file_url}. Please extract all content, classify the document type, generate a summary, extract action items and decisions, suggest tags, and store it in the knowledge base.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Connected Agents Panel */}
      <div className="hidden xl:flex w-56 flex-shrink-0 border-r border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Push action items as tasks", text: "Scribe has extracted action items from the latest documents. Create Atlas tasks for each one with appropriate owners and deadlines." },
            { label: "Archive SOPs to knowledge base", text: "Atlas has finalized the key workflow SOPs. Archive them in Scribe's knowledge base with proper categorization." },
          ]} />
        <AgentPanel agentName="veritas_agent" agentLabel="Veritas" agentEmoji="⚖️" accentColor="indigo"
          quickCommands={[
            { label: "Compliance documentation package", text: "Prepare a compliance documentation package from Scribe's knowledge base. What evidence do we have for each compliance area?" },
            { label: "Archive contracts in knowledge base", text: "Archive the latest contracts and legal documents in Scribe with proper tagging for easy retrieval." },
          ]} />
        <AgentPanel agentName="pulse_agent" agentLabel="Pulse" agentEmoji="❤️" accentColor="pink"
          quickCommands={[
            { label: "Employee handbook from knowledge base", text: "What people and HR documentation exists in the knowledge base? Is it complete or are there gaps?" },
            { label: "Training materials from SOPs", text: "Convert relevant SOPs from Scribe into training materials for new team members." },
          ]} />
      </div>

      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Scribe</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">Chief Knowledge Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { label: "Docs", value: stats.total, color: "text-emerald-400" },
              { label: "SOPs", value: stats.sops, color: "text-green-400" },
              { label: "Decisions", value: stats.decisions, color: "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Meetings", value: stats.meetings, color: "text-blue-400" },
              { label: "Action Items", value: stats.actions, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-slate-300 placeholder:text-slate-600 pl-7 pr-3 py-2 outline-none focus:border-emerald-500/30" />
          </div>
        </div>

        {/* Type filters */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex gap-1 flex-wrap">
            {TYPE_FILTERS.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`text-[9px] px-2 py-1 rounded-full transition-all ${
                  filterType === t ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-600 hover:text-slate-400"
                }`}>
                {t === "all" ? "All" : TYPE_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <FolderOpen className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No documents yet</p>
              <button onClick={() => sendMessage("What's the most important documentation I should create first to build a strong organizational knowledge base? Guide me through setting up a complete document system.")}
                className="mt-2 text-[10px] text-emerald-400 hover:underline">
                Set up knowledge base →
              </button>
            </div>
          ) : (
            filtered.map(doc => (
              <DocCard key={doc.id} doc={doc} selected={selectedDoc?.id === doc.id} onSelect={handleDocSelect} />
            ))
          )}
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <label className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-emerald-500/30 transition-all cursor-pointer">
            <Upload className="w-3 h-3" /> Upload & ingest document
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx" />
          </label>
          <button onClick={() => sendMessage("Run a knowledge gap analysis — tell me what critical documentation is missing and what I should prioritize creating.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-emerald-500/30 transition-all">
            <AlertCircle className="w-3 h-3" /> Knowledge gap analysis
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Scribe — Chief Knowledge Officer</h1>

            <p className="text-xs text-slate-500">Capture · Organize · Retrieve · SOPs · Decisions · Compliance · Synthesis</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capabilities */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Scribe capabilities — expand to explore</p>
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
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all flex items-center gap-2">
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
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Scribe is ready</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {documents.length > 0
                  ? `${documents.length} documents in the knowledge base. Click any document to analyse it, or expand a capability above.`
                  : "The knowledge base is empty. Upload a document, paste meeting notes, log a decision, or ask Scribe to write an SOP to get started."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-400">Searching the knowledge base...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Search knowledge · Log a decision · Write an SOP · Summarize a meeting · Compliance package · Synthesize a topic..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Upload files for automatic extraction · Click any document to analyse it</p>
        </div>
      </div>
    </div>
  );
}