// Invite and session storage for the private apps area.
//
// Everything lives in one file, data/access.json. The server and the
// `invite` command both change it, so we never keep a copy in memory:
// every call reads the file fresh, and every write goes to a temp file
// that is then renamed over the real one.
//
// Only sha256 hashes of invite keys and session tokens are stored.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AccessData, AccessInvite, AccessSession } from "../schema/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
// In bundle: __dirname = artifacts/ (server.js and invite.js), data at artifacts/data/
// In dev: __dirname = packages/server/src/access/, data at packages/server/src/data/
const dataDir = isProd ? path.resolve(__dirname, "data") : path.resolve(__dirname, "../data");

export const accessFile = path.join(dataDir, "access.json");

// In bundle: apps at artifacts/apps/ (~/git/portfolio/apps on the VPS)
// In dev: apps at <repo>/apps/
export const appsDir = isProd ? path.resolve(__dirname, "apps") : path.resolve(__dirname, "../../../../apps");

// An app's folder, and its URL, is its name plus 12 random characters:
// apps/notes-k3f9x2m7qp4z/ -> /__apps/notes-k3f9x2m7qp4z/. Only folders shaped
// like this are served, so nobody can find an app by guessing its name.
// scripts/app.ts makes these folders; keep its pattern the same.
export const APP_ID = /^[A-Za-z0-9][A-Za-z0-9-]*-[a-z0-9]{12}$/;

/** The folder of the app called `name` (or `name` itself if it is already an id), if it exists. */
export function findAppId(name: string): string | undefined {
  if (!fs.existsSync(appsDir)) {
    return undefined;
  }
  const folders = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const match = folders.find((d) => d.name === name && APP_ID.test(d.name))
    ?? folders.find((d) => APP_ID.test(d.name) && d.name.slice(0, -13) === name);
  return match?.name;
}

/** The app name inside an app id: notes-k3f9x2m7qp4z -> notes. */
export function appNameOf(id: string): string {
  return id.slice(0, -13);
}

/** True if this session may open the app with this name. */
export function sessionAllows(session: AccessSession, appName: string): boolean {
  return !session.apps || session.apps.includes(appName);
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function newSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function now(): string {
  return new Date().toISOString();
}

export function readAccess(): AccessData {
  if (!fs.existsSync(accessFile)) {
    return { invites: [], sessions: [] };
  }
  const data = JSON.parse(fs.readFileSync(accessFile, "utf-8")) as Partial<AccessData>;
  return { invites: data.invites ?? [], sessions: data.sessions ?? [] };
}

function writeAccess(data: AccessData): void {
  const tmp = `${accessFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, accessFile);
}

/** True if any invite already uses this label. */
export function labelTaken(name: string): boolean {
  return readAccess().invites.some((i) => i.name === name);
}

/**
 * Creates an invite. Returns the secret key (shown once, never stored).
 * `apps` limits it to those app names; leave it out for every app.
 */
export function createInvite(name: string, options: { apps?: string[]; autoName?: boolean } = {}): string {
  const key = newSecret();
  const data = readAccess();
  const invite: AccessInvite = { hash: hashSecret(key), name, createdAt: now() };
  if (options.autoName) {
    invite.autoName = true;
  }
  if (options.apps) {
    invite.apps = options.apps;
  }
  data.invites.push(invite);
  writeAccess(data);
  return key;
}

/** The invite for this key, if it is still unused and not revoked. Does not change anything. */
export function findOpenInvite(key: string): AccessInvite | undefined {
  const hash = hashSecret(key);
  return readAccess().invites.find((i) => i.hash === hash && !i.usedAt && !i.revokedAt);
}

/** True if this key belongs to an invite that was already used. Does not change anything. */
export function wasInviteUsed(key: string): boolean {
  const hash = hashSecret(key);
  return readAccess().invites.some((i) => i.hash === hash && Boolean(i.usedAt));
}

/** Uses up an invite and starts a session. Returns the session token, or undefined if the key is no good. */
export function redeemInvite(key: string): { name: string; token: string } | undefined {
  const hash = hashSecret(key);
  const data = readAccess();
  const invite = data.invites.find((i) => i.hash === hash && !i.usedAt && !i.revokedAt);
  if (!invite) {
    return undefined;
  }
  const token = newSecret();
  invite.usedAt = now();
  const session: AccessSession = { hash: hashSecret(token), name: invite.name, createdAt: invite.usedAt };
  if (invite.apps) {
    session.apps = invite.apps;
  }
  data.sessions.push(session);
  writeAccess(data);
  return { name: invite.name, token };
}

/** The live sessions for these tokens, with the token each one came from. */
export function findSessions(tokens: string[]): { token: string; session: AccessSession }[] {
  const sessions = readAccess().sessions;
  const found: { token: string; session: AccessSession }[] = [];
  for (const token of tokens) {
    const hash = hashSecret(token);
    const session = sessions.find((s) => s.hash === hash && !s.revokedAt);
    if (session) {
      found.push({ token, session });
    }
  }
  return found;
}

/** Revokes every open invite and live session of a person. Returns how many were revoked. */
export function revokePerson(name: string): number {
  const data = readAccess();
  const stamp = now();
  let count = 0;
  for (const invite of data.invites) {
    if (invite.name === name && !invite.usedAt && !invite.revokedAt) {
      invite.revokedAt = stamp;
      count++;
    }
  }
  for (const session of data.sessions) {
    if (session.name === name && !session.revokedAt) {
      session.revokedAt = stamp;
      count++;
    }
  }
  if (count > 0) {
    writeAccess(data);
  }
  return count;
}

export interface PersonRow {
  name: string;
  state: "active" | "invited" | "revoked";
  devices: number;
  openInvites: number;
  firstInvited: string;
  /** What the newest key with this label opens: app names, or undefined for every app. */
  apps?: string[];
}

/** One row per person who was ever invited. */
export function listPeople(): PersonRow[] {
  const data = readAccess();
  const rows = new Map<string, PersonRow>();
  for (const invite of data.invites) {
    let row = rows.get(invite.name);
    if (!row) {
      row = { name: invite.name, state: "revoked", devices: 0, openInvites: 0, firstInvited: invite.createdAt };
      rows.set(invite.name, row);
    }
    row.apps = invite.apps;
    if (!invite.usedAt && !invite.revokedAt) {
      row.openInvites++;
    }
  }
  for (const session of data.sessions) {
    const row = rows.get(session.name);
    if (row && !session.revokedAt) {
      row.devices++;
    }
  }
  for (const row of rows.values()) {
    if (row.devices > 0) {
      row.state = "active";
    } else if (row.openInvites > 0) {
      row.state = "invited";
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
