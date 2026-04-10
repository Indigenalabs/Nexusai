const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const loadPersisted = (key, fallback) => {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const savePersisted = (key, value) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op in low storage or restricted modes
  }
};

export const mergeObject = (base, incoming) => {
  if (!incoming || typeof incoming !== "object") return base;
  return { ...base, ...incoming };
};
