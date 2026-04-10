import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, time_period } = payload;

    // action: 'performance_dashboard', 'audience_insights', 'content_analysis', 'strategic_recommendations'

    let result = null;

    if (action === 'performance_dashboard') {
      // Generate comprehensive performance metrics
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id).sort((a, b) => new Date(b.metric_date) - new Date(a.metric_date))
      );

      if (metrics.length === 0) {
        return Response.json({ status: 'no_metrics_data' });
      }

      const currentMetric = metrics[0];
      const previousMetric = metrics[Math.min(7, metrics.length - 1)]; // 1 week ago

      const dashboard = {
        period: time_period || '1_month',
        follower_count: currentMetric.follower_count,
        follower_growth: currentMetric.follower_count - (previousMetric?.follower_count || 0),
        engagement_rate: currentMetric.engagement_rate,
        avg_likes_per_post: currentMetric.avg_likes_per_post,
        avg_comments_per_post: currentMetric.avg_comments_per_post,
        avg_shares_per_post: currentMetric.avg_shares_per_post,
        posts_this_month: currentMetric.total_posts_this_month,
        top_content_categories: currentMetric.content_categories?.slice(0, 3),
        best_posting_times: currentMetric.best_posting_times
      };

      result = dashboard;
    }

    if (action === 'audience_insights') {
      // Deep audience demographic and behavioral analysis
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)[0]
      );

      const insightsResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze audience for strategic insights:
${JSON.stringify(metrics?.audience_demographics)}

Provide:
1. Audience profile summary
2. Key psychographic insights
3. Buying power analysis
4. Content preferences
5. Growth opportunities in audience
6. Untapped segments
7. Audience retention strategies`,
        response_json_schema: {
          type: 'object',
          properties: {
            profile_summary: { type: 'string' },
            psychographics: { type: 'array', items: { type: 'string' } },
            buying_power: { type: 'string' },
            retention_strategies: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = insightsResponse;
    }

    if (action === 'content_analysis') {
      // Analyze what content performs best
      const posts = await base44.asServiceRole.entities.SocialPost.list().then(
        p => p.filter(x => x.created_by === user.email).slice(0, 50)
      );

      const analysis = {
        total_posts_analyzed: posts.length,
        best_performing_format: posts.reduce((acc, p) => {
          acc[p.content_type] = (acc[p.content_type] || 0) + 1;
          return acc;
        }, {}),
        avg_engagement: (posts.reduce((sum, p) => sum + (p.engagement_metrics?.engagement || 0), 0) / posts.length).toFixed(2),
        top_5_posts: posts.slice(0, 5)
      };

      result = analysis;
    }

    if (action === 'strategic_recommendations') {
      // AI-generated strategic recommendations
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)
      );

      const recommendations = await base44.integrations.Core.InvokeLLM({
        prompt: `Strategic recommendations for influencer growth:
Current metrics: ${JSON.stringify({
  followers: metrics[0]?.follower_count,
  engagement: metrics[0]?.engagement_rate,
  growth_rate: metrics[0]?.follower_growth_weekly
})}

Provide top 5 strategic recommendations:
1. Content strategy shifts
2. Audience expansion tactics
3. Monetization opportunities
4. Collaboration approaches
5. Platform diversification

Be specific and actionable.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' },
                  recommendation: { type: 'string' },
                  expected_impact: { type: 'string' },
                  implementation_time: { type: 'string' }
                }
              }
            }
          }
        }
      });

      result = recommendations;
    }

    return Response.json({
      status: 'analytics_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});