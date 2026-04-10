import { Zap } from "lucide-react";

export const QUICK_COMMANDS = [
  { label: "Ops summary",         text: "Give me a full operations summary — task counts by status, what's overdue, blocked items, and top 3 things I need to action today." },
  { label: "Prioritize tasks",    text: "Prioritize all active tasks by business impact and urgency. Show me what I should focus on right now." },
  { label: "Workload check",      text: "Review the current team workload. Who's overloaded? Who has spare capacity? Any redistribution needed?" },
  { label: "Process mining",      text: "Mine our operational patterns and find bottlenecks, anti-patterns, and automation opportunities I'm missing." },
  { label: "Vendor audit",        text: "Review all vendors — renewals approaching, high-cost items, and any consolidation or cancellation opportunities." },
  { label: "Subscription audit",  text: "Audit all software subscriptions. Find redundant tools, unused licenses, and calculate total potential savings." },
  { label: "Capacity forecast",   text: "Forecast team capacity for the next 4 weeks. Identify crunch periods and pre-assign resources proactively." },
  { label: "Skill inventory",     text: "Map the team's skill inventory. Find gaps, single points of failure, and cross-training opportunities." },
  { label: "Workflow optimise",   text: "Review all existing workflows and suggest where steps can be eliminated, automated, or run in parallel." },
  { label: "Weekly briefing",     text: "Write a weekly operational status briefing for the leadership team — what's green, amber, red, and what decisions are needed." },
];

export default function AtlasQuickActions({ onSend, hasMessages }) {
  if (hasMessages) return null;
  return (
    <div className="px-6 py-4 border-b border-white/[0.06]">
      <p className="text-xs text-slate-500 mb-3">Quick commands</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd.label}
            onClick={() => onSend(cmd.text)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:border-orange-500/30 hover:bg-orange-500/10 transition-all flex items-center gap-1.5"
          >
            <Zap className="w-3 h-3 text-orange-400" />
            {cmd.label}
          </button>
        ))}
      </div>
    </div>
  );
}