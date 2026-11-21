// Private apps: invite links, the access gate, and static app serving.
//
//   GET  /invite/:key   page with one Continue button (does NOT use up the invite,
//                       because chat apps fetch links to build previews)
//   POST /invite/:key   uses up the invite, sets the session cookie, goes to the app
//   ?app=<id> on an invite link says which app it opens: /__apps/<id>/.
//   A link that was already used skips the button and goes straight there.
//   /__apps/            no list on purpose, so people only see the apps they are sent to
//   /__apps/<id>/...    files from apps/<id>/, unknown paths fall back to index.html
//
// An app id is its name plus 12 random characters (see APP_ID in store.ts).
// Anyone without a valid cookie is sent to the portfolio at /.

import path from "node:path";
import fs from "node:fs";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import type { AccessSession } from "../schema/types.js";
import {
  APP_ID,
  appNameOf,
  appsDir,
  findOpenInvite,
  findSessions,
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
 * The first half of the access check for everything under APPS_URL:
 * at least one live session in the cookie, or off to the portfolio.
 * serveApps does the second half, whether one of them allows this app.
 */
function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const sessions = findSessions(cookieTokens(req)).map((s) => s.session);
  if (sessions.length === 0) {
    res.redirect(302, "/");
    return;
  }
  res.locals.sessions = sessions;
  next();
}

const serveAppFiles = express.static(appsDir, { cacheControl: false, redirect: true });

function serveApps(req: Request, res: Response, next: NextFunction): void {
  const parts = req.path.split("/").filter(Boolean);

  // APPS_URL/ itself has no list, so nobody sees which other apps exist.
  if (parts.length === 0) {
    res.redirect(302, "/");
    return;
  }

  const name = parts[0];
  const appDir = path.join(appsDir, name);
  if (!APP_ID.test(name) || !fs.existsSync(path.join(appDir, "index.html"))) {
    next();
    return;
  }

  // A key made with --app only opens those apps.
  const sessions = res.locals.sessions as AccessSession[];
  if (!sessions.some((s) => sessionAllows(s, appNameOf(name)))) {
    res.redirect(302, "/");
    return;
  }

  // Real files first. If none matched and the last part has no file extension,
  // it is a page route of the app (React router etc.), so send its index.html.
  serveAppFiles(req, res, () => {
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
    const result = redeemInvite(req.params.key);
    if (!result) {
      res.redirect(302, "/");
      return;
    }
    // Keep the keys this browser already has, and add the new one.
    // An old Path=/__apps cookie never reaches /invite, so it is left alone;
    // the gate reads it next to this one.
    const kept = findSessions(cookieTokens(req)).map((s) => s.token);
    res.cookie(COOKIE, [...kept, result.token].join("."), {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE,
    });
    res.redirect(303, landing(req));
  });

  app.use(APPS_URL, privateHeaders, requireAccess, serveApps);
}
