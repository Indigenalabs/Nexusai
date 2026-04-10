import { isPast, parseISO, isToday } from "date-fns";
import { AlertTriangle } from "lucide-react";

export default function AtlasOpsStats({ tasks, vendors, workflows, onSend }) {
  const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
  const overdueTasks = activeTasks.filter(t => t.due_date && isPast(parseISO(t.due_date + "T23:59:59")));
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const completedToday = tasks.filter(t => t.completed_at && isToday(new Date(t.completed_at)));
  const unassigned = activeTasks.filter(t => !t.assignee && !t.assigned_to);
  const renewingSoon = vendors.filter(v => {
    if (!v.contract_end) return false;
    const days = (new Date(v.contract_end) - new Date()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  });

  const stats = [
    { label: "Active", value: activeTasks.length, color: "text-orange-400", onClick: null },
    { label: "Overdue", value: overdueTasks.length, color: overdueTasks.length > 0 ? "text-red-400" : "text-slate-600", onClick: () => onSend("Show me all overdue tasks ranked by how overdue they are, with recommended actions for each.") },
    { label: "Blocked", value: blockedTasks.length, color: blockedTasks.length > 0 ? "text-yellow-400" : "text-slate-600", onClick: () => onSend("Show me all blocked tasks and help me resolve each blocker.") },
    { label: "Done today", value: completedToday.length, color: "text-green-400", onClick: null },
    { label: "Unassigned", value: unassigned.length, color: unassigned.length > 0 ? "text-purple-400" : "text-slate-600", onClick: () => onSend("Intelligently assign all unassigned tasks to the best-suited team members.") },
    { label: "Workflows", value: workflows.filter(w => w.status === "active").length, color: "text-blue-400", onClick: null },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {stats.map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            disabled={!s.onClick}
            className={`bg-white/[0.03] rounded-lg px-2 py-1.5 text-center transition-all ${s.onClick ? "hover:bg-orange-500/10 hover:border-orange-500/20 border border-transparent cursor-pointer" : "cursor-default"}`}
          >
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-600">{s.label}</p>
          </button>
        ))}
      </div>

      {renewingSoon.length > 0 && (
        <button
          onClick={() => onSend("Review all vendor renewals approaching in the next 30 days. What should I renew, renegotiate, or cancel?")}
          className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/15 transition-all"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-400">{renewingSoon.length} vendor renewal{renewingSoon.length > 1 ? "s" : ""} approaching</span>
        </button>
      )}
    </div>
  );
}