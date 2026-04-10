import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, platforms } = await req.json();

    // Get historical performance data
    const historicalPosts = await base44.entities.SocialPost.list('-created_date', 100);
    
    // Analyze best posting times using AI
    const schedule = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI marketing strategist. Based on this content: "${content}"
      
      And these platforms: ${platforms.join(', ')}
      
      Determine the OPTIMAL posting schedule considering:
      1. Platform-specific peak engagement times
      2. Content type and format
      3. Target audience demographics
      4. Day of week patterns
      5. Current trends
      
      Provide a posting schedule with exact dates/times for the next 7 days.`,
      response_json_schema: {
        type: "object",
        properties: {
          schedule: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string" },
                scheduled_time: { type: "string" },
                reasoning: { type: "string" },
                expected_engagement_score: { type: "number" }
              }
            }
          },
          overall_strategy: { type: "string" }
        }
      }
    });

    // Create scheduled posts
    const createdPosts = [];
    for (const item of schedule.schedule) {
      const post = await base44.entities.SocialPost.create({
        content,
        platform: item.platform,
        status: 'scheduled',
        scheduled_time: item.scheduled_time
      });
      createdPosts.push(post);
    }

    return Response.json({ 
      success: true,
      schedule: schedule.schedule,
      strategy: schedule.overall_strategy,
      posts_created: createdPosts.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});