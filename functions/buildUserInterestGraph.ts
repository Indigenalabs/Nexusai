import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { user_email, platform, engagement_signals } = payload;

    // engagement_signals format: [{action: 'like'|'comment'|'share'|'view'|'click'|'purchase', topic: 'string', timestamp: 'date-time'}]

    // Try to find existing profile
    let userProfile = null;
    try {
      const profiles = await base44.entities.UserInterestProfile.filter({ user_email, platform }, '', 1);
      if (profiles.length > 0) {
        userProfile = profiles[0];
      }
    } catch (e) {
      // Profile doesn't exist yet
    }

    // Use LLM to analyze engagement signals and extract interests
    const analysisResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze these engagement signals and extract user interests:

${engagement_signals.map(s => `- User ${s.action}d content about "${s.topic}" at ${s.timestamp}`).join('\n')}

Extract:
1. Top 5 topics of interest with strength scores (0-100)
2. Primary content format preferences (video, carousel, static_image, text, educational)
3. Engagement pattern (when most active)

Format as JSON with:
- interests: [{topic, score, signal_count}]
- format_preferences: {video, carousel, static_image, text, educational}
- primary_engagement_window: {day_of_week, time_start, time_end}`,
      response_json_schema: {
        type: 'object',
        properties: {
          interests: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                score: { type: 'number' },
                signal_count: { type: 'number' }
              }
            }
          },
          format_preferences: {
            type: 'object',
            properties: {
              video: { type: 'number' },
              carousel: { type: 'number' },
              static_image: { type: 'number' },
              text: { type: 'number' },
              educational: { type: 'number' }
            }
          },
          engagement_window: {
            type: 'object',
            properties: {
              day_of_week: { type: 'string' },
              time_start: { type: 'string' },
              time_end: { type: 'string' }
            }
          }
        }
      }
    });

    const { interests, format_preferences, engagement_window } = analysisResponse;

    // Create or update user interest profile
    if (userProfile) {
      await base44.entities.UserInterestProfile.update(userProfile.id, {
        interests,
        content_format_preference: format_preferences,
        optimal_engagement_window: { ...engagement_window, platform },
        engagement_history: engagement_signals.slice(-50) // Keep last 50
      });
    } else {
      userProfile = await base44.entities.UserInterestProfile.create({
        user_email,
        platform,
        interests,
        content_format_preference: format_preferences,
        optimal_engagement_window: { ...engagement_window, platform },
        engagement_history: engagement_signals,
        personalization_opt_in: true
      });
    }

    return Response.json({
      status: 'success',
      user_profile_id: userProfile.id,
      user_email,
      interests_identified: interests.length,
      top_interests: interests.slice(0, 3).map(i => i.topic),
      engagement_window
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});