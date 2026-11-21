// Make and manage access keys from your PC. Each key is a one-time link.
//
//   pnpm key                       one link that opens every app (lands on the portfolio)
//   pnpm key --count 3             three of them
//   pnpm key --name maria          label it maria instead of a random label
//   pnpm key --app notes           a key for notes only; the link opens notes
//   pnpm key --app notes,todo      a key for notes and todo; the link opens notes
//   pnpm key --redirect notes      a key for every app; the link opens notes
//   pnpm key list                  every label and its state
//   pnpm key revoke maria          kill maria's unused links and logged-in browsers
//
// Add --local to any of them to use the local dev data instead
// (packages/server/src/data/access.json, links point at localhost).
//
// On the VPS it runs `node key.js ...` in ~/git/portfolio over SSH.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { root, ssh } from "./vps.js";

const argv = process.argv.slice(2);
const local = argv.includes("--local");
const args = argv.filter((a) => a !== "--local");

// Only plain words go to the remote shell.
for (const a of args) {
  if (!/^[A-Za-z0-9._,-]+$/.test(a)) {
    console.error(`Not a plain word: ${a}`);
    process.exit(1);
  }
}

if (local) {
  const cli = resolve(root, "packages/server/src/access/cli.ts");
  const result = spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
  process.exit(result.status ?? 1);
}

ssh(`cd ~/git/portfolio && node key.js ${args.join(" ")}`);
