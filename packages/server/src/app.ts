import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { engine } from "express-handlebars";
import {
  site,
  projects,
  experience,
  benchmarks,
  skills,
  getModel,
  recordEvent,
  recordUniqueView,
  getRecentAnalytics,
  computeTrends,
  getAnalyticsTotals,
  hasStarred,
  toggleStar,
  getLastUpdated,
} from "./data/index.js";
import { prefetchOgData, getOgData } from "./utils/og-fetcher.js";
import type { Request } from "express";

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

// In bundle: __dirname = artifacts/. In dev: __dirname = packages/server/src/
const templatesDir = isProd
  ? path.resolve(__dirname, "templates")
  : path.resolve(__dirname, "../../frontend/src/templates");

const cssDir = isProd
  ? path.resolve(__dirname, "assets/css")
  : path.resolve(__dirname, "../../frontend/dist/css");

const assetsDir = isProd
  ? path.resolve(__dirname, "assets")
  : path.resolve(__dirname, "../../frontend/src/assets");

const app: ReturnType<typeof express> = express();

if (isProd) {
  app.set("trust proxy", 1);
}

// JSON body parsing for API endpoints
app.use(express.json());

// Handlebars engine
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(templatesDir, "layouts"),
    partialsDir: path.join(templatesDir, "partials"),
    helpers: {
      year: () => new Date().getFullYear(),
      eq: (a: unknown, b: unknown) => a === b,
      formatNumber: (n: number) => n.toLocaleString(),
      json: (obj: unknown) => JSON.stringify(obj),
      asset: (filePath: string) => {
        const diskPath = path.join(assetsDir, filePath.replace(/^\/assets\//, ""));
        try {
          const mtime = fs.statSync(diskPath).mtimeMs;
          return `${filePath}?v=${Math.floor(mtime)}`;
        } catch {
          return filePath;
        }
      },
      timeAgo: (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
        const months = Math.floor(days / 30);
        return `${months} month${months > 1 ? "s" : ""} ago`;
      },
    },
  }),
);
app.set("view engine", "hbs");
app.set("views", path.join(templatesDir, "views"));

// Static files
const staticOpts = { etag: true, lastModified: true, maxAge: isProd ? "7d" : 0 };
app.use("/css", express.static(cssDir, staticOpts));
app.use("/assets", express.static(assetsDir, staticOpts));
app.use(express.static(assetsDir, staticOpts));

// Prefetch OG data for project links at startup
const projectUrls = projects.flatMap((p) => [p.url, p.repo].filter(Boolean)) as string[];
prefetchOgData(projectUrls);

// --- Pages ---

app.get("/", async (req, res) => {
  const ip = getClientIp(req);
  recordUniqueView(ip);
  const model = getModel();
  const totals = getAnalyticsTotals();
  const starred = hasStarred(ip);
  const lastUpdated = getLastUpdated();
  const analytics = getRecentAnalytics(30);
  const trends = computeTrends(analytics);

  const enrichedProjects = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      urlOg: p.url ? await getOgData(p.url) : null,
      repoOg: p.repo ? await getOgData(p.repo) : null,
    })),
  );

  res.render("home", {
    title: `${site.username}/${model.modelName}`,
    site,
    model,
    projects: enrichedProjects,
    experience,
    benchmarks,
    skills,
    analytics,
    trends,
    totals,
    starred,
    lastUpdated,
    og: {
      title: site.name,
      description: site.description,
      url: site.url,
    },
  });
});

// --- API ---

app.post("/api/star", (req, res) => {
  const ip = getClientIp(req);
  const isStarred = toggleStar(ip);
  const totals = getAnalyticsTotals();
  res.json({ stars: totals.stars, starred: isStarred });
});

app.get("/api/download", (_req, res) => {
  recordEvent("downloads");
  res.redirect("/assets/resume.pdf");
});

app.get("/api/analytics", (_req, res) => {
  res.json(getRecentAnalytics(30));
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).send(isProd ? "Internal server error" : err.message);
  },
);

export default app;
