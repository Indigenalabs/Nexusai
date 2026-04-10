import { getState, updateState, nowIso } from "./controlState.mjs";
import { sloStatus } from "./observabilityPhase4.mjs";
import { listConnectors } from "./connectorsPhase3.mjs";

const TIERS = ["suggest", "approve", "auto-low-risk", "auto-broad"];

const DEFAULT_MATRIX = {
  social_posting: "approve",
  email_replies: "approve",
  document_ingestion: "auto-low-risk",
  shop_operations: "approve",
  generic_operations: "approve",
};

const WORKFLOW_REQUIREMENTS = {
  social_posting: ["docs"],
  email_replies: ["email"],
  document_ingestion: ["docs"],
  shop_operations: ["ecommerce"],
  generic_operations: [],
};

const SAFE_AUTONOMOUS_ACTIONS = [
  /_full_self_test$/i,
  /^workflow_health$/i,
  /^agent_registry_status$/i,
  /^time_audit$/i,
  /^market_briefing$/i,
  /^security_posture_report$/i,
  /^financial_health_check$/i,
];

function isSafeAutonomousAction(functionName = "", action = "") {
  const key = `${String(functionName || "")}:${String(action || "")}`;
  return SAFE_AUTONOMOUS_ACTIONS.some((re) => re.test(String(action || "")) || re.test(key));
}

const TEMPLATES = [
  { id: "influencer_content", name: "Influencer Content Ideation", business_type: "Social Media Influencer", category: "content", trigger: "scheduled_deadline_or_trend", autonomy: "approve", risk: "medium", workflow_type: "social_posting", description: "Trend scan, ideate, create, schedule, archive.", approval_gates: ["pre_publish_review"], kpis: ["engagement_rate", "follower_growth"], steps: ["Compass trend scan", "Sage trend scoring", "Maestro drafts script", "Canvas generates assets", "Chronos timing", "Maestro schedules", "Scribe archives"] },
  { id: "influencer_brand_deals", name: "Influencer Brand Deals", business_type: "Social Media Influencer", category: "revenue", trigger: "brand_opportunity_detected", autonomy: "suggest", risk: "high", workflow_type: "email_replies", description: "Find, pitch, negotiate, deliver, invoice.", approval_gates: ["pitch_approval", "contract_approval"], kpis: ["deal_conversion_rate", "avg_deal_value"], steps: ["Part finds opportunities", "Scribe media kit", "Maestro pitch", "Part outreach", "Veritas contract review", "Atlas deliverables", "Centsible invoicing"] },
  { id: "influencer_community", name: "Influencer Community Management", business_type: "Social Media Influencer", category: "community", trigger: "new_comment_or_dm", autonomy: "auto-low-risk", risk: "medium", workflow_type: "email_replies", description: "Auto-handle routine community interactions and escalate risk.", approval_gates: ["negative_escalation_review"], kpis: ["response_time", "sentiment_score"], steps: ["Support Sage triage", "Template response", "Sentinel moderation", "Prospect intent tagging", "Scribe logging"] },
  { id: "shopify_product_launch", name: "Shopify Product Launch", business_type: "Shopify Online Store", category: "commerce", trigger: "new_product_arrival", autonomy: "approve", risk: "low", workflow_type: "shop_operations", description: "Draft product, generate creatives, publish, promote.", approval_gates: ["final_product_review"], kpis: ["time_to_live", "sales_velocity"], steps: ["Merchant draft", "Canvas assets", "Maestro SEO copy", "Merchant publish", "Maestro promo", "Scribe archive"] },
  { id: "shopify_inventory", name: "Shopify Inventory and Reorder", business_type: "Shopify Online Store", category: "commerce", trigger: "inventory_below_threshold", autonomy: "auto-low-risk", risk: "medium", workflow_type: "shop_operations", description: "Forecast demand and trigger bounded restock workflows.", approval_gates: ["high_value_po_approval"], kpis: ["stockout_rate", "forecast_accuracy"], steps: ["Merchant inventory scan", "Sage forecast", "PO generation", "Part supplier send", "Atlas receiving tasks"] },
  { id: "shopify_fulfillment", name: "Shopify Order Fulfillment", business_type: "Shopify Online Store", category: "commerce", trigger: "order_placed", autonomy: "auto-broad", risk: "low", workflow_type: "shop_operations", description: "Order capture to shipment with tracking updates.", approval_gates: [], kpis: ["fulfillment_time", "on_time_delivery"], steps: ["Merchant order capture", "Atlas pick-pack", "Carrier label", "Merchant shipped update", "Support Sage tracking"] },
  { id: "shopify_cart_recovery", name: "Shopify Abandoned Cart Recovery", business_type: "Shopify Online Store", category: "growth", trigger: "abandoned_checkout_detected", autonomy: "auto-broad", risk: "low", workflow_type: "email_replies", description: "Timed recovery sequence with conversion tracking.", approval_gates: [], kpis: ["recovery_rate", "recovered_revenue"], steps: ["Detect abandonment", "1h reminder", "24h incentive", "72h final push", "Inspect sequence analysis"] },
  { id: "shopify_finance_close", name: "Shopify Financial Reporting and Tax", business_type: "Shopify Online Store", category: "finance", trigger: "month_end", autonomy: "suggest", risk: "high", workflow_type: "generic_operations", description: "Close books, prep taxes, reconcile transactions.", approval_gates: ["owner_accountant_review"], kpis: ["time_to_close", "reconciliation_accuracy"], steps: ["Centsible aggregation", "Veritas compliance check", "Centsible report pack", "Scribe filing bundle", "Inspect reconciliation"] },
  { id: "ndis_intake", name: "NDIS Intake and Document Collection", business_type: "NDIS Service Provider", category: "intake", trigger: "lead_converted_to_intake", autonomy: "auto-low-risk", risk: "medium", workflow_type: "document_ingestion", description: "Collect, extract, validate, and onboard new participants.", approval_gates: ["critical_doc_review"], kpis: ["intake_completion_time", "document_accuracy"], steps: ["Secure intake form", "Scribe folder + OCR", "Veritas compliance check", "Centsible budget record", "Atlas onboarding tasks"] },
  { id: "ndis_email_comms", name: "NDIS Client Email Autonomy", business_type: "NDIS Service Provider", category: "service", trigger: "client_email_received", autonomy: "auto-low-risk", risk: "medium", workflow_type: "email_replies", description: "Classify and respond to routine client emails, escalate complex.", approval_gates: ["urgent_email_review"], kpis: ["response_time", "csat"], steps: ["Support Sage classify", "Veritas policy check", "Auto-send routine reply", "Chronos booking sync", "Scribe logging"] },
  { id: "ndis_claiming", name: "NDIS Claiming and Invoicing", business_type: "NDIS Service Provider", category: "finance", trigger: "claim_cycle_due", autonomy: "auto-low-risk", risk: "high", workflow_type: "generic_operations", description: "Prepare, validate, submit, and reconcile claims.", approval_gates: ["high_value_claim_review"], kpis: ["claim_rejection_rate", "payment_turnaround"], steps: ["Centsible claim prep", "Veritas compliance", "Submission", "Payment reconciliation", "Statement delivery"] },
  { id: "ndis_compliance", name: "NDIS Compliance and Audit Prep", business_type: "NDIS Service Provider", category: "compliance", trigger: "scheduled_compliance_check", autonomy: "suggest", risk: "high", workflow_type: "document_ingestion", description: "Run checks and produce audit-ready evidence pack.", approval_gates: ["audit_submission_review"], kpis: ["compliance_score", "audit_readiness_time"], steps: ["Inspect compliance checks", "Veritas regulation update", "Atlas remediation", "Scribe evidence pack", "Sage scorecard"] },
  { id: "startup_outreach", name: "Startup Early Adopter Outreach", business_type: "New App or Startup", category: "growth", trigger: "launch_or_feature_release", autonomy: "auto-low-risk", risk: "low", workflow_type: "email_replies", description: "Discover and invite high-fit early adopters.", approval_gates: ["high_value_reply_review_optional"], kpis: ["invite_conversion_rate", "cac"], steps: ["Prospect lead list", "Part enrichment", "Maestro outreach draft", "Part send + track", "Support Sage follow-up"] },
  { id: "startup_content_flywheel", name: "Startup Content Marketing Flywheel", business_type: "New App or Startup", category: "growth", trigger: "weekly_content_cycle", autonomy: "auto-broad", risk: "low", workflow_type: "social_posting", description: "Publish recurring content flywheel with attribution.", approval_gates: [], kpis: ["organic_traffic", "signup_rate"], steps: ["Compass topic scan", "Sage prioritization", "Maestro content", "Canvas visuals", "Publish", "Inspect attribution"] },
];

function ensureAutonomyState() {
  const s = getState();
  if (!s.autonomy || typeof s.autonomy !== "object") {
    updateState((state) => {
      state.autonomy = { matrix: { ...DEFAULT_MATRIX }, updated_at: nowIso() };
    });
  }
}

export function inferWorkflowType(functionName = "", action = "") {
  const fn = String(functionName || "").toLowerCase();
  const a = String(action || "").toLowerCase();
  if (/social|campaign|post|reel|story|content/.test(a) || /maestro|canvas/.test(fn)) return "social_posting";
  if (/email|reply|inbox|ticket|support_connector/.test(a) || /supportsage|prospect/.test(fn)) return "email_replies";
  if (/document|ocr|intake|knowledge|scribe/.test(a) || /scribe/.test(fn)) return "document_ingestion";
  if (/shop|catalog|inventory|order|price|cart|merchant/.test(a) || /merchant/.test(fn)) return "shop_operations";
  return "generic_operations";
}

function riskForAction(action = "") {
  const a = String(action || "").toLowerCase();
  if (/delete|terminate|contract|legal|payment|invoice|refund|deploy|launch/.test(a)) return "high";
  if (/pricing|campaign|outreach|approval|security|policy/.test(a)) return "medium";
  return "low";
}

function tierRank(tier) {
  return TIERS.indexOf(tier);
}

function minTier(a, b) {
  const ai = tierRank(a);
  const bi = tierRank(b);
  return TIERS[Math.max(0, Math.min(ai, bi))] || "approve";
}

function connectorsReady(requiredKeys = []) {
  if (!requiredKeys.length) return { ready: true, missing: [] };
  const map = new Map((listConnectors().connectors || []).map((c) => [c.key, Boolean(c.ready)]));
  const missing = requiredKeys.filter((k) => !map.get(k));
  return { ready: missing.length === 0, missing };
}

export function getAutonomyMatrix() {
  ensureAutonomyState();
  const s = getState();
  const matrix = s.autonomy?.matrix || { ...DEFAULT_MATRIX };
  return { matrix, available_tiers: TIERS, updated_at: s.autonomy?.updated_at || nowIso(), timestamp: nowIso() };
}

export function setAutonomyMatrix(next = {}) {
  ensureAutonomyState();
  const safe = { ...DEFAULT_MATRIX };
  Object.keys(safe).forEach((k) => {
    const v = next?.[k];
    if (TIERS.includes(v)) safe[k] = v;
  });
  updateState((s) => {
    s.autonomy = { matrix: safe, updated_at: nowIso() };
  });
  return getAutonomyMatrix();
}

export function evaluateAutonomy(functionName = "", action = "") {
  const workflow = inferWorkflowType(functionName, action);
  const risk = riskForAction(action);
  const matrix = getAutonomyMatrix().matrix;
  const configuredTier = isSafeAutonomousAction(functionName, action)
    ? "auto-low-risk"
    : (matrix[workflow] || "approve");

  let effectiveTier = configuredTier;
  const reasons = [];

  const req = WORKFLOW_REQUIREMENTS[workflow] || [];
  const conn = connectorsReady(req);
  if (!conn.ready) {
    effectiveTier = minTier(effectiveTier, "approve");
    reasons.push(`Missing required connectors: ${conn.missing.join(", ")}`);
  }

  const slo = sloStatus();
  if (slo.status !== "healthy") {
    effectiveTier = minTier(effectiveTier, "approve");
    reasons.push("SLO degraded; forcing approval gate");
  }

  if (risk === "high") {
    effectiveTier = minTier(effectiveTier, "approve");
    reasons.push("High-risk action requires approval");
  }

  return {
    functionName,
    action,
    workflow,
    risk,
    configured_tier: configuredTier,
    effective_tier: effectiveTier,
    decision: effectiveTier,
    allow_autonomous: effectiveTier === "auto-low-risk" || effectiveTier === "auto-broad",
    requires_approval: effectiveTier === "approve",
    suggest_only: effectiveTier === "suggest",
    reasons,
    timestamp: nowIso(),
  };
}

export function workflowTemplates(filters = {}) {
  let templates = [...TEMPLATES];
  const businessType = String(filters?.business_type || "").trim().toLowerCase();
  const category = String(filters?.category || "").trim().toLowerCase();
  const q = String(filters?.q || "").trim().toLowerCase();

  if (businessType) templates = templates.filter((t) => String(t.business_type || "").toLowerCase().includes(businessType));
  if (category) templates = templates.filter((t) => String(t.category || "").toLowerCase() === category);
  if (q) templates = templates.filter((t) => [t.name, t.description, t.business_type, ...(t.steps || [])].join(" ").toLowerCase().includes(q));

  return { templates, count: templates.length, timestamp: nowIso() };
}

function triggerToUiTrigger(trigger = "") {
  const t = String(trigger || "").toLowerCase();
  if (/email|inquiry|reply|comment|dm/.test(t)) return "email_received";
  if (/lead|partner|outreach/.test(t)) return "new_lead";
  if (/schedule|weekly|monthly|deadline|cycle/.test(t)) return "schedule";
  return "manual";
}

function stepToAction(step = "") {
  const s = String(step || "").toLowerCase();
  if (/email|reply|outreach|acknowledgement|message/.test(s)) return "send_follow_up_email";
  if (/track|kpi|measure|report|analy/.test(s)) return "track_metric";
  if (/notify|alert|flag|escalat/.test(s)) return "notify_team";
  return "generate_insight";
}

function toWorkflowDraft(template) {
  const steps = Array.isArray(template?.steps) ? template.steps : [];
  const actions = steps.slice(0, 8).map((step) => ({ type: stepToAction(step), config: { note: step, category: "workflow" } }));
  return {
    name: template?.name || "Workflow Template",
    description: template?.description || "",
    trigger: triggerToUiTrigger(template?.trigger),
    actions: actions.length ? actions : [{ type: "generate_insight", config: { note: "Template run", category: "workflow" } }],
    status: "active",
    business_type: template?.business_type,
    risk: template?.risk,
    autonomy: template?.autonomy,
    template_id: template?.id,
    template_category: template?.category,
    approval_gates: template?.approval_gates || [],
    kpis: template?.kpis || [],
    created_from_template: true,
  };
}

export function findWorkflowTemplate(templateId = "") {
  const id = String(templateId || "").trim();
  return TEMPLATES.find((t) => t.id === id) || null;
}

export function instantiateWorkflowTemplate(templateId = "", overrides = {}) {
  const tpl = findWorkflowTemplate(templateId);
  if (!tpl) return null;
  const draft = toWorkflowDraft(tpl);
  return {
    template: tpl,
    workflow: {
      ...draft,
      ...(overrides && typeof overrides === "object" ? overrides : {}),
      name: overrides?.name || draft.name,
      description: overrides?.description || draft.description,
    },
    timestamp: nowIso(),
  };
}


