import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, target_growth } = payload;

    // action: 'identify_growth_levers', 'find_collab_partners', 'design_growth_campaign', 'track_growth'

    let result = null;

    if (action === 'identify_growth_levers') {
      // Analyze current metrics and identify growth opportunities
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)
      );

      const leversResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze growth opportunities for influencer:
Current followers: ${metrics[metrics.length - 1]?.follower_count}
Growth rate: ${metrics[metrics.length - 1]?.follower_growth_weekly} /week
Engagement rate: ${metrics[metrics.length - 1]?.engagement_rate}%
Best performing content: ${metrics[metrics.length - 1]?.top_performing_posts?.map(p => p.content_type).join(', ')}

Identify:
1. Biggest growth lever (single action with highest impact)
2. Quick wins (easy to implement, fast results)
3. Long-term growth strategies
4. Content gaps
5. Audience expansion opportunities
6. Platform expansion potential`,
        response_json_schema: {
          type: 'object',
          properties: {
            biggest_lever: { type: 'string' },
            quick_wins: { type: 'array', items: { type: 'string' } },
            long_term_strategies: { type: 'array', items: { type: 'string' } },
            expected_growth_percent: { type: 'number' }
          }
        }
      });

      result = leversResponse;
    }

    if (action === 'find_collab_partners') {
      // Find compatible creators for collaboration
      const metricsTarget = metrics =>
        metrics.filter(m => m.influencer_id === influencer_id)[0];

      const myMetrics = metricsTarget(
        await base44.asServiceRole.entities.InfluencerMetrics.list()
      );

      const partnerResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Find collaboration partners for growth:
Influencer followers: ${myMetrics?.follower_count}
Niche: [similar_niche]
Engagement rate: ${myMetrics?.engagement_rate}%

Criteria for ideal partners:
1. Follower count range (2x-0.5x my size)
2. Audience overlap (20-50% ideal)
3. Engagement rates (should be comparable or higher)
4. Content compatibility
5. Geographic/language alignment

What to look for, where to find them, how to pitch.`,
        response_json_schema: {
          type: 'object',
          properties: {
            ideal_partner_profile: { type: 'string' },
            where_to_find: { type: 'array', items: { type: 'string' } },
            pitch_template: { type: 'string' },
            collaboration_ideas: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = partnerResponse;
    }

    if (action === 'design_growth_campaign') {
      // Design comprehensive growth campaign
      const campaign = await base44.asServiceRole.entities.InfluencerGrowthCampaign.create({
        influencer_id,
        campaign_name: `Growth Sprint - ${new Date().toISOString().split('T')[0]}`,
        objective: 'grow_followers',
        target_growth_percent: target_growth || 25,
        strategy: ['collaborations', 'niche_pivot', 'trend_adoption'],
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'planning'
      });

      const campaignPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `Design 90-day growth campaign:

Target: ${target_growth}% growth in 90 days

Plan:
1. Month 1: Foundation (content consistency, optimization)
2. Month 2: Acceleration (collabs, series launch, niche pivot)
3. Month 3: Momentum (viral tactics, community building)

Include:
- Weekly milestones
- Content pillars
- Collaboration targets
- Engagement targets
- Metric checkpoints`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_plan: { type: 'string' },
            weekly_milestones: { type: 'array', items: { type: 'string' } },
            success_metrics: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = { campaign_id: campaign.id, plan: campaignPlan };
    }

    if (action === 'track_growth') {
      // Track growth progress vs targets
      const campaigns = await base44.asServiceRole.entities.InfluencerGrowthCampaign.list().then(
        c => c.filter(x => x.influencer_id === influencer_id && x.status === 'active')
      );

      for (const campaign of campaigns) {
        const metricsNow = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
          m => m.filter(x => x.influencer_id === influencer_id).sort((a, b) => new Date(b.metric_date) - new Date(a.metric_date))[0]
        );

        const followerGain = metricsNow.follower_count - campaign.baseline_followers;
        const growthPercent = ((followerGain / campaign.baseline_followers) * 100).toFixed(1);

        await base44.asServiceRole.entities.InfluencerGrowthCampaign.update(campaign.id, {
          current_followers: metricsNow.follower_count,
          followers_gained: followerGain,
          actual_growth_percent: growthPercent,
          engagement_lift: metricsNow.engagement_rate - (campaign.baseline_followers * 0.01)
        });
      }

      result = { campaigns_tracked: campaigns.length };
    }

    return Response.json({
      status: 'growth_engine_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});