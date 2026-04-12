# Portfolio

Personal portfolio site built with Express, Handlebars, and Tailwind CSS v4.

## Quick Start

```bash
pnpm install
pnpm run dev
# → http://localhost:3000
```

## Where to Update

### Your Info

| What | File | Fields |
|------|------|--------|
| Name, bio, site URL | `packages/server/src/data/site.json` | `name`, `title`, `description`, `url` |
| Social links | `packages/server/src/data/site.json` | `socials[]` — platform, url, label |
| Projects | `packages/server/src/data/projects.json` | slug, title, description, tags, image, url, repo, featured |
| Work experience | `packages/server/src/data/experience.json` | company, role, period, description |

### Templates

| What | File |
|------|------|
| Page layout (head, body shell) | `packages/frontend/src/templates/layouts/main.hbs` |
| Navigation | `packages/frontend/src/templates/partials/header.hbs` |
| Footer | `packages/frontend/src/templates/partials/footer.hbs` |
| OG / Twitter meta tags | `packages/frontend/src/templates/partials/og.hbs` |
| Home page | `packages/frontend/src/templates/views/home.hbs` |
| About page | `packages/frontend/src/templates/views/about.hbs` |

### Styling

| What | File |
|------|------|
| Theme colors, fonts | `packages/frontend/src/css/input.css` — `@theme` block |
| Tailwind classes | Directly in `.hbs` templates |

### Assets

| What | File |
|------|------|
| Favicon | `packages/frontend/src/assets/favicon.svg` |
| Apple touch icon | `packages/frontend/src/assets/apple-touch-icon.png` (180×180) |
| OG image | `packages/frontend/src/assets/images/og-image.png` (1200×630) |
| Other images | `packages/frontend/src/assets/images/` |
| robots.txt | `packages/frontend/src/assets/robots.txt` |
| Sitemap | `packages/frontend/src/assets/sitemap.xml` |

### Routes & Data Schema

| What | File |
|------|------|
| Routes | `packages/server/src/app.ts` |
| Data types/interfaces | `packages/server/src/schema/types.ts` |
| Data loader | `packages/server/src/data/index.ts` |

## Adding a New Page

1. Create template → `packages/frontend/src/templates/views/mypage.hbs`
2. Add route in `packages/server/src/app.ts`
3. Add nav link in `packages/frontend/src/templates/partials/header.hbs`
4. Add URL to `packages/frontend/src/assets/sitemap.xml`

## Adding a New Data Type

1. Add interface to `packages/server/src/schema/types.ts`
2. Create JSON file in `packages/server/src/data/`
3. Import + export from `packages/server/src/data/index.ts`
4. Pass to route in `packages/server/src/app.ts`

## Commands

| Command | What |
|---------|------|
| `pnpm run dev` | CSS watcher + Express dev server |
| `pnpm run build` | Build CSS + compile TypeScript |
| `pnpm run build:css` | Tailwind only |
| `pnpm run build:server` | TypeScript only |

## Deployment

Push to `main` → GitHub Actions builds → deploys to VPS → restarts pm2.

### GitHub Secrets Setup

Go to repo **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Vultr server IP (e.g. `149.28.x.x`) |
| `VPS_USER` | SSH username (e.g. `root`) |
| `VPS_SSH_KEY` | Full private SSH key (PEM format, the whole `-----BEGIN...` block) |
| `VPS_PORT` | SSH port (optional, defaults to `22`) |

### VPS Prerequisites

```bash
# On your Vultr VPS:
npm install -g pnpm pm2
nvm install 22   # or install Node 22 however you prefer
```

### Pipeline Flow

1. Push to `main`
2. GitHub Actions: checkout → pnpm install → build
3. SCP built files to `~/git/portfolio` on VPS
4. SSH: `pnpm install --prod` → pm2 restart/start

### First Deploy

pm2 process `portfolio` auto-creates on first deploy. Subsequent pushes restart it.

## Project Structure

```
packages/
  frontend/          @portfolio/frontend
    src/
      css/           Tailwind input
      templates/     Handlebars (layouts, partials, views)
      assets/        Static files (images, favicon, robots, sitemap)
    dist/            Built CSS (gitignored)
  server/            @portfolio/server
    src/
      schema/        TypeScript interfaces
      data/          JSON content files
      app.ts         Express app + routes
      index.ts       Server entry
scripts/
  build.ts           Build orchestration
```
