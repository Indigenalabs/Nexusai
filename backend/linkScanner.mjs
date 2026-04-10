const USER_AGENT = "NexusAI-CompassScanner/1.0 (+local)";

function safeText(html = "", max = 12000) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function extractTag(html, pattern) {
  const match = String(html || "").match(pattern);
  return (match?.[1] || "").trim();
}

function summarize(text = "") {
  if (!text) return "No textual signal extracted from page.";
  const short = text.slice(0, 220);
  return short.length < text.length ? `${short}...` : short;
}

function scoreRisk(text = "") {
  const t = String(text || "").toLowerCase();
  const highHits = ["breach", "lawsuit", "investigation", "outage", "exploit", "sanction"];
  const mediumHits = ["delay", "decline", "churn", "warning", "price increase", "downtime"];
  const high = highHits.some((k) => t.includes(k));
  const medium = mediumHits.some((k) => t.includes(k));
  if (high) return "high";
  if (medium) return "medium";
  return "low";
}

function scoreSentiment(text = "") {
  const t = String(text || "").toLowerCase();
  const pos = ["growth", "win", "record", "improve", "strong", "surge"];
  const neg = ["drop", "loss", "risk", "decline", "issue", "weak"];
  const p = pos.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
  const n = neg.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
  if (p > n + 1) return "positive";
  if (n > p + 1) return "negative";
  return "mixed";
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
    });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html };
  } finally {
    clearTimeout(timeout);
  }
}

export async function scanLinks(links = []) {
  const normalized = Array.from(new Set((links || []).map((x) => String(x || "").trim()).filter(Boolean))).slice(0, 20);
  const results = [];

  for (const url of normalized) {
    try {
      const { ok, status, html } = await fetchPage(url);
      const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "Untitled";
      const description =
        extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
        extractTag(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
      const bodyText = safeText(html);
      const merged = `${title} ${description || ""} ${bodyText}`.trim();
      results.push({
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url,
        ok,
        status_code: status,
        title,
        sentiment: scoreSentiment(merged),
        risk: scoreRisk(merged),
        summary: summarize(description || bodyText),
        scanned_at: new Date().toISOString(),
      });
    } catch (err) {
      results.push({
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url,
        ok: false,
        status_code: 0,
        title: "Unavailable",
        sentiment: "mixed",
        risk: "medium",
        summary: `Fetch failed: ${String(err?.message || err || "unknown error")}`,
        scanned_at: new Date().toISOString(),
      });
    }
  }

  return {
    links_scanned: results.length,
    high_risk: results.filter((r) => r.risk === "high").length,
    positive: results.filter((r) => r.sentiment === "positive").length,
    mixed: results.filter((r) => r.sentiment === "mixed").length,
    results,
    timestamp: new Date().toISOString(),
  };
}
