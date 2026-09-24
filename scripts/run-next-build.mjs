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

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.CI = process.env.CI || "1";
process.env.NEXT_TELEMETRY_DISABLED =
  process.env.NEXT_TELEMETRY_DISABLED || "1";
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "1";
process.env.NEXT_PRIVATE_BUILD_WORKER =
  process.env.NEXT_PRIVATE_BUILD_WORKER || "0";
process.env.NEXT_PRIVATE_MAX_WORKER_THREADS =
  process.env.NEXT_PRIVATE_MAX_WORKER_THREADS || "1";
process.env.RAYON_NUM_THREADS = process.env.RAYON_NUM_THREADS || "1";
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || "1";
process.env.NODE_OPTIONS =
  process.env.NODE_OPTIONS || "--max-old-space-size=384";
process.env.NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || ".next";

const nextEntry = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const result = spawnSync(
  process.execPath,
  [nextEntry, "build", "--webpack"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
