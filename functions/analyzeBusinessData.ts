import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { query } = await req.json();
        if (!query) return Response.json({ error: 'Missing required field: query' }, { status: 400 });

        const [financials, insights, clients, trends, activities] = await Promise.all([
            base44.entities.FinancialSnapshot.list('-created_date', 1),
            base44.entities.Insight.list('-created_date', 5),
            base44.entities.Client.list('-created_date', 5),
            base44.entities.Trend.list('-created_date', 3),
            base44.entities.Activity.list('-created_date', 10),
        ]);

        const prompt = `You are a business analyst AI. The user asks: "${query}"\n\n` +
            `Financial Snapshot: ${JSON.stringify(financials[0] || 'N/A')}\n` +
            `Recent Insights: ${JSON.stringify(insights.map(i => i.title))}\n` +
            `Recent Clients: ${JSON.stringify(clients.map(c => ({ name: c.name, status: c.status, value: c.value })))}\n` +
            `Current Trends: ${JSON.stringify(trends.map(t => t.title))}\n` +
            `Recent Activities: ${JSON.stringify(activities.map(a => a.title))}\n\n` +
            `Provide a concise, actionable analysis (2-3 paragraphs). Back everything with data.`;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt,
            add_context_from_internet: false,
            response_json_schema: { type: "object", properties: { analysis: { type: "string" } } }
        });

        return Response.json({ success: true, analysis: llmResponse.analysis });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});