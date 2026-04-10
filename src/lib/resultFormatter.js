export function normalizeRuntimePayload(input) {
  const data = input?.data || input;
  const result = data?.result || data || {};
  const action = data?.action || result?.action || "run";
  const status = data?.status || result?.status || (result?.ok === false ? "error" : "success");
  const summary =
    result?.summary ||
    result?.message ||
    (typeof result === "string" ? result : `${String(action).replace(/_/g, " ")} completed.`);

  return {
    action,
    status,
    summary,
    recommendation: result?.recommendation || null,
    details: result,
    raw: input,
  };
}

export function formatRuntimeOutput(input, fallback = "No output yet.") {
  if (!input) return fallback;
  const n = normalizeRuntimePayload(input);
  const lines = [
    `Action: ${n.action}`,
    `Status: ${n.status}`,
    `Summary: ${n.summary}`,
  ];
  if (n.recommendation) lines.push(`Recommendation: ${n.recommendation}`);
  lines.push("", "Details", JSON.stringify(n.details, null, 2));
  return lines.join("\n");
}
