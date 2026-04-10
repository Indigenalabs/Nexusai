import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { trend_id, trend_topic, visual_aesthetic, platform } = payload;

    // Fetch business profile for brand voice
    const businessProfile = await base44.asServiceRole.entities.BusinessProfile.list();
    const brandVoice = businessProfile[0]?.brand_voice || 'professional and engaging';

    // Use InvokeLLM to generate trend-aligned content
    const contentResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are creating content for a trending topic: "${trend_topic}"
      
Brand voice: ${brandVoice}
Platform: ${platform}
Visual aesthetic trend: ${visual_aesthetic}

Generate:
1. A compelling social media post (2-3 sentences) that capitalizes on this trend
2. A specific angle that makes it unique and on-brand
3. 2-3 specific hashtags or keywords to amplify reach

Format your response as JSON with keys: post_text, angle, hashtags

Keep the post energetic and ready to publish within 2 hours.`,
      response_json_schema: {
        type: 'object',
        properties: {
          post_text: { type: 'string' },
          angle: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    const { post_text, angle, hashtags } = contentResponse;

    // Generate visual direction brief for Canvas
    const visualResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `For the social media trend "${trend_topic}", describe the visual aesthetic that's trending:
"${visual_aesthetic}"

Generate a brief creative direction (2-3 sentences) for image/video generation that:
1. Matches the trending visual style
2. Incorporates brand identity
3. Is optimized for ${platform}

Be specific about: colors, composition, mood, style references.`,
      response_json_schema: {
        type: 'object',
        properties: {
          visual_brief: { type: 'string' },
          style_references: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    return Response.json({
      generated_text: post_text + '\n\n' + hashtags.join(' '),
      visual_brief: visualResponse.visual_brief,
      suggested_angle: angle,
      platform,
      hashtags
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});