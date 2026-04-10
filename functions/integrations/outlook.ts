import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const outlookToken = Deno.env.get('OUTLOOK_ACCESS_TOKEN');
    
    if (!outlookToken) {
      return Response.json({ error: 'Outlook access token not configured' }, { status: 400 });
    }

    const baseUrl = 'https://graph.microsoft.com/v1.0/me';
    const headers = {
      'Authorization': `Bearer ${outlookToken}`,
      'Content-Type': 'application/json'
    };

    let response;

    switch (action) {
      case 'get_emails':
        response = await fetch(`${baseUrl}/messages?$top=${data?.limit || 50}`, { headers });
        break;
        
      case 'send_email':
        response = await fetch(`${baseUrl}/sendMail`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: {
              subject: data.subject,
              body: {
                contentType: 'HTML',
                content: data.body
              },
              toRecipients: [{
                emailAddress: { address: data.to }
              }]
            }
          })
        });
        break;
        
      case 'sync_emails':
        // Sync unread emails to Email entity
        const emailsRes = await fetch(`${baseUrl}/messages?$filter=isRead eq false&$top=20`, { headers });
        const emails = await emailsRes.json();
        
        for (const email of emails.value || []) {
          await base44.entities.Email.create({
            subject: email.subject,
            from_email: email.from?.emailAddress?.address || 'unknown',
            to_email: user.email,
            body: email.bodyPreview,
            type: 'inbox',
            status: 'unread'
          });
        }

        return Response.json({ success: true, synced: emails.value?.length || 0 });
        
      case 'get_calendar':
        response = await fetch(`${baseUrl}/calendar/events`, { headers });
        break;
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const result = await response.json();

    return Response.json({ 
      success: response.ok,
      data: result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});