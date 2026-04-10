const SPECIALIST_FOUNDER_AGENT_IDS = [
  "maestro",
  "prospect",
  "centsible",
  "pulse",
  "merchant",
  "veritas",
  "sage",
  "atlas",
  "chronos",
  "compass",
  "part",
  "inspect",
  "canvas",
  "support-sage",
  "scribe",
  "sentinel",
];

function compact(parts = []) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function hasLocalClientAcquisitionContext(text = "") {
  const raw = String(text || "");
  return /(clients?|customers?|leads?|referrals?|enquiries|inquiries|bookings?)/i.test(raw) &&
    /(attr|acquir|acq|bring|win|get|find|generate|grow|new|more|help|need|want|struggl|trouble)/i.test(raw);
}

export function isLocalClientAcquisitionPrompt(agentId = "", text = "") {
  return String(agentId || "") === "nexus" && hasLocalClientAcquisitionContext(text);
}

export function isLocalFounderGrowthPrompt(agentId = "", text = "") {
  if (String(agentId || "") !== "nexus") return false;
  const t = String(text || "").toLowerCase();
  return /(app|product|platform|startup|saas)/.test(t) && /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/.test(t);
}

export function hasLocalFounderGrowthContext(text = "") {
  return /(app|product|platform|startup|saas)/i.test(String(text || "")) &&
    /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/i.test(String(text || ""));
}

export function buildLocalFounderGrowthReply({ agentName = "Agent" } = {}) {
  return compact([
    `${agentName}: This is a classic early distribution problem.`,
    "The real challenge is not just getting attention. It is creating a loop where the first users get enough value to tell the next users.",
    "I'd break it into three parts: who feels the problem most sharply, what promise gets them to try the app now, and what mechanism turns early usage into repeatable growth.",
    "I'd usually start narrower, not broader. Pick one audience you can reach cheaply, one outcome you can prove quickly, and one channel you can learn fast.",
    "If you want, I can map the acquisition loop here in Nexus, or I can bring Maestro in for the growth plan and Prospect in for the first traction plays.",
  ]);
}

export function buildLocalClientAcquisitionReply({ agentName = "Nexus", businessContext = "", riskContext = "" } = {}) {
  const regulatedHint = /ndis|regulated|health|medical|compliance/i.test(`${businessContext} ${riskContext}`);
  return compact([
    `${agentName}: Client acquisition is the core growth constraint here, so I'd treat this as a demand-generation and trust-building problem, not a tooling problem.`,
    regulatedHint
      ? "For a regulated service like yours, the first levers are usually trust, referral pathways, and a smooth intake experience rather than broad awareness alone."
      : "The first levers are usually sharper positioning, a reachable audience, and a simple path from interest to conversation.",
    "I'd focus on three things first: where the highest-intent clients or referrers already are, what proof makes them trust you quickly, and how fast your enquiry-to-intake follow-up happens.",
    regulatedHint
      ? "For an NDIS-style business, that usually means support coordinators, plan managers, local search, community presence, and evidence that intake is clear and responsive."
      : "That usually means the best referral sources, the clearest promise, and the fastest path to a first call or booking.",
    "If you want, I can turn this into a concrete client-acquisition plan for the next 30 days.",
  ]);
}

export function isLocalSpecialistFounderGrowthPrompt(agentId = "", text = "") {
  const normalized = String(agentId || "");
  if (!SPECIALIST_FOUNDER_AGENT_IDS.includes(normalized)) return false;
  const t = String(text || "").toLowerCase();
  return /(app|product|platform|startup|saas)/.test(t) && /(users|subscriber|subscribers|signups|sign-ups|audience|followers|following|traction|grow|growth|distribution|egg and chicken|chicken and egg)/.test(t);
}

export function buildLocalSpecialistFounderGrowthReply({ agentId = "", agentName = "Agent" } = {}) {
  const byAgent = {
    maestro: [
      "This is a distribution and message-fit problem before it is a pure ad-spend problem.",
      "At this stage, I'd focus on one sharp audience, one reason they should care right now, and one channel where we can learn quickly.",
      "The trap is trying to speak to everyone and ending up with messaging that nobody feels is really for them.",
      "If you want, I can turn that into a concrete growth narrative, channel plan, and first campaign test matrix.",
    ],
    prospect: [
      "This is an early traction problem, which usually means we need sharper targeting before we need more volume.",
      "The first win is getting in front of the people who feel the pain most urgently and are easiest to reach directly.",
      "If you want, I can help define the first traction segment and the initial outreach play.",
    ],
    pulse: [
      "Early growth pressure usually lands on the team before it shows up cleanly on a dashboard.",
      "The people risk here is trying to solve traction by asking a small team to push in every direction at once.",
      "If you want, I can help map the people risks around this growth phase and the operating structure that makes it sustainable.",
    ],
    merchant: [
      "This is a growth problem, but the commercial question is how the product turns attention into repeatable revenue.",
      "I'd focus on the path from discovery to activation to conversion, and whether the app creates enough immediate value for people to come back or pay.",
      "If you want, I can help break this into acquisition, activation, conversion, and monetization moves.",
    ],
    veritas: [
      "Moving fast on growth is fine, but early-stage legal drag usually comes from fuzzy terms, unclear data handling, or commitments you cannot support yet.",
      "At this stage, I'd usually keep the legal posture simple and defensible: clean terms, basic privacy alignment, and clear boundaries around what the product promises.",
      "If you want, I can map the minimum viable legal or risk posture for this growth phase.",
    ],
    sage: [
      "This is a strategy sequencing problem more than a raw growth problem.",
      "The key is deciding which constraint to solve first: attention, activation, retention, or monetization.",
      "If you want, I can turn that into a 90-day founder strategy with explicit tradeoffs.",
    ],
    atlas: [
      "This is an execution-system problem once the growth idea is clear.",
      "The risk early on is that growth depends on manual work and founder memory instead of a repeatable loop.",
      "If you want, I can map the first reliable growth workflow and show where automation should and should not enter yet.",
    ],
    chronos: [
      "Founder growth problems usually become time-allocation problems very quickly.",
      "I'd separate maker time, growth time, and reactive time so the work that actually creates traction stops getting crowded out.",
      "If you want, I can help design the founder cadence and focus blocks for this stage.",
    ],
    compass: [
      "This is partly a market-discovery problem.",
      "I'd look for audience pockets, competitor gaps, messaging patterns, and timing signals that tell us where the wedge is strongest.",
      "If you want, I can help define the market wedge and the signals that would tell us we're pushing in the right direction.",
    ],
    part: [
      "This can also be a leverage problem, not just a direct-acquisition problem.",
      "I'd look for adjacent audiences, integration partners, communities, or creators who already have the attention you need.",
      "If you want, I can map the highest-leverage partnership angles for getting the first wave of users in.",
    ],
    inspect: [
      "Early growth only helps if the product experience is strong enough to survive first contact.",
      "I'd focus on the moments that decide whether a new user bounces, converts, or comes back: onboarding, first value, performance, and obvious defects.",
      "If you want, I can help define the minimum quality bar that protects growth instead of undermining it.",
    ],
    canvas: [
      "Early growth usually needs creative that makes the product easy to understand, trust, and talk about.",
      "I'd focus on the first visual hooks, founder-story angles, and simple social assets that help the app travel.",
      "If you want, I can map the first creative system for traction: hooks, visuals, landing assets, and launch content.",
    ],
    "support-sage": [
      "Early user growth creates a feedback-loop problem as much as a support problem.",
      "I'd treat support not as a cost center here, but as a source of activation insight, retention signals, and language we can feed back into the product and messaging.",
      "If you want, I can help design the early-user feedback and support loop.",
    ],
    scribe: [
      "At this stage, what matters is capturing the learning fast enough that the team does not keep relearning the same lesson.",
      "I'd focus on turning growth learnings into reusable knowledge so product, growth, and operations all compound instead of drifting.",
      "If you want, I can help define the startup knowledge loop and what should be documented first.",
    ],
    sentinel: [
      "Early-stage growth does not need enterprise security theater, but it does need a sane trust posture.",
      "I'd focus on the minimum protections that keep the app credible while preserving speed: identity, secrets, data boundaries, and a small number of high-risk checks.",
      "If you want, I can map the minimum viable security posture for this stage.",
    ],
  };
  const lines = byAgent[agentId] || [
    "This is a growth problem, but the real question is whether the acquisition path is financially survivable at your current stage.",
    "Early on, I'd watch for cheap learning before I'd optimize for scale.",
    "If you want, I can turn that into a founder-style growth-versus-runway plan.",
  ];
  return compact([`${agentName}: ${lines[0]}`, ...lines.slice(1)]);
}

export function buildLocalFounderGrowthRecommendation({ agentId = "", agentName = "Agent" } = {}) {
  const byAgent = {
    nexus: "I'd start by choosing one audience wedge, one core outcome to prove, and one channel where we can learn fast without spreading the team too thin.",
    maestro: "I'd start by tightening the audience wedge and message before trying to scale distribution.",
    prospect: "I'd start with the first high-intent segment we can reach directly and learn from quickly.",
    centsible: "I'd start with the cheapest learning loop that still tells us whether activation and retention are real.",
    pulse: "I'd start by protecting the team from trying to solve growth in too many directions at once.",
    merchant: "I'd start by tightening the path from discovery to activation to conversion before chasing more traffic.",
    veritas: "I'd start with the minimum clean legal posture that lets you grow without creating avoidable drag later.",
    sage: "I'd start with the single constraint that, if solved, would make the rest of the growth problem easier.",
    atlas: "I'd start by designing one reliable growth workflow that can be repeated without heroic effort.",
    chronos: "I'd start by protecting founder time for the work that actually creates traction.",
    compass: "I'd start by proving where the market wedge is strongest before broadening the message.",
    part: "I'd start by identifying the one partnership or channel that gives you borrowed trust fastest.",
    inspect: "I'd start by making sure the first user experience is strong enough that growth is worth amplifying.",
    canvas: "I'd start with clear launch assets that make the product easy to understand and easy to share.",
    "support-sage": "I'd start by turning early-user confusion and feedback into an activation learning loop.",
    scribe: "I'd start by capturing the lessons from user conversations and growth tests so the team compounds them.",
    sentinel: "I'd start with the minimum trust and security posture that keeps growth from exposing avoidable weaknesses.",
  };
  const nextByAgent = {
    nexus: "If you want, I can map that into a founder growth plan and bring in the right specialists behind it.",
    maestro: "If you want, I can turn that into a concrete messaging and channel plan.",
    prospect: "If you want, I can define the first traction segment and outreach motion.",
    centsible: "If you want, I can turn that into a growth-versus-runway plan.",
    pulse: "If you want, I can map the team structure and workload guardrails around it.",
    merchant: "If you want, I can break that into activation, conversion, and monetization moves.",
    veritas: "If you want, I can map the minimum viable legal posture for this phase.",
    sage: "If you want, I can turn that into a 90-day strategy with explicit tradeoffs.",
    atlas: "If you want, I can map the first repeatable execution loop.",
    chronos: "If you want, I can design the founder cadence around that priority.",
    compass: "If you want, I can define the wedge signals we should track first.",
    part: "If you want, I can map the highest-leverage partnership angles.",
    inspect: "If you want, I can define the minimum quality bar that protects growth.",
    canvas: "If you want, I can turn that into the first creative system and launch assets.",
    "support-sage": "If you want, I can design the support and feedback loop around it.",
    scribe: "If you want, I can define what the team should capture and reuse first.",
    sentinel: "If you want, I can map the minimum viable security posture for this stage.",
  };
  return compact([
    `${agentName}: ${byAgent[agentId] || "I'd start by narrowing the growth problem to the first thing that truly changes the outcome."}`,
    nextByAgent[agentId] || "If you want, I can turn that into a concrete next-step plan.",
  ]);
}

export function buildLocalClientAcquisitionRecommendation({ agentName = "Nexus", businessContext = "", riskContext = "" } = {}) {
  const regulatedHint = /ndis|regulated|health|medical|compliance/i.test(`${businessContext} ${riskContext}`);
  return compact([
    `${agentName}: I'd start by tightening the referral and enquiry loop before trying to do everything at once.`,
    regulatedHint
      ? "For a regulated service like yours, the cleanest first move is usually a focused referral engine through coordinators, plan managers, local trust signals, and faster intake follow-up."
      : "The cleanest first move is usually one clear audience, one strong proof point, and one channel that can produce real conversations quickly.",
    "If you want, I can map the exact acquisition plan and the first metrics we should watch.",
  ]);
}

export function buildLocalFounderGrowthPlan({ agentId = "", agentName = "Agent" } = {}) {
  const plans = {
    nexus: ["Choose the wedge audience and outcome to prove first.", "Pick one acquisition loop worth testing for the next 2-4 weeks.", "Bring in the right specialist lane only after that first loop is clear."],
    maestro: ["Lock the audience wedge and core message.", "Build a simple creative and channel test around that promise.", "Use the early response to refine the hook before scaling."],
    prospect: ["Define the first traction segment clearly.", "List the places or channels where those users are easiest to reach.", "Run a direct outreach or partnership motion and capture the learnings."],
    centsible: ["Set the maximum learning budget you can afford.", "Define the user behavior that proves traction is real.", "Review payback, retention, and burn before widening spend."],
    pulse: ["Clarify who owns growth, product, and follow-up work.", "Protect the team from too many parallel priorities.", "Set a weekly operating rhythm that can hold under growth pressure."],
    merchant: ["Map the path from discovery to activation to conversion.", "Find the biggest drop-off in that loop.", "Fix the conversion and monetization friction before chasing more traffic."],
    veritas: ["Make the product promise and terms clean and realistic.", "Cover the basic privacy and data handling posture.", "Avoid commitments that create drag before the growth loop is proven."],
    sage: ["Name the single constraint that matters most right now.", "Pick the proof point that would reduce the most uncertainty.", "Sequence the next 90 days around that learning loop."],
    atlas: ["Map the first repeatable growth workflow end to end.", "Identify where founder memory or manual work is holding it together.", "Add structure only where it reduces rework and delay."],
    chronos: ["Protect dedicated founder growth time every week.", "Separate strategic work from reactive work.", "Review the calendar against traction goals, not just busyness."],
    compass: ["Define the market wedge we think is strongest.", "Track the signals that would confirm or weaken that wedge.", "Adjust positioning based on real demand evidence."],
    part: ["List the audiences or ecosystems that already have trust.", "Identify the most credible leverage partner or community path.", "Run one focused partnership experiment before broadening."],
    inspect: ["Define the minimum quality bar for first-user experience.", "Check onboarding, first value, and obvious friction points.", "Fix the issues that would make growth expensive or leaky."],
    canvas: ["Define the first creative promise and visual hook.", "Build the minimum launch asset set around that message.", "Use early response to refine the story before multiplying formats."],
    "support-sage": ["Capture the first user questions and failure points fast.", "Feed those signals back into onboarding and messaging.", "Turn recurring confusion into prevention, not just replies."],
    scribe: ["Document the key growth learnings as they happen.", "Capture objections, channels, and activation patterns in one place.", "Use that knowledge to keep the team aligned as the loop evolves."],
    sentinel: ["Cover auth, secrets, and data boundaries first.", "Check the small number of weaknesses that would damage trust fastest.", "Keep the security posture lightweight but real as growth starts."],
  };
  const steps = plans[agentId] || [
    "Name the first growth constraint clearly.",
    "Pick the smallest test that reduces uncertainty fastest.",
    "Review what the test teaches before widening scope.",
  ];
  return compact([
    `${agentName}: here's how I'd map it.`,
    `1. ${steps[0]}`,
    `2. ${steps[1]}`,
    `3. ${steps[2]}`,
    "If you want, I can turn that into the exact first actions and metrics next.",
  ]);
}
