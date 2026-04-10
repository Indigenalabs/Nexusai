import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const fbAccessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN');
    const fbPageId = Deno.env.get('FACEBOOK_PAGE_ID');
    
    if (!fbAccessToken) {
      return Response.json({ error: 'Facebook access token not configured' }, { status: 400 });
    }

    const baseUrl = 'https://graph.facebook.com/v18.0';
    
    let response;

    switch (action) {
      case 'publish_post':
        response = await fetch(`${baseUrl}/${fbPageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: data.content,
            access_token: fbAccessToken
          })
        });
        break;
        
      case 'get_posts':
        response = await fetch(
          `${baseUrl}/${fbPageId}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true)&access_token=${fbAccessToken}`
        );
        break;
        
      case 'get_insights':
        response = await fetch(
          `${baseUrl}/${fbPageId}/insights?metric=page_impressions,page_engaged_users&access_token=${fbAccessToken}`
        );
        break;
        
      case 'schedule_post':
        // Facebook doesn't support future scheduled posts via Graph API in the same way
        // Store in SocialPost entity as scheduled
        await base44.entities.SocialPost.create({
          content: data.content,
          platform: 'facebook',
          status: 'scheduled',
          scheduled_time: data.scheduled_time
        });
        
        return Response.json({ success: true, message: 'Post scheduled in database' });
        
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