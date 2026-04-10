import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, contentType, platform, includeVisuals } = await req.json();

    // Generate content based on type
    let generatedContent;
    
    if (contentType === 'reel' || contentType === 'video') {
      // Generate video script and visual descriptions
      generatedContent = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a ${contentType} script for ${platform} about: ${prompt}.
        
        Include:
        1. Hook (first 3 seconds)
        2. Main content (key points)
        3. Visual suggestions for each scene
        4. Music/audio recommendations
        5. CTA at the end
        6. Hashtags
        
        Make it engaging, trendy, and optimized for ${platform}.`,
        response_json_schema: {
          type: "object",
          properties: {
            hook: { type: "string" },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  voiceover: { type: "string" },
                  visual: { type: "string" },
                  duration: { type: "number" }
                }
              }
            },
            cta: { type: "string" },
            music_recommendation: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } }
          }
        }
      });
    } else if (contentType === 'image') {
      // Generate image
      const imagePrompt = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed image generation prompt for: ${prompt}. 
        Make it visually stunning, on-brand, and optimized for ${platform}. 
        Return just the image prompt (no JSON).`
      });
      
      const image = await base44.integrations.Core.GenerateImage({
        prompt: imagePrompt
      });
      
      generatedContent = {
        image_url: image.url,
        caption: await base44.integrations.Core.InvokeLLM({
          prompt: `Write a ${platform} caption for: ${prompt}. Include emojis and 5-8 hashtags.`
        })
      };
    } else {
      // Generate text post
      generatedContent = await base44.integrations.Core.InvokeLLM({
        prompt: `Create engaging ${platform} content about: ${prompt}.
        Include relevant emojis, hashtags, and a strong CTA.`,
        response_json_schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } }
          }
        }
      });
    }

    return Response.json({ 
      success: true,
      content: generatedContent,
      contentType
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});