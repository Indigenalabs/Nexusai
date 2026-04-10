import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { title, message, type, category, actionUrl, priority } = await req.json();
        if (!title || !message) return Response.json({ error: 'Missing required fields: title, message' }, { status: 400 });

        const newNotification = await base44.entities.Notification.create({
            title,
            message,
            type: type || 'info',
            category: category || 'system',
            action_url: actionUrl,
            priority: priority || 'normal',
            status: 'unread',
        });

        return Response.json({ success: true, notification: newNotification });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});