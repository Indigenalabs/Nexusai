import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      integrationId, 
      endpoint, 
      method = 'GET', 
      body, 
      headers = {},
      queryParams = {}
    } = await req.json();

    // Get integration config
    const integration = await base44.entities.Integration.get(integrationId);
    
    if (!integration || !integration.api_config) {
      return Response.json({ error: 'Integration not configured' }, { status: 400 });
    }

    const { base_url, auth_type, auth_header, secret_name } = integration.api_config;

    // Build auth headers
    let authHeaders = {};
    
    if (secret_name) {
      const secretValue = Deno.env.get(secret_name);
      
      if (!secretValue) {
        return Response.json({ error: `Secret ${secret_name} not configured` }, { status: 400 });
      }

      switch (auth_type) {
        case 'api_key':
          authHeaders[auth_header || 'X-API-Key'] = secretValue;
          break;
        case 'bearer_token':
          authHeaders['Authorization'] = `Bearer ${secretValue}`;
          break;
        case 'basic_auth':
          const [username, password] = secretValue.split(':');
          authHeaders['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
          break;
        case 'custom':
          authHeaders[auth_header] = secretValue;
          break;
      }
    }

    // Build URL with query params
    const url = new URL(endpoint, base_url);
    Object.keys(queryParams).forEach(key => {
      url.searchParams.append(key, queryParams[key]);
    });

    // Make API call
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => response.text());

    // Update last sync
    await base44.entities.Integration.update(integrationId, {
      last_sync: new Date().toISOString(),
      status: response.ok ? 'connected' : 'error'
    });

    return Response.json({ 
      success: response.ok,
      status: response.status,
      data
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});