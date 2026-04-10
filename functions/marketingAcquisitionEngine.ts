import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, campaign_data } = payload;

    // action: 'analyze_market', 'generate_content', 'launch_campaign', 'optimize_budget', 'track_roi'

    let result = null;

    if (action === 'analyze_market') {
      // Compass + Sage: identify high-opportunity segments
      const analysisResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze market for participant acquisition opportunities:
Sector: ${campaign_data.sector} (NDIS/Aged Care)
Region: ${campaign_data.region}
Service type: ${campaign_data.service_type}

Identify:
1. Top 3 target segments (demographics, needs)
2. Competitor analysis (who else serves these)
3. Messaging angles (pain points to address)
4. Recommended channels
5. Budget allocation (%)
6. Expected ROI`,
        response_json_schema: {
          type: 'object',
          properties: {
            target_segments: { type: 'array', items: { type: 'string' } },
            competitor_density: { type: 'string' },
            messaging_angles: { type: 'array', items: { type: 'string' } },
            recommended_channels: { type: 'array', items: { type: 'string' } },
            budget_allocation: { type: 'object' },
            expected_cpa: { type: 'number' },
            opportunity_score: { type: 'number' }
          }
        }
      });

      result = analysisResponse;
    }

    if (action === 'generate_content') {
      // Marketing AI + Canvas: create campaign content variants
      const contentResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Create marketing content for ${campaign_data.sector} acquisition:
Segment: ${campaign_data.target_segment}
Service: ${campaign_data.service_type}
Tone: empathetic, professional
Include: pain point, solution, CTA

Generate:
- Blog post headline and opening paragraph
- 3 social media ad copy variants
- Email subject and preview text
- Easy-read explainer (short, simple language)`,
        response_json_schema: {
          type: 'object',
          properties: {
            blog_headline: { type: 'string' },
            blog_intro: { type: 'string' },
            ad_copy_variants: { type: 'array', items: { type: 'string' } },
            email_subject: { type: 'string' },
            email_preview: { type: 'string' },
            easy_read_summary: { type: 'string' }
          }
        }
      });

      // Save content to campaign
      result = {
        status: 'content_generated',
        content: contentResponse
      };
    }

    if (action === 'launch_campaign') {
      // Create AcquisitionCampaignNDIS record and schedule publishing
      const campaign = await base44.asServiceRole.entities.AcquisitionCampaignNDIS.create({
        campaign_name: campaign_data.name,
        target_sector: campaign_data.sector,
        target_segment: campaign_data.segment,
        campaign_type: campaign_data.type,
        channels: campaign_data.channels || [],
        budget_allocated: campaign_data.budget || 5000,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active',
        auto_optimisation_enabled: campaign_data.auto_optimise || false
      });

      // Schedule content publishing via Maestro/Canvas
      await base44.asServiceRole.entities.Task.create({
        title: `Publish campaign: ${campaign.campaign_name}`,
        description: `Launch on channels: ${campaign_data.channels.join(', ')}`,
        status: 'pending',
        priority: 'high',
        source: 'system',
        source_id: campaign.id
      });

      result = {
        status: 'campaign_launched',
        campaign_id: campaign.id,
        budget: campaign.budget_allocated,
        duration: '30 days'
      };
    }

    if (action === 'optimize_budget') {
      // Sage: analyze performance and reallocate budget
      const optimizationResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize marketing budget allocation:
Current spend: ${JSON.stringify(campaign_data.channel_spend)}
Performance metrics: ${JSON.stringify(campaign_data.channel_performance)}

Recommend:
1. Which channels to increase
2. Which channels to decrease/pause
3. New channels to test
4. Expected impact on ROI`,
        response_json_schema: {
          type: 'object',
          properties: {
            allocations: { type: 'object' },
            expected_roi_improvement: { type: 'number' },
            rationale: { type: 'string' }
          }
        }
      });

      result = optimizationResponse;
    }

    if (action === 'track_roi') {
      // Calculate ROI for a campaign
      const campaign = campaign_data.campaign;
      const roi = ((campaign.revenue_from_campaign - campaign.budget_spent) / campaign.budget_spent) * 100;
      const ltv = campaign.revenue_from_campaign / Math.max(campaign.participants_acquired, 1);
      const cpa = campaign.budget_spent / Math.max(campaign.participants_acquired, 1);

      result = {
        campaign_id: campaign.id,
        roi_percent: roi.toFixed(1),
        cost_per_acquisition: cpa.toFixed(2),
        lifetime_value_per_participant: ltv.toFixed(2),
        efficiency_status: roi > 300 ? 'excellent' : roi > 100 ? 'good' : 'needs_optimization'
      };
    }

    return Response.json({
      status: 'marketing_action_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});