import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { social_mention_id } = payload;

    // Fetch the social mention
    const mention = await base44.entities.SocialMention.read(social_mention_id);

    // If already responded or escalated, skip
    if (mention.response_status !== 'unanswered') {
      return Response.json({
        status: 'already_handled',
        message: 'This mention has already been responded to'
      });
    }

    // Determine if auto-response is appropriate
    const shouldAutoRespond = !['complaint', 'negative'].includes(mention.sentiment) || mention.sentiment_score > 50;

    if (!shouldAutoRespond) {
      // Escalate negative comments to human
      await base44.asServiceRole.entities.SocialMention.update(social_mention_id, {
        response_status: 'escalated',
        escalation_reason: 'Negative sentiment detected - requires human review'
      });

      await base44.asServiceRole.entities.Notification.create({
        type: 'negative_comment_escalation',
        title: `⚠️ Negative Comment - Escalated: ${mention.author_handle}`,
        message: `"${mention.content.substring(0, 100)}..." requires human response.`,
        priority: 'high',
        action_url: `/SocialMention?id=${social_mention_id}`,
        recipient_role: 'admin'
      });

      return Response.json({
        status: 'escalated',
        reason: 'Negative sentiment requires human review'
      });
    }

    // Generate auto-response based on intent
    const responseResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a friendly, helpful social media response:

User said: "${mention.content}"
Intent: ${mention.intent}
Platform: ${mention.platform}

Create a response that:
1. Is concise (under 280 characters for Twitter, under 500 for others)
2. Matches brand voice (professional, friendly, helpful)
3. Addresses their concern/question
4. Includes CTA if appropriate (e.g., "DM for details")
5. Shows they were heard and valued

Format: just the response text, ready to post.`,
      response_json_schema: {
        type: 'object',
        properties: {
          response: { type: 'string' },
          cta_included: { type: 'boolean' }
        }
      }
    });

    const { response } = responseResponse;

    // Update mention with auto-response
    await base44.asServiceRole.entities.SocialMention.update(social_mention_id, {
      response_status: 'auto_responded',
      auto_response_sent: response
    });

    // Create notification with response for human approval
    await base44.asServiceRole.entities.Notification.create({
      type: 'auto_response_ready',
      title: `💬 Auto-Response Ready: ${mention.author_handle}`,
      message: `Response generated for ${mention.intent} from ${mention.author_handle}. Review and post?`,
      priority: 'medium',
      action_url: `/SocialMention?id=${social_mention_id}`,
      recipient_role: 'admin'
    });

    // Create Activity log
    await base44.asServiceRole.entities.Activity.create({
      type: 'auto_response_generated',
      title: `Auto-response for ${mention.author_handle}`,
      description: mention.intent,
      entity_type: 'SocialMention',
      entity_id: social_mention_id
    });

    return Response.json({
      status: 'success',
      mention_id: social_mention_id,
      author: mention.author_handle,
      intent: mention.intent,
      auto_response: response,
      requires_approval: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});