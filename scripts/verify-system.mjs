const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:8787";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return json;
}

async function main() {
  const checks = [];

  checks.push(await req('/health'));
  checks.push(await req('/registry'));
  checks.push(await req('/capabilities'));
  checks.push(await req('/v2/persistence/status'));
  checks.push(await req('/v2/vector/status'));
  checks.push(await req('/v3/connectors'));
  checks.push(await req('/v4/slo'));

  const actions = [
    ["commandCenterIntelligence", { action: "command_center_full_self_test" }],
    ["atlasWorkflowAutomation", { action: "atlas_full_self_test" }],
    ["maestroSocialOps", { action: "unified_social_health" }],
    ["prospectLeadGeneration", { action: "prospect_health_snapshot" }],
    ["supportSageCustomerService", { action: "support_kpi_command_center" }],
    ["centsibleFinanceEngine", { action: "financial_health_check" }],
  ];

  for (const [fn, payload] of actions) {
    checks.push(await req('/invoke', { method: 'POST', body: JSON.stringify({ functionName: fn, payload }) }));
  }

  const conv = await req('/conversations', { method: 'POST', body: JSON.stringify({ agent_name: 'nexus_agent', metadata: { source: 'verify' } }) });
  const convId = conv?.result?.conversation?.id;
  if (!convId) throw new Error('Conversation create failed');
  await req(`/conversations/${encodeURIComponent(convId)}/messages`, { method: 'POST', body: JSON.stringify({ role: 'user', content: 'hello nexus route this request' }) });
  const convState = await req(`/conversations/${encodeURIComponent(convId)}`);

  const report = {
    base: BASE,
    checks_run: checks.length,
    conversation_id: convId,
    message_count: convState?.result?.conversation?.messages?.length || 0,
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
