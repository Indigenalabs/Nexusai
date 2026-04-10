import { useState, useEffect, useRef } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Compass as CompassIcon, TrendingUp, Eye, Zap, Globe, Lightbulb,
  ShieldAlert, ChevronRight, Target, Users, Radio,
  FileText
} from "lucide-react";

const THREAT_CONFIG = {
  low:      { label: "Low",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   dot: "bg-green-400" },
  medium:   { label: "Medium",   color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",   dot: "bg-amber-400" },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400" },
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       dot: "bg-red-400" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Competitor Intelligence",
    icon: Eye,
    color: "text-cyan-400",
    commands: [
      { label: "Full competitor landscape", text: "Give me a complete competitive landscape analysis — all tracked competitors, their recent moves, threat levels, weaknesses, and the opportunities they're leaving open. Search the web for the latest." },
      { label: "Predict competitor moves", text: "Using current signals and historical patterns, predict what each of my tracked competitors is likely to do next. What moves should I preempt?" },
      { label: "Generate battle card", text: "Generate a sales battle card for my main competitor. Ask me which one, then build a complete card including their weaknesses, objections they raise, and our killer responses." },
      { label: "Competitor deep-dive", text: "I want a deep-dive on a specific competitor. Ask me which one, then search the web for their latest news, pricing, product updates, hiring, customer sentiment, and funding." },
    ]
  },
  {
    label: "Market & Trend Intelligence",
    icon: TrendingUp,
    color: "text-violet-400",
    commands: [
      { label: "Market briefing (today)", text: "Give me today's market intelligence briefing — what's critical (act now), what to watch this week, the biggest opportunities, and your top 3 strategic recommendations." },
      { label: "Trend report", text: "Search for the most important trends in my sector right now. Classify each as emerging/building/peak, give me the urgency window, and tell me which to capitalize on and how." },
      { label: "Sector deep-dive", text: "Do a comprehensive sector analysis — market size, growth rate, competitive intensity, entry barriers, technology adoption, and 3-year outlook." },
      { label: "Disruption risk assessment", text: "What technologies or business models could disrupt my sector in the next 3-5 years? Who's building them and what should I do now to prepare?" },
    ]
  },
  {
    label: "Customer & Sentiment",
    icon: Users,
    color: "text-emerald-400",
    commands: [
      { label: "Sentiment analysis", text: "Analyze customer and market sentiment in my sector. What are customers saying online — praise, complaints, unmet needs? What's the sentiment trajectory?" },
      { label: "Voice of customer", text: "What are customers in my sector actually saying they want? What pain points are they expressing that competitors aren't solving? What language do they use?" },
      { label: "Review mining", text: "Mine negative reviews of my competitors to identify warm leads and acquisition intelligence. What are their customers complaining about and how can we target them?" },
      { label: "Churn correlation", text: "Analyze how external market factors correlate with customer churn. What external events are driving customers to leave and how can we predict and prevent it?" },
    ]
  },
  {
    label: "Growth & Market Gaps",
    icon: Target,
    color: "text-amber-400",
    commands: [
      { label: "Find underserved niches", text: "Identify the top 5 underserved niches in my market — high demand, low supply, low competition. Where can I dominate with focused resources in 90 days?" },
      { label: "Community opportunity map", text: "Map all the online communities where my target customers gather — Reddit, Facebook groups, LinkedIn groups, forums. Score each by ICP alignment and opportunity level." },
      { label: "Market entry analysis", text: "I'm considering entering a new segment. Ask me which segment and geography, then give me a full go/no-go analysis with market size, competition, risks, and GTM strategy." },
      { label: "White space analysis", text: "Where is the market underserved? What are the white spaces — unaddressed customer needs, geographic gaps, price point gaps — that we could move into?" },
    ]
  },
  {
    label: "Social & Digital Intelligence",
    icon: Radio,
    color: "text-pink-400",
    commands: [
      { label: "Social trend scan", text: "Scan for real-time social media trends in my sector. What's trending on LinkedIn, Reddit, and Twitter? What's the urgency window and what content angles should we take?" },
      { label: "Influencer radar", text: "Scan for relevant micro-influencers and thought leaders in my sector. Rank by relevance, engagement, and audience ICP match. Who should we be building relationships with?" },
      { label: "Competitor social audit", text: "Analyze my competitors' social media strategies. What content is working for them? What formats? What can we reverse-engineer and what gaps are they leaving?" },
      { label: "Optimal posting intelligence", text: "What are the best times and formats to post on each platform for my sector? Build me an optimal posting schedule based on audience and competitor data." },
    ]
  },
  {
    label: "Policy & Macro",
    icon: FileText,
    color: "text-slate-400",
    commands: [
      { label: "Policy & regulatory watch", text: "Monitor the regulatory and policy landscape in my sector. What's changed recently, what's coming, and how should I prepare?" },
      { label: "Macroeconomic intelligence", text: "Analyze the macroeconomic conditions affecting my sector and customers. What economic factors are helping or hurting us, and what's the 6-12 month outlook?" },
      { label: "Regulatory forecast", text: "Predict upcoming regulatory changes in my sector — their likelihood, timing, and potential impact on our operations and cost base." },
    ]
  },
];

function CompetitorCard({ competitor, onSelect, selected }) {
  const threat = THREAT_CONFIG[competitor.threat_level] || THREAT_CONFIG.medium;
  return (
    <button onClick={() => onSelect(competitor)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{competitor.name}</p>
          {competitor.domain && <p className="text-[9px] text-slate-600">{competitor.domain}</p>}
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${threat.bg} ${threat.color}`}>{threat.label}</span>
      </div>
      {competitor.recent_moves?.length > 0 && (
        <p className="text-[9px] text-slate-500 mt-1 truncate">↳ {competitor.recent_moves[0]}</p>
      )}
    </button>
  );
}

function TrendCard({ trend }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-start gap-2">
        <TrendingUp className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{trend.topic || trend.title}</p>
          {trend.description && <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-2">{trend.description}</p>}
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
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CompassIcon className="w-3.5 h-3.5 text-cyan-400" />
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

export default function Compass() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [activeTab, setActiveTab] = useState("competitors");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: competitors = [], refetch: refetchCompetitors } = useQuery({
    queryKey: ["compass_competitors"],
    queryFn: () => base44.entities.Competitor.list("-created_date", 50),
  });

  const { data: trends = [] } = useQuery({
    queryKey: ["compass_trends"],
    queryFn: () => base44.entities.Trend.list("-created_date", 20),
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["compass_insights"],
    queryFn: () => base44.entities.Insight.filter({ status: "new" }, "-created_date", 10),
  });

  const criticalCompetitors = competitors.filter(c => c.threat_level === "critical" || c.threat_level === "high");
  const activeCompetitors = competitors.filter(c => c.status === "active");

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "compass_agent",
      metadata: { name: "Compass Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetchCompetitors();
      queryClient.invalidateQueries({ queryKey: ["compass_trends"] });
      queryClient.invalidateQueries({ queryKey: ["compass_insights"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleCompetitorSelect = (comp) => {
    setSelectedCompetitor(comp);
    sendMessage(`Do a deep competitive analysis of ${comp.name}${comp.domain ? ` (${comp.domain})` : ""}. Search the web for their latest news, product launches, pricing changes, customer sentiment, hiring signals, and funding. Then tell me: current threat level, weaknesses we can exploit, their likely next move, and the specific actions I should take in response — with urgency timelines.`);
  };

  const tabs = [
    { id: "competitors", label: "Competitors", count: activeCompetitors.length },
    { id: "trends", label: "Trends", count: trends.length },
    { id: "insights", label: "Insights", count: insights.length },
  ];

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <CompassIcon className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Compass</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-cyan-400">Chief Market Intelligence Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Competitors", value: activeCompetitors.length, color: "text-cyan-400" },
              { label: "High threat", value: criticalCompetitors.length, color: criticalCompetitors.length > 0 ? "text-red-400" : "text-slate-600" },
              { label: "Trends", value: trends.length, color: "text-violet-400" },
              { label: "Insights", value: insights.length, color: insights.length > 0 ? "text-amber-400" : "text-slate-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {criticalCompetitors.length > 0 && (
            <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <ShieldAlert className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{criticalCompetitors.length} high-threat competitor{criticalCompetitors.length > 1 ? "s" : ""}</span>
              <button onClick={() => sendMessage("Give me an urgent analysis of my high-threat competitors — what have they done recently and what should I do?")}
                className="ml-auto text-[10px] text-red-400 hover:underline">Brief →</button>
            </div>
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

        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "competitors" && (
            <div className="space-y-1.5">
              {competitors.length === 0 ? (
                <div className="text-center py-10">
                  <Eye className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No competitors tracked</p>
                  <button onClick={() => sendMessage("I want to set up competitor tracking. Ask me who my main competitors are, then research each one and create profiles.")}
                    className="mt-1 text-[10px] text-cyan-400 hover:underline">Set up tracking →</button>
                </div>
              ) : (
                competitors.map(c => (
                  <CompetitorCard key={c.id} competitor={c} selected={selectedCompetitor?.id === c.id} onSelect={handleCompetitorSelect} />
                ))
              )}
            </div>
          )}

          {activeTab === "trends" && (
            <div className="space-y-1.5">
              {trends.length === 0 ? (
                <div className="text-center py-10">
                  <TrendingUp className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No trends logged</p>
                  <button onClick={() => sendMessage("Scan for the most important trends in my sector right now. Search the web and give me a full trend report with urgency windows.")}
                    className="mt-1 text-[10px] text-cyan-400 hover:underline">Get trend report →</button>
                </div>
              ) : (
                trends.map(t => <TrendCard key={t.id} trend={t} />)
              )}
            </div>
          )}

          {activeTab === "insights" && (
            <div className="space-y-1.5">
              {insights.length === 0 ? (
                <div className="text-center py-10">
                  <Lightbulb className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No insights yet</p>
                  <button onClick={() => sendMessage("What market opportunities are you seeing that I should act on right now? Search the market and give me the top 3 actionable opportunities.")}
                    className="mt-1 text-[10px] text-cyan-400 hover:underline">Find opportunities →</button>
                </div>
              ) : (
                insights.map(i => (
                  <div key={i.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] cursor-pointer hover:border-cyan-500/20 transition-all"
                    onClick={() => sendMessage(`Tell me more about this insight and what I should do: ${i.title}. ${i.description}`)}>
                    <p className="text-xs font-medium text-slate-200">{i.title}</p>
                    {i.description && <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-2">{i.description}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I want to add a new competitor to track. Ask me for their name and website, then search the web to research them and create a full competitor profile.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-cyan-500/30 transition-all">
            <Plus className="w-3 h-3" /> Track competitor
          </button>
          <button onClick={() => sendMessage("Give me today's market intelligence briefing — what's critical, what to watch, the biggest opportunities, and your top 3 actions. Search the web for the latest.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-cyan-500/30 transition-all">
            <Globe className="w-3 h-3" /> Daily briefing
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedCompetitor ? `Analyzing: ${selectedCompetitor.name}` : "Compass — Market Intelligence"}
            </h1>
            <p className="text-xs text-slate-500">
              {selectedCompetitor
                ? `${selectedCompetitor.domain || "competitor"} · ${selectedCompetitor.threat_level || "medium"} threat`
                : "Competitor intel · Trend detection · Market gaps · Sentiment · Predictive intelligence"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capabilities */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Compass capabilities — expand to explore</p>
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
                <CompassIcon className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Compass is watching the market</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {competitors.length > 0
                  ? `${competitors.length} competitors tracked${criticalCompetitors.length > 0 ? `, ${criticalCompetitors.length} high-threat` : ""}. Click a competitor for deep analysis, or expand a capability above.`
                  : "Your strategic radar is ready. Expand a capability group above or ask for a market briefing to get started."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <CompassIcon className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-400">Scanning the market...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Market briefing · Competitor deep-dive · Battle card · Trend report · Niche discovery · Review mining · Disruption risk..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click any competitor for deep analysis · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="prospect_agent" agentLabel="Prospect" agentEmoji="🎯" accentColor="blue"
          quickCommands={[
            { label: "Update ICP from market data", text: `Compass has found new market intelligence. Use it to update our ICP and identify which new prospect segments we should be targeting.` },
            { label: "Build battle cards for sales", text: "Compass has competitor intelligence ready. Build battle cards and outreach messaging that helps us win against our main competitors." },
          ]} />
        <AgentPanel agentName="sage_agent" agentLabel="Sage" agentEmoji="🧠" accentColor="violet"
          quickCommands={[
            { label: "Market data for strategy", text: "Compass has market intelligence ready. Use it to update our strategic plan — what opportunities should we prioritize and what risks should we mitigate?" },
            { label: "Scenario modeling", text: "Based on current market trends and competitor moves, model 3 scenarios for the next 12 months and recommend which strategic path to take." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="green"
          quickCommands={[
            { label: "Archive market reports", text: "Archive the latest market intelligence reports and competitor analyses from Compass into the knowledge base for future reference." },
            { label: "Past intelligence search", text: "Search our archived market intelligence for historical competitor data, trend analyses, and strategic decisions we can learn from." },
          ]} />
      </div>
    </div>
  );
}