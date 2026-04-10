import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, campaign_id, social_mention_id } = payload;

    // action: 'add_to_nurture', 'send_check_in', 'share_their_content', 'offer_collab'

    if (action === 'add_to_nurture') {
      // Fetch influencer from SocialMention
      const mention = await base44.entities.SocialMention.read(social_mention_id);

      // Create Influencer record
      const influencer = await base44.asServiceRole.entities.Influencer.create({
        name: mention.author_name,
        handle: mention.author_handle,
        platform: mention.platform,
        follower_count: mention.author_follower_count || 0,
        tier: mention.author_follower_count >= 1000000 ? 'mega'
          : mention.author_follower_count >= 100000 ? 'macro'
          : mention.author_follower_count >= 10000 ? 'mid'
          : mention.author_follower_count >= 1000 ? 'micro'
          : 'nano',
        status: 'prospect',
        notes: `Added from social mention: "${mention.content.substring(0, 100)}..."`
      });

      // Create Activity log
      await base44.asServiceRole.entities.Activity.create({
        type: 'influencer_added',
        title: `Influencer Added: ${mention.author_name}`,
        description: `From ${mention.platform} mention`,
        entity_type: 'Influencer',
        entity_id: influencer.id
      });

      return Response.json({
        status: 'added_to_nurture',
        influencer_id: influencer.id,
        name: mention.author_name,
        platform: mention.platform,
        followers: mention.author_follower_count
      });
    }

    // For other actions, fetch the influencer
    const influencer = await base44.entities.Influencer.read(influencer_id);

    if (action === 'send_check_in') {
      // Generate personalized check-in message
      const messageResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a brief, genuine check-in message to an influencer:

Influencer: ${influencer.name} (@${influencer.handle})
Platform: ${influencer.platform}
Followers: ${influencer.follower_count?.toLocaleString()}
Last contact: ${influencer.last_contact || 'never'}

Write a 2-3 sentence DM that:
1. Shows you've been following their work
2. Compliments something specific (find something credible)
3. Suggests value/collaboration without being pushy`,
        response_json_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      });

      // Create notification for human to send
      await base44.asServiceRole.entities.Notification.create({
        type: 'influencer_check_in',
        title: `💌 Check-in Message Ready: ${influencer.name}`,
        message: messageResponse.message,
        priority: 'low',
        action_url: `/Influencers?id=${influencer_id}`,
        recipient_role: 'admin'
      });

      // Update last contact
      await base44.asServiceRole.entities.Influencer.update(influencer_id, {
        last_contact: new Date().toISOString().split('T')[0]
      });

      return Response.json({
        status: 'check_in_ready',
        influencer: influencer.name,
        message: messageResponse.message
      });
    }

    if (action === 'share_their_content') {
      // This would post to your social channels featuring their content
      await base44.asServiceRole.entities.Notification.create({
        type: 'share_influencer_content',
        title: `📲 Share ${influencer.name}'s Content`,
        message: `Re-post from @${influencer.handle} to strengthen relationship`,
        priority: 'medium',
        action_url: `/Influencers?id=${influencer_id}`,
        recipient_role: 'admin'
      });

      return Response.json({
        status: 'share_ready',
        influencer: influencer.name
      });
    }

    if (action === 'offer_collab') {
      // Generate collaboration offer
      const campaign = await base44.entities.Campaign.read(campaign_id);

      const offerResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a collaboration offer for an influencer:

Campaign: ${campaign.name}
Objective: ${campaign.objective}
Influencer: ${influencer.name} (@${influencer.handle})
Followers: ${influencer.follower_count?.toLocaleString()}
Niche: ${influencer.niche?.join(', ') || 'general'}

Generate a professional but friendly collab proposal that:
1. Explains why they're perfect fit
2. Describes what you're offering
3. Suggests deliverables
4. Includes next steps`,
        response_json_schema: {
          type: 'object',
          properties: {
            proposal: { type: 'string' }
          }
        }
      });

      // Update influencer status
      await base44.asServiceRole.entities.Influencer.update(influencer_id, {
        status: 'contacted'
      });

      // Create notification
      await base44.asServiceRole.entities.Notification.create({
        type: 'influencer_collaboration_ready',
        title: `🤝 Collab Offer Ready: ${influencer.name}`,
        message: `Proposal generated for ${campaign.name}. Ready to send?`,
        priority: 'high',
        action_url: `/Influencers?id=${influencer_id}`,
        recipient_role: 'admin'
      });

      return Response.json({
        status: 'collab_ready',
        influencer: influencer.name,
        campaign: campaign.name,
        proposal: offerResponse.proposal
      });
    }

    return Response.json({ status: 'error', message: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});