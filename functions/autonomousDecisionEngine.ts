import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { decision_type, context_data } = payload;

    // decision_type: 'approve_campaign', 'price_adjustment', 'customer_churn_intervention', 'partner_escalation', 'content_takedown'

    let decision = null;

    if (decision_type === 'approve_campaign') {
      // Should we launch this campaign?
      const campaign = context_data.campaign;

      const approvalDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `Autonomously approve/reject campaign launch:
Campaign: ${campaign.name}
Budget: $${campaign.budget}
Target audience: ${campaign.target_segment}
Projected ROI: ${campaign.projected_roi}%
Brand safety score: ${campaign.brand_safety_score}
Current cash position: ${context_data.available_cash}

Decision rules:
- Reject if ROI < 200% or brand safety < 80
- Reject if budget > 50% of available cash
- Auto-approve if ROI > 400% and safety > 95
- Otherwise require human review

Return: approve/reject/review and reasoning`,
        response_json_schema: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            confidence: { type: 'number' },
            reasoning: { type: 'string' },
            conditions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      decision = approvalDecision;

      if (approvalDecision.decision === 'approve') {
        // Auto-launch
        await base44.asServiceRole.entities.Campaign.update(campaign.id, {
          status: 'active',
          approved_by: 'autonomous_system',
          approval_timestamp: new Date().toISOString()
        });

        await base44.asServiceRole.entities.Notification.create({
          type: 'campaign_auto_approved',
          title: `✅ Campaign auto-approved: ${campaign.name}`,
          message: `Budget: $${campaign.budget}. Expected ROI: ${campaign.projected_roi}%`,
          priority: 'medium',
          recipient_role: 'admin'
        });
      } else if (approvalDecision.decision === 'reject') {
        // Auto-reject
        await base44.asServiceRole.entities.Campaign.update(campaign.id, {
          status: 'rejected',
          rejection_reason: approvalDecision.reasoning
        });

        await base44.asServiceRole.entities.Task.create({
          title: `Campaign rejected: ${campaign.name}`,
          description: approvalDecision.reasoning,
          status: 'completed',
          priority: 'low',
          source: 'autonomous_system'
        });
      } else {
        // Escalate to human
        await base44.asServiceRole.entities.Notification.create({
          type: 'campaign_review_needed',
          title: `👤 Campaign needs human review: ${campaign.name}`,
          message: approvalDecision.reasoning,
          priority: 'high',
          action_url: `/Campaign?id=${campaign.id}`,
          recipient_role: 'admin'
        });
      }
    }

    if (decision_type === 'price_adjustment') {
      // Should we adjust pricing?
      const product = context_data.product;
      const currentPrice = context_data.current_price;
      const recommendedPrice = context_data.recommended_price;

      const priceDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `Autonomously decide on price adjustment:
Current price: $${currentPrice}
Recommended: $${recommendedPrice}
Change: ${(((recommendedPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%
Inventory level: ${context_data.inventory_level}
Demand forecast (7d): ${context_data.demand_forecast_7d}
Competitor prices: $${context_data.competitor_low} - $${context_data.competitor_high}

Rules:
- Auto-adjust if margin impact < -5% and change < 10%
- Reject if change > 25% or margins fall below 20%
- Auto-implement if inventory > 30d supply and demand forecasted low

Return: approve/reject/review`,
        response_json_schema: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            reasoning: { type: 'string' },
            urgency: { type: 'string' }
          }
        }
      });

      decision = priceDecision;

      if (priceDecision.decision === 'approve') {
        await base44.asServiceRole.entities.DynamicPrice.update(product.id, {
          current_price: recommendedPrice,
          last_price_update: new Date().toISOString()
        });

        await base44.asServiceRole.entities.Activity.create({
          type: 'price_auto_adjusted',
          title: `Price adjusted: ${product.name}`,
          description: `$${currentPrice} → $${recommendedPrice} (${priceDecision.reasoning})`,
          entity_type: 'Product',
          entity_id: product.id
        });
      }
    }

    if (decision_type === 'customer_churn_intervention') {
      // Should we intervene to save this customer?
      const customer = context_data.customer;

      const interventionDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `Decide on churn prevention intervention:
Customer: ${customer.email}
Lifetime value: $${customer.lifetime_value}
Days since last purchase: ${customer.days_inactive}
Churn risk score: ${customer.churn_risk}%
Engagement: ${customer.engagement_status}

Budget available for incentives: $${context_data.incentive_budget}
Max discount: 30%

Decision rules:
- Auto-send win-back offer if LTV > $500 and risk > 60%
- Include free shipping if no purchase in 60+ days
- Offer loyalty tier upgrade if risk < 40%
- Archive if LTV < $100 and risk > 80%

Return: intervention_type, offer, urgency`,
        response_json_schema: {
          type: 'object',
          properties: {
            intervention_type: { type: 'string' },
            offer_value: { type: 'number' },
            offer_type: { type: 'string' },
            urgency: { type: 'string' }
          }
        }
      });

      decision = interventionDecision;

      if (interventionDecision.intervention_type !== 'archive') {
        await base44.asServiceRole.entities.Campaign.create({
          name: `Win-back: ${customer.email}`,
          objective: 'churn_prevention',
          status: 'active',
          offer: `${interventionDecision.offer_value}${interventionDecision.offer_type === 'percent' ? '%' : '$'} ${interventionDecision.offer_type}`,
          target_customer: customer.email
        });

        await base44.asServiceRole.entities.Task.create({
          title: `Churn prevention: ${customer.email}`,
          description: `Send ${interventionDecision.offer_type} offer. Urgency: ${interventionDecision.urgency}`,
          status: 'pending',
          priority: interventionDecision.urgency === 'critical' ? 'high' : 'medium'
        });
      }
    }

    if (decision_type === 'partner_escalation') {
      // Should we escalate partner to higher tier or end relationship?
      const partner = context_data.partner;

      const partnerDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `Decide on partner relationship progression:
Partner: ${partner.company_name}
Opportunity score: ${partner.opportunity_score}
Leads generated (90d): ${partner.leads_generated}
Revenue attributed: $${partner.revenue_attributed}
Relationship strength: ${partner.relationship_strength}%

Decision:
- Escalate if score > 80 and revenue > $10k
- Deepen if score 60-80 and leads > 20
- Maintain if score 40-60
- End if score < 30

Return: action, new_tier, recommended_investment`,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            new_tier: { type: 'string' },
            recommended_investment: { type: 'number' },
            next_milestone: { type: 'string' }
          }
        }
      });

      decision = partnerDecision;

      if (partnerDecision.action === 'escalate' || partnerDecision.action === 'deepen') {
        await base44.asServiceRole.entities.Partner.update(partner.id, {
          status: 'active',
          relationship_strength: Math.min(100, partner.relationship_strength + 20)
        });

        await base44.asServiceRole.entities.Task.create({
          title: `Partner escalation: ${partner.company_name}`,
          description: `Escalate to ${partnerDecision.new_tier}. Investment: $${partnerDecision.recommended_investment}. Next: ${partnerDecision.next_milestone}`,
          status: 'pending',
          priority: 'high'
        });
      } else if (partnerDecision.action === 'end') {
        await base44.asServiceRole.entities.Partner.update(partner.id, {
          status: 'ended'
        });
      }
    }

    // Log decision
    await base44.asServiceRole.entities.Activity.create({
      type: 'autonomous_decision',
      title: `Decision: ${decision_type}`,
      description: JSON.stringify(decision),
      entity_type: 'Decision'
    });

    return Response.json({
      status: 'decision_complete',
      decision_type,
      decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});