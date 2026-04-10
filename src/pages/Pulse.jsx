import { useState, useEffect, useRef } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Heart, Users, Star, Zap,
  ShieldAlert, ChevronRight, TrendingUp,
  Award, BarChart3
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

const WELLBEING_CONFIG = {
  healthy:  { label: "Healthy",  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  watch:    { label: "Watch",    color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  at_risk:  { label: "At Risk",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  unknown:  { label: "Unknown",  color: "text-slate-500",  bg: "bg-slate-500/10 border-slate-500/10" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Team Health & Wellbeing",
    icon: Heart,
    color: "text-pink-400",
    commands: [
      { label: "Full team health overview", text: "Give me a full team health overview — who's thriving, who needs attention, any burnout risks, upcoming milestones, and NDIS compliance summary. What should I prioritize this week?" },
      { label: "Burnout risk scan", text: "Run a team-wide burnout risk scan. Review everyone's wellbeing signals, engagement, wellness check-ins, and workload patterns — give me individual risk ratings and specific interventions for each high-risk person." },
      { label: "Retention risk analysis", text: "Identify all retention risks in the team. Review tenure, engagement, recognition, growth signals — tell me who's likely to leave, why, and what specific conversation I should have." },
      { label: "Culture health assessment", text: "Assess our overall culture health. Give me a culture health score, our strengths, risk areas, and 3 specific initiatives we could implement — including quick wins for this week." },
      { label: "Team sentiment analysis", text: "Analyze team-level sentiment and dynamics. What does the data tell us about psychological safety, belonging, and whether people feel like they have a future here?" },
    ]
  },
  {
    label: "Talent & Recruitment",
    icon: Users,
    color: "text-blue-400",
    commands: [
      { label: "Generate a job description", text: "Generate a compelling, inclusive job description for a role. Ask me the role title, level, and key requirements — then write a JD that will attract the right people." },
      { label: "Interview question design", text: "Design a structured interview for a role I'm hiring for. Ask me the position and what I'm looking for — then give me a question set that will actually surface the right candidates." },
      { label: "Write an offer letter", text: "Help me write an offer letter. Ask me the candidate name, role, compensation, and start date — then draft a warm, professional offer that reflects our culture." },
      { label: "Diversity audit of hiring process", text: "Audit our hiring process for bias and diversity. Review our approach to sourcing, screening, and interviewing — flag any bias risks and recommend improvements." },
    ]
  },
  {
    label: "Performance & Development",
    icon: TrendingUp,
    color: "text-violet-400",
    commands: [
      { label: "Prep a performance review", text: "Help me prepare a performance review. Ask me who it's for and what period we're reviewing — then give me a structured agenda, self-assessment prompts, and talking points." },
      { label: "Skills gap analysis", text: "Run a skills gap analysis for the team. Review our current capabilities against where we need to be — identify critical gaps, who could fill them, and what training to prioritize." },
      { label: "Learning recommendations", text: "Create personalized learning recommendations. Ask me who it's for and their career goals — then give me a specific, actionable L&D plan with real resources." },
      { label: "Career path planning", text: "Help someone explore their career path. Ask me who it's for and what they're aiming toward — then map out realistic next steps, skills to develop, and internal opportunities." },
    ]
  },
  {
    label: "NDIS Compliance & Matching",
    icon: ShieldAlert,
    color: "text-amber-400",
    commands: [
      { label: "NDIS compliance audit", text: "Run a full NDIS workforce compliance check. Review all team members and worker profiles — flag anyone with expired or expiring clearances, overdue training, or unknown compliance status. Give me a priority action list." },
      { label: "NDIS worker onboarding checklist", text: "Generate an NDIS onboarding checklist for a new support worker. Ask me their name, state, and what supports they'll deliver — then give me the complete sequence of what must be done before they can see a participant." },
      { label: "Participant-worker matching", text: "Help me match a support worker to a participant. Ask me about the participant's needs, preferences, and support types — then rank the available workers by compatibility with rationale." },
      { label: "Clearance expiry alerts", text: "Check for any NDIS Worker Screening Clearances that are expiring or have expired. Flag anyone who is non-compliant and tell me exactly what action needs to happen and by when." },
    ]
  },
  {
    label: "Onboarding & Milestones",
    icon: Award,
    color: "text-green-400",
    commands: [
      { label: "Build an onboarding plan", text: "Create a personalized 30-60-90 day onboarding plan. Ask me the new hire's name, role, and start date — then build a complete plan including week 1 schedule, milestones, buddy guidance, and manager check-in agendas." },
      { label: "Upcoming milestones", text: "What work anniversaries, milestones, or important dates are coming up in the next 30 days? For each, draft a specific, genuine recognition message — not generic, something that will actually mean something to them." },
      { label: "Write a recognition message", text: "Help me recognize a team member. Ask me who it's for and what they did — then write a genuine, specific message that makes them feel truly seen, not just performatively appreciated." },
      { label: "Exit interview facilitation", text: "Help me conduct an exit interview. Ask me who is leaving and their role — then give me a structured question set, how to handle sensitive topics, and what knowledge to capture before they go." },
    ]
  },
  {
    label: "Compensation & Analytics",
    icon: BarChart3,
    color: "text-cyan-400",
    commands: [
      { label: "Compensation benchmarking", text: "Run a compensation benchmark for a role. Ask me the role, location, and experience level — then give me market ranges, NDIS award rate notes if applicable, and a competitiveness assessment." },
      { label: "People analytics dashboard", text: "Generate a full people analytics report. Analyze our team data — give me workforce overview, engagement and wellbeing scores, burnout summary, retention health, and top 3 people risks and opportunities for leadership." },
      { label: "Headcount planning", text: "Help me with headcount planning. Ask me our growth plans and current team state — then model what hiring we need, in what sequence, and what the people costs look like." },
      { label: "Design a pulse survey", text: "Design a team pulse survey. Ask me what I'm most trying to understand — then create 5-7 well-designed questions, the follow-up protocol, and how to communicate the results back to the team." },
    ]
  },
];

function MemberCard({ member, onSelect, selected }) {
  const cfg = WELLBEING_CONFIG[member.wellbeing_status] || WELLBEING_CONFIG.unknown;
  const tenureDays = member.start_date ? differenceInDays(new Date(), parseISO(member.start_date)) : null;
  const upcomingAnniversary = member.start_date && tenureDays ? (() => {
    const start = parseISO(member.start_date);
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    const days = differenceInDays(thisYear, today);
    return days >= 0 && days <= 30 ? days : null;
  })() : null;

  return (
    <button onClick={() => onSelect(member)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-pink-500/10 border-pink-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{member.name}</p>
          <p className="text-[9px] text-slate-600 truncate">{member.role || member.department}</p>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {upcomingAnniversary !== null && (
          <span className="text-[9px] text-violet-400 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5" /> Anniversary in {upcomingAnniversary}d
          </span>
        )}
        {member.engagement_score > 0 && (
          <span className="text-[9px] text-slate-600">{member.engagement_score}/100</span>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Heart className="w-3.5 h-3.5 text-pink-400" />
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

export default function Pulse() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeTab, setActiveTab] = useState("team");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: team = [], refetch } = useQuery({
    queryKey: ["pulse_team"],
    queryFn: () => base44.entities.TeamMember.list("-created_date", 100),
  });

  const atRisk = team.filter(m => m.wellbeing_status === "at_risk");
  const watching = team.filter(m => m.wellbeing_status === "watch");
  const healthy = team.filter(m => m.wellbeing_status === "healthy");

  const upcomingAnniversaries = team.filter(m => {
    if (!m.start_date) return false;
    const start = parseISO(m.start_date);
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    return differenceInDays(thisYear, today) >= 0 && differenceInDays(thisYear, today) <= 14;
  });

  const tabs = [
    { id: "team",       label: "All",        count: team.length },
    { id: "watch",      label: "Watch",      count: atRisk.length + watching.length },
    { id: "milestones", label: "Milestones", count: upcomingAnniversaries.length },
  ];

  const displayedMembers = activeTab === "watch" ? [...atRisk, ...watching]
    : activeTab === "milestones" ? upcomingAnniversaries
    : team;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "pulse_agent",
      metadata: { name: "Pulse Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pulse_team"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    const tenure = member.start_date ? `Started: ${member.start_date}.` : "No start date recorded.";
    sendMessage(`Full wellbeing check on ${member.name}. Role: ${member.role || "unknown"}. Department: ${member.department || "unknown"}. ${tenure} Wellbeing: ${member.wellbeing_status || "unknown"}. Engagement: ${member.engagement_score || "not set"}/100. ${member.notes ? `Notes: ${member.notes}` : ""} What's your assessment? What should I do and what should I say?`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Pulse</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                <span className="text-[10px] text-pink-400">Chief People Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Team size",  value: team.length,                  color: "text-pink-400" },
              { label: "Healthy",    value: healthy.length,               color: "text-green-400" },
              { label: "At risk",    value: atRisk.length,                color: atRisk.length > 0 ? "text-red-400" : "text-slate-600" },
              { label: "Milestones", value: upcomingAnniversaries.length, color: upcomingAnniversaries.length > 0 ? "text-violet-400" : "text-slate-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {atRisk.length > 0 && (
            <button onClick={() => sendMessage(`${atRisk.length} team member(s) flagged at risk: ${atRisk.map(m => m.name).join(', ')}. Give me individual burnout assessments and specific intervention plans for each person.`)}
              className="mt-2 w-full bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-red-500/15 transition-all">
              <ShieldAlert className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{atRisk.length} team member{atRisk.length > 1 ? "s" : ""} need attention</span>
            </button>
          )}
          {upcomingAnniversaries.length > 0 && (
            <button onClick={() => sendMessage(`${upcomingAnniversaries.length} work anniversary/milestone coming up: ${upcomingAnniversaries.map(m => m.name).join(', ')}. Draft specific, genuine recognition messages for each — make them feel truly seen.`)}
              className="mt-1.5 w-full bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-violet-500/15 transition-all">
              <Star className="w-3 h-3 text-violet-400 flex-shrink-0" />
              <span className="text-[10px] text-violet-400">{upcomingAnniversaries.length} upcoming milestone{upcomingAnniversaries.length > 1 ? "s" : ""}</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === t.id ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-slate-600 hover:text-slate-400"
              }`}>
              {t.label}{t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {displayedMembers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">
                {activeTab === "watch" ? "No one flagged right now" :
                 activeTab === "milestones" ? "No upcoming milestones" :
                 "No team members yet"}
              </p>
              {activeTab === "team" && (
                <button onClick={() => sendMessage("Help me add my team. Ask me for names, roles, and start dates.")}
                  className="mt-1 text-[10px] text-pink-400 hover:underline">Add team members →</button>
              )}
            </div>
          ) : (
            displayedMembers.map(m => (
              <MemberCard key={m.id} member={m} selected={selectedMember?.id === m.id} onSelect={handleMemberSelect} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I want to add a new team member. Ask me for their name, role, department, and start date.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-pink-500/30 transition-all">
            <Plus className="w-3 h-3" /> Add team member
          </button>
          <button onClick={() => sendMessage("Run an NDIS workforce compliance check. Review all team members and worker profiles for expired or expiring clearances, overdue mandatory training, and any critical non-compliance.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-amber-500/30 transition-all">
            <ShieldAlert className="w-3 h-3" /> NDIS compliance check
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedMember ? `Checking in: ${selectedMember.name}` : "Pulse — Chief People Officer"}
            </h1>
            <p className="text-xs text-slate-500">Wellbeing · Compliance · Recruitment · Performance · Culture · NDIS</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Pulse capabilities — expand to explore</p>
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
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-pink-500/20 hover:bg-pink-500/5 transition-all flex items-center gap-2">
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
              <div className="w-16 h-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-pink-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Pulse — the heart of your team</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {team.length > 0
                  ? `${team.length} team members tracked${atRisk.length > 0 ? ` · ${atRisk.length} need attention` : ""}${upcomingAnniversaries.length > 0 ? ` · ${upcomingAnniversaries.length} upcoming milestone${upcomingAnniversaries.length > 1 ? "s" : ""}` : ""}. Click any team member or expand a capability above.`
                  : "Happy teams build great things. Expand a capability above to get started, or click a team member for a wellbeing check."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center flex-shrink-0">
                <Heart className="w-3.5 h-3.5 text-pink-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                <span className="text-xs text-slate-400">Checking in on your team...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Team health · NDIS compliance · Recruitment · Performance reviews · Recognition · Burnout · Culture..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click a team member for a wellbeing check · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="veritas_agent" agentLabel="Veritas" agentEmoji="⚖️" accentColor="indigo"
          quickCommands={[
            { label: "Review employment contracts", text: "Veritas, review our employment contract templates for compliance with current Australian employment law. Flag any provisions that are legally risky or out of date." },
            { label: "Worker classification check", text: "Veritas, analyze our contractor vs employee classifications. Are there any misclassification risks we should address?" },
          ]} />
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Create onboarding task chain", text: "Atlas, create a task chain for a new team member onboarding. Set up all required tasks with appropriate deadlines and assign to the right owners." },
            { label: "Monitor team workloads", text: "Atlas, flag any team members with overloaded task queues or back-to-back scheduling that might be contributing to burnout risk." },
          ]} />
        <AgentPanel agentName="chronos_agent" agentLabel="Chronos" agentEmoji="🕐" accentColor="blue"
          quickCommands={[
            { label: "Schedule performance reviews", text: "Chronos, schedule performance review meetings for all team members this quarter. Coordinate with their managers and send calendar invites." },
            { label: "Block leave and recovery time", text: "Chronos, identify team members who haven't had a day off in 4+ weeks and block recovery time in their schedule." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="blue"
          quickCommands={[
            { label: "Archive performance reviews", text: "Scribe, archive the completed performance reviews and training records for this quarter. Ensure they're properly tagged and searchable." },
            { label: "Document culture decisions", text: "Scribe, document our current culture code and values for the knowledge base — include how we make hiring decisions and what good looks like." },
          ]} />
      </div>
    </div>
  );
}