// Shared SSH/SCP helpers for commands that talk to the VPS from your PC.
// Reads VPS_HOST, VPS_USER, VPS_KEY_PATH and VPS_PORT from .env (like upload.ts).

import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const root = resolve(__dirname, "..");

function readVpsEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    return env;
  }
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key.startsWith("VPS_")) {
      env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = readVpsEnv();
const host = process.env.VPS_HOST || env.VPS_HOST;
const user = process.env.VPS_USER || env.VPS_USER;
const keyPath = process.env.VPS_KEY_PATH || env.VPS_KEY_PATH;
const port = process.env.VPS_PORT || env.VPS_PORT || "22";

function requireVps(): void {
  if (!host || !user || !keyPath) {
    console.error("Missing VPS_HOST, VPS_USER or VPS_KEY_PATH in .env. Use --local to test without the VPS.");
    process.exit(1);
  }
}

function run(cmd: string, args: string[], options: SpawnSyncOptions = {}): void {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.error) {
    console.error(`Could not run ${cmd}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** Runs a shell command on the VPS, with nvm loaded so `node` is found. */
export function ssh(command: string): void {
  requireVps();
  const remote = [
    'export NVM_DIR="$HOME/.nvm"',
    '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
    command,
  ].join("; ");
  run("ssh", ["-p", port, "-i", keyPath!, "-o", "StrictHostKeyChecking=accept-new", `${user}@${host}`, remote]);
}

/**
 * Copies a local folder to the VPS. `remotePath` is relative to the remote home
 * folder and must not exist yet; scp creates it with the folder's contents.
 */
export function scpFolder(localDir: string, remotePath: string): void {
  requireVps();
  // Run from the parent folder and pass a relative name, so Windows drive
  // letters (C:) are never mistaken for a host name.
  run("scp", ["-r", "-P", port, "-i", keyPath!, "-o", "StrictHostKeyChecking=accept-new", `./${basename(localDir)}`, `${user}@${host}:${remotePath}`], {
    cwd: dirname(localDir),
  });
}
