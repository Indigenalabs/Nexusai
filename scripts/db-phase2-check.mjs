import "../backend/loadEnv.mjs";
import { getPersistenceAdapterStatus } from "../backend/persistenceAdapter.mjs";
import { getPostgresConfigStatus } from "../backend/postgresPhase2.mjs";

const adapter = getPersistenceAdapterStatus();
const postgres = getPostgresConfigStatus();

console.log(JSON.stringify({
  persistence_adapter: adapter,
  postgres,
}, null, 2));

if (adapter.requested_adapter === "postgres" && !postgres.configured) {
  console.error("db-phase2-check: DATABASE_URL is required for postgres mode");
  process.exit(1);
}
