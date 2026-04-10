import fs from "node:fs";
import path from "node:path";
import { invokeFunction } from "../backend/runtime.mjs";

const ROOT = process.cwd();
const SRC_DIRS = [path.join(ROOT, "src", "pages"), path.join(ROOT, "src", "components")];

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...listFiles(full));
    else if (/\.(jsx|js|tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function extractPairs(filePath) {
  const txt = fs.readFileSync(filePath, "utf8");
  const regex = /base44\.functions\.invoke\(\s*['"]([^'"]+)['"]\s*,\s*\{[\s\S]*?action\s*:\s*['"]([^'"]+)['"]/g;
  const pairs = [];
  let m;
  while ((m = regex.exec(txt)) !== null) {
    pairs.push({ fn: m[1], action: m[2], file: filePath });
  }
  return pairs;
}

function samplePayload(fn, action) {
  if (fn === "agentCapabilityOrchestrator" && action === "run_capability") {
    return { action, params: { agent_name: "Atlas", capability_id: "atlas.workflow_automation" } };
  }
  if (fn === "agentCapabilityOrchestrator" && action === "get_agent_blueprint") {
    return { action, params: { agent_name: "Atlas" } };
  }
  if (fn === "commandCenterIntelligence" && action === "intent_routing") {
    return { action, params: { user_request: "run an ops health check" } };
  }
  return { action, params: {} };
}

async function main() {
  const files = SRC_DIRS.flatMap(listFiles);
  const found = files.flatMap(extractPairs);

  const unique = [];
  const seen = new Set();
  for (const item of found) {
    const key = `${item.fn}::${item.action}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  const failures = [];
  const successes = [];

  for (const item of unique) {
    try {
      const payload = samplePayload(item.fn, item.action);
      const res = await invokeFunction(item.fn, payload);
      const status = res?.data?.status || "success";
      if (status === "error" || res?.data?.error) {
        failures.push({ ...item, reason: res?.data?.run_error || res?.data?.error || "unknown error" });
      } else {
        successes.push(item);
      }
    } catch (err) {
      failures.push({ ...item, reason: String(err?.message || err || "invoke failed") });
    }
  }

  const report = {
    scanned_files: files.length,
    discovered_calls: found.length,
    unique_actions: unique.length,
    passed: successes.length,
    failed: failures.length,
    failures,
    generated_at: new Date().toISOString(),
  };

  const outPath = path.join(ROOT, "tmp-action-coverage-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

   
  console.log(`Action coverage: ${successes.length}/${unique.length} passed. Report: ${outPath}`);

  if (failures.length > 0) {
     
    console.error("Failures:\n" + failures.map((f) => `- ${f.fn}:${f.action} (${f.reason})`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
   
  console.error(err);
  process.exit(1);
});
