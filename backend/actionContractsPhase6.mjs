import { nowIso } from "./controlState.mjs";

const CONTRACTS = {
  social_posting: {
    action: "social_posting",
    description: "Publish social content through configured social connector.",
    risk: "medium",
    required_connectors: ["social"],
    input_schema: {
      platform: "string",
      content: "string",
      media_urls: "string[] (optional)",
      account_id: "string (optional)",
      dry_run: "boolean (optional)",
    },
    output_schema: {
      ok: "boolean",
      mode: "live|simulated",
      post_id: "string",
      platform: "string",
      published_at: "ISO timestamp",
      summary: "string",
    },
    success_criteria: [
      "Connector is configured and reachable OR dry-run simulation is returned",
      "post_id returned",
      "summary returned",
    ],
    rollback: {
      strategy: "best_effort_delete_post",
      action: "social_posting.rollback",
    },
  },
  email_replies: {
    action: "email_replies",
    description: "Send or queue email replies through configured email connector.",
    risk: "medium",
    required_connectors: ["email"],
    input_schema: {
      to: "string or string[]",
      subject: "string",
      body: "string",
      thread_id: "string (optional)",
      inbox: "string (optional)",
      dry_run: "boolean (optional)",
    },
    output_schema: {
      ok: "boolean",
      mode: "live|simulated",
      message_id: "string",
      accepted: "boolean",
      summary: "string",
    },
    success_criteria: [
      "message_id returned",
      "accepted=true for live mode",
      "summary returned",
    ],
    rollback: {
      strategy: "best_effort_recall_or_followup",
      action: "email_replies.rollback",
    },
  },
  document_ingestion: {
    action: "document_ingestion",
    description: "Ingest document, index into vector memory, and sync archive.",
    risk: "low",
    required_connectors: ["docs"],
    input_schema: {
      name: "string",
      mime: "string",
      text: "string",
      namespace: "string (optional)",
      cloud_target: "string (optional)",
      dry_run: "boolean (optional)",
    },
    output_schema: {
      ok: "boolean",
      mode: "live|simulated",
      doc_id: "string",
      indexed: "boolean",
      synced: "boolean",
      summary: "string",
    },
    success_criteria: [
      "doc_id returned",
      "indexed=true",
      "summary returned",
    ],
    rollback: {
      strategy: "mark_archived_and_reindex",
      action: "document_ingestion.rollback",
    },
  },
  shop_operations: {
    action: "shop_operations",
    description: "Execute bounded Shopify/e-commerce order and inventory operations.",
    risk: "high",
    required_connectors: ["ecommerce"],
    input_schema: {
      operation: "create_order|update_order|add_sku|update_inventory",
      payload: "object",
      dry_run: "boolean (optional)",
    },
    output_schema: {
      ok: "boolean",
      mode: "live|simulated",
      operation_id: "string",
      operation: "string",
      summary: "string",
    },
    success_criteria: [
      "operation_id returned",
      "operation reflected in merchant state",
      "summary returned",
    ],
    rollback: {
      strategy: "compensating_order_or_inventory_adjustment",
      action: "shop_operations.rollback",
    },
  },
  agent_operation: {
    action: "agent_operation",
    description: "Execute a bounded agent action using deterministic wrapper with connector-aware side effects.",
    risk: "medium",
    required_connectors: ["social|email|docs|ecommerce (derived by action class)"],
    input_schema: {
      function_name: "string",
      action: "string",
      params: "object (optional)",
      connector_key: "string (optional override)",
      dry_run: "boolean (optional)",
    },
    output_schema: {
      ok: "boolean",
      mode: "live|simulated",
      operation_id: "string",
      function_name: "string",
      action: "string",
      connector_key: "string",
      summary: "string",
    },
    success_criteria: [
      "operation_id returned",
      "summary returned",
      "connector routing resolved",
    ],
    rollback: {
      strategy: "compensating_followup_or_manual_review",
      action: "agent_operation.rollback",
    },
  },
};

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function requireField(errors, params, key, type) {
  const value = params?.[key];
  if (value === undefined || value === null || value === "") {
    errors.push(`Missing required field: ${key}`);
    return;
  }
  if (type === "string" && typeof value !== "string") errors.push(`Field ${key} must be string`);
  if (type === "object" && !isObject(value)) errors.push(`Field ${key} must be object`);
}

export function listActionContracts() {
  return {
    contracts: Object.values(CONTRACTS),
    count: Object.keys(CONTRACTS).length,
    timestamp: nowIso(),
  };
}

export function getActionContract(action = "") {
  return CONTRACTS[String(action || "").toLowerCase()] || null;
}

export function validateActionInput(action = "", params = {}) {
  const key = String(action || "").toLowerCase();
  const errors = [];
  if (!CONTRACTS[key]) {
    errors.push(`Unknown deterministic action: ${action}`);
    return { ok: false, errors };
  }

  if (key === "social_posting") {
    requireField(errors, params, "platform", "string");
    requireField(errors, params, "content", "string");
    if (params?.media_urls !== undefined && !isStringArray(params.media_urls)) errors.push("media_urls must be string[]");
  } else if (key === "email_replies") {
    requireField(errors, params, "subject", "string");
    requireField(errors, params, "body", "string");
    if (!params?.to || !(typeof params.to === "string" || isStringArray(params.to))) {
      errors.push("to must be string or string[]");
    }
  } else if (key === "document_ingestion") {
    requireField(errors, params, "name", "string");
    requireField(errors, params, "mime", "string");
    requireField(errors, params, "text", "string");
  } else if (key === "shop_operations") {
    requireField(errors, params, "operation", "string");
    requireField(errors, params, "payload", "object");
    const op = String(params?.operation || "");
    if (!["create_order", "update_order", "add_sku", "update_inventory"].includes(op)) {
      errors.push("operation must be one of create_order|update_order|add_sku|update_inventory");
    }
  } else if (key === "agent_operation") {
    requireField(errors, params, "function_name", "string");
    requireField(errors, params, "action", "string");
    if (params?.params !== undefined && !isObject(params.params)) errors.push("params must be object when provided");
  }

  return {
    ok: errors.length === 0,
    errors,
    contract: CONTRACTS[key],
  };
}
