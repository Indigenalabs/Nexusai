function safe(value = "") {
  return String(value || "").trim();
}

export function getPersistenceAdapterStatus() {
  const requested = safe(process.env.PERSISTENCE_PROVIDER || "local_json").toLowerCase() || "local_json";
  const databaseUrl = safe(process.env.DATABASE_URL);
  const supported = ["local_json", "postgres"];
  const active = supported.includes(requested) && (requested !== "postgres" || Boolean(databaseUrl)) ? requested : "local_json";

  return {
    requested_adapter: requested,
    active_adapter: active,
    supported_adapters: supported,
    database_url_present: Boolean(databaseUrl),
    adapter_coverage: {
      local_json: ["all_state"],
      postgres: [
        "persistence_phase2",
        "execution_runtime_queue",
        "execution_runtime_schedules",
        "execution_runtime_deterministic_runs",
        "execution_runtime_dead_letters",
        "chat_state_conversations",
        "chat_state_agent_memory",
        "chat_state_schema",
      ],
    },
    fallback_active: active !== requested,
    fallback_reason: active !== requested
      ? (requested === "postgres" && !databaseUrl
        ? 'Adapter "postgres" requested but DATABASE_URL is not configured'
        : `Adapter "${requested}" is not implemented in this build`)
      : "",
    timestamp: new Date().toISOString(),
  };
}
