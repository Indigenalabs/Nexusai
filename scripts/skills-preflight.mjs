import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const skillsRoot = path.join(os.homedir(), ".codex", "skills");
const installed = new Set();

if (fs.existsSync(skillsRoot)) {
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) installed.add(entry.name);
  }
}

const groups = [
  {
    name: "Debugging",
    required: true,
    options: ["debugging"],
    purpose: "Crash triage, route/page failures, runtime debugging",
  },
  {
    name: "Frontend QA",
    required: true,
    options: ["frontend-design", "ui-ux-pro-max"],
    purpose: "Tab/page UI quality, interaction and layout validation",
  },
  {
    name: "Security Review",
    required: true,
    options: ["security-best-practices", "security-threat-model"],
    purpose: "Surface hardening and risk checks during audits",
  },
  {
    name: "Code Review",
    required: true,
    options: ["requesting-code-review"],
    purpose: "Structured review findings and regression checks",
  },
  {
    name: "Framework Best Practices",
    required: false,
    options: ["next-best-practices", "vercel-react-best-practices"],
    purpose: "Consistency with framework conventions",
  },
];

const results = groups.map((g) => {
  const present = g.options.filter((s) => installed.has(s));
  return { ...g, present, ok: present.length > 0 };
});

console.log("=== Codex Skills Preflight ===");
console.log(`Skills root: ${skillsRoot}`);
console.log(`Installed skills: ${installed.size}`);

for (const r of results) {
  const label = r.ok ? "OK" : r.required ? "MISSING" : "OPTIONAL-MISSING";
  const installedStr = r.present.length ? r.present.join(", ") : "none";
  console.log(`- [${label}] ${r.name}`);
  console.log(`  purpose: ${r.purpose}`);
  console.log(`  options: ${r.options.join(", ")}`);
  console.log(`  installed: ${installedStr}`);
}

const missingRequired = results.filter((r) => r.required && !r.ok);
if (missingRequired.length > 0) {
  console.log("");
  console.log("Missing required skill groups:");
  for (const r of missingRequired) console.log(`- ${r.name}`);
  if (strict) {
    process.exitCode = 1;
  }
}

