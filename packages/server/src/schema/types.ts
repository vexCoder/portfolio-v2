/**
 * Portfolio data schema.
 * Update these interfaces when adding new fields to the JSON data files.
 * Data files live in: packages/server/src/data/
 */

export interface SiteConfig {
  name: string;
  username: string;
  email: string;
  title: string;
  description: string;
  url: string;
  website?: string;
  shortName: string;
  repo: string;
  region: string;
  languages: string[];
  socials: Social[];
}

export interface Social {
  platform: string;
  url: string;
  label: string;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  emoji?: string;
  image?: string;
  url?: string;
  repo?: string;
  featured: boolean;
}

export interface Experience {
  slug: string;
  company: string;
  role: string;
  period: string;
  location?: string;
  description: string;
  highlights: string[];
}

export interface ModelMeta {
  modelName: string;
  tags: string[];
  frontmatter: {
    license: string;
    baseModel: string;
    fineTunedFrom: string;
    taskCategories: string[];
  };
}

export interface BenchmarkEntry {
  rank: number;
  name: string;
  scores: {
    avg: number;
    infra: number;
    billing: number;
    aiTools: number;
    saas: number;
    ship: number;
  };
  isWinner: boolean;
}

export interface Skills {
  languages: string[];
  frameworks: string[];
  databases: string[];
  devops: string[];
  tools: string[];
}

export interface DailyStats {
  views: number;
  stars: number;
  downloads: number;
}

export type Analytics = Record<string, DailyStats>;

export interface Interactions {
  stars: string[];
}

export type ViewLog = Record<string, string[]>;

export interface PortfolioData {
  site: SiteConfig;
  projects: Project[];
  experience: Experience[];
  model: ModelMeta;
  benchmarks: BenchmarkEntry[];
  skills: Skills;
}
