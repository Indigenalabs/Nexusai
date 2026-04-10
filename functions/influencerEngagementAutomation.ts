import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id } = payload;

    // action: 'auto_respond_comments', 'sentiment_summary', 'lead_capture', 'engagement_pods'

    let result = null;

    if (action === 'auto_respond_comments') {
      // Generate smart auto-responses for comments
      const mentions = await base44.asServiceRole.entities.SocialMention.list().then(
        m => m.filter(x => x.status === 'unanswered' && x.mention_type === 'comment')
      );

      const responses = [];

      for (const mention of mentions) {
        const response = await base44.integrations.Core.InvokeLLM({
          prompt: `Generate a warm, authentic auto-response to this comment:
Comment: "${mention.content}"
Sentiment: ${mention.sentiment}
Intent: ${mention.intent}

Keep it short, friendly, on-brand. Include emoji. 1-2 sentences max.`,
          response_json_schema: {
            type: 'object',
            properties: {
              response_text: { type: 'string' },
              include_cta: { type: 'boolean' }
            }
          }
        });

        responses.push({
          mention_id: mention.id,
          auto_response: response.response_text
        });

        // Update mention
        await base44.asServiceRole.entities.SocialMention.update(mention.id, {
          response_status: 'auto_responded',
          auto_response_sent: response.response_text
        });
      }

      result = { responses_generated: responses.length, responses };
    }

    if (action === 'sentiment_summary') {
      // Analyze sentiment of recent mentions/comments
      const mentions = await base44.asServiceRole.entities.SocialMention.list().then(
        m => m.filter(x => x.mention_type === 'comment' || x.mention_type === 'mention').slice(-100)
      );

      const sentimentSummary = {
        total_mentions: mentions.length,
        positive_count: mentions.filter(m => m.sentiment === 'positive').length,
        neutral_count: mentions.filter(m => m.sentiment === 'neutral').length,
        negative_count: mentions.filter(m => m.sentiment === 'negative').length,
        overall_sentiment_score: (mentions.reduce((sum, m) => sum + (m.sentiment_score || 50), 0) / mentions.length).toFixed(0),
        common_praise_themes: [],
        common_complaints: []
      };

      // Extract themes
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze comments for themes:
${mentions.map(m => `[${m.sentiment}] ${m.content}`).join('\n')}

Identify:
1. Top 3 things people praise
2. Top 3 complaints/criticism
3. Questions/requests that come up frequently`,
        response_json_schema: {
          type: 'object',
          properties: {
            praise_themes: { type: 'array', items: { type: 'string' } },
            complaints: { type: 'array', items: { type: 'string' } },
            frequent_questions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      sentimentSummary.common_praise_themes = analysis.praise_themes;
      sentimentSummary.common_complaints = analysis.complaints;

      result = sentimentSummary;
    }

    if (action === 'lead_capture') {
      // Identify and capture leads from comments
      const mentions = await base44.asServiceRole.entities.SocialMention.list().then(
        m => m.filter(x => x.lead_created === false && (x.intent === 'question' || x.intent === 'suggestion'))
      );

      for (const mention of mentions) {
        // Create lead if not already exists
        if (!mention.lead_id) {
          const lead = await base44.asServiceRole.entities.Lead.create({
            first_name: mention.author_name || 'Social Lead',
            email: mention.author_handle,
            source: 'social_media',
            source_detail: mention.platform,
            status: 'new',
            interest_level: 'warm',
            message: mention.content
          });

          // Update mention
          await base44.asServiceRole.entities.SocialMention.update(mention.id, {
            lead_created: true,
            lead_id: lead.id
          });
        }
      }

      result = { leads_captured: mentions.length };
    }

    if (action === 'engagement_pods') {
      // Facilitate engagement pods with other creators
      const strategy = await base44.integrations.Core.InvokeLLM({
        prompt: `Create engagement pod strategy for content creators:

Provide:
1. What is an engagement pod and how it works
2. How to find pod members (niche, size)
3. Engagement pod best practices
4. Metrics to track
5. How to scale (moving from pods)
6. Ethical boundaries`,
        response_json_schema: {
          type: 'object',
          properties: {
            pod_strategy: { type: 'string' },
            target_pod_size: { type: 'number' },
            selection_criteria: { type: 'array', items: { type: 'string' } },
            engagement_targets: { type: 'object' }
          }
        }
      });

      result = strategy;
    }

    return Response.json({
      status: 'engagement_automation_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});