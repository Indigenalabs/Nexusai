import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, user_email, base_content } = payload;

    // Fetch user interest profile
    const profiles = await base44.entities.UserInterestProfile.filter({ user_email }, '', 1);
    if (profiles.length === 0) {
      return Response.json({
        status: 'skipped',
        reason: 'No interest profile found for this user'
      });
    }

    const userProfile = profiles[0];

    // Check if user has opted in to personalization
    if (!userProfile.personalization_opt_in) {
      return Response.json({
        status: 'skipped',
        reason: 'User has not opted in to personalization'
      });
    }

    // Fetch campaign for context
    const campaign = await base44.entities.Campaign.read(campaign_id);

    // Use LLM to generate personalized variant
    const personalizationResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Personalize this content for a specific user:

Campaign: "${campaign.name}"
Base content: "${base_content}"

User profile:
- Top interests: ${userProfile.interests?.slice(0, 3).map(i => i.topic).join(', ')}
- Lifecycle stage: ${userProfile.lifecycle_stage}
- Preferred format: ${Object.entries(userProfile.content_format_preference || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'video'}
- Customer segment: ${userProfile.customer_segment}

Create a personalized version that:
1. References their specific interests naturally
2. Uses language appropriate for their lifecycle stage
3. Is formatted for their preferred content type
4. Maintains the core campaign message

Return:
{
  "personalized_text": "the personalized content",
  "personalization_factors": ["interest1", "interest2"],
  "variant_type": "personalized_topic" | "personalized_format" | "fully_personalized"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          personalized_text: { type: 'string' },
          personalization_factors: {
            type: 'array',
            items: { type: 'string' }
          },
          variant_type: { type: 'string' }
        }
      }
    });

    // Create PersonalizedContent record
    const personalizedContent = await base44.entities.PersonalizedContent.create({
      user_email,
      base_campaign_id: campaign_id,
      content_variant: personalizationResponse.variant_type,
      personalization_factors: {
        interests_matched: userProfile.interests?.slice(0, 3).map(i => i.topic) || [],
        format_preference: Object.entries(userProfile.content_format_preference || {}).sort((a, b) => b[1] - a[1])[0]?.[0],
        lifecycle_stage: userProfile.lifecycle_stage,
        segment: userProfile.customer_segment
      },
      personalized_content: personalizationResponse.personalized_text,
      scheduled_send_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      delivery_method: 'feed_post',
      status: 'draft'
    });

    // Create Notification for review
    await base44.asServiceRole.entities.Notification.create({
      type: 'personalized_content_ready',
      title: `👤 Personalized Content Ready: ${campaign.name}`,
      message: `Content personalized for user segment matching interests: ${personalizationResponse.personalization_factors.join(', ')}`,
      priority: 'low',
      action_url: `/PersonalizedContent?id=${personalizedContent.id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'success',
      personalized_content_id: personalizedContent.id,
      user_email,
      variant_type: personalizationResponse.variant_type,
      personalization_factors: personalizationResponse.personalization_factors,
      scheduled_send_time: personalizedContent.scheduled_send_time
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});