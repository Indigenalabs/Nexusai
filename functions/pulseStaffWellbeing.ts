import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, staff_id } = payload;

    // action: 'check_in', 'burnout_analysis', 'wellness_score', 'celebration', 'intervention'

    let result = null;

    if (action === 'check_in') {
      // Create wellness check-in for staff member
      const wellnessCheckIn = await base44.asServiceRole.entities.StaffWellness.create({
        staff_id,
        staff_name: user.full_name || 'Staff',
        check_in_date: new Date().toISOString(),
        wellbeing_score: payload.wellbeing_score || 50,
        stress_level: payload.stress_level || 'moderate',
        workload_assessment: payload.workload_assessment || 'manageable',
        mood: payload.mood || 'neutral',
        support_needed: payload.support_needed || []
      });

      // If stress is high or wellbeing is low, flag for follow-up
      if ((payload.wellbeing_score || 50) < 40 || payload.stress_level === 'critical') {
        await base44.asServiceRole.entities.StaffWellness.update(wellnessCheckIn.id, {
          follow_up_required: true,
          burnout_risk: 'high'
        });

        // Create task for manager
        await base44.asServiceRole.entities.Task.create({
          title: `Wellness follow-up: ${user.full_name}`,
          description: `Wellbeing score: ${payload.wellbeing_score}. Stress: ${payload.stress_level}. Support needed: ${(payload.support_needed || []).join(', ')}`,
          status: 'pending',
          priority: 'high',
          source: 'wellness_system'
        });

        // Send notification
        await base44.asServiceRole.entities.Notification.create({
          type: 'wellness_alert',
          title: `💙 Wellness check-in: ${user.full_name}`,
          message: `Wellbeing score: ${payload.wellbeing_score}. Please check in with them.`,
          priority: 'high',
          recipient_role: 'admin'
        });
      }

      result = { check_in_id: wellnessCheckIn.id, status: 'recorded' };
    }

    if (action === 'burnout_analysis') {
      // Analyze risk of burnout for a staff member
      const recentCheckins = await base44.asServiceRole.entities.StaffWellness.list().then(
        w => w.filter(x => x.staff_id === staff_id).slice(-10)
      );

      if (recentCheckins.length < 3) {
        return Response.json({ status: 'insufficient_data', message: 'Need at least 3 check-ins for analysis' });
      }

      // Analyze trend
      const avgWellbeing = recentCheckins.reduce((sum, w) => sum + (w.wellbeing_score || 0), 0) / recentCheckins.length;
      const highStressCount = recentCheckins.filter(w => w.stress_level === 'high' || w.stress_level === 'critical').length;
      const trendingDown = recentCheckins[recentCheckins.length - 1].wellbeing_score < recentCheckins[0].wellbeing_score;

      const burnoutAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze burnout risk for staff member:
Recent wellbeing scores: ${recentCheckins.map(w => w.wellbeing_score).join(', ')}
Average: ${avgWellbeing.toFixed(0)}
High stress instances: ${highStressCount} of ${recentCheckins.length}
Trending: ${trendingDown ? 'down' : 'stable/up'}
Support requested: ${recentCheckins.map(w => w.support_needed?.join(',') || 'none').join('; ')}

Provide:
- Burnout risk level (low/medium/high)
- Key warning signs
- Recommended interventions
- Wellness plan suggestions`,
        response_json_schema: {
          type: 'object',
          properties: {
            burnout_risk: { type: 'string' },
            warning_signs: { type: 'array', items: { type: 'string' } },
            interventions: { type: 'array', items: { type: 'string' } },
            wellness_plan: { type: 'string' }
          }
        }
      });

      // Update staff record
      await base44.asServiceRole.entities.WorkerProfile.list().then(async workers => {
        const worker = workers.find(w => w.staff_id === staff_id);
        if (worker) {
          // Pulse updates worker record with wellbeing insights
          await base44.asServiceRole.entities.Activity.create({
            type: 'burnout_analysis',
            title: `Burnout analysis: ${staff_id}`,
            description: `Risk: ${burnoutAnalysis.burnout_risk}. Recommend: ${burnoutAnalysis.interventions.join(', ')}`,
            entity_type: 'WorkerProfile',
            entity_id: worker.id
          });
        }
      });

      result = burnoutAnalysis;
    }

    if (action === 'wellness_score') {
      // Calculate organizational wellness score
      const allCheckins = await base44.asServiceRole.entities.StaffWellness.list();

      if (allCheckins.length === 0) {
        return Response.json({ status: 'no_data' });
      }

      const wellnessMetrics = {
        total_staff_checked_in: allCheckins.length,
        avg_wellbeing: (allCheckins.reduce((sum, w) => sum + (w.wellbeing_score || 0), 0) / allCheckins.length).toFixed(0),
        high_stress_count: allCheckins.filter(w => w.stress_level === 'critical').length,
        at_risk_count: allCheckins.filter(w => w.burnout_risk === 'high').length,
        support_requests: {}
      };

      // Count support requests
      for (const checkin of allCheckins) {
        for (const support of (checkin.support_needed || [])) {
          wellnessMetrics.support_requests[support] = (wellnessMetrics.support_requests[support] || 0) + 1;
        }
      }

      result = wellnessMetrics;
    }

    if (action === 'celebration') {
      // Celebrate staff milestones (work anniversaries, achievements)
      const worker = await base44.asServiceRole.entities.WorkerProfile.read(staff_id).catch(() => null);

      if (!worker) {
        return Response.json({ status: 'worker_not_found' });
      }

      // Check for milestones
      const milestones = [];
      if (worker.experience_years && worker.experience_years % 5 === 0) {
        milestones.push(`${worker.experience_years} years with the organisation`);
      }

      // Send celebration notification
      if (milestones.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'milestone_celebration',
          title: `🎉 Celebrating ${worker.name}!`,
          message: `Milestone: ${milestones.join(', ')}. Thank you for your dedication!`,
          priority: 'low',
          recipient_role: 'admin'
        });

        result = { status: 'celebrated', milestones };
      } else {
        result = { status: 'no_milestone', message: 'No milestone date this month' };
      }
    }

    if (action === 'intervention') {
      // Proactive intervention for staff member at risk
      const atRiskWorker = await base44.asServiceRole.entities.WorkerProfile.read(staff_id).catch(() => null);
      const recentCheckins = await base44.asServiceRole.entities.StaffWellness.list().then(
        w => w.filter(x => x.staff_id === staff_id).slice(-5)
      );

      if (!atRiskWorker || recentCheckins.length === 0) {
        return Response.json({ status: 'no_data' });
      }

      // Generate intervention plan
      const interventionPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a wellness intervention plan for ${atRiskWorker.name}:
Current wellbeing: ${recentCheckins[recentCheckins.length - 1].wellbeing_score}
Stress level: ${recentCheckins[recentCheckins.length - 1].stress_level}
Days without time off: ${recentCheckins[recentCheckins.length - 1].days_since_last_day_off}
Requested support: ${recentCheckins[recentCheckins.length - 1].support_needed?.join(', ') || 'none'}

Provide:
- Immediate actions (this week)
- Short-term support (2-4 weeks)
- Long-term wellness strategy
- Manager talking points`,
        response_json_schema: {
          type: 'object',
          properties: {
            immediate_actions: { type: 'array', items: { type: 'string' } },
            short_term_support: { type: 'array', items: { type: 'string' } },
            long_term_strategy: { type: 'string' },
            manager_talking_points: { type: 'string' }
          }
        }
      });

      // Create task for manager follow-up
      await base44.asServiceRole.entities.Task.create({
        title: `Wellness intervention: ${atRiskWorker.name}`,
        description: `Immediate: ${interventionPlan.immediate_actions.join('. ')}`,
        status: 'pending',
        priority: 'high',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      result = interventionPlan;
    }

    return Response.json({
      status: 'wellness_action_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});