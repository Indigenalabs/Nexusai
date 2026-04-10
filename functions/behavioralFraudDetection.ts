import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { order_id } = payload;

    // Fetch order details
    const order = await base44.asServiceRole.entities.Order.read(order_id);

    // Analyze for fraud patterns
    const fraudResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this order for fraud risk:

Order Amount: $${order.total}
Customer: First-time? ${order.customer_id ? 'maybe' : 'yes'}
Shipping Address: ${order.shipping_address}
Billing Address: ${order.billing_address}
Shipping Speed: ${order.shipping_method}
Payment Method: ${order.payment_method}
Items: High-value electronics? ${order.items?.some(i => i.category?.includes('electronic')) ? 'yes' : 'no'}

Red flags to check:
1. Billing ≠ Shipping address
2. Overnight/express shipping to unfamiliar location
3. Multiple high-value items
4. Risky payment method
5. New customer high value order
6. Unusual geographic patterns

Provide:
- Risk score (0-100)
- Risk level (low/medium/high/critical)
- Anomalies detected (array)
- Recommendation`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_score: { type: 'number' },
          risk_level: { type: 'string' },
          anomalies: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' }
        }
      }
    });

    const { risk_score, risk_level, anomalies, recommendation } = fraudResponse;

    // Create FraudPattern record
    const fraudPattern = await base44.asServiceRole.entities.FraudPattern.create({
      order_id,
      customer_email: order.customer_email,
      risk_score,
      risk_level,
      anomalies_detected: anomalies,
      order_details: {
        amount: order.total,
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        shipping_method: order.shipping_method
      },
      action_taken: risk_score > 70 ? 'held_for_review' : 'approved',
      human_review_status: risk_score > 70 ? 'pending' : 'cleared'
    });

    // If high risk, create notification
    if (risk_score > 70) {
      await base44.asServiceRole.entities.Notification.create({
        type: 'fraud_alert',
        title: `🚨 Fraud Risk: Order ${order_id}`,
        message: `Risk score: ${risk_score}. ${anomalies.join(', ')}. Recommendation: ${recommendation}`,
        priority: risk_score > 85 ? 'critical' : 'high',
        action_url: `/Order?id=${order_id}`,
        recipient_role: 'admin'
      });

      // Hold order from fulfillment
      await base44.asServiceRole.entities.Task.create({
        title: `FRAUD REVIEW: Order ${order_id}`,
        description: anomalies.join('. '),
        status: 'pending',
        priority: 'critical',
        source: 'system',
        source_id: order_id,
        tags: ['fraud_review']
      });
    }

    return Response.json({
      status: 'analysis_complete',
      order_id,
      risk_score,
      risk_level,
      anomalies_detected: anomalies,
      action_taken: fraudPattern.action_taken,
      recommendation,
      requires_human_review: risk_score > 70
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});