import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // ── Shared data loaders ──────────────────────────────────────────────────
    const loadActivities = () => base44.asServiceRole.entities.Activity.list('-created_date', 50).catch(() => []);
    const loadTasks = () => base44.asServiceRole.entities.Task.list('-created_date', 100).catch(() => []);
    const loadLeads = () => base44.asServiceRole.entities.Lead.list('-created_date', 100).catch(() => []);
    const loadInsights = () => base44.asServiceRole.entities.Insight.list('-created_date', 30).catch(() => []);
    const loadMetrics = () => base44.asServiceRole.entities.Metric.list('-created_date', 50).catch(() => []);
    const loadWorkflows = () => base44.asServiceRole.entities.Workflow.list('-created_date', 30).catch(() => []);
    const loadNotifications = () => base44.asServiceRole.entities.Notification.list('-created_date', 30).catch(() => []);
    const loadTeam = () => base44.asServiceRole.entities.TeamMember.list('-created_date', 50).catch(() => []);
    const loadClients = () => base44.asServiceRole.entities.Client.list('-created_date', 50).catch(() => []);
    const loadPartners = () => base44.asServiceRole.entities.Partner.list('-created_date', 30).catch(() => []);
    const loadInvoices = () => base44.asServiceRole.entities.Invoice.list('-created_date', 30).catch(() => []);
    const loadReports = () => base44.asServiceRole.entities.Report.list('-created_date', 10).catch(() => []);

    let result = null;

    // ── 1. BUSINESS HEALTH SCORE ─────────────────────────────────────────────
    if (action === 'business_health_score') {
      const [activities, tasks, leads, team, invoices, notifications] = await Promise.all([
        loadActivities(), loadTasks(), loadLeads(), loadTeam(), loadInvoices(), loadNotifications()
      ]);

      const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      const criticalTasks = tasks.filter(t => t.priority === 'critical' && (t.status === 'pending' || t.status === 'in_progress')).length;
      const hotLeads = leads.filter(l => (l.score || 0) >= 80).length;
      const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
      const atRiskTeam = team.filter(m => m.wellbeing_status === 'at_risk').length;
      const urgentNotifs = notifications.filter(n => !n.is_read && n.priority === 'critical').length;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate an overall Business Health Score (0-100) for this organization based on the following cross-domain signals.

OPERATIONAL SIGNALS:
- Open tasks: ${openTasks} (${criticalTasks} critical)
- Hot leads awaiting contact: ${hotLeads}
- Overdue invoices: ${overdueInvoices}
- Team members at wellbeing risk: ${atRiskTeam}
- Unread critical alerts: ${urgentNotifs}
- Recent activities (last 50): ${activities.length} logged

DOMAIN SCORES (assess each 0-100):
- Financial Health: based on overdue invoices (${overdueInvoices}) and financial activity
- Sales & Pipeline: based on lead volume (${leads.length}) and hot leads (${hotLeads})
- Operations: based on task completion (${openTasks} open, ${criticalTasks} critical)
- People: based on team wellbeing (${atRiskTeam} at risk out of ${team.length})
- Compliance & Risk: based on critical alerts (${urgentNotifs} unread critical notifications)

Calculate:
1. Overall health score (0-100) — weighted average
2. Scores per domain
3. Primary risk factor dragging score down
4. Primary strength holding score up
5. Score trend: stable / improving / declining (assess from available signals)
6. Top 3 actions to improve score this week`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            score_label: { type: 'string' },
            trend: { type: 'string' },
            domain_scores: { type: 'object', properties: {
              financial: { type: 'number' },
              sales_pipeline: { type: 'number' },
              operations: { type: 'number' },
              people: { type: 'number' },
              compliance_risk: { type: 'number' }
            }},
            primary_risk: { type: 'string' },
            primary_strength: { type: 'string' },
            top_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 2. CROSS-AGENT INSIGHTS ──────────────────────────────────────────────
    if (action === 'cross_agent_insights') {
      const [activities, insights, leads, tasks, team, invoices] = await Promise.all([
        loadActivities(), loadInsights(), loadLeads(), loadTasks(), loadTeam(), loadInvoices()
      ]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the Command Center AI. Generate 5 high-value cross-domain insights — patterns that no single agent could detect alone.

Cross-domain data:
ACTIVITIES (recent ${activities.length}): ${JSON.stringify(activities.slice(0, 20).map(a => ({ type: a.type, title: a.title, description: a.description?.slice(0, 80) })))}
INSIGHTS (recent ${insights.length}): ${JSON.stringify(insights.slice(0, 15).map(i => ({ title: i.title, category: i.category, description: i.description?.slice(0, 80) })))}
LEADS: ${leads.length} total, ${leads.filter(l => (l.score || 0) >= 80).length} hot, sources: ${[...new Set(leads.map(l => l.source).filter(Boolean))].join(', ')}
TASKS: ${tasks.length} total, ${tasks.filter(t => t.status === 'pending').length} pending, ${tasks.filter(t => t.priority === 'critical').length} critical
TEAM: ${team.length} members, ${team.filter(m => m.wellbeing_status === 'at_risk').length} at risk
INVOICES: ${invoices.filter(i => i.status === 'overdue').length} overdue of ${invoices.length} total

Generate 5 insights that connect patterns ACROSS multiple domains. Each insight should:
- Reference 2+ different agent domains
- Reveal a non-obvious connection or causal relationship
- Include a specific recommended action
- Estimate the business impact

Examples of the type of insight to generate:
- 'When sales pipeline is strong but team wellbeing is low, conversion rates drop — correlation between Prospect and Pulse'
- 'Overdue invoices spike correlates with increased support tickets — Centsible + Support Sage pattern'
- 'High-performing leads from referral partners are 3x more likely to convert — Part + Prospect analysis'`,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' },
              domains_involved: { type: 'array', items: { type: 'string' } },
              observation: { type: 'string' },
              recommended_action: { type: 'string' },
              estimated_impact: { type: 'string' },
              confidence: { type: 'string' }
            }}}
          }
        }
      });

      // Persist top insights
      if (result?.insights?.length > 0) {
        for (const insight of result.insights.slice(0, 3)) {
          await base44.asServiceRole.entities.Insight.create({
            title: insight.title,
            description: insight.observation,
            category: 'cross_agent',
            status: 'new',
            priority: 'high',
            action_required: insight.recommended_action
          }).catch(() => null);
        }
      }
    }

    // ── 3. CAUSAL ANALYSIS ───────────────────────────────────────────────────
    if (action === 'causal_analysis') {
      const { effect_to_analyze } = params;
      const [activities, tasks, leads] = await Promise.all([loadActivities(), loadTasks(), loadLeads()]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct a causal inference analysis for the Command Center.

Effect to analyze: ${effect_to_analyze || 'recent changes in business performance'}

Available cross-domain data:
- Recent activities: ${JSON.stringify(activities.slice(0, 20).map(a => ({ type: a.type, title: a.title, date: a.created_date })))}
- Task patterns: ${tasks.filter(t => t.status === 'completed').length} completed, ${tasks.filter(t => t.status === 'pending').length} pending
- Lead patterns: ${leads.length} total, ${leads.filter(l => (l.score || 0) >= 80).length} hot

Causal analysis:
1. Identify the most likely root cause(s)
2. Map the causal chain across domains (e.g., marketing change → lead quality → sales conversion → revenue)
3. Identify confounding factors
4. Estimate causation strength (strong / moderate / weak / correlation only)
5. Recommend interventions at the causal root, not the symptom
6. Suggest what data to monitor to confirm the causal relationship`,
        response_json_schema: {
          type: 'object',
          properties: {
            root_causes: { type: 'array', items: { type: 'object', properties: { cause: { type: 'string' }, causation_strength: { type: 'string' }, evidence: { type: 'string' } } } },
            causal_chain: { type: 'string' },
            confounding_factors: { type: 'array', items: { type: 'string' } },
            root_interventions: { type: 'array', items: { type: 'string' } },
            monitoring_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 4. SCENARIO MODELING ─────────────────────────────────────────────────
    if (action === 'scenario_modeling') {
      const { scenario, variables } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a multi-agent scenario model for the Command Center.

Scenario: ${scenario || 'assess impact of proposed business change'}
Variables to model: ${JSON.stringify(variables || {})}

Model this scenario across ALL business domains:

**Financial Impact (Centsible):**
- Revenue effect: optimistic / base / pessimistic
- Cost implications
- Cash flow timeline
- Break-even analysis

**Sales & Pipeline (Prospect + Merchant):**
- Lead volume effect
- Conversion rate impact
- Revenue pipeline change

**Marketing (Maestro + Canvas):**
- Budget requirements
- Campaign implications
- Brand impact

**Operations (Atlas + Chronos):**
- Capacity requirements
- Workflow changes needed
- Timeline feasibility

**People (Pulse):**
- Headcount implications
- Skills required
- Team change impact

**Risk & Compliance (Sentinel + Veritas):**
- Legal/regulatory considerations
- Risk profile change
- Compliance requirements

**Recommendation:** Go / No-go / Modify — with specific conditions`,
        response_json_schema: {
          type: 'object',
          properties: {
            scenario_summary: { type: 'string' },
            domain_impacts: { type: 'object' },
            financial_model: { type: 'object', properties: {
              optimistic_revenue: { type: 'number' }, base_revenue: { type: 'number' }, pessimistic_revenue: { type: 'number' }, break_even_timeline: { type: 'string' }
            }},
            key_risks: { type: 'array', items: { type: 'string' } },
            key_opportunities: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            conditions_for_go: { type: 'array', items: { type: 'string' } },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 5. STRATEGIC BRIEF ───────────────────────────────────────────────────
    if (action === 'strategic_brief') {
      const { brief_type = 'daily', audience = 'leadership' } = params;
      const [activities, insights, tasks, leads, team, invoices, partners] = await Promise.all([
        loadActivities(), loadInsights(), loadTasks(), loadLeads(), loadTeam(), loadInvoices(), loadPartners()
      ]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a ${brief_type} strategic briefing for ${audience}.

Cross-domain business data:
ACTIVITIES (last 50): ${JSON.stringify(activities.slice(0, 20).map(a => ({ type: a.type, title: a.title })))}
INSIGHTS: ${insights.length} recorded, ${insights.filter(i => i.status === 'new').length} new
TASKS: ${tasks.length} total, ${tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length} critical open
LEADS: ${leads.length} total, ${leads.filter(l => (l.score || 0) >= 80).length} hot
TEAM: ${team.length} members, ${team.filter(m => m.wellbeing_status === 'at_risk').length} at wellbeing risk
INVOICES: ${invoices.filter(i => i.status === 'overdue').length} overdue
PARTNERS: ${partners.length} total

${brief_type === 'board' ? `
**BOARD-READY BRIEF** — Executive summary suitable for board presentation:
- Business health narrative
- Key financial and operational metrics
- Strategic progress and risks
- Forward-looking outlook and decisions required
` : ''}

Generate:
1. **Executive Summary** (3 sentences — what happened, what matters, what's next)
2. **Business Health Snapshot** (traffic-light status per domain)
3. **Top 5 Priorities** for this period (specific, agent-attributed, actionable)
4. **Risks to Monitor** (top 3, with likelihood and impact)
5. **Opportunities to Seize** (top 3, with specific next steps)
6. **Decisions Required** from leadership (only truly human decisions)
7. **Autonomous Actions Taken** by the agent federation
8. **Forward Look** (next 7 days key events and decisions)`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            business_health: { type: 'object' },
            top_priorities: { type: 'array', items: { type: 'object', properties: { priority: { type: 'string' }, agent: { type: 'string' }, action: { type: 'string' }, urgency: { type: 'string' } } } },
            risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' } } } },
            opportunities: { type: 'array', items: { type: 'object', properties: { opportunity: { type: 'string' }, agent: { type: 'string' }, next_step: { type: 'string' } } } },
            decisions_required: { type: 'array', items: { type: 'string' } },
            autonomous_actions: { type: 'array', items: { type: 'string' } },
            forward_look: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Save briefing
      await base44.asServiceRole.entities.Briefing.create({
        title: `${brief_type.charAt(0).toUpperCase() + brief_type.slice(1)} Strategic Brief — ${new Date().toISOString().split('T')[0]}`,
        brief_type: 'executive',
        content: result?.executive_summary || '',
        status: 'published'
      }).catch(() => null);
    }

    // ── 6. OKR PROGRESS ──────────────────────────────────────────────────────
    if (action === 'okr_progress') {
      const { okrs } = params;
      const [tasks, leads, activities, metrics] = await Promise.all([loadTasks(), loadLeads(), loadActivities(), loadMetrics()]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess OKR progress across the organization using agent data.

OKRs to track: ${JSON.stringify(okrs || [{ objective: 'Grow revenue', key_results: ['Increase leads by 20%', 'Improve conversion rate to 15%', 'Reduce churn to <5%'] }])}

Available agent data:
- Leads: ${leads.length} total, ${leads.filter(l => (l.score || 0) >= 80).length} hot
- Completed tasks: ${tasks.filter(t => t.status === 'completed').length} of ${tasks.length}
- Recent activities: ${activities.length} logged
- Metrics: ${JSON.stringify(metrics.slice(0, 10).map(m => ({ name: m.name, value: m.value, target: m.target })))}

For each OKR, assess:
1. Current progress percentage (0-100)
2. Status: on_track / at_risk / behind / achieved
3. Contributing agents and their signals
4. What's working
5. What's blocking progress
6. Recommended actions to accelerate
7. Forecast: will this KR be achieved by deadline?`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_okr_health: { type: 'string' },
            objectives: { type: 'array', items: { type: 'object', properties: {
              objective: { type: 'string' },
              overall_progress: { type: 'number' },
              key_results: { type: 'array', items: { type: 'object', properties: {
                kr: { type: 'string' }, progress: { type: 'number' }, status: { type: 'string' },
                whats_working: { type: 'string' }, blocker: { type: 'string' }, recommended_action: { type: 'string' }
              }}}
            }}},
            top_blockers: { type: 'array', items: { type: 'string' } },
            acceleration_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 7. INCIDENT POSTMORTEM ────────────────────────────────────────────────
    if (action === 'incident_postmortem') {
      const { incident_description, affected_domains, timeline, resolution } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive post-mortem for a resolved incident.

Incident: ${incident_description || 'system incident'}
Affected domains: ${(affected_domains || ['operations']).join(', ')}
Timeline: ${JSON.stringify(timeline || [])}
Resolution: ${resolution || 'resolved'}

Post-mortem report:
1. **Incident Summary**: What happened, when, what was affected, duration
2. **Timeline**: Chronological sequence of events (discovery → escalation → resolution)
3. **Root Cause Analysis**: Primary and contributing causes (use 5 Whys methodology)
4. **Impact Assessment**: Business impact across all affected domains (financial, operational, customer, compliance)
5. **What Went Well**: Response strengths to preserve
6. **What Didn't Go Well**: Gaps in detection, response, or communication
7. **Action Items**: Specific preventive measures with owners, deadlines, and success criteria
8. **Detection Improvements**: How to catch this earlier next time
9. **Process Updates**: Protocol or playbook changes needed`,
        response_json_schema: {
          type: 'object',
          properties: {
            incident_summary: { type: 'string' },
            timeline: { type: 'array', items: { type: 'object', properties: { time: { type: 'string' }, event: { type: 'string' } } } },
            root_cause: { type: 'string' },
            contributing_factors: { type: 'array', items: { type: 'string' } },
            impact_assessment: { type: 'object' },
            what_went_well: { type: 'array', items: { type: 'string' } },
            what_didnt: { type: 'array', items: { type: 'string' } },
            action_items: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, owner: { type: 'string' }, deadline: { type: 'string' }, success_criteria: { type: 'string' } } } },
            detection_improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 8. WORKFLOW HEALTH ───────────────────────────────────────────────────
    if (action === 'workflow_health') {
      const [workflows, tasks, activities] = await Promise.all([loadWorkflows(), loadTasks(), loadActivities()]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess cross-agent workflow health for the Command Center.

Workflows (${workflows.length}): ${JSON.stringify(workflows.slice(0, 20).map(w => ({ name: w.name, status: w.status, type: w.type })))}
Tasks (${tasks.length}): ${tasks.filter(t => t.status === 'pending').length} pending, ${tasks.filter(t => t.status === 'in_progress').length} in progress, ${tasks.filter(t => t.status === 'completed').length} completed, ${tasks.filter(t => t.priority === 'critical').length} critical
Recent activities: ${activities.length}

Workflow health assessment:
1. **Overall workflow health score** (0-100)
2. **Bottlenecks**: Where are things getting stuck? Which step? Which agent?
3. **Overdue workflows**: What's late and by how much?
4. **Workflow velocity**: Are workflows completing faster or slower than expected?
5. **Failed or blocked workflows**: What needs intervention?
6. **Recommendations**: Specific changes to improve flow and reduce bottlenecks
7. **Automation opportunities**: Where could an agent take over a manual step?`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            bottlenecks: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, cause: { type: 'string' }, impact: { type: 'string' } } } },
            overdue_workflows: { type: 'array', items: { type: 'object', properties: { workflow: { type: 'string' }, days_overdue: { type: 'number' }, recommended_action: { type: 'string' } } } },
            failed_workflows: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            automation_opportunities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 9. AGENT REGISTRY STATUS ─────────────────────────────────────────────
    if (action === 'agent_registry_status') {
      const activities = await loadActivities();

      const AGENTS = [
        { name: 'Maestro', domain: 'Marketing', color: 'violet' },
        { name: 'Prospect', domain: 'Sales & Acquisition', color: 'blue' },
        { name: 'Support Sage', domain: 'Customer Support', color: 'emerald' },
        { name: 'Centsible', domain: 'Finance', color: 'amber' },
        { name: 'Sage', domain: 'Growth Strategy', color: 'cyan' },
        { name: 'Chronos', domain: 'Scheduling', color: 'indigo' },
        { name: 'Atlas', domain: 'Operations', color: 'orange' },
        { name: 'Scribe', domain: 'Knowledge', color: 'slate' },
        { name: 'Sentinel', domain: 'Security', color: 'red' },
        { name: 'Compass', domain: 'Market Intel', color: 'teal' },
        { name: 'Part', domain: 'Partnerships', color: 'blue' },
        { name: 'Pulse', domain: 'People & HR', color: 'pink' },
        { name: 'Merchant', domain: 'Commerce', color: 'green' },
        { name: 'Canvas', domain: 'Creative', color: 'purple' },
        { name: 'Inspect', domain: 'Quality', color: 'yellow' },
        { name: 'Veritas', domain: 'Legal & Compliance', color: 'indigo' }
      ];

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a real-time agent registry status for the Command Center dashboard.

Agents to assess (all 16): ${JSON.stringify(AGENTS)}

Recent activity signals: ${JSON.stringify(activities.slice(0, 30).map(a => ({ type: a.type, title: a.title?.slice(0, 50) })))}

For each agent, assess:
- Status: active / idle / needs_attention (based on available signals and general assessment)
- Current focus area (what would they likely be monitoring right now?)
- Key metric to surface (the most important signal from their domain)
- Any concerns or opportunities in their domain

Also provide:
- Agent dependency map summary (which agents most depend on each other)
- Overall federation health assessment
- Recommended focus areas for the next 24 hours`,
        response_json_schema: {
          type: 'object',
          properties: {
            agents: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' }, domain: { type: 'string' }, status: { type: 'string' },
              current_focus: { type: 'string' }, key_metric: { type: 'string' }, concern: { type: 'string' }
            }}},
            federation_health: { type: 'string' },
            recommended_focus: { type: 'array', items: { type: 'string' } },
            highest_priority_agent: { type: 'string' }
          }
        }
      });
    }

    // ── 10. ALERT CORRELATION ────────────────────────────────────────────────
    if (action === 'alert_correlation') {
      const notifications = await loadNotifications();
      const unread = notifications.filter(n => !n.is_read);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Group and correlate alerts from across all agents to reduce noise and identify incidents.

Unread alerts (${unread.length}): ${JSON.stringify(unread.slice(0, 30).map(n => ({
  title: n.title, message: n.message?.slice(0, 100), priority: n.priority, type: n.type || n.notification_type
})))}

Alert correlation analysis:
1. **Group related alerts** — cluster alerts that are likely related to the same root cause
2. **Create incidents** — for groups of 3+ related alerts, define an incident name and severity
3. **Noise reduction** — identify alerts that are informational and low-priority
4. **Escalation priorities** — which alerts/incidents require immediate human attention?
5. **Auto-resolution candidates** — which alerts might resolve themselves or can be auto-handled?
6. **Summary** — "X alerts grouped into Y incidents. Z require immediate attention."`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            incidents: { type: 'array', items: { type: 'object', properties: {
              incident_name: { type: 'string' }, severity: { type: 'string' },
              related_alerts: { type: 'array', items: { type: 'string' } },
              root_cause_hypothesis: { type: 'string' }, recommended_action: { type: 'string' }
            }}},
            noise_alerts: { type: 'array', items: { type: 'string' } },
            immediate_escalations: { type: 'array', items: { type: 'string' } },
            auto_resolution_candidates: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 11. INTENT ROUTING ───────────────────────────────────────────────────
    if (action === 'intent_routing') {
      const { user_request, context } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the Nexus routing engine. Analyze this user request and determine the optimal agent routing strategy.

User request: "${user_request}"
Context: ${JSON.stringify(context || {})}

Available agents and their specialties:
- Maestro: marketing, campaigns, email, social media, content strategy
- Prospect: leads, sales pipeline, CRM, referral partners, acquisition
- Support Sage: customer support, tickets, complaints, CSAT, escalations
- Centsible: finance, invoices, cash flow, budgets, financial analysis
- Sage: business strategy, growth planning, market analysis, forecasting
- Chronos: scheduling, calendar, bookings, reminders, time management
- Atlas: operations, tasks, workflows, project management, processes
- Scribe: documents, knowledge base, notes, research, writing
- Sentinel: security, privacy, threats, compliance monitoring, fraud
- Compass: market intelligence, competitors, trends, social listening
- Part: partnerships, referrals, influencers, alliance management
- Pulse: HR, wellbeing, recruitment, performance, team culture
- Merchant: products, pricing, inventory, e-commerce, bookings
- Canvas: design, creative, brand, images, visual content
- Inspect: quality assurance, testing, audits, process review
- Veritas: legal, contracts, compliance, regulations, risk

Routing plan:
1. Primary agent (best match)
2. Supporting agents (if cross-domain coordination needed)
3. Sequence: parallel or sequential?
4. Key parameters to pass
5. Expected output format
6. Confidence in routing (0-100)
7. Alternative routing if primary agent fails`,
        response_json_schema: {
          type: 'object',
          properties: {
            primary_agent: { type: 'string' },
            supporting_agents: { type: 'array', items: { type: 'string' } },
            execution_sequence: { type: 'string' },
            key_parameters: { type: 'object' },
            expected_output: { type: 'string' },
            confidence: { type: 'number' },
            routing_rationale: { type: 'string' },
            alternative_routing: { type: 'string' }
          }
        }
      });

      await base44.asServiceRole.entities.Activity.create({
        type: 'intent_routed',
        title: `Request routed to ${result?.primary_agent}`,
        description: user_request?.slice(0, 200)
      }).catch(() => null);
    }

    // ── 12. BOARD DECK GENERATION ────────────────────────────────────────────
    if (action === 'board_deck') {
      const [tasks, leads, team, invoices, activities, insights] = await Promise.all([
        loadTasks(), loadLeads(), loadTeam(), loadInvoices(), loadActivities(), loadInsights()
      ]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a board-ready business update deck outline and narrative.

Business data:
- Leads: ${leads.length} total, ${leads.filter(l => (l.score || 0) >= 80).length} hot
- Team: ${team.length} members, ${team.filter(m => m.wellbeing_status === 'healthy').length} healthy
- Open tasks: ${tasks.filter(t => t.status !== 'completed').length} of ${tasks.length}
- Overdue invoices: ${invoices.filter(i => i.status === 'overdue').length}
- Recent insights: ${insights.length} generated by agents

Generate a professional board update with:
1. **Slide 1 — Business Health Dashboard**: Key metrics, health score, trend
2. **Slide 2 — Revenue & Financial Position**: MRR/ARR, pipeline, financial health
3. **Slide 3 — Growth & Acquisition**: Lead generation, conversion, customer acquisition
4. **Slide 4 — Operations & Team**: Operational health, team status, key projects
5. **Slide 5 — Risks & Compliance**: Top 3 risks, compliance status, mitigations
6. **Slide 6 — Strategic Opportunities**: Top 3 growth opportunities with timelines
7. **Slide 7 — Decisions Required**: What the board needs to decide today
8. **Slide 8 — Outlook**: Next quarter projections and key milestones

For each slide: title, key message (1 sentence), supporting data points (3-5), and speaker notes.`,
        response_json_schema: {
          type: 'object',
          properties: {
            deck_title: { type: 'string' },
            slides: { type: 'array', items: { type: 'object', properties: {
              slide_number: { type: 'number' }, title: { type: 'string' }, key_message: { type: 'string' },
              data_points: { type: 'array', items: { type: 'string' } }, speaker_notes: { type: 'string' }
            }}}
          }
        }
      });
    }


    // --- 13. FULL SELF TEST ---------------------------------------------------
    if (action === 'command_center_full_self_test') {
      const [activities, tasks, leads, insights, notifications, workflows, team] = await Promise.all([
        loadActivities(), loadTasks(), loadLeads(), loadInsights(), loadNotifications(), loadWorkflows(), loadTeam()
      ]);

      const unreadCritical = notifications.filter(n => !n.is_read && n.priority === 'critical').length;
      const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
      const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
      const activeWorkflows = workflows.filter(w => w.status === 'active').length;
      const hotLeads = leads.filter(l => (l.score || 0) >= 80).length;
      const teamAtRisk = team.filter(m => m.wellbeing_status === 'at_risk').length;

      const checks = {
        activity_feed_live: activities.length > 0,
        insights_pipeline_live: insights.length > 0,
        routing_signal_ready: hotLeads > 0 || activeTasks > 0,
        alerting_signal_ready: notifications.length > 0,
        workflow_visibility_ready: workflows.length > 0,
        critical_alert_pressure_healthy: unreadCritical <= 3,
        blocked_task_pressure_healthy: activeTasks === 0 ? true : (blockedTasks / activeTasks) < 0.2,
        people_risk_pressure_healthy: team.length === 0 ? true : (teamAtRisk / team.length) < 0.25
      };

      const passCount = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      const healthScore = Math.round((passCount / totalChecks) * 100);

      const recommendations = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a concise remediation plan for Command Center health.
Health score: ${healthScore}
Unread critical alerts: ${unreadCritical}
Active tasks: ${activeTasks}
Blocked tasks: ${blockedTasks}
Active workflows: ${activeWorkflows}
Hot leads: ${hotLeads}
Team at-risk count: ${teamAtRisk}

Return:
1) top 3 immediate actions
2) top 3 orchestration optimizations
3) top 3 risk controls`,
        response_json_schema: {
          type: 'object',
          properties: {
            immediate_actions: { type: 'array', items: { type: 'string' } },
            orchestration_optimizations: { type: 'array', items: { type: 'string' } },
            risk_controls: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = {
        checks,
        health: {
          health_score: healthScore,
          unread_critical_alerts: unreadCritical,
          active_tasks: activeTasks,
          blocked_tasks: blockedTasks,
          active_workflows: activeWorkflows,
          hot_leads: hotLeads,
          team_at_risk: teamAtRisk,
          recent_activities: activities.length
        },
        recommendations
      };
    }

    if (!result) {
      result = { message: `Action '${action}' received. Available actions: business_health_score, cross_agent_insights, causal_analysis, scenario_modeling, strategic_brief, okr_progress, incident_postmortem, workflow_health, agent_registry_status, alert_correlation, intent_routing, board_deck, command_center_full_self_test` };
    }

    return Response.json({ status: 'command_center_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

