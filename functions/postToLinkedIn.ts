import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { content, post_id } = await req.json();
    if (!content) return Response.json({ error: 'content is required' }, { status: 400 });

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('linkedin');

    // Get LinkedIn profile URN
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const authorUrn = `urn:li:person:${profile.sub}`;

    // Create post
    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.json();
      return Response.json({ error: err.message || 'Failed to post to LinkedIn' }, { status: postRes.status });
    }

    const result = await postRes.json();

    // Update SocialPost status if post_id provided
    if (post_id) {
      await base44.asServiceRole.entities.SocialPost.update(post_id, { status: 'published' });
    }

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      title: 'Posted to LinkedIn',
      description: content.substring(0, 100),
      type: 'social',
      status: 'completed',
      module: 'marketing',
    });

    return Response.json({ success: true, postId: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});