import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiName, apiDocUrl, apiDescription } = await req.json();

    // Fetch API documentation if URL provided
    let apiDocs = '';
    if (apiDocUrl) {
      try {
        const docResponse = await fetch(apiDocUrl);
        apiDocs = await docResponse.text();
      } catch (e) {
        apiDocs = 'Could not fetch documentation';
      }
    }

    // Use AI to analyze and build integration
    const integrationConfig = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert API integration builder. Analyze this API and create a complete integration configuration.

API Name: ${apiName}
Description: ${apiDescription}
Documentation: ${apiDocs.substring(0, 5000)}

Generate:
1. Base URL (extract from docs or infer standard format)
2. Authentication type (API Key, Bearer Token, OAuth2, etc.)
3. Common endpoints with methods, paths, and descriptions
4. Required credentials/secrets
5. Sample request/response formats
6. Integration category (social, crm, email, etc.)

Be specific and actionable. If unclear, make educated guesses based on API best practices.`,
      response_json_schema: {
        type: "object",
        properties: {
          base_url: { type: "string" },
          auth_type: { type: "string" },
          auth_header: { type: "string" },
          secret_name: { type: "string" },
          category: { type: "string" },
          endpoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                method: { type: "string" },
                path: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          credentials_required: {
            type: "array",
            items: { type: "string" }
          },
          usage_examples: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    // Create integration entity
    const integration = await base44.entities.Integration.create({
      name: apiName,
      description: apiDescription,
      category: integrationConfig.category || 'custom',
      integration_type: 'ai_generated',
      status: 'disconnected',
      icon_name: 'Plug',
      api_config: {
        base_url: integrationConfig.base_url,
        auth_type: integrationConfig.auth_type,
        auth_header: integrationConfig.auth_header,
        secret_name: integrationConfig.secret_name,
        endpoints: integrationConfig.endpoints
      },
      credentials_required: integrationConfig.credentials_required,
      function_name: 'universalApiCaller'
    });

    return Response.json({ 
      success: true,
      integration,
      config: integrationConfig,
      usage_examples: integrationConfig.usage_examples
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});