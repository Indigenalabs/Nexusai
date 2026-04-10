import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { content, platform, contentType, scheduledTime, hashtags, mediaUrl, aiScore } = await req.json();
        if (!content || !platform) return Response.json({ error: 'Missing required fields: content, platform' }, { status: 400 });

        const newPost = await base44.entities.SocialPost.create({
            content,
            platform,
            content_type: contentType || 'post',
            scheduled_time: scheduledTime || new Date().toISOString(),
            hashtags,
            media_url: mediaUrl,
            ai_score: aiScore,
            status: scheduledTime ? 'scheduled' : 'draft',
        });

        return Response.json({ success: true, message: 'Social media post created', post: newPost });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});