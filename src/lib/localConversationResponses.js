const cleanList = (items = []) => items.map((item) => String(item || "").trim()).filter(Boolean);

export function pickLocalFollowUp(primary = "", options = [], seed = "") {
  const candidates = cleanList([primary, ...(Array.isArray(options) ? options : [])]);
  if (!candidates.length) return "";
  const hashBase = `${primary}|${seed}|${candidates.length}`;
  const hash = Array.from(hashBase).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return candidates[hash % candidates.length];
}

export function pickLocalLead(...options) {
  const flat = options.flat ? options.flat() : options;
  return pickLocalFollowUp("", flat, "lead");
}

export function isThreadRecapLocalPrompt(text = "") {
  return /where were we|recap|catch me up|remind me|summarize the thread|what's the state/i.test(String(text || "").toLowerCase());
}

export function isVagueTensionLocalPrompt(text = "") {
  return /feels off|something is off|things feel messy|everything feels messy|it feels fragile|i'm uneasy|i'm worried|im worried|this feels messy|too many moving parts|a lot going on/i.test(String(text || "").toLowerCase());
}

export function isMessyLocalPrompt(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length >= 28;
}

export function isTradeoffLocalPrompt(text = "") {
  return /trade[\s-]?off|compare|comparison|vs\.?|versus|option a|option b|which is better|two good paths|better path/i.test(String(text || "").toLowerCase());
}

export function isChallengeLocalPrompt(text = "") {
  return /push back|challenge (that|this|me)|argue against|what am i missing|why not|devil'?s advocate|poke holes/i.test(String(text || "").toLowerCase());
}

export function isObjectionLocalPrompt(text = "") {
  return /too expensive|too risky|too slow|won't work|dont like that|don't like that|not convinced|that feels off|hard no|i disagree|not comfortable/i.test(String(text || "").toLowerCase());
}

export function getRecentLocalThreadContext(taskState = {}) {
  const goal = String(taskState?.goal || "").trim();
  const lastAction = String(taskState?.last_action || "").trim();
  const memory = taskState?.agent_memory || {};
  const latestDecision = Array.isArray(memory?.decision_log) ? memory.decision_log[0] : null;
  const latestDiagnosis = Array.isArray(memory?.diagnosis_log) ? memory.diagnosis_log[0] : null;
  return {
    goal,
    lastAction,
    latestDecision: latestDecision?.title || latestDecision?.summary || "",
    latestDiagnosis: latestDiagnosis?.title || latestDiagnosis?.summary || "",
  };
}

export function getLocalDisagreementLens(agentName = "") {
  return {
    Maestro: "the wrong move is usually forcing more spend through a weak offer or tired creative",
    Centsible: "the wrong move is usually optimizing for optics instead of cash impact",
    Pulse: "the wrong move is usually treating a people signal like an isolated incident",
    Merchant: "the wrong move is usually solving for volume while quietly damaging margin or inventory health",
    Veritas: "the wrong move is usually moving faster commercially than the risk posture can support",
    Inspect: "the wrong move is usually shipping on partial confidence and then paying for it later",
    Nexus: "the wrong move is usually treating a coordination problem like a single-team issue",
  }[String(agentName || "")] || "the wrong move is usually acting before the signal is strong enough";
}

export function buildLocalConditionalReasoning({ primaryLabel = "", secondaryLabel = "", specialty = {}, agentName = "" } = {}) {
  const domain = specialty.domain || agentName || "this lane";
  return [
    primaryLabel ? `If the signal holds, ${primaryLabel} is the stronger move.` : "",
    secondaryLabel ? `If the signal is still noisy, ${secondaryLabel} is the safer move.` : "",
    `In ${domain}, I usually decide by asking whether the fastest move is also the one most likely to survive a week of scrutiny.`,
  ].filter(Boolean).join("\n");
}

export function buildLocalContextCarry({ threadContext = {}, businessContext = {}, memoryNarrative = "" } = {}) {
  return [
    businessContext.identity || "",
    memoryNarrative || "",
    threadContext.goal ? `I'm carrying forward the current goal: ${threadContext.goal}.` : "",
  ].filter(Boolean).join("\n");
}

export function buildLocalThreadRecap({ businessContext = {}, memoryChange = {}, threadContext = {}, specialty = {} } = {}) {
  return [
    "Here's where we left it.",
    threadContext.goal ? `We were working toward ${threadContext.goal}.` : "",
    threadContext.lastAction ? `The last active lane was ${threadContext.lastAction}.` : "",
    memoryChange.decision || "",
    memoryChange.diagnosis || "",
    specialty.relevance || businessContext.identity || "",
    "If you want, I can pick this back up from the current lane or re-rank the options from here.",
  ].filter(Boolean).join("\n");
}

export function buildLocalTensionResponse({ agentName = "Nexus", businessContext = {}, memoryNarrative = "", specialty = {}, threadContext = {} } = {}) {
  return [
    pickLocalLead(
      "I can feel the tension in this.",
      "This sounds like the kind of situation where several small problems start compounding.",
      "This usually means the system is carrying more strain than any one metric shows."
    ),
    buildLocalContextCarry({ threadContext, businessContext, memoryNarrative }),
    specialty.lens || "",
    specialty.signals || "",
    "Before we force a decision, I'd separate signal, strain, and actual constraint.",
    pickLocalFollowUp("If you want, I can help name the real pressure points first.", [
      "I can also narrow this to the 2 or 3 things actually driving the tension.",
      "If it helps, I can turn the unease into a concrete diagnosis.",
    ], agentName),
  ].filter(Boolean).join("\n");
}

export function buildLocalSynthesisResponse({ agentName = "Nexus", specialty = {}, knowledge = {}, businessContext = {}, memoryNarrative = "", memoryChange = {}, threadContext = {} } = {}) {
  return [
    pickLocalLead(
      "Here's the shape of the problem as I see it.",
      "Let me synthesize this before we pick a move.",
      "The real issue here is not just one tactic, it's the way these pressures interact."
    ),
    buildLocalContextCarry({ threadContext, businessContext, memoryNarrative }),
    specialty.relevance || "",
    specialty.lens || `From a ${knowledge.domain || specialty.domain || agentName} perspective, the main pressure is where several forces are colliding at once.`,
    `The central tension is that ${memoryChange?.diagnosis || "you have multiple pressures pulling in different directions"}.`,
    specialty.signals || "",
    specialty.heuristic || "",
    pickLocalFollowUp("The cleanest next step is to separate what is urgent, what is structural, and what can wait.", [
      "If you want, I can turn that into a decision memo next.",
      "If it helps, I can map the first move and the tradeoffs behind it.",
    ], agentName),
  ].filter(Boolean).join("\n");
}

export function buildLocalTradeoffResponse({ agentName = "Nexus", options = [], specialty = {}, knowledge = {}, businessContext = {}, memoryNarrative = "", threadContext = {} } = {}) {
  const viable = (options || []).filter((entry) => Number(entry?.score || 0) > 0).slice(0, 2);
  if (viable.length < 2) return "";
  const [first, second] = viable;
  const firstLabel = first?.item?.label || first?.cap?.label || "Option 1";
  const secondLabel = second?.item?.label || second?.cap?.label || "Option 2";
  const recommendation = Number(first.score || 0) >= Number(second.score || 0) ? firstLabel : secondLabel;
  return [
    pickLocalLead("There are two credible paths here.", "I see two good ways to play this.", "There are two strong options worth weighing."),
    memoryNarrative || "",
    businessContext.identity || "",
    `${firstLabel}: better when you want ${first.score >= second.score ? "the cleaner immediate move" : "more upside if the signal holds"}.`,
    `${secondLabel}: better when you want ${first.score >= second.score ? "more flexibility before committing" : "the steadier lower-risk path"}.`,
    specialty.lens || `In ${knowledge.domain || specialty.domain || agentName}, the real tradeoff is speed versus confidence.`,
    buildLocalConditionalReasoning({ primaryLabel: firstLabel, secondaryLabel: secondLabel, specialty, agentName }),
    threadContext.goal ? `Given the goal I'm already tracking, the decision point is whether ${firstLabel} helps sooner than ${secondLabel} without creating rework.` : "",
    threadContext.latestDiagnosis ? `I'm also anchoring this to the current diagnosis thread: ${threadContext.latestDiagnosis}.` : "",
    `${pickLocalLead(`I'd still start with ${recommendation}.`, `If I were sequencing this, I'd begin with ${recommendation}.`, `My lean is still ${recommendation}.`)} ${specialty.heuristic || ""}`.trim(),
    pickLocalFollowUp("If you want, I can lay out the tradeoffs step by step.", [
      "If it helps, I can pressure-test the weaker path too.",
      "I can also turn the recommended path into a concrete plan.",
    ], agentName),
  ].filter(Boolean).join("\n");
}

export function buildLocalChallengeResponse({ agentName = "Nexus", primary = null, secondary = null, specialty = {}, knowledge = {}, businessContext = {}, memoryNarrative = "", threadContext = {} } = {}) {
  const primaryLabel = primary?.item?.label || primary?.cap?.label || primary?.label || "that path";
  const secondaryLabel = secondary?.item?.label || secondary?.cap?.label || secondary?.label || "the alternative";
  return [
    pickLocalLead(
      `If I push back on ${primaryLabel}, the main risk is moving too quickly before the signal is clean.`,
      `Let me challenge ${primaryLabel} for a second.`,
      `If I take the skeptical view on ${primaryLabel}, here's where it can go wrong.`
    ),
    memoryNarrative || "",
    businessContext.risk || businessContext.identity || "",
    `From a ${specialty.domain || knowledge.domain || agentName} point of view, ${getLocalDisagreementLens(agentName)}.`,
    specialty.signals || `The thing I'd watch hardest in ${specialty.domain || knowledge.domain || agentName} is whether the underlying signal is real or just noisy.`,
    buildLocalConditionalReasoning({ primaryLabel, secondaryLabel, specialty, agentName }),
    threadContext.latestDecision ? `I'm pushing against the current decision thread rather than starting over: ${threadContext.latestDecision}.` : "",
    specialty.heuristic || "",
    `The strongest alternative is ${secondaryLabel}.`,
    pickLocalFollowUp("If you want, I can compare them directly and tell you where I'd draw the line.", [
      "If it helps, I can make the case for both sides before we choose.",
      "I can also turn that skepticism into a safer first-step plan.",
    ], agentName),
  ].filter(Boolean).join("\n");
}

export function buildLocalObjectionResponse({ agentName = "Nexus", specialty = {}, knowledge = {}, businessContext = {}, memoryNarrative = "", threadContext = {}, ranked = [] } = {}) {
  const best = ranked?.[0]?.item?.label || ranked?.[0]?.cap?.label || "the current path";
  const alt = ranked?.[1]?.item?.label || ranked?.[1]?.cap?.label || "the lower-risk alternative";
  return [
    pickLocalLead("That objection is fair.", "I think that pushback is reasonable.", "You're right to challenge that before we commit."),
    buildLocalContextCarry({ threadContext, businessContext, memoryNarrative }),
    `If ${best} feels too aggressive, the safer adjustment is ${alt}.`,
    "If the objection is mainly about risk, we can narrow scope first. If it is mainly about time or cost, we can simplify the first step instead of abandoning the direction entirely.",
    specialty.heuristic || `In ${knowledge.domain || specialty.domain || agentName}, I usually keep the thesis but reduce the blast radius.`,
    pickLocalFollowUp("If you want, I can reshape the recommendation around that objection.", [
      "I can also give you the lowest-risk version of the plan.",
      "If it helps, I can show what I would cut first.",
    ], agentName),
  ].filter(Boolean).join("\n");
}
