import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { workflow_type, trigger_data } = payload;

    // workflow_type: 'lead_to_customer', 'viral_campaign_launch', 'ndis_referral_pipeline', 'emergency_inventory_restock', 'fraud_prevention_cascade'

    let workflowResult = null;

    if (workflow_type === 'lead_to_customer') {
      // End-to-end: Lead capture → Lead scoring → Prospect outreach → Campaign personalization → Conversion tracking
      const lead = trigger_data.lead;

      // Step 1: Score lead using Sage
      const scoreResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Score this lead for conversion likelihood:
Lead: ${lead.name}, ${lead.email}
Source: ${lead.source}
Engagement history: ${lead.engagement_level}
Score 0-100 and categorize as hot/warm/cold.`,
        response_json_schema: {
          type: 'object',
          properties: { score: { type: 'number' }, category: { type: 'string' } }
        }
      });

      // Step 2: Create personalized campaign segment
      const segment = await base44.asServiceRole.entities.CustomerSegment.create({
        segment_name: `Lead: ${lead.name}`,
        segment_type: 'behavioral',
        criteria: { min_lifetime_value: 0 },
        marketing_cadence: scoreResponse.score > 70 ? 'weekly' : 'monthly'
      });

      // Step 3: Trigger outreach task
      await base44.asServiceRole.entities.Task.create({
        title: `Outreach: ${lead.name}`,
        description: `${scoreResponse.category.toUpperCase()} lead. Score: ${scoreResponse.score}. Personalize for ${lead.source}.`,
        status: 'pending',
        priority: scoreResponse.score > 70 ? 'high' : 'medium',
        assignee: user.email,
        source: 'workflow',
        source_id: lead.id
      });

      // Step 4: Schedule follow-up automation
      await base44.asServiceRole.entities.Task.create({
        title: `Follow-up: ${lead.name}`,
        description: 'Send nurture email sequence',
        status: 'pending',
        priority: 'medium',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      workflowResult = {
        lead_id: lead.id,
        lead_quality_score: scoreResponse.score,
        segment_id: segment.id,
        next_actions: ['personalize_campaign', 'send_outreach', 'track_engagement']
      };
    }

    if (workflow_type === 'viral_campaign_launch') {
      // Monitor → Trend detection → Content generation → Multi-platform scheduling → Real-time optimization
      const trend = trigger_data.trend;

      // Step 1: Validate trend viability
      const trendValidation = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess if this trend is viable for brand campaigns:
Trend: ${trend.name}
Platforms: ${trend.platforms?.join(', ')}
Current momentum: ${trend.momentum_score}
Audience alignment: ${trend.audience_fit}

Return: is_viable (true/false), reason, recommended_format, expected_reach`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_viable: { type: 'boolean' },
            reason: { type: 'string' },
            recommended_format: { type: 'string' },
            expected_reach: { type: 'number' }
          }
        }
      });

      if (!trendValidation.is_viable) {
        return Response.json({ status: 'trend_not_viable', reason: trendValidation.reason });
      }

      // Step 2: Generate content variants
      const contentVariants = await base44.asServiceRole.entities.TrendContent.create({
        trend_id: trend.id,
        trend_topic: trend.name,
        content_type: trendValidation.recommended_format,
        platform: 'all',
        generated_content: `Content for ${trend.name}`,
        status: 'pending_approval'
      });

      // Step 3: Schedule across platforms
      const schedule = await base44.asServiceRole.entities.CrossPlatformSchedule.create({
        campaign_id: trend.campaign_id || 'viral_campaign',
        content_id: contentVariants.id,
        name: `${trend.name} - Viral Push`,
        platforms: trend.platforms.map(p => ({
          platform: p,
          scheduled_time: new Date().toISOString(),
          status: 'pending'
        })),
        orchestration_type: 'staggered',
        stagger_minutes: 15
      });

      // Step 4: Set up real-time monitoring
      await base44.asServiceRole.entities.Activity.create({
        type: 'campaign_launched',
        title: `Viral campaign: ${trend.name}`,
        description: `Monitoring ${trend.platforms.join(', ')} with staggered posting`,
        entity_type: 'Trend',
        entity_id: trend.id
      });

      workflowResult = {
        campaign_id: schedule.id,
        trend: trend.name,
        platforms: trend.platforms,
        expected_reach: trendValidation.expected_reach,
        status: 'active_monitoring'
      };
    }

    if (workflow_type === 'ndis_referral_pipeline') {
      // Partner discovery → Lead qualification → Relationship nurturing → Deal tracking
      const partner = trigger_data.partner;

      // Step 1: Score partner opportunity
      const partnerScore = await base44.integrations.Core.InvokeLLM({
        prompt: `Score NDIS/Aged Care referral partner opportunity:
Partner: ${partner.company_name}
Contact: ${partner.contact_name}
Type: ${partner.type}
Audience: ${partner.audience_size}

Score 0-100 for referral potential, identify quick wins, and recommend engagement strategy.`,
        response_json_schema: {
          type: 'object',
          properties: {
            opportunity_score: { type: 'number' },
            quick_wins: { type: 'array', items: { type: 'string' } },
            engagement_strategy: { type: 'string' }
          }
        }
      });

      // Step 2: Create relationship record
      await base44.asServiceRole.entities.Partner.update(partner.id, {
        opportunity_score: partnerScore.opportunity_score,
        opportunity_type: partnerScore.quick_wins,
        outreach_message: partnerScore.engagement_strategy
      });

      // Step 3: Schedule relationship milestones
      const milestones = ['initial_contact', 'needs_discovery', 'proposal', 'negotiation', 'agreement'];
      for (const milestone of milestones) {
        await base44.asServiceRole.entities.Task.create({
          title: `Partner milestone: ${milestone}`,
          description: `${partner.company_name} - ${partnerScore.engagement_strategy}`,
          status: 'pending',
          priority: partnerScore.opportunity_score > 75 ? 'high' : 'medium',
          project: 'ndis_partnerships',
          source: 'workflow',
          source_id: partner.id
        });
      }

      workflowResult = {
        partner_id: partner.id,
        opportunity_score: partnerScore.opportunity_score,
        quick_wins: partnerScore.quick_wins,
        pipeline_stage: 'initial_contact',
        next_review: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    }

    if (workflow_type === 'emergency_inventory_restock') {
      // Low stock detection → Demand forecast → Supplier contact → Expedited ordering → Cash flow impact
      const product = trigger_data.product;

      // Step 1: Get current forecast
      const forecast = await base44.asServiceRole.entities.InventoryForecast.list().then(
        f => f.find(x => x.product_id === product.id)
      );

      if (!forecast) {
        return Response.json({ status: 'no_forecast', message: 'Run predictiveInventoryForecasting first' });
      }

      // Step 2: Calculate restock urgency
      const daysToStockout = forecast.projected_stockout_date
        ? (new Date(forecast.projected_stockout_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : 999;

      const urgency = daysToStockout < 7 ? 'critical' : daysToStockout < 14 ? 'high' : 'medium';

      // Step 3: Generate restock decision
      const restockDecision = await base44.integrations.Core.InvokeLLM({
        prompt: `Determine optimal restock strategy:
Product: ${product.name}
Days to stockout: ${daysToStockout.toFixed(0)}
Current cost: $${product.price}
Supplier lead time: 14 days
Expedited lead time: 3 days
Expedited cost premium: +15%

Recommend: standard reorder, expedited reorder, or combined strategy.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            quantity: { type: 'number' },
            reorder_type: { type: 'string' },
            estimated_cost: { type: 'number' }
          }
        }
      });

      // Step 4: Create PO task
      await base44.asServiceRole.entities.Task.create({
        title: `PO: ${product.name} - ${restockDecision.reorder_type}`,
        description: `Qty: ${restockDecision.quantity}. Cost: $${restockDecision.estimated_cost}. Urgency: ${urgency}`,
        status: 'pending',
        priority: urgency === 'critical' ? 'critical' : 'high',
        project: 'procurement',
        source: 'workflow',
        source_id: product.id
      });

      // Step 5: Financial impact notification
      await base44.asServiceRole.entities.Notification.create({
        type: 'cash_flow_impact',
        title: `${urgency.toUpperCase()}: ${product.name} restock`,
        message: `${restockDecision.reorder_type} reorder cost: $${restockDecision.estimated_cost}`,
        priority: urgency === 'critical' ? 'critical' : 'high',
        recipient_role: 'admin'
      });

      workflowResult = {
        product_id: product.id,
        urgency,
        days_to_stockout: daysToStockout.toFixed(0),
        recommendation: restockDecision.recommendation,
        reorder_quantity: restockDecision.quantity,
        estimated_cost: restockDecision.estimated_cost
      };
    }

    if (workflow_type === 'fraud_prevention_cascade') {
      // Order placed → Fraud check → Risk scoring → Action trigger → Monitoring
      const order = trigger_data.order;

      // Step 1: Run fraud detection
      const fraudCheck = await base44.functions.invoke('behavioralFraudDetection', { order_id: order.id });

      if (fraudCheck.data.risk_score > 75) {
        // Step 2: Escalate to human review
        await base44.asServiceRole.entities.Task.create({
          title: `FRAUD REVIEW: Order ${order.id}`,
          description: `Risk: ${fraudCheck.data.risk_level}. Anomalies: ${fraudCheck.data.anomalies_detected.join(', ')}`,
          status: 'pending',
          priority: 'critical'
        });

        // Step 3: Hold fulfillment
        await base44.asServiceRole.entities.Notification.create({
          type: 'order_held',
          title: `⚠️ Order ${order.id} held for review`,
          message: `Risk score: ${fraudCheck.data.risk_score}. Awaiting approval to fulfill.`,
          priority: 'critical',
          recipient_role: 'admin'
        });

        // Step 4: Monitor for patterns
        await base44.asServiceRole.entities.Activity.create({
          type: 'fraud_monitoring',
          title: `Order ${order.id} flagged for pattern analysis`,
          entity_type: 'Order',
          entity_id: order.id
        });
      } else {
        // Low risk → proceed with fulfillment
        await base44.asServiceRole.entities.Task.create({
          title: `FULFILL: Order ${order.id}`,
          description: 'Fraud check passed. Ready to ship.',
          status: 'pending',
          priority: 'high'
        });
      }

      workflowResult = {
        order_id: order.id,
        fraud_risk_score: fraudCheck.data.risk_score,
        action_taken: fraudCheck.data.action_taken,
        requires_review: fraudCheck.data.requires_human_review
      };
    }

    // Log workflow execution
    await base44.asServiceRole.entities.Activity.create({
      type: 'autonomous_workflow',
      title: `Workflow: ${workflow_type}`,
      description: JSON.stringify(workflowResult),
      entity_type: 'Workflow',
      entity_id: workflow_type
    });

    return Response.json({
      status: 'workflow_complete',
      workflow_type,
      result: workflowResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});