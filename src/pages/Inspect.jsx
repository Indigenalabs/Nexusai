import { useState, useEffect, useRef } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Search, Bug, CheckCircle2,
  AlertTriangle, XCircle, Zap, ChevronRight,
  Shield, FileText, BarChart2, ClipboardCheck,
  GitBranch, Users, TrendingUp
} from "lucide-react";

const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-400",    dot: "bg-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  high:     { label: "High",     color: "text-orange-400", dot: "bg-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  medium:   { label: "Medium",   color: "text-amber-400",  dot: "bg-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  low:      { label: "Low",      color: "text-blue-400",   dot: "bg-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
};

const STATUS_CONFIG = {
  open:          { label: "Open",          color: "text-red-400",    icon: XCircle },
  investigating: { label: "Investigating", color: "text-amber-400",  icon: Search },
  contained:     { label: "Contained",     color: "text-blue-400",   icon: Shield },
  resolved:      { label: "Resolved",      color: "text-green-400",  icon: CheckCircle2 },
  false_positive:{ label: "False +",       color: "text-slate-400",  icon: CheckCircle2 },
};

const CAPABILITY_GROUPS = [
  {
    label: "Software & Product QA",
    icon: Bug,
    color: "text-red-400",
    commands: [
      { label: "Run full test suite", text: "Run a full test suite on our product. Ask me the scope, feature, or area to test — then generate unit, integration, E2E, edge case, and negative tests with pass/fail results." },
      { label: "Regression test plan", text: "Create a regression test plan for a recent change. Ask me what changed — then identify the impact radius, must-run tests, and high-risk regressions." },
      { label: "API testing", text: "Test our API quality. Ask me the API name and endpoints — then run happy path, error handling, auth, rate limiting, and schema validation tests." },
      { label: "Security scan", text: "Perform a security quality assessment. Ask me what to scan — then check OWASP Top 10, authentication, data exposure, injection risks, and give me a security scorecard." },
      { label: "Accessibility audit", text: "Run a WCAG accessibility audit. Ask me the page or feature — then check perceivable, operable, understandable, and robust criteria with specific remediation steps." },
      { label: "Triage a bug", text: "Help me triage a bug. Ask me for the description, steps to reproduce, environment, and severity guess — then classify it, assess impact, hypothesize root cause, and recommend fix approach." },
    ]
  },
  {
    label: "Content & Creative QA",
    icon: FileText,
    color: "text-violet-400",
    commands: [
      { label: "Full content QA review", text: "Review my content for quality. Give me the content and I'll check grammar, clarity, brand voice, factual accuracy, compliance flags, and SEO — with a publish recommendation." },
      { label: "Brand voice compliance", text: "Check my content against our brand voice guidelines. Share the content and I'll identify what's off-brand, why, and rewrite the flagged sections." },
      { label: "Fact-check content", text: "Fact-check this content for accuracy. Give me the content — I'll extract every factual claim and verify/flag each one with sources." },
      { label: "Image quality check", text: "Check the quality of creative assets. Ask me what assets — then assess technical quality, brand compliance, copyright status, and optimization." },
    ]
  },
  {
    label: "Release Management",
    icon: GitBranch,
    color: "text-green-400",
    commands: [
      { label: "Release readiness — GO/NO-GO", text: "Assess release readiness and give me a clear GO or NO-GO. Tell me what's being released — I'll review all open bugs, blockers, and risks, then generate the pre-launch checklist." },
      { label: "Pre-launch checklist", text: "Generate a comprehensive pre-launch checklist. Ask me the launch type and product — then create a complete checklist covering technical, content, marketing, legal, support, and analytics." },
      { label: "Smoke test plan", text: "Create a post-deployment smoke test plan. Ask me what was deployed — then generate the critical tests to run immediately after launch." },
      { label: "Post-release monitoring plan", text: "Design a post-release monitoring plan. Ask me what launched — then specify what metrics to watch, alert thresholds, and rollback triggers for the first 72 hours." },
    ]
  },
  {
    label: "Process & Operations QA",
    icon: ClipboardCheck,
    color: "text-amber-400",
    commands: [
      { label: "Process adherence audit", text: "Audit process adherence across our operations. Review current tasks and workflows for SOP deviations, bottlenecks, missing QA checkpoints, and automation opportunities." },
      { label: "SLA compliance check", text: "Check our SLA compliance across all active tickets and operations. Flag breaches, identify at-risk items, and give me the root causes with prevention recommendations." },
      { label: "Data quality audit", text: "Audit our data quality. Ask me which area to focus on — then check completeness, accuracy, consistency, duplicates, and formatting, with a priority cleanup list." },
      { label: "Root cause analysis", text: "Perform a root cause analysis. Describe the incident or recurring issue — I'll run 5-Why and Fishbone analysis, identify systemic patterns, and give corrective + preventive actions." },
    ]
  },
  {
    label: "Customer Experience QA",
    icon: Users,
    color: "text-blue-400",
    commands: [
      { label: "Support quality analysis", text: "Analyze our customer support quality. Review recent tickets for resolution accuracy, empathy, SLA adherence, and knowledge gaps — with coaching recommendations." },
      { label: "Customer feedback analysis", text: "Analyze customer feedback for quality signals. Give me the feedback data — I'll surface themes, quality issues, churn risks, and priority action items." },
      { label: "NPS/CSAT driver analysis", text: "Identify the drivers of our NPS and CSAT scores. What's causing satisfaction and dissatisfaction? Give me specific quality levers to pull." },
      { label: "Journey quality map", text: "Map quality issues across the customer journey. Identify which touchpoints have the most quality problems and where drop-off correlates with quality failures." },
    ]
  },
  {
    label: "Analytics & Forecasting",
    icon: TrendingUp,
    color: "text-cyan-400",
    commands: [
      { label: "Quality health dashboard", text: "Generate a full quality health dashboard. Summarize defect state, SLA performance, quality trends, top risks, wins, and cost of quality estimate." },
      { label: "Anomaly detection", text: "Run anomaly detection across all available metrics. Find unusual spikes, drops, trend breaks, and correlations — with probable causes and recommended investigations." },
      { label: "Quality forecast — 30 days", text: "Forecast our quality health for the next 30 days. Consider planned changes, current trends, and historical patterns — then predict issues and recommend preventive actions." },
      { label: "Cost of quality analysis", text: "Calculate our cost of poor quality. Estimate internal failure costs (rework, bug fixing) and external failure costs (support, churn) — and show me the ROI of quality investment." },
    ]
  },
  {
    label: "Compliance & Governance",
    icon: Shield,
    color: "text-orange-400",
    commands: [
      { label: "Compliance checklist", text: "Generate a compliance checklist for our business. Ask me the compliance type and context — cover data privacy, security, content, financial, and industry-specific requirements." },
      { label: "Audit trail review", text: "Review our audit trail for completeness and compliance. Check regulated processes for GDPR, security, and financial compliance — flag any gaps." },
      { label: "Regulatory content check", text: "Check our content and communications for regulatory compliance. Flag required disclaimers, non-compliant claims, and advertising standard violations." },
      { label: "Policy compliance test", text: "Test that our systems and processes adhere to internal policies. Ask me which policy area — then generate a compliance assessment with gaps and remediation plan." },
    ]
  },
];

function BugCard({ bug, onSelect, selected }) {
  const sev = SEVERITY_CONFIG[bug.severity] || SEVERITY_CONFIG.medium;
  const StatusIcon = (STATUS_CONFIG[bug.status] || STATUS_CONFIG.open).icon;
  const statusColor = (STATUS_CONFIG[bug.status] || STATUS_CONFIG.open).color;
  return (
    <button onClick={() => onSelect(bug)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-cyan-500/10 border-cyan-500/30" : `${sev.bg} hover:opacity-90`
      }`}>
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${sev.dot}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-200 truncate">{bug.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[9px] ${sev.color}`}>{sev.label}</span>
            <span className="text-[9px] text-slate-700">·</span>
            <div className="flex items-center gap-0.5">
              <StatusIcon className={`w-2.5 h-2.5 ${statusColor}`} />
              <span className={`text-[9px] ${statusColor}`}>{(STATUS_CONFIG[bug.status] || STATUS_CONFIG.open).label}</span>
            </div>
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
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Search className="w-3.5 h-3.5 text-cyan-400" />
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

export default function Inspect() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedBug, setSelectedBug] = useState(null);
  const [activeTab, setActiveTab] = useState("open");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: incidents = [], refetch } = useQuery({
    queryKey: ["inspect_incidents"],
    queryFn: () => base44.entities.SecurityIncident.list("-created_date", 100),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["inspect_tickets"],
    queryFn: () => base44.entities.Ticket.list("-created_date", 30),
  });

  const openBugs     = incidents.filter(i => i.status === "open");
  const activeBugs   = incidents.filter(i => ["open","investigating"].includes(i.status));
  const resolvedBugs = incidents.filter(i => ["resolved","false_positive"].includes(i.status));
  const criticalBugs = incidents.filter(i => i.severity === "critical" && i.status !== "resolved");

  const tabs = [
    { id: "open",     label: "Open",     count: openBugs.length },
    { id: "active",   label: "Active",   count: activeBugs.length },
    { id: "resolved", label: "Resolved", count: resolvedBugs.length },
  ];

  const displayed = activeTab === "open" ? openBugs : activeTab === "active" ? activeBugs : resolvedBugs;

  const qualityScore = incidents.length === 0 ? 100 : Math.max(0, Math.round(
    100 - (criticalBugs.length * 20) - (openBugs.length * 3)
  ));
  const scoreColor = qualityScore >= 80 ? "text-green-400" : qualityScore >= 60 ? "text-amber-400" : "text-red-400";

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "inspect_agent",
      metadata: { name: "Inspect Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["inspect_incidents"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleBugSelect = (bug) => {
    setSelectedBug(bug);
    sendMessage(`Analyze this issue: "${bug.title}". Severity: ${bug.severity}. Status: ${bug.status}. ${bug.description ? `Description: ${bug.description}` : ""} Give me: impact assessment, likely root cause (5-Why), recommended fix approach, regression tests to prevent recurrence, and severity validation.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Search className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Inspect</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-cyan-400">Chief Quality Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Quality score", value: `${qualityScore}%`, color: scoreColor },
              { label: "Critical",      value: criticalBugs.length, color: criticalBugs.length > 0 ? "text-red-400" : "text-slate-600" },
              { label: "Open bugs",     value: openBugs.length,     color: openBugs.length > 0 ? "text-amber-400" : "text-slate-600" },
              { label: "User reports",  value: tickets.length,      color: "text-cyan-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {criticalBugs.length > 0 && (
            <button onClick={() => sendMessage(`There are ${criticalBugs.length} critical bugs open. Give me an immediate impact assessment and priority action plan.`)}
              className="mt-2 w-full bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-red-500/15 transition-all">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{criticalBugs.length} critical — click for impact assessment</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === t.id ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-600 hover:text-slate-400"
              }`}>
              {t.label}{t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {displayed.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-6 h-6 text-green-500/40 mx-auto mb-2" />
              <p className="text-xs text-slate-600">{activeTab === "resolved" ? "No resolved bugs" : "No bugs here 🎉"}</p>
              {activeTab === "open" && (
                <button onClick={() => sendMessage("Help me file a new bug report. Ask me for the details.")}
                  className="mt-1 text-[10px] text-cyan-400 hover:underline">File a bug →</button>
              )}
            </div>
          ) : (
            displayed.map(bug => (
              <BugCard key={bug.id} bug={bug} selected={selectedBug?.id === bug.id} onSelect={handleBugSelect} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I need to file a new bug report. Ask me for all the details — description, steps to reproduce, expected vs actual, severity guess, and environment.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-cyan-500/30 transition-all">
            <Bug className="w-3 h-3" /> File a bug
          </button>
          <button onClick={() => sendMessage("Generate a full quality health dashboard. Summarize all quality signals, defect state, SLA performance, top risks, and cost of quality.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-cyan-500/30 transition-all">
            <BarChart2 className="w-3 h-3" /> Quality dashboard
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedBug ? `Analyzing: ${selectedBug.title?.slice(0, 50)}` : "Inspect — Chief Quality Officer"}
            </h1>
            <p className="text-xs text-slate-500">Software QA · Content QA · Release management · Process audits · Compliance · Anomaly detection</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Inspect capabilities — expand to explore</p>
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
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-cyan-500/20 hover:bg-cyan-500/5 transition-all flex items-center gap-2">
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
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Inspect is watching quality</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {incidents.length > 0
                  ? `${openBugs.length} open bugs${criticalBugs.length > 0 ? `, ${criticalBugs.length} critical` : ""}. Click any bug for impact analysis, or expand a capability above.`
                  : "The quality guardian is ready. Run tests, audit content, assess releases, analyze compliance, detect anomalies, or triage bugs — expand a capability above to begin."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Search className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-400">Inspecting...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Run tests · Audit content · Review releases · Analyze compliance · Detect anomalies · Triage bugs · Root cause analysis..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click a bug to analyze · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Create fix tasks", text: "Take Inspect's latest quality findings and create tasks in Atlas for the top 5 fixes — with priority, owner team, and estimated effort." },
            { label: "Process quality gates", text: "Integrate Inspect's quality checks as mandatory gates in our operational workflows. Which workflows need quality checkpoints added?" },
          ]} />
        <AgentPanel agentName="sentinel_agent" agentLabel="Sentinel" agentEmoji="🛡️" accentColor="red"
          quickCommands={[
            { label: "Security test coordination", text: "Coordinate with Inspect on the latest security scan results. What security issues need immediate remediation vs. scheduled fixes?" },
            { label: "Release security gate", text: "Before the next release, confirm all security tests from Inspect have passed and there are no DAST/SAST findings blocking release." },
          ]} />
        <AgentPanel agentName="support_sage_agent" agentLabel="Support Sage" agentEmoji="💬" accentColor="blue"
          quickCommands={[
            { label: "Validate bug fixes", text: "Review customer-reported issues that have been marked fixed. Have the underlying quality issues been resolved or are customers still experiencing problems?" },
            { label: "Customer quality signals", text: "Analyze recent support tickets for quality patterns that Inspect should be investigating or building tests for." },
          ]} />
        <AgentPanel agentName="veritas_agent" agentLabel="Veritas" agentEmoji="⚖️" accentColor="purple"
          quickCommands={[
            { label: "Compliance test rules", text: "Send Inspect the current regulatory requirements that need to be encoded as automated compliance tests." },
            { label: "Audit trail review", text: "Work with Inspect to ensure all regulated processes have complete audit trails and are meeting compliance requirements." },
          ]} />
      </div>
    </div>
  );
}