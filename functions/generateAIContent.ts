import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { prompt, contentType, tone, addInternetContext } = await req.json();
        if (!prompt) return Response.json({ error: 'Missing required field: prompt' }, { status: 400 });

        const llmPrompt = `Generate ${tone ? tone + " toned" : ""} ${contentType || "business"} content based on: ${prompt}. Be detailed and ready to use.`;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt: llmPrompt,
            add_context_from_internet: addInternetContext || false,
            response_json_schema: { type: "object", properties: { generated_content: { type: "string" } } }
        });

        return Response.json({ success: true, generatedContent: llmResponse.generated_content });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});