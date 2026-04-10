import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { to, subject, body } = await req.json();
        if (!to || !subject || !body) return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });

        await base44.integrations.Core.SendEmail({ to, subject, body });
        return Response.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});