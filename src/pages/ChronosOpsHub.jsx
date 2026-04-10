import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { formatRuntimeOutput } from "@/lib/resultFormatter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Clock3, Loader2, PlayCircle, CalendarClock, Focus, Plane, Sparkles, ShieldAlert } from "lucide-react";

const QUICK_CAPABILITIES = [
  { id: "smart_schedule", label: "Smart Schedule" },
  { id: "time_audit", label: "Time Audit" },
  { id: "time_value_analytics", label: "Time Value" },
  { id: "meeting_cost_guard", label: "Meeting Cost Guard" },
  { id: "find_meeting_time", label: "Find Meeting Time" },
  { id: "generate_agenda", label: "Generate Agenda" },
  { id: "meeting_effectiveness", label: "Meeting Effectiveness" },
  { id: "deep_work_guardian", label: "Deep Work Guardian" },
  { id: "recurring_meeting_optimizer", label: "Recurring Optimizer" },
  { id: "global_fairness_scheduler", label: "Global Fairness" },
  { id: "travel_time_optimizer", label: "Travel Optimizer" },
  { id: "resource_booking_optimizer", label: "Resource Optimizer" },
  { id: "time_roi_dashboard", label: "Time ROI" },
  { id: "agent_load_balancer", label: "Agent Load" },
  { id: "resolve_conflict", label: "Resolve Conflicts" },
  { id: "weekly_report", label: "Weekly Report" },
  { id: "chronos_full_self_test", label: "Full Self Test" },
];

export default function ChronosOpsHub() {
  const [tab, setTab] = useState("quick");
  const [activeRun, setActiveRun] = useState("");
  const [capabilityResult, setCapabilityResult] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const [meetingPurpose, setMeetingPurpose] = useState("Leadership strategy review");
  const [meetingDuration, setMeetingDuration] = useState(45);
  const [participantsRaw, setParticipantsRaw] = useState("Adelaide|Product Lead\nLondon|Partnerships\nNew York|Growth");
  const [thesis, setThesis] = useState("Quarterly planning offsite with partner meetings");
  const [resourceRequestsRaw, setResourceRequestsRaw] = useState("Boardroom + projector + VC\nWar room + whiteboards");

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["chronos_ops_health"],
    queryFn: async () => {
      const res = await base44.functions.invoke("chronosSchedulingEngine", { action: "time_audit" });
      return res.data?.result || null;
    },
    staleTime: 60000,
  });

  const runCapability = useMutation({
    mutationFn: async (capabilityId) => {
      const res = await base44.functions.invoke("agentCapabilityOrchestrator", {
        action: "run_capability",
        params: { agent_name: "Chronos", capability_id: capabilityId },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCapabilityResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const runTool = useMutation({
    mutationFn: async ({ action, params = {} }) => {
      const res = await base44.functions.invoke("chronosSchedulingEngine", { action, params });
      return res.data;
    },
    onSuccess: (data) => {
      setToolResult(data);
      setActiveRun("");
      refetchHealth();
    },
    onError: () => setActiveRun(""),
  });

  const participants = useMemo(() => participantsRaw.split("\n").map((x) => x.trim()).filter(Boolean), [participantsRaw]);
  const resourceRequests = useMemo(() => resourceRequestsRaw.split("\n").map((x) => x.trim()).filter(Boolean), [resourceRequestsRaw]);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={createPageUrl("Chronos")} className="inline-flex items-center text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Chronos
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">Chronos Ops Hub</h1>
            <p className="text-sm text-slate-400">Autonomous scheduling, deep-work protection, meeting optimization, and time ROI intelligence.</p>
          </div>
          <Button className="bg-sky-600 hover:bg-sky-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("chronos_full_self_test"); runTool.mutate({ action: "chronos_full_self_test" }); }}>
            {activeRun === "chronos_full_self_test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Run Full Self Test
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Time Health</p><p className="text-2xl font-semibold text-white">{healthData?.time_health_score ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Meeting %</p><p className="text-2xl font-semibold text-blue-300">{healthData?.breakdown?.meeting_percent ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Focus %</p><p className="text-2xl font-semibold text-emerald-300">{healthData?.breakdown?.focus_percent ?? "--"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-400">Hours Reclaimable</p><p className="text-2xl font-semibold text-amber-300">{healthData?.hours_to_reclaim ?? "--"}</p></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.08] h-auto flex-wrap">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="meeting">Meeting Ops</TabsTrigger>
            <TabsTrigger value="focus">Deep Work</TabsTrigger>
            <TabsTrigger value="global">Global/Travel</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK_CAPABILITIES.map((cap) => (
                  <Button key={cap.id} variant="outline" className="justify-start border-white/15 text-slate-300" disabled={runCapability.isPending || runTool.isPending} onClick={() => { setActiveRun(cap.id); runCapability.mutate(cap.id); }}>
                    {activeRun === cap.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />} {cap.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="meeting" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Meeting Time + Cost Guard</p>
                <Input value={meetingPurpose} onChange={(e) => setMeetingPurpose(e.target.value)} className="bg-black/30 border-white/10" placeholder="Meeting purpose" />
                <Input type="number" value={meetingDuration} onChange={(e) => setMeetingDuration(Number(e.target.value || 0))} className="bg-black/30 border-white/10" placeholder="Duration" />
                <div className="flex gap-2 flex-wrap">
                  <Button className="bg-blue-600 hover:bg-blue-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("find_meeting_time"); runTool.mutate({ action: "find_meeting_time", params: { meeting_purpose: meetingPurpose, meeting_duration: meetingDuration } }); }}>
                    {activeRun === "find_meeting_time" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}Find Slot
                  </Button>
                  <Button className="bg-amber-600 hover:bg-amber-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("meeting_cost_guard"); runTool.mutate({ action: "meeting_cost_guard" }); }}>
                    {activeRun === "meeting_cost_guard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}Run Cost Guard
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Recurring + Agenda</p>
                <Button className="bg-violet-600 hover:bg-violet-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("recurring_meeting_optimizer"); runTool.mutate({ action: "recurring_meeting_optimizer" }); }}>
                  {activeRun === "recurring_meeting_optimizer" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock3 className="w-4 h-4 mr-2" />}Optimize Recurring Meetings
                </Button>
                <Button variant="outline" className="border-cyan-500/40 text-cyan-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("generate_agenda"); runTool.mutate({ action: "generate_agenda", params: { meeting_title: meetingPurpose, duration_minutes: meetingDuration } }); }}>
                  {activeRun === "generate_agenda" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}Generate Agenda
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="focus" className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Deep Work + ROI</p>
              <div className="flex gap-2 flex-wrap">
                <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("deep_work_guardian"); runTool.mutate({ action: "deep_work_guardian" }); }}>
                  {activeRun === "deep_work_guardian" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Focus className="w-4 h-4 mr-2" />}Run Deep Work Guardian
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("time_roi_dashboard"); runTool.mutate({ action: "time_roi_dashboard" }); }}>
                  {activeRun === "time_roi_dashboard" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Generate ROI Dashboard
                </Button>
                <Button variant="outline" className="border-rose-500/40 text-rose-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("resolve_conflict"); runTool.mutate({ action: "resolve_conflict" }); }}>
                  {activeRun === "resolve_conflict" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}Resolve Conflicts
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="global" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Global Fairness Scheduler</p>
                <Textarea value={participantsRaw} onChange={(e) => setParticipantsRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[120px]" placeholder="One timezone/location per line" />
                <Button className="bg-cyan-600 hover:bg-cyan-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("global_fairness_scheduler"); runTool.mutate({ action: "global_fairness_scheduler", params: { participants } }); }}>
                  {activeRun === "global_fairness_scheduler" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}Build Rotation Plan
                </Button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Travel + Resource Optimization</p>
                <Input value={thesis} onChange={(e) => setThesis(e.target.value)} className="bg-black/30 border-white/10" placeholder="Travel itinerary context" />
                <Textarea value={resourceRequestsRaw} onChange={(e) => setResourceRequestsRaw(e.target.value)} className="bg-black/30 border-white/10 min-h-[95px]" placeholder="Resource requests" />
                <div className="flex gap-2 flex-wrap">
                  <Button className="bg-orange-600 hover:bg-orange-500" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("travel_time_optimizer"); runTool.mutate({ action: "travel_time_optimizer", params: { itinerary: { summary: thesis } } }); }}>
                    {activeRun === "travel_time_optimizer" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plane className="w-4 h-4 mr-2" />}Travel Optimize
                  </Button>
                  <Button variant="outline" className="border-amber-500/40 text-amber-300" disabled={runTool.isPending || runCapability.isPending} onClick={() => { setActiveRun("resource_booking_optimizer"); runTool.mutate({ action: "resource_booking_optimizer", params: { requests: resourceRequests } }); }}>
                    {activeRun === "resource_booking_optimizer" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock3 className="w-4 h-4 mr-2" />}Resource Optimize
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Capability Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(capabilityResult, "No capability run yet.")}</pre>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tool Output</p>
            <pre className="text-[11px] whitespace-pre-wrap break-words max-h-96 overflow-auto text-slate-200">{formatRuntimeOutput(toolResult, "No tool run yet.")}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}


