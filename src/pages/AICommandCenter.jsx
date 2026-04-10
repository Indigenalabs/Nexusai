import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Brain, Send, Sparkles, Zap, RefreshCw, BarChart3, Users,
  DollarSign, TrendingUp, FileText, Target, AlertTriangle, Loader2,
  LayoutGrid, MessageSquare, FlaskConical, Bell, ChevronDown
} from "lucide-react";
import NexusBrain from "@/components/dashboard/NexusBrain";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";
import AgentGrid from "@/components/command/AgentGrid";
import HealthGauge from "@/components/command/HealthGauge";
import CrossAgentInsights from "@/components/command/CrossAgentInsights";
import ScenarioPlanner from "@/components/command/ScenarioPlanner";
import AlertCenter from "@/components/command/AlertCenter";
import WorkflowMonitor from "@/components/command/WorkflowMonitor";

const QUICK_COMMANDS = [
  { icon: BarChart3,    label: "Full command briefing",    color: "blue",   cmd: "Run a full command briefing across all 17 agents. Synthesize critical alerts, financial health, sales pipeline, team wellbeing, security posture, and compliance status. Identify the top 5 priorities and tell me what you've dispatched autonomously vs what needs my decision." },
  { icon: DollarSign,  label: "Revenue & finance",         color: "emerald", cmd: "Coordinate Centsible + Merchant + Prospect: what is our complete revenue picture? Cash flow, overdue invoices, pipeline value, and e-commerce. Flag risks and recommend corrective actions." },
  { icon: Users,       label: "Customer & team scan",      color: "violet", cmd: "Coordinate Support Sage + Pulse + Prospect: scan for customer churn risk, check team for burnout signals, and flag any leads needing urgent follow-up. Give me a unified people health report." },
  { icon: TrendingUp,  label: "Growth intelligence",       color: "amber",  cmd: "Coordinate Compass + Sage + Part + Maestro: what are the top 3 market opportunities right now? What are competitors doing? Which partnerships should I pursue? Give me an integrated growth action plan." },
  { icon: AlertTriangle, label: "Risk & compliance",       color: "red",    cmd: "Coordinate Sentinel + Veritas + Inspect + Centsible: run a full risk scan. Security threats, compliance deadlines, quality gaps, financial anomalies. Prioritized risk report with actions." },
  { icon: Sparkles,    label: "Content & brand sprint",    color: "pink",   cmd: "Coordinate Canvas + Maestro + Compass: what content should we create this week? Review trends, brand positioning, and campaign gaps. Generate a prioritized content plan with specific asset recommendations." },
  { icon: Target,      label: "Today's priorities",        color: "blue",   cmd: "Synthesize signals from all 17 agents. What are the 5 most important things I should do today? Rank by urgency and business impact. For each, tell me which agent owns it and what specific action to take." },
  { icon: Zap,         label: "Ops & workflow health",     color: "orange", cmd: "Coordinate Atlas + Chronos + Scribe + Inspect: check all active tasks and workflows. What's overdue, blocked, or at risk? Give me an operational health report with specific actions." },
  { icon: FileText,    label: "Weekly strategic review",   color: "indigo", cmd: "Run a comprehensive weekly strategic review across all 17 agents. What went well, what needs attention, what is the market doing, where are we at risk, and what are the top 3 strategic moves for next week?" },
  { icon: Brain,       label: "Board-ready brief",         color: "cyan",   cmd: "Generate a board-ready strategic briefing. Pull from all agent domains — financial health, growth metrics, risks, opportunities, and strategic progress. Format it as an executive summary I can present to leadership." },
  { icon: Users,       label: "Cross-agent insights",      color: "violet", cmd: "Generate 5 cross-domain insights by connecting patterns across multiple agents — insights that no single agent would detect alone. Look across sales, marketing, finance, operations, people, and customer data." },
  { icon: TrendingUp,  label: "OKR progress",              color: "emerald", cmd: "Assess our OKR and goal progress across all agent domains. What are we on track for, what's at risk, and what specific actions would accelerate each key result?" },
];

const VIEWS = [
  { id: "chat",      label: "Command",    icon: MessageSquare },
  { id: "dashboard", label: "Dashboard",  icon: LayoutGrid },
  { id: "alerts",    label: "Alerts",     icon: Bell },
  { id: "scenarios", label: "Scenarios",  icon: FlaskConical },
];

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <NexusBrain size={28} isThinking={false} />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isUser ? "bg-blue-600/80 text-white" : "bg-white/[0.04] border border-white/[0.08] text-slate-200"
      }`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span className="text-xs text-violet-400 font-semibold">NEXUS</span>
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed text-slate-200">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-slate-300">{children}</li>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              h1: ({ children }) => <h1 className="text-base font-bold text-white my-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold text-white my-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-blue-300 my-1">{children}</h3>,
              code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-violet-300">{children}</code>,
            }}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
}

export default function AICommandCenter() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [proactiveTriggered, setProactiveTriggered] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [showAllCommands, setShowAllCommands] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { data: nexusHealth, isFetching: isRefreshingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["nexus_command_center_health_strip"],
    queryFn: async () => {
      const res = await base44.functions.invoke("commandCenterIntelligence", {
        action: "command_center_full_self_test",
      });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    base44.agents.createConversation({
      agent_name: "nexus_agent",
      metadata: { name: "Nexus Command Center" }
    }).then(conv => {
      setConversation(conv);
      setIsReady(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    let isMounted = true;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      if (!isMounted) return;
      const allMessages = (data.messages || [])
        .filter(m => (m.role === "user" || m.role === "assistant") && m.content)
        .map(m => ({ role: m.role, content: m.content, id: m.id }));
      setMessages(allMessages);
      const lastMsg = data.messages?.[data.messages.length - 1];
      if (lastMsg?.role === "assistant") setIsLoading(false);
    });
    return () => { isMounted = false; unsubscribe?.(); };
  }, [conversation?.id]);

  useEffect(() => {
    if (!isReady || !conversation?.id || proactiveTriggered) return;
    setProactiveTriggered(true);
    const timer = setTimeout(() => {
      if (conversation?.id) {
        base44.agents.addMessage(conversation, {
          role: "user",
          content: "You are now active as the Nexus Command Center — the unified brain coordinating all 17 specialist agents. Run your integrated startup scan. Check: Centsible (finance), Prospect (sales pipeline), Support Sage (customer issues), Sentinel (security), Veritas (compliance), Pulse (team health), Atlas (operations), Compass (market). Surface the top priorities across all domains, flag any critical issues, and give me a command briefing. Be direct and decisive. Name which agent each signal comes from and tell me what you've dispatched autonomously vs what needs my attention."
        });
        setIsLoading(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [isReady, conversation?.id, proactiveTriggered]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading || !conversation?.id) return;
    setInput("");
    setIsLoading(true);
    setActiveView("chat");
    await base44.agents.addMessage(conversation, { role: "user", content: msg }).catch(() => { setIsLoading(false); });
  };

  const handleNewSession = async () => {
    setMessages([]);
    setIsLoading(false);
    setProactiveTriggered(false);
    setIsReady(false);
    const conv = await base44.agents.createConversation({
      agent_name: "nexus_agent",
      metadata: { name: "Nexus Command Center" }
    });
    setConversation(conv);
    setIsReady(true);
  };

  const visibleCommands = showAllCommands ? QUICK_COMMANDS : QUICK_COMMANDS.slice(0, 6);
  const checks = nexusHealth?.checks || {};
  const checkCount = Object.keys(checks).length;
  const passCount = Object.values(checks).filter(Boolean).length;
  const healthScore = nexusHealth?.health?.health_score - "--";
  const criticalAlerts = nexusHealth?.health?.unread_critical_alerts - "--";
  const activeWorkflows = nexusHealth?.health?.active_workflows - "--";

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid flex flex-col">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-3 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <NexusBrain size={36} isThinking={isLoading} />
          <div>
            <h1 className="text-xl font-bold text-white">Nexus Command Center</h1>
            <p className="text-xs text-slate-500">
              {isLoading ? "Coordinating agents..." : isReady ? "17 agents online - full orchestration mode" : "Initializing..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {VIEWS.map(v => {
              const Icon = v.icon;
              return (
                <button key={v.id} onClick={() => setActiveView(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeView === v.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${isReady ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" : "bg-slate-500/15 border-slate-500/20 text-slate-400"}`}>
            <div className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
            {isReady ? "Live" : "Starting..."}
          </div>
          <button onClick={handleNewSession}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
            <RefreshCw className="w-3.5 h-3.5" /> New Session
          </button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="px-6 lg:px-8 py-2 border-b border-white/[0.04]">
        <div className="flex flex-wrap gap-1.5 items-center">
          {visibleCommands.map((qc, i) => (
            <button key={i} onClick={() => sendMessage(qc.cmd)} disabled={isLoading || !isReady}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-slate-400 hover:text-slate-200 transition-all whitespace-nowrap disabled:opacity-40">
              <qc.icon className="w-3 h-3" />
              {qc.label}
            </button>
          ))}
          <button onClick={() => setShowAllCommands(s => !s)}
            className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-2">
            {showAllCommands ? "Less" : `+${QUICK_COMMANDS.length - 6} more`}
            <ChevronDown className={`w-3 h-3 transition-transform ${showAllCommands ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Nexus Control Strip */}
      <div className="px-6 lg:px-8 py-3 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] text-slate-500">Health Score</p>
              <p className="text-sm font-semibold text-blue-300">{healthScore}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] text-slate-500">Self-Test</p>
              <p className="text-sm font-semibold text-white">{passCount}/{checkCount || "--"}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] text-slate-500">Critical Alerts</p>
              <p className="text-sm font-semibold text-rose-300">{criticalAlerts}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] text-slate-500">Active Workflows</p>
              <p className="text-sm font-semibold text-cyan-300">{activeWorkflows}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-white/15 text-slate-300"
              onClick={() => refetchHealth()}
              disabled={isRefreshingHealth}
            >
              {isRefreshingHealth ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              Refresh Health
            </Button>
            <Link to={createPageUrl("NexusOpsHub")}>
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">Open Nexus Ops</Button>
            </Link>
            <Link to={createPageUrl("NexusIntelligenceDashboard")}>
              <Button variant="outline" className="border-blue-500/40 text-blue-300">Open Nexus Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* CHAT VIEW */}
        {activeView === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
                    <Brain className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Nexus is initializing...</h3>
                    <p className="text-sm text-slate-500">Scanning all 17 agents and preparing your command briefing.</p>
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => <MessageBubble key={msg.id || i} message={msg} />)}
                {isLoading && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <NexusBrain size={28} isThinking={true} />
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                          animate={{ opacity: [0.3,1,0.3], scale: [0.8,1,0.8] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                      ))}
                      <span className="text-xs text-slate-500 ml-1">Nexus coordinating agents...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
            <div className="px-6 lg:px-8 py-4 border-t border-white/[0.06]">
              <div className="flex gap-3">
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Command Nexus — synthesize, execute, analyse, orchestrate across all 17 agents..."
                  rows={1} style={{ resize: "none", minHeight: "48px", maxHeight: "120px" }}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  disabled={isLoading || !conversation} />
                <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading || !conversation}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl self-end h-12">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2 text-center">
                Nexus has full access to all agent data and can execute actions autonomously - Enter to send
              </p>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {activeView === "dashboard" && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-1">
                <HealthGauge onDrillDown={() => sendMessage("What are the specific actions I should take to improve our business health score? Give me a step-by-step improvement plan across all domains.")} />
              </div>
              <div className="lg:col-span-2">
                <AgentGrid onAgentCommand={sendMessage} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CrossAgentInsights onInsightCommand={sendMessage} />
              <WorkflowMonitor onCommand={sendMessage} />
            </div>
          </div>
        )}

        {/* ALERTS VIEW */}
        {activeView === "alerts" && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-2xl">
              <AlertCenter onAlertCommand={(cmd) => { sendMessage(cmd); setActiveView("chat"); }} />
            </div>
          </div>
        )}

        {/* SCENARIOS VIEW */}
        {activeView === "scenarios" && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-2xl space-y-4">
              <ScenarioPlanner />
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-xs font-semibold text-white mb-3">Quick Scenario Commands</p>
                <div className="space-y-1.5">
                  {[
                    "Model the business impact of hiring 5 new staff members across operations and support over the next 90 days",
                    "What happens if we launch a new service line targeting a different customer segment next quarter?",
                    "Model the impact of a 10% price increase across our services — financial, competitive, and customer impact",
                    "What if our largest referral partner stopped sending us leads? Model the impact and mitigation strategies",
                    "Scenario: a major security breach occurs. Model the business, legal, financial, and reputational impact",
                    "What if we double our marketing budget for Q2? Model ROI across all channels and domains",
                  ].map((s, i) => (
                    <button key={i} onClick={() => { sendMessage(`Run a multi-agent scenario model: ${s}`); setActiveView("chat"); }}
                      className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-400 hover:text-white hover:border-cyan-500/20 hover:bg-cyan-500/5 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


