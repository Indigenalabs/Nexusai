import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, variable_being_tested, platform, variant_a_content, variant_b_content, test_duration_days = 7 } = payload;

    // Create ABTest record
    const abTest = await base44.asServiceRole.entities.ABTest.create({
      campaign_id,
      test_name: `${variable_being_tested} A/B Test`,
      variable_being_tested,
      platform,
      variant_a: {
        name: 'Variant A',
        content: variant_a_content,
        posts_using_this: 0
      },
      variant_b: {
        name: 'Variant B',
        content: variant_b_content,
        posts_using_this: 0
      },
      status: 'running',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + test_duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    // Create two SocialPost variants
    const postA = await base44.asServiceRole.entities.SocialPost.create({
      platform,
      caption: variant_a_content,
      status: 'draft',
      tags: ['ab_test', abTest.id, 'variant_a']
    });

    const postB = await base44.asServiceRole.entities.SocialPost.create({
      platform,
      caption: variant_b_content,
      status: 'draft',
      tags: ['ab_test', abTest.id, 'variant_b']
    });

    // Create notification for scheduling both
    await base44.asServiceRole.entities.Notification.create({
      type: 'ab_test_ready',
      title: `🧪 A/B Test Ready: ${variable_being_tested}`,
      message: `Test running for ${test_duration_days} days on ${platform}. Variant A vs B ready to post.`,
      priority: 'medium',
      action_url: `/ABTest?id=${abTest.id}`,
      recipient_role: 'admin'
    });

    // Create Task to schedule both posts
    await base44.asServiceRole.entities.Task.create({
      title: `Schedule A/B Test: ${variable_being_tested}`,
      description: `Post both variants to ${platform} at the same time. Track separate metrics.`,
      status: 'pending',
      priority: 'high',
      project: 'ab_testing',
      source: 'system',
      source_id: abTest.id,
      tags: ['ab_test']
    });

    return Response.json({
      status: 'success',
      test_id: abTest.id,
      variable: variable_being_tested,
      platform,
      duration_days: test_duration_days,
      post_a_id: postA.id,
      post_b_id: postB.id,
      start_date: abTest.start_date,
      end_date: abTest.end_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});