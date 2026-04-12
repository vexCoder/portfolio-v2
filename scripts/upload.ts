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
  execSync(`ssh ${sshOpts} ${user}@${host} "${cmd}"`, { stdio: "inherit" });
}

// --- Upload Resume ---
console.log("\n📄 Uploading resume...");
const resumeLocal = resolve(root, "packages/frontend/src/assets/resume.pdf");
scp(resumeLocal, `${remoteBase}/packages/frontend/src/assets/resume.pdf`, "resume.pdf");

// --- Upload Assets (icons, images, static files) ---
console.log("\n🖼 Uploading assets...");
const assetsBase = resolve(root, "packages/frontend/src/assets");
const remoteAssets = `${remoteBase}/packages/frontend/src/assets`;

// Directories
scpDir(resolve(assetsBase, "icons"), `${remoteAssets}/icons`, "icons/");
scpDir(resolve(assetsBase, "images"), `${remoteAssets}/images`, "images/");

// Root asset files
for (const file of ["favicon.svg", "apple-touch-icon.png", "logo.png"]) {
  scp(resolve(assetsBase, file), `${remoteAssets}/${file}`, file);
}

// --- Upload Data JSONs ---
console.log("\n📦 Uploading data files...");
const dataDir = resolve(root, "packages/server/src/data");
const jsonFiles = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

// Ensure remote data dirs exist
ssh(`mkdir -p ${remoteBase}/packages/server/src/data ${remoteBase}/packages/server/dist/data`, "Ensuring remote directories");

for (const file of jsonFiles) {
  const local = resolve(dataDir, file);
  // Upload to source (for rebuilds)
  scp(local, `${remoteBase}/packages/server/src/data/${file}`, `src/data/${file}`);
  // Upload to dist (runtime path)
  scp(local, `${remoteBase}/packages/server/dist/data/${file}`, `dist/data/${file}`);
}

// --- Restart pm2 ---
console.log("\n🔄 Restarting server...");
ssh("pm2 restart portfolio", "pm2 restart portfolio");

console.log("\n✓ Upload complete.");
