import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { trend_id, trend_topic, relevance_score, platform_source, visual_aesthetic } = payload;

    // Fetch the trend
    const trend = await base44.entities.Trend.read(trend_id);
    
    // Only proceed if relevance >= 7 (high relevance)
    if (relevance_score < 7) {
      return Response.json({ 
        status: 'skipped',
        reason: 'Relevance score below threshold (7)',
        trend_id 
      });
    }

    // Step 1: Generate content with Maestro's input (call generateTrendContent function)
    const contentGenResponse = await base44.asServiceRole.functions.invoke('generateTrendContent', {
      trend_id,
      trend_topic,
      visual_aesthetic,
      platform: platform_source || 'all'
    });

    const { generated_text, visual_brief, suggested_angle } = contentGenResponse.data;

    // Step 2: Create TrendContent record (pending approval)
    const trendContent = await base44.entities.TrendContent.create({
      trend_id,
      trend_topic,
      content_type: 'post',
      platform: platform_source || 'all',
      generated_content: generated_text,
      visual_brief: visual_brief,
      status: 'pending_approval'
    });

    // Step 3: Create Notification for Maestro (approval required)
    await base44.asServiceRole.entities.Notification.create({
      type: 'trend_content_ready',
      title: `🔥 Trend Opportunity: ${trend_topic}`,
      message: `High-relevance trend detected. Content generated and ready for approval. Window: 24-72 hours.`,
      priority: 'high',
      action_url: `/TrendContent?id=${trendContent.id}`,
      recipient_role: 'admin'
    });

    // Step 4: Create Insight record for tracking
    await base44.asServiceRole.entities.Insight.create({
      type: 'trend_opportunity',
      title: `Trend Opportunity Detected: ${trend_topic}`,
      description: `${trend_topic} trending on ${platform_source}. Relevance: ${relevance_score}/10. Content generated and pending approval.`,
      data: { trend_id, relevance_score, trend_content_id: trendContent.id },
      status: 'new'
    });

    return Response.json({
      status: 'success',
      trend_content_id: trendContent.id,
      trend_topic,
      relevance_score,
      action: 'content_generated_pending_approval',
      window_hours: 24
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});