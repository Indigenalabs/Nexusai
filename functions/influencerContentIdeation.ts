import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, influencer_id, niche, platform, trend_keywords } = payload;

    // action: 'generate_ideas', 'trend_analysis', 'content_calendar_plan', 'series_concept'

    let result = null;

    if (action === 'generate_ideas') {
      // Compass + Sage: Generate content ideas
      const ideaResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 10 engaging content ideas for ${niche} influencer on ${platform}:

Context:
- Platform: ${platform}
- Niche: ${niche}
- Trending keywords: ${trend_keywords?.join(', ') || 'general trends'}

For each idea provide:
1. Content title/hook
2. Format (post, reel, story, carousel, video)
3. Description
4. Hashtags (3-5)
5. Best posting day/time
6. Engagement prediction (low/medium/high)
7. Resources needed

Mix educational, entertaining, and community-building content.`,
        response_json_schema: {
          type: 'object',
          properties: {
            ideas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  format: { type: 'string' },
                  description: { type: 'string' },
                  hashtags: { type: 'array', items: { type: 'string' } },
                  best_time: { type: 'string' },
                  engagement_prediction: { type: 'string' },
                  resources_needed: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      });

      // Store ideas as content briefs
      for (const idea of ideaResponse.ideas) {
        await base44.asServiceRole.entities.Briefing.create({
          title: idea.title,
          content: idea.description,
          brief_type: 'content_idea',
          source: 'canvas_ai',
          entity_type: 'SocialPost',
          entity_id: influencer_id,
          status: 'draft',
          metadata: {
            format: idea.format,
            platform,
            hashtags: idea.hashtags,
            engagement_prediction: idea.engagement_prediction
          }
        });
      }

      result = ideaResponse;
    }

    if (action === 'trend_analysis') {
      // Identify trending topics relevant to niche
      const trendResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze current trends for ${niche} on ${platform}:

Identify:
1. Top 5 trending hashtags/topics
2. Viral content formats working right now
3. Emerging trends (getting momentum)
4. Evergreen content that always performs
5. Seasonal/timely opportunities
6. Content gaps (underserved topics)

For each, explain why it's trending and how the influencer can capitalize.`,
        response_json_schema: {
          type: 'object',
          properties: {
            trending_topics: { type: 'array', items: { type: 'string' } },
            viral_formats: { type: 'array', items: { type: 'string' } },
            emerging_trends: { type: 'array', items: { type: 'string' } },
            content_gaps: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = trendResponse;
    }

    if (action === 'content_calendar_plan') {
      // Generate 4-week content calendar strategy
      const calendarPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a 4-week content calendar strategy for ${niche} influencer:

Provide:
1. Weekly themes (Mon-Sun)
2. Daily content recommendations
3. Post types and times
4. Engagement hooks
5. Hashtag strategy
6. Call-to-action strategy

Format as a practical, executable plan.`,
        response_json_schema: {
          type: 'object',
          properties: {
            weeks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  week_number: { type: 'number' },
                  theme: { type: 'string' },
                  daily_plan: { type: 'string' }
                }
              }
            },
            posting_schedule: { type: 'string' }
          }
        }
      });

      result = calendarPlan;
    }

    if (action === 'series_concept') {
      // Create a series/recurring content concept
      const seriesConcept = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a recurring content series for ${niche} influencer on ${platform}:

Create:
1. Series name & hook
2. Episode structure/format
3. Duration & frequency (weekly, bi-weekly)
4. 8 episode concepts
5. Engagement mechanics
6. Merchandise/monetization tie-ins

Make it addictive and binge-worthy.`,
        response_json_schema: {
          type: 'object',
          properties: {
            series_name: { type: 'string' },
            concept_description: { type: 'string' },
            frequency: { type: 'string' },
            episodes: { type: 'array', items: { type: 'string' } },
            engagement_hooks: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = seriesConcept;
    }

    return Response.json({
      status: 'content_ideation_complete',
      action,
      influencer_id,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});