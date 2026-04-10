import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WEBHOOK_TYPE = 'webhook';

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
};

const randomSecret = () =>
  `whsec_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`;

const safeJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const signPayload = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const mapWebhook = (integration: any) => {
  const cfg = integration.webhook_config || {};
  return {
    id: integration.id,
    name: integration.name,
    url: cfg.url || '',
    events: toArray(cfg.events),
    active: cfg.active !== false,
    secret: cfg.secret || '',
    created_date: integration.created_date,
    last_delivery: cfg.last_delivery || null,
    delivery_status: cfg.delivery_status || null,
    delivery_message: cfg.delivery_message || null,
    last_response_code: cfg.last_response_code || null,
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await safeJson(req);
    const action = payload.action;

    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    if (action === 'list_webhooks') {
      const integrations = await base44.entities.Integration.filter(
        { integration_type: WEBHOOK_TYPE },
        '-created_date',
        200
      );

      return Response.json({ status: 'success', webhooks: integrations.map(mapWebhook) });
    }

    if (action === 'create_webhook') {
      const name = String(payload.name || '').trim();
      const url = String(payload.url || '').trim();
      const events = toArray(payload.events);

      if (!name || !url || events.length === 0) {
        return Response.json({ error: 'name, url and events are required' }, { status: 400 });
      }

      const created = await base44.entities.Integration.create({
        name,
        description: `Developer webhook endpoint for ${name}`,
        category: 'other',
        status: 'connected',
        icon_name: 'Bell',
        integration_type: WEBHOOK_TYPE,
        function_name: 'developerWebhookManager',
        webhook_config: {
          url,
          events,
          active: true,
          secret: randomSecret(),
          last_delivery: null,
          delivery_status: null,
          delivery_message: null,
          last_response_code: null,
        },
      });

      return Response.json({ status: 'success', webhook: mapWebhook(created) });
    }

    if (action === 'update_webhook') {
      const id = String(payload.id || '').trim();
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

      const current = await base44.entities.Integration.read(id);
      if (!current || current.integration_type !== WEBHOOK_TYPE) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      const currentCfg = current.webhook_config || {};
      const nextCfg = {
        ...currentCfg,
        url: payload.url !== undefined ? String(payload.url).trim() : currentCfg.url,
        events: payload.events !== undefined ? toArray(payload.events) : toArray(currentCfg.events),
        active: payload.active !== undefined ? Boolean(payload.active) : currentCfg.active !== false,
      };

      const updated = await base44.entities.Integration.update(id, {
        name: payload.name !== undefined ? String(payload.name).trim() || current.name : current.name,
        status: nextCfg.active ? 'connected' : 'disconnected',
        webhook_config: nextCfg,
      });

      return Response.json({ status: 'success', webhook: mapWebhook(updated) });
    }

    if (action === 'delete_webhook') {
      const id = String(payload.id || '').trim();
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

      const current = await base44.entities.Integration.read(id);
      if (!current || current.integration_type !== WEBHOOK_TYPE) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      await base44.entities.Integration.delete(id);
      return Response.json({ status: 'success', deleted: true, id });
    }

    if (action === 'test_webhook') {
      const id = String(payload.id || '').trim();
      const eventType = String(payload.event_type || 'webhook.test');

      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

      const integration = await base44.entities.Integration.read(id);
      if (!integration || integration.integration_type !== WEBHOOK_TYPE) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      const cfg = integration.webhook_config || {};
      if (!cfg.url || cfg.active === false) {
        return Response.json({ error: 'Webhook is inactive or has no URL' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const body = {
        id: crypto.randomUUID(),
        type: eventType,
        created_at: now,
        source: 'nexus-ai',
        data: {
          webhook_id: integration.id,
          webhook_name: integration.name,
          message: 'This is a test delivery from the Developer console.',
        },
      };

      const bodyText = JSON.stringify(body);
      const signature = await signPayload(String(cfg.secret || ''), bodyText);

      let statusCode: number | null = null;
      let success = false;
      let message = 'No response';

      try {
        const response = await fetch(String(cfg.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nexus-Event': eventType,
            'X-Nexus-Signature': `sha256=${signature}`,
            'X-Nexus-Timestamp': now,
          },
          body: bodyText,
        });

        statusCode = response.status;
        success = response.ok;
        message = success
          ? `Delivered successfully (${response.status})`
          : `Endpoint returned ${response.status}`;
      } catch (err) {
        success = false;
        message = err instanceof Error ? err.message : 'Delivery failed';
      }

      const updated = await base44.entities.Integration.update(integration.id, {
        webhook_config: {
          ...cfg,
          last_delivery: now,
          delivery_status: success ? 'success' : 'failed',
          delivery_message: message,
          last_response_code: statusCode,
        },
      });

      return Response.json({
        status: success ? 'success' : 'error',
        webhook: mapWebhook(updated),
        test_delivery: {
          ok: success,
          status_code: statusCode,
          message,
          event_type: eventType,
          payload: body,
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
});
