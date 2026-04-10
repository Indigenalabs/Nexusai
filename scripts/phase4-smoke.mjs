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
  const out = {};
  out.suites = await req('/v4/evals/suites');
  out.eval = await req('/v4/evals/run', { method: 'POST', body: JSON.stringify({ suite: 'command_center_core' }) });
  out.obs = await req('/v4/observability');
  out.slo = await req('/v4/slo');
  console.log(JSON.stringify({
    base: BASE,
    eval_score: out.eval?.result?.summary?.score,
    slo_status: out.slo?.result?.status,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
