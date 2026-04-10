import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { order_id, event_type, event_data } = payload;

    // event_type: 'sourced', 'manufactured', 'quality_checked', 'packaged', 'shipped', 'delivered', 'returned'
    // event_data: {location, actor, details, blockchain_hash}

    const supplyChainEvent = await base44.asServiceRole.entities.SupplyChainEvent.create({
      order_id,
      event_type,
      timestamp: new Date().toISOString(),
      location: event_data.location,
      actor: event_data.actor,
      details: event_data.details || {},
      blockchain_hash: event_data.blockchain_hash,
      customer_visible: true
    });

    // If delivered, trigger post-delivery logic
    if (event_type === 'delivered') {
      const order = await base44.asServiceRole.entities.Order.read(order_id);

      // Send satisfaction survey
      await base44.asServiceRole.entities.Notification.create({
        type: 'delivery_survey',
        title: `How was your delivery?`,
        message: `Your order arrived! We'd love to hear your feedback.`,
        priority: 'low',
        recipient_role: 'admin'
      });

      // Request review after 5 days
      setTimeout(() => {
        base44.asServiceRole.entities.Notification.create({
          type: 'review_request',
          title: `Please review your purchase`,
          message: `We hope you love your order! Leave a review to help others.`,
          priority: 'low'
        });
      }, 5 * 24 * 60 * 60 * 1000);
    }

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      type: 'supply_chain_event',
      title: `Order ${order_id}: ${event_type}`,
      description: `At ${event_data.location} by ${event_data.actor}`,
      entity_type: 'Order',
      entity_id: order_id
    });

    return Response.json({
      status: 'event_logged',
      event_id: supplyChainEvent.id,
      order_id,
      event_type,
      timestamp: supplyChainEvent.timestamp,
      customer_visible: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});