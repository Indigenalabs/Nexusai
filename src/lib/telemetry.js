import { loadPersisted, savePersisted } from "@/lib/persistentStore";

const KEY = "nexus.telemetry.v1";
const state = loadPersisted(KEY, { logs: [] });

const now = () => new Date().toISOString();
const id = (p = "log") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const persist = () => savePersisted(KEY, state);

export const telemetry = {
  log(level, event, payload = {}) {
    state.logs.unshift({ id: id(), level, event, payload, time: now() });
    state.logs = state.logs.slice(0, 300);
    persist();
  },
  info(event, payload = {}) { this.log("info", event, payload); },
  warn(event, payload = {}) { this.log("warn", event, payload); },
  error(event, payload = {}) { this.log("error", event, payload); },
  list(limit = 100) { return state.logs.slice(0, limit); },
};
