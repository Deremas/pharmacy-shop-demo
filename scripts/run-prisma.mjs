import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const envFiles = [".env.local", ".env.production", ".env"];

for (const envFile of envFiles) {
  const envPath = path.join(projectRoot, envFile);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const prismaEntry = path.join(
  projectRoot,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const result = spawnSync(process.execPath, [prismaEntry, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
