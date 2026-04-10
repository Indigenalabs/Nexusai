import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, GitBranch } from "lucide-react";

const STATUS_COLOR = {
  active: "text-green-400 bg-green-500/10 border-green-500/20",
  draft: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  paused: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  archived: "text-slate-600 bg-slate-500/5 border-slate-500/10",
};

export default function AtlasWorkflowPanel({ onSend }) {
  const { data: workflows = [] } = useQuery({
    queryKey: ["atlas_workflows"],
    queryFn: () => base44.entities.Workflow.list("-created_date", 30),
  });

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {workflows.length === 0 ? (
        <div className="text-center py-10">
          <GitBranch className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-600 mb-1">No workflows yet</p>
          <button
            onClick={() => onSend("Design a workflow for me. Ask me what process I want to automate.")}
            className="text-[10px] text-orange-400 hover:underline"
          >
            Create your first workflow →
          </button>
        </div>
      ) : (
        workflows.map(w => (
          <button
            key={w.id}
            onClick={() => onSend(`Give me a full breakdown of the "${w.name}" workflow — its steps, current status, and any optimization opportunities.`)}
            className="w-full text-left p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-orange-500/20 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">{w.name}</p>
                {w.trigger && <p className="text-[9px] text-slate-600 mt-0.5 truncate">Trigger: {w.trigger}</p>}
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${STATUS_COLOR[w.status] || STATUS_COLOR.draft}`}>
                {w.status || 'draft'}
              </span>
            </div>
            {w.industry && <p className="text-[9px] text-slate-700 mt-1">{w.industry}</p>}
          </button>
        ))
      )}
      <button
        onClick={() => onSend("I want to create a new workflow. Ask me what process I want to automate and what industry or department it's for.")}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.06] text-xs text-slate-600 hover:text-orange-400 hover:border-orange-500/30 transition-all"
      >
        <Plus className="w-3 h-3" /> New Workflow
      </button>
    </div>
  );
}