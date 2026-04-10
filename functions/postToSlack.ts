import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { channel, message, blocks } = await req.json();
    if (!channel || !message) return Response.json({ error: 'channel and message are required' }, { status: 400 });

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('slack');

    const body = {
      channel,
      text: message,
    };
    if (blocks) body.blocks = blocks;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await res.json();
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

    await base44.asServiceRole.entities.Activity.create({
      title: `Slack message sent to ${channel}`,
      description: message.substring(0, 100),
      type: 'ai_action',
      status: 'completed',
      module: 'communication',
    });

    return Response.json({ success: true, ts: result.ts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});