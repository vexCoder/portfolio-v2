// Put a private app on the VPS, or take one off.
//
//   pnpm app:push <folder> <name>   copy <folder> to ~/git/portfolio/apps/<name>/
//   pnpm app:remove <name>          delete ~/git/portfolio/apps/<name>/
//
// <folder> is a built app: a Vite dist/ folder or a plain HTML folder with
// an index.html. Pushing again replaces the whole app. No restart needed.
// Add --local to use the repo's apps/ folder instead of the VPS.

import { cpSync, existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { root, scpFolder, ssh } from "./vps.js";

const NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

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

const argv = process.argv.slice(2);
const local = argv.includes("--local");
const [command, ...args] = argv.filter((a) => a !== "--local");

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
    fail(`No index.html in ${folder}. Build the app first (Vite: vite build --base=/__apps/${name}/).`);
  }

  if (local) {
    const target = resolve(root, "apps", name);
    rmSync(target, { recursive: true, force: true });
    cpSync(folder, target, { recursive: true });
    console.log(`Copied to apps/${name}/. Open http://localhost:3000/__apps/${name}/`);
  } else {
    // Upload to a hidden temp folder, then swap it in, so the old version
    // keeps working until the new one is complete. Hidden folders are not served.
    const tmp = `.${name}.uploading`;
    ssh(`mkdir -p ~/git/portfolio/apps && rm -rf ~/git/portfolio/apps/${tmp}`);
    scpFolder(folder, `git/portfolio/apps/${tmp}`);
    ssh(`cd ~/git/portfolio/apps && rm -rf ${name} && mv ${tmp} ${name}`);
    console.log(`Done. It is live at /__apps/${name}/`);
  }
} else if (command === "remove") {
  const name = checkName(args[0]);
  if (local) {
    rmSync(resolve(root, "apps", name), { recursive: true, force: true });
  } else {
    ssh(`rm -rf ~/git/portfolio/apps/${name}`);
  }
  console.log(`Removed ${name}.`);
} else {
  fail("Usage: pnpm app:push <folder> <name>  |  pnpm app:remove <name>");
}
