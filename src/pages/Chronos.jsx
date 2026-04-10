import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Loader2, Clock, Calendar, Zap,
  Video, MapPin, Users, Focus, RefreshCw,
  ChevronRight, BarChart3, AlertTriangle, Brain
} from "lucide-react";
import AgentPanel from "@/components/agents/AgentPanel";
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay, addDays } from "date-fns";

const TYPE_CONFIG = {
  meeting:     { label: "Meeting",   color: "bg-blue-500/15 text-blue-400 border-blue-500/20",   dot: "bg-blue-400" },
  focus_block: { label: "Focus",     color: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  task_block:  { label: "Task",      color: "bg-violet-500/15 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  travel:      { label: "Travel",    color: "bg-orange-500/15 text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
  personal:    { label: "Personal",  color: "bg-pink-500/15 text-pink-400 border-pink-500/20",   dot: "bg-pink-400" },
  deadline:    { label: "Deadline",  color: "bg-red-500/15 text-red-400 border-red-500/20",      dot: "bg-red-400" },
  reminder:    { label: "Reminder",  color: "bg-slate-500/15 text-slate-400 border-slate-500/20", dot: "bg-slate-400" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Schedule & Plan",
    icon: Calendar,
    color: "text-sky-400",
    commands: [
      { label: "Today's overview", text: "Give me a full overview of today's schedule. Flag any conflicts, missing breaks, or things I should prepare for." },
      { label: "This week summary", text: "Summarize my week — total meeting hours, focus time, scheduling risks, and top 3 recommendations." },
      { label: "Optimize my schedule", text: "Review my current schedule and design an ideal weekly structure for maximum productivity and focus." },
      { label: "Find meeting time", text: "I need to schedule a meeting. Ask me the details and find the best available time slot." },
    ]
  },
  {
    label: "Focus & Productivity",
    icon: Focus,
    color: "text-green-400",
    commands: [
      { label: "Block focus time", text: "Find the best windows this week for deep focused work and block them on my calendar as protected focus time." },
      { label: "Productivity analysis", text: "Analyze my productivity patterns — task completion, overdue items, and how my meeting load is affecting output." },
      { label: "Time audit", text: "Run a full time audit. How am I spending my time and where is time being wasted?" },
      { label: "Resolve conflicts", text: "Check my calendar for scheduling conflicts and recommend how to resolve them." },
    ]
  },
  {
    label: "Meeting Intelligence",
    icon: Brain,
    color: "text-purple-400",
    commands: [
      { label: "Prep a meeting brief", text: "I need a pre-meeting brief. Ask me which meeting and I'll give you the details." },
      { label: "Generate agenda", text: "Help me build a tight meeting agenda. Ask me for the meeting details." },
      { label: "Extract action items", text: "I have meeting notes to process. Paste them and I'll extract action items, decisions, and follow-ups." },
      { label: "Meeting effectiveness", text: "Score the effectiveness of my recent meetings and recommend improvements." },
    ]
  },
  {
    label: "Analytics & Insights",
    icon: BarChart3,
    color: "text-amber-400",
    commands: [
      { label: "Weekly time report", text: "Generate my weekly time management report — health score, meeting load, focus time, and next week recommendations." },
      { label: "Time value analysis", text: "Calculate the dollar cost of my meetings this week and identify which are high vs. low ROI." },
      { label: "Time forecast", text: "Forecast my time demands for the next 2 weeks. Where am I at risk of over-commitment?" },
      { label: "Timezone help", text: "Help me schedule across timezones. Ask me for the meeting details and participant locations." },
    ]
  },
  {
    label: "Cross-Team Coordination",
    icon: Users,
    color: "text-cyan-400",
    commands: [
      { label: "Interview scheduling", text: "Help me set up an interview process. Ask me for the role, candidate, and panel details." },
      { label: "Event coordination", text: "Help me coordinate a company event or webinar. Ask me for the details." },
      { label: "Project timeline sync", text: "I need to block time for project milestones. Ask me for the project details." },
    ]
  },
];

function getDayLabel(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, MMM d");
}

function EventCard({ event, onSelect, selected }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.meeting;
  const start = event.start_time ? format(parseISO(event.start_time), "h:mm a") : "";
  const end = event.end_time ? format(parseISO(event.end_time), "h:mm a") : "";
  const duration = event.start_time && event.end_time
    ? Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000) : null;

  return (
    <button
      onClick={() => onSelect(event)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected ? "bg-sky-500/10 border-sky-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 rounded-full mt-0.5 flex-shrink-0 ${cfg.dot}`} style={{ minHeight: 14, minWidth: 6 }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{event.title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{start}{end ? ` – ${end}` : ""}{duration ? ` · ${duration}m` : ""}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
            {event.conference_link && <Video className="w-2.5 h-2.5 text-slate-600" />}
            {event.location && <MapPin className="w-2.5 h-2.5 text-slate-600" />}
            {event.attendees?.length > 0 && (
              <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{event.attendees.length}
              </span>
            )}
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
        <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
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

export default function Chronos() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewDays, setViewDays] = useState(3);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);

  const now = new Date();
  const rangeEnd = addDays(now, viewDays);

  const { data: events = [], refetch } = useQuery({
    queryKey: ["calendar_events", viewDays],
    queryFn: () => base44.entities.CalendarEvent.list("start_time", 100),
  });

  const upcomingEvents = events
    .filter(e => e.start_time && new Date(e.start_time) >= startOfDay(now) && new Date(e.start_time) <= endOfDay(rangeEnd))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const grouped = upcomingEvents.reduce((acc, e) => {
    const day = e.start_time.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  const meetingMins = upcomingEvents.filter(e => e.type === "meeting").reduce((sum, e) => {
    if (!e.start_time || !e.end_time) return sum;
    return sum + (new Date(e.end_time) - new Date(e.start_time)) / 60000;
  }, 0);

  const focusBlocks = upcomingEvents.filter(e => e.type === "focus_block").length;
  const conflicts = upcomingEvents.filter((e, i) =>
    upcomingEvents[i + 1] && e.end_time && new Date(e.end_time) > new Date(upcomingEvents[i + 1]?.start_time)
  ).length;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "chronos_agent",
      metadata: { name: "Chronos Session" },
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

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    const start = event.start_time ? format(parseISO(event.start_time), "EEEE, MMMM d 'at' h:mm a") : "";
    sendMessage(`Prepare a pre-meeting brief for: "${event.title}" on ${start}. Attendees: ${event.attendees?.join(", ") || "unknown"}. ${event.description ? `Context: ${event.description}` : ""} Also tell me what to prepare and the ideal agenda if one isn't set.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Chronos</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-[10px] text-sky-400">Chief Time Officer</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { label: "Meetings", value: upcomingEvents.filter(e => e.type === "meeting").length, color: "text-blue-400" },
              { label: "Focus", value: focusBlocks, color: "text-green-400" },
              { label: "Conflicts", value: conflicts, color: conflicts > 0 ? "text-red-400" : "text-slate-600" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {meetingMins > 0 && (
            <div className="bg-white/[0.02] rounded-lg px-3 py-1.5 flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Meeting time ({viewDays}d)</span>
              <span className={`text-xs font-semibold ${meetingMins / 60 > 8 ? "text-red-400" : "text-sky-400"}`}>
                {Math.floor(meetingMins / 60)}h {Math.round(meetingMins % 60)}m
              </span>
            </div>
          )}

          {conflicts > 0 && (
            <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-400">{conflicts} scheduling conflict{conflicts > 1 ? "s" : ""}</span>
              <button onClick={() => sendMessage("Detect and resolve all my scheduling conflicts this week.")} className="ml-auto text-[10px] text-red-400 hover:underline">Fix →</button>
            </div>
          )}
        </div>

        {/* Day toggle */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1">
          {[1, 3, 7].map(d => (
            <button key={d} onClick={() => setViewDays(d)}
              className={`flex-1 text-[10px] py-1 rounded-lg transition-all ${viewDays === d ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-slate-600 hover:text-slate-400"}`}>
              {d === 1 ? "Today" : d === 3 ? "3 Days" : "Week"}
            </button>
          ))}
        </div>

        {/* Events */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-10">
              <Calendar className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No events scheduled</p>
              <button onClick={() => sendMessage("Help me plan and schedule my week with the right balance of meetings and focus time.")}
                className="mt-2 text-[10px] text-sky-400 hover:underline">Ask Chronos to plan your week →</button>
            </div>
          ) : (
            Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">{getDayLabel(day + "T00:00:00")}</p>
                <div className="space-y-1">
                  {dayEvents.map(e => (
                    <EventCard key={e.id} event={e} selected={selectedEvent?.id === e.id} onSelect={handleEventSelect} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1">
          <button onClick={() => sendMessage("Find the best focus windows this week and block them as protected deep work time.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-sky-500/30 transition-all">
            <Focus className="w-3 h-3" /> Block Focus Time
          </button>
          <button onClick={() => sendMessage("Generate my weekly time report. How am I spending my time and what should I improve?")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-sky-500/30 transition-all">
            <BarChart3 className="w-3 h-3" /> Time Report
          </button>
        </div>
      </div>

      {/* Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-l border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Block time for critical tasks", text: "Atlas has tasks that need to be done urgently. Block time in the calendar this week for the top 5 critical tasks." },
            { label: "Project timeline to calendar", text: "Convert the Atlas project timeline into calendar blocks and milestones so the team stays on track." },
          ]} />
        <AgentPanel agentName="pulse_agent" agentLabel="Pulse" agentEmoji="❤️" accentColor="pink"
          quickCommands={[
            { label: "Interview scheduling", text: "Pulse has candidates to interview. Schedule interview panels, coordinate availability, and send calendar invites." },
            { label: "1:1 and review cadence", text: "Set up a recurring 1:1 and performance review cadence for all team members based on Pulse's recommendations." },
          ]} />
        <AgentPanel agentName="prospect_agent" agentLabel="Prospect" agentEmoji="🎯" accentColor="blue"
          quickCommands={[
            { label: "Book hot lead meetings", text: "Prospect has hot leads ready for meetings. Find the best slots and book discovery calls with each one." },
            { label: "Follow-up meeting reminders", text: "Set automated reminders for all sales meetings and follow-up calls in the pipeline." },
          ]} />
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Chronos — Chief Time Officer</h1>
            <p className="text-xs text-slate-500">Scheduling · Focus protection · Meeting intelligence · Time analytics · Cross-team coordination</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Chronos capabilities — click any command to start</p>
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
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-sky-500/20 hover:bg-sky-500/5 transition-all flex items-center gap-2">
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
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Chronos is standing by</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {upcomingEvents.length > 0
                  ? `${upcomingEvents.length} events in view. Click any event for a pre-meeting brief, or expand a capability above.`
                  : "Your calendar is clear. Schedule meetings, block focus time, run a time audit, or plan your week."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                <span className="text-xs text-slate-400">Optimizing your schedule...</span>
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
              placeholder="Schedule a meeting · Block focus time · Prep a brief · Run a time audit · Resolve conflicts · Interview scheduling..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click an event for a pre-meeting brief · Expand capabilities above</p>
        </div>
      </div>
    </div>
  );
}