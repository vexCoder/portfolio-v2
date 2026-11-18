// The invite command. On the VPS it is bundled to ~/git/portfolio/invite.js:
//
//   node invite.js <name>          create a one-time invite link for <name>
//   node invite.js list            everyone invited, and their state
//   node invite.js revoke <name>   kill <name>'s open invites and sessions
//
// From your PC use `pnpm invite ...` (scripts/invite.ts), which runs this over SSH.

import fs from "node:fs";
import path from "node:path";
import { accessFile, createInvite, listPeople, revokePerson } from "./store.js";

const NAME = /^[a-z0-9][a-z0-9._-]*$/;

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

function checkName(raw: string | undefined): string {
  if (!raw) {
    fail("Give a name, for example: invite maria");
  }
  const name = raw.toLowerCase();
  if (!NAME.test(name)) {
    fail("Names use only letters, numbers, dot, dash and underscore.");
  }
  return name;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

const [command, arg] = process.argv.slice(2);

if (!command) {
  fail("Usage: invite <name> | invite list | invite revoke <name>");
}

if (command === "list") {
  const rows = listPeople();
  if (rows.length === 0) {
    console.log("Nobody invited yet.");
  }
  for (const row of rows) {
    const parts = [row.name.padEnd(16), row.state.padEnd(8)];
    if (row.devices > 0) {
      parts.push(`${row.devices} device${row.devices > 1 ? "s" : ""}`);
    }
    if (row.openInvites > 0) {
      parts.push(`${row.openInvites} unused link${row.openInvites > 1 ? "s" : ""}`);
    }
    parts.push(`first invited ${day(row.firstInvited)}`);
    console.log(parts.join("  "));
  }
} else if (command === "revoke") {
  const name = checkName(arg);
  const count = revokePerson(name);
  if (count === 0) {
    console.log(`${name} had nothing to revoke.`);
  } else {
    console.log(`Revoked ${name}. Their links and cookies no longer work.`);
  }
} else {
  const name = checkName(command);
  const key = createInvite(name);
  console.log(`Invite for ${name} (works once, on one device):`);
  console.log(`${siteUrl()}/invite/${key}`);
}
