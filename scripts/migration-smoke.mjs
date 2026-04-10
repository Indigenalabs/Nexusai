import fs from "node:fs";
import path from "node:path";
import { createVersionedJsonStore } from "../backend/jsonStore.mjs";

const ROOT = path.resolve(process.cwd(), "backend", ".data", "smoke");
const FILE = path.join(ROOT, "migration-smoke.json");
const META_FILE = `${FILE}.meta.json`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  for (const target of [FILE, META_FILE, `${FILE}.bak`, `${META_FILE}.bak`]) {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

async function main() {
  fs.mkdirSync(ROOT, { recursive: true });
  cleanup();

  fs.writeFileSync(FILE, `${JSON.stringify({ records: [{ id: "legacy-1" }] }, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    META_FILE,
    `${JSON.stringify({ schema_version: 1, adapter: "local_json", store_name: "migration-smoke", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );

  const store = createVersionedJsonStore({
    filePath: FILE,
    defaults: { records: [], migrated_flag: false },
    storeName: "migration-smoke",
    schemaVersion: 2,
    migrate(current = {}, { fromVersion, toVersion }) {
      const next = { ...current };
      if (fromVersion < 2 && toVersion >= 2) {
        next.migrated_flag = true;
        next.records = Array.isArray(next.records) ? next.records : [];
      }
      return next;
    },
    backup: true,
  });

  const state = store.get();
  const meta = store.getMeta();

  assert(meta.schema_version === 2, `expected schema version 2, got ${meta.schema_version}`);
  assert(meta.migrated_at, "expected migrated_at to be set");
  assert(state.migrated_flag === true, "expected migrated flag to be set");
  assert(Array.isArray(state.records) && state.records.length === 1, "expected legacy records to survive migration");

  const persistedMeta = JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  const persistedState = JSON.parse(fs.readFileSync(FILE, "utf8"));
  assert(persistedMeta.schema_version === 2, "persisted meta schema version mismatch");
  assert(persistedState.migrated_flag === true, "persisted state migration flag mismatch");

  cleanup();
  console.log("migration-smoke: ok");
}

main().catch((err) => {
  console.error(`migration-smoke: failed: ${err.message}`);
  process.exit(1);
});
