

A) Goal
Build a static photography website to be hosted on Cloudflare

B) Resources
https://github.com/jelaludo
https://dash.cloudflare.com/    jelaludo.com



C) Uniform Resource Locator
1) 
https://github.com/11ty/eleventy
A simpler static site generator. An alternative to Jekyll. Written in JavaScript. Transforms a directory of templates (of varying types) into HTML.
Works with HTML, Markdown, JavaScript, Liquid, Nunjucks, with addons for WebC, Sass, Vue, Svelte, TypeScript, JSX, and many others!

2)
https://github.com/tannerdolby/eleventy-photo-gallery
Github repo, A starter site for creating your own photo or art gallery using the Eleventy static site generator.

> Local clone lives at `C:\01_Projects\01a_Coding\02_CodingProjects\11ty_Jelaludo\eleventy-photo-gallery`. Top-level folders include `src` (templates, data, assets), `src/_includes` (layouts, partials, Sass, JS), and `src/_data` (site/global JSON). Build outputs (`_site`) are generated at runtime.

3)
https://www.11ty.dev/docs/plugins/image/
Utility to perform build-time image transformations for both vector and raster images: output multiple image sizes, multiple formats, and cache remote images locally. Uses the sharp image processor.

4)
https://eleventy-gallery.netlify.app/
11ty photo site example


----
# Eleventy + Cloudflare Pages + GitHub (with Cursor IDE) — Setup & Workflow

A concise, copy‑pasteable guide to launch and run a static photography site using **11ty (Eleventy)**, **Cloudflare Pages**, and **GitHub**, developed in **Cursor IDE**.

---

## 0) Prereqs (once per machine)
- Install **Node.js 20+** (recommend via nvm):
  ```bash
  # macOS/Linux
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.nvm/nvm.sh
  nvm install 20
  nvm use 20
  ```
- Log into **GitHub** in your browser.
- Have a **Cloudflare** account with your domain added (DNS managed by Cloudflare).

> Cursor IDE uses your local shell, so the commands below run in Cursor’s terminal panel.

---

## 1) Bootstrap your 11ty site
**Option A — Start from a clean 11ty starter (recommended for learning):**
```bash
# Create project folder
mkdir my-photo-site && cd my-photo-site

# Init Node project & install Eleventy
npm init -y
npm install --save-dev @11ty/eleventy

# Minimal structure
mkdir -p src/posts src/assets/images
echo 'module.exports = { dir: { input: "src", output: "_site" } };' > .eleventy.js

# Add a simple homepage (Nunjucks)
cat > src/index.njk <<'EOF'
---
title: Home
layout: base.njk
---
<h1>Photography</h1>
<p>Welcome to my gallery. New albums below.</p>
<ul>
{% for post in collections.albums %}
  <li><a href="{{ post.url }}">{{ post.data.title }}</a></li>
{% endfor %}
EOF

# Base layout
mkdir -p src/_includes
cat > src/_includes/base.njk <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ title or "Photography" }}</title>
    <link rel="stylesheet" href="/assets/style.css">
  </head>
  <body>
    <main class="container">
      {{ content | safe }}
    </main>
  </body>
</html>
EOF

# Simple CSS
mkdir -p src/assets
cat > src/assets/style.css <<'EOF'
body { font-family: system-ui, Roboto, sans-serif; line-height: 1.6; margin: 2rem; }
.container { max-width: 860px; margin: 0 auto; }
img { max-width: 100%; height: auto; display: block; }
.gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
EOF

# Albums collection & Eleventy config
cat > .eleventy.js <<'EOF'
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addCollection("albums", collection => {
    return collection.getFilteredByGlob("src/albums/**/*.md").sort((a,b) => b.date - a.date);
  });
  return { dir: { input: "src", output: "_site", includes: "_includes" } };
};
EOF

# Example album
mkdir -p src/albums/iceland-2025
cat > src/albums/iceland-2025/index.md <<'EOF'
---
title: Iceland 2025
date: 2025-01-15
cover: cover.jpg
---
<div class="gallery">
  <img src="/assets/images/iceland-2025/001.jpg" alt="Iceland">
  <img src="/assets/images/iceland-2025/002.jpg" alt="Iceland">
</div>
EOF

# Put demo images (place your own)
mkdir -p src/assets/images/iceland-2025
# (copy a couple of JPGs into this folder)
```

**Option B — Start from a photo theme on GitHub (faster, more features):**
1. Search GitHub for “Eleventy photography theme” or “11ty gallery”.  
2. **Fork** a theme you like to your GitHub.  
3. **Clone** your fork in Cursor: `git clone https://github.com/<you>/<fork>.git`

---

## 2) Local dev in Cursor
```bash
# Install deps
npm install

# Run dev server
npx @11ty/eleventy --serve

# Open the local URL Eleventy prints (usually http://localhost:8080)
```

Make edits in `src/**` (pages, albums, CSS). Live reload will refresh.

---

## 3) GitHub repo
If you started from scratch (Option A):
```bash
git init
echo "node_modules\n_site\n.DS_Store\n" > .gitignore
git add .
git commit -m "feat: initial 11ty site"
git branch -M main
git remote add origin https://github.com/<you>/my-photo-site.git
git push -u origin main
```

> For themes you forked (Option B), your repo is already set—just push changes.

---

## 4) Cloudflare Pages (connect to Git)
1. Cloudflare Dashboard → **Pages** → **Create a project** → **Connect to Git**.  
2. Pick your GitHub repo.  
3. **Build settings**:  
   - **Framework preset**: *None* (or *Eleventy* if available)  
   - **Build command**: `npx @11ty/eleventy`  
   - **Build output directory**: `_site`  
   - **Environment variables** (add):  
     - `NODE_VERSION=20`
4. Click **Save and Deploy** → first build spins up.  
5. After it’s live, go to **Custom domains** → add `www.yourdomain.com` + apex `yourdomain.com`. Accept DNS records Cloudflare suggests.

> Pages auto‑caches globally. Keep SSL/TLS on **Full**. You don’t need an origin server.

---

## 5) Project structure (recommended)
```
my-photo-site/
  .eleventy.js
  package.json
  .nvmrc
  src/
    index.njk
    _includes/
      base.njk
    assets/
      style.css
      images/
        iceland-2025/*.jpg
    albums/
      iceland-2025/
        index.md        # front matter & gallery markup
```

**Front matter for an album:**
```md
---
title: Japan 2025 — Hokkaido
date: 2025-02-20
cover: cover.jpg
description: Snowy mornings, quiet shrines, and steaming onsen.
---
```

---

## 6) Daily content workflow
- **Add a new album**
  1. Create `src/albums/<slug>/index.md` with front matter (title/date/cover).
  2. Drop photos into `src/assets/images/<slug>/`.
  3. Commit & push:
     ```bash
     git add .
     git commit -m "feat: add <slug> album"
     git push
     ```
  4. Cloudflare builds → site updates automatically.

- **Branch previews**: Create a branch & PR → Cloudflare Pages generates a unique preview URL.

---

## 7) Image handling options
**Baseline (free & simple):** keep JPGs in `src/assets/images/`.  
- Resize offline to ~2500–3500px long edge (to cap repo size).  
- Consider lazy‑loading `<img loading="lazy">` in your templates.

**Better (optional): Eleventy Image plugin (responsive images)**
```bash
npm install --save @11ty/eleventy-img
```
Use a shortcode in `.eleventy.js` to generate multiple sizes, then reference it in album pages. (Great quality/perf, increases build time.)

**Scale further (optional):** move originals to **Cloudflare Images** or **R2** + **Image Resizing** for on‑the‑fly thumbs. (Adds small cost, but ideal for large libraries.)

---

## 8) Forms, spam, analytics (optional)
- **Contact form**: use **Cloudflare Pages Functions** (`/functions/`) or a form service; protect with **Cloudflare Turnstile**.  
- **Analytics**: Cloudflare **Web Analytics** → simple, free page‑view analytics.  
- **Redirects/Headers**: add `_redirects` or set via Pages settings; headers via `public/_headers` if you adopt a `public` dir pattern.

---

## 9) Package scripts & Node pinning
In `package.json`:
```json
{
  "scripts": {
    "dev": "npx @11ty/eleventy --serve",
    "build": "npx @11ty/eleventy",
    "clean": "rm -rf _site"
  }
}
```
Pin Node with `.nvmrc`:
```
20
```

---

## 10) Troubleshooting
- **Build fails**: check Pages **Build logs**; ensure `Build output directory` is `_site` and `NODE_VERSION=20` is set.  
- **Caching**: use **Development Mode** in Cloudflare (3 hours) to bypass CDN caching while debugging.  
- **Images missing**: verify paths (`/assets/images/<slug>/...`) and that `eleventyConfig.addPassthroughCopy("src/assets")` is in `.eleventy.js`.

---

## 11) Ongoing maintenance
- Edit markdown/pages, add albums, tweak CSS → `git push`.  
- Update dependencies occasionally:
  ```bash
  npm outdated
  npm update
  git commit -m "chore: deps"
  git push
  ```
- If you started from a theme fork, periodically pull upstream changes.

---

## 12) What you’ll use day‑to‑day
- **Cursor terminal**: `npm run dev` for local preview.  
- **Markdown** (`src/albums/**/index.md`) to write album descriptions.  
- **Drag images** into `src/assets/images/<slug>/`.  
- **`git push`** to deploy.

---

### TL;DR
1) 11ty in `src/` → outputs to `_site`.  
2) Cloudflare Pages: build `npx @11ty/eleventy`, output `_site`.  
3) Images in `src/assets/images/<album>`; albums as markdown in `src/albums/<album>/index.md`.  
4) Push to GitHub → auto‑deploy. Preview builds for PRs.

Happy shooting & shipping!



----
⚙️ You still need to do (once)

Unzip it somewhere (eleventy-photo-starter/).

Install dependencies (Eleventy will be installed automatically):

npm install


Preview locally:

npm run dev


Create a new GitHub repo and push it:

git init
git add .
git commit -m "initial photo site"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main


Connect that repo to Cloudflare Pages

Build command: npx @11ty/eleventy

Output folder: _site

Env var: NODE_VERSION=20

So:
➡️ The ZIP is your starting point.
➡️ Installing Node/npm is the only prerequisite.
➡️ Once you push to GitHub and connect to Cloudflare Pages, it’s fully deployed.