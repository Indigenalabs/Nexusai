import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, content_id, platforms, orchestration_type = 'staggered', stagger_minutes = 15 } = payload;

    // platforms format: [{platform: 'instagram', content_variant_id: '...', scheduled_time: '...'}]

    if (!platforms || platforms.length === 0) {
      return Response.json({
        status: 'error',
        message: 'At least one platform is required for orchestration'
      }, { status: 400 });
    }

    // Calculate posting times based on orchestration type
    let platformSchedules = [];
    const startTime = new Date();

    if (orchestration_type === 'simultaneous') {
      // All at same time
      platformSchedules = platforms.map(p => ({
        ...p,
        scheduled_time: startTime.toISOString()
      }));
    } else if (orchestration_type === 'staggered') {
      // Stagger by X minutes
      platformSchedules = platforms.map((p, index) => ({
        ...p,
        scheduled_time: new Date(startTime.getTime() + index * stagger_minutes * 60000).toISOString()
      }));
    } else if (orchestration_type === 'sequential') {
      // Wait for first to complete (assume 2 hours between)
      platformSchedules = platforms.map((p, index) => ({
        ...p,
        scheduled_time: new Date(startTime.getTime() + index * 2 * 60 * 60000).toISOString()
      }));
    } else {
      // Custom times already provided
      platformSchedules = platforms;
    }

    // Create CrossPlatformSchedule record
    const schedule = await base44.asServiceRole.entities.CrossPlatformSchedule.create({
      campaign_id,
      content_id,
      name: `${orchestration_type} Multi-Platform Post`,
      platforms: platformSchedules.map(p => ({
        platform: p.platform,
        scheduled_time: p.scheduled_time,
        content_variant_id: p.content_variant_id,
        status: 'scheduled'
      })),
      orchestration_type,
      stagger_minutes: orchestration_type === 'staggered' ? stagger_minutes : null,
      status: 'active',
      created_at: new Date().toISOString()
    });

    // Create Tasks for scheduling on each platform
    for (const platformSchedule of platformSchedules) {
      await base44.asServiceRole.entities.Task.create({
        title: `Post: ${orchestration_type} - ${platformSchedule.platform}`,
        description: `Publish content to ${platformSchedule.platform} as part of multi-platform orchestration`,
        status: 'pending',
        priority: 'high',
        project: `orchestration_${schedule.id}`,
        due_date: platformSchedule.scheduled_time.split('T')[0],
        source: 'system',
        source_id: schedule.id,
        tags: ['orchestration', platformSchedule.platform]
      });
    }

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'multi_platform_scheduled',
      title: `📱 Multi-Platform Post Orchestrated`,
      message: `${platforms.length} posts scheduled across ${platforms.map(p => p.platform).join(', ')} (${orchestration_type})`,
      priority: 'high',
      action_url: `/CrossPlatformSchedule?id=${schedule.id}`,
      recipient_role: 'admin'
    });

    // Create Insight record
    await base44.asServiceRole.entities.Insight.create({
      type: 'orchestration_scheduled',
      title: `Multi-Platform Orchestration: ${orchestration_type}`,
      description: `${platforms.length} platforms, ${stagger_minutes || 0}min stagger, starting ${startTime.toISOString()}`,
      data: { schedule_id: schedule.id, campaign_id, platform_count: platforms.length },
      status: 'new'
    });

    return Response.json({
      status: 'success',
      schedule_id: schedule.id,
      campaign_id,
      platforms_scheduled: platforms.length,
      orchestration_type,
      first_post_time: platformSchedules[0].scheduled_time,
      stagger_minutes: orchestration_type === 'staggered' ? stagger_minutes : 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});