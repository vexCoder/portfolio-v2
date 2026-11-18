// Run the invite command from your PC.
//
//   pnpm invite maria            create an invite link for maria (on the VPS)
//   pnpm invite maria notes      same, but the link lands on the notes app
//   pnpm invite list             list people and their state (on the VPS)
//   pnpm invite revoke maria     revoke maria (on the VPS)
//
// Add --local to any of them to use the local dev data instead
// (packages/server/src/data/access.json, links point at localhost).
//
// On the VPS it runs `node invite.js ...` in ~/git/portfolio over SSH.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { root, ssh } from "./vps.js";

const argv = process.argv.slice(2);
const local = argv.includes("--local");
const args = argv.filter((a) => a !== "--local");

// Only plain words go to the remote shell.
for (const a of args) {
  if (!/^[A-Za-z0-9._-]+$/.test(a)) {
    console.error(`Not a plain name: ${a}`);
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

ssh(`cd ~/git/portfolio && node invite.js ${args.join(" ")}`);
