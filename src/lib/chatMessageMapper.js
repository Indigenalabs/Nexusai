function sanitizeVisibleMessage(content = "", role = "assistant") {
  const text = String(content || "");
  if (role !== "user") return text;
  const marker = "\n\nBusiness Profile Context:\n";
  const idx = text.indexOf(marker);
  if (idx >= 0) return text.slice(0, idx).trim();
  return text;
}

export function toUiMessages(conversation) {
  const msgs = conversation?.messages || [];
  return msgs.map((m) => ({
    role: m.role || "assistant",
    text: sanitizeVisibleMessage(m.content, m.role || "assistant"),
    sources: Array.isArray(m?.metadata?.sources) ? m.metadata.sources : [],
    routedTier: String(m?.metadata?.routed_tier || ""),
    routedModel: String(m?.metadata?.routed_model || ""),
    routedProvider: String(m?.metadata?.routed_provider || ""),
  }));
}
