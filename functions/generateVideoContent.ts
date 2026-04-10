import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, content_topic, style, duration_seconds = 30, platforms } = payload;

    // Fetch campaign for context
    const campaign = await base44.entities.Campaign.read(campaign_id);

    // Generate video script using LLM
    const scriptResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a ${duration_seconds} second video script for:
Campaign: ${campaign.name}
Topic: ${content_topic}
Style: ${style}
Objective: ${campaign.objective}

Write a compelling script that:
1. Hooks in first 2 seconds
2. Delivers key message
3. Includes clear CTA
4. Works without sound (for social media)

Format: Clear narration with visual direction notes.`,
      response_json_schema: {
        type: 'object',
        properties: {
          script: { type: 'string' },
          visual_directions: { type: 'string' },
          hook: { type: 'string' },
          cta: { type: 'string' }
        }
      }
    });

    const { script, visual_directions, hook } = scriptResponse;

    // Generate visual prompt for video generation API
    const visualPromptResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a detailed visual prompt for an AI video generator:

Campaign: ${campaign.name}
Style: ${style}
Visual direction: ${visual_directions}
Duration: ${duration_seconds}s

Generate a detailed scene description including:
1. Camera movements
2. Visual elements and props
3. Color palette
4. Lighting mood
5. Transitions between scenes
6. Text overlays (if any)

Make it detailed and specific for AI video generation.`,
      response_json_schema: {
        type: 'object',
        properties: {
          visual_prompt: { type: 'string' },
          scene_breakdown: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Create VideoAsset record (status: generating)
    const videoAsset = await base44.asServiceRole.entities.VideoAsset.create({
      title: `${campaign.name} - ${content_topic}`,
      description: hook,
      source_content_id: campaign_id,
      script: script,
      visual_prompt: visualPromptResponse.visual_prompt,
      style,
      duration_seconds,
      platform_optimized_for: platforms || ['instagram_reel', 'tiktok'],
      status: 'generating',
      generation_model: 'canvas_video_engine'
    });

    // Create Notification for Canvas to generate video
    await base44.asServiceRole.entities.Notification.create({
      type: 'video_generation_request',
      title: `🎬 Video Generation Requested: ${campaign.name}`,
      message: `Generate ${duration_seconds}s video: ${content_topic}. Style: ${style}`,
      priority: 'high',
      action_url: `/VideoAsset?id=${videoAsset.id}`,
      recipient_role: 'admin'
    });

    // Create Activity log
    await base44.asServiceRole.entities.Activity.create({
      type: 'video_generation',
      title: `Video generation started: ${campaign.name}`,
      description: `${duration_seconds}s ${style} video for "${content_topic}"`,
      entity_type: 'VideoAsset',
      entity_id: videoAsset.id
    });

    return Response.json({
      status: 'generation_started',
      video_asset_id: videoAsset.id,
      campaign_id,
      duration: duration_seconds,
      style,
      script: script.substring(0, 200) + '...',
      estimated_generation_time: '2-5 minutes'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});