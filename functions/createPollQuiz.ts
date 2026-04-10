import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, topic, quiz_type, platforms } = payload;

    // quiz_type: 'poll' | 'quiz' | 'trivia' | 'personality'

    // Generate poll/quiz content using LLM
    const contentResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Create an engaging ${quiz_type} for social media:

Campaign topic: ${topic}
Platforms: ${platforms?.join(', ') || 'instagram, tiktok'}

Generate:
1. Main question/prompt (catchy, engaging)
2. ${quiz_type === 'poll' ? '2 contrasting options' : '4 answer options'}
3. Follow-up engagement text
4. Hashtags

For a ${quiz_type}:
- Hook users with curiosity or relatability
- Make answers fun/shareable
- Include CTA for results or next step`,
      response_json_schema: {
        type: 'object',
        properties: {
          main_question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          follow_up: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          prompt_copy: { type: 'string' }
        }
      }
    };

    const { main_question, options, follow_up, hashtags, prompt_copy } = contentResponse;

    // Create ContentAsset for the poll/quiz
    const contentAsset = await base44.asServiceRole.entities.ContentAsset.create({
      title: `${quiz_type.charAt(0).toUpperCase() + quiz_type.slice(1)}: ${main_question.substring(0, 50)}...`,
      type: 'interactive_poll',
      content: JSON.stringify({
        question: main_question,
        options: options,
        follow_up: follow_up,
        hashtags: hashtags,
        copy: prompt_copy
      }),
      status: 'draft',
      tags: ['interactive', quiz_type, ...platforms || []],
      notes: `Auto-generated ${quiz_type} for campaign engagement`
    });

    // Create draft SocialPosts for each platform variant
    const postIds = [];
    for (const platform of (platforms || ['instagram', 'tiktok'])) {
      const socialPost = await base44.asServiceRole.entities.SocialPost.create({
        platform,
        caption: `${prompt_copy}\n\n${follow_up}\n\n${hashtags.join(' ')}`,
        format: 'poll',
        status: 'draft',
        tags: ['interactive', quiz_type]
      });
      postIds.push(socialPost.id);
    }

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'interactive_content_ready',
      title: `🎯 ${quiz_type.charAt(0).toUpperCase() + quiz_type.slice(1)} Created: ${main_question.substring(0, 40)}...`,
      message: `Interactive ${quiz_type} ready for posting on ${platforms?.join(', ') || 'multiple platforms'}`,
      priority: 'medium',
      action_url: `/ContentAssets?id=${contentAsset.id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'success',
      content_asset_id: contentAsset.id,
      post_ids: postIds,
      quiz_type,
      main_question,
      options,
      platforms: platforms || ['instagram', 'tiktok'],
      hashtags
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});