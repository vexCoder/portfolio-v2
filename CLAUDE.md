# Portfolio

Personal portfolio site. Express + Handlebars + Tailwind v4 monorepo.

## Stack

- **Runtime**: Node.js (ES2022, ESM)
- **Server**: Express 5 + express-handlebars
- **Styling**: Tailwind CSS v4 (config-less, `@theme` in CSS)
- **Templates**: Handlebars (.hbs)
- **Language**: TypeScript (strict)
- **Package manager**: pnpm workspaces
- **Dev**: tsx watch (server), tailwindcss --watch (CSS)

## Monorepo Layout

```
packages/
  frontend/     # Templates, CSS, static assets (@portfolio/frontend)
  server/       # Express app, routes, data layer (@portfolio/server)
scripts/        # Build orchestration (TypeScript)
```

## Commands

```bash
pnpm run dev          # Start CSS watcher + Express dev server (port 3000)
pnpm run build        # Build CSS + compile server TS
pnpm run build:css    # Tailwind only
pnpm run build:server # tsc only
```

## Data Layer (JSON Backend)

Content lives in JSON files, typed via TypeScript interfaces.

- **Schema**: `packages/server/src/schema/types.ts` — all interfaces (SiteConfig, Project, Experience, etc.)
- **Data files**: `packages/server/src/data/*.json` — edit these to update content
  - `site.json` — name, title, description, URL, socials
  - `projects.json` — portfolio projects (slug, title, tags, featured flag, links)
  - `experience.json` — work history
- **Data loader**: `packages/server/src/data/index.ts` — imports JSON, exports typed objects

When adding new content types: add interface to `schema/types.ts` → create JSON file in `data/` → export from `data/index.ts` → pass to route in `app.ts`.

## Frontend

- **Templates**: `packages/frontend/src/templates/`
  - `layouts/main.hbs` — HTML shell (head, body, includes og/header/footer partials)
  - `partials/` — header, footer, og (Open Graph meta tags)
  - `views/` — page templates (home, about)
- **CSS**: `packages/frontend/src/css/input.css` — Tailwind entry point with `@theme` customization
- **Assets**: `packages/frontend/src/assets/` — favicon.svg, apple-touch-icon.png, robots.txt, sitemap.xml, images/

## Server

- **Entry**: `packages/server/src/index.ts` — listens on PORT (default 3000)
- **App**: `packages/server/src/app.ts` — Express config, handlebars engine, routes, static serving
- **Static serving**: `/css` → frontend dist, `/assets` → frontend assets, root → favicon/robots/sitemap

## Routes

| Path | View | Data |
|------|------|------|
| `/` | home.hbs | site config, featured projects, OG meta |
| `/about` | about.hbs | site config, OG meta |

## Adding a New Page

1. Create view template: `packages/frontend/src/templates/views/mypage.hbs`
2. Add route in `packages/server/src/app.ts`:
   ```ts
   app.get("/mypage", (_req, res) => {
     res.render("mypage", { title: "My Page", site, og: { ... } });
   });
   ```
3. Add nav link in `packages/frontend/src/templates/partials/header.hbs`
4. Add URL to `packages/frontend/src/assets/sitemap.xml`

## SEO

- OG + Twitter Card meta tags via `partials/og.hbs` — each route passes `og` object with title/description/image/url
- Favicon: SVG at `/favicon.svg`
- Apple touch icon: `/apple-touch-icon.png`
- `robots.txt` and `sitemap.xml` served from root

## Changing Fonts

Primary (sans) and monospace fonts are configurable:

1. Pick fonts from [Google Fonts](https://fonts.google.com)
2. Update the `<link>` tag in `packages/frontend/src/templates/layouts/main.hbs` with the new Google Fonts URL
3. Update `--font-sans` and `--font-mono` in `packages/frontend/src/css/input.css` under `@theme`
4. Run `pnpm run build:css` to rebuild

Current fonts: **Source Sans 3** (sans) + **IBM Plex Mono** (mono)

## Conventions

- All server imports use `.js` extension (Node16 ESM resolution)
- Handlebars helpers registered in `app.ts` engine config (e.g., `year`)
- Templates read from source (`frontend/src/`), only CSS requires build step
- `{{{body}}}` triple-stache in layout for unescaped view content
