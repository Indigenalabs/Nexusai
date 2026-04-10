import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldAlert, ShieldCheck, Send, RefreshCw,
  AlertTriangle, AlertCircle, Info, CheckCircle2, Lock, Loader2
} from "lucide-react";
import AgentPanel from "@/components/agents/AgentPanel";
import ReactMarkdown from "react-markdown";

const SEVERITY_CONFIG = {
  critical: { color: "red", icon: ShieldAlert, label: "CRITICAL", bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400" },
  high: { color: "orange", icon: AlertTriangle, label: "HIGH", bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
  medium: { color: "amber", icon: AlertCircle, label: "MEDIUM", bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400" },
  low: { color: "blue", icon: Info, label: "LOW", bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
};

const QUICK_SCANS = [
  { label: "Full threat scan", cmd: "Run a full security threat scan across all business data. Report every finding by severity with immediate actions." },
  { label: "Security posture report", cmd: "Generate a comprehensive security posture report with overall score, top risks, compliance status, and 30/60/90 day roadmap." },
  { label: "Dark web scan", cmd: "Scan the dark web for leaked credentials, exposed data, and any mentions of our organisation in hacker forums or breach databases." },
  { label: "Attack surface map", cmd: "Map our entire attack surface — exposed domains, cloud misconfigs, shadow IT, OSINT exposure, and email security (SPF/DKIM/DMARC)." },
  { label: "Threat intelligence", cmd: "Give me a current threat intelligence briefing — active threat actors targeting our sector, exploited CVEs, phishing IOCs, and MITRE ATT&CK techniques to watch this week." },
  { label: "Vulnerability scan", cmd: "Run a vulnerability scan. List all critical and high CVEs, missing patches, config vulnerabilities, and expired certificates with remediation priority." },
  { label: "Essential Eight", cmd: "Assess our ACSC Essential Eight maturity. Rate each of the 8 strategies at our current maturity level and tell me exactly what to do to reach the next level." },
  { label: "Privacy compliance", cmd: "Audit our privacy compliance against Australian Privacy Principles (APPs 1-13), the NDB scheme, and NDIS Privacy Rule. Flag every gap with remediation steps." },
  { label: "Identity & access audit", cmd: "Audit all privileged access and MFA coverage. Find orphaned accounts, excessive permissions, accounts without MFA, and legacy protocol bypass risks." },
  { label: "Penetration test", cmd: "Run a simulated penetration test. Show me all discovered attack paths, what an attacker could access, and the remediation priority list." },
  { label: "Brand protection", cmd: "Check for brand impersonation: typosquat domains, fake social accounts, phishing pages using our brand, and CEO fraud setup risks." },
  { label: "Incident playbook", cmd: "Generate a complete incident response playbook. Ask me what type of incident (ransomware, phishing, data breach, insider threat) and I'll produce the full playbook with Australian regulatory requirements." },
  { label: "Security awareness", cmd: "Design a security awareness training program for our team — phishing simulations, role-based modules, and a 12-month training calendar." },
  { label: "Risk register", cmd: "Build a quantitative security risk register using FAIR methodology. Show likelihood, impact, residual risk, treatment options, and annualised loss estimates." },
  { label: "Deception strategy", cmd: "Design a deception and honeypot strategy — honeytokens, canary files, tripwire accounts, and monitoring rules to catch attackers inside our environment." },
];

function IncidentCard({ incident, onResolve }) {
  const cfg = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.low;
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{incident.category}</Badge>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{incident.status}</Badge>
            </div>
            <p className="text-sm font-medium text-white truncate">{incident.title}</p>
            {incident.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{incident.description}</p>
            )}
          </div>
        </div>
        {incident.status !== "resolved" && (
          <button
            onClick={() => onResolve(incident.id)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-colors"
            title="Mark resolved"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-red-500/30 to-orange-500/30 border border-red-500/20 flex items-center justify-center mt-1">
          <Shield className="w-3.5 h-3.5 text-red-400" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? "bg-slate-700/80 text-white"
          : "bg-white/[0.04] border border-white/[0.08] text-slate-200"
      }`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400 font-semibold tracking-wide">SENTINEL</span>
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed text-slate-200">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-slate-300">{children}</li>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              h1: ({ children }) => <h1 className="text-base font-bold text-white my-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold text-white my-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-red-300 my-1">{children}</h3>,
              code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-orange-300">{children}</code>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  );
}

export default function Sentinel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: incidents = [] } = useQuery({
    queryKey: ["security_incidents"],
    queryFn: () => base44.entities.SecurityIncident.filter({ status: "open" }, "-created_date", 20),
    refetchInterval: 10000,
  });

  const { data: criticalCount = 0 } = useQuery({
    queryKey: ["critical_count"],
    queryFn: async () => {
      const all = await base44.entities.SecurityIncident.filter({ severity: "critical", status: "open" });
      return all.length;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    base44.agents.createConversation({
      agent_name: "sentinel_agent",
      metadata: { name: "Sentinel Security Session" }
    }).then(conv => {
      setConversation(conv);
      setIsReady(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const filtered = data.messages
        .filter(m => (m.role === "user" || m.role === "assistant") && m.content)
        .map(m => ({ role: m.role, content: m.content, id: m.id }));
      setMessages(filtered);
      const last = data.messages[data.messages.length - 1];
      if (last?.role === "assistant" && last?.content) {
        setIsLoading(false);
        queryClient.invalidateQueries({ queryKey: ["security_incidents"] });
      }
    });
    return unsubscribe;
  }, [conversation?.id]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isLoading || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const resolveIncident = async (id) => {
    await base44.entities.SecurityIncident.update(id, { status: "resolved" });
    queryClient.invalidateQueries({ queryKey: ["security_incidents"] });
  };

  const newSession = async () => {
    setMessages([]);
    setIsLoading(false);
    setIsReady(false);
    const conv = await base44.agents.createConversation({
      agent_name: "sentinel_agent",
      metadata: { name: "Sentinel Security Session" }
    });
    setConversation(conv);
    setIsReady(true);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex flex-col lg:flex-row">
      {/* Left Panel — Incidents */}
      <div className="lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Sentinel</h1>
              <p className="text-xs text-slate-500">Security Intelligence Agent</p>
            </div>
            <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isReady ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald-400" : "bg-slate-500/15 border border-slate-500/20 text-slate-400"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isReady ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
              {isReady ? "Active" : "Init..."}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-[10px] text-red-400/70 mt-0.5">Critical</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{incidents.filter(i => i.severity === "high").length}</p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">High Risk</p>
            </div>
          </div>
        </div>

        {/* Incidents List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Incidents</span>
            <span className="text-xs text-slate-600">{incidents.length} total</span>
          </div>
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400/40 mb-3" />
              <p className="text-sm text-slate-500">No open incidents</p>
              <p className="text-xs text-slate-600 mt-1">Run a scan to detect threats</p>
            </div>
          ) : (
            <AnimatePresence>
              {incidents.map(inc => (
                <IncidentCard key={inc.id} incident={inc} onResolve={resolveIncident} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-l border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="veritas_agent" agentLabel="Veritas" agentEmoji="⚖️" accentColor="indigo"
          quickCommands={[
            { label: "Data breach obligations", text: "Sentinel has detected a potential data breach. What are our legal notification obligations under the Privacy Act and NDB scheme?" },
            { label: "Security compliance requirements", text: "What security measures does Veritas say we legally must have in place for our industry and client contracts?" },
          ]} />
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Security remediation tasks", text: "Create Atlas tasks for each of Sentinel's high and critical security findings. Assign with owners and urgent deadlines." },
            { label: "Security awareness workflow", text: "Set up a recurring security awareness training workflow in Atlas for all team members." },
          ]} />
        <AgentPanel agentName="pulse_agent" agentLabel="Pulse" agentEmoji="❤️" accentColor="pink"
          quickCommands={[
            { label: "Insider threat review", text: "Sentinel has flagged unusual access patterns. Review the team members involved from a HR and conduct perspective." },
            { label: "Staff security training status", text: "Have all team members completed mandatory security awareness training? Flag anyone who hasn't." },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Financial fraud analysis", text: "Sentinel has detected financial anomalies. Cross-check with Centsible's transaction data for additional fraud patterns." },
            { label: "Security budget assessment", text: "What security investment do we need based on Sentinel's risk findings? Build the business case with ROI." },
          ]} />
      </div>

      {/* Right Panel — Chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Sentinel — Autonomous SOC</h2>
            <p className="text-xs text-slate-500">
            {isLoading ? "🔍 Scanning..." : "35 capabilities · Threat detection · IR · Compliance · Dark web · Pentest"}
            </p>
          </div>
          <button onClick={newSession} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>

        {/* Quick Scans */}
        <div className="px-5 py-3 border-b border-white/[0.04] overflow-x-auto">
          <div className="flex gap-2">
            {QUICK_SCANS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.cmd)}
                disabled={isLoading || !isReady}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs text-red-300 hover:text-red-200 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Shield className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 lg:px-8 py-6 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Sentinel standing by</h3>
                <p className="text-sm text-slate-500 max-w-sm">Your autonomous SOC is ready. Run a threat scan, check dark web exposure, audit compliance, simulate a pentest, or respond to any security incident.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_SCANS.slice(0, 3).map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s.cmd)} disabled={!isReady}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-40">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => <MessageBubble key={msg.id || i} message={msg} />)}
            {isLoading && (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500/30 to-orange-500/30 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                  {[0, 1, 2].map(j => (
                    <motion.div key={j} className="w-1.5 h-1.5 rounded-full bg-red-400"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.2 }} />
                  ))}
                  <span className="text-xs text-slate-500 ml-1">Sentinel scanning...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 lg:px-8 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Command Sentinel — scan, investigate, report, contain..."
              rows={1}
              style={{ resize: "none", minHeight: "48px", maxHeight: "120px" }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/40 transition-all"
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              disabled={isLoading || !conversation}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || !conversation}
              className="bg-red-600 hover:bg-red-500 text-white px-4 rounded-xl self-end h-12"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            Sentinel · 35 security capabilities · Autonomous SOC · 24/7 threat detection
          </p>
        </div>
      </div>
    </div>
  );
}