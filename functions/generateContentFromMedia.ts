import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetIds, contentType, platform, tone, additionalContext, quantity } = await req.json();

    // Get assets and business profile in parallel
    const [assetsData, businessProfiles, engagements, trends, preferences] = await Promise.all([
      Promise.all(assetIds.map(id => base44.entities.ContentAsset.get(id))),
      base44.entities.BusinessProfile.list(),
      base44.entities.Engagement.list('-created_date', 50),
      base44.entities.Trend.list('-trend_score', 10),
      base44.entities.UserPreference.filter({ key: 'social_audience_insights' })
    ]);

    const profile = businessProfiles[0] || {};
    const audienceInsights = preferences[0] ? JSON.parse(preferences[0].value) : null;

    // Analyze engagement patterns to understand what audience likes
    const positiveEngagements = engagements.filter(e => e.sentiment === 'positive').map(e => e.content);
    const negativeEngagements = engagements.filter(e => e.sentiment === 'negative').map(e => e.content);

    const numIdeas = quantity || 5;
    const platforms = Array.isArray(platform) ? platform : [platform || 'instagram'];

    const contentIdeas = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an elite social media content director. Analyze the provided media and create maximum-engagement content.

## BUSINESS CONTEXT
- Brand: ${profile.company_name || 'Unknown'} | Industry: ${profile.industry || 'Unknown'}
- Brand Voice: ${profile.brand_voice || 'professional'}
- Target Audience: ${JSON.stringify(profile.target_audience || {})}
- Value Proposition: ${profile.unique_value_proposition || 'N/A'}

## AUDIENCE INTELLIGENCE
${audienceInsights ? `- Best posting times: ${JSON.stringify(audienceInsights.best_posting_times)}
- Top content types: ${(audienceInsights.top_content_types || []).join(', ')}
- Audience pain points: ${(audienceInsights.audience_pain_points || []).join('; ')}
- Engagement triggers: ${(audienceInsights.engagement_triggers || []).join('; ')}` : '- No prior audience data yet'}

- Content that WORKS (positive engagement): ${positiveEngagements.slice(0, 5).join('; ')}
- Content that DIDN'T work: ${negativeEngagements.slice(0, 3).join('; ')}
- Trending now: ${trends.slice(0, 5).map(t => t.title).join(', ')}

## MEDIA ASSETS
${assetsData.map((a, i) => `${i + 1}. ${a.type.toUpperCase()}: ${a.name}\n   Description: ${a.ai_description || 'User-uploaded media'}\n   Tags: ${(a.tags || []).join(', ')}`).join('\n\n')}

## CONTENT BRIEF
- Platforms: ${platforms.join(', ')}
- Content type: ${contentType || 'reel'}
- Tone: ${tone || profile.brand_voice || 'engaging'}
- Context: ${additionalContext || 'Create viral, authentic content'}
- Number of variations needed: ${numIdeas}

Generate ${numIdeas} unique content variations. For VIDEO assets, create REEL scripts with:
- A pattern-interrupt hook (first 3 seconds that stops the scroll)
- Scene-by-scene visual direction
- Voiceover/text overlay script
- Trending audio suggestion

For each variation, maximize engagement by leveraging the audience pain points and engagement triggers identified above.`,
      file_urls: assetsData.filter(a => a.type === 'image').map(a => a.file_url),
      response_json_schema: {
        type: "object",
        properties: {
          audience_notes: { type: "string", description: "Key audience insight used for this content" },
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                platform: { type: "string" },
                content_type: { type: "string" },
                caption: { type: "string" },
                hook: { type: "string" },
                visual_sequence: { type: "string" },
                reel_script: { type: "string" },
                text_overlays: { type: "array", items: { type: "string" } },
                trending_audio_suggestion: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                call_to_action: { type: "string" },
                best_time_to_post: { type: "string" },
                ai_score: { type: "number" },
                why_this_works: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Create social post drafts for each idea across platforms
    const posts = [];
    for (const idea of (contentIdeas.ideas || [])) {
      const post = await base44.entities.SocialPost.create({
        content: idea.caption,
        platform: idea.platform || platforms[0],
        content_type: idea.content_type || contentType || 'reel',
        status: 'draft',
        tone,
        hook: idea.hook,
        cta: idea.call_to_action,
        hashtags: idea.hashtags || [],
        media_assets: assetIds,
        ai_score: idea.ai_score || 70,
        best_time_to_post: idea.best_time_to_post
      });
      posts.push({ ...post, idea });
    }

    // Update asset usage counts
    for (const asset of assetsData) {
      await base44.entities.ContentAsset.update(asset.id, {
        usage_count: (asset.usage_count || 0) + 1
      });
    }

    return Response.json({
      success: true,
      posts,
      audience_notes: contentIdeas.audience_notes,
      generated_count: posts.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});