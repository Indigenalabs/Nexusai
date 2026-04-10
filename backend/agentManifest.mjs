const UNIVERSAL_OPERATION_CAPABILITIES = [
  { id: "api_registry", label: "API Registry", impact: "high", action: "api_registry" },
  { id: "workflow_packs", label: "Workflow Packs", impact: "high", action: "workflow_packs" },
  { id: "ops_cockpit", label: "Ops Cockpit", impact: "high", action: "ops_cockpit" },
  { id: "advanced_runbooks", label: "Advanced Runbooks", impact: "high", action: "advanced_runbooks" },
  { id: "live_execution_console", label: "Live Execution Console", impact: "high", action: "live_execution_console" },
  { id: "deterministic_action_runner", label: "Deterministic Action Runner", impact: "high", action: "deterministic_action_runner" },
  { id: "reliability_snapshot", label: "Reliability Snapshot", impact: "high", action: "reliability_snapshot" },
  { id: "dead_letter_queue", label: "Dead-Letter Queue", impact: "high", action: "dead_letter_queue" },
  { id: "release_gate", label: "Release Gate", impact: "high", action: "release_gate" },
  { id: "autonomy_escalation_guardrails", label: "Autonomy Escalation Guardrails", impact: "high", action: "autonomy_escalation_guardrails" },
  { id: "promotion_history_rollback", label: "Promotion History & Rollback", impact: "high", action: "promotion_history_rollback" },
  { id: "ops_timeline", label: "Ops Timeline", impact: "medium", action: "ops_timeline" },
  { id: "documents_upload", label: "Document Uploads", impact: "high", action: "documents_upload" },
  { id: "email_configuration", label: "Email Configuration", impact: "high", action: "email_configuration" },
  { id: "connector_health", label: "Connector Health", impact: "high", action: "connector_health" },
  { id: "connector_credentials", label: "Connector Credentials", impact: "high", action: "connector_credentials" },
  { id: "approval_queue", label: "Approval Queue", impact: "high", action: "approval_queue" },
  { id: "mode_plan", label: "Plan Mode", impact: "medium", action: "mode_plan" },
  { id: "mode_simulate", label: "Simulate Mode", impact: "medium", action: "mode_simulate" },
  { id: "mode_execute", label: "Execute Mode", impact: "medium", action: "mode_execute" },
  { id: "execution_receipts", label: "Execution Receipts", impact: "medium", action: "execution_receipts" },
  { id: "kpi_lens", label: "KPI Lens", impact: "medium", action: "kpi_lens" },
  { id: "alerting_rules", label: "Alerting Rules", impact: "medium", action: "alerting_rules" },
  { id: "audit_export", label: "Audit Export", impact: "medium", action: "audit_export" },
  { id: "cross_agent_handoff", label: "Cross-Agent Handoff", impact: "high", action: "cross_agent_handoff" },
];

const BASE_AGENT_DEFINITIONS = [
  {
    name: "Nexus",
    domain: "Command",
    role: "Unified Orchestrator",
    tagline: "I see the whole board. You focus on the moves.",
    functionName: "commandCenterIntelligence",
    capabilities: [
      { id: "intent_routing", label: "Intent Routing", impact: "high", action: "intent_routing" },
      { id: "full_self_test", label: "Full Self Test", impact: "high", action: "command_center_full_self_test" },
      { id: "workflow_launch", label: "Workflow Launch", impact: "high", action: "start_workflow" },
      { id: "registry_status", label: "Registry Status", impact: "medium", action: "agent_registry_status" },
      { id: "strategic_briefing", label: "Strategic Briefing", impact: "medium", action: "intent_routing" },
    ],
  },
  {
    name: "Maestro",
    domain: "Growth",
    role: "Marketing Virtuoso",
    tagline: "Every campaign is a symphony. I conduct it.",
    functionName: "maestroSocialOps",
    capabilities: [
      { id: "campaign_orchestration", label: "Campaign Orchestration", impact: "high", action: "campaign_orchestration" },
      { id: "lifecycle_automation", label: "Lifecycle Automation", impact: "high", action: "lifecycle_automation" },
      { id: "creative_brief_generation", label: "Creative Brief Generation", impact: "medium", action: "creative_brief_generation" },
      { id: "ab_test_planning", label: "A/B Test Planning", impact: "medium", action: "ab_test_planning" },
      { id: "performance_scorecard", label: "Performance Scorecard", impact: "high", action: "performance_scorecard" },
    ],
  },
  {
    name: "Prospect",
    domain: "Growth",
    role: "Lead Hunter",
    tagline: "I never stop looking. Your next customer is out there.",
    functionName: "prospectLeadGeneration",
    capabilities: [
      { id: "lead_discovery", label: "Lead Discovery", impact: "high", action: "lead_discovery" },
      { id: "lead_scoring", label: "Lead Scoring", impact: "high", action: "lead_scoring" },
      { id: "profile_enrichment", label: "Profile Enrichment", impact: "medium", action: "profile_enrichment" },
      { id: "outreach_drafting", label: "Outreach Drafting", impact: "high", action: "outreach_drafting" },
      { id: "pipeline_analytics", label: "Pipeline Analytics", impact: "high", action: "pipeline_analytics" },
    ],
  },
  {
    name: "Support Sage",
    domain: "Customers",
    role: "Customer Experience",
    tagline: "Here for you. Here for them. Always with a solution.",
    functionName: "supportSageCustomerService",
    capabilities: [
      { id: "ticket_triage", label: "Ticket Triage", impact: "high", action: "ticket_triage" },
      { id: "response_recommendation", label: "Response Recommendation", impact: "high", action: "response_recommendation" },
      { id: "sentiment_analysis", label: "Sentiment Analysis", impact: "medium", action: "sentiment_analysis" },
      { id: "sla_monitoring", label: "SLA Monitoring", impact: "high", action: "sla_monitoring" },
      { id: "csat_driver_analysis", label: "CSAT Driver Analysis", impact: "medium", action: "csat_driver_analysis" },
    ],
  },
  {
    name: "Centsible",
    domain: "Finance",
    role: "Numbers Whisperer",
    tagline: "I speak fluent finance. You speak ambition.",
    functionName: "centsibleFinanceEngine",
    capabilities: [
      { id: "cash_flow_forecast", label: "Cash Flow Forecast", impact: "high", action: "cash_flow_forecast" },
      { id: "budget_variance", label: "Budget Variance", impact: "high", action: "budget_variance" },
      { id: "anomaly_detection", label: "Anomaly Detection", impact: "high", action: "anomaly_detection" },
      { id: "runway_estimation", label: "Runway Estimation", impact: "high", action: "runway_estimation" },
      { id: "revenue_leakage_scan", label: "Revenue Leakage Scan", impact: "medium", action: "revenue_leakage_scan" },
    ],
  },
  {
    name: "Sage",
    domain: "Strategy",
    role: "Strategic Visionary",
    tagline: "I see around corners. You make the call.",
    functionName: "sageBussinessStrategy",
    capabilities: [
      { id: "strategy_scorecard", label: "Strategy Scorecard", impact: "high", action: "strategy_scorecard" },
      { id: "scenario_modeling", label: "Scenario Modeling", impact: "high", action: "scenario_modeling" },
      { id: "opportunity_mapping", label: "Opportunity Mapping", impact: "medium", action: "opportunity_mapping" },
      { id: "risk_tradeoff_analysis", label: "Risk Tradeoff Analysis", impact: "medium", action: "risk_tradeoff_analysis" },
      { id: "strategic_briefing", label: "Strategic Briefing", impact: "high", action: "strategic_briefing" },
    ],
  },
  {
    name: "Chronos",
    domain: "Operations",
    role: "Time Master",
    tagline: "Time is your only non-renewable resource. I protect it.",
    functionName: "chronosSchedulingEngine",
    capabilities: [
      { id: "smart_scheduling", label: "Smart Scheduling", impact: "high", action: "smart_scheduling" },
      { id: "focus_blocking", label: "Focus Blocking", impact: "medium", action: "focus_blocking" },
      { id: "meeting_load_audit", label: "Meeting Load Audit", impact: "medium", action: "meeting_load_audit" },
      { id: "deadline_alignment", label: "Deadline Alignment", impact: "high", action: "deadline_alignment" },
      { id: "weekly_time_report", label: "Weekly Time Report", impact: "medium", action: "weekly_time_report" },
    ],
  },
  {
    name: "Atlas",
    domain: "Operations",
    role: "Backbone of Operations",
    tagline: "Every task in its place. Every process running smoothly.",
    functionName: "atlasWorkflowAutomation",
    capabilities: [
      { id: "workflow_automation", label: "Workflow Automation", impact: "high", action: "workflow_automation" },
      { id: "task_routing", label: "Task Routing", impact: "high", action: "task_routing" },
      { id: "dependency_tracking", label: "Dependency Tracking", impact: "medium", action: "dependency_tracking" },
      { id: "capacity_planning", label: "Capacity Planning", impact: "high", action: "capacity_planning" },
      { id: "ops_status_briefing", label: "Ops Status Briefing", impact: "medium", action: "status_briefing" },
    ],
  },
  {
    name: "Scribe",
    domain: "Knowledge",
    role: "Collective Memory",
    tagline: "If it happened, it is remembered. If it matters, it is findable.",
    functionName: "scribeKnowledgeBase",
    capabilities: [
      { id: "knowledge_capture", label: "Knowledge Capture", impact: "high", action: "knowledge_capture" },
      { id: "document_structuring", label: "Document Structuring", impact: "medium", action: "document_structuring" },
      { id: "sop_generation", label: "SOP Generation", impact: "high", action: "sop_generation" },
      { id: "semantic_retrieval", label: "Semantic Retrieval", impact: "high", action: "semantic_retrieval" },
      { id: "audit_trail_export", label: "Audit Trail Export", impact: "medium", action: "audit_trail_export" },
    ],
  },
  {
    name: "Sentinel",
    domain: "Security",
    role: "Silent Guardian",
    tagline: "I watch while you sleep. You wake up safe.",
    functionName: "sentinelSecurityMonitoring",
    capabilities: [
      { id: "threat_scan", label: "Threat Scan", impact: "high", action: "threat_scan" },
      { id: "incident_triage", label: "Incident Triage", impact: "high", action: "incident_triage" },
      { id: "vulnerability_review", label: "Vulnerability Review", impact: "high", action: "vulnerability_review" },
      { id: "security_posture_report", label: "Security Posture Report", impact: "medium", action: "security_posture_report" },
      { id: "response_playbook", label: "Response Playbook", impact: "medium", action: "response_playbook" },
    ],
  },
  {
    name: "Compass",
    domain: "Intelligence",
    role: "Market Navigator",
    tagline: "I read the wind. You set the sails.",
    functionName: "compassMarketIntelligence",
    capabilities: [
      { id: "market_briefing", label: "Market Briefing", impact: "high", action: "market_briefing" },
      { id: "competitor_tracking", label: "Competitor Tracking", impact: "high", action: "competitor_tracking" },
      { id: "trend_detection", label: "Trend Detection", impact: "medium", action: "trend_detection" },
      { id: "sentiment_signal_read", label: "Sentiment Signal Read", impact: "medium", action: "sentiment_signal_read" },
      { id: "opportunity_alerting", label: "Opportunity Alerting", impact: "high", action: "opportunity_alerting" },
    ],
  },
  {
    name: "Part",
    domain: "Growth",
    role: "Partnership Connector",
    tagline: "Your network is your net worth. I make it grow.",
    functionName: "partPartnershipEngine",
    capabilities: [
      { id: "partner_discovery", label: "Partner Discovery", impact: "high", action: "partner_discovery" },
      { id: "relationship_scoring", label: "Relationship Scoring", impact: "medium", action: "relationship_scoring" },
      { id: "co_marketing_planning", label: "Co-Marketing Planning", impact: "medium", action: "co_marketing_planning" },
      { id: "alliance_pipeline", label: "Alliance Pipeline", impact: "high", action: "alliance_pipeline" },
      { id: "partner_roi_review", label: "Partner ROI Review", impact: "high", action: "partner_roi_review" },
    ],
  },
  {
    name: "Pulse",
    domain: "People",
    role: "Team Heartbeat",
    tagline: "Happy teams build great things. I keep the pulse.",
    functionName: "pulseHREngine",
    capabilities: [
      { id: "sentiment_monitor", label: "Sentiment Monitor", impact: "high", action: "sentiment_monitor" },
      { id: "burnout_risk_detection", label: "Burnout Risk Detection", impact: "high", action: "burnout_risk_detection" },
      { id: "retention_risk", label: "Retention Risk", impact: "medium", action: "retention_risk" },
      { id: "recognition_insights", label: "Recognition Insights", impact: "low", action: "recognition_insights" },
      { id: "people_analytics", label: "People Analytics", impact: "medium", action: "people_analytics" },
    ],
  },
  {
    name: "Merchant",
    domain: "Commerce",
    role: "Storekeeper",
    tagline: "Your products, your customers, your revenue. I keep it moving.",
    functionName: "merchantProductManagement",
    capabilities: [
      { id: "catalog_health", label: "Catalog Health", impact: "medium", action: "catalog_health" },
      { id: "inventory_risk", label: "Inventory Risk", impact: "high", action: "inventory_risk" },
      { id: "pricing_intelligence", label: "Pricing Intelligence", impact: "high", action: "pricing_intelligence" },
      { id: "conversion_optimization", label: "Conversion Optimization", impact: "high", action: "conversion_optimization" },
      { id: "store_health", label: "Store Health", impact: "medium", action: "store_health" },
    ],
  },
  {
    name: "Canvas",
    domain: "Creative",
    role: "Visual Poet",
    tagline: "I paint your ideas. You provide the vision.",
    functionName: "canvasCreativeGeneration",
    capabilities: [
      { id: "creative_generation", label: "Creative Generation", impact: "high", action: "creative_generation" },
      { id: "cinematic_video_command", label: "Cinematic Video Command", impact: "high", action: "cinematic_video_command" },
      { id: "voiceover_generation", label: "Voiceover Generation", impact: "medium", action: "voiceover_generation" },
      { id: "brand_compliance", label: "Brand Compliance", impact: "high", action: "brand_compliance" },
      { id: "format_adaptation", label: "Format Adaptation", impact: "medium", action: "format_adaptation" },
      { id: "variant_testing", label: "Variant Testing", impact: "medium", action: "variant_testing" },
      { id: "creative_performance", label: "Creative Performance", impact: "high", action: "creative_performance" },
    ],
  },
  {
    name: "Inspect",
    domain: "Quality",
    role: "Quality Enforcer",
    tagline: "I break things so your customers do not have to.",
    functionName: "inspectQualityEngine",
    capabilities: [
      { id: "test_orchestration", label: "Test Orchestration", impact: "high", action: "test_orchestration" },
      { id: "regression_scan", label: "Regression Scan", impact: "high", action: "regression_scan" },
      { id: "quality_gate", label: "Quality Gate", impact: "high", action: "quality_gate" },
      { id: "root_cause_analysis", label: "Root Cause Analysis", impact: "medium", action: "root_cause_analysis" },
      { id: "defect_trend_report", label: "Defect Trend Report", impact: "medium", action: "defect_trend_report" },
    ],
  },
  {
    name: "Veritas",
    domain: "Legal",
    role: "Guardian of Truth",
    tagline: "In compliance we trust. In contracts we verify.",
    functionName: "veritasComplianceValidation",
    capabilities: [
      { id: "contract_risk_review", label: "Contract Risk Review", impact: "high", action: "contract_risk_review" },
      { id: "compliance_audit", label: "Compliance Audit", impact: "high", action: "compliance_audit" },
      { id: "obligation_tracking", label: "Obligation Tracking", impact: "medium", action: "obligation_tracking" },
      { id: "policy_update_check", label: "Policy Update Check", impact: "medium", action: "policy_update_check" },
      { id: "legal_risk_register", label: "Legal Risk Register", impact: "high", action: "legal_risk_register" },
    ],
  },
];

const MIN_CAPABILITIES_PER_AGENT = 30;

function mergeCapabilities(core = [], universal = []) {
  const seen = new Set();
  const merged = [];
  [...core, ...universal].forEach((cap) => {
    const key = cap.action || cap.id;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(cap);
  });
  if (merged.length < MIN_CAPABILITIES_PER_AGENT) {
    let idx = 1;
    while (merged.length < MIN_CAPABILITIES_PER_AGENT) {
      const cap = {
        id: `extended_capability_${idx}`,
        label: `Extended Capability ${idx}`,
        impact: "medium",
        action: `extended_capability_${idx}`,
      };
      if (!seen.has(cap.action)) {
        seen.add(cap.action);
        merged.push(cap);
      }
      idx += 1;
    }
  }
  return merged.slice(0, MIN_CAPABILITIES_PER_AGENT);
}

export const AGENT_MANIFEST = BASE_AGENT_DEFINITIONS.map((agent) => ({
  ...agent,
  capabilities: mergeCapabilities(agent.capabilities || [], UNIVERSAL_OPERATION_CAPABILITIES),
}));

export const AGENT_INDEX = Object.fromEntries(AGENT_MANIFEST.map((agent) => [agent.name, agent]));
export const FUNCTION_BY_AGENT = Object.fromEntries(AGENT_MANIFEST.map((agent) => [agent.name, agent.functionName]));
export const AGENT_BY_FUNCTION = Object.fromEntries(AGENT_MANIFEST.map((agent) => [agent.functionName, agent.name]));

export function getAgentByName(name) {
  return AGENT_INDEX[name] || null;
}
