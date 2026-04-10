export function isLocalSmallTalkPrompt(text = "") {
  return /^(how are you|how was your day|how's your day|how is your day|what'?s up|whats up|sup|good morning|good afternoon|good evening|thanks|thank you)\b/i.test(String(text || "").trim());
}

export function inferLocalConversationMode(text = "", currentGoal = "") {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return "chat";
  if (isLocalSmallTalkPrompt(clean)) return "chat";
  if (/^(hello|hi|hey|yo)\b/.test(clean)) return "chat";
  if (/^(help|thoughts|ideas|advice|not sure|unsure|what do you think|can you help|this feels messy|something feels off|i'm worried|im worried)\b/.test(clean)) return "explore";
  if (/^(what do you recommend|recommend|best option|your pick|what should i do|why that one)\b/.test(clean)) {
    return currentGoal && !isLocalSmallTalkPrompt(currentGoal) ? "decide" : "explore";
  }
  if (/run it|execute|go ahead|do it|ship it|launch|apply/.test(clean)) return "execute";
  if (/plan|show me a plan|draft please|map it out/.test(clean)) return "plan";
  return "work";
}

export function inferLocalApprovalMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/analysis only|just analyze|no execute|don't execute|do not execute/.test(t)) return "analysis";
  if (/execute|run|go ahead|do it|ship|launch/.test(t)) return "execute";
  return "unspecified";
}

export function inferLocalChatMode(text = "", current = "execute") {
  const t = String(text || "").toLowerCase();
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*plan\b/.test(t)) return "plan";
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*simulate\b/.test(t)) return "simulate";
  if (/(^|\s)(\/mode|mode)\s*[:=]?\s*execute\b/.test(t)) return "execute";
  if (/analysis only|plan first|ask for a plan/.test(t)) return "plan";
  if (/simulate|dry run|preview only|what would happen/.test(t)) return "simulate";
  if (/run it|execute|go ahead|do it|ship it|launch/.test(t)) return "execute";
  return current || "execute";
}

export function extractLocalConstraints(text = "") {
  const t = String(text || "");
  const constraints = [];
  const budget = t.match(/\$[\d,]+(?:\s*\/\s*(day|week|month))?/i);
  if (budget) constraints.push(`budget=${budget[0]}`);
  const dateLike = t.match(/\b(by|before|on)\s+([a-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  if (dateLike) constraints.push(`deadline=${dateLike[2]}`);
  const channels = Array.from(new Set((t.match(/meta|facebook|instagram|google|linkedin|tiktok/gi) || []).map((x) => x.toLowerCase())));
  if (channels.length) constraints.push(`channels=${channels.join(",")}`);
  return constraints.slice(0, 6);
}

export function computeNextTaskState(current = {}, text = "", action = "") {
  const clean = String(text || "").trim();
  const next = {
    goal: current.goal || "",
    constraints: Array.isArray(current.constraints) ? [...current.constraints] : [],
    approval_mode: current.approval_mode || "unspecified",
    mode: current.mode || "execute",
    last_action: current.last_action || "",
    status: current.status || "active",
    turn_count: Number(current.turn_count || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  if (clean && clean.length > 8 && !/^(hi|hello|hey|yo)\b/i.test(clean) && !isLocalSmallTalkPrompt(clean)) {
    const lower = clean.toLowerCase();
    const isModeCommand = /(^|\s)(\/mode|mode)\s*[:=]?\s*(plan|simulate|execute)\b/.test(lower);
    const shouldReplaceGoal =
      !next.goal ||
      isLocalSmallTalkPrompt(String(next.goal || "")) ||
      /^mode\b/i.test(String(next.goal || "")) ||
      /new goal|change goal|switch to|instead/i.test(lower);
    if (!isModeCommand && shouldReplaceGoal) next.goal = clean.slice(0, 240);
  }
  const mode = inferLocalApprovalMode(clean);
  if (mode !== "unspecified") next.approval_mode = mode;
  next.mode = inferLocalChatMode(clean, next.mode);
  const constraints = extractLocalConstraints(clean);
  if (constraints.length) next.constraints = Array.from(new Set([...(next.constraints || []), ...constraints])).slice(0, 8);
  if (action) next.last_action = action;
  return next;
}
