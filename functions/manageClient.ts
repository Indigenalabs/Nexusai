import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { clientId, action, data } = await req.json();
        if (!action) return Response.json({ error: 'Missing required field: action' }, { status: 400 });

        let result;
        switch (action) {
            case 'create':
                result = await base44.entities.Client.create(data);
                break;
            case 'update':
                result = await base44.entities.Client.update(clientId, data);
                break;
            case 'delete':
                result = await base44.entities.Client.delete(clientId);
                break;
            case 'get':
                result = await base44.entities.Client.get(clientId);
                break;
            case 'suggest_next_action': {
                const client = await base44.entities.Client.get(clientId);
                if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });
                const llmResponse = await base44.integrations.Core.InvokeLLM({
                    prompt: `Given this client: ${JSON.stringify(client)}, suggest the best next action to nurture the relationship or move them through the sales funnel. Be specific and actionable.`,
                    response_json_schema: { type: "object", properties: { next_action: { type: "string" } } }
                });
                result = { client, next_action: llmResponse.next_action };
                break;
            }
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        return Response.json({ success: true, result });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});