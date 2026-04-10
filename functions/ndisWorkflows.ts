import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * NDIS Workflows — Autonomous NDIS provider operations function.
 *
 * Actions:
 * - onboard_participant          → Trigger full onboarding task chain for a new NDIS participant
 * - process_service_delivery     → Log a support session, generate progress note, trigger claim
 * - check_compliance_status      → Run daily compliance check across all participants and workers
 * - classify_sirs_incident       → Classify an incident against SIRS categories, set notification deadlines
 * - check_budget_status          → Check all participant budgets, flag at-risk, predict depletion
 * - generate_audit_package       → Compile audit evidence checklist and gap analysis
 * - check_worker_compliance      → Check all worker clearances and training for expiry/gaps
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // === ONBOARD PARTICIPANT ===
    if (action === 'onboard_participant') {
      const { participantName, ndisNumber, planStartDate, planEndDate, corebudget, capacityBudget, capitalBudget, coordinatorEmail } = data || {};

      const today = new Date();
      const day = (n) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create the full onboarding task chain
      const tasks = await Promise.all([
        base44.entities.Task.create({ title: `Send acknowledgment + onboarding pack — ${participantName}`, description: 'Support Sage: send automated welcome email with onboarding form link and upload instructions for NDIS plan, ID, and consent forms.', priority: 'high', status: 'pending', due_date: day(0), source: 'agent', tags: ['ndis', 'onboarding', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Upload documents request — ${participantName}`, description: 'Participant to upload: NDIS plan PDF, photo ID, signed consent forms (service delivery, photography, data sharing). Scribe will extract plan data automatically on upload.', priority: 'high', status: 'pending', due_date: day(1), source: 'agent', tags: ['ndis', 'onboarding', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Veritas: Validate service agreement compliance — ${participantName}`, description: 'Check service agreement against mandatory NDIS requirements: provider details, participant NDIS#, support items listed, pricing, duration, rights section, signatures, witness.', priority: 'high', status: 'pending', due_date: day(3), source: 'agent', tags: ['ndis', 'compliance', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Centsible: Set up budget tracking — ${participantName}`, description: `Create Budget records for: Core Supports $${corebudget || 'TBC'}, Capacity Building $${capacityBudget || 'TBC'}, Capital $${capitalBudget || 'TBC'}. Set 80% alert threshold. Link to participant profile.`, priority: 'high', status: 'pending', due_date: day(3), source: 'agent', tags: ['ndis', 'finance', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Schedule initial planning meeting — ${participantName}`, description: 'Chronos: schedule 45-minute planning meeting with participant, family/nominee, and assigned coordinator. Discuss: support goals, preferences, preferred worker attributes, schedule preferences.', priority: 'medium', status: 'pending', due_date: day(4), source: 'agent', tags: ['ndis', 'onboarding', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Assign key support worker — ${participantName}`, description: 'Atlas + Pulse: review worker availability and skills. Match to participant support needs, cultural considerations, language, gender preference, and continuity availability. Confirm with participant before rostering.', priority: 'high', status: 'pending', due_date: day(4), source: 'agent', tags: ['ndis', 'rostering', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Send welcome pack (easy-read) — ${participantName}`, description: 'Canvas + Scribe: generate easy-read welcome pack including: services summary, rights and responsibilities, complaint process, key contacts, what to expect. Send via Support Sage.', priority: 'medium', status: 'pending', due_date: day(5), source: 'agent', tags: ['ndis', 'onboarding', participantName] }).catch(() => null),
        base44.entities.Task.create({ title: `Create participant file in Scribe — ${participantName}`, description: `Set up secure participant folder. Required documents checklist: NDIS plan, service agreement, consent forms, ID, emergency contacts, health information, goal plans. NDIS#: ${ndisNumber}. Plan: ${planStartDate} → ${planEndDate}.`, priority: 'high', status: 'pending', due_date: day(1), source: 'agent', tags: ['ndis', 'documentation', participantName] }).catch(() => null),
      ]);

      // Plan expiry alert
      if (planEndDate) {
        const expiry = new Date(planEndDate);
        const daysUntilExpiry = Math.round((expiry - today) / (24*60*60*1000));
        if (daysUntilExpiry < 90) {
          await base44.entities.Notification.create({
            title: `⚠️ Plan Expiry Alert: ${participantName} — ${daysUntilExpiry} days`,
            message: `${participantName}'s NDIS plan expires on ${planEndDate} (${daysUntilExpiry} days). Coordinator: initiate plan review process with NDIA now. Target: new plan in place before expiry to avoid service gaps.`,
            type: 'warning',
            is_read: false,
          }).catch(() => {});
        }
      }

      await base44.entities.Notification.create({
        title: `🎉 New Participant Onboarding: ${participantName}`,
        message: `Onboarding workflow initiated for ${participantName} (NDIS#: ${ndisNumber}). ${tasks.filter(Boolean).length} tasks created across 5 days. Coordinator: ${coordinatorEmail || 'unassigned'}. Plan: ${planStartDate} → ${planEndDate}.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      await base44.entities.Activity.create({
        type: 'onboarding',
        title: `NDIS Participant Onboarding Started: ${participantName}`,
        description: `NDIS# ${ndisNumber} | Plan: ${planStartDate} → ${planEndDate} | Tasks created: ${tasks.filter(Boolean).length}`,
      }).catch(() => {});

      return Response.json({ success: true, participantName, ndisNumber, tasksCreated: tasks.filter(Boolean).length, estimatedOnboardingDays: 5, planExpiryDays: planEndDate ? Math.round((new Date(planEndDate) - today) / (24*60*60*1000)) : null });
    }

    // === PROCESS SERVICE DELIVERY ===
    if (action === 'process_service_delivery') {
      const { participantName, workerName, serviceDate, durationHours, supportCategory, supportItemName, sessionNotes, anyIncidents, anyConCerns } = data || {};

      // Generate NDIS-compliant progress note structure
      const progressNote = {
        participant: participantName,
        worker: workerName,
        date: serviceDate,
        duration: `${durationHours} hours`,
        category: supportCategory,
        supportItem: supportItemName,
        notesStructured: {
          supportDelivered: sessionNotes?.supportDelivered || 'Support delivered as per care plan.',
          participantResponse: sessionNotes?.participantResponse || 'Participant engaged positively with session.',
          goalProgress: sessionNotes?.goalProgress || 'Progress observed toward NDIS plan goals.',
          observationsOrConcerns: anyConCerns || sessionNotes?.concerns || 'No concerns noted.',
          nextSessionFocus: sessionNotes?.nextFocus || 'Continue with scheduled support.',
        },
        incidents: anyIncidents ? `INCIDENT NOTED: ${anyIncidents}` : 'No incidents to report.',
      };

      // Create Document record for the progress note
      await base44.entities.Document.create({
        title: `Progress Note — ${participantName} — ${serviceDate}`,
        content: JSON.stringify(progressNote, null, 2),
        type: 'meeting_notes',
        status: 'published',
        participants: [workerName, participantName],
        tags: ['ndis', 'progress_note', participantName, supportCategory],
        source: 'agent',
      }).catch(() => {});

      // Trigger claim processing notification to Centsible
      await base44.entities.Notification.create({
        title: `💳 Service Delivery: ${participantName} — Ready for Claim`,
        message: `${workerName} delivered ${durationHours}h of ${supportItemName} (${supportCategory}) to ${participantName} on ${serviceDate}. Centsible: process NDIS claim at current price guide rate. Progress note filed by Scribe.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      // If incident noted — escalate immediately
      if (anyIncidents) {
        await base44.entities.Notification.create({
          title: `🚨 INCIDENT NOTED: ${participantName} — ${serviceDate}`,
          message: `Incident reported during service delivery: "${anyIncidents}". Veritas: classify against SIRS categories immediately. Atlas: initiate incident investigation workflow. Scribe: secure documentation.`,
          type: 'warning',
          is_read: false,
        }).catch(() => {});

        await base44.entities.Task.create({
          title: `INCIDENT: Classify and investigate — ${participantName} — ${serviceDate}`,
          description: `Incident: "${anyIncidents}". Steps: 1) Veritas SIRS classification within 2 hours. 2) Notify participant/family within 24 hours. 3) Assign investigation lead. 4) Full investigation report within 7 days.`,
          priority: 'critical',
          status: 'pending',
          source: 'agent',
          tags: ['ndis', 'incident', participantName],
        }).catch(() => {});
      }

      await base44.entities.Activity.create({
        type: 'service_delivery',
        title: `Service Delivered: ${participantName} — ${serviceDate}`,
        description: `Worker: ${workerName} | ${durationHours}h ${supportItemName} | ${anyIncidents ? 'INCIDENT NOTED' : 'No incidents'}`,
      }).catch(() => {});

      return Response.json({ success: true, progressNoteCreated: true, claimTriggered: true, incidentFlagged: !!anyIncidents, participant: participantName, worker: workerName, date: serviceDate, duration: durationHours, category: supportCategory });
    }

    // === CHECK COMPLIANCE STATUS ===
    if (action === 'check_compliance_status') {
      const { workers, participants } = data || {};
      // workers: [{name, clearanceExpiry, trainingComplete, firstAidExpiry}]
      // participants: [{name, ndisNumber, hasServiceAgreement, agreementExpiry, lastProgressNote, hasConsentForms}]

      const today = new Date();
      const issues = [];
      const critical = [];
      const warnings = [];

      // Check worker compliance
      for (const worker of (workers || [])) {
        const clearanceDays = worker.clearanceExpiry ? Math.round((new Date(worker.clearanceExpiry) - today) / (24*60*60*1000)) : null;
        const firstAidDays = worker.firstAidExpiry ? Math.round((new Date(worker.firstAidExpiry) - today) / (24*60*60*1000)) : null;

        if (clearanceDays !== null && clearanceDays <= 0) critical.push(`🔴 ${worker.name}: NDIS Screening Clearance EXPIRED — cannot deliver supports`);
        else if (clearanceDays !== null && clearanceDays <= 30) warnings.push(`⚠️ ${worker.name}: Screening Clearance expires in ${clearanceDays} days — renew NOW`);

        if (!worker.trainingComplete) warnings.push(`⚠️ ${worker.name}: NDIS Worker Orientation Module not completed`);

        if (firstAidDays !== null && firstAidDays <= 0) warnings.push(`⚠️ ${worker.name}: First Aid certificate EXPIRED`);
        else if (firstAidDays !== null && firstAidDays <= 30) issues.push(`📋 ${worker.name}: First Aid certificate expires in ${firstAidDays} days`);
      }

      // Check participant compliance
      for (const participant of (participants || [])) {
        if (!participant.hasServiceAgreement) critical.push(`🔴 ${participant.name}: No service agreement — cannot legally deliver supports`);
        if (!participant.hasConsentForms) critical.push(`🔴 ${participant.name}: Consent forms missing — Standard 1 breach`);

        const agreementDays = participant.agreementExpiry ? Math.round((new Date(participant.agreementExpiry) - today) / (24*60*60*1000)) : null;
        if (agreementDays !== null && agreementDays <= 0) critical.push(`🔴 ${participant.name}: Service agreement EXPIRED`);
        else if (agreementDays !== null && agreementDays <= 30) warnings.push(`⚠️ ${participant.name}: Service agreement expires in ${agreementDays} days`);

        if (participant.lastProgressNote) {
          const noteDays = Math.round((today - new Date(participant.lastProgressNote)) / (24*60*60*1000));
          if (noteDays > 7) warnings.push(`⚠️ ${participant.name}: Last progress note ${noteDays} days ago — overdue`);
        }
      }

      const complianceScore = Math.max(0, 100 - (critical.length * 20) - (warnings.length * 5) - (issues.length * 2));
      const status = critical.length > 0 ? 'CRITICAL' : warnings.length > 5 ? 'AT RISK' : warnings.length > 0 ? 'ATTENTION NEEDED' : 'COMPLIANT';

      // Create tasks for critical issues
      for (const issue of critical) {
        await base44.entities.Task.create({
          title: `COMPLIANCE: ${issue.substring(0, 80)}`,
          description: issue,
          priority: 'critical',
          status: 'pending',
          source: 'agent',
          tags: ['ndis', 'compliance'],
        }).catch(() => {});
      }

      if (critical.length > 0 || warnings.length > 3) {
        await base44.entities.Notification.create({
          title: `⚖️ NDIS Compliance Check — ${status} (Score: ${complianceScore}/100)`,
          message: `${critical.length} critical issues | ${warnings.length} warnings\nCritical: ${critical.slice(0,3).join(' | ')}\nAtlas: remediation tasks created for critical issues. Veritas: full review recommended.`,
          type: critical.length > 0 ? 'warning' : 'info',
          is_read: false,
        }).catch(() => {});
      }

      return Response.json({ complianceScore, status, critical, warnings, issues, workerIssues: (workers || []).length, participantIssues: (participants || []).length, tasksCreated: critical.length });
    }

    // === CLASSIFY SIRS INCIDENT ===
    if (action === 'classify_sirs_incident') {
      const { participantName, incidentType, incidentDescription, incidentDate, workerInvolved } = data || {};

      // SIRS reportable categories
      const sirsCategories = {
        death: { priority: 1, notificationHours: 24, label: 'Death of a participant' },
        serious_injury: { priority: 1, notificationHours: 24, label: 'Serious injury' },
        abuse_neglect: { priority: 1, notificationHours: 24, label: 'Abuse or neglect' },
        sexual_contact: { priority: 1, notificationHours: 24, label: 'Unlawful sexual contact' },
        physical_contact: { priority: 1, notificationHours: 24, label: 'Unlawful physical contact' },
        financial_abuse: { priority: 2, notificationHours: 120, label: 'Theft, fraud or financial abuse' },
        restrictive_practice: { priority: 2, notificationHours: 120, label: 'Unauthorised restrictive practice' },
        non_reportable: { priority: null, notificationHours: null, label: 'Non-reportable incident' },
      };

      const category = sirsCategories[incidentType] || sirsCategories.non_reportable;
      const isReportable = category.priority !== null;
      const notificationDeadline = isReportable
        ? new Date(new Date(incidentDate || new Date()).getTime() + category.notificationHours * 60 * 60 * 1000).toISOString()
        : null;

      const hoursRemaining = notificationDeadline ? Math.round((new Date(notificationDeadline) - new Date()) / (60 * 60 * 1000)) : null;
      const isOverdue = hoursRemaining !== null && hoursRemaining <= 0;

      if (isReportable) {
        await base44.entities.Task.create({
          title: `SIRS NOTIFICATION: ${participantName} — ${category.label} — Due ${notificationDeadline?.split('T')[0]}`,
          description: `Priority ${category.priority} SIRS incident. MUST notify NDIS Commission within ${category.notificationHours} hours of incident (${incidentDate}).\nParticipant: ${participantName}\nIncident: ${category.label}\nDescription: ${incidentDescription}\nWorker: ${workerInvolved || 'TBC'}\nNotification deadline: ${notificationDeadline}\n${isOverdue ? '⚠️ OVERDUE — submit immediately' : `Hours remaining: ${hoursRemaining}`}`,
          priority: 'critical',
          status: 'pending',
          due_date: notificationDeadline?.split('T')[0],
          source: 'agent',
          tags: ['ndis', 'sirs', 'incident', participantName],
        }).catch(() => {});

        // 14-day detailed report task
        const detailedReportDue = new Date(new Date(incidentDate || new Date()).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await base44.entities.Task.create({
          title: `SIRS Detailed Report (14 days): ${participantName}`,
          description: `Following SIRS initial notification, a detailed investigation report must be submitted within 14 days. Due: ${detailedReportDue}`,
          priority: 'high',
          status: 'pending',
          due_date: detailedReportDue,
          source: 'agent',
          tags: ['ndis', 'sirs', 'incident', participantName],
        }).catch(() => {});

        await base44.entities.Notification.create({
          title: `🚨 SIRS REPORTABLE INCIDENT: ${participantName} — ${category.label}`,
          message: `Priority ${category.priority} incident. NDIS Commission notification required within ${category.notificationHours} hours.\nDeadline: ${notificationDeadline}\n${isOverdue ? 'OVERDUE — submit IMMEDIATELY' : `Hours remaining: ${hoursRemaining}`}\nAtlas: investigation workflow initiated. Scribe: secure all documentation. Veritas: validate report completeness before submission.`,
          type: 'warning',
          is_read: false,
        }).catch(() => {});
      } else {
        await base44.entities.Notification.create({
          title: `📋 Non-Reportable Incident Logged: ${participantName}`,
          message: `Incident logged as non-reportable under SIRS. Stored for pattern monitoring by Inspect. No NDIS Commission notification required.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Activity.create({
        type: 'incident',
        title: `SIRS Classification: ${participantName} — ${category.label}`,
        description: `Reportable: ${isReportable} | Priority: ${category.priority || 'N/A'} | Notification deadline: ${notificationDeadline || 'N/A'}`,
      }).catch(() => {});

      return Response.json({ participantName, incidentType, category: category.label, isReportable, priority: category.priority, notificationHours: category.notificationHours, notificationDeadline, hoursRemaining, isOverdue, tasksCreated: isReportable ? 2 : 0 });
    }

    // === CHECK BUDGET STATUS ===
    if (action === 'check_budget_status') {
      const { participants } = data || {};
      // participants: [{name, ndisNumber, planEndDate, coreTotal, coreSpent, capacityTotal, capacitySpent, capitalTotal, capitalSpent, planStartDate}]

      const today = new Date();
      const atRisk = [];
      const warnings_ = [];
      const healthy = [];

      for (const p of (participants || [])) {
        const planEnd = new Date(p.planEndDate);
        const planStart = new Date(p.planStartDate);
        const daysElapsed = Math.round((today - planStart) / (24*60*60*1000));
        const totalDays = Math.round((planEnd - planStart) / (24*60*60*1000));
        const daysRemaining = Math.round((planEnd - today) / (24*60*60*1000));

        const categories = [
          { name: 'Core', total: p.coreTotal, spent: p.coreSpent },
          { name: 'Capacity Building', total: p.capacityTotal, spent: p.capacitySpent },
          { name: 'Capital', total: p.capitalTotal, spent: p.capitalSpent },
        ].filter(c => c.total > 0);

        for (const cat of categories) {
          const burnRate = daysElapsed > 0 ? cat.spent / daysElapsed : 0;
          const projectedExhaustionDays = burnRate > 0 ? Math.round((cat.total - cat.spent) / burnRate) : 999;
          const pctUsed = Math.round((cat.spent / cat.total) * 100);

          if (projectedExhaustionDays < daysRemaining - 14) {
            atRisk.push({ participant: p.name, ndisNumber: p.ndisNumber, category: cat.name, pctUsed, daysRemaining, projectedExhaustionDays, gap: daysRemaining - projectedExhaustionDays });
          } else if (pctUsed >= 80) {
            warnings_.push({ participant: p.name, category: cat.name, pctUsed, daysRemaining });
          } else {
            healthy.push({ participant: p.name, category: cat.name, pctUsed });
          }
        }
      }

      // Notify for at-risk budgets
      if (atRisk.length > 0) {
        for (const risk of atRisk) {
          await base44.entities.Notification.create({
            title: `⚠️ Budget At Risk: ${risk.participant} — ${risk.category}`,
            message: `${risk.participant} ${risk.category}: ${risk.pctUsed}% used with ${risk.daysRemaining} days remaining. At current burn rate, budget exhausts in ${risk.projectedExhaustionDays} days — ${risk.gap} days BEFORE plan end.\nSupport Sage: notify coordinator immediately. Atlas: create plan review task. Options: reduce session frequency, request plan review, find lower-rate support items.`,
            type: 'warning',
            is_read: false,
          }).catch(() => {});
        }
      }

      return Response.json({ atRisk, warnings: warnings_, healthy, summary: `${atRisk.length} at-risk | ${warnings_.length} warnings | ${healthy.length} healthy budget categories` });
    }

    // === GENERATE AUDIT PACKAGE ===
    if (action === 'generate_audit_package') {
      const { auditDate, registrationScope, documents } = data || {};
      // documents: list of document types already on file

      const practiceStandards = [
        { id: 1, name: 'Rights and Responsibilities', requiredEvidence: ['Consent forms (all participants)', 'Easy-read rights document', 'Complaint procedure document', 'Participant handbook'] },
        { id: 2, name: 'Governance and Operational Management', requiredEvidence: ['NDIS registration certificate', 'Worker screening clearances (all staff)', 'NDIS Worker Orientation Module records', 'Policies and procedures (reviewed within 12 months)', 'Organisational chart', 'Insurance certificates'] },
        { id: 3, name: 'Provision of Supports', requiredEvidence: ['Service agreements (all participants, signed)', 'Progress notes (last 3 months)', 'Support plans (all participants)', 'Incident reports (if any)', 'Evidence services are within plan budgets'] },
        { id: 4, name: 'Support Provision Environment', requiredEvidence: ['Safety inspection records', 'Equipment maintenance logs', 'Infection control policy and records', 'Emergency procedures'] },
        { id: 5, name: 'Personal Supports', requiredEvidence: ['Individualised support plans', 'Goal reviews (annual minimum)', 'Staff competency records matching participant needs'] },
        { id: 6, name: 'High Intensity Daily Personal Activities', requiredEvidence: ['Applies only if delivering high-intensity supports', 'Worker skill verification records', 'Activity-specific protocols'] },
        { id: 7, name: 'Behaviour Support Plans', requiredEvidence: ['Applies only if using restrictive practices', 'Registered behaviour support practitioner evidence', 'Behaviour support plan (NDIS-approved practitioner)', 'Restrictive practice reporting records'] },
      ];

      const onFile = new Set((documents || []).map(d => d.toLowerCase()));
      const gapsByStandard = [];
      let totalGaps = 0;

      for (const standard of practiceStandards) {
        const gaps = standard.requiredEvidence.filter(e => !Array.from(onFile).some(d => d.includes(e.toLowerCase().substring(0, 15))));
        gapsByStandard.push({ standard: `Standard ${standard.id}: ${standard.name}`, required: standard.requiredEvidence.length, gaps: gaps.length, gapList: gaps });
        totalGaps += gaps.length;
      }

      const readinessScore = Math.round(((practiceStandards.reduce((s, st) => s + st.requiredEvidence.length, 0) - totalGaps) / practiceStandards.reduce((s, st) => s + st.requiredEvidence.length, 0)) * 100);

      // Create tasks for all gaps
      for (const std of gapsByStandard) {
        if (std.gaps > 0) {
          await base44.entities.Task.create({
            title: `Audit Gap: ${std.standard} — ${std.gaps} items missing`,
            description: `Missing evidence for upcoming audit (${auditDate}):\n${std.gapList.map((g, i) => `${i+1}. ${g}`).join('\n')}\n\nScribe: gather or create these documents. Veritas: validate before audit.`,
            priority: std.gaps > 2 ? 'high' : 'medium',
            status: 'pending',
            source: 'agent',
            tags: ['ndis', 'audit', 'compliance'],
          }).catch(() => {});
        }
      }

      await base44.entities.Notification.create({
        title: `📁 Audit Package Assessment — Readiness: ${readinessScore}%`,
        message: `Audit date: ${auditDate}. Readiness score: ${readinessScore}%. Total gaps: ${totalGaps} items.\n${gapsByStandard.filter(s => s.gaps > 0).map(s => `${s.standard}: ${s.gaps} gaps`).join(' | ')}\nAtlas: ${totalGaps} remediation tasks created. Scribe: gather missing evidence. Veritas: validate before submission.`,
        type: totalGaps > 5 ? 'warning' : 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ auditDate, readinessScore, totalGaps, gapsByStandard, tasksCreated: gapsByStandard.filter(s => s.gaps > 0).length, recommendation: readinessScore >= 90 ? 'Well prepared — final polish needed' : readinessScore >= 75 ? 'Moderate gaps — focus on critical standards first' : 'Significant preparation required — begin immediately' });
    }

    // === CHECK WORKER COMPLIANCE ===
    if (action === 'check_worker_compliance') {
      const { workers } = data || {};
      // workers: [{name, role, clearanceExpiry, clearanceType, orientationComplete, firstAidExpiry, cprExpiry, mandatoryReporterComplete}]

      const today = new Date();
      const expired = [];
      const expiring = [];
      const compliant = [];

      for (const worker of (workers || [])) {
        const workerIssues = [];
        const clearanceDays = worker.clearanceExpiry ? Math.round((new Date(worker.clearanceExpiry) - today) / (24*60*60*1000)) : null;
        const firstAidDays = worker.firstAidExpiry ? Math.round((new Date(worker.firstAidExpiry) - today) / (24*60*60*1000)) : null;
        const cprDays = worker.cprExpiry ? Math.round((new Date(worker.cprExpiry) - today) / (24*60*60*1000)) : null;

        if (clearanceDays !== null && clearanceDays <= 0) workerIssues.push({ item: 'NDIS Worker Screening Clearance', status: 'EXPIRED', daysOverdue: Math.abs(clearanceDays), critical: true });
        else if (clearanceDays !== null && clearanceDays <= 30) workerIssues.push({ item: 'NDIS Worker Screening Clearance', status: 'EXPIRING', daysRemaining: clearanceDays, critical: clearanceDays <= 14 });

        if (!worker.orientationComplete) workerIssues.push({ item: 'NDIS Worker Orientation Module', status: 'NOT COMPLETED', critical: true });

        if (firstAidDays !== null && firstAidDays <= 0) workerIssues.push({ item: 'First Aid Certificate', status: 'EXPIRED', critical: false });
        else if (firstAidDays !== null && firstAidDays <= 30) workerIssues.push({ item: 'First Aid Certificate', status: 'EXPIRING', daysRemaining: firstAidDays, critical: false });

        if (cprDays !== null && cprDays <= 0) workerIssues.push({ item: 'CPR Certificate', status: 'EXPIRED', critical: false });

        if (!worker.mandatoryReporterComplete) workerIssues.push({ item: 'Mandatory Reporter Training', status: 'NOT COMPLETED', critical: false });

        const hasCritical = workerIssues.some(i => i.critical);
        const result = { name: worker.name, role: worker.role, issues: workerIssues, canDeliver: !hasCritical };

        if (hasCritical) expired.push(result);
        else if (workerIssues.length > 0) expiring.push(result);
        else compliant.push(result);

        if (hasCritical) {
          await base44.entities.Notification.create({
            title: `🔴 WORKER COMPLIANCE CRITICAL: ${worker.name}`,
            message: `${worker.name} has critical compliance issues: ${workerIssues.filter(i => i.critical).map(i => i.item + ' — ' + i.status).join(', ')}. CANNOT deliver NDIS supports until resolved. Atlas: remove from upcoming rosters immediately. Veritas: flagged to compliance register.`,
            type: 'warning',
            is_read: false,
          }).catch(() => {});
        }
      }

      return Response.json({ summary: `${compliant.length} compliant | ${expiring.length} attention needed | ${expired.length} CRITICAL — cannot deliver supports`, expired, expiring, compliant, totalWorkers: (workers || []).length });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});