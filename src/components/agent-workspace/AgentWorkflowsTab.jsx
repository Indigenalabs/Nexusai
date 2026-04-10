import { Download, Loader2, Play, RefreshCw, Search, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AgentWorkflowsTab({
  agent,
  theme,
  dashboardCopy,
  quickWorkflowName,
  setQuickWorkflowName,
  quickWorkflowTrigger,
  setQuickWorkflowTrigger,
  createQuickWorkflow,
  createNeedsWorkpack,
  needsSummary,
  visibleTemplates,
  importTemplate,
  effectiveWorkflows,
  setWorkflowStatus,
  workflowRuns,
  autonomyQueueJobs = [],
  autonomySchedules = [],
  queueActionMutation,
  saveScheduleMutation,
  tickAutonomyRuntimeMutation,
  scheduleDraft,
  setScheduleDraft,
}) {
  return (
    <div className="pt-6 space-y-4">
      <div className={`rounded-xl border ${theme.border} ${theme.soft} p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">{agent.name} Workflow Builder</h3>
        <p className="text-xs text-slate-600 mb-3">Build execution flows that match this agent&apos;s operating style.</p>
        <div className="grid md:grid-cols-4 gap-2">
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:col-span-2" placeholder={`${agent.name} workflow name`} value={quickWorkflowName} onChange={(e) => setQuickWorkflowName(e.target.value)} />
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs" value={quickWorkflowTrigger} onChange={(e) => setQuickWorkflowTrigger(e.target.value)}><option value="manual">manual</option><option value="scheduled">scheduled</option><option value="event">event</option></select>
          <Button className={`rounded-lg ${theme.button} text-white`} disabled={createQuickWorkflow.isPending} onClick={() => createQuickWorkflow.mutate()}>{createQuickWorkflow.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}Create</Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">Generate a workflow pack from all open implementation needs for {agent.name}.</p>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={createNeedsWorkpack.isPending || needsSummary.open === 0} onClick={() => createNeedsWorkpack.mutate()}>{createNeedsWorkpack.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Download className="w-3 h-3 mr-2" />}Build Need Workpack</Button>
        </div>
      </div>

      {visibleTemplates.length > 0 && (
        <div className="app-soft p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Workflow Packs</h3>
          <div className="grid md:grid-cols-2 gap-2">
            {visibleTemplates.map((t) => (
              <div key={`wf-${t.id}`} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.business_type} · {t.category}</p>
                  </div>
                  <Badge className={t.risk === "high" ? "bg-red-100 text-red-700" : t.risk === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>{t.risk}</Badge>
                </div>
                {t.from_playbook && <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge className="bg-violet-50 text-violet-700 border border-violet-200">from playbook</Badge>{t.source_playbook_title && <span className="text-[11px] text-violet-700">{t.source_playbook_title}</span>}</div>}
                <p className="text-xs text-slate-600 mt-1">{t.description}</p>
                {Array.isArray(t.steps) && t.steps.length > 0 && <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><p className="text-[11px] font-medium text-slate-700">Pack steps</p><div className="mt-1 space-y-1">{t.steps.slice(0, 4).map((step, idx) => <p key={`${t.id}-step-${idx}`} className="text-[11px] text-slate-600">{idx + 1}. {step}</p>)}</div></div>}
                <Button size="sm" className="mt-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white" onClick={() => importTemplate.mutate(t)} disabled={importTemplate.isPending}>{importTemplate.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Download className="w-3 h-3 mr-2" />}Use Pack</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="app-soft p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">{dashboardCopy.queue}</h3>
        <div className="space-y-2">
          {effectiveWorkflows.slice(0, 8).map((w) => (
            <div key={`wfq-${w.id}`} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-slate-900">{w.name}</p>
                <p className="text-xs text-slate-500">{w.trigger} · {w.autonomy || "n/a"}</p>
                {w.source_playbook_title && <p className="text-[11px] text-violet-700 mt-1">From playbook: {w.source_playbook_title}</p>}
              </div>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setWorkflowStatus.mutate({ id: w.id, status: w.status === "active" ? "paused" : "active" })}>{w.status === "active" ? "Pause" : "Activate"}</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="app-soft p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Workflow Run Log</h3>
        <div className="space-y-2 max-h-48 overflow-auto">
          {workflowRuns.length === 0 && <p className="text-xs text-slate-500">No workflow runs logged yet.</p>}
          {workflowRuns.slice(0, 20).map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-900">{r.type || "workflow"}</p>
                <Badge className={r.status === "failed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{r.status || "success"}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{new Date(r.at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="app-soft p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Autonomy Queue</h3>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => tickAutonomyRuntimeMutation.mutate()} disabled={tickAutonomyRuntimeMutation.isPending}>
            {tickAutonomyRuntimeMutation.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <TimerReset className="w-3 h-3 mr-2" />}Tick Runtime
          </Button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {autonomyQueueJobs.length === 0 && <p className="text-xs text-slate-500">No queue jobs for this agent yet.</p>}
          {autonomyQueueJobs.slice(0, 20).map((job) => (
            <div key={job.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-900">{job.action || "job"}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{job.source || "queue"} · attempt {job.attempt_count || 0}/{job.max_attempts || 1}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={job.status === "failed" ? "bg-red-100 text-red-700" : job.status === "blocked" ? "bg-amber-100 text-amber-700" : job.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{job.status || "pending"}</Badge>
                  {(job.status === "blocked" || job.status === "failed") && (
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => queueActionMutation.mutate({ type: "retry", jobId: job.id })} disabled={queueActionMutation.isPending}>
                      {queueActionMutation.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-2" />}Retry
                    </Button>
                  )}
                </div>
              </div>
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <summary className="text-[11px] font-medium text-slate-700 cursor-pointer flex items-center gap-2"><Search className="w-3 h-3" />Inspect payload and result</summary>
                <div className="grid lg:grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-[11px] font-medium text-slate-600 mb-1">Payload</p>
                    <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words overflow-auto max-h-40 bg-white border border-slate-200 rounded p-2">{JSON.stringify(job.params || {}, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-600 mb-1">Result</p>
                    <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words overflow-auto max-h-40 bg-white border border-slate-200 rounded p-2">{JSON.stringify(job.result || { last_error: job.last_error || null }, null, 2)}</pre>
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>

      <div className="app-soft p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Autonomy Schedules</h3>
          <Badge className="bg-slate-100 text-slate-700">{autonomySchedules.length} schedule{autonomySchedules.length === 1 ? "" : "s"}</Badge>
        </div>
        <div className="grid md:grid-cols-6 gap-2">
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs md:col-span-2" placeholder="Schedule name" value={scheduleDraft.name} onChange={(e) => setScheduleDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Action" value={scheduleDraft.action} onChange={(e) => setScheduleDraft((prev) => ({ ...prev, action: e.target.value }))} />
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder="Cadence minutes" value={scheduleDraft.cadenceMinutes} onChange={(e) => setScheduleDraft((prev) => ({ ...prev, cadenceMinutes: e.target.value }))} />
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" value={scheduleDraft.enabled ? "true" : "false"} onChange={(e) => setScheduleDraft((prev) => ({ ...prev, enabled: e.target.value === "true" }))}>
            <option value="true">enabled</option>
            <option value="false">paused</option>
          </select>
          <Button size="sm" className={`rounded-lg ${theme.button} text-white`} onClick={() => saveScheduleMutation.mutate()} disabled={saveScheduleMutation.isPending}>
            {saveScheduleMutation.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}Save
          </Button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {autonomySchedules.length === 0 && <p className="text-xs text-slate-500">No schedules configured for this agent yet.</p>}
          {autonomySchedules.slice(0, 20).map((schedule) => (
            <div key={schedule.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{schedule.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{schedule.action} · every {Math.max(1, Math.round((Number(schedule.cadence_ms || 0) / 60000) || 1))} min · next {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : "n/a"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={schedule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{schedule.enabled ? "enabled" : "paused"}</Badge>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setScheduleDraft({ id: schedule.id, name: schedule.name || "", action: schedule.action || "", cadenceMinutes: String(Math.max(1, Math.round((Number(schedule.cadence_ms || 0) / 60000) || 1))), enabled: schedule.enabled !== false })}>Edit</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
