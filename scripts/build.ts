import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const artifacts = resolve(root, "artifacts");
const frontend = resolve(root, "packages/frontend");
const server = resolve(root, "packages/server");

function run(cmd: string, label: string) {
  console.log(`\n→ ${label}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

async function buildArtifacts() {
  // Clean
  if (existsSync(artifacts)) {
    rmSync(artifacts, { recursive: true });
  }
  mkdirSync(artifacts, { recursive: true });

  // 1. Build CSS
  run("pnpm run build:css", "Building CSS");

  // 2. Bundle server with esbuild
  console.log("\n→ Bundling server");
  await build({
    entryPoints: [resolve(server, "src/index.ts")],
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: resolve(artifacts, "server.js"),
    banner: {
      js: [
        'import { createRequire } from "node:module";',
        "const require = createRequire(import.meta.url);",
      ].join("\n"),
    },
  });

  // 3. Copy templates
  console.log("→ Copying templates");
  cpSync(
    resolve(frontend, "src/templates"),
    resolve(artifacts, "templates"),
    { recursive: true },
  );

  // 4. Copy assets
  console.log("→ Copying assets");
  cpSync(
    resolve(frontend, "src/assets"),
    resolve(artifacts, "assets"),
    { recursive: true },
  );

  // 5. Copy compiled CSS into assets
  cpSync(
    resolve(frontend, "dist/css"),
    resolve(artifacts, "assets/css"),
    { recursive: true },
  );

  // 6. Copy data JSONs (skip runtime-managed files that live on the VPS)
  console.log("→ Copying data files");
  mkdirSync(resolve(artifacts, "data"), { recursive: true });
  const dataDir = resolve(server, "src/data");
  const skipData = new Set(["analytics.json", "interactions.json", "deploy.json", "viewlog.json"]);
  for (const f of readdirSync(dataDir).filter(f => f.endsWith(".json"))) {
    if (skipData.has(f)) continue;
    cpSync(resolve(dataDir, f), resolve(artifacts, "data", f));
  }

  // 7. Write package.json for ESM support
  writeFileSync(
    resolve(artifacts, "package.json"),
    JSON.stringify({ type: "module" }, null, 2),
  );

  console.log("\n✓ Artifacts build complete.");
  console.log("  Run: NODE_ENV=production node artifacts/server.js");
}

const mode = process.argv[2];

if (mode === "artifacts") {
  buildArtifacts();
} else {
  // Default: dev build (CSS + tsc)
  run("pnpm run build:css", "Building CSS");
  run("pnpm run build:server", "Building server");
  console.log("\n✓ Build complete.");
}
