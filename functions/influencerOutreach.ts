import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, niche_filter, tier_preference, budget_per_post } = payload;

    // Fetch campaign details
    const campaign = await base44.entities.Campaign.read(campaign_id);

    // Find influencers matching criteria
    const influencers = await base44.asServiceRole.entities.Influencer.filter({
      status: 'prospect',
      tier: tier_preference || undefined
    });

    // Filter by niche if provided
    const matchedInfluencers = niche_filter 
      ? influencers.filter(inf => inf.niche?.some(n => niche_filter.includes(n)))
      : influencers;

    if (matchedInfluencers.length === 0) {
      return Response.json({
        status: 'no_matches',
        message: 'No influencers found matching criteria'
      });
    }

    // Generate personalized outreach for top 5 matches
    const outreachMessages = [];
    for (const influencer of matchedInfluencers.slice(0, 5)) {
      const outreachResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a personalized influencer outreach message:

Influencer: ${influencer.name} (@${influencer.handle})
Platform: ${influencer.platform}
Niche: ${influencer.niche?.join(', ')}
Followers: ${influencer.follower_count?.toLocaleString()}

Campaign: ${campaign.name}
Campaign objective: ${campaign.objective}
Budget per post: $${budget_per_post}

Write a brief, authentic DM (2-3 sentences) that:
1. Shows you've researched their content
2. Explains why they're a great fit
3. Proposes a collaboration
4. Is casual and genuine (not corporate)

Don't mention money directly - save that for negotiations.`,
        response_json_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            subject_line: { type: 'string' }
          }
        }
      });

      outreachMessages.push({
        influencer_id: influencer.id,
        influencer_name: influencer.name,
        message: outreachResponse.message,
        subject: outreachResponse.subject_line
      });

      // Update influencer status
      await base44.asServiceRole.entities.Influencer.update(influencer.id, {
        status: 'contacted'
      });

      // Create Activity log
      await base44.asServiceRole.entities.Activity.create({
        type: 'influencer_outreach',
        title: `Outreach sent: ${influencer.name}`,
        description: `Sent collaboration proposal for campaign: ${campaign.name}`,
        entity_type: 'Influencer',
        entity_id: influencer.id
      });
    }

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'influencer_outreach_complete',
      title: `✉️ Influencer Outreach: ${campaign.name}`,
      message: `${outreachMessages.length} influencers contacted for collaboration`,
      priority: 'medium',
      action_url: `/Campaigns?id=${campaign_id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'success',
      campaign_id,
      influencers_contacted: outreachMessages.length,
      outreach_messages: outreachMessages
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});