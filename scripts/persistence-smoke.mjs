import fs from "node:fs";
import path from "node:path";
import { createJsonStore } from "../backend/jsonStore.mjs";

const baseDir = path.resolve(process.cwd(), "backend", ".data", "smoke");
const filePath = path.join(baseDir, "persistence-smoke.json");
const backupPath = `${filePath}.bak`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  for (const file of [filePath, backupPath]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

async function main() {
  cleanup();
  const store = createJsonStore({
    filePath,
    defaults: { counter: 0, records: [] },
    backup: true,
  });

  store.update((state) => {
    state.counter = 1;
    state.records.unshift({ id: "first", created_at: new Date().toISOString() });
  });

  assert(fs.existsSync(filePath), "store file was not created");
  let persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert(persisted.counter === 1, "expected first write to persist");
  assert(Array.isArray(persisted.records) && persisted.records.length === 1, "expected one record after first write");

  store.update((state) => {
    state.counter = 2;
    state.records.unshift({ id: "second", created_at: new Date().toISOString() });
  });

  assert(fs.existsSync(backupPath), "expected backup file after second write");
  persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert(persisted.counter === 2, "expected second write to persist");
  assert(backup.counter === 1, "expected backup to contain previous version");

  const reloaded = createJsonStore({
    filePath,
    defaults: { counter: 0, records: [] },
    backup: true,
  });
  assert(reloaded.get().counter === 2, "expected store reload to read latest state");
  assert((reloaded.get().records || []).length === 2, "expected reloaded records to match latest state");

  cleanup();
  console.log("persistence-smoke: ok");
}

main().catch((err) => {
  console.error(`persistence-smoke: failed: ${err.message}`);
  process.exit(1);
});
