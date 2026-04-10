import { loadPersisted, savePersisted } from "@/lib/persistentStore";

const KEY = "nexus.workflow.engine.v1";

const now = () => new Date().toISOString();
const id = (p = "wf") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const state = loadPersisted(KEY, { workflows: [] });

const persist = () => savePersisted(KEY, state);

export const workflowEngine = {
  start(definition = {}) {
    const workflow = {
      id: id("wf"),
      name: definition.name || "Adhoc Workflow",
      status: "running",
      created_at: now(),
      updated_at: now(),
      steps: (definition.steps || []).map((s, i) => ({
        id: id(`step${i + 1}`),
        title: s.title || `Step ${i + 1}`,
        status: "pending",
      })),
      context: definition.context || {},
      correlation_id: definition.correlation_id || id("corr"),
    };
    state.workflows.unshift(workflow);
    state.workflows = state.workflows.slice(0, 100);
    persist();
    return workflow;
  },
  completeStep(workflowId, stepId, status = "completed") {
    const wf = state.workflows.find((w) => w.id === workflowId);
    if (!wf) return null;
    const step = wf.steps.find((s) => s.id === stepId);
    if (!step) return null;
    step.status = status;
    wf.updated_at = now();
    if (wf.steps.every((s) => s.status === "completed")) wf.status = "completed";
    if (wf.steps.some((s) => s.status === "failed")) wf.status = "needs_attention";
    persist();
    return wf;
  },
  list(limit = 20) {
    return state.workflows.slice(0, limit);
  },
};
