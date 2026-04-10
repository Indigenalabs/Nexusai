import { AlertCircle, CheckCircle2, Clock3, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AGENT_CONNECTOR_MAP = {
  nexus: ["crm", "email", "docs", "finance", "calendar", "security", "support", "ads", "social", "ecommerce"],
  canvas: ["docs", "social", "ads"],
  maestro: ["social", "ads", "email"],
  prospect: ["crm", "email"],
  "support-sage": ["support", "email", "docs"],
  centsible: ["finance"],
  sage: ["docs"],
  chronos: ["calendar"],
  atlas: ["docs", "calendar"],
  scribe: ["docs"],
  sentinel: ["security"],
  compass: ["docs"],
  part: ["crm", "email"],
  pulse: ["docs"],
  merchant: ["ecommerce"],
  inspect: ["docs"],
  veritas: ["docs"],
};

function statusBadge(ready) {
  return ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

export default function AgentExecutionReadinessPanel({ agent, connectors = [], queueJobs = [], runtime }) {
  const keys = AGENT_CONNECTOR_MAP[agent?.id] || [];
  const rows = keys.map((key) => connectors.find((connector) => connector.key === key)).filter(Boolean);
  const readyCount = rows.filter((row) => row.ready).length;
  const pendingCount = rows.length - readyCount;
  const activeJobs = queueJobs.filter((job) => ["pending", "leased", "running"].includes(String(job.status || "").toLowerCase()));
  const blockedJobs = queueJobs.filter((job) => String(job.status || "").toLowerCase() === "blocked");

  return (
    <div className="app-soft p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Execution Readiness</h3>
          <p className="text-xs text-slate-600">Connector readiness and live queue state for {agent.name}.</p>
        </div>
        <Badge className={pendingCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
          {pendingCount === 0 ? "live ready" : `${pendingCount} connector${pendingCount === 1 ? "" : "s"} pending`}
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[11px] text-slate-500">Ready connectors</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{readyCount}/{rows.length || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[11px] text-slate-500">Active queue jobs</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{activeJobs.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[11px] text-slate-500">Blocked jobs</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{blockedJobs.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Connector status</p>
          {rows.length === 0 && <p className="text-xs text-slate-500">No dedicated connectors mapped for this agent yet.</p>}
          {rows.map((row) => (
            <div key={`connector-status-${row.key}`} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {row.ready ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  <p className="text-sm font-medium text-slate-900">{row.label}</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{row.connector?.provider || "not configured"} · {row.domain}</p>
              </div>
              <Badge className={statusBadge(row.ready)}>{row.ready ? "ready" : "needs config"}</Badge>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Autonomy runtime</p>
            <Badge className={runtime?.running ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
              {runtime?.running ? "running" : "stopped"}
            </Badge>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Clock3 className="w-3.5 h-3.5" />
              <span>Last worker tick: {runtime?.last_worker_tick_at ? new Date(runtime.last_worker_tick_at).toLocaleString() : "n/a"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Link2 className="w-3.5 h-3.5" />
              <span>Worker: {runtime?.worker_id || "n/a"}</span>
            </div>
          </div>
          <div className="space-y-2 max-h-56 overflow-auto">
            {queueJobs.length === 0 && <p className="text-xs text-slate-500">No queue activity for this agent yet.</p>}
            {queueJobs.slice(0, 8).map((job) => (
              <div key={`queue-job-${job.id}`} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{job.action || "job"}</p>
                  <Badge className={String(job.status || "").toLowerCase() === "completed" ? "bg-emerald-100 text-emerald-700" : String(job.status || "").toLowerCase() === "blocked" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}>
                    {job.status || "pending"}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{job.source || "queue"} · attempt {job.attempt_count || 0}/{job.max_attempts || 1}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
