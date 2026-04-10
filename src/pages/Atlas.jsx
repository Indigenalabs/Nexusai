import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Layers, CheckCircle2, Circle,
  AlertTriangle, Clock, Building2, XCircle, GitBranch, RefreshCw
} from "lucide-react";
import { format, isPast, parseISO, differenceInDays } from "date-fns";
import AtlasOpsStats from "@/components/atlas/AtlasOpsStats";
import AtlasWorkflowPanel from "@/components/atlas/AtlasWorkflowPanel";
import AtlasQuickActions from "@/components/atlas/AtlasQuickActions";
import AgentPanel from "@/components/agents/AgentPanel";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "text-slate-400",  bg: "bg-slate-500/15 border-slate-500/20",  icon: Circle },
  in_progress: { label: "In Progress", color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/20",   icon: Clock },
  blocked:     { label: "Blocked",     color: "text-red-400",    bg: "bg-red-500/15 border-red-500/20",     icon: XCircle },
  completed:   { label: "Done",        color: "text-green-400",  bg: "bg-green-500/15 border-green-500/20", icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: "text-slate-600",  bg: "bg-slate-500/10 border-slate-500/10", icon: XCircle },
};

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-400",    dot: "bg-red-400" },
  high:     { label: "High",     color: "text-orange-400", dot: "bg-orange-400" },
  medium:   { label: "Medium",   color: "text-amber-400",  dot: "bg-amber-400" },
  low:      { label: "Low",      color: "text-slate-500",  dot: "bg-slate-500" },
};

function TaskRow({ task, onSelect, selected }) {
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = status.icon;

  const isOverdue = task.due_date && isPast(parseISO(task.due_date + "T23:59:59")) && task.status !== "completed" && task.status !== "cancelled";
  const daysOverdue = isOverdue ? differenceInDays(new Date(), parseISO(task.due_date)) : 0;

  return (
    <button
      onClick={() => onSelect(task)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected
          ? "bg-orange-500/10 border-orange-500/30"
          : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${status.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${task.status === "completed" ? "line-through text-slate-600" : "text-slate-200"}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />
            {(task.assignee || task.assigned_to) && <span className="text-[9px] text-slate-600">{task.assignee || task.assigned_to}</span>}
            {task.due_date && (
              <span className={`text-[9px] ${isOverdue ? "text-red-400 font-semibold" : "text-slate-600"}`}>
                {isOverdue ? `${daysOverdue}d overdue` : `Due ${format(parseISO(task.due_date), "MMM d")}`}
              </span>
            )}
            {task.project && <span className="text-[9px] text-slate-700 bg-white/[0.03] px-1 rounded">{task.project}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function VendorRow({ vendor, onSend }) {
  const daysLeft = vendor.contract_end
    ? differenceInDays(parseISO(vendor.contract_end), new Date())
    : null;

  return (
    <button
      onClick={() => onSend(`Review vendor "${vendor.name}". Analyse value, renewal options, and whether I should renew, renegotiate, or cancel.`)}
      className="w-full text-left p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-orange-500/10 hover:border-orange-500/20 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{vendor.name}</p>
          <p className="text-[9px] text-slate-600 mt-0.5">{vendor.category}</p>
        </div>
        {vendor.monthly_cost && (
          <span className="text-[10px] font-semibold text-orange-400 flex-shrink-0">${vendor.monthly_cost}/mo</span>
        )}
      </div>
      {daysLeft !== null && daysLeft <= 30 && (
        <div className={`mt-1.5 text-[9px] flex items-center gap-1 ${daysLeft <= 7 ? "text-red-400" : "text-amber-400"}`}>
          <AlertTriangle className="w-2.5 h-2.5" />
          {daysLeft <= 0 ? "Expired" : `Renews in ${daysLeft}d`}{!vendor.auto_renew ? " · Action needed" : ""}
        </div>
      )}
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Layers className="w-3.5 h-3.5 text-orange-400" />
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

export default function Atlas() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [statusFilter, setStatusFilter] = useState("active");
  const messagesEndRef = useRef(null);

  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["atlas_tasks"],
    queryFn: () => base44.entities.Task.list("-created_date", 100),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["atlas_vendors"],
    queryFn: () => base44.entities.Vendor.list("-created_date", 50),
  });

  const { data: workflows = [], refetch: refetchWorkflows } = useQuery({
    queryKey: ["atlas_workflows"],
    queryFn: () => base44.entities.Workflow.list("-created_date", 30),
  });

  const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
  const overdueTasks = activeTasks.filter(t => t.due_date && isPast(parseISO(t.due_date + "T23:59:59")));
  const blockedTasks = tasks.filter(t => t.status === "blocked");

  const displayedTasks = tasks.filter(t => {
    if (statusFilter === "active") return t.status !== "completed" && t.status !== "cancelled";
    if (statusFilter === "overdue") return overdueTasks.includes(t);
    if (statusFilter === "completed") return t.status === "completed";
    if (statusFilter === "blocked") return t.status === "blocked";
    if (statusFilter === "unassigned") return !t.assignee && !t.assigned_to && t.status !== "completed";
    return true;
  });

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "atlas_agent",
      metadata: { name: "Atlas Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetchTasks();
      refetchWorkflows();
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleTaskSelect = (task) => {
    setSelectedTask(task);
    sendMessage(`Give me a full status update on this task: "${task.title}". Status: ${task.status}. ${task.assignee ? `Assigned to: ${task.assignee}.` : "Unassigned."} ${task.due_date ? `Due: ${task.due_date}.` : ""} ${task.description ? `Description: ${task.description}` : ""} ${task.blocker_reason ? `Blocker: ${task.blocker_reason}` : ""} What should I do about it?`);
  };

  const tabs = [
    { id: "tasks", label: "Tasks", count: activeTasks.length },
    { id: "workflows", label: "Workflows", count: workflows.length },
    { id: "vendors", label: "Vendors", count: vendors.length },
  ];

  const statusFilters = [
    { id: "active", label: "Active", count: activeTasks.length },
    { id: "overdue", label: "Overdue", count: overdueTasks.length },
    { id: "blocked", label: "Blocked", count: blockedTasks.length },
    { id: "unassigned", label: "Unassigned", count: activeTasks.filter(t => !t.assignee && !t.assigned_to).length },
    { id: "completed", label: "Done", count: tasks.filter(t => t.status === "completed").length },
  ];

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Atlas</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-[10px] text-orange-400">Operations running</span>
              </div>
            </div>
          </div>

          <AtlasOpsStats
            tasks={tasks}
            vendors={vendors}
            workflows={workflows}
            onSend={sendMessage}
          />
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === t.id
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {t.label}
              {t.count > 0 && <span className="text-[9px] opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
          {activeTab === "tasks" && (
            <>
              <div className="flex gap-1 flex-wrap mb-2">
                {statusFilters.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`text-[9px] px-2 py-1 rounded-full transition-all ${
                      statusFilter === f.id
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {f.label} {f.count > 0 && `(${f.count})`}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5">
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">No tasks here</p>
                    <button onClick={() => sendMessage("I need to create some tasks. Ask me for the details one by one.")} className="mt-1 text-[10px] text-orange-400 hover:underline">
                      Create tasks with Atlas →
                    </button>
                  </div>
                ) : (
                  displayedTasks.map(t => (
                    <TaskRow key={t.id} task={t} selected={selectedTask?.id === t.id} onSelect={handleTaskSelect} />
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === "workflows" && (
            <AtlasWorkflowPanel onSend={sendMessage} />
          )}

          {activeTab === "vendors" && (
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {vendors.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No vendors tracked</p>
                  <button onClick={() => sendMessage("Help me add a vendor to track. Ask me for the details.")} className="mt-1 text-[10px] text-orange-400 hover:underline">
                    Add a vendor →
                  </button>
                </div>
              ) : (
                vendors.map(v => <VendorRow key={v.id} vendor={v} onSend={sendMessage} />)
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button
            onClick={() => sendMessage("Create a quick task for me — ask me the title, assignee, due date, and priority.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-orange-500/30 transition-all"
          >
            <Plus className="w-3 h-3" /> Quick task
          </button>
          <button
            onClick={() => sendMessage("Design a new workflow for me. Ask me what process to automate.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-orange-500/30 transition-all"
          >
            <GitBranch className="w-3 h-3" /> New workflow
          </button>
        </div>
      </div>

      {/* Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-r border-white/[0.06] flex-col gap-2 p-3 overflow-y-auto order-last border-l border-r-0">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="chronos_agent" agentLabel="Chronos" agentEmoji="⏱" accentColor="sky"
          quickCommands={[
            { label: "Schedule project milestones", text: "Atlas has a project plan ready. Schedule all milestones and key meetings in the calendar — block time for critical tasks." },
            { label: "Time block for overdue tasks", text: "I have overdue tasks from Atlas. Find time this week to work through them and block it on the calendar." },
          ]} />
        <AgentPanel agentName="pulse_agent" agentLabel="Pulse" agentEmoji="❤️" accentColor="pink"
          quickCommands={[
            { label: "Team capacity check", text: "Atlas needs to assign tasks. Check team availability, workload, and capacity before I make assignments." },
            { label: "Burnout risk vs workload", text: "Are any team members showing burnout risk while also being overloaded with tasks? Flag anyone Atlas should reassign work from." },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Project cost tracking", text: "Pull the current spend on active projects from Atlas and match against the budgets in Centsible. Are we on track?" },
            { label: "Vendor renewal budget check", text: "Atlas has vendor renewals coming up. Confirm budget availability in Centsible before we commit." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="blue"
          quickCommands={[
            { label: "Archive project docs", text: "Archive the latest project plans, workflow diagrams, and SOPs from Atlas into the knowledge base." },
            { label: "Write SOPs for key workflows", text: "Document the top 3 most critical Atlas workflows as formal SOPs in the knowledge base." },
          ]} />
      </div>

      {/* Right: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Atlas — Operations AI</h1>
            <p className="text-xs text-slate-500">Orchestrating workflows · Managing tasks · Optimising processes</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        <AtlasQuickActions onSend={sendMessage} hasMessages={messages.length > 0} />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Layers className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Atlas is standing by</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {activeTasks.length > 0
                  ? `${activeTasks.length} active tasks${overdueTasks.length > 0 ? `, ${overdueTasks.length} overdue` : ""}. Click a task for a status review, or ask Atlas for a full operations summary.`
                  : "No tasks yet. Ask Atlas to create tasks, build a workflow, audit vendors, or forecast team capacity."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                <span className="text-xs text-slate-400">Atlas is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Create tasks · Build a workflow · Audit vendors · Forecast capacity · Run process mining · Generate ops report..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 flex-shrink-0"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click any task or vendor on the left for an instant review</p>
        </div>
      </div>
    </div>
  );
}
