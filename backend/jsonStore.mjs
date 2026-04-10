import fs from "node:fs";
import path from "node:path";

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clone(value) {
  return structuredClone(value);
}

export function readJsonFile(filePath, defaults, normalize = null) {
  try {
    ensureDir(filePath);
    if (!fs.existsSync(filePath)) return normalize ? normalize(clone(defaults)) : clone(defaults);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const merged = {
      ...clone(defaults),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
    return normalize ? normalize(merged, parsed) : merged;
  } catch {
    return normalize ? normalize(clone(defaults)) : clone(defaults);
  }
}

export function writeJsonFileAtomic(filePath, value, { backup = false } = {}) {
  ensureDir(filePath);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  if (backup && fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
  fs.writeFileSync(tempFile, payload, "utf8");
  fs.renameSync(tempFile, filePath);
}

export function createJsonStore({ filePath, defaults, normalize = null, beforeWrite = null, backup = false }) {
  let state = readJsonFile(filePath, defaults, normalize);

  function save() {
    const next = beforeWrite ? beforeWrite(clone(state)) : clone(state);
    state = next;
    writeJsonFileAtomic(filePath, next, { backup });
  }

  return {
    filePath,
    get() {
      return state;
    },
    reload() {
      state = readJsonFile(filePath, defaults, normalize);
      return state;
    },
    replace(nextState) {
      state = normalize ? normalize(clone(nextState)) : clone(nextState);
      save();
      return state;
    },
    update(mutator) {
      mutator(state);
      save();
      return state;
    },
    save,
  };
}

function defaultStoreMeta({ schemaVersion = 1, adapter = "local_json", storeName = "" } = {}) {
  return {
    schema_version: Number(schemaVersion || 1),
    adapter: String(adapter || "local_json"),
    store_name: String(storeName || ""),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    migrated_at: null,
  };
}

export function createVersionedJsonStore({
  filePath,
  defaults,
  normalize = null,
  beforeWrite = null,
  backup = false,
  schemaVersion = 1,
  adapter = "local_json",
  storeName = "",
  migrate = null,
}) {
  const metaFilePath = `${filePath}.meta.json`;
  const metaDefaults = defaultStoreMeta({ schemaVersion, adapter, storeName });
  let state = readJsonFile(filePath, defaults, normalize);
  const metaFileExists = fs.existsSync(metaFilePath);
  let meta = readJsonFile(metaFilePath, metaDefaults, (value = {}, parsed = value) => ({
    ...metaDefaults,
    ...(parsed && typeof parsed === "object" ? parsed : value || {}),
    schema_version: Number(parsed?.schema_version || value?.schema_version || metaDefaults.schema_version),
    adapter: String(parsed?.adapter || value?.adapter || metaDefaults.adapter),
    store_name: String(parsed?.store_name || value?.store_name || metaDefaults.store_name),
  }));

  function persistMeta() {
    meta.updated_at = new Date().toISOString();
    writeJsonFileAtomic(metaFilePath, meta, { backup });
  }

  function save() {
    const next = beforeWrite ? beforeWrite(clone(state)) : clone(state);
    state = next;
    writeJsonFileAtomic(filePath, next, { backup });
    persistMeta();
  }

  function applyMigrationsIfNeeded() {
    const currentVersion = Number(meta?.schema_version || 1);
    const targetVersion = Number(schemaVersion || 1);
    if (currentVersion >= targetVersion) return;
    if (typeof migrate === "function") {
      state = migrate(clone(state), {
        fromVersion: currentVersion,
        toVersion: targetVersion,
        meta: clone(meta),
      });
    }
    meta = {
      ...meta,
      schema_version: targetVersion,
      migrated_at: new Date().toISOString(),
    };
    save();
  }

  applyMigrationsIfNeeded();
  if (!metaFileExists) persistMeta();

  return {
    filePath,
    metaFilePath,
    get() {
      return state;
    },
    getMeta() {
      return clone(meta);
    },
    status() {
      return {
        file_path: filePath,
        meta_file_path: metaFilePath,
        schema_version: meta.schema_version,
        adapter: meta.adapter,
        store_name: meta.store_name,
        updated_at: meta.updated_at,
        migrated_at: meta.migrated_at,
      };
    },
    reload() {
      state = readJsonFile(filePath, defaults, normalize);
      meta = readJsonFile(metaFilePath, metaDefaults, (value = {}, parsed = value) => ({
        ...metaDefaults,
        ...(parsed && typeof parsed === "object" ? parsed : value || {}),
      }));
      applyMigrationsIfNeeded();
      return state;
    },
    replace(nextState) {
      state = normalize ? normalize(clone(nextState)) : clone(nextState);
      save();
      return state;
    },
    update(mutator) {
      mutator(state);
      save();
      return state;
    },
    save,
  };
}
