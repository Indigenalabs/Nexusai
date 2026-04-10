import "../backend/loadEnv.mjs";
import { ensurePhase2Schema, getPostgresConfigStatus, closePostgresPool } from "../backend/postgresPhase2.mjs";

async function main() {
  const status = getPostgresConfigStatus();
  if (!status.configured) {
    throw new Error("DATABASE_URL is not configured");
  }
  await ensurePhase2Schema();
  console.log("db-phase2-apply: schema ready");
}

main()
  .catch((error) => {
    console.error(`db-phase2-apply: failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
