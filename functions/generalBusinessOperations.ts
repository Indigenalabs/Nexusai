import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, business_stage } = payload;

    // action: 'business_plan_generator', 'market_entry_strategy', 'scaling_roadmap', 'risk_assessment'

    let result = null;

    if (action === 'business_plan_generator') {
      // Generate comprehensive business plan
      const plan = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate business plan for ${payload.business_name}:
Industry: ${payload.industry}
Stage: ${business_stage}

Include:
1. Executive summary (1 page)
2. Company description
3. Market analysis
4. Competitive analysis
5. Marketing and sales strategy
6. Operations plan
7. Financial projections (3-5 years)
8. Funding requirements
9. Use of funds
10. Exit strategy`,
        response_json_schema: {
          type: 'object',
          properties: {
            business_plan: { type: 'string' },
            executive_summary: { type: 'string' },
            financial_projections: { type: 'object' }
          }
        }
      );

      result = plan;
    }

    if (action === 'market_entry_strategy') {
      // Develop market entry strategy
      const strategy = await base44.integrations.Core.InvokeLLM({
        prompt: `Develop market entry strategy for ${payload.target_market}:

Create:
1. Market analysis (size, growth, trends)
2. Target customer profile
3. Positioning strategy
4. Go-to-market plan (launch timeline)
5. Pricing strategy
6. Distribution channels
7. Marketing & sales plan
8. Budget allocation
9. Key milestones
10. Risk mitigation`,
        response_json_schema: {
          type: 'object',
          properties: {
            market_analysis: { type: 'string' },
            gtm_timeline_weeks: { type: 'number' },
            budget_estimate: { type: 'number' },
            key_risks: { type: 'array', items: { type: 'string' } }
          }
        }
      );

      result = strategy;
    }

    if (action === 'scaling_roadmap') {
      // Create scaling roadmap
      const roadmap = await base44.integrations.Core.InvokeLLM({
        prompt: `Create 3-year scaling roadmap for ${business_stage} business:

Define:
1. Phase 1 (Year 1): Foundation - what to accomplish
2. Phase 2 (Year 2): Growth - accelerate revenue
3. Phase 3 (Year 3): Scale - optimize and expand

For each phase:
- Revenue targets
- Team size
- Key hires needed
- Capital requirements
- Product/service expansion
- Market expansion
- Technology investments
- Success metrics`,
        response_json_schema: {
          type: 'object',
          properties: {
            year_1_targets: { type: 'object' },
            year_2_targets: { type: 'object' },
            year_3_targets: { type: 'object' },
            total_capital_needed: { type: 'number' }
          }
        }
      );

      result = roadmap;
    }

    if (action === 'risk_assessment') {
      // Comprehensive risk assessment
      const assessment = await base44.integrations.Core.InvokeLLM({
        prompt: `Risk assessment for ${payload.business_name}:

Identify:
1. Market risks (competition, demand)
2. Operational risks (supply chain, staffing)
3. Financial risks (cash flow, profitability)
4. Regulatory risks (compliance, licensing)
5. Reputational risks (customer satisfaction, PR)
6. Technology risks (system failures, cyber)
7. Strategic risks (wrong direction, pivots)

For each: likelihood (high/medium/low), impact (high/medium/low), mitigation strategy`,
        response_json_schema: {
          type: 'object',
          properties: {
            critical_risks: { type: 'array', items: { type: 'string' } },
            mitigation_strategies: { type: 'array', items: { type: 'string' } },
            risk_score: { type: 'number' },
            insurance_recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      );

      result = assessment;
    }

    return Response.json({
      status: 'general_business_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});