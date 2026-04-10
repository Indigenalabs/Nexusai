import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, brand_id, product_id } = payload;

    // action: 'find_brand_deals', 'manage_affiliates', 'merchandise_strategy', 'monetization_mix'

    let result = null;

    if (action === 'find_brand_deals') {
      // Identify potential brand partnership opportunities
      const metrics = await base44.asServiceRole.entities.InfluencerMetrics.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)[0]
      );

      const dealsResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Find brand partnership opportunities:
Follower count: ${metrics?.follower_count}
Engagement rate: ${metrics?.engagement_rate}%
Audience interests: ${metrics?.audience_demographics?.interests?.join(', ') || 'general'}

Provide:
1. Ideal brand categories (best fit for niche)
2. Brand discovery sources
3. Pitch email template
4. Deal structure options (flat fee, performance, affiliate)
5. Rate recommendations based on followers
6. Negotiation tips
7. Red flags to avoid`,
        response_json_schema: {
          type: 'object',
          properties: {
            ideal_brands: { type: 'array', items: { type: 'string' } },
            rate_recommendation: { type: 'number' },
            pitch_template: { type: 'string' },
            deal_structures: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = dealsResponse;
    }

    if (action === 'manage_affiliates') {
      // Track and optimize affiliate links
      const affiliates = await base44.asServiceRole.entities.AffiliateLink.list().then(
        a => a.filter(x => x.influencer_id === influencer_id)
      );

      const affiliateAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze affiliate link performance:
${JSON.stringify(affiliates.map(a => ({
  product: a.product_name,
  clicks: a.clicks,
  conversions: a.conversions,
  commission_earned: a.total_commission_earned,
  conversion_rate: ((a.conversions / a.clicks) * 100).toFixed(1)
})))}

Recommend:
1. Top 3 performing products (keep promoting)
2. Underperforming products (pause or optimize pitch)
3. New product categories to add
4. Affiliate network optimization
5. Content strategies to boost conversions
6. Expected monthly earnings increase`,
        response_json_schema: {
          type: 'object',
          properties: {
            top_performers: { type: 'array', items: { type: 'string' } },
            underperformers: { type: 'array', items: { type: 'string' } },
            new_opportunities: { type: 'array', items: { type: 'string' } },
            estimated_monthly_earnings: { type: 'number' }
          }
        }
      });

      result = affiliateAnalysis;
    }

    if (action === 'merchandise_strategy') {
      // Design merchandise strategy and launch
      const merch = await base44.asServiceRole.entities.MerchandiseProduct.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)
      );

      const merchStrategy = await base44.integrations.Core.InvokeLLM({
        prompt: `Design merch strategy:
Current merch: ${merch.map(m => m.product_name).join(', ') || 'none'}
Total merch revenue: $${merch.reduce((sum, m) => sum + (m.total_revenue || 0), 0)}

Provide:
1. Merch product roadmap (what to launch)
2. Price points based on niche
3. Supplier options (print-on-demand vs bulk)
4. Launch strategy
5. Marketing plan
6. Profitability analysis (margins)
7. Seasonal opportunities`,
        response_json_schema: {
          type: 'object',
          properties: {
            product_roadmap: { type: 'array', items: { type: 'string' } },
            recommended_prices: { type: 'object' },
            supplier_options: { type: 'array', items: { type: 'string' } },
            expected_monthly_revenue: { type: 'number' }
          }
        }
      });

      result = merchStrategy;
    }

    if (action === 'monetization_mix') {
      // Optimize income streams
      const brandDeals = await base44.asServiceRole.entities.BrandDeal.list().then(
        b => b.filter(x => x.influencer_id === influencer_id)
      );
      const affiliates = await base44.asServiceRole.entities.AffiliateLink.list().then(
        a => a.filter(x => x.influencer_id === influencer_id)
      );
      const merch = await base44.asServiceRole.entities.MerchandiseProduct.list().then(
        m => m.filter(x => x.influencer_id === influencer_id)
      );

      const dealRevenue = brandDeals.reduce((sum, d) => sum + (d.payment_received || 0), 0);
      const affiliateRevenue = affiliates.reduce((sum, a) => sum + (a.total_commission_earned || 0), 0);
      const merchRevenue = merch.reduce((sum, m) => sum + (m.total_profit || 0), 0);
      const totalRevenue = dealRevenue + affiliateRevenue + merchRevenue;

      const mixOptimization = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize monetization income mix:
Current breakdown:
- Brand deals: $${dealRevenue} (${dealRevenue > 0 ? ((dealRevenue / totalRevenue) * 100).toFixed(0) : 0}%)
- Affiliate: $${affiliateRevenue} (${affiliateRevenue > 0 ? ((affiliateRevenue / totalRevenue) * 100).toFixed(0) : 0}%)
- Merch: $${merchRevenue} (${merchRevenue > 0 ? ((merchRevenue / totalRevenue) * 100).toFixed(0) : 0}%)
Total monthly: $${totalRevenue}

Recommend:
1. Ideal income mix (percentage breakdown)
2. Which streams to grow
3. Which to de-emphasize
4. New monetization opportunities
5. 12-month revenue projection
6. Scaling milestones`,
        response_json_schema: {
          type: 'object',
          properties: {
            ideal_mix: { type: 'object' },
            growth_priorities: { type: 'array', items: { type: 'string' } },
            new_opportunities: { type: 'array', items: { type: 'string' } },
            projected_annual_revenue: { type: 'number' }
          }
        }
      });

      result = mixOptimization;
    }

    return Response.json({
      status: 'monetization_engine_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});