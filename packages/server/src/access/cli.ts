// The key command. On the VPS it is bundled to ~/git/portfolio/key.js:
//
//   node key.js                       one link that opens every app (lands on the portfolio)
//   node key.js --count 3             three of them
//   node key.js --name maria          label it maria instead of a random label
//   node key.js --app notes           a key for notes only; the link opens notes
//   node key.js --app notes,todo      a key for notes and todo; the link opens notes
//   node key.js --redirect notes      a key for every app; the link opens notes
//   node key.js list                  every label and its state
//   node key.js revoke <label>        kill that label's unused links and logged-in browsers
//
// Each link works once, on one browser. From your PC use `pnpm key ...`
// (scripts/key.ts), which runs this over SSH.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  accessFile,
  appIdOf,
  appNameOf,
  createInvite,
  findAppFolder,
  labelTaken,
  listPeople,
  revokePerson,
} from "./store.js";

const LABEL = /^[a-z0-9][a-z0-9._-]*$/;
const APP = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const MAX_COUNT = 50;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function siteUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }
  const sitePath = path.join(path.dirname(accessFile), "site.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf-8")) as { url: string };
  return site.url.replace(/\/+$/, "");
}

function checkLabel(raw: string | undefined): string {
  if (!raw) {
    fail("Give a label, for example: key revoke maria");
  }
  const label = raw.toLowerCase();
  if (!LABEL.test(label)) {
    fail("Labels use only letters, numbers, dot, dash and underscore.");
  }
  return label;
}

/** A short random label like k7f2 that no key has used yet. */
function randomLabel(): string {
  for (;;) {
    const label = crypto.randomBytes(3).toString("hex").slice(0, 4);
    if (/^[a-z]/.test(label) && !labelTaken(label) && label !== "list") {
      return label;
    }
  }
}

/** The app's folder (<name>-<id>), or a clear error if there is no such app. */
function appFolder(name: string): string {
  if (!APP.test(name)) {
    fail(`Not an app name: ${name}`);
  }
  const folder = findAppFolder(name);
  if (!folder) {
    fail(`No app called ${name}. Put it up first with: pnpm app:push <folder> ${name}`);
  }
  return folder;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function list(): void {
  const rows = listPeople();
  if (rows.length === 0) {
    console.log("No keys yet.");
  }
  for (const row of rows) {
    const parts = [row.name.padEnd(12), row.state.padEnd(8), (row.apps ? row.apps.join(",") : "all apps").padEnd(16)];
    if (row.devices > 0) {
      parts.push(`${row.devices} browser${row.devices > 1 ? "s" : ""}`);
    }
    if (row.openInvites > 0) {
      parts.push(`${row.openInvites} unused link${row.openInvites > 1 ? "s" : ""}`);
    }
    parts.push(`made ${day(row.firstInvited)}`);
    console.log(parts.join("  "));
  }
}

function revoke(arg: string | undefined): void {
  const label = checkLabel(arg);
  const count = revokePerson(label);
  if (count === 0) {
    console.log(`${label} had nothing to revoke.`);
  } else {
    console.log(`Revoked ${label}. Its links and logins no longer work.`);
  }
}

function create(args: string[]): void {
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!["--count", "--name", "--app", "--redirect"].includes(flag)) {
      fail(`Unknown option: ${flag}. Use --count, --name, --app or --redirect.`);
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`${flag} needs a value.`);
    }
    flags.set(flag, value);
    i++;
  }

  const count = Number(flags.get("--count") ?? "1");
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    fail(`--count must be a whole number from 1 to ${MAX_COUNT}.`);
  }

  const name = flags.has("--name") ? checkLabel(flags.get("--name")) : undefined;
  if (name === "list" || name === "revoke") {
    fail(`${name} cannot be a label.`);
  }

  // --app: the only apps this key opens. No --app: every app.
  // Stored as plain names (notes, not notes-k3f9...), so a re-pushed app still matches.
  const apps = flags.get("--app")?.split(",").filter(Boolean).map((a) => appNameOf(appFolder(a)));

  // --redirect: where the link opens. Default: the first --app, else the portfolio.
  const redirectArg = flags.get("--redirect");
  const redirect = redirectArg ? appNameOf(appFolder(redirectArg)) : apps?.[0];
  if (redirect && apps && !apps.includes(redirect)) {
    fail(`--redirect ${redirect} is not one of the --app apps, so the key could not open it.`);
  }
  const query = redirect ? `?app=${appIdOf(appFolder(redirect))}` : "";

  const scope = apps ? apps.join(", ") : "every app";
  const opens = redirect ? `, opens ${redirect}` : "";
  console.log(`${count === 1 ? "Key" : `${count} keys`} for ${scope}${opens}. Each link works once, on one browser.`);
  for (let i = 0; i < count; i++) {
    const label = name ?? randomLabel();
    const key = createInvite(label, { apps, autoName: !name });
    console.log(`${label.padEnd(8)}  ${siteUrl()}/invite/${key}${query}`);
  }
}

const [command, ...rest] = process.argv.slice(2);

if (command === "list") {
  list();
} else if (command === "revoke") {
  revoke(rest[0]);
} else if (command === undefined || command.startsWith("--")) {
  create(process.argv.slice(2));
} else {
  fail("Usage: key [--count 3] [--name maria] [--app notes] [--redirect notes] | key list | key revoke <label>");
}
