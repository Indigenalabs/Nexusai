import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, posts } = payload;

    // action: 'optimize_schedule', 'cross_platform_sync', 'adaptive_repost', 'schedule_posts'

    let result = null;

    if (action === 'optimize_schedule') {
      // Analyze metrics and optimize posting times
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id).slice(-4) // Last 4 weeks
      );

      if (metrics.length === 0) {
        return Response.json({ status: 'insufficient_data' });
      }

      const optimizedSchedule = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze engagement data and optimize posting schedule:
Recent metrics: ${JSON.stringify(metrics.map(m => ({
  date: m.metric_date,
  engagement: m.engagement_rate,
  best_times: m.best_posting_times
})))}

Recommend:
1. Optimal posting times (by day)
2. Frequency (posts per week)
3. Content mix (%)
4. Days to avoid
5. Peak engagement windows`,
        response_json_schema: {
          type: 'object',
          properties: {
            optimal_times: { type: 'object' },
            recommended_frequency: { type: 'number' },
            content_mix: { type: 'object' },
            expected_engagement_lift: { type: 'number' }
          }
        }
      });

      result = optimizedSchedule;
    }

    if (action === 'cross_platform_sync') {
      // Coordinate posting across platforms
      const syncPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `Create cross-platform posting orchestration:

Provide:
1. Which content to post where (Instagram, TikTok, YouTube, Twitter)
2. Time stagger (simultaneous vs sequential)
3. Platform-specific adaptations (captions, hashtags, format)
4. Hashtag strategy per platform
5. Engagement tactics per platform`,
        response_json_schema: {
          type: 'object',
          properties: {
            platform_schedule: { type: 'object' },
            stagger_minutes: { type: 'number' },
            adaptations: { type: 'object' }
          }
        }
      });

      result = syncPlan;
    }

    if (action === 'adaptive_repost') {
      // Intelligently repost high-performing content
      const socialPosts = await base44.asServiceRole.entities.SocialPost.list().then(
        p => p.filter(x => x.created_by === user.email).sort((a, b) => (b.engagement_metrics?.engagement || 0) - (a.engagement_metrics?.engagement || 0)).slice(0, 10)
      );

      const repostPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `Create adaptive reposting strategy for top posts:
Top posts: ${JSON.stringify(socialPosts.map(p => ({
  id: p.id,
  engagement: p.engagement_metrics?.engagement,
  days_old: p.created_date
})))}

For each:
1. Should repost? (yes/no + confidence)
2. When to repost (timing)
3. New caption/hook
4. Changes to make (timing, hashtags)
5. Expected lift`,
        response_json_schema: {
          type: 'object',
          properties: {
            repost_candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  post_id: { type: 'string' },
                  should_repost: { type: 'boolean' },
                  optimal_time: { type: 'string' },
                  new_caption: { type: 'string' }
                }
              }
            }
          }
        }
      });

      result = repostPlan;
    }

    if (action === 'schedule_posts') {
      // Schedule posts across platforms at optimal times
      for (const post of posts) {
        // Create cross-platform schedule
        await base44.asServiceRole.entities.CrossPlatformSchedule.create({
          campaign_id: influencer_id,
          content_id: post.content_id,
          name: post.title || 'Scheduled post',
          platforms: post.platforms.map(p => ({
            platform: p,
            scheduled_time: post.optimal_time,
            status: 'scheduled'
          })),
          status: 'active',
          orchestration_type: 'staggered',
          stagger_minutes: 15
        });
      }

      result = {
        status: 'posts_scheduled',
        post_count: posts.length,
        scheduled_date: new Date().toISOString()
      };
    }

    return Response.json({
      status: 'scheduling_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});