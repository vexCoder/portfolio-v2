import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type {
  PortfolioData,
  SiteConfig,
  Project,
  Experience,
  ModelMeta,
  BenchmarkEntry,
  Skills,
  Analytics,
  DailyStats,
  Interactions,
  ViewLog,
} from "../schema/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
// In bundle: __dirname = artifacts/, data at artifacts/data/
// In dev: __dirname = packages/server/src/data/ (JSON files are here)
const dataDir = isProd ? path.resolve(__dirname, "data") : __dirname;

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf-8"));
}

function writeJson(filename: string, data: unknown): void {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
}

function initJson<T>(filename: string, defaults: T): T {
  const filepath = path.join(dataDir, filename);
  if (!fs.existsSync(filepath)) {
    writeJson(filename, defaults);
  }
  return readJson<T>(filename);
}

// Ensure data dir exists (production first boot)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default data — used on first boot when files don't exist
const defaultSite: SiteConfig = {
  name: "Ivan Paul C. Golosinda - Senior App Dev",
  username: "vexCoder",
  email: "ig08.work@gmail.com",
  title: "Portfolio",
  description:
    "Full-stack engineering model specialized in shipping production systems under real-world constraints.",
  url: "https://ivangolosinda.com",
  website: "ivangolosinda.com",
  repo: "https://github.com/vexCoder/portfolio-v2",
  region: "DVO \ud83c\uddf5\ud83c\udded",
  languages: ["en", "tl"],
  socials: [
    { platform: "github", url: "https://github.com/vexCoder", label: "GitHub" },
    {
      platform: "linkedin",
      url: "https://linkedin.com/in/ig08",
      label: "LinkedIn",
    },
  ],
};

const defaultModel: ModelMeta = {
  modelName: "golosinda-senior-v7",
  tags: [
    "fullstack",
    "healthcare",
    "typescript",
    "postgres",
    "billing-systems",
    "ai-tooling",
    "7-years-exp",
    "license:contract",
    "region:ph",
  ],
  frontmatter: {
    license: "contract",
    baseModel: "self-taught",
    fineTunedFrom: "golosinda-mid-v6",
    taskCategories: ["fullstack", "healthcare", "billing", "ai-tooling"],
  },
};

const defaultProjects: Project[] = [
  {
    slug: "tukod-ai",
    title: "vexCoder/tukod-ai",
    description:
      "Node-based AI workspace — Rust/Tauri backend, React frontend, LLM streaming via OpenRouter, LanceDB vector storage, MCP tool integration.",
    tags: ["rust", "tauri", "react", "ai", "mcp"],
    emoji: "\ud83e\udde0",
    repo: "https://github.com/vexCoder/tukod-ai",
    featured: true,
  },
  {
    slug: "elixir-cafe",
    title: "delve/elixir-cafe",
    description:
      "Narrative puzzle game — potion-brewing mechanics, dialogue system, multiple endings. Built for Pirate Software Jam 15.",
    tags: ["godot", "gdscript", "game-jam"],
    emoji: "\ud83c\udfae",
    url: "https://delve-murder-nevermore.itch.io/elixir-cafe",
    featured: true,
  },
];

const defaultExperience: Experience[] = [
  {
    slug: "theoria-medical-senior",
    company: "Theoria Medical",
    role: "Senior App Developer",
    period: "Jul 2025 - Present",
    location: "Michigan, Remote",
    description:
      "Healthcare infrastructure and AI clinical tooling at senior level.",
    highlights: [
      "Drove resolution of critical missing-notes incident, consolidating infrastructure from 90 servers to 5",
      "Built AI-powered ICD-10 search used by every provider for clinical documentation",
      "Owned automated billing workflow responsible for ~80% of Theoria's revenue",
      "Received Shining Star Award for outstanding contributions (2025-2026)",
    ],
  },
  {
    slug: "theoria-medical-mid",
    company: "Theoria Medical",
    role: "Mid Full-Stack Developer",
    period: "Aug 2023 - Jul 2025",
    location: "Michigan, Remote",
    description:
      "Healthcare infrastructure dataset. Built developer tooling and billing automation.",
    highlights: [
      "Built feature-flag and UAT system from scratch, used for feature toggles and gated rollouts",
      "Aggregated cross-department billing data for external payment processing partners",
      "Reduced noting time and coding errors with AI-powered ICD-10 natural-language search",
    ],
  },
  {
    slug: "petchef",
    company: "PetChef",
    role: "Full-Stack Developer",
    period: "Oct 2020 - Aug 2023",
    location: "Malaysia, Remote",
    description:
      "Subscription SaaS dataset. Entire platform built solo — Next.js portal, Vite admin, Express/GraphQL API.",
    highlights: [
      "Built pet meal subscription platform from the ground up as sole developer — TypeScript monorepo (Yarn workspaces + Turborepo)",
      "Implemented recurring billing with Stripe (webhooks, invoice generation, failed-payment recovery)",
      "Integrated Stripe, Pipedrive, Wati (WhatsApp), Zendesk, Google Analytics, Sendy",
      "Deployed on VPS with Node.js cluster mode and Socket.IO sticky sessions, serving 1,000+ subscribers",
    ],
  },
  {
    slug: "freelance-corpus",
    company: "Freelance",
    role: "Web Developer",
    period: "Jan 2018 - Oct 2020",
    location: "Self-Employed",
    description:
      "Web3 automation and scraping dataset. Formative pretraining period.",
    highlights: [
      "Built terminal-based Web3 game bot for automated gameplay and on-chain interactions",
      "Developed scraping and automation bot for FIFA Ultimate Team marketplace",
    ],
  },
];

const defaultSkills: Skills = {
  languages: [
    "TypeScript",
    "JavaScript",
    "Node.js",
    "Dart",
    "Go",
    "Rust",
    "GDScript",
  ],
  frameworks: ["React", "Express", "GraphQL", "Flutter", "Electron", "Tauri"],
  databases: ["PostgreSQL", "MongoDB", "SQLite", "Redis"],
  devops: [
    "Docker",
    "Nginx",
    "PM2",
    "Linux",
    "DNS",
    "Azure",
    "Vultr",
    "DigitalOcean",
  ],
  tools: ["Git", "GitHub", "GitLab", "BullMQ", "Jest", "Puppeteer"],
};

const defaultBenchmarks: BenchmarkEntry[] = [
  {
    rank: 1,
    name: "vexCoder/golosinda-senior-v7",
    scores: {
      avg: 93.7,
      infra: 94.4,
      billing: 80.0,
      aiTools: 100.0,
      saas: 99.2,
      ship: 95.5,
    },
    isWinner: true,
  },
  {
    rank: 2,
    name: "acme/architect-no-code-v3",
    scores: {
      avg: 51.6,
      infra: 72.0,
      billing: 65.0,
      aiTools: 44.0,
      saas: 38.0,
      ship: 40.0,
    },
    isWinner: false,
  },
  {
    rank: 3,
    name: "meta/framework-hopper-v5",
    scores: {
      avg: 44.8,
      infra: 32.0,
      billing: 28.0,
      aiTools: 52.0,
      saas: 60.0,
      ship: 52.0,
    },
    isWinner: false,
  },
  {
    rank: 4,
    name: "openai/junior-bootcamp-grad-v2",
    scores: {
      avg: 41.2,
      infra: 18.0,
      billing: 12.0,
      aiTools: 55.0,
      saas: 48.0,
      ship: 72.0,
    },
    isWinner: false,
  },
  {
    rank: 5,
    name: "stealth/ai-copilot-only-v1",
    scores: {
      avg: 38.7,
      infra: 8.0,
      billing: 4.0,
      aiTools: 88.0,
      saas: 22.0,
      ship: 71.5,
    },
    isWinner: false,
  },
];

// Init all data files (creates defaults if missing, preserves existing)
export const site = initJson<SiteConfig>("site.json", defaultSite);
export const projects = initJson<Project[]>("projects.json", defaultProjects);
export const experience = initJson<Experience[]>(
  "experience.json",
  defaultExperience,
);
export const benchmarks = initJson<BenchmarkEntry[]>(
  "benchmarks.json",
  defaultBenchmarks,
);
export const skills = initJson<Skills>("skills.json", defaultSkills);
initJson<ModelMeta>("model.json", defaultModel);
initJson<Analytics>("analytics.json", {});
initJson<Interactions>("interactions.json", { stars: [] });
initJson<ViewLog>("viewlog.json", {});
writeJson("deploy.json", { lastUpdated: new Date().toISOString() });

export function getLastUpdated(): string {
  return readJson<{ lastUpdated: string }>("deploy.json").lastUpdated;
}

// Dynamic data — read fresh each call (likes/views mutate at runtime)
export function getModel(): ModelMeta {
  return readJson<ModelMeta>("model.json");
}

export function updateModel(updater: (model: ModelMeta) => void): ModelMeta {
  const model = getModel();
  updater(model);
  writeJson("model.json", model);
  return model;
}

// Analytics — daily event tracking
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAnalytics(): Analytics {
  return readJson<Analytics>("analytics.json");
}

function emptyDay(): DailyStats {
  return { views: 0, stars: 0, downloads: 0 };
}

export function recordEvent(type: keyof DailyStats): void {
  const analytics = getAnalytics();
  const today = todayKey();
  if (!analytics[today]) {
    analytics[today] = emptyDay();
  }
  analytics[today][type]++;
  writeJson("analytics.json", analytics);
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Interactions — IP-based dedup for stars
function getInteractions(): Interactions {
  return readJson<Interactions>("interactions.json");
}

function saveInteractions(data: Interactions): void {
  writeJson("interactions.json", data);
}

export function hasStarred(ip: string): boolean {
  return getInteractions().stars.includes(hashIp(ip));
}

export function toggleStar(ip: string): boolean {
  const hash = hashIp(ip);
  const data = getInteractions();
  const idx = data.stars.indexOf(hash);
  if (idx === -1) {
    data.stars.push(hash);
    recordEvent("stars");
    saveInteractions(data);
    return true;
  }
  data.stars.splice(idx, 1);
  saveInteractions(data);
  return false;
}

export function recordUniqueView(ip: string): void {
  const hash = hashIp(ip);
  const log = readJson<ViewLog>("viewlog.json");
  const today = todayKey();
  if (!log[today]) log[today] = [];
  if (log[today].includes(hash)) return;
  log[today].push(hash);
  writeJson("viewlog.json", log);
  recordEvent("views");
}

export function getStarCount(): number {
  return getInteractions().stars.length;
}

export function getRecentAnalytics(
  days = 30,
): { date: string; stats: DailyStats }[] {
  const analytics = getAnalytics();
  const result: { date: string; stats: DailyStats }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, stats: analytics[key] || emptyDay() });
  }
  return result;
}

export interface AnalyticsTotals {
  views: number;
  stars: number;
  downloads: number;
}

export function getAnalyticsTotals(): AnalyticsTotals {
  const analytics = getAnalytics();
  const totals: AnalyticsTotals = {
    views: 0,
    stars: getStarCount(),
    downloads: 0,
  };
  for (const day of Object.values(analytics)) {
    totals.views += day.views;
    totals.downloads += day.downloads;
  }
  return totals;
}

export interface Trend {
  pct: string;
  direction: "up" | "down" | "flat";
}

export function computeTrends(
  recent: { date: string; stats: DailyStats }[],
): Record<keyof DailyStats, Trend> {
  const mid = Math.floor(recent.length / 2);
  const prior = recent.slice(0, mid);
  const current = recent.slice(mid);

  function calc(key: keyof DailyStats): Trend {
    const priorSum = prior.reduce((s, d) => s + d.stats[key], 0);
    const currentSum = current.reduce((s, d) => s + d.stats[key], 0);
    if (priorSum === 0 && currentSum === 0)
      return { pct: "0%", direction: "flat" };
    if (priorSum === 0) return { pct: "+100%", direction: "up" };
    const change = ((currentSum - priorSum) / priorSum) * 100;
    const direction = change >= 0 ? "up" : "down";
    return {
      pct: `${change >= 0 ? "+" : ""}${Math.round(change)}%`,
      direction,
    };
  }

  return {
    views: calc("views"),
    stars: calc("stars"),
    downloads: calc("downloads"),
  };
}

export const data: PortfolioData = {
  site,
  projects,
  experience,
  model: getModel(),
  benchmarks,
  skills,
};
