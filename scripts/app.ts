// Put a private app on the VPS, or take one off.
//
//   pnpm app:push <folder> <name>   copy <folder> to the VPS as app <name>
//   pnpm app:url <name>             print the app's URL (makes its id if it is new)
//   pnpm app:remove <name>          delete app <name> from the VPS
//
// Each app lives in ~/git/portfolio/apps/<name>-<12 random characters>/, and
// its URL is only the random part: /__apps/k3f9x2m7qp4z/. The random part is
// made on the first push or app:url and kept after that, so links keep working.
//
// <folder> is a built app: a Vite dist/ folder or a plain HTML folder with
// an index.html. Pushing again replaces the whole app. No restart needed.
// Add --local to use the repo's apps/ folder instead of the VPS.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { root, scpFolder, ssh, sshOutput } from "./vps.js";

const NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
// Same shape as APP_ID in packages/server/src/access/store.ts. The server only serves these.
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 12;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function checkName(name: string | undefined): string {
  if (!name || !NAME.test(name)) {
    fail("App names use only letters, digits and dashes, for example: notes or my-app");
  }
  return name;
}

function newId(name: string): string {
  let suffix = "";
  while (suffix.length < ID_LENGTH) {
    for (const byte of randomBytes(ID_LENGTH)) {
      // 252 is the largest multiple of 36 below 256; skipping bytes above it
      // keeps every character equally likely.
      if (byte < 252 && suffix.length < ID_LENGTH) {
        suffix += ID_CHARS[byte % ID_CHARS.length];
      }
    }
  }
  return `${name}-${suffix}`;
}

function isIdOf(folder: string, name: string): boolean {
  const suffix = folder.slice(name.length + 1);
  return folder.startsWith(`${name}-`) && suffix.length === ID_LENGTH && /^[a-z0-9]+$/.test(suffix);
}

const argv = process.argv.slice(2);
const local = argv.includes("--local");
const [command, ...args] = argv.filter((a) => a !== "--local");

const localApps = resolve(root, "apps");

function appFolders(): string[] {
  if (local) {
    if (!existsSync(localApps)) {
      return [];
    }
    return readdirSync(localApps, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  }
  return sshOutput("ls -1 ~/git/portfolio/apps 2>/dev/null || true").split("\n").map((l) => l.trim()).filter(Boolean);
}

function findId(name: string): string | undefined {
  return appFolders().find((folder) => isIdOf(folder, name));
}

function siteUrl(): string {
  if (local) {
    return "http://localhost:3000";
  }
  const site = JSON.parse(readFileSync(resolve(root, "packages/server/src/data/site.json"), "utf-8")) as { url: string };
  return site.url.replace(/\/+$/, "");
}

/** The URL has only the random part of the folder name: notes-k3f9x2m7qp4z -> /__apps/k3f9x2m7qp4z/ */
function appUrl(folder: string): string {
  return `${siteUrl()}/__apps/${folder.slice(-ID_LENGTH)}/`;
}

if (command === "push") {
  const [folderArg, nameArg] = args;
  if (!folderArg) {
    fail("Usage: pnpm app:push <folder> <name>");
  }
  // pnpm runs scripts from the repo root; INIT_CWD is where you typed the command.
  const folder = resolve(process.env.INIT_CWD ?? process.cwd(), folderArg);
  const name = checkName(nameArg);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    fail(`Not a folder: ${folder}`);
  }
  if (!existsSync(resolve(folder, "index.html"))) {
    fail(`No index.html in ${folder}. Build the app first.`);
  }

  const id = findId(name) ?? newId(name);
  if (local) {
    const target = resolve(localApps, id);
    rmSync(target, { recursive: true, force: true });
    cpSync(folder, target, { recursive: true });
  } else {
    // Upload to a hidden temp folder, then swap it in, so the old version
    // keeps working until the new one is complete. Hidden folders are not served.
    const tmp = `.${id}.uploading`;
    ssh(`mkdir -p ~/git/portfolio/apps && rm -rf ~/git/portfolio/apps/${tmp}`);
    scpFolder(folder, `git/portfolio/apps/${tmp}`);
    ssh(`cd ~/git/portfolio/apps && rm -rf ${id} && mv ${tmp} ${id}`);
  }
  console.log(`Done. ${name} is live at ${appUrl(id)}`);
} else if (command === "url") {
  const name = checkName(args[0]);
  let id = findId(name);
  if (!id) {
    // Make the folder now so the id stays the same when the app is pushed later.
    // An empty folder has no index.html, so nothing is served until then.
    id = newId(name);
    if (local) {
      mkdirSync(resolve(localApps, id), { recursive: true });
    } else {
      ssh(`mkdir -p ~/git/portfolio/apps/${id}`);
    }
  }
  console.log(appUrl(id));
} else if (command === "remove") {
  const name = checkName(args[0]);
  const id = findId(name);
  if (!id) {
    fail(`No app called ${name}.`);
  }
  if (local) {
    rmSync(resolve(localApps, id), { recursive: true, force: true });
  } else {
    ssh(`rm -rf ~/git/portfolio/apps/${id}`);
  }
  console.log(`Removed ${name}.`);
} else {
  fail("Usage: pnpm app:push <folder> <name>  |  pnpm app:url <name>  |  pnpm app:remove <name>");
}
