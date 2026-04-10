import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { deliverable_id, payment_method } = payload;

    // Fetch deliverable and influencer
    const deliverable = await base44.entities.CreatorDeliverable.read(deliverable_id);
    const influencer = await base44.entities.Influencer.read(deliverable.influencer_id);

    // Verify deliverable is completed
    if (deliverable.status !== 'completed' && deliverable.status !== 'published') {
      return Response.json({
        status: 'error',
        message: 'Deliverable must be completed before payment can be processed'
      }, { status: 400 });
    }

    // Check if already paid
    if (deliverable.payment_status === 'paid') {
      return Response.json({
        status: 'already_paid',
        message: 'This deliverable has already been paid'
      });
    }

    const paymentAmount = deliverable.payment_amount || influencer.rate_per_post || 0;

    // Update deliverable payment status
    await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
      payment_status: 'processing',
      payment_amount: paymentAmount
    });

    // In a real implementation, integrate with Stripe, PayPal, etc.
    // For now, simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mark as paid
    await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
      payment_status: 'paid'
    });

    // Update influencer payment status
    const allDeliverables = await base44.asServiceRole.entities.CreatorDeliverable.filter({
      influencer_id: influencer.id
    });
    
    const unpaidCount = allDeliverables.filter(d => d.payment_status !== 'paid').length;
    const newPaymentStatus = unpaidCount === 0 ? 'paid' : unpaidCount < allDeliverables.length ? 'partial' : 'pending';

    await base44.asServiceRole.entities.Influencer.update(influencer.id, {
      payment_status: newPaymentStatus
    });

    // Create Transaction record
    await base44.asServiceRole.entities.Transaction.create({
      date: new Date().toISOString().split('T')[0],
      description: `Payment to ${influencer.name} - Deliverable #${deliverable_id.slice(-6)}`,
      amount: -paymentAmount, // Negative = expense
      category: 'marketing',
      merchant: influencer.name,
      type: 'expense',
      status: 'posted',
      notes: `Campaign deliverable payment via ${payment_method}`
    });

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'payment_processed',
      title: `💰 Payment Sent: ${influencer.name}`,
      message: `$${paymentAmount.toLocaleString()} paid for deliverable completion`,
      priority: 'low',
      action_url: `/CreatorDeliverables?id=${deliverable_id}`,
      recipient_role: 'admin'
    });

    // Create Activity log
    await base44.asServiceRole.entities.Activity.create({
      type: 'payment_processed',
      title: `Payment processed: ${influencer.name}`,
      description: `$${paymentAmount} paid for deliverable`,
      entity_type: 'CreatorDeliverable',
      entity_id: deliverable_id
    });

    return Response.json({
      status: 'success',
      deliverable_id,
      influencer_name: influencer.name,
      amount_paid: paymentAmount,
      payment_method,
      new_payment_status: newPaymentStatus
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});