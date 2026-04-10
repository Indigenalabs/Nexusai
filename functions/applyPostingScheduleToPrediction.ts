import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { posting_schedule_id } = payload;

    // Fetch the posting schedule prediction
    const schedule = await base44.entities.PostingSchedulePrediction.read(posting_schedule_id);

    if (schedule.applied_to_calendar) {
      return Response.json({
        status: 'already_applied',
        message: 'This schedule has already been applied to the calendar'
      });
    }

    // Fetch all draft content assets that need scheduling
    const draftContent = await base44.asServiceRole.entities.ContentAsset.filter({
      status: 'draft'
    });

    // Create Tasks in Atlas to schedule content according to predictions
    const scheduledTasks = [];
    for (const prediction of schedule.predictions) {
      if (draftContent.length > 0) {
        const content = draftContent.shift();
        
        // Calculate the actual date/time for this prediction
        const scheduleDate = new Date(schedule.week_starting);
        const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
        const targetDay = dayMap[prediction.day];
        const daysToAdd = (targetDay - scheduleDate.getDay() + 7) % 7;
        scheduleDate.setDate(scheduleDate.getDate() + daysToAdd);
        
        const [hours, minutes] = prediction.optimal_time.split(':');
        scheduleDate.setHours(parseInt(hours), parseInt(minutes), 0);

        // Create task for Atlas to execute
        const task = await base44.asServiceRole.entities.Task.create({
          title: `Schedule: ${content.title} on ${schedule.platform}`,
          description: `Schedule "${content.title}" for ${prediction.day} at ${prediction.optimal_time}. Format: ${prediction.recommended_format}. Expected engagement: ${prediction.predicted_engagement_rate}%`,
          status: 'pending',
          priority: 'high',
          project: `${schedule.platform}_scheduling`,
          due_date: scheduleDate.toISOString().split('T')[0],
          source: 'system',
          source_id: posting_schedule_id,
          tags: ['posting_schedule', schedule.platform, prediction.day]
        });

        scheduledTasks.push(task.id);
      }
    }

    // Mark the schedule as applied
    await base44.asServiceRole.entities.PostingSchedulePrediction.update(posting_schedule_id, {
      applied_to_calendar: true
    });

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'schedule_applied',
      title: `✅ Posting Schedule Applied: ${schedule.platform}`,
      message: `${scheduledTasks.length} posts scheduled according to optimal posting times for ${schedule.week_starting}`,
      priority: 'high',
      action_url: `/PostingSchedulePrediction?id=${posting_schedule_id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'success',
      schedule_id: posting_schedule_id,
      platform: schedule.platform,
      week_starting: schedule.week_starting,
      tasks_created: scheduledTasks.length,
      model_confidence: Math.round(
        schedule.predictions.reduce((sum, p) => sum + p.confidence_score, 0) / schedule.predictions.length
      )
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});