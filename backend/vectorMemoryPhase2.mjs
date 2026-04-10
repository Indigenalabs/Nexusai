import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";

const FILE = path.resolve(process.cwd(), "backend", ".data", "phase2-memory.json");

const DEFAULT_MEMORY = {
  provider: process.env.VECTOR_PROVIDER || "local",
  endpoint: process.env.VECTOR_ENDPOINT || "",
  docs: [],
};

const VECTOR_MEMORY_SCHEMA_VERSION = 2;

const memoryStore = createVersionedJsonStore({
  filePath: FILE,
  defaults: DEFAULT_MEMORY,
  storeName: "vector-memory",
  schemaVersion: VECTOR_MEMORY_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    return { ...structuredClone(DEFAULT_MEMORY), ...(value || {}), docs: parsed?.docs || value?.docs || [] };
  },
  beforeWrite(current = {}) {
    return {
      ...current,
      docs: (current.docs || []).slice(0, 50000),
    };
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 2) {
      return {
        ...current,
        docs: Array.isArray(current.docs) ? current.docs : [],
      };
    }
    return current;
  },
  backup: true,
});

function tokenize(text = "") {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function similarity(aText = "", bText = "") {
  const a = new Set(tokenize(aText));
  const b = new Set(tokenize(bText));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap += 1;
  return overlap / Math.sqrt(a.size * b.size);
}

function makeId(prefix = "mem") {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function vectorStatus() {
  const store = memoryStore.get();
  const meta = memoryStore.getMeta();
  return {
    provider: store.provider,
    endpoint: store.endpoint,
    docs: store.docs.length,
    schema_version: meta.schema_version,
    store_adapter: meta.adapter,
    timestamp: new Date().toISOString(),
  };
}

export function getVectorStoreStatus() {
  return memoryStore.status();
}

export function vectorUpsert({ namespace = "global", text = "", metadata = {} } = {}) {
  let doc = null;
  memoryStore.update((store) => {
    doc = {
      id: makeId(),
      namespace,
      text: String(text || ""),
      metadata,
      created_at: new Date().toISOString(),
    };
    store.docs.unshift(doc);
  });
  return { ok: true, doc };
}

export function vectorSearch({ namespace = "global", query = "", limit = 8 } = {}) {
  const store = memoryStore.get();
  const q = String(query || "");
  const hits = store.docs
    .filter((d) => d.namespace === namespace)
    .map((d) => ({ ...d, score: similarity(q, d.text + " " + JSON.stringify(d.metadata || {})) }))
    .filter((d) => d.score > 0 || !q)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(100, Number(limit || 8))));

  return {
    namespace,
    query: q,
    count: hits.length,
    matches: hits,
    provider: store.provider,
    timestamp: new Date().toISOString(),
  };
}
