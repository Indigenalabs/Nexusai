import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { month, platforms, postsPerWeek, focus, goals, targets, contentMix } = await req.json();

    // Gather all context
    const [businessProfiles, existingPosts, engagements, trends, assets] = await Promise.all([
      base44.entities.BusinessProfile.list(),
      base44.entities.SocialPost.list('-created_date', 50),
      base44.entities.Engagement.list('-created_date', 100),
      base44.entities.Trend.list('-trend_score', 20),
      base44.entities.ContentAsset.list('-created_date', 50)
    ]);

    const profile = businessProfiles[0] || {};
    const publishedPosts = existingPosts.filter(p => p.status === 'published');

    // Analyze what content performs best from engagement data
    const topEngagements = engagements
      .filter(e => e.sentiment === 'positive')
      .slice(0, 20)
      .map(e => e.content);

    const videoAssets = assets.filter(a => a.type === 'video');
    const imageAssets = assets.filter(a => a.type === 'image');

    // Generate the monthly gameplan
    const gameplan = await base44.integrations.Core.InvokeLLM({
      add_context_from_internet: true,
      prompt: `You are a world-class social media strategist and content director. Create a complete monthly content gameplan.

## BUSINESS CONTEXT
- Company: ${profile.company_name || 'Unknown'}
- Industry: ${profile.industry || 'Unknown'}
- Brand Voice: ${profile.brand_voice || 'professional'}
- Target Audience: ${JSON.stringify(profile.target_audience || {})}
- Goals: ${(profile.primary_goals || []).join(', ')}
- Value Proposition: ${profile.unique_value_proposition || 'N/A'}

## CONTENT LIBRARY
- Videos available: ${videoAssets.length} (${videoAssets.map(v => v.ai_description || v.name).slice(0, 5).join('; ')})
- Images available: ${imageAssets.length}

## AUDIENCE INTELLIGENCE
- Top engaging content themes: ${topEngagements.slice(0, 10).join('; ')}
- Currently trending: ${trends.slice(0, 8).map(t => t.title).join(', ')}

## GAMEPLAN REQUIREMENTS
- Month: ${month}
- Platforms: ${(platforms || ['instagram', 'tiktok']).join(', ')}
- Posts per week: ${postsPerWeek || 5}
- Content focus: ${focus || 'brand awareness and engagement'}
- Content types to include: ${(contentMix || ['reel', 'post', 'carousel']).join(', ')}

## OWNER'S GOALS & EXPECTATIONS
${goals ? `- Goals: ${goals}` : '- Goals: Not specified (default to brand growth and engagement)'}
${targets ? `- Targets/KPIs: ${targets}` : '- Targets: Not specified (default to standard engagement benchmarks)'}

Generate a FULL monthly content calendar TAILORED to the above goals and targets. Include:
1. Weekly content themes (4 weeks) aligned to the stated goals
2. For each week: specific post ideas per platform using ONLY the requested content types (${(contentMix || ['reel', 'post', 'carousel']).join(', ')})
3. Mix of content types: reels for reach, picture posts for engagement, carousels for education, flyers for promotions, stories for daily connection
4. Optimal posting times per platform based on audience behavior
5. Hashtag strategy per content pillar
6. Audience psychology hooks that will drive engagement toward the stated targets
7. Content pillars (3-4 repeating themes that build brand identity)
8. A brief note on how each pillar connects to the owner's specific goals

For each post include: platform, content_type (must be one of: ${(contentMix || ['reel', 'post', 'carousel']).join('/')}), caption, hook, hashtags, best time, ai_score (predicted engagement 0-100), tone.`,
      response_json_schema: {
        type: "object",
        properties: {
          content_pillars: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                posting_frequency: { type: "string" }
              }
            }
          },
          audience_insights: {
            type: "object",
            properties: {
              best_posting_times: { type: "object" },
              top_content_types: { type: "array", items: { type: "string" } },
              audience_pain_points: { type: "array", items: { type: "string" } },
              engagement_triggers: { type: "array", items: { type: "string" } }
            }
          },
          posts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                week: { type: "number" },
                day: { type: "string" },
                platform: { type: "string" },
                content_type: { type: "string" },
                content: { type: "string" },
                hook: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                cta: { type: "string" },
                best_time_to_post: { type: "string" },
                ai_score: { type: "number" },
                video_concept: { type: "string" },
                tone: { type: "string" }
              }
            }
          },
          strategy_summary: { type: "string" }
        }
      }
    });

    // Calculate scheduled dates for the month
    const monthDate = new Date(month + '-01');
    const year = monthDate.getFullYear();
    const monthNum = monthDate.getMonth();

    const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };

    // Schedule all posts
    const scheduledPosts = [];
    for (const post of (gameplan.posts || [])) {
      const week = (post.week || 1) - 1;
      const dayOfWeek = dayMap[post.day?.toLowerCase()] ?? 1;
      
      // Find the correct date
      const firstDay = new Date(year, monthNum, 1);
      const firstDayOfWeek = firstDay.getDay();
      let dayOffset = dayOfWeek - firstDayOfWeek;
      if (dayOffset < 0) dayOffset += 7;
      const postDate = new Date(year, monthNum, 1 + dayOffset + (week * 7));

      // Parse time
      const timeStr = post.best_time_to_post || '10:00 AM';
      const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      let hours = timeParts ? parseInt(timeParts[1]) : 10;
      const minutes = timeParts ? parseInt(timeParts[2]) : 0;
      if (timeParts?.[3]?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      postDate.setHours(hours, minutes, 0, 0);

      if (postDate.getMonth() === monthNum) {
        const created = await base44.entities.SocialPost.create({
          content: post.content,
          platform: post.platform || 'instagram',
          content_type: post.content_type || 'post',
          status: 'scheduled',
          scheduled_time: postDate.toISOString(),
          hashtags: post.hashtags || [],
          hook: post.hook,
          cta: post.cta,
          tone: post.tone || 'professional',
          ai_score: post.ai_score || 70,
          best_time_to_post: post.best_time_to_post,
          gameplan_month: month
        });
        scheduledPosts.push(created);
      }
    }

    // Save audience insights as UserPreferences
    if (gameplan.audience_insights) {
      await base44.entities.UserPreference.create({
        category: 'ai_behavior',
        key: 'social_audience_insights',
        value: JSON.stringify(gameplan.audience_insights),
        learned_from: 'behavior',
        confidence: 85
      });
    }

    // Log activity
    await base44.entities.Activity.create({
      title: `Monthly Social Gameplan Created: ${month}`,
      description: `Scheduled ${scheduledPosts.length} posts across ${(platforms || ['instagram', 'tiktok']).join(', ')} for ${month}. Goals: ${goals || 'general growth'}. Strategy: ${gameplan.strategy_summary?.slice(0, 100)}...`,
      type: 'ai_action',
      status: 'completed',
      module: 'marketing'
    });

    return Response.json({
      success: true,
      posts_scheduled: scheduledPosts.length,
      content_pillars: gameplan.content_pillars,
      audience_insights: gameplan.audience_insights,
      strategy_summary: gameplan.strategy_summary,
      month
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});