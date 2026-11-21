// Private apps: invite links, the access gate, and static app serving.
//
//   GET  /invite/:key   page with one Continue button (does NOT use up the invite,
//                       because chat apps fetch links to build previews)
//   POST /invite/:key   uses up the invite, sets the session cookie, goes to the app
//   ?app=<id> on an invite link says which app it opens: /__apps/<id>/.
//   A link that was already used skips the button and goes straight there.
//   /__apps/            no list on purpose, so people only see the apps they are sent to
//   /__apps/<id>/...    files from apps/<name>-<id>/, unknown paths fall back to index.html
//
// An app id is 12 random characters (see APP_ID in store.ts). The URL has only
// the id; the app's name is only in the folder name on disk.
// Anyone without a valid cookie is sent to the portfolio at /.

import path from "node:path";
import fs from "node:fs";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import type { AccessInvite, AccessSession } from "../schema/types.js";
import {
  APP_ID,
  appNameOf,
  appsDir,
  findOpenInvite,
  findSessions,
  folderForId,
  redeemInvite,
  sessionAllows,
  wasInviteUsed,
} from "./store.js";

const isProd = process.env.NODE_ENV === "production";

// The URL is deliberately not the obvious /apps. The folder on disk is still apps/.
const APPS_URL = "/__apps";

const COOKIE = "apps_session";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // 400 days, the most browsers allow

// The cookie is on Path=/ so the invite page can see which keys a browser
// already has. Cookies from before that change sat on Path=/__apps; a browser
// may send both, so every cookie with this name is read.
const COOKIE_PATH = "/";

/** Every value sent for this cookie name (two cookies can share a name on different paths). */
function readCookies(req: Request, name: string): string[] {
  const header = req.headers.cookie;
  if (!header) {
    return [];
  }
  const values: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === name) {
      values.push(part.slice(eq + 1).trim());
    }
  }
  return values;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #111; background: #fff; }
  button { font: inherit; padding: .5rem 1.25rem; cursor: pointer; }
  a { color: inherit; }
  ul { padding-left: 1.25rem; }
  @media (prefers-color-scheme: dark) { body { color: #eee; background: #111; } }
</style></head>
<body>${body}</body></html>`;
}

/** No caching anywhere (Cloudflare caches .js/.css/images by extension) and no search indexing. */
function privateHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Robots-Tag", "noindex");
  next();
}

// One browser can hold several keys (say one for notes, one for todo), so the
// cookie is a list of session tokens joined by "." (base64url never uses ".").
function cookieTokens(req: Request): string[] {
  const tokens = readCookies(req, COOKIE).flatMap((value) => value.split(".")).filter(Boolean);
  return [...new Set(tokens)].slice(0, 20);
}

/**
 * Writes the browser's keys into one cookie on Path=/. With dropOld, also
 * removes a cookie from before that change (Path=/__apps). Only do that where
 * the old cookie was sent too (under /__apps), or its keys would be lost.
 */
function setSessionCookie(res: Response, tokens: string[], dropOld = false): void {
  if (dropOld) {
    res.clearCookie(COOKIE, { path: APPS_URL });
  }
  res.cookie(COOKIE, [...new Set(tokens)].join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

/** True if these sessions already open everything this invite would give. */
function alreadyCovered(sessions: AccessSession[], invite: AccessInvite): boolean {
  if (!invite.apps) {
    return sessions.some((s) => !s.apps);
  }
  return invite.apps.every((app) => sessions.some((s) => sessionAllows(s, app)));
}

/**
 * The first half of the access check for everything under APPS_URL:
 * at least one live session in the cookie, or off to the portfolio.
 * serveApps does the second half, whether one of them allows this app.
 */
function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const live = findSessions(cookieTokens(req));
  if (live.length === 0) {
    res.redirect(302, "/");
    return;
  }
  // Moves cookies from before the Path=/ change (and drops revoked keys), so the
  // invite page can see this browser's keys too. Pages only, not every file.
  if (req.accepts("html") && !path.extname(req.path)) {
    setSessionCookie(res, live.map((s) => s.token), true);
  }
  res.locals.sessions = live.map((s) => s.session);
  next();
}

// One static server per app folder, rooted inside that folder, so a ".." in the
// path can never reach another app's files (the --app check is per app).
const staticByFolder = new Map<string, ReturnType<typeof express.static>>();

function serveAppFiles(folder: string): ReturnType<typeof express.static> {
  let serve = staticByFolder.get(folder);
  if (!serve) {
    serve = express.static(path.join(appsDir, folder), { cacheControl: false, redirect: true });
    staticByFolder.set(folder, serve);
  }
  return serve;
}

function serveApps(req: Request, res: Response, next: NextFunction): void {
  const parts = req.path.split("/").filter(Boolean);

  // APPS_URL/ itself has no list, so nobody sees which other apps exist.
  if (parts.length === 0) {
    res.redirect(302, "/");
    return;
  }

  const id = parts[0];
  const folder = folderForId(id);
  if (!folder || !fs.existsSync(path.join(appsDir, folder, "index.html"))) {
    next();
    return;
  }
  const appDir = path.join(appsDir, folder);

  // A key made with --app only opens those apps.
  const sessions = res.locals.sessions as AccessSession[];
  if (!sessions.some((s) => sessionAllows(s, appNameOf(folder)))) {
    res.redirect(302, "/");
    return;
  }

  // /__apps/<id> -> /__apps/<id>/ so the app's relative links resolve inside it.
  const [pathOnly, query] = req.originalUrl.split("?");
  if (parts.length === 1 && !pathOnly.endsWith("/")) {
    res.redirect(301, `${pathOnly}/${query === undefined ? "" : `?${query}`}`);
    return;
  }

  // The URL has only the id; the files sit in the <name>-<id> folder.
  // Strip the id, so the folder's own static server sees a path inside it.
  req.url = req.url.slice(id.length + 1) || "/";

  // Real files first. If none matched and the last part has no file extension,
  // it is a page route of the app (React router etc.), so send its index.html.
  serveAppFiles(folder)(req, res, () => {
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.includes(".")) {
      next();
      return;
    }
    res.sendFile(path.join(appDir, "index.html"), { cacheControl: false });
  });
}

/** Where an invite link lands: the app named in ?app=, or the portfolio if none. */
function landing(req: Request): string {
  const name = req.query.app;
  if (typeof name === "string" && APP_ID.test(name)) {
    return `${APPS_URL}/${name}/`;
  }
  return "/";
}

export function mountPrivateApps(app: Express): void {
  app.use("/invite", privateHeaders);

  app.get("/invite/:key", (req, res) => {
    const invite = findOpenInvite(req.params.key);
    if (!invite) {
      // An already used link goes straight to the app. The gate there still
      // checks the cookie, so it only works on a device that is signed in.
      res.redirect(302, wasInviteUsed(req.params.key) ? landing(req) : "/");
      return;
    }
    // A browser that can already open everything this key gives goes straight
    // to the app, and the link stays unused for the person it is meant for.
    const sessions = findSessions(cookieTokens(req)).map((s) => s.session);
    if (alreadyCovered(sessions, invite)) {
      res.redirect(302, landing(req));
      return;
    }
    const hi = invite.autoName ? "" : `Hi ${escapeHtml(invite.name)}. `;
    res.send(
      page(
        "Invite",
        `<p>${hi}Ivan invited you to his private apps.</p>
<p>This link works once, on this device.</p>
<form method="post"><button type="submit">Continue</button></form>`,
      ),
    );
  });

  app.post("/invite/:key", (req, res) => {
    const invite = findOpenInvite(req.params.key);
    const live = findSessions(cookieTokens(req));
    // Same check as the GET, in case the page was open while access changed.
    if (invite && alreadyCovered(live.map((s) => s.session), invite)) {
      res.redirect(303, landing(req));
      return;
    }
    const result = redeemInvite(req.params.key);
    if (!result) {
      res.redirect(302, "/");
      return;
    }
    // Keep the keys this browser already has, and add the new one.
    setSessionCookie(res, [...live.map((s) => s.token), result.token]);
    res.redirect(303, landing(req));
  });

  app.use(APPS_URL, privateHeaders, requireAccess, serveApps);
}
