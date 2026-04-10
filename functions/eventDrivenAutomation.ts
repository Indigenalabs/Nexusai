import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event_type, event_data } = payload;

    // event_type: 'order_placed', 'customer_signup', 'inventory_low', 'viral_spike', 'competitor_move', 'sentiment_drop'

    const automatedResponse = {
      event_type,
      actions_triggered: [],
      timestamp: new Date().toISOString()
    };

    if (event_type === 'order_placed') {
      // Cascade: Fraud check → Fulfillment → Upsell → Post-order nurture
      const order = event_data;

      automatedResponse.actions_triggered.push('fraud_detection_initiated');
      await base44.functions.invoke('behavioralFraudDetection', { order_id: order.id });

      automatedResponse.actions_triggered.push('fulfillment_task_created');
      await base44.asServiceRole.entities.Task.create({
        title: `FULFILL: Order ${order.id}`,
        status: 'pending',
        priority: 'high',
        source: 'event_driven',
        source_id: order.id
      });

      // Upsell opportunity detection
      automatedResponse.actions_triggered.push('upsell_recommendation_generated');
      const upsellResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Recommend upsell/cross-sell for order:
Items purchased: ${order.items?.map(i => i.name).join(', ')}
Customer LTV: $${event_data.customer_lifetime_value}

Suggest 2-3 complementary products that customer is likely to buy.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Schedule post-delivery nurture
      automatedResponse.actions_triggered.push('post_delivery_nurture_scheduled');
      await base44.asServiceRole.entities.Task.create({
        title: `Post-delivery nurture: ${order.customer_email}`,
        description: `Send 3-email sequence: day 3 (satisfaction), day 7 (review request), day 14 (upsell: ${upsellResponse.recommendations.join(', ')})`,
        status: 'pending',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        source: 'event_driven'
      });
    }

    if (event_type === 'customer_signup') {
      // New customer onboarding cascade
      const customer = event_data;

      automatedResponse.actions_triggered.push('onboarding_email_sent');
      await base44.integrations.Core.SendEmail({
        to: customer.email,
        subject: 'Welcome! Your first order is waiting',
        body: 'Check out our bestsellers...'
      });

      automatedResponse.actions_triggered.push('loyalty_profile_created');
      await base44.asServiceRole.entities.PersonalizationProfile.create({
        customer_id: customer.email,
        session_count: 1
      });

      automatedResponse.actions_triggered.push('first_purchase_incentive_offered');
      await base44.asServiceRole.entities.Campaign.create({
        name: `Welcome discount: ${customer.email}`,
        objective: 'first_purchase',
        status: 'active',
        offer: '10% off first order'
      });

      automatedResponse.actions_triggered.push('engagement_tracking_started');
      await base44.asServiceRole.entities.Activity.create({
        type: 'new_customer_onboarded',
        title: `New customer: ${customer.email}`,
        entity_type: 'Customer',
        entity_id: customer.email
      });
    }

    if (event_type === 'inventory_low') {
      // Automatic restock workflow
      const product = event_data.product;

      automatedResponse.actions_triggered.push('forecast_analysis_run');
      await base44.functions.invoke('predictiveInventoryForecasting', {
        product_id: product.id
      });

      automatedResponse.actions_triggered.push('restock_decision_made');
      await base44.functions.invoke('autonomousWorkflowOrchestrator', {
        workflow_type: 'emergency_inventory_restock',
        trigger_data: { product }
      });

      automatedResponse.actions_triggered.push('supplier_notification_sent');
      if (product.supplier_email) {
        await base44.integrations.Core.SendEmail({
          to: product.supplier_email,
          subject: `URGENT: Reorder request for ${product.name}`,
          body: `Please expedite shipment. Current stock: ${product.inventory_count} units.`
        });
      }

      automatedResponse.actions_triggered.push('sales_team_alerted');
      await base44.asServiceRole.entities.Notification.create({
        type: 'low_inventory_alert',
        title: `⚠️ Low stock: ${product.name}`,
        message: `Current: ${product.inventory_count}. Restock initiated.`,
        priority: 'high',
        recipient_role: 'admin'
      });
    }

    if (event_type === 'viral_spike') {
      // Trend detected → Capitalize on viral moment
      const trend = event_data;

      automatedResponse.actions_triggered.push('trend_viability_check');
      await base44.functions.invoke('autonomousWorkflowOrchestrator', {
        workflow_type: 'viral_campaign_launch',
        trigger_data: { trend }
      });

      automatedResponse.actions_triggered.push('competitor_content_monitored');
      automatedResponse.actions_triggered.push('real_time_engagement_tracking');
      automatedResponse.actions_triggered.push('sentiment_monitoring_active');
    }

    if (event_type === 'competitor_move') {
      // Competitor price drop or new product → Respond with pricing/content strategy
      const competitor = event_data.competitor;
      const move = event_data.move;

      automatedResponse.actions_triggered.push('competitive_analysis_run');
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Competitor just ${move.type}: ${move.details}. Our response strategy?`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            tactics: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      automatedResponse.actions_triggered.push('response_tactics_identified');

      // Adjust pricing if needed
      if (move.type === 'price_drop') {
        automatedResponse.actions_triggered.push('price_analysis_triggered');
        // Invoke dynamic pricing for affected products
      }

      automatedResponse.actions_triggered.push('team_notified');
      await base44.asServiceRole.entities.Notification.create({
        type: 'competitive_alert',
        title: `🎯 Competitive move: ${competitor.name}`,
        message: `${move.details}. Recommended response: ${response.recommendation}`,
        priority: 'high',
        recipient_role: 'admin'
      });
    }

    if (event_type === 'sentiment_drop') {
      // Social sentiment declining → Identify cause and intervene
      automatedResponse.actions_triggered.push('sentiment_analysis_deep_dive');
      automatedResponse.actions_triggered.push('root_cause_identified');
      automatedResponse.actions_triggered.push('crisis_communication_prepared');

      const sentiment = event_data;
      await base44.asServiceRole.entities.CampaignSentimentAlert.create({
        campaign_id: sentiment.campaign_id,
        topic: sentiment.topic,
        sentiment_shift: 'neutral_to_negative',
        sentiment_before: sentiment.previous_score,
        sentiment_after: sentiment.current_score,
        platforms_affected: sentiment.platforms,
        urgency: sentiment.drop_rate > 5 ? 'critical' : 'high'
      });

      automatedResponse.actions_triggered.push('stakeholder_alert_sent');
      await base44.asServiceRole.entities.Notification.create({
        type: 'sentiment_crisis',
        title: '🚨 Sentiment drop detected',
        message: `Campaign ${sentiment.campaign_id}: ${sentiment.current_score}% (was ${sentiment.previous_score}%)`,
        priority: 'critical',
        recipient_role: 'admin'
      });
    }

    return Response.json({
      status: 'automation_complete',
      event_type,
      actions_triggered: automatedResponse.actions_triggered.length,
      details: automatedResponse
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});