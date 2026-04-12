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

Push to `main` → GitHub Actions builds → SCP to VPS → pm2 restart. Fully automated after initial setup.

### 1. VPS Prerequisites

SSH into your Vultr VPS and install the required tools:

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Install Node 22
nvm install 22
nvm alias default 22

# Install pnpm and pm2 globally
npm install -g pnpm pm2

# Create deploy directory
mkdir -p ~/git/portfolio

# (Optional) Allow port 3000 through firewall if using ufw
ufw allow 3000
```

### 2. Generate a Deploy SSH Key

Create a dedicated SSH key pair for GitHub Actions to connect to your VPS.

**On your local machine:**

```bash
# Generate an Ed25519 key pair (no passphrase — press Enter twice when prompted)
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/deploy_portfolio
```

This creates two files:

| File | Purpose |
|------|---------|
| `~/.ssh/deploy_portfolio` | **Private key** — goes into GitHub secret `VPS_SSH_KEY` |
| `~/.ssh/deploy_portfolio.pub` | **Public key** — goes on the VPS |

**Copy the public key to your VPS:**

```bash
ssh-copy-id -i ~/.ssh/deploy_portfolio.pub your-user@your-vps-ip
```

**Verify the connection works:**

```bash
ssh -i ~/.ssh/deploy_portfolio your-user@your-vps-ip "echo connected"
```

### 3. GitHub Secrets Setup

1. Go to your GitHub repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below (click "Add secret" after each one):

#### `VPS_HOST`

Your VPS public IP address.

- **Where to find it:** Vultr dashboard → Products → your server → "IP Address" field
- **Example value:** `149.28.123.456`

#### `VPS_USER`

The SSH username on your VPS.

- **Where to find it:** The username you SSH in with (e.g. `ssh root@149.28.x.x` → user is `root`)
- **Example value:** `root`

#### `VPS_SSH_KEY`

The **full contents** of the private key file generated in Step 2.

- **How to get it:**
  ```bash
  cat ~/.ssh/deploy_portfolio
  ```
- **Copy the entire output**, including the `-----BEGIN` and `-----END` lines
- **Example value:**
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...
  ...multiple lines of base64...
  -----END OPENSSH PRIVATE KEY-----
  ```

> **Important:** Copy the private key (`deploy_portfolio`), NOT the public key (`deploy_portfolio.pub`).

#### `VPS_PORT` *(optional)*

SSH port on your VPS. Only add this if you changed the default SSH port.

- **Where to find it:** Run on VPS: `grep -i "^Port" /etc/ssh/sshd_config` (default is `22`)
- **Example value:** `22`

### 4. Pipeline Flow

When you push to `main`, the GitHub Actions workflow (`.github/workflows/deploy.yml`) runs:

| Step | What happens |
|------|-------------|
| **Checkout** | Clones the repo |
| **Setup** | Installs pnpm 10 + Node 22 |
| **Install** | `pnpm install --frozen-lockfile` |
| **Stamp** | Writes deploy timestamp to `packages/server/src/data/deploy.json` |
| **Build** | `pnpm run build` (CSS + TypeScript) |
| **SCP** | Copies built files to `~/git/portfolio` on VPS |
| **SSH** | Runs `pnpm install --prod` → `pm2 restart portfolio` (or `pm2 start` on first deploy) |

Files deployed to VPS: `packages/`, `scripts/`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`

### 5. First Deploy Checklist

- [ ] VPS has Node 22, pnpm, and pm2 installed
- [ ] `~/git/portfolio` directory exists on VPS
- [ ] SSH key pair generated and public key added to VPS
- [ ] All GitHub secrets are set (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)
- [ ] Push a commit to `main`
- [ ] Check **Actions** tab in GitHub repo — deploy should show green
- [ ] SSH into VPS and run `pm2 list` — should show `portfolio` as `online`
- [ ] Test: `curl http://your-vps-ip:3000` should return HTML

### 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| SCP/SSH step fails with "permission denied" | Verify private key was copied correctly (include all `-----BEGIN/END-----` lines). Ensure public key is in VPS `~/.ssh/authorized_keys`. |
| `nvm: command not found` in deploy log | Expected — the workflow script sources nvm manually. If still failing, verify nvm is installed at `$HOME/.nvm/nvm.sh` on VPS. |
| pm2 not found | Run `npm install -g pm2` on VPS. Ensure it's installed for the Node version nvm is using. |
| Site not accessible after deploy | Check firewall (`ufw status`), verify port 3000 is open, check `pm2 logs portfolio` for errors. |
| Build succeeds but site shows old content | SSH in and check `pm2 restart portfolio`. Verify files updated in `~/git/portfolio/packages/server/dist/`. |

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
