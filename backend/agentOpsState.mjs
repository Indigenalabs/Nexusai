import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";

const STATE_DIR = path.resolve(process.cwd(), "backend", ".data");
const STATE_FILE = path.join(STATE_DIR, "agent-ops-state.json");

const now = () => new Date().toISOString();
const id = (prefix = "id") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_STATE = {
  nexus: { orchestrations: [] },
  maestro: { campaigns: [] },
  sage: { briefs: [] },
  atlas: { tasks: [] },
  support: { tickets: [] },
  chronos: { schedules: [] },
  pulse: { signals: [] },
  part: { partners: [] },
  centsible: { snapshots: [] },
  veritas: { contracts: [] },
  sentinel: { cases: [] },
  merchant: { catalog: [], orders: [] },
  prospect: { leads: [], sequences: [] },
  scribe: { documents: [] },
  compass: { scans: [] },
  canvas: { runs: [] },
  inspect: { checks: [] },
};

const AGENT_OPS_SCHEMA_VERSION = 5;

const store = createVersionedJsonStore({
  filePath: STATE_FILE,
  defaults: DEFAULT_STATE,
  storeName: "agent-ops-state",
  schemaVersion: AGENT_OPS_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    return {
      ...structuredClone(DEFAULT_STATE),
      ...(value || {}),
      nexus: { orchestrations: parsed?.nexus?.orchestrations || value?.nexus?.orchestrations || [] },
      maestro: { campaigns: parsed?.maestro?.campaigns || value?.maestro?.campaigns || [] },
      sage: { briefs: parsed?.sage?.briefs || value?.sage?.briefs || [] },
      atlas: { tasks: parsed?.atlas?.tasks || value?.atlas?.tasks || [] },
      support: { tickets: parsed?.support?.tickets || value?.support?.tickets || [] },
      chronos: { schedules: parsed?.chronos?.schedules || value?.chronos?.schedules || [] },
      pulse: { signals: parsed?.pulse?.signals || value?.pulse?.signals || [] },
      part: { partners: parsed?.part?.partners || value?.part?.partners || [] },
      centsible: { snapshots: parsed?.centsible?.snapshots || value?.centsible?.snapshots || [] },
      veritas: { contracts: parsed?.veritas?.contracts || value?.veritas?.contracts || [] },
      sentinel: { cases: parsed?.sentinel?.cases || value?.sentinel?.cases || [] },
      merchant: { catalog: parsed?.merchant?.catalog || value?.merchant?.catalog || [], orders: parsed?.merchant?.orders || value?.merchant?.orders || [] },
      prospect: {
        leads: parsed?.prospect?.leads || value?.prospect?.leads || [],
        sequences: parsed?.prospect?.sequences || value?.prospect?.sequences || [],
      },
      scribe: { documents: parsed?.scribe?.documents || value?.scribe?.documents || [] },
      compass: { scans: parsed?.compass?.scans || value?.compass?.scans || [] },
      canvas: { runs: parsed?.canvas?.runs || value?.canvas?.runs || [] },
      inspect: { checks: parsed?.inspect?.checks || value?.inspect?.checks || [] },
    };
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 5) {
      return {
        ...current,
        nexus: { orchestrations: Array.isArray(current?.nexus?.orchestrations) ? current.nexus.orchestrations : [] },
        maestro: { campaigns: Array.isArray(current?.maestro?.campaigns) ? current.maestro.campaigns : [] },
        sage: { briefs: Array.isArray(current?.sage?.briefs) ? current.sage.briefs : [] },
        atlas: { tasks: Array.isArray(current?.atlas?.tasks) ? current.atlas.tasks : [] },
        support: { tickets: Array.isArray(current?.support?.tickets) ? current.support.tickets : [] },
        chronos: { schedules: Array.isArray(current?.chronos?.schedules) ? current.chronos.schedules : [] },
        pulse: { signals: Array.isArray(current?.pulse?.signals) ? current.pulse.signals : [] },
        part: { partners: Array.isArray(current?.part?.partners) ? current.part.partners : [] },
        centsible: { snapshots: Array.isArray(current?.centsible?.snapshots) ? current.centsible.snapshots : [] },
        veritas: { contracts: Array.isArray(current?.veritas?.contracts) ? current.veritas.contracts : [] },
        sentinel: { cases: Array.isArray(current?.sentinel?.cases) ? current.sentinel.cases : [] },
        merchant: {
          catalog: Array.isArray(current?.merchant?.catalog) ? current.merchant.catalog : [],
          orders: Array.isArray(current?.merchant?.orders) ? current.merchant.orders : [],
        },
        prospect: {
          leads: Array.isArray(current?.prospect?.leads) ? current.prospect.leads : [],
          sequences: Array.isArray(current?.prospect?.sequences) ? current.prospect.sequences : [],
        },
        scribe: { documents: Array.isArray(current?.scribe?.documents) ? current.scribe.documents : [] },
        compass: { scans: Array.isArray(current?.compass?.scans) ? current.compass.scans : [] },
        canvas: { runs: Array.isArray(current?.canvas?.runs) ? current.canvas.runs : [] },
        inspect: { checks: Array.isArray(current?.inspect?.checks) ? current.inspect.checks : [] },
      };
    }
    return current;
  },
  backup: true,
});

export function listVeritasContracts() {
  return store.get().veritas.contracts;
}

export function listNexusOrchestrations() {
  return store.get().nexus.orchestrations;
}

export function addNexusOrchestration(orchestration = {}) {
  const next = {
    id: orchestration.id || id("nxs"),
    title: orchestration.title || "Orchestration",
    action: orchestration.action || "run",
    status: orchestration.status || "completed",
    summary: orchestration.summary || "",
    created_at: orchestration.created_at || now(),
    updated_at: orchestration.updated_at || now(),
    metadata: orchestration.metadata || {},
  };
  store.update((state) => {
    state.nexus.orchestrations = [next, ...state.nexus.orchestrations].slice(0, 1000);
  });
  return next;
}

export function listMaestroCampaigns() {
  return store.get().maestro.campaigns;
}

export function listSageBriefs() {
  return store.get().sage.briefs;
}

export function addSageBrief(brief = {}) {
  const next = {
    id: brief.id || id("sg"),
    title: brief.title || "Strategy brief",
    action: brief.action || "strategic_briefing",
    status: brief.status || "ready",
    score: Number(brief.score || 0),
    summary: brief.summary || "",
    created_at: brief.created_at || now(),
    updated_at: brief.updated_at || now(),
    metadata: brief.metadata || {},
  };
  store.update((state) => {
    state.sage.briefs = [next, ...state.sage.briefs].slice(0, 1500);
  });
  return next;
}

export function addMaestroCampaign(campaign = {}) {
  const next = {
    id: campaign.id || id("cmp"),
    name: campaign.name || "Campaign",
    objective: campaign.objective || "awareness",
    channel: campaign.channel || "social",
    budget: Number(campaign.budget || 0),
    status: campaign.status || "draft",
    audience: campaign.audience || "",
    created_at: campaign.created_at || now(),
    updated_at: campaign.updated_at || now(),
    summary: campaign.summary || "",
  };
  store.update((state) => {
    state.maestro.campaigns = [next, ...state.maestro.campaigns].slice(0, 1000);
  });
  return next;
}

export function updateMaestroCampaign(campaignId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.maestro.campaigns = state.maestro.campaigns.map((campaign) =>
      campaign.id === campaignId ? { ...campaign, ...patch, updated_at: now() } : campaign
    );
    out = state.maestro.campaigns.find((campaign) => campaign.id === campaignId) || null;
  });
  return out;
}

export function listAtlasTasks() {
  return store.get().atlas.tasks;
}

export function listSupportTickets() {
  return store.get().support.tickets;
}

export function listChronosSchedules() {
  return store.get().chronos.schedules;
}

export function addChronosSchedule(schedule = {}) {
  const next = {
    id: schedule.id || id("sch"),
    title: schedule.title || "Schedule item",
    owner: schedule.owner || "team",
    status: schedule.status || "planned",
    category: schedule.category || "meeting",
    start_at: schedule.start_at || now(),
    end_at: schedule.end_at || null,
    summary: schedule.summary || "",
    created_at: schedule.created_at || now(),
    updated_at: schedule.updated_at || now(),
    metadata: schedule.metadata || {},
  };
  store.update((state) => {
    state.chronos.schedules = [next, ...state.chronos.schedules].slice(0, 2000);
  });
  return next;
}

export function updateChronosSchedule(scheduleId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.chronos.schedules = state.chronos.schedules.map((schedule) =>
      schedule.id === scheduleId ? { ...schedule, ...patch, updated_at: now() } : schedule
    );
    out = state.chronos.schedules.find((schedule) => schedule.id === scheduleId) || null;
  });
  return out;
}

export function listPulseSignals() {
  return store.get().pulse.signals;
}

export function addPulseSignal(signal = {}) {
  const next = {
    id: signal.id || id("sig"),
    title: signal.title || "People signal",
    team: signal.team || "team",
    status: signal.status || "detected",
    severity: signal.severity || "medium",
    metric_value: Number(signal.metric_value || 0),
    summary: signal.summary || "",
    created_at: signal.created_at || now(),
    updated_at: signal.updated_at || now(),
    metadata: signal.metadata || {},
  };
  store.update((state) => {
    state.pulse.signals = [next, ...state.pulse.signals].slice(0, 2000);
  });
  return next;
}

export function updatePulseSignal(signalId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.pulse.signals = state.pulse.signals.map((signal) =>
      signal.id === signalId ? { ...signal, ...patch, updated_at: now() } : signal
    );
    out = state.pulse.signals.find((signal) => signal.id === signalId) || null;
  });
  return out;
}

export function listPartPartners() {
  return store.get().part.partners;
}

export function addPartPartner(partner = {}) {
  const next = {
    id: partner.id || id("prt"),
    name: partner.name || "Partner",
    stage: partner.stage || "identified",
    score: Number(partner.score || 0),
    channel: partner.channel || "crm",
    summary: partner.summary || "",
    created_at: partner.created_at || now(),
    updated_at: partner.updated_at || now(),
    metadata: partner.metadata || {},
  };
  store.update((state) => {
    state.part.partners = [next, ...state.part.partners].slice(0, 2000);
  });
  return next;
}

export function updatePartPartner(partnerId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.part.partners = state.part.partners.map((partner) =>
      partner.id === partnerId ? { ...partner, ...patch, updated_at: now() } : partner
    );
    out = state.part.partners.find((partner) => partner.id === partnerId) || null;
  });
  return out;
}

export function addSupportTicket(ticket = {}) {
  const next = {
    id: ticket.id || id("tkt"),
    subject: ticket.subject || "Support ticket",
    customer: ticket.customer || "Customer",
    status: ticket.status || "new",
    priority: ticket.priority || "medium",
    sentiment: ticket.sentiment || "neutral",
    summary: ticket.summary || "",
    created_at: ticket.created_at || now(),
    updated_at: ticket.updated_at || now(),
    metadata: ticket.metadata || {},
  };
  store.update((state) => {
    state.support.tickets = [next, ...state.support.tickets].slice(0, 2000);
  });
  return next;
}

export function updateSupportTicket(ticketId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.support.tickets = state.support.tickets.map((ticket) =>
      ticket.id === ticketId ? { ...ticket, ...patch, updated_at: now() } : ticket
    );
    out = state.support.tickets.find((ticket) => ticket.id === ticketId) || null;
  });
  return out;
}

export function addAtlasTask(task = {}) {
  const next = {
    id: task.id || id("tsk"),
    title: task.title || "Task",
    owner: task.owner || "unassigned",
    status: task.status || "queued",
    priority: task.priority || "medium",
    dependency_count: Number(task.dependency_count || 0),
    created_at: task.created_at || now(),
    updated_at: task.updated_at || now(),
    metadata: task.metadata || {},
  };
  store.update((state) => {
    state.atlas.tasks = [next, ...state.atlas.tasks].slice(0, 2000);
  });
  return next;
}

export function updateAtlasTask(taskId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.atlas.tasks = state.atlas.tasks.map((task) =>
      task.id === taskId ? { ...task, ...patch, updated_at: now() } : task
    );
    out = state.atlas.tasks.find((task) => task.id === taskId) || null;
  });
  return out;
}

export function listCentsibleSnapshots() {
  return store.get().centsible.snapshots;
}

export function addCentsibleSnapshot(snapshot = {}) {
  const next = {
    id: snapshot.id || id("fin"),
    action: snapshot.action || "financial_health_check",
    status: snapshot.status || "completed",
    amount: Number(snapshot.amount || 0),
    metric_value: Number(snapshot.metric_value || 0),
    summary: snapshot.summary || "",
    created_at: snapshot.created_at || now(),
    metadata: snapshot.metadata || {},
  };
  store.update((state) => {
    state.centsible.snapshots = [next, ...state.centsible.snapshots].slice(0, 1000);
  });
  return next;
}

export function addVeritasContracts(contracts = []) {
  const normalized = (contracts || []).map((c) => ({
    id: c.id || id("ctr"),
    name: c.name || "Contract",
    status: c.status || "uploaded",
    risk: c.risk || "unknown",
    size: Number(c.size || 0),
    uploaded_at: c.uploaded_at || now(),
  }));
  let next = [];
  store.update((state) => {
    state.veritas.contracts = [...normalized, ...state.veritas.contracts].slice(0, 1000);
    next = state.veritas.contracts;
  });
  return next;
}

export function reviewVeritasContract(contractId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.veritas.contracts = state.veritas.contracts.map((c) =>
      c.id === contractId ? { ...c, status: patch.status || "reviewed", risk: patch.risk || c.risk || "medium", reviewed_at: now() } : c
    );
    out = state.veritas.contracts.find((c) => c.id === contractId) || null;
  });
  return out;
}

export function listSentinelCases() {
  return store.get().sentinel.cases;
}

export function addSentinelCase(caseItem = {}) {
  const next = {
    id: caseItem.id || id("inc"),
    title: caseItem.title || "Incident",
    severity: caseItem.severity || "medium",
    status: caseItem.status || "open",
    created_at: caseItem.created_at || now(),
  };
  store.update((state) => {
    state.sentinel.cases = [next, ...state.sentinel.cases].slice(0, 1000);
  });
  return next;
}

export function updateSentinelCaseStatus(caseId, status = "triaged") {
  let out = null;
  store.update((state) => {
    state.sentinel.cases = state.sentinel.cases.map((c) => (c.id === caseId ? { ...c, status, updated_at: now() } : c));
    out = state.sentinel.cases.find((c) => c.id === caseId) || null;
  });
  return out;
}

export function listMerchantCatalog() {
  return store.get().merchant.catalog;
}

export function addMerchantSku(sku = {}) {
  const next = {
    id: sku.id || id("sku"),
    name: sku.name || "SKU",
    price: Number(sku.price || 0),
    stock: Number(sku.stock || 0),
    status: sku.status || "active",
    created_at: sku.created_at || now(),
  };
  store.update((state) => {
    state.merchant.catalog = [next, ...state.merchant.catalog].slice(0, 1000);
  });
  return next;
}

export function listMerchantOrders() {
  return store.get().merchant.orders;
}

export function addMerchantOrder(order = {}) {
  const next = {
    id: order.id || id("ord"),
    customer: order.customer || "Customer",
    total: Number(order.total || 0),
    status: order.status || "new",
    created_at: order.created_at || now(),
  };
  store.update((state) => {
    state.merchant.orders = [next, ...state.merchant.orders].slice(0, 1000);
  });
  return next;
}

export function updateMerchantOrderStatus(orderId, status = "shipped") {
  let out = null;
  store.update((state) => {
    state.merchant.orders = state.merchant.orders.map((o) => (o.id === orderId ? { ...o, status, updated_at: now() } : o));
    out = state.merchant.orders.find((o) => o.id === orderId) || null;
  });
  return out;
}

export function listProspectSequences() {
  return store.get().prospect.sequences;
}

export function listProspectLeads() {
  return store.get().prospect.leads;
}

export function addProspectLead(lead = {}) {
  const next = {
    id: lead.id || id("lead"),
    company: lead.company || "Prospect",
    contact: lead.contact || "",
    channel: lead.channel || "email",
    score: Number(lead.score || 0),
    status: lead.status || "new",
    created_at: lead.created_at || now(),
    updated_at: lead.updated_at || now(),
  };
  store.update((state) => {
    state.prospect.leads = [next, ...state.prospect.leads].slice(0, 2000);
  });
  return next;
}

export function updateProspectLead(leadId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.prospect.leads = state.prospect.leads.map((lead) =>
      lead.id === leadId ? { ...lead, ...patch, updated_at: now() } : lead
    );
    out = state.prospect.leads.find((lead) => lead.id === leadId) || null;
  });
  return out;
}

export function addProspectSequence(sequence = {}) {
  const next = {
    id: sequence.id || id("seq"),
    name: sequence.name || "Sequence",
    channel: sequence.channel || "email",
    message: sequence.message || "",
    status: sequence.status || "running",
    started_at: sequence.started_at || now(),
    completed_at: sequence.completed_at || null,
  };
  store.update((state) => {
    state.prospect.sequences = [next, ...state.prospect.sequences].slice(0, 1000);
  });
  return next;
}

export function updateProspectSequence(sequenceId, patch = {}) {
  let out = null;
  store.update((state) => {
    state.prospect.sequences = state.prospect.sequences.map((s) => (s.id === sequenceId ? { ...s, ...patch } : s));
    out = state.prospect.sequences.find((s) => s.id === sequenceId) || null;
  });
  return out;
}

export function listScribeDocuments() {
  return store.get().scribe.documents;
}

export function addScribeDocuments(documents = []) {
  const normalized = (documents || []).map((d) => ({
    id: d.id || id("doc"),
    name: d.name || "document",
    mime: d.mime || "application/octet-stream",
    size: Number(d.size || 0),
    cloud: d.cloud || "pending",
    cloud_target: d.cloud_target || null,
    indexed: Boolean(d.indexed),
    uploaded_at: d.uploaded_at || now(),
    indexed_at: d.indexed_at || null,
    synced_at: d.synced_at || null,
  }));
  let next = [];
  store.update((state) => {
    state.scribe.documents = [...normalized, ...state.scribe.documents].slice(0, 2000);
    next = state.scribe.documents;
  });
  return next;
}

export function indexScribeDocument(docId) {
  let out = null;
  store.update((state) => {
    state.scribe.documents = state.scribe.documents.map((d) => (d.id === docId ? { ...d, indexed: true, indexed_at: now() } : d));
    out = state.scribe.documents.find((d) => d.id === docId) || null;
  });
  return out;
}

export function syncScribeDocument(docId, target = "s3_docs") {
  let out = null;
  store.update((state) => {
    state.scribe.documents = state.scribe.documents.map((d) =>
      d.id === docId ? { ...d, cloud: "synced", cloud_target: target, synced_at: now() } : d
    );
    out = state.scribe.documents.find((d) => d.id === docId) || null;
  });
  return out;
}

export function listCompassScans() {
  return store.get().compass.scans;
}

export function addCompassScans(scans = []) {
  const normalized = (scans || []).map((s) => ({
    id: s.id || id("scan"),
    url: s.url || "",
    ok: Boolean(s.ok),
    status_code: Number(s.status_code || 0),
    title: s.title || "Untitled",
    sentiment: s.sentiment || "mixed",
    risk: s.risk || "medium",
    summary: s.summary || "",
    scanned_at: s.scanned_at || now(),
  }));
  let next = [];
  store.update((state) => {
    state.compass.scans = [...normalized, ...state.compass.scans].slice(0, 3000);
    next = state.compass.scans;
  });
  return next;
}

export function listCanvasRuns() {
  return store.get().canvas.runs;
}

export function addCanvasRun(run = {}) {
  const next = {
    id: run.id || id("can"),
    action: run.action || "creative_generation",
    status: run.status || "generated",
    format: run.format || "image",
    summary: run.summary || "",
    created_at: run.created_at || now(),
    updated_at: run.updated_at || now(),
    metadata: run.metadata || {},
  };
  store.update((state) => {
    state.canvas.runs = [next, ...state.canvas.runs].slice(0, 1500);
  });
  return next;
}

export function listInspectChecks() {
  return store.get().inspect.checks;
}

export function addInspectCheck(check = {}) {
  const next = {
    id: check.id || id("qc"),
    action: check.action || "quality_gate",
    status: check.status || "passed",
    severity: check.severity || "medium",
    score: Number(check.score || 0),
    summary: check.summary || "",
    created_at: check.created_at || now(),
    updated_at: check.updated_at || now(),
    metadata: check.metadata || {},
  };
  store.update((state) => {
    state.inspect.checks = [next, ...state.inspect.checks].slice(0, 1500);
  });
  return next;
}

export function getAgentOpsStoreStatus() {
  return store.status();
}
