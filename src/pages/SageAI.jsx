import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Brain, Zap, Lightbulb, TrendingUp, BarChart3, Users, RefreshCw,
  ChevronRight, Crosshair, Map, FlaskConical
} from "lucide-react";
import AgentPanel from "@/components/agents/AgentPanel";

const STATUS_CONFIG = {
  proposed:    { label: "Proposed",    color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  approved:    { label: "Approved",    color: "bg-green-500/15 text-green-400 border-green-500/20" },
  in_progress: { label: "In Progress", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  completed:   { label: "Completed",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  rejected:    { label: "Rejected",    color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Business Health",
    icon: BarChart3,
    color: "text-amber-400",
    commands: [
      { label: "Full health check", text: "Run a full business health check. Score all 5 dimensions and tell me the single most important thing to fix." },
      { label: "Trend analysis", text: "Analyze our revenue and growth trends. Flag any anomalies — positive or negative — and give me a 3-month forecast." },
      { label: "Benchmark vs industry", text: "Benchmark our key metrics against NDIS/Aged Care industry peers. Where are we above and below standard?" },
      { label: "Balanced scorecard", text: "Build me a balanced scorecard across financial, customer, process, and growth dimensions. Flag anything in the red zone." },
    ]
  },
  {
    label: "Growth Strategy",
    icon: TrendingUp,
    color: "text-green-400",
    commands: [
      { label: "Generate top strategies", text: "Based on our current data, generate the top 3 growth strategies right now. Score each by impact, effort, and confidence." },
      { label: "Market gap analysis", text: "Identify the biggest unmet needs in our market. Where is demand outpacing supply and we're not capturing it?" },
      { label: "Upsell opportunities", text: "Analyze our existing client base for upsell and cross-sell opportunities. What's the expansion revenue potential?" },
      { label: "New product ideas", text: "Generate 5 new product or service ideas we could launch. Validate each with a demand signal and first test step." },
    ]
  },
  {
    label: "Scenario Planning",
    icon: FlaskConical,
    color: "text-purple-400",
    commands: [
      { label: "Model 3 scenarios", text: "Run 3 strategic scenarios for our business: conservative, growth bet, and aggressive pivot. Project 12-month revenue for each." },
      { label: "Growth trajectory", text: "Forecast our growth trajectory over 12 months under 3 paths: current course, optimistic, and breakthrough. What are the key levers?" },
      { label: "ROI analysis", text: "I want to evaluate a strategic investment. Ask me for the initiative details, then calculate risk-adjusted ROI." },
      { label: "Pivot assessment", text: "Should we pivot our current strategy? Assess the signals and give me a clear recommendation." },
    ]
  },
  {
    label: "Competitive Intel",
    icon: Crosshair,
    color: "text-red-400",
    commands: [
      { label: "Competitive positioning", text: "Map our competitive position in the market. What are our sustainable advantages? Where are we vulnerable?" },
      { label: "Blue ocean opportunities", text: "Find uncontested market spaces using blue ocean strategy. What can we eliminate, reduce, raise, and create?" },
      { label: "Disruption risks", text: "Assess the top disruption risks to our business in the next 3 years. What should we be defending against?" },
      { label: "War gaming", text: "Let's war game a strategic move. Tell me what we're planning and I'll simulate how competitors will respond." },
    ]
  },
  {
    label: "OKRs & Roadmap",
    icon: Map,
    color: "text-blue-400",
    commands: [
      { label: "Design OKRs", text: "Design our OKRs for next quarter. Build company-level and department-level objectives with measurable key results." },
      { label: "Strategic roadmap", text: "Build a 4-quarter strategic roadmap with initiatives, milestones, dependencies, and expected outcomes per quarter." },
      { label: "Investment priorities", text: "Help me prioritize where to invest our budget across competing initiatives. What gives the best risk-adjusted return?" },
      { label: "3-year strategic plan", text: "Create a 3-year strategic plan with year-by-year revenue targets, priorities, milestones, and key assumptions." },
    ]
  },
  {
    label: "Customer Economics",
    icon: Users,
    color: "text-cyan-400",
    commands: [
      { label: "LTV/CAC analysis", text: "Analyze our LTV to CAC ratio by segment. What's our payback period and how do we improve the unit economics?" },
      { label: "Churn risk analysis", text: "Assess our churn risk. Who is most likely to leave and what do we do about it?" },
      { label: "Weekly strategic brief", text: "Give me my weekly strategic brief: what moved, the one metric to watch, top 3 actions, one risk, one opportunity." },
    ]
  },
];

function StrategyCard({ strategy, onSelect, selected }) {
  const cfg = STATUS_CONFIG[strategy.status] || STATUS_CONFIG.proposed;
  const priority = strategy.priority_score ? Math.round(strategy.priority_score * 10) / 10 : null;
  return (
    <button
      onClick={() => onSelect(strategy)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-slate-200 leading-snug">{strategy.name}</p>
        {priority && <span className="text-[10px] font-bold text-amber-400 flex-shrink-0">★ {priority}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
        {strategy.timeframe && <span className="text-[10px] text-slate-600">{strategy.timeframe?.replace("_", " ")}</span>}
        {strategy.impact && <span className="text-[10px] text-slate-600">Impact: {strategy.impact}/10</span>}
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Brain className="w-3.5 h-3.5 text-amber-400" />
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

export default function SageAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);

  const { data: strategies = [], refetch } = useQuery({
    queryKey: ["growth_strategies"],
    queryFn: () => base44.entities.GrowthStrategy.list("-priority_score", 20),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["financial_snapshots_recent"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 3),
  });

  const latest = snapshots[0];
  const active = strategies.filter(s => s.status === "in_progress").length;
  const proposed = strategies.filter(s => s.status === "proposed").length;
  const completed = strategies.filter(s => s.status === "completed").length;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "sage_agent",
      metadata: { name: "Sage Strategy Session" },
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

  const handleStrategySelect = (strategy) => {
    setSelectedStrategy(strategy);
    sendMessage(`Deep dive into this strategy: "${strategy.name}". Status: ${strategy.status}. ${strategy.description ? `Description: ${strategy.description}.` : ""} Give me a full strategic analysis: is this still the right bet, refined execution steps, key risks, and what I should do this week to move it forward.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Sage</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] text-amber-400">Chief Strategy Officer</span>
              </div>
            </div>
          </div>

          {/* Financial Snapshot */}
          {latest ? (
            <div className="space-y-1.5">
              {[
                { label: "Revenue", value: `$${(latest.revenue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-green-400" },
                { label: "Profit",  value: `$${(latest.profit || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,  color: latest.profit >= 0 ? "text-green-400" : "text-red-400" },
                { label: "Cash",    value: `$${(latest.cash_balance || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-blue-400" },
                { label: "Health",  value: latest.health_score ? `${latest.health_score}/100` : "—", color: "text-amber-400" },
              ].map(kpi => (
                <div key={kpi.label} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                  <span className="text-[10px] text-slate-500">{kpi.label}</span>
                  <span className={`text-xs font-semibold ${kpi.color}`}>{kpi.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => sendMessage("Run a full business health check and summarize the financial snapshot.")}
              className="w-full text-xs text-slate-600 bg-white/[0.02] border border-dashed border-white/[0.06] rounded-lg py-2.5 hover:text-slate-400 hover:border-amber-500/20 transition-all"
            >
              No snapshot yet — run health check →
            </button>
          )}
        </div>

        {/* Strategy Pipeline Stats */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strategy Pipeline</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Active", value: active, color: "text-purple-400" },
              { label: "Proposed", value: proposed, color: "text-blue-400" },
              { label: "Done", value: completed, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strategies List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active Strategies</p>
            <Lightbulb className="w-3 h-3 text-slate-700" />
          </div>
          {strategies.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No strategies yet</p>
              <button
                onClick={() => sendMessage("Analyze my business data and generate the top 3 growth strategies right now. Score each by impact, effort, and confidence.")}
                className="mt-2 text-[10px] text-amber-400 hover:underline"
              >
                Ask Sage to generate →
              </button>
            </div>
          ) : (
            strategies.map(s => (
              <StrategyCard
                key={s.id}
                strategy={s}
                selected={selectedStrategy?.id === s.id}
                onSelect={handleStrategySelect}
              />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => sendMessage("Generate 3 new growth strategies based on our latest business data. Score each and save them.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-amber-500/30 transition-all"
          >
            <Plus className="w-3 h-3" /> Generate Strategies
          </button>
        </div>
      </div>

      {/* Connected Agents Sidebar */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-r border-white/[0.06] order-last border-l border-r-0 flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Market data for strategy", text: "Compass, give me the latest competitive and market intelligence to inform a strategic update from Sage." },
            { label: "Disruption threats", text: "What emerging threats should Sage be factoring into the strategic plan right now?" },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Financial context for strategy", text: "Pull the latest financial health data — cash runway, margins, and growth trajectory — so Sage can incorporate it into strategic recommendations." },
            { label: "ROI of current strategies", text: "Calculate the actual ROI of our current active strategies. Is the investment paying off?" },
          ]} />
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Campaign for strategy", text: "Sage has identified a growth opportunity. Build a campaign to capitalize on it." },
            { label: "Marketing mix alignment", text: "Review our marketing mix against Sage's strategic priorities. Are we spending in the right places?" },
          ]} />
        <AgentPanel agentName="canvas_agent" agentLabel="Canvas" agentEmoji="🎨" accentColor="purple"
          quickCommands={[
            { label: "Board deck visuals", text: "Sage has generated a board presentation. Build the visual deck from the strategic narrative." },
            { label: "Strategy one-pager", text: "Create a visual one-pager summarizing the current strategic direction for the team." },
          ]} />
      </div>

      {/* Connected Agents Sidebar */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-l border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Market data for strategy", text: "Compass, give me the latest competitive and market intelligence to inform a strategic update from Sage." },
            { label: "Disruption threats", text: "What emerging threats should Sage be factoring into the strategic plan right now?" },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Financial context for strategy", text: "Pull the latest financial health data — cash runway, margins, and growth trajectory — so Sage can incorporate it into strategic recommendations." },
            { label: "ROI of current strategies", text: "Calculate the actual ROI of our current active strategies. Is the investment paying off?" },
          ]} />
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Campaign for strategy", text: "Sage has identified a growth opportunity. Build a campaign to capitalize on it." },
            { label: "Marketing mix alignment", text: "Review our marketing mix against Sage's strategic priorities. Are we spending in the right places?" },
          ]} />
        <AgentPanel agentName="canvas_agent" agentLabel="Canvas" agentEmoji="🎨" accentColor="purple"
          quickCommands={[
            { label: "Board deck visuals", text: "Sage has generated a board presentation. Build the visual deck from the strategic narrative." },
            { label: "Strategy one-pager", text: "Create a visual one-pager summarizing the current strategic direction for the team." },
          ]} />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Sage — Chief Strategy Officer</h1>
            <p className="text-xs text-slate-500">Business health · Growth strategy · Scenario planning · Competitive intelligence · OKRs</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups — shown when no messages */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Sage's capabilities — click any command to start</p>
            <div className="space-y-2">
              {CAPABILITY_GROUPS.map(group => {
                const Icon = group.icon;
                const isExpanded = expandedGroup === group.label;
                return (
                  <div key={group.label} className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-all"
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${group.color}`} />
                      <span className="text-xs font-medium text-slate-300 flex-1">{group.label}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] p-2 space-y-1">
                        {group.commands.map(cmd => (
                          <button
                            key={cmd.label}
                            onClick={() => sendMessage(cmd.text)}
                            className={`w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-amber-500/20 hover:bg-amber-500/5 transition-all flex items-center gap-2`}
                          >
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
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Sage is ready to strategize</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {strategies.length > 0
                  ? `${strategies.length} strategies in the pipeline. Click one for a deep dive, or expand a capability above to start.`
                  : "Start with a health check, generate growth strategies, run a scenario, or explore competitive positioning. Pick a capability above or type below."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-xs text-slate-400">Thinking strategically...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Health check · Growth strategies · Scenario modeling · OKRs · Competitive positioning · Investor pitch · War gaming..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 flex-shrink-0"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click a strategy on the left · Expand capabilities above</p>
        </div>
      </div>
    </div>
  );
}