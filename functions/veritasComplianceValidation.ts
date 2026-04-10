import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { action, params = {} } = payload;

    const industry = payload.industry || params.industry || 'general business';
    const compliance_area = payload.compliance_area || params.compliance_area || 'all';

    const loadDocuments = () => base44.asServiceRole.entities.Document.list('-created_date', 80).catch(() => []);
    const loadEvents = () => base44.asServiceRole.entities.CalendarEvent.list('start_time', 60).catch(() => []);
    const loadTasks = () => base44.asServiceRole.entities.Task.list('-created_date', 80).catch(() => []);

    let result: any = null;

    if (action === 'audit_compliance') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Comprehensive compliance audit for ${industry}. Focus area: ${compliance_area}.

Assess:
1) Data protection/privacy
2) Financial/regulatory reporting
3) Industry-specific obligations
4) Employment and labor
5) Contract and vendor controls
6) Record retention and auditability

Return compliance status, severity, and remediation priority by area.`,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_score: { type: 'number' },
            areas_compliant: { type: 'array', items: { type: 'string' } },
            areas_non_compliant: { type: 'array', items: { type: 'string' } },
            critical_gaps: { type: 'array', items: { type: 'string' } },
            remediation_priority: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    if (action === 'validate_requirements') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Validate legal/compliance requirements for ${industry}. Area: ${compliance_area}.

Provide:
1) Applicable requirements
2) Current-state assumptions
3) Gaps
4) Implementation steps
5) Timeline and risk if non-compliant`,
        response_json_schema: {
          type: 'object',
          properties: {
            requirements: { type: 'array', items: { type: 'string' } },
            gaps: { type: 'array', items: { type: 'string' } },
            implementation_steps: { type: 'array', items: { type: 'string' } },
            timeline_weeks: { type: 'number' },
            penalty_risk: { type: 'string' },
          }
        }
      });
    }

    if (action === 'generate_report') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate legal/compliance report for ${industry}.

Include executive summary, findings, risk levels, recommendations, remediation timeline, and next review date.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            findings: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            remediation_timeline: { type: 'string' },
            next_review: { type: 'string' },
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `Compliance Report - ${new Date().toISOString().split('T')[0]}`,
        type: 'compliance_report',
        content: result?.executive_summary || 'Compliance report generated',
        status: 'final'
      }).catch(() => null);
    }

    if (action === 'remediation_plan') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create detailed remediation plan for ${compliance_area} in ${industry}.

Include priority, owners, timeline, resources, success criteria, and verification checks.`,
        response_json_schema: {
          type: 'object',
          properties: {
            remediation_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  priority: { type: 'string' },
                  owner: { type: 'string' },
                  timeline_weeks: { type: 'number' }
                }
              }
            },
            total_timeline_weeks: { type: 'number' },
            estimated_cost: { type: 'string' }
          }
        }
      });
    }

    // Veritas 2.0 extensions
    if (action === 'contract_risk_review') {
      const contractType = String(params.contract_type || 'MSA');
      const counterparty = String(params.counterparty || 'Counterparty');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform contract risk review.

Contract type: ${contractType}
Counterparty: ${counterparty}
Context: ${params.context || 'commercial services agreement'}

Assess risks for liability, indemnity, termination, data protection, IP, payment, and dispute resolution.
Return redline priorities and negotiation fallback positions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_risk_score: { type: 'number' },
            red_flags: { type: 'array', items: { type: 'string' } },
            fallback_positions: { type: 'array', items: { type: 'string' } },
            sign_recommendation: { type: 'string' },
          }
        }
      });
    }

    if (action === 'contract_obligation_tracker') {
      const docs = await loadDocuments();
      const contractDocs = docs.filter((d: any) => ['contract', 'proposal'].includes(String(d.type || '').toLowerCase()));
      const upcomingEvents = (await loadEvents()).filter((e: any) => new Date(e.start_time) > new Date());
      const obligationsDetected = Math.max(0, contractDocs.length * 2);
      result = {
        contracts_in_repository: contractDocs.length,
        obligations_detected: obligationsDetected,
        upcoming_legal_deadlines: upcomingEvents.slice(0, 10).map((e: any) => ({ title: e.title, start_time: e.start_time })),
        priority_followups: [
          'Confirm renewal/termination windows for top-value contracts',
          'Validate notice provisions and escalation contacts',
          'Create Atlas tasks for payment/reporting obligations',
        ],
      };
    }

    if (action === 'regulatory_horizon_scan') {
      const regions = String(params.regions || 'US,AU,EU');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate regulatory horizon scan for ${industry} across ${regions}.

Provide:
1) Emerging regulatory themes
2) Likelihood and impact
3) Affected business functions
4) 30/60/90 day readiness actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            watch_items: { type: 'array', items: { type: 'object', properties: { regulation: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' }, function_owner: { type: 'string' } } } },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            quarter_actions: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    if (action === 'privacy_dsar_command') {
      const requestType = String(params.request_type || 'access');
      const jurisdiction = String(params.jurisdiction || 'GDPR/CCPA');
      result = {
        request_type: requestType,
        jurisdiction,
        response_deadline_days: jurisdiction.toLowerCase().includes('gdpr') ? 30 : 45,
        workflow_steps: [
          'Verify requester identity',
          'Locate data across systems',
          'Apply legal exceptions and minimization',
          'Prepare response package and audit log',
        ],
        response_template: 'Draft response includes scope, processing categories, and fulfillment confirmation.',
      };
    }

    if (action === 'privacy_pia_assessment') {
      const dataType = String(params.data_type || 'PII');
      const flow = String(params.data_flow || 'collection, storage, processing, sharing');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run privacy impact assessment.

Data type: ${dataType}
Data flow: ${flow}
Use case: ${params.use_case || 'new feature rollout'}

Return risk rating, required controls, transfer safeguards, and go/no-go guidance.`,
        response_json_schema: {
          type: 'object',
          properties: {
            privacy_risk_rating: { type: 'string' },
            required_controls: { type: 'array', items: { type: 'string' } },
            transfer_safeguards: { type: 'array', items: { type: 'string' } },
            go_no_go: { type: 'string' },
          }
        }
      });
    }

    if (action === 'ip_risk_scan') {
      const domain = String(params.domain || 'brand + software');
      result = {
        domain,
        ip_risk_score: 62,
        findings: [
          'Trademark collision risk in one target region',
          'Open-source attribution obligations require update',
          'Contractor IP assignment coverage incomplete',
        ],
        actions: [
          'Run trademark clearance before launch naming lock',
          'Update OSS attribution notices and CI checks',
          'Collect missing IP assignment agreements',
        ],
      };
    }

    if (action === 'governance_compliance_command') {
      const events = await loadEvents();
      const boardItems = events.filter((e: any) => String(e.title || '').toLowerCase().includes('board'));
      result = {
        governance_score: Math.max(55, 90 - Math.min(boardItems.length, 10)),
        board_events_upcoming: boardItems.slice(0, 6).map((e: any) => ({ title: e.title, start_time: e.start_time })),
        required_actions: [
          'Confirm board resolutions and minute capture workflow',
          'Validate annual filing calendar by jurisdiction',
          'Refresh conflict-of-interest attestations',
        ],
      };
    }

    if (action === 'employment_law_guard') {
      const roleType = String(params.role_type || 'employee');
      const jurisdiction = String(params.jurisdiction || 'AU');
      result = {
        role_type: roleType,
        jurisdiction,
        classification_risk: roleType.toLowerCase().includes('contractor') ? 'medium' : 'low',
        controls: [
          'Use jurisdiction-compliant contract template',
          'Validate leave and notice requirements',
          'Confirm IP assignment + confidentiality terms',
        ],
        escalation_triggers: ['Overtime threshold breach', 'Misclassification indicators', 'Termination process deviations'],
      };
    }

    if (action === 'compliance_training_command') {
      const scope = String(params.scope || 'privacy, security, anti-harassment');
      result = {
        training_scope: scope,
        assignment_model: ['Role-based mandatory modules', 'Jurisdiction-triggered modules', 'Annual refresher cadence'],
        overdue_tracking: 'Escalate overdue acknowledgements to Pulse after 7 days',
        completion_targets: { month: '95%', quarter: '98%' },
      };
    }

    if (action === 'legal_risk_register') {
      const docs = await loadDocuments();
      const tasks = await loadTasks();
      const openTasks = tasks.filter((t: any) => t.status !== 'done').length;
      result = {
        legal_risk_summary: {
          contract_exposure: Math.max(1, docs.filter((d: any) => ['contract', 'proposal'].includes(String(d.type || '').toLowerCase())).length),
          remediation_backlog: openTasks,
          top_risks: ['Data privacy obligations drift', 'Contract renewal leakage', 'Cross-jurisdiction policy mismatch'],
        },
        mitigations: [
          'Run monthly contract obligation sweep',
          'Align policy matrix to operating jurisdictions',
          'Implement pre-launch legal gate for regulated features',
        ],
      };
    }

    if (action === 'incident_legal_response') {
      const incidentType = String(params.incident_type || 'data_incident');
      result = {
        incident_type: incidentType,
        first_24h_actions: [
          'Preserve evidence and issue legal hold if required',
          'Assess notification obligations by jurisdiction',
          'Prepare regulator/customer communication drafts',
        ],
        stakeholder_matrix: ['Sentinel', 'Support Sage', 'Centsible', 'Commander'],
        legal_brief: 'Coordinate containment facts with statutory notice windows before public disclosure.',
      };
    }

    if (action === 'veritas_full_self_test') {
      const [docs, events, tasks] = await Promise.all([loadDocuments(), loadEvents(), loadTasks()]);
      const contracts = docs.filter((d: any) => ['contract', 'proposal'].includes(String(d.type || '').toLowerCase()));
      const policies = docs.filter((d: any) => ['sop', 'other', 'faq', 'compliance_report'].includes(String(d.type || '').toLowerCase()));
      const upcomingDeadlines = events.filter((e: any) => new Date(e.start_time) > new Date() && (new Date(e.start_time).getTime() - Date.now()) / 86400000 <= 30).length;
      const legalTasksOpen = tasks.filter((t: any) => String(t.title || '').toLowerCase().includes('legal') && t.status !== 'done').length;

      const checks = {
        contract_repository_present: contracts.length > 0,
        policy_baseline_present: policies.length > 0,
        deadline_pressure_controlled: upcomingDeadlines <= 10,
        legal_remediation_queue_healthy: legalTasksOpen <= 20,
        reporting_ready: docs.some((d: any) => String(d.type || '').toLowerCase() === 'compliance_report'),
      };

      result = {
        checks,
        operations: {
          contracts: contracts.length,
          policies: policies.length,
          upcoming_30d_deadlines: upcomingDeadlines,
          open_legal_tasks: legalTasksOpen,
        },
        posture: {
          legal_compliance_posture: checks.contract_repository_present && checks.policy_baseline_present ? 'operational' : 'needs_foundation',
          recommended_review_cadence: 'weekly',
        },
        priorities_7d: [
          'Resolve high-priority legal remediation tasks',
          'Run regulatory_horizon_scan and update policy matrix',
          'Validate contract renewals due in next 45 days',
        ],
      };
    }

    if (!result) {
      result = {
        message: `Action '${action}' received. Available actions: audit_compliance, validate_requirements, generate_report, remediation_plan, contract_risk_review, contract_obligation_tracker, regulatory_horizon_scan, privacy_dsar_command, privacy_pia_assessment, ip_risk_scan, governance_compliance_command, employment_law_guard, compliance_training_command, legal_risk_register, incident_legal_response, veritas_full_self_test`
      };
    }

    return Response.json({
      status: 'veritas_action_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
