import path from "node:path";
import { createVersionedJsonStore, readJsonFile } from "./jsonStore.mjs";
import { getPersistenceAdapterStatus } from "./persistenceAdapter.mjs";
import {
  getChatSchemaRegistryRow,
  getPostgresConfigStatus,
  listAgentMemoryRows,
  listChatSchemaHistoryRows,
  listConversationRows,
  replaceChatSchemaHistoryRows,
  upsertAgentMemoryRow,
  upsertChatSchemaRegistryRow,
  upsertConversationRow,
} from "./postgresPhase2.mjs";

const STATE_FILE = path.resolve(process.cwd(), "backend", ".data", "chat-state.json");
const LEGACY_RUNTIME_FILE = path.resolve(process.cwd(), "backend", ".data", "runtime-state.json");
const CHAT_STATE_SCHEMA_VERSION = 2;

const DEFAULT_STATE = {
  conversations: {},
  agentMemory: {},
  chatSchemaRegistry: null,
  chatSchemaHistory: [],
};
const mirrorState = {
  enabled: getPersistenceAdapterStatus().active_adapter === "postgres",
  hydrated_from_postgres: false,
  last_conversation_sync_at: null,
  last_agent_memory_sync_at: null,
  last_schema_sync_at: null,
  last_error: "",
};

function sanitizeLeakedPromptText(value = "") {
  let text = String(value || "");
  if (!text) return "";
  text = text.replace(/\n*\s*Business Profile Context:\s*[\s\S]*$/i, "");
  text = text.replace(/\bBusiness context:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bChannels and markets:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bBrand direction:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bFor Nexus, regulated businesses need approvals, evidence, and escalation paths designed into execution from the start\.?\s*/gi, "");
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  return text.trim();
}

function deepSanitizeChatStrings(value) {
  if (typeof value === "string") return sanitizeLeakedPromptText(value);
  if (Array.isArray(value)) return value.map((item) => deepSanitizeChatStrings(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepSanitizeChatStrings(item)]));
  }
  return value;
}

function readLegacyRuntimeChatState() {
  const legacy = readJsonFile(LEGACY_RUNTIME_FILE, {});
  return {
    conversations: legacy?.conversations || {},
    agentMemory: legacy?.agentMemory || {},
    chatSchemaRegistry: legacy?.chatSchemaRegistry || null,
    chatSchemaHistory: Array.isArray(legacy?.chatSchemaHistory) ? legacy.chatSchemaHistory : [],
  };
}

const store = createVersionedJsonStore({
  filePath: STATE_FILE,
  defaults: DEFAULT_STATE,
  storeName: "chat-state",
  schemaVersion: CHAT_STATE_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    const clean = deepSanitizeChatStrings(parsed || value || {});
    const legacy = readLegacyRuntimeChatState();
    return {
      conversations: Object.keys(clean?.conversations || {}).length ? (clean?.conversations || {}) : (legacy.conversations || {}),
      agentMemory: Object.keys(clean?.agentMemory || {}).length ? (clean?.agentMemory || {}) : (legacy.agentMemory || {}),
      chatSchemaRegistry: clean?.chatSchemaRegistry || legacy.chatSchemaRegistry || null,
      chatSchemaHistory: Array.isArray(clean?.chatSchemaHistory) && clean.chatSchemaHistory.length ? clean.chatSchemaHistory : (legacy.chatSchemaHistory || []),
    };
  },
  beforeWrite(current = {}) {
    return deepSanitizeChatStrings(current);
  },
  migrate(current = {}, { fromVersion }) {
    let next = structuredClone(current || {});
    if (fromVersion < 2) {
      next = {
        conversations: next?.conversations || {},
        agentMemory: next?.agentMemory || {},
        chatSchemaRegistry: next?.chatSchemaRegistry || null,
        chatSchemaHistory: Array.isArray(next?.chatSchemaHistory) ? next.chatSchemaHistory : [],
      };
      next = deepSanitizeChatStrings(next);
    }
    return next;
  },
  backup: true,
});

function replaceWithHydratedChatState({
  conversations = {},
  agentMemory = {},
  chatSchemaRegistry = null,
  chatSchemaHistory = [],
} = {}) {
  store.update((state) => {
    if (conversations && Object.keys(conversations).length) {
      state.conversations = {
        ...state.conversations,
        ...deepSanitizeChatStrings(conversations),
      };
    }
    if (agentMemory && Object.keys(agentMemory).length) {
      state.agentMemory = {
        ...state.agentMemory,
        ...deepSanitizeChatStrings(agentMemory),
      };
    }
    if (chatSchemaRegistry) {
      state.chatSchemaRegistry = deepSanitizeChatStrings(chatSchemaRegistry);
    }
    if (Array.isArray(chatSchemaHistory) && chatSchemaHistory.length) {
      state.chatSchemaHistory = deepSanitizeChatStrings(chatSchemaHistory);
    }
  });
}

async function hydrateChatStateFromPostgres() {
  if (!mirrorState.enabled) return;
  try {
    const [conversationRows, agentMemoryRows, chatSchemaRegistry, chatSchemaHistory] = await Promise.all([
      listConversationRows(2000),
      listAgentMemoryRows(2000),
      getChatSchemaRegistryRow(),
      listChatSchemaHistoryRows(500),
    ]);
    replaceWithHydratedChatState({
      conversations: Object.fromEntries((conversationRows || []).filter((row) => row?.id).map((row) => [row.id, row])),
      agentMemory: Object.fromEntries((agentMemoryRows || []).filter((row) => row?.memory_key).map((row) => [row.memory_key, row.payload])),
      chatSchemaRegistry,
      chatSchemaHistory,
    });
    mirrorState.hydrated_from_postgres = true;
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Chat state hydration failed");
  }
}

async function mirrorConversation(record = null) {
  if (!mirrorState.enabled || !record?.id) return;
  try {
    await upsertConversationRow(record);
    mirrorState.last_conversation_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Conversation mirror failed");
  }
}

async function mirrorAgentMemory(memoryKey = "", payload = null) {
  if (!mirrorState.enabled || !memoryKey) return;
  try {
    await upsertAgentMemoryRow(memoryKey, payload || {});
    mirrorState.last_agent_memory_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Agent memory mirror failed");
  }
}

async function mirrorChatSchemaRegistry(registry = null) {
  if (!mirrorState.enabled || !registry) return;
  try {
    await upsertChatSchemaRegistryRow(registry);
    mirrorState.last_schema_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Chat schema registry mirror failed");
  }
}

async function mirrorChatSchemaHistory(entries = []) {
  if (!mirrorState.enabled) return;
  try {
    await replaceChatSchemaHistoryRows(entries);
    mirrorState.last_schema_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Chat schema history mirror failed");
  }
}

await hydrateChatStateFromPostgres();

export function getChatStateStoreStatus() {
  const postgres = getPostgresConfigStatus();
  return {
    ...store.status(),
    postgres_write_through_enabled: mirrorState.enabled,
    postgres_hydrated: mirrorState.hydrated_from_postgres,
    postgres_schema_ensured: postgres.schema_ensured,
    postgres_last_conversation_sync_at: mirrorState.last_conversation_sync_at,
    postgres_last_agent_memory_sync_at: mirrorState.last_agent_memory_sync_at,
    postgres_last_schema_sync_at: mirrorState.last_schema_sync_at,
    postgres_last_error: mirrorState.last_error || postgres.last_schema_error,
  };
}

export function getConversationRecord(conversationId = "") {
  return store.get().conversations[String(conversationId || "").trim()] || null;
}

export function saveConversationRecord(conversation = null) {
  const record = conversation && typeof conversation === "object" ? structuredClone(conversation) : null;
  if (!record?.id) return null;
  store.update((state) => {
    state.conversations[record.id] = record;
  });
  void mirrorConversation(record);
  return record;
}

export function getConversationCount() {
  return Object.keys(store.get().conversations || {}).length;
}

export function getAgentMemoryRecord(key = "", legacyKey = "") {
  const state = store.get();
  const current = state.agentMemory?.[String(key || "").trim()] || null;
  const legacy = legacyKey ? state.agentMemory?.[String(legacyKey || "").trim()] || null : null;
  return current || legacy || null;
}

export function saveAgentMemoryRecord(key = "", memory = {}) {
  const next = structuredClone(memory || {});
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;
  store.update((state) => {
    state.agentMemory[normalizedKey] = next;
  });
  void mirrorAgentMemory(normalizedKey, next);
  return next;
}

export function getChatSchemaRegistryRecord() {
  return store.get().chatSchemaRegistry || null;
}

export function saveChatSchemaRegistryRecord(registry = null) {
  const next = registry && typeof registry === "object" ? structuredClone(registry) : null;
  store.update((state) => {
    state.chatSchemaRegistry = next;
  });
  void mirrorChatSchemaRegistry(next);
  return next;
}

export function getChatSchemaHistoryRecords() {
  return store.get().chatSchemaHistory || [];
}

export function saveChatSchemaHistoryRecords(entries = []) {
  const next = Array.isArray(entries) ? structuredClone(entries) : [];
  store.update((state) => {
    state.chatSchemaHistory = next;
  });
  void mirrorChatSchemaHistory(next);
  return next;
}
