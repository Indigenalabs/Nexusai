import { execFileSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, { stdio: "inherit" });
}

const tag = String(process.argv[2] || "").trim();

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('Usage: node scripts/create-release-tag.mjs v0.1.0');
  process.exit(1);
}

run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
run("git", ["push", "origin", tag]);

console.log(`release-tag: pushed ${tag}`);
