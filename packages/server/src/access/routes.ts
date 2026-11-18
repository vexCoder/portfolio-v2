// Private apps: invite links, the access gate, and static app serving.
//
//   GET  /invite/:key   page with one Continue button (does NOT use up the invite,
//                       because chat apps fetch links to build previews)
//   POST /invite/:key   uses up the invite, sets the session cookie, goes to /__apps/
//   /__apps/            list of app folders          (cookie required)
//   /__apps/<name>/...  files from apps/<name>/, unknown paths fall back to index.html
//
// Anyone without a valid cookie is sent to the portfolio at /.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import { findOpenInvite, findSession, redeemInvite } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
// In bundle: __dirname = artifacts/ (~/git/portfolio on the VPS), apps at ~/git/portfolio/apps/
// In dev: __dirname = packages/server/src/access/, apps at <repo>/apps/
const appsDir = isProd ? path.resolve(__dirname, "apps") : path.resolve(__dirname, "../../../../apps");

// The URL is deliberately not the obvious /apps. The folder on disk is still apps/.
const APPS_URL = "/__apps";

const COOKIE = "apps_session";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // 400 days, the most browsers allow
const APP_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return undefined;
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

/**
 * The one access check for everything under APPS_URL.
 * A valid session cookie passes; anything else goes to the portfolio.
 */
function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const token = readCookie(req, COOKIE);
  const session = token ? findSession(token) : undefined;
  if (!session) {
    res.redirect(302, "/");
    return;
  }
  res.locals.person = session.name;
  next();
}

function listApps(): string[] {
  if (!fs.existsSync(appsDir)) {
    return [];
  }
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && APP_NAME.test(d.name))
    .map((d) => d.name)
    .sort();
}

const serveAppFiles = express.static(appsDir, { cacheControl: false, redirect: true });

function serveApps(req: Request, res: Response, next: NextFunction): void {
  const parts = req.path.split("/").filter(Boolean);

  // APPS_URL/ — the list
  if (parts.length === 0) {
    if (!req.originalUrl.split("?")[0].endsWith("/")) {
      res.redirect(301, `${APPS_URL}/`);
      return;
    }
    const names = listApps();
    const items = names.length
      ? `<ul>${names.map((n) => `<li><a href="${APPS_URL}/${escapeHtml(n)}/">${escapeHtml(n)}</a></li>`).join("")}</ul>`
      : "<p>No apps yet.</p>";
    res.send(page("Apps", `<h1>Apps</h1><p>Hi ${escapeHtml(String(res.locals.person))}.</p>${items}`));
    return;
  }

  const name = parts[0];
  const appDir = path.join(appsDir, name);
  if (!APP_NAME.test(name) || !fs.existsSync(path.join(appDir, "index.html"))) {
    next();
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

export function mountPrivateApps(app: Express): void {
  app.use("/invite", privateHeaders);

  app.get("/invite/:key", (req, res) => {
    const invite = findOpenInvite(req.params.key);
    if (!invite) {
      res.redirect(302, "/");
      return;
    }
    res.send(
      page(
        "Invite",
        `<p>Hi ${escapeHtml(invite.name)}. Ivan invited you to his private apps.</p>
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
    res.cookie(COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: APPS_URL,
      maxAge: COOKIE_MAX_AGE,
    });
    res.redirect(303, `${APPS_URL}/`);
  });

  app.use(APPS_URL, privateHeaders, requireAccess, serveApps);
}
