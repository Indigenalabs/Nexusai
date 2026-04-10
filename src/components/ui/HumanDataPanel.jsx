import React from "react";

function summarizeValue(value) {
  if (value === null || value === undefined || value === "") return "not available";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    const first = value[0];
    if (typeof first === "string" || typeof first === "number") return `${value.length} items (e.g. ${String(first)})`;
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "none";
    return `${keys.length} fields`;
  }
  return String(value);
}

export default function HumanDataPanel({ data, emptyText = "No data available.", maxItems = 8 }) {
  if (!data || (typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0)) {
    return <p className="text-xs text-slate-500">{emptyText}</p>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="space-y-2 max-h-56 overflow-auto">
        {data.slice(0, maxItems).map((item, idx) => (
          <div key={`row-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
            <p className="text-xs text-slate-200">{summarizeValue(item)}</p>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(data).slice(0, maxItems);
  return (
    <div className="space-y-2 max-h-56 overflow-auto">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</p>
          <p className="text-xs text-slate-200 mt-1">{summarizeValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

