import { createConversation, addConversationMessage, getChatSchemaRegistry } from "../backend/runtime.mjs";

function assert(name, condition, detail = "") {
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
  console.log(`ok - ${name}`);
}

async function run() {
  {
    const schema = getChatSchemaRegistry("maestro");
    assert("schema registry version", Boolean(schema?.version), JSON.stringify(schema));
    assert("schema registry common/actions", Boolean(schema?.common?.actions?.campaign_orchestration), JSON.stringify(schema?.common?.actions || {}));
  }

  {
    const conv = createConversation({ agent_name: "maestro_agent" }).conversation;
    let out = await addConversationMessage(conv.id, { role: "user", content: "mode plan" });
    let msg = out.conversation.messages.at(-1).content;
    assert("mode plan acknowledged", /mode set to plan/i.test(msg), msg);

    out = await addConversationMessage(conv.id, { role: "user", content: "set up campaign ads for instagram with leads objective and audience target, $200 daily" });
    msg = out.conversation.messages.at(-1).content;
    assert("campaign setup asks/handles requirements", /campaign|objective|inputs|send these/i.test(msg), msg);

    out = await addConversationMessage(conv.id, { role: "user", content: "mode execute" });
    msg = out.conversation.messages.at(-1).content;
    assert("mode execute acknowledged", /mode set to execute/i.test(msg), msg);

    out = await addConversationMessage(conv.id, { role: "user", content: "run it" });
    msg = out.conversation.messages.at(-1).content;
    assert("grounded execution receipt", /Action:\s|Run Ref:\s/i.test(msg), msg);
    assert("next best action included", /Next Best Action:/i.test(msg) || /still need:/i.test(msg), msg);
  }

  {
    const conv = createConversation({ agent_name: "nexus_agent" }).conversation;
    const out = await addConversationMessage(conv.id, { role: "user", content: "mode simulate" });
    const msg = out.conversation.messages.at(-1).content;
    assert("nexus mode simulate acknowledged", /mode set to simulate|mode set to/i.test(msg), msg);
  }

  {
    const conv = createConversation({ agent_name: "veritas_agent" }).conversation;
    let out = await addConversationMessage(conv.id, { role: "user", content: "review legal risk" });
    let msg = out.conversation.messages.at(-1).content;
    assert("veritas suggest action", /run|plan|option|review|risk/i.test(msg), msg);

    out = await addConversationMessage(conv.id, { role: "user", content: "run it" });
    msg = out.conversation.messages.at(-1).content;
    assert("veritas execution grounded", /Action:\s|Run Ref:\s|still need/i.test(msg), msg);
  }
}

run().then(() => {
  console.log("chat evals passed");
}).catch((err) => {
  console.error("chat evals failed:", err.message || err);
  process.exit(1);
});
