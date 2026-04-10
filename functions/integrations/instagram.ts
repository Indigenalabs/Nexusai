import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const igAccessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
    const igAccountId = Deno.env.get('INSTAGRAM_BUSINESS_ACCOUNT_ID');
    
    if (!igAccessToken || !igAccountId) {
      return Response.json({ error: 'Instagram credentials not configured' }, { status: 400 });
    }

    const baseUrl = 'https://graph.facebook.com/v18.0';
    
    let response;

    switch (action) {
      case 'publish_post':
        // Step 1: Create media container
        const containerRes = await fetch(`${baseUrl}/${igAccountId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: data.image_url,
            caption: data.content,
            access_token: igAccessToken
          })
        });
        
        const container = await containerRes.json();
        
        // Step 2: Publish container
        response = await fetch(`${baseUrl}/${igAccountId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: container.id,
            access_token: igAccessToken
          })
        });
        break;
        
      case 'publish_reel':
        // Create video container
        const videoRes = await fetch(`${baseUrl}/${igAccountId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'REELS',
            video_url: data.video_url,
            caption: data.content,
            share_to_feed: true,
            access_token: igAccessToken
          })
        });
        
        const videoContainer = await videoRes.json();
        
        // Publish reel
        response = await fetch(`${baseUrl}/${igAccountId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: videoContainer.id,
            access_token: igAccessToken
          })
        });
        break;
        
      case 'get_media':
        response = await fetch(
          `${baseUrl}/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&access_token=${igAccessToken}`
        );
        break;
        
      case 'get_insights':
        response = await fetch(
          `${baseUrl}/${igAccountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${igAccessToken}`
        );
        break;
        
      case 'get_comments':
        response = await fetch(
          `${baseUrl}/${data.media_id}/comments?access_token=${igAccessToken}`
        );
        break;
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const result = await response.json();

    return Response.json({ 
      success: response.ok || result.id,
      data: result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});