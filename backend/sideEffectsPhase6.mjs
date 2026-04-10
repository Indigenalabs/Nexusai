import { nowIso, makeId } from "./controlState.mjs";
import { getConnector } from "./connectorsPhase3.mjs";
import {
  addAtlasTask,
  addCentsibleSnapshot,
  addCanvasRun,
  addChronosSchedule,
  addInspectCheck,
  addMaestroCampaign,
  addMerchantOrder,
  addMerchantSku,
  addNexusOrchestration,
  addPartPartner,
  addProspectLead,
  addProspectSequence,
  addPulseSignal,
  addSageBrief,
  addSentinelCase,
  addSupportTicket,
  addVeritasContracts,
  addScribeDocuments,
  addCompassScans,
  listChronosSchedules,
  listAtlasTasks,
  listCanvasRuns,
  listCentsibleSnapshots,
  listInspectChecks,
  listMaestroCampaigns,
  listMerchantCatalog,
  listMerchantOrders,
  listPartPartners,
  listProspectLeads,
  listProspectSequences,
  listPulseSignals,
  listSageBriefs,
  listSentinelCases,
  listSupportTickets,
  listVeritasContracts,
  listScribeDocuments,
  listCompassScans,
  indexScribeDocument,
  reviewVeritasContract,
  syncScribeDocument,
  updateMaestroCampaign,
  updateChronosSchedule,
  updatePartPartner,
  updateProspectSequence,
  updateProspectLead,
  updateMerchantOrderStatus,
  updatePulseSignal,
  updateSentinelCaseStatus,
  updateSupportTicket,
} from "./agentOpsState.mjs";
import { vectorSearch, vectorUpsert } from "./vectorMemoryPhase2.mjs";
import { addRuntimeWorkflow, listRuntimeEvents, listRuntimeWorkflows } from "./runtimeOpsStore.mjs";

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === "") return [];
  return [v];
}

async function timedJsonFetch(url, payload, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(String(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload || {}),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function connectorFor(key) {
  try {
    return getConnector(key);
  } catch {
    return null;
  }
}

function currency(value = 0) {
  return `$${Number(value || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function detectSentiment(text = "") {
  const sample = String(text || "").toLowerCase();
  if (/(angry|upset|frustrat|cancel|terrible|bad|late|urgent|complain)/.test(sample)) return "negative";
  if (/(great|happy|love|excellent|thanks|resolved|good)/.test(sample)) return "positive";
  return "neutral";
}

function detectPriority(text = "", fallback = "medium") {
  const sample = String(text || "").toLowerCase();
  if (/(urgent|critical|asap|immediately|outage|legal)/.test(sample)) return "high";
  if (/(whenever|low|minor)/.test(sample)) return "low";
  return fallback;
}

function detectRisk(text = "", fallback = "medium") {
  const sample = String(text || "").toLowerCase();
  if (/(termination|indemn|liability|breach|penalt|exclusive|unlimited|litigation)/.test(sample)) return "high";
  if (/(renewal|notice|privacy|security|audit|obligation)/.test(sample)) return "medium";
  return fallback;
}

function buildWorkflow(title = "Workflow", steps = []) {
  return {
    id: makeId("wf"),
    name: title,
    status: "running",
    created_at: nowIso(),
    updated_at: nowIso(),
    steps: (steps.length ? steps : [{ title: "Gather signals" }, { title: "Dispatch owners" }, { title: "Review output" }]).map((step, index) => ({
      id: makeId(`wfs${index}`),
      title: step?.title || `Step ${index + 1}`,
      status: step?.status || "pending",
    })),
  };
}

async function maybeInvokeConnector(connectorKey, payload, dryRun = false) {
  const connector = connectorFor(connectorKey);
  if (dryRun || !connector?.ready || !connector?.connector?.api_base_url) {
    return { mode: "simulated", connector };
  }
  const probe = await timedJsonFetch(connector.connector.api_base_url, payload);
  return {
    mode: "live",
    connector,
    probe,
  };
}

async function executeNexusOperation(action = "", params = {}) {
  if (!["start_workflow", "workflow_health", "cross_agent_insights", "business_health_score", "alert_correlation", "intent_routing"].includes(action)) return null;
  if (action === "start_workflow") {
    const workflow = buildWorkflow(
      String(params?.name || params?.workflow_name || "Queued Nexus Workflow"),
      safeArray(params?.steps)
    );
    addRuntimeWorkflow(workflow);
    const orchestration = addNexusOrchestration({
      action,
      title: workflow.name,
      status: "running",
      summary: `Nexus launched workflow "${workflow.name}" with ${workflow.steps.length} step(s).`,
      metadata: { workflow_id: workflow.id },
    });
    return {
      ok: true,
      mode: "stateful",
      operation_id: orchestration.id,
      function_name: "commandCenterIntelligence",
      action,
      connector_key: "internal",
      summary: orchestration.summary,
      workflow,
      orchestration,
    };
  }
  const workflows = listRuntimeWorkflows(20);
  const events = listRuntimeEvents(30);
  const result = addNexusOrchestration({
    action,
    title: `Nexus ${action.replace(/_/g, " ")}`,
    status: "completed",
    summary: `Nexus ran ${action.replace(/_/g, " ")} across ${workflows.length} workflow(s).`,
    metadata: { workflow_count: workflows.length, event_count: events.length },
  });
  return {
    ok: true,
    mode: "stateful",
    operation_id: result.id,
    function_name: "commandCenterIntelligence",
    action,
    connector_key: "internal",
    summary: result.summary,
    workflow_count: workflows.length,
    event_count: events.length,
    latest_workflows: workflows.slice(0, 5),
  };
}

async function executeAtlasOperation(action = "", params = {}) {
  if (!["workflow_automation", "task_routing", "dependency_tracking", "capacity_planning", "status_briefing"].includes(action)) return null;
  if (action === "workflow_automation") {
    const workflow = buildWorkflow(String(params?.name || "Atlas Automated Workflow"), safeArray(params?.steps));
    addRuntimeWorkflow(workflow);
    const task = addAtlasTask({
      title: workflow.name,
      owner: String(params?.owner || "atlas"),
      status: "queued",
      priority: String(params?.priority || "medium"),
      dependency_count: workflow.steps.length,
      metadata: { workflow_id: workflow.id },
    });
    return {
      ok: true,
      mode: "stateful",
      operation_id: task.id,
      function_name: "atlasWorkflowAutomation",
      action,
      connector_key: "internal",
      summary: `Atlas created workflow "${workflow.name}" and queued the operating task.`,
      workflow,
      task,
    };
  }
  if (action === "task_routing" || action === "dependency_tracking") {
    const task = addAtlasTask({
      title: String(params?.task_title || params?.title || "Atlas task"),
      owner: String(params?.owner || "ops"),
      status: action === "task_routing" ? "assigned" : "tracked",
      priority: String(params?.priority || "medium"),
      dependency_count: Number(params?.dependency_count || safeArray(params?.dependencies).length || 0),
      metadata: { dependencies: safeArray(params?.dependencies) },
    });
    return {
      ok: true,
      mode: "stateful",
      operation_id: task.id,
      function_name: "atlasWorkflowAutomation",
      action,
      connector_key: "internal",
      summary: `Atlas ${action === "task_routing" ? "routed" : "tracked"} task "${task.title}".`,
      task,
    };
  }
  const tasks = listAtlasTasks();
  const openTasks = tasks.filter((task) => !["completed", "closed"].includes(String(task.status || "").toLowerCase()));
  const overloaded = openTasks.filter((task) => String(task.priority || "").toLowerCase() === "high").length;
  return {
    ok: true,
    mode: "stateful",
    operation_id: makeId("atlas"),
    function_name: "atlasWorkflowAutomation",
    action,
    connector_key: "internal",
    summary: action === "capacity_planning"
      ? `Atlas reviewed ${openTasks.length} active task(s) and flagged ${overloaded} high-priority load point(s).`
      : `Atlas prepared an operations briefing across ${openTasks.length} active task(s).`,
    active_tasks: openTasks.length,
    high_priority_tasks: overloaded,
    tasks: openTasks.slice(0, 10),
  };
}

async function executeMaestroOperation(action = "", params = {}) {
  if (!["campaign_orchestration", "lifecycle_automation", "creative_brief_generation", "ab_test_planning", "performance_scorecard"].includes(action)) return null;
  const objective = String(params?.objective || "awareness");
  const audience = String(params?.audience || "core audience");
  const budget = Number(params?.budget || 0);
  const channel = action === "lifecycle_automation" ? "email" : String(params?.channel || "social");
  const campaign = addMaestroCampaign({
    name: String(params?.name || `${action.replace(/_/g, " ")} campaign`),
    objective,
    audience,
    budget,
    channel,
    status: action === "performance_scorecard" ? "review" : "active",
    summary: `Maestro prepared ${action.replace(/_/g, " ")} for ${audience}.`,
  });
  const connectorKey = action === "lifecycle_automation" ? "email" : (action === "performance_scorecard" ? "ads" : "social");
  const connectorPayload = {
    action,
    campaign_id: campaign.id,
    objective,
    audience,
    budget,
    channel,
    message: String(params?.message || params?.brief || params?.user_request || ""),
  };
  const connectorResult = await maybeInvokeConnector(connectorKey, connectorPayload, Boolean(params?.dry_run));
  if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
    updateMaestroCampaign(campaign.id, { status: "live", summary: `Maestro pushed ${campaign.name} through the ${connectorKey} connector.` });
  }
  const sequences = listMaestroCampaigns();
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: campaign.id,
    function_name: "maestroSocialOps",
    action,
    connector_key: connectorKey,
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok
        ? `Maestro executed ${campaign.name} via the ${connectorKey} connector.`
        : `Maestro recorded ${campaign.name}, but the ${connectorKey} connector failed.`)
      : `Maestro recorded ${campaign.name} and is ready for live connector activation.`,
    campaign,
    total_campaigns: sequences.length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeProspectOperation(action = "", params = {}) {
  if (!["lead_discovery", "lead_scoring", "profile_enrichment", "outreach_drafting", "pipeline_analytics"].includes(action)) return null;
  if (action === "lead_discovery" || action === "lead_scoring" || action === "profile_enrichment") {
    const lead = addProspectLead({
      company: String(params?.company || params?.segment || "Target Account"),
      contact: String(params?.contact || params?.persona || ""),
      channel: String(params?.channel || "email"),
      score: action === "lead_discovery" ? 72 : (action === "lead_scoring" ? Number(params?.score || 84) : 78),
      status: action === "lead_scoring" ? "scored" : "new",
    });
    if (action === "profile_enrichment") {
      updateProspectLead(lead.id, { status: "enriched", metadata: { enriched: true } });
    }
    const crmResult = await maybeInvokeConnector("crm", { action, lead_id: lead.id, company: lead.company, contact: lead.contact, score: lead.score }, Boolean(params?.dry_run));
    return {
      ok: crmResult.mode === "simulated" || Boolean(crmResult.probe?.ok),
      mode: crmResult.mode,
      operation_id: lead.id,
      function_name: "prospectLeadGeneration",
      action,
      connector_key: "crm",
      provider: crmResult.connector?.connector?.provider || "not_configured",
      summary: crmResult.mode === "live"
        ? (crmResult.probe?.ok ? `Prospect synced ${lead.company} into CRM.` : `Prospect scored ${lead.company}, but CRM sync failed.`)
        : `Prospect recorded ${lead.company} in the local lead queue.`,
      lead,
      raw: crmResult.probe?.json || crmResult.probe?.text || null,
      error: crmResult.mode === "live" && !crmResult.probe?.ok ? `Connector returned ${crmResult.probe?.status}` : null,
    };
  }
  if (action === "outreach_drafting") {
    const sequence = addProspectSequence({
      name: String(params?.name || "Outbound sequence"),
      channel: String(params?.channel || "email"),
      message: String(params?.message || params?.body || params?.user_request || ""),
      status: "drafted",
    });
    const emailResult = await maybeInvokeConnector(
      "email",
      {
        action: "email_replies",
        to: asArray(params?.to || params?.recipient),
        subject: String(params?.subject || "Prospect outreach"),
        body: sequence.message,
        sequence_id: sequence.id,
      },
      Boolean(params?.dry_run)
    );
    if (emailResult.mode === "live" && emailResult.probe?.ok) {
      updateProspectSequence(sequence.id, { status: "sent", completed_at: nowIso() });
    }
    return {
      ok: emailResult.mode === "simulated" || Boolean(emailResult.probe?.ok),
      mode: emailResult.mode,
      operation_id: sequence.id,
      function_name: "prospectLeadGeneration",
      action,
      connector_key: "email",
      provider: emailResult.connector?.connector?.provider || "not_configured",
      summary: emailResult.mode === "live"
        ? (emailResult.probe?.ok ? `Prospect sent sequence "${sequence.name}".` : `Prospect drafted sequence "${sequence.name}", but email send failed.`)
        : `Prospect drafted sequence "${sequence.name}" and queued it for review.`,
      sequence,
      raw: emailResult.probe?.json || emailResult.probe?.text || null,
      error: emailResult.mode === "live" && !emailResult.probe?.ok ? `Connector returned ${emailResult.probe?.status}` : null,
    };
  }
  const leads = listProspectLeads();
  const sequences = listProspectSequences();
  const hotLeads = leads.filter((lead) => Number(lead.score || 0) >= 80).length;
  return {
    ok: true,
    mode: "stateful",
    operation_id: makeId("pipeline"),
    function_name: "prospectLeadGeneration",
    action,
    connector_key: "internal",
    summary: `Prospect reviewed ${leads.length} lead(s) and ${sequences.length} active sequence(s).`,
    pipeline: {
      leads: leads.length,
      hot_leads: hotLeads,
      active_sequences: sequences.filter((sequence) => sequence.status !== "completed").length,
    },
    leads: leads.slice(0, 10),
  };
}

async function executeCentsibleOperation(action = "", params = {}) {
  if (!["cash_flow_forecast", "budget_variance", "anomaly_detection", "runway_estimation", "revenue_leakage_scan", "financial_health_check"].includes(action)) return null;
  const amount = Number(params?.amount || params?.budget || params?.monthly_burn || 0);
  const metricValue =
    action === "cash_flow_forecast" ? Math.max(30, Number(params?.days || 90)) :
    action === "runway_estimation" ? Math.max(3, Number(params?.months || 14)) :
    action === "budget_variance" ? Number(params?.variance_pct || 8.5) :
    action === "anomaly_detection" ? Number(params?.anomalies || 2) :
    Number(params?.leakage || 1200);
  const snapshot = addCentsibleSnapshot({
    action,
    amount,
    metric_value: metricValue,
    summary:
      action === "cash_flow_forecast" ? `Forecasted ${metricValue} day cash position at ${currency(amount || 185000)}.` :
      action === "runway_estimation" ? `Estimated runway at ${metricValue} month(s).` :
      action === "budget_variance" ? `Budget variance held at ${metricValue}%.` :
      action === "anomaly_detection" ? `Detected ${metricValue} finance anomaly signal(s).` :
      action === "revenue_leakage_scan" ? `Flagged ${currency(metricValue)} in possible revenue leakage.` :
      `Financial health review completed.`,
  });
  const financeResult = await maybeInvokeConnector("finance", { action, snapshot_id: snapshot.id, amount, metric_value: metricValue }, Boolean(params?.dry_run));
  return {
    ok: financeResult.mode === "simulated" || Boolean(financeResult.probe?.ok),
    mode: financeResult.mode,
    operation_id: snapshot.id,
    function_name: "centsibleFinanceEngine",
    action,
    connector_key: "finance",
    provider: financeResult.connector?.connector?.provider || "not_configured",
    summary: financeResult.mode === "live"
      ? (financeResult.probe?.ok ? `Centsible synced ${action.replace(/_/g, " ")} into finance systems.` : `Centsible calculated ${action.replace(/_/g, " ")}, but finance sync failed.`)
      : snapshot.summary,
    snapshot,
    snapshot_count: listCentsibleSnapshots().length,
    raw: financeResult.probe?.json || financeResult.probe?.text || null,
    error: financeResult.mode === "live" && !financeResult.probe?.ok ? `Connector returned ${financeResult.probe?.status}` : null,
  };
}

async function executeSupportSageOperation(action = "", params = {}) {
  if (!["ticket_triage", "response_recommendation", "sentiment_analysis", "sla_monitoring", "csat_driver_analysis"].includes(action)) return null;
  const customerText = String(params?.message || params?.ticket_body || params?.user_request || params?.summary || "");
  const sentiment = detectSentiment(customerText);
  const priority = detectPriority(customerText, String(params?.priority || "medium"));

  if (action === "ticket_triage" || action === "response_recommendation" || action === "sentiment_analysis") {
    const ticket = addSupportTicket({
      subject: String(params?.subject || params?.title || "Customer support request"),
      customer: String(params?.customer || params?.requester || "Customer"),
      status: action === "response_recommendation" ? "drafted" : (action === "sentiment_analysis" ? "analyzed" : "triaged"),
      priority,
      sentiment,
      summary: customerText.slice(0, 280),
      metadata: {
        channel: String(params?.channel || "email"),
        recommended_response: action === "response_recommendation"
          ? String(params?.reply || params?.draft || "Acknowledge the issue, confirm ownership, and give the next update window.")
          : null,
      },
    });
    const connectorResult = await maybeInvokeConnector(
      "support",
      {
        action,
        ticket_id: ticket.id,
        subject: ticket.subject,
        customer: ticket.customer,
        priority,
        sentiment,
        message: customerText,
      },
      Boolean(params?.dry_run)
    );
    if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
      updateSupportTicket(ticket.id, { status: action === "response_recommendation" ? "responded" : ticket.status });
    }
    return {
      ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
      mode: connectorResult.mode,
      operation_id: ticket.id,
      function_name: "supportSageCustomerService",
      action,
      connector_key: "support",
      provider: connectorResult.connector?.connector?.provider || "not_configured",
      summary: connectorResult.mode === "live"
        ? (connectorResult.probe?.ok
          ? `Support Sage processed ticket "${ticket.subject}" through the support connector.`
          : `Support Sage triaged "${ticket.subject}", but the support connector failed.`)
        : `Support Sage recorded "${ticket.subject}" and prepared the next support move locally.`,
      ticket,
      raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
      error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
    };
  }

  const tickets = listSupportTickets();
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(String(ticket.status || "").toLowerCase()));
  const overdue = openTickets.filter((ticket) => String(ticket.priority || "").toLowerCase() === "high").length;
  const negative = openTickets.filter((ticket) => String(ticket.sentiment || "").toLowerCase() === "negative").length;
  return {
    ok: true,
    mode: "stateful",
    operation_id: makeId("support"),
    function_name: "supportSageCustomerService",
    action,
    connector_key: "internal",
    summary: action === "sla_monitoring"
      ? `Support Sage reviewed ${openTickets.length} open ticket(s) and flagged ${overdue} high-priority SLA risk(s).`
      : `Support Sage reviewed ${tickets.length} ticket(s) and found ${negative} negative-sentiment driver(s).`,
    ticket_totals: {
      total: tickets.length,
      open: openTickets.length,
      sla_risk: overdue,
      negative_sentiment: negative,
    },
    tickets: openTickets.slice(0, 10),
  };
}

async function executeScribeOperation(action = "", params = {}) {
  if (!["knowledge_capture", "document_structuring", "sop_generation", "semantic_retrieval", "audit_trail_export"].includes(action)) return null;
  if (action === "semantic_retrieval") {
    const query = String(params?.query || params?.user_request || "");
    const search = vectorSearch({ namespace: "scribe", query, limit: Number(params?.limit || 8) });
    return {
      ok: true,
      mode: "stateful",
      operation_id: makeId("scribe_search"),
      function_name: "scribeKnowledgeBase",
      action,
      connector_key: "internal",
      summary: `Scribe searched the knowledge base and returned ${search.count} match(es).`,
      retrieval: search,
    };
  }

  if (action === "audit_trail_export") {
    const documents = listScribeDocuments();
    return {
      ok: true,
      mode: "stateful",
      operation_id: makeId("scribe_audit"),
      function_name: "scribeKnowledgeBase",
      action,
      connector_key: "internal",
      summary: `Scribe prepared an audit view across ${documents.length} document(s).`,
      audit: {
        total_documents: documents.length,
        indexed: documents.filter((doc) => doc.indexed).length,
        synced: documents.filter((doc) => doc.cloud === "synced").length,
      },
      documents: documents.slice(0, 10),
    };
  }

  const doc = addScribeDocuments([{
    name: String(params?.name || params?.title || `${action.replace(/_/g, " ")}.md`),
    mime: String(params?.mime || "text/markdown"),
    size: Number(params?.size || String(params?.content || params?.text || params?.user_request || "").length || 0),
    cloud: "pending",
    indexed: action === "document_structuring",
  }])[0];
  if (action === "document_structuring" || action === "sop_generation") indexScribeDocument(doc.id);
  if (action === "sop_generation") syncScribeDocument(doc.id, "docs_workspace");
  vectorUpsert({
    namespace: "scribe",
    text: String(params?.content || params?.text || params?.user_request || params?.summary || doc.name),
    metadata: { document_id: doc.id, action, name: doc.name },
  });
  const connectorResult = await maybeInvokeConnector(
    "docs",
    {
      action,
      document_id: doc.id,
      name: doc.name,
      content: String(params?.content || params?.text || params?.user_request || ""),
    },
    Boolean(params?.dry_run)
  );
  if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
    syncScribeDocument(doc.id, "docs_connector");
  }
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: doc.id,
    function_name: "scribeKnowledgeBase",
    action,
    connector_key: "docs",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok
        ? `Scribe pushed "${doc.name}" into the docs connector.`
        : `Scribe captured "${doc.name}", but docs sync failed.`)
      : `Scribe captured "${doc.name}" locally and indexed it for retrieval.`,
    document: listScribeDocuments().find((item) => item.id === doc.id) || doc,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeCompassOperation(action = "", params = {}) {
  if (!["market_briefing", "competitor_tracking", "trend_detection", "sentiment_signal_read", "opportunity_alerting"].includes(action)) return null;
  const topic = String(params?.topic || params?.query || params?.user_request || "market signal");
  const scan = addCompassScans([{
    url: String(params?.url || ""),
    ok: true,
    status_code: 200,
    title: topic.slice(0, 120) || "Market signal",
    sentiment: detectSentiment(topic),
    risk: detectRisk(topic, "medium"),
    summary: `Compass logged ${action.replace(/_/g, " ")} for ${topic}.`,
  }])[0];
  vectorUpsert({
    namespace: "compass",
    text: topic,
    metadata: { scan_id: scan.id, action, title: scan.title },
  });
  const connectorResult = await maybeInvokeConnector(
    "docs",
    {
      action,
      briefing_id: scan.id,
      topic,
      summary: scan.summary,
      links: asArray(params?.links),
    },
    Boolean(params?.dry_run)
  );
  const scans = listCompassScans();
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: scan.id,
    function_name: "compassMarketIntelligence",
    action,
    connector_key: connectorResult.mode === "live" ? "docs" : "internal",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok
        ? `Compass published ${action.replace(/_/g, " ")} findings into the docs connector.`
        : `Compass recorded the ${action.replace(/_/g, " ")} brief, but docs sync failed.`)
      : `Compass recorded ${action.replace(/_/g, " ")} findings locally.`,
    scan,
    total_scans: scans.length,
    recent_scans: scans.slice(0, 8),
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeMerchantOperation(action = "", params = {}) {
  if (!["catalog_health", "inventory_risk", "pricing_intelligence", "conversion_optimization", "store_health"].includes(action)) return null;
  if (action === "store_health") {
    const catalog = listMerchantCatalog();
    const orders = listMerchantOrders();
    return {
      ok: true,
      mode: "stateful",
      operation_id: makeId("merchant_health"),
      function_name: "merchantProductManagement",
      action,
      connector_key: "internal",
      summary: `Merchant reviewed ${catalog.length} SKU(s) and ${orders.length} order(s) to prepare the store health view.`,
      store_health: {
        sku_count: catalog.length,
        low_stock: catalog.filter((sku) => Number(sku.stock || 0) < 10).length,
        active_orders: orders.filter((order) => !["shipped", "completed"].includes(String(order.status || "").toLowerCase())).length,
      },
      catalog: catalog.slice(0, 10),
      orders: orders.slice(0, 10),
    };
  }

  if (action === "conversion_optimization") {
    const order = addMerchantOrder({
      customer: String(params?.customer || "Anonymous visitor"),
      total: Number(params?.total || params?.average_order_value || 0),
      status: "optimization_review",
    });
    const connectorResult = await maybeInvokeConnector(
      "ecommerce",
      { action, order_id: order.id, total: order.total, landing_page: String(params?.landing_page || "") },
      Boolean(params?.dry_run)
    );
    if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
      updateMerchantOrderStatus(order.id, "optimized");
    }
    return {
      ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
      mode: connectorResult.mode,
      operation_id: order.id,
      function_name: "merchantProductManagement",
      action,
      connector_key: "ecommerce",
      provider: connectorResult.connector?.connector?.provider || "not_configured",
      summary: connectorResult.mode === "live"
        ? (connectorResult.probe?.ok ? "Merchant pushed conversion optimization inputs into the commerce connector." : "Merchant recorded the optimization request, but commerce sync failed.")
        : "Merchant recorded the conversion optimization request locally.",
      order: listMerchantOrders().find((item) => item.id === order.id) || order,
      raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
      error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
    };
  }

  const sku = addMerchantSku({
    name: String(params?.name || params?.sku || "Commerce SKU"),
    price: Number(params?.price || params?.current_price || params?.suggested_price || 0),
    stock: Number(params?.stock || params?.inventory || params?.stock_on_hand || 0),
    status: action === "inventory_risk" ? "at_risk" : "active",
  });
  const connectorResult = await maybeInvokeConnector(
    "ecommerce",
    {
      action,
      sku_id: sku.id,
      name: sku.name,
      price: sku.price,
      stock: sku.stock,
    },
    Boolean(params?.dry_run)
  );
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: sku.id,
    function_name: "merchantProductManagement",
    action,
    connector_key: "ecommerce",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Merchant synced SKU "${sku.name}" into commerce systems.` : `Merchant recorded SKU "${sku.name}", but commerce sync failed.`)
      : `Merchant recorded SKU "${sku.name}" locally for ${action.replace(/_/g, " ")}.`,
    sku,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeVeritasOperation(action = "", params = {}) {
  if (!["contract_risk_review", "compliance_audit", "obligation_tracking", "policy_update_check", "legal_risk_register"].includes(action)) return null;
  const contractName = String(params?.name || params?.contract_name || params?.policy_name || "Contract review");
  const reviewedRisk = detectRisk(String(params?.text || params?.summary || params?.user_request || contractName), String(params?.risk || "medium"));

  if (action === "contract_risk_review") {
    const contract = addVeritasContracts([{
      name: contractName,
      status: "uploaded",
      risk: reviewedRisk,
      size: Number(params?.size || String(params?.text || params?.summary || "").length || 0),
    }])[0];
    const reviewed = reviewVeritasContract(contract.id, { status: "reviewed", risk: reviewedRisk });
    const connectorResult = await maybeInvokeConnector(
      "docs",
      { action, contract_id: contract.id, name: contractName, risk: reviewedRisk, text: String(params?.text || params?.summary || "") },
      Boolean(params?.dry_run)
    );
    return {
      ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
      mode: connectorResult.mode,
      operation_id: reviewed?.id || contract.id,
      function_name: "veritasComplianceValidation",
      action,
      connector_key: "docs",
      provider: connectorResult.connector?.connector?.provider || "not_configured",
      summary: connectorResult.mode === "live"
        ? (connectorResult.probe?.ok ? `Veritas reviewed "${contractName}" and synced the legal note.` : `Veritas reviewed "${contractName}", but docs sync failed.`)
        : `Veritas reviewed "${contractName}" and logged the legal risk locally.`,
      contract: reviewed || contract,
      raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
      error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
    };
  }

  const contracts = listVeritasContracts();
  const highRisk = contracts.filter((contract) => String(contract.risk || "").toLowerCase() === "high").length;
  const connectorResult = await maybeInvokeConnector(
    "docs",
    { action, contract_count: contracts.length, high_risk: highRisk, user_request: String(params?.user_request || "") },
    Boolean(params?.dry_run)
  );
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: makeId("legal"),
    function_name: "veritasComplianceValidation",
    action,
    connector_key: connectorResult.mode === "live" ? "docs" : "internal",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Veritas synced the ${action.replace(/_/g, " ")} review into docs.` : `Veritas prepared the ${action.replace(/_/g, " ")} review, but docs sync failed.`)
      : `Veritas prepared the ${action.replace(/_/g, " ")} review locally across ${contracts.length} record(s).`,
    legal_register: {
      total_records: contracts.length,
      high_risk: highRisk,
    },
    contracts: contracts.slice(0, 10),
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeSentinelOperation(action = "", params = {}) {
  if (!["threat_scan", "incident_triage", "vulnerability_review", "security_posture_report", "response_playbook"].includes(action)) return null;
  if (action === "security_posture_report") {
    const cases = listSentinelCases();
    const openHigh = cases.filter((item) => ["high", "critical"].includes(String(item.severity || "").toLowerCase()) && String(item.status || "").toLowerCase() !== "resolved").length;
    return {
      ok: true,
      mode: "stateful",
      operation_id: makeId("sentinel_report"),
      function_name: "sentinelSecurityMonitoring",
      action,
      connector_key: "internal",
      summary: `Sentinel reviewed ${cases.length} security case(s) and found ${openHigh} open high-severity signal(s).`,
      posture: {
        total_cases: cases.length,
        open_high: openHigh,
        resolved: cases.filter((item) => String(item.status || "").toLowerCase() === "resolved").length,
      },
      cases: cases.slice(0, 10),
    };
  }
  const severity = detectRisk(String(params?.summary || params?.user_request || params?.title || action), String(params?.severity || "medium"));
  const caseItem = addSentinelCase({
    title: String(params?.title || `${action.replace(/_/g, " ")} case`),
    severity,
    status: action === "incident_triage" ? "triaged" : "open",
  });
  const connectorResult = await maybeInvokeConnector(
    "security",
    {
      action,
      case_id: caseItem.id,
      title: caseItem.title,
      severity,
      summary: String(params?.summary || params?.user_request || ""),
    },
    Boolean(params?.dry_run)
  );
  if (connectorResult.mode === "live" && connectorResult.probe?.ok && action === "incident_triage") {
    updateSentinelCaseStatus(caseItem.id, "triaged");
  }
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: caseItem.id,
    function_name: "sentinelSecurityMonitoring",
    action,
    connector_key: "security",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Sentinel synced "${caseItem.title}" through the security connector.` : `Sentinel recorded "${caseItem.title}", but security sync failed.`)
      : `Sentinel recorded "${caseItem.title}" locally.`,
    case: listSentinelCases().find((item) => item.id === caseItem.id) || caseItem,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeChronosOperation(action = "", params = {}) {
  if (!["smart_scheduling", "focus_blocking", "meeting_load_audit", "deadline_alignment", "weekly_time_report"].includes(action)) return null;
  if (action === "meeting_load_audit" || action === "weekly_time_report") {
    const schedules = listChronosSchedules();
    const focusBlocks = schedules.filter((item) => String(item.category || "").toLowerCase() === "focus").length;
    return {
      ok: true,
      mode: "stateful",
      operation_id: makeId("chronos_audit"),
      function_name: "chronosSchedulingEngine",
      action,
      connector_key: "internal",
      summary: `Chronos reviewed ${schedules.length} schedule item(s) and found ${focusBlocks} focus block(s).`,
      schedule_health: {
        total_items: schedules.length,
        focus_blocks: focusBlocks,
        meetings: schedules.filter((item) => String(item.category || "").toLowerCase() === "meeting").length,
      },
      schedules: schedules.slice(0, 10),
    };
  }
  const category = action === "focus_blocking" ? "focus" : "meeting";
  const schedule = addChronosSchedule({
    title: String(params?.title || `${action.replace(/_/g, " ")}`),
    owner: String(params?.owner || "team"),
    status: "planned",
    category,
    start_at: String(params?.start_at || new Date().toISOString()),
    end_at: String(params?.end_at || ""),
    summary: String(params?.summary || params?.user_request || ""),
  });
  const connectorResult = await maybeInvokeConnector(
    "calendar",
    {
      action,
      schedule_id: schedule.id,
      title: schedule.title,
      start_at: schedule.start_at,
      end_at: schedule.end_at,
      owner: schedule.owner,
    },
    Boolean(params?.dry_run)
  );
  if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
    updateChronosSchedule(schedule.id, { status: "scheduled" });
  }
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: schedule.id,
    function_name: "chronosSchedulingEngine",
    action,
    connector_key: "calendar",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Chronos synced "${schedule.title}" into the calendar connector.` : `Chronos recorded "${schedule.title}", but calendar sync failed.`)
      : `Chronos recorded "${schedule.title}" locally.`,
    schedule: listChronosSchedules().find((item) => item.id === schedule.id) || schedule,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executePulseOperation(action = "", params = {}) {
  if (!["sentiment_monitor", "burnout_risk_detection", "retention_risk", "recognition_insights", "people_analytics"].includes(action)) return null;
  const metricValue =
    action === "burnout_risk_detection" ? Number(params?.risk_score || 72) :
    action === "retention_risk" ? Number(params?.retention_score || 68) :
    action === "people_analytics" ? Number(params?.engagement_score || 81) :
    Number(params?.score || 75);
  const signal = addPulseSignal({
    title: String(params?.title || `${action.replace(/_/g, " ")}`),
    team: String(params?.team || "team"),
    status: action === "recognition_insights" ? "published" : "detected",
    severity: metricValue >= 80 ? "high" : metricValue >= 60 ? "medium" : "low",
    metric_value: metricValue,
    summary: String(params?.summary || params?.user_request || ""),
    metadata: { action },
  });
  const connectorResult = await maybeInvokeConnector(
    "docs",
    {
      action,
      signal_id: signal.id,
      team: signal.team,
      metric_value: signal.metric_value,
      summary: signal.summary,
    },
    Boolean(params?.dry_run)
  );
  if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
    updatePulseSignal(signal.id, { status: "published" });
  }
  const signals = listPulseSignals();
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: signal.id,
    function_name: "pulseHREngine",
    action,
    connector_key: connectorResult.mode === "live" ? "docs" : "internal",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Pulse published the ${action.replace(/_/g, " ")} signal.` : `Pulse recorded the ${action.replace(/_/g, " ")} signal, but docs sync failed.`)
      : `Pulse recorded the ${action.replace(/_/g, " ")} signal locally.`,
    signal: listPulseSignals().find((item) => item.id === signal.id) || signal,
    total_signals: signals.length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executePartOperation(action = "", params = {}) {
  if (!["partner_discovery", "relationship_scoring", "co_marketing_planning", "alliance_pipeline", "partner_roi_review"].includes(action)) return null;
  const partner = addPartPartner({
    name: String(params?.name || params?.partner_name || "Partner"),
    stage: action === "co_marketing_planning" ? "planning" : (action === "partner_roi_review" ? "review" : "identified"),
    score: Number(params?.score || params?.roi || 78),
    channel: action === "co_marketing_planning" ? "email" : "crm",
    summary: String(params?.summary || params?.user_request || ""),
  });
  const connectorKey = action === "co_marketing_planning" ? "email" : "crm";
  const connectorResult = await maybeInvokeConnector(
    connectorKey,
    {
      action,
      partner_id: partner.id,
      name: partner.name,
      score: partner.score,
      summary: partner.summary,
    },
    Boolean(params?.dry_run)
  );
  if (connectorResult.mode === "live" && connectorResult.probe?.ok) {
    updatePartPartner(partner.id, { stage: connectorKey === "email" ? "outreach_ready" : "synced" });
  }
  const partners = listPartPartners();
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: partner.id,
    function_name: "partPartnershipEngine",
    action,
    connector_key: connectorKey,
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Part synced "${partner.name}" through the ${connectorKey} connector.` : `Part recorded "${partner.name}", but ${connectorKey} sync failed.`)
      : `Part recorded "${partner.name}" locally.`,
    partner: listPartPartners().find((item) => item.id === partner.id) || partner,
    total_partners: partners.length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeSageOperation(action = "", params = {}) {
  if (!["strategy_scorecard", "scenario_modeling", "opportunity_mapping", "risk_tradeoff_analysis", "strategic_briefing"].includes(action)) return null;
  const score =
    action === "strategy_scorecard" ? Number(params?.score || 82) :
    action === "scenario_modeling" ? Number(params?.scenario_count || 3) :
    action === "risk_tradeoff_analysis" ? Number(params?.risk_score || 64) :
    Number(params?.score || 78);
  const brief = addSageBrief({
    title: String(params?.title || `${action.replace(/_/g, " ")}`),
    action,
    status: "ready",
    score,
    summary: String(params?.summary || params?.user_request || ""),
    metadata: { market: params?.market || "", horizon: params?.horizon || "" },
  });
  const connectorResult = await maybeInvokeConnector(
    "docs",
    {
      action,
      brief_id: brief.id,
      title: brief.title,
      score,
      summary: brief.summary,
    },
    Boolean(params?.dry_run)
  );
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: brief.id,
    function_name: "sageBussinessStrategy",
    action,
    connector_key: connectorResult.mode === "live" ? "docs" : "internal",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Sage synced "${brief.title}" into the strategy docs flow.` : `Sage prepared "${brief.title}", but docs sync failed.`)
      : `Sage prepared "${brief.title}" locally.`,
    brief,
    total_briefs: listSageBriefs().length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeCanvasOperation(action = "", params = {}) {
  if (!["creative_generation", "cinematic_video_command", "voiceover_generation", "brand_compliance", "format_adaptation", "variant_testing", "creative_performance"].includes(action)) return null;
  const format =
    action === "voiceover_generation" ? "audio" :
    action === "cinematic_video_command" ? "video" :
    "image";
  const run = addCanvasRun({
    action,
    status: "generated",
    format,
    summary: String(params?.summary || params?.prompt || params?.user_request || ""),
    metadata: { channel: params?.channel || "", format },
  });
  const connectorKey = action === "creative_performance" ? "ads" : (action === "brand_compliance" ? "docs" : "social");
  const connectorResult = await maybeInvokeConnector(
    connectorKey,
    {
      action,
      asset_run_id: run.id,
      prompt: String(params?.prompt || params?.user_request || ""),
      format,
    },
    Boolean(params?.dry_run)
  );
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: run.id,
    function_name: "canvasCreativeGeneration",
    action,
    connector_key: connectorKey,
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Canvas pushed ${action.replace(/_/g, " ")} through the ${connectorKey} connector.` : `Canvas recorded the creative run, but ${connectorKey} sync failed.`)
      : `Canvas recorded the creative run locally.`,
    run,
    total_runs: listCanvasRuns().length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeInspectOperation(action = "", params = {}) {
  if (!["test_orchestration", "regression_scan", "quality_gate", "root_cause_analysis", "defect_trend_report"].includes(action)) return null;
  const score =
    action === "quality_gate" ? Number(params?.quality_score || 88) :
    action === "regression_scan" ? Number(params?.regression_score || 84) :
    Number(params?.score || 79);
  const check = addInspectCheck({
    action,
    status: action === "quality_gate" ? "passed" : "completed",
    severity: detectRisk(String(params?.summary || params?.user_request || action), "medium"),
    score,
    summary: String(params?.summary || params?.user_request || ""),
    metadata: { environment: params?.environment || "", suite: params?.suite || "" },
  });
  const connectorResult = await maybeInvokeConnector(
    "docs",
    {
      action,
      check_id: check.id,
      score,
      summary: check.summary,
      environment: params?.environment || "",
    },
    Boolean(params?.dry_run)
  );
  return {
    ok: connectorResult.mode === "simulated" || Boolean(connectorResult.probe?.ok),
    mode: connectorResult.mode,
    operation_id: check.id,
    function_name: "inspectQualityEngine",
    action,
    connector_key: connectorResult.mode === "live" ? "docs" : "internal",
    provider: connectorResult.connector?.connector?.provider || "not_configured",
    summary: connectorResult.mode === "live"
      ? (connectorResult.probe?.ok ? `Inspect synced the ${action.replace(/_/g, " ")} output into docs.` : `Inspect recorded the ${action.replace(/_/g, " ")} output, but docs sync failed.`)
      : `Inspect recorded the ${action.replace(/_/g, " ")} output locally.`,
    check,
    total_checks: listInspectChecks().length,
    raw: connectorResult.probe?.json || connectorResult.probe?.text || null,
    error: connectorResult.mode === "live" && !connectorResult.probe?.ok ? `Connector returned ${connectorResult.probe?.status}` : null,
  };
}

async function executeSpecializedAgentOperation(functionName = "", action = "", params = {}) {
  if (functionName === "commandCenterIntelligence") return executeNexusOperation(action, params);
  if (functionName === "atlasWorkflowAutomation") return executeAtlasOperation(action, params);
  if (functionName === "maestroSocialOps") return executeMaestroOperation(action, params);
  if (functionName === "prospectLeadGeneration") return executeProspectOperation(action, params);
  if (functionName === "centsibleFinanceEngine") return executeCentsibleOperation(action, params);
  if (functionName === "sageBussinessStrategy") return executeSageOperation(action, params);
  if (functionName === "supportSageCustomerService") return executeSupportSageOperation(action, params);
  if (functionName === "scribeKnowledgeBase") return executeScribeOperation(action, params);
  if (functionName === "sentinelSecurityMonitoring") return executeSentinelOperation(action, params);
  if (functionName === "compassMarketIntelligence") return executeCompassOperation(action, params);
  if (functionName === "partPartnershipEngine") return executePartOperation(action, params);
  if (functionName === "pulseHREngine") return executePulseOperation(action, params);
  if (functionName === "chronosSchedulingEngine") return executeChronosOperation(action, params);
  if (functionName === "merchantProductManagement") return executeMerchantOperation(action, params);
  if (functionName === "canvasCreativeGeneration") return executeCanvasOperation(action, params);
  if (functionName === "inspectQualityEngine") return executeInspectOperation(action, params);
  if (functionName === "veritasComplianceValidation") return executeVeritasOperation(action, params);
  return null;
}

export async function executeSocialPosting(params = {}) {
  const connector = connectorFor("social");
  const dryRun = Boolean(params?.dry_run);
  const postId = makeId("post");
  const platform = String(params?.platform || "instagram");
  const payload = {
    action: "social_posting",
    platform,
    content: params?.content || "",
    media_urls: asArray(params?.media_urls),
    account_id: params?.account_id || "",
    idempotency_hint: params?.idempotency_key || "",
  };

  if (!dryRun && connector?.ready && connector?.connector?.api_base_url) {
    const probe = await timedJsonFetch(connector.connector.api_base_url, payload);
    if (probe.ok) {
      return {
        ok: true,
        mode: "live",
        post_id: probe?.json?.post_id || postId,
        platform,
        published_at: nowIso(),
        summary: `Posted to ${platform} via live connector.`,
        connector_key: "social",
        provider: connector.connector.provider || "social_api",
        raw: probe.json || probe.text || null,
      };
    }
    return {
      ok: false,
      mode: "live",
      post_id: postId,
      platform,
      published_at: nowIso(),
      summary: `Social connector call failed (${probe.status}).`,
      connector_key: "social",
      provider: connector?.connector?.provider || "social_api",
      raw: probe.json || probe.text || null,
      error: `Connector returned ${probe.status}`,
    };
  }

  return {
    ok: true,
    mode: "simulated",
    post_id: postId,
    platform,
    published_at: nowIso(),
    summary: `Simulated social post for ${platform}. Configure Social connector for live side effects.`,
    connector_key: "social",
    provider: connector?.connector?.provider || "not_configured",
  };
}

export async function executeEmailReplies(params = {}) {
  const connector = connectorFor("email");
  const dryRun = Boolean(params?.dry_run);
  const messageId = makeId("msg");
  const payload = {
    action: "email_replies",
    to: asArray(params?.to),
    subject: String(params?.subject || ""),
    body: String(params?.body || ""),
    thread_id: params?.thread_id || "",
    inbox: params?.inbox || "",
  };

  if (!dryRun && connector?.ready && connector?.connector?.api_base_url) {
    const probe = await timedJsonFetch(connector.connector.api_base_url, payload);
    if (probe.ok) {
      return {
        ok: true,
        mode: "live",
        message_id: probe?.json?.message_id || messageId,
        accepted: true,
        sent_at: nowIso(),
        summary: `Email reply sent to ${payload.to.length} recipient(s).`,
        connector_key: "email",
        provider: connector.connector.provider || "email_api",
        raw: probe.json || probe.text || null,
      };
    }
    return {
      ok: false,
      mode: "live",
      message_id: messageId,
      accepted: false,
      sent_at: nowIso(),
      summary: `Email connector call failed (${probe.status}).`,
      connector_key: "email",
      provider: connector?.connector?.provider || "email_api",
      raw: probe.json || probe.text || null,
      error: `Connector returned ${probe.status}`,
    };
  }

  return {
    ok: true,
    mode: "simulated",
    message_id: messageId,
    accepted: true,
    sent_at: nowIso(),
    summary: `Simulated email reply to ${payload.to.length} recipient(s). Configure Email connector for live send.`,
    connector_key: "email",
    provider: connector?.connector?.provider || "not_configured",
  };
}

export async function executeDocumentIngestion(params = {}) {
  const connector = connectorFor("docs");
  const dryRun = Boolean(params?.dry_run);
  const doc = {
    id: makeId("doc"),
    name: String(params?.name || "document"),
    mime: String(params?.mime || "text/plain"),
    size: Number(String(params?.text || "").length || 0),
    cloud: "pending",
    indexed: false,
    uploaded_at: nowIso(),
  };
  addScribeDocuments([doc]);
  indexScribeDocument(doc.id);
  vectorUpsert({
    namespace: String(params?.namespace || "global"),
    text: String(params?.text || ""),
    metadata: {
      doc_id: doc.id,
      name: doc.name,
      mime: doc.mime,
      source: "document_ingestion",
    },
  });
  const synced = syncScribeDocument(doc.id, String(params?.cloud_target || "s3_docs"));

  if (!dryRun && connector?.ready && connector?.connector?.api_base_url) {
    const probe = await timedJsonFetch(connector.connector.api_base_url, {
      action: "document_ingestion",
      doc_id: doc.id,
      name: doc.name,
      mime: doc.mime,
      namespace: String(params?.namespace || "global"),
    });
    return {
      ok: probe.ok,
      mode: "live",
      doc_id: doc.id,
      indexed: true,
      synced: Boolean(synced?.cloud === "synced"),
      summary: probe.ok
        ? `Document ingested, indexed, and synced via live docs connector.`
        : `Document indexed locally; docs connector failed (${probe.status}).`,
      connector_key: "docs",
      provider: connector.connector.provider || "docs_api",
      raw: probe.json || probe.text || null,
      error: probe.ok ? null : `Connector returned ${probe.status}`,
    };
  }

  return {
    ok: true,
    mode: "simulated",
    doc_id: doc.id,
    indexed: true,
    synced: Boolean(synced?.cloud === "synced"),
    summary: "Document ingested and indexed locally. Configure Docs connector for live external sync.",
    connector_key: "docs",
    provider: connector?.connector?.provider || "not_configured",
  };
}

export async function executeShopOperations(params = {}) {
  const connector = connectorFor("ecommerce");
  const dryRun = Boolean(params?.dry_run);
  const operation = String(params?.operation || "");
  const payload = params?.payload || {};
  let operationId = makeId("shopop");
  let summary = "Shop operation executed.";
  let stateResult = null;

  if (operation === "create_order") {
    const order = addMerchantOrder(payload);
    operationId = order?.id || operationId;
    summary = `Order ${operationId} created.`;
    stateResult = order;
  } else if (operation === "update_order") {
    const updated = updateMerchantOrderStatus(String(payload?.id || ""), String(payload?.status || "processing"));
    operationId = updated?.id || operationId;
    summary = `Order ${operationId} updated to ${updated?.status || payload?.status || "processing"}.`;
    stateResult = updated;
  } else if (operation === "add_sku") {
    const sku = addMerchantSku(payload);
    operationId = sku?.id || operationId;
    summary = `SKU ${operationId} added to catalog.`;
    stateResult = sku;
  } else if (operation === "update_inventory") {
    const sku = addMerchantSku({ ...payload, status: "active" });
    operationId = sku?.id || operationId;
    summary = `Inventory updated for SKU ${operationId}.`;
    stateResult = sku;
  }

  if (!dryRun && connector?.ready && connector?.connector?.api_base_url) {
    const probe = await timedJsonFetch(connector.connector.api_base_url, {
      action: "shop_operations",
      operation,
      payload,
      operation_id: operationId,
    });
    return {
      ok: probe.ok,
      mode: "live",
      operation_id: operationId,
      operation,
      summary: probe.ok ? `${summary} Live connector sync completed.` : `${summary} Live connector failed (${probe.status}).`,
      connector_key: "ecommerce",
      provider: connector.connector.provider || "ecommerce_api",
      state_result: stateResult,
      raw: probe.json || probe.text || null,
      error: probe.ok ? null : `Connector returned ${probe.status}`,
    };
  }

  return {
    ok: true,
    mode: "simulated",
    operation_id: operationId,
    operation,
    summary: `${summary} Local state updated. Configure E-commerce connector for live side effects.`,
    connector_key: "ecommerce",
    provider: connector?.connector?.provider || "not_configured",
    state_result: stateResult,
  };
}

const ACTION_CONNECTOR_RULES = [
  { match: /(campaign|creative|social|ad|brand|content|outreach)/, connector: "social" },
  { match: /(lead|pipeline|ticket|support|reply|email|notification|message)/, connector: "email" },
  { match: /(contract|compliance|policy|knowledge|document|sop|audit|report|qa|test|release)/, connector: "docs" },
  { match: /(inventory|pricing|catalog|order|commerce|partner|budget|cash|finance|payment)/, connector: "ecommerce" },
];

function inferConnectorFromAction(action = "", explicit = "") {
  if (explicit) return explicit;
  const a = String(action || "").toLowerCase();
  const hit = ACTION_CONNECTOR_RULES.find((r) => r.match.test(a));
  return hit?.connector || "docs";
}

export async function executeAgentOperation(params = {}) {
  const functionName = String(params?.function_name || "agent");
  const action = String(params?.action || "run");
  const specialized = await executeSpecializedAgentOperation(functionName, action, params?.params || {});
  if (specialized) return specialized;
  const connectorKey = inferConnectorFromAction(action, String(params?.connector_key || ""));
  const connector = connectorFor(connectorKey);
  const dryRun = Boolean(params?.dry_run);
  const operationId = makeId("op");
  const payload = {
    function_name: functionName,
    action,
    params: params?.params || {},
    operation_id: operationId,
  };

  if (!dryRun && connector?.ready && connector?.connector?.api_base_url) {
    const probe = await timedJsonFetch(connector.connector.api_base_url, payload);
    if (probe.ok) {
      return {
        ok: true,
        mode: "live",
        operation_id: operationId,
        function_name: functionName,
        action,
        connector_key: connectorKey,
        provider: connector.connector.provider || "connector_api",
        summary: `${functionName}:${action} executed via live ${connectorKey} connector.`,
        raw: probe.json || probe.text || null,
      };
    }
    return {
      ok: false,
      mode: "live",
      operation_id: operationId,
      function_name: functionName,
      action,
      connector_key: connectorKey,
      provider: connector?.connector?.provider || "connector_api",
      summary: `${functionName}:${action} failed via ${connectorKey} connector (${probe.status}).`,
      raw: probe.json || probe.text || null,
      error: `Connector returned ${probe.status}`,
    };
  }

  return {
    ok: true,
    mode: "simulated",
    operation_id: operationId,
    function_name: functionName,
    action,
    connector_key: connectorKey,
    provider: connector?.connector?.provider || "not_configured",
    summary: `${functionName}:${action} executed in simulated mode. Configure ${connectorKey} connector for live side effects.`,
  };
}
