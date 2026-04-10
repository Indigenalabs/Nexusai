import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { deliverable_id, action, data } = payload;

    // Fetch deliverable
    const deliverable = await base44.entities.CreatorDeliverable.read(deliverable_id);
    const influencer = await base44.entities.Influencer.read(deliverable.influencer_id);

    let updatedStatus = deliverable.status;
    let notification = null;

    switch (action) {
      case 'submit_draft':
        updatedStatus = 'draft_submitted';
        notification = {
          title: `📝 Draft Submitted: ${influencer.name}`,
          message: `${influencer.name} has submitted a draft for review`,
          priority: 'high',
          action_url: `/CreatorDeliverables?id=${deliverable_id}`
        };
        await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
          status: updatedStatus,
          draft_url: data.draft_url
        });
        break;

      case 'request_revision':
        updatedStatus = 'revision_needed';
        await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
          status: updatedStatus,
          approval_notes: data.feedback
        });
        // TODO: Send email to influencer with feedback
        break;

      case 'approve':
        updatedStatus = 'approved';
        notification = {
          title: `✅ Deliverable Approved: ${influencer.name}`,
          message: `Draft approved and ready for publishing`,
          priority: 'medium',
          action_url: `/CreatorDeliverables?id=${deliverable_id}`
        };
        await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
          status: updatedStatus,
          approval_notes: data.approval_notes || 'Approved'
        });
        break;

      case 'mark_published':
        updatedStatus = 'published';
        await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
          status: updatedStatus,
          published_url: data.published_url,
          published_at: new Date().toISOString()
        });

        // Update influencer stats
        await base44.asServiceRole.entities.Influencer.update(deliverable.influencer_id, {
          deliverables_remaining: (influencer.deliverables_remaining || 0) - 1,
          total_posts_delivered: (influencer.total_posts_delivered || 0) + 1
        });
        break;

      case 'track_performance':
        // Update performance metrics
        await base44.asServiceRole.entities.CreatorDeliverable.update(deliverable_id, {
          performance_metrics: data.metrics,
          status: 'completed',
          completed_at: new Date().toISOString()
        });

        // Calculate ROI and update influencer
        const revenue = data.metrics.conversions * (data.avg_order_value || 50); // Estimate
        const cost = deliverable.payment_amount || 0;
        const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

        await base44.asServiceRole.entities.Influencer.update(deliverable.influencer_id, {
          total_reach: (influencer.total_reach || 0) + (data.metrics.views || 0),
          total_conversions: (influencer.total_conversions || 0) + (data.metrics.conversions || 0),
          roi_score: roi
        });

        // Create Insight
        await base44.asServiceRole.entities.Insight.create({
          type: 'influencer_performance',
          title: `${influencer.name} - Deliverable Performance`,
          description: `ROI: ${roi.toFixed(0)}%, Engagement: ${data.metrics.engagement_rate}%, Conversions: ${data.metrics.conversions}`,
          data: { deliverable_id, influencer_id: influencer.id, roi, metrics: data.metrics },
          status: 'new'
        });
        break;
    }

    // Create notification if needed
    if (notification) {
      await base44.asServiceRole.entities.Notification.create({
        type: 'creator_deliverable_update',
        ...notification,
        recipient_role: 'admin'
      });
    }

    // Create Activity log
    await base44.asServiceRole.entities.Activity.create({
      type: 'deliverable_update',
      title: `Deliverable ${action}: ${influencer.name}`,
      description: `Status changed to ${updatedStatus}`,
      entity_type: 'CreatorDeliverable',
      entity_id: deliverable_id
    });

    return Response.json({
      status: 'success',
      deliverable_id,
      action,
      new_status: updatedStatus
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});