import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

// Load .env if present
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const host = process.env.VPS_HOST;
const user = process.env.VPS_USER;
const keyPath = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT || "22";

if (!host || !user || !keyPath) {
  console.error("Missing env vars. Required: VPS_HOST, VPS_USER, VPS_KEY_PATH");
  console.error("Set in .env or environment. Optional: VPS_PORT (default 22)");
  process.exit(1);
}

const remoteBase = "~/git/portfolio";
const sshOpts = `-p ${port} -i ${keyPath} -o StrictHostKeyChecking=no`;
const scpOpts = `-P ${port} -i ${keyPath} -o StrictHostKeyChecking=no`;

function scp(local: string, remote: string, label: string) {
  if (!existsSync(local)) {
    console.log(`  ⚠ Skip (not found): ${local}`);
    return;
  }
  console.log(`  → ${label}`);
  execSync(`scp ${scpOpts} "${local}" ${user}@${host}:${remote}`, { stdio: "inherit" });
}

function scpDir(localDir: string, remoteDir: string, label: string) {
  if (!existsSync(localDir)) {
    console.log(`  ⚠ Skip (not found): ${localDir}`);
    return;
  }
  console.log(`  → ${label}`);
  ssh(`mkdir -p ${remoteDir}`, `Ensuring ${remoteDir}`);
  execSync(`scp -r ${scpOpts} "${localDir}/." ${user}@${host}:${remoteDir}`, { stdio: "inherit" });
}

function ssh(cmd: string, label: string) {
  console.log(`  → ${label}`);
  const init = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
  execSync(`ssh ${sshOpts} ${user}@${host} "${init} && ${cmd}"`, { stdio: "inherit" });
}

const artifacts = resolve(root, "artifacts");

// --- Upload assets from artifacts ---
console.log("\n🖼 Uploading assets...");
scpDir(resolve(artifacts, "assets"), `${remoteBase}/assets`, "assets/");

// --- Upload data (content only, skip runtime-managed files) ---
const skipData = new Set(["analytics.json", "interactions.json", "deploy.json", "viewlog.json"]);
const dataDir = resolve(artifacts, "data");

if (existsSync(dataDir)) {
  console.log("\n📦 Uploading data files...");
  ssh(`mkdir -p ${remoteBase}/data`, "Ensuring remote data dir");
  for (const file of readdirSync(dataDir).filter(f => f.endsWith(".json") && !skipData.has(f))) {
    scp(resolve(dataDir, file), `${remoteBase}/data/${file}`, `data/${file}`);
  }
} else {
  console.log("\n⚠ No artifacts/data/ found — run build:artifacts first if you need to upload data");
}

// --- Restart pm2 ---
console.log("\n🔄 Restarting server...");
ssh("pm2 restart portfolio", "pm2 restart portfolio");

console.log("\n✓ Upload complete.");
