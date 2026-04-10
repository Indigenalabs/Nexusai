import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { audit_scope, check_areas } = payload;
    // audit_scope: 'participant' (single), 'organisation' (all), 'monthly', 'quarterly'
    // check_areas: ['documentation', 'incident_reporting', 'certifications', 'worker_screening', 'plan_alignment']

    const auditResults = {
      scope: audit_scope,
      checks_completed: [],
      issues_found: 0,
      compliance_score: 100,
      timestamp: new Date().toISOString()
    };

    // Check 1: Documentation completeness
    if (check_areas.includes('documentation')) {
      const allParticipants = await base44.asServiceRole.entities.Order.list(); // Proxy for participants
      let docIssues = 0;

      for (const participant of allParticipants) {
        // Check if service agreement is signed and dated
        const serviceAgreement = await base44.asServiceRole.entities.Document.list().then(
          docs => docs.find(d => d.related_id === participant.id && d.type === 'service_agreement')
        );

        if (!serviceAgreement || !serviceAgreement.signed_date) {
          docIssues++;
          await base44.asServiceRole.entities.Task.create({
            title: `Missing signed service agreement: ${participant.customer_email}`,
            status: 'pending',
            priority: 'high',
            tags: ['compliance']
          });
        }
      }

      auditResults.checks_completed.push({
        area: 'documentation',
        result: `${docIssues} participants missing signed documents`,
        status: docIssues === 0 ? 'pass' : 'fail'
      });
      auditResults.issues_found += docIssues;
    }

    // Check 2: Incident reporting compliance (SIRS)
    if (check_areas.includes('incident_reporting')) {
      const incidents = await base44.asServiceRole.entities.SeriousIncident.list();
      let sirs_issues = 0;

      for (const incident of incidents) {
        // Check SIRS requirements
        const issuesWithThisIncident = [];

        if (!incident.sirs_compliant) {
          issuesWithThisIncident.push('Not marked as SIRS compliant');
        }
        if (incident.severity === 'critical' && !incident.reported_to_ndis) {
          issuesWithThisIncident.push('Critical incident not reported to NDIS');
        }
        if (incident.investigation_status === 'open' && !incident.follow_up_actions?.length) {
          issuesWithThisIncident.push('No follow-up actions defined');
        }

        if (issuesWithThisIncident.length > 0) {
          sirs_issues++;
          await base44.asServiceRole.entities.Task.create({
            title: `SIRS compliance issue: Incident ${incident.id}`,
            description: issuesWithThisIncident.join('. '),
            status: 'pending',
            priority: 'critical',
            tags: ['compliance', 'sirs']
          });
        }
      }

      auditResults.checks_completed.push({
        area: 'incident_reporting',
        result: `${sirs_issues} incidents with SIRS compliance issues`,
        status: sirs_issues === 0 ? 'pass' : 'fail'
      });
      auditResults.issues_found += sirs_issues;
    }

    // Check 3: Staff certifications
    if (check_areas.includes('certifications')) {
      const workers = await base44.asServiceRole.entities.WorkerProfile.list();
      let cert_issues = 0;

      for (const worker of workers) {
        const expiredCerts = worker.certifications?.filter(c => {
          const expiry = new Date(c.expiry_date);
          return expiry < new Date();
        }) || [];

        if (expiredCerts.length > 0) {
          cert_issues++;
          await base44.asServiceRole.entities.Task.create({
            title: `Expired certifications: ${worker.name}`,
            description: expiredCerts.map(c => c.certification).join(', '),
            status: 'pending',
            priority: 'high',
            tags: ['compliance', 'certifications']
          });
        }
      }

      auditResults.checks_completed.push({
        area: 'certifications',
        result: `${cert_issues} workers with expired certifications`,
        status: cert_issues === 0 ? 'pass' : 'fail'
      });
      auditResults.issues_found += cert_issues;
    }

    // Check 4: NDIS worker screening
    if (check_areas.includes('worker_screening')) {
      const workers = await base44.asServiceRole.entities.WorkerProfile.list();
      let screening_issues = 0;

      for (const worker of workers) {
        const hasCurrent = worker.certifications?.some(c =>
          c.certification === 'ndis_worker_screening' && new Date(c.expiry_date) > new Date()
        );

        if (!hasCurrent) {
          screening_issues++;
          await base44.asServiceRole.entities.Task.create({
            title: `Worker screening expired or missing: ${worker.name}`,
            status: 'pending',
            priority: 'critical',
            tags: ['compliance', 'screening']
          });
        }
      }

      auditResults.checks_completed.push({
        area: 'worker_screening',
        result: `${screening_issues} workers without current screening`,
        status: screening_issues === 0 ? 'pass' : 'fail'
      });
      auditResults.issues_found += screening_issues;
    }

    // Check 5: Plan alignment (goals vs services)
    if (check_areas.includes('plan_alignment')) {
      const plans = await base44.asServiceRole.entities.NDISPlan.list();
      let alignment_issues = 0;

      for (const plan of plans) {
        const goals = plan.goals || [];
        const supports = plan.support_items || [];

        // Check if each goal has corresponding support items
        for (const goal of goals) {
          const hasSupport = supports.some(s => s.description?.toLowerCase().includes(goal.category));
          if (!hasSupport && goal.category !== 'other') {
            alignment_issues++;
          }
        }
      }

      auditResults.checks_completed.push({
        area: 'plan_alignment',
        result: `${alignment_issues} goals without corresponding supports`,
        status: alignment_issues === 0 ? 'pass' : 'fail'
      });
      auditResults.issues_found += alignment_issues;
    }

    // Calculate overall compliance score
    const passCount = auditResults.checks_completed.filter(c => c.status === 'pass').length;
    auditResults.compliance_score = Math.round((passCount / auditResults.checks_completed.length) * 100);

    // Log audit result
    await base44.asServiceRole.entities.Activity.create({
      type: 'compliance_audit',
      title: `Compliance audit: ${audit_scope}`,
      description: `Score: ${auditResults.compliance_score}%. Issues: ${auditResults.issues_found}`,
      entity_type: 'Audit'
    });

    return Response.json({
      status: 'audit_complete',
      audit_results: auditResults
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});