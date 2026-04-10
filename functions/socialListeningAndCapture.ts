import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { platform, mentions_data } = payload;

    // mentions_data: [{author_handle, author_name, follower_count, content, mention_type, timestamp, source_url}]

    if (!mentions_data || mentions_data.length === 0) {
      return Response.json({
        status: 'no_mentions',
        message: 'No mentions to process'
      });
    }

    const processedMentions = [];
    const leadsCreated = [];

    for (const mention of mentions_data) {
      // Analyze sentiment using LLM
      const sentimentResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this social media mention for sentiment and intent:

"${mention.content}"

Provide:
1. Sentiment: positive, neutral, or negative
2. Sentiment score: 0-100
3. Intent: praise, complaint, question, suggestion, spam, or other
4. Should this be converted to a lead? (yes/no)
5. If yes, what's the core need/pain point?`,
        response_json_schema: {
          type: 'object',
          properties: {
            sentiment: { type: 'string' },
            sentiment_score: { type: 'number' },
            intent: { type: 'string' },
            is_lead: { type: 'boolean' },
            lead_pain_point: { type: 'string' }
          }
        }
      });

      const { sentiment, sentiment_score, intent, is_lead, lead_pain_point } = sentimentResponse;

      // Create SocialMention record
      const socialMention = await base44.asServiceRole.entities.SocialMention.create({
        platform,
        mention_type: mention.mention_type || 'comment',
        author_handle: mention.author_handle,
        author_name: mention.author_name,
        author_follower_count: mention.follower_count || 0,
        content: mention.content,
        source_url: mention.source_url,
        timestamp: mention.timestamp,
        sentiment,
        sentiment_score,
        intent,
        is_influencer: mention.follower_count >= 10000,
        response_status: 'unanswered'
      });

      // Create Lead if qualified
      if (is_lead) {
        const lead = await base44.asServiceRole.entities.Lead.create({
          first_name: mention.author_name?.split(' ')[0] || 'User',
          last_name: mention.author_name?.split(' ')[1] || mention.author_handle,
          email: `${mention.author_handle}@social.local`, // Placeholder
          twitter_handle: platform === 'twitter' ? mention.author_handle : undefined,
          source: platform,
          status: 'contacted',
          notes: `${lead_pain_point}\n\nOriginal mention: "${mention.content}"`,
          tags: ['social_mention', intent],
          score: sentiment_score
        });
        leadsCreated.push(lead.id);
        
        await base44.asServiceRole.entities.SocialMention.update(socialMention.id, {
          lead_created: true,
          lead_id: lead.id
        });
      }

      // Flag influencers for Nexus
      if (mention.follower_count >= 10000) {
        await base44.asServiceRole.entities.SocialMention.update(socialMention.id, {
          is_influencer: true
        });

        // Create notification for Nexus to review
        await base44.asServiceRole.entities.Notification.create({
          type: 'influencer_detected',
          title: `🌟 Influencer Detected: ${mention.author_name}`,
          message: `${mention.author_handle} (${mention.follower_count?.toLocaleString()} followers) mentioned you on ${platform}`,
          priority: mention.follower_count >= 100000 ? 'high' : 'medium',
          action_url: `/SocialMention?id=${socialMention.id}`,
          recipient_role: 'admin'
        });
      }

      processedMentions.push({
        mention_id: socialMention.id,
        author: mention.author_handle,
        sentiment,
        intent,
        lead_created: is_lead
      });
    }

    // Publish event for other agents
    await base44.asServiceRole.entities.Activity.create({
      type: 'social_mentions_processed',
      title: `${processedMentions.length} mentions analyzed on ${platform}`,
      description: `${leadsCreated.length} leads created, ${processedMentions.filter(m => m.sentiment === 'negative').length} requiring attention`,
      entity_type: 'SocialMention'
    });

    return Response.json({
      status: 'success',
      platform,
      mentions_processed: processedMentions.length,
      leads_created: leadsCreated.length,
      negative_sentiment_count: processedMentions.filter(m => m.sentiment === 'negative').length,
      mentions: processedMentions
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});