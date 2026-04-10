const RISKY = [/delete/i, /remove/i, /terminate/i, /deploy/i, /launch/i, /payment/i, /invoice/i, /contract/i, /legal/i, /shop_operations/i];
const DENY = [/exfiltrate/i, /bypass/i, /disable_security/i, /disable_guardrail/i, /override_policy/i];
const ALLOW_PREFIX = (process.env.POLICY_ALLOW_PREFIX || "").split(",").map((x) => x.trim()).filter(Boolean);
const AUTO_LOW_RISK = [
  /^command_center_full_self_test$/i,
  /^workflow_health$/i,
  /^atlas_full_self_test$/i,
  /^agent_registry_status$/i,
  /^market_briefing$/i,
  /^financial_health_check$/i,
];

const THRESHOLDS = {
  campaign_budget_auto_limit: Number(process.env.POLICY_CAMPAIGN_BUDGET_AUTO_LIMIT || 2000),
  outreach_recipient_auto_limit: Number(process.env.POLICY_OUTREACH_RECIPIENT_AUTO_LIMIT || 25),
  lead_batch_auto_limit: Number(process.env.POLICY_LEAD_BATCH_AUTO_LIMIT || 50),
  workflow_step_auto_limit: Number(process.env.POLICY_WORKFLOW_STEP_AUTO_LIMIT || 8),
  finance_amount_auto_limit: Number(process.env.POLICY_FINANCE_AMOUNT_AUTO_LIMIT || 10000),
  finance_variance_pct_limit: Number(process.env.POLICY_FINANCE_VARIANCE_PCT_LIMIT || 15),
  support_batch_auto_limit: Number(process.env.POLICY_SUPPORT_BATCH_AUTO_LIMIT || 30),
  docs_size_auto_limit: Number(process.env.POLICY_DOCS_SIZE_AUTO_LIMIT || 50000),
  commerce_amount_auto_limit: Number(process.env.POLICY_COMMERCE_AMOUNT_AUTO_LIMIT || 5000),
  legal_record_auto_limit: Number(process.env.POLICY_LEGAL_RECORD_AUTO_LIMIT || 5),
  partner_batch_auto_limit: Number(process.env.POLICY_PARTNER_BATCH_AUTO_LIMIT || 25),
  security_case_auto_limit: Number(process.env.POLICY_SECURITY_CASE_AUTO_LIMIT || 15),
  schedule_batch_auto_limit: Number(process.env.POLICY_SCHEDULE_BATCH_AUTO_LIMIT || 20),
  people_signal_auto_limit: Number(process.env.POLICY_PEOPLE_SIGNAL_AUTO_LIMIT || 25),
  strategy_scenario_auto_limit: Number(process.env.POLICY_STRATEGY_SCENARIO_AUTO_LIMIT || 5),
  creative_variant_auto_limit: Number(process.env.POLICY_CREATIVE_VARIANT_AUTO_LIMIT || 12),
  quality_suite_auto_limit: Number(process.env.POLICY_QUALITY_SUITE_AUTO_LIMIT || 20),
};

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function countRecipients(params = {}) {
  if (Array.isArray(params?.to)) return params.to.length;
  if (typeof params?.to === "string" && params.to.trim()) return 1;
  if (Array.isArray(params?.recipients)) return params.recipients.length;
  return numberOrZero(params?.recipient_count);
}

function countWorkflowSteps(params = {}) {
  if (Array.isArray(params?.steps)) return params.steps.length;
  if (Array.isArray(params?.dependencies)) return params.dependencies.length;
  return numberOrZero(params?.step_count || params?.task_count || params?.dependency_count);
}

function thresholdDecision(action = "", params = {}) {
  const a = String(action || "").toLowerCase();
  if (AUTO_LOW_RISK.some((re) => re.test(a))) {
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Low-risk operational action auto-approved" };
  }
  if (/(campaign_orchestration|lifecycle_automation|creative_brief_generation|ab_test_planning|performance_scorecard)/.test(a)) {
    const budget = numberOrZero(params?.budget);
    if (budget > THRESHOLDS.campaign_budget_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Campaign budget exceeds auto-approval limit (${THRESHOLDS.campaign_budget_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Campaign action within bounded auto-approval policy" };
  }
  if (/(lead_discovery|lead_scoring|profile_enrichment)/.test(a)) {
    const leadCount = Math.max(numberOrZero(params?.lead_count), numberOrZero(params?.count));
    if (leadCount > THRESHOLDS.lead_batch_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Lead batch exceeds auto-approval limit (${THRESHOLDS.lead_batch_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Prospecting batch within bounded auto-approval policy" };
  }
  if (/(outreach_drafting|email_replies)/.test(a)) {
    const recipients = countRecipients(params);
    if (recipients > THRESHOLDS.outreach_recipient_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Recipient volume exceeds auto-approval limit (${THRESHOLDS.outreach_recipient_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Message volume within bounded auto-approval policy" };
  }
  if (/(start_workflow|workflow_automation|task_routing|dependency_tracking|capacity_planning|workflow_health|cross_agent_insights|business_health_score|alert_correlation|intent_routing)/.test(a)) {
    const steps = countWorkflowSteps(params);
    if (steps > THRESHOLDS.workflow_step_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Workflow complexity exceeds auto-approval limit (${THRESHOLDS.workflow_step_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Workflow operation within bounded auto-approval policy" };
  }
  if (/(cash_flow_forecast|budget_variance|anomaly_detection|runway_estimation|revenue_leakage_scan|financial_health_check)/.test(a)) {
    const variance = Math.abs(numberOrZero(params?.variance_pct));
    if (/budget_variance/.test(a) && variance > THRESHOLDS.finance_variance_pct_limit) {
      return { allow: true, requiresApproval: true, reason: "Finance variance exceeds bounded auto-approval policy" };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Finance action within bounded auto-approval policy" };
  }
  if (/(ticket_triage|response_recommendation|sentiment_analysis|sla_monitoring|csat_driver_analysis)/.test(a)) {
    const ticketCount = Math.max(numberOrZero(params?.ticket_count), numberOrZero(params?.count), countRecipients(params));
    if (ticketCount > THRESHOLDS.support_batch_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Support volume exceeds auto-approval limit (${THRESHOLDS.support_batch_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Support action within bounded auto-approval policy" };
  }
  if (/(knowledge_capture|document_structuring|sop_generation|semantic_retrieval|audit_trail_export|market_briefing|competitor_tracking|trend_detection|sentiment_signal_read|opportunity_alerting)/.test(a)) {
    const size = Math.max(numberOrZero(params?.size), String(params?.content || params?.text || params?.user_request || "").length);
    if (size > THRESHOLDS.docs_size_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Document or briefing size exceeds auto-approval limit (${THRESHOLDS.docs_size_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Knowledge action within bounded auto-approval policy" };
  }
  if (/(catalog_health|inventory_risk|pricing_intelligence|conversion_optimization|store_health)/.test(a)) {
    const amount = Math.max(numberOrZero(params?.price), numberOrZero(params?.total), numberOrZero(params?.average_order_value));
    if (amount > THRESHOLDS.commerce_amount_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Commerce amount exceeds auto-approval limit (${THRESHOLDS.commerce_amount_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Commerce action within bounded auto-approval policy" };
  }
  if (/(contract_risk_review|compliance_audit|obligation_tracking|policy_update_check|legal_risk_register)/.test(a)) {
    const records = Math.max(numberOrZero(params?.contract_count), numberOrZero(params?.record_count), 1);
    const highRisk = /high|critical/i.test(String(params?.risk || ""));
    if (records > THRESHOLDS.legal_record_auto_limit || highRisk) {
      return { allow: true, requiresApproval: true, reason: "Legal review exceeds bounded auto-approval policy" };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Legal action within bounded auto-approval policy" };
  }
  if (/(threat_scan|incident_triage|vulnerability_review|security_posture_report|response_playbook)/.test(a)) {
    const count = Math.max(numberOrZero(params?.case_count), numberOrZero(params?.count), 1);
    const highSeverity = /critical/i.test(String(params?.severity || ""));
    if (count > THRESHOLDS.security_case_auto_limit || highSeverity) {
      return { allow: true, requiresApproval: true, reason: "Security action exceeds bounded auto-approval policy" };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Security action within bounded auto-approval policy" };
  }
  if (/(smart_scheduling|focus_blocking|meeting_load_audit|deadline_alignment|weekly_time_report)/.test(a)) {
    const count = Math.max(numberOrZero(params?.schedule_count), countWorkflowSteps(params), 1);
    if (count > THRESHOLDS.schedule_batch_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Scheduling volume exceeds auto-approval limit (${THRESHOLDS.schedule_batch_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Scheduling action within bounded auto-approval policy" };
  }
  if (/(sentiment_monitor|burnout_risk_detection|retention_risk|recognition_insights|people_analytics)/.test(a)) {
    const count = Math.max(numberOrZero(params?.employee_count), numberOrZero(params?.signal_count), 1);
    if (count > THRESHOLDS.people_signal_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `People analytics volume exceeds auto-approval limit (${THRESHOLDS.people_signal_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "People action within bounded auto-approval policy" };
  }
  if (/(partner_discovery|relationship_scoring|co_marketing_planning|alliance_pipeline|partner_roi_review)/.test(a)) {
    const count = Math.max(numberOrZero(params?.partner_count), numberOrZero(params?.count), 1);
    if (count > THRESHOLDS.partner_batch_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Partner volume exceeds auto-approval limit (${THRESHOLDS.partner_batch_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Partnership action within bounded auto-approval policy" };
  }
  if (/(strategy_scorecard|scenario_modeling|opportunity_mapping|risk_tradeoff_analysis|strategic_briefing)/.test(a)) {
    const scenarios = Math.max(numberOrZero(params?.scenario_count), numberOrZero(params?.count), 1);
    if (scenarios > THRESHOLDS.strategy_scenario_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Strategy scenario volume exceeds auto-approval limit (${THRESHOLDS.strategy_scenario_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Strategy action within bounded auto-approval policy" };
  }
  if (/(creative_generation|cinematic_video_command|voiceover_generation|brand_compliance|format_adaptation|variant_testing|creative_performance)/.test(a)) {
    const variants = Math.max(numberOrZero(params?.variant_count), numberOrZero(params?.count), 1);
    if (variants > THRESHOLDS.creative_variant_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Creative volume exceeds auto-approval limit (${THRESHOLDS.creative_variant_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Creative action within bounded auto-approval policy" };
  }
  if (/(test_orchestration|regression_scan|quality_gate|root_cause_analysis|defect_trend_report)/.test(a)) {
    const suites = Math.max(numberOrZero(params?.suite_count), numberOrZero(params?.count), 1);
    if (suites > THRESHOLDS.quality_suite_auto_limit) {
      return { allow: true, requiresApproval: true, reason: `Quality suite volume exceeds auto-approval limit (${THRESHOLDS.quality_suite_auto_limit})` };
    }
    return { allow: true, requiresApproval: false, autoApproved: true, reason: "Quality action within bounded auto-approval policy" };
  }
  return null;
}

export function checkPolicy(functionName, action, user, context = {}) {
  const key = String(functionName || "") + ":" + String(action || "run");
  if (ALLOW_PREFIX.length && !ALLOW_PREFIX.some((p) => key.startsWith(p))) {
    return { allow: false, reason: "Action not in allowlist prefix policy" };
  }
  if (DENY.some((re) => re.test(key))) return { allow: false, reason: "Blocked by policy" };
  const risky = RISKY.some((re) => re.test(String(action || "")));
  const approvalsOn = String(process.env.APPROVALS_REQUIRED_FOR_RISKY || "true") === "true";

  const strictTenant = String(process.env.TENANT_ISOLATION_REQUIRED || "false") === "true";
  if (strictTenant) {
    const requestTenant = String(context?.tenant_id || "");
    const userTenant = String(user?.tenant_id || "");
    if (!requestTenant || !userTenant || requestTenant !== userTenant) {
      return { allow: false, reason: "Tenant isolation check failed" };
    }
  }

  const threshold = thresholdDecision(action, context?.params || {});
  if (threshold) return threshold;

  if (risky && approvalsOn && user?.role !== "super_admin") {
    return { allow: true, requiresApproval: true, reason: "Risky action requires approval" };
  }
  return { allow: true, requiresApproval: false };
}

export function redact(value) {
  const text = JSON.stringify(value || {});
  return JSON.parse(
    text
      .replace(/(token"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(api_key"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(refresh_token"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(client_secret"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(secret"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(password"\s*:\s*")[^"]+/gi, "$1***")
      .replace(/(authorization"\s*:\s*")[^"]+/gi, "$1***")
  );
}
