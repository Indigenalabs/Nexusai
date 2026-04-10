import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, topic, feedback } = payload;

    // Fetch campaign for context
    const campaign = await base44.entities.Campaign.read(campaign_id);

    // Use LLM to generate alternative messaging
    const altResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `For campaign "${campaign.name}" on topic "${topic}":

Current issue: ${feedback}

Generate alternative messaging that:
1. Removes negative triggers
2. Reframes the benefit positively
3. Maintains brand voice
4. Is more empathetic/supportive

Provide:
- Alternative headline
- Alternative body copy
- Visual tone (empathetic, professional, supportive)`,
      response_json_schema: {
        type: 'object',
        properties: {
          alternative_headline: { type: 'string' },
          alternative_body: { type: 'string' },
          visual_tone: { type: 'string' }
        }
      }
    });

    // Create ContentAsset with alternative creative
    const contentAsset = await base44.asServiceRole.entities.ContentAsset.create({
      campaign_id,
      title: `${campaign.name} - Alternative Creative (Sentiment Response)`,
      content: altResponse.alternative_body,
      type: 'ad_copy',
      status: 'pending_review',
      tags: ['sentiment_response', 'alternative', topic],
      notes: `Generated in response to sentiment drop on ${topic}. ${altResponse.visual_tone}`
    });

    // Create Notification for Canvas
    await base44.asServiceRole.entities.Notification.create({
      type: 'alternative_creative_ready',
      title: `📸 Alternative Creative Ready: ${campaign.name}`,
      message: `New creative variant generated in response to sentiment concerns. Ready for visual asset generation.`,
      priority: 'high',
      action_url: `/ContentAssets?id=${contentAsset.id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'alternative_creative_generated',
      asset_id: contentAsset.id,
      asset_ids: [contentAsset.id],
      alternative_messaging: {
        headline: altResponse.alternative_headline,
        body: altResponse.alternative_body,
        visual_tone: altResponse.visual_tone
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});