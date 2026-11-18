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

/** Creates an invite for a person. Returns the secret key (shown once, never stored). */
export function createInvite(name: string): string {
  const key = newSecret();
  const data = readAccess();
  data.invites.push({ hash: hashSecret(key), name, createdAt: now() });
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
  data.sessions.push({ hash: hashSecret(token), name: invite.name, createdAt: invite.usedAt });
  writeAccess(data);
  return { name: invite.name, token };
}

/** The live session for this token, if any. */
export function findSession(token: string): AccessSession | undefined {
  const hash = hashSecret(token);
  return readAccess().sessions.find((s) => s.hash === hash && !s.revokedAt);
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
