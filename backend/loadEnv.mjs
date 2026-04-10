import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const root = process.cwd();
const envFiles = [
  path.resolve(root, ".env"),
  path.resolve(root, ".env.local"),
];

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    loadDotenv({ path: file, override: false });
  }
}
