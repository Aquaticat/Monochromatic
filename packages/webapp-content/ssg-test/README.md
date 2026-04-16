# ssg-test

Static site generator for the Aquaticat blog.
Converts MDX content into flat HTML pages served by Caddy with clean URLs.

## Architecture

The build pipeline runs as a sequence of mise tasks (`mise run build`):

1. **i18n + client JS** (`build:i18n`, `build:js:client`) -- generate typesafe-i18n types and bundle client-side scripts via tsdown
2. **Site generation** (`build:site` / `src/build.ts`) -- loads MDX from `src/content/{lang}/`, validates frontmatter with Zod, processes changed files through a remark/rehype pipeline (with SHA-256 content caching), pre-computes syntax highlight ranges via Lezer, generates HTML pages from h-html templates, generates CSS from h-css declarations, generates RSS feeds per language via feedsmith, copies static assets from `public/`
3. **Search index** (`build:search`) -- generates Pagefind search index from built HTML
4. **Asset fingerprinting** (`build:fingerprint` / `src/build/fingerprint.ts`) -- renames static assets with content hashes and rewrites references in HTML, CSS, and manifest
5. **Compression** (`build:compress`) -- compresses `dist/` with zstd

## Commands

- `mise run build` -- full pipeline (i18n, client JS, site, search, fingerprint, compress)
- `mise run build:site` -- site generation only (no fingerprinting or compression)
- `mise run build:site:clean` -- site generation from scratch (clears `.cache/`)
- `mise run build:fingerprint` -- asset fingerprinting only (requires prior `build:site`)
- `mise run dev` -- full build, then serve with Caddy and rebuild on source changes
- `mise run format:images` -- convert raster images to AVIF

## Content authoring

Add `.mdx` files under `src/content/{lang}/` with YAML frontmatter:

```yaml
---
title: Post Title
description: Short description
published: 2025-01-01
updated: 2025-01-15
tags:
  - design
  - photography
---
```

The filename becomes the URL slug.
The parent directory name becomes the language code.

## Syntax highlighting

Fenced code blocks are syntax-highlighted via the CSS Custom Highlight API.
Lezer parsers run **at build time** in a rehype plugin (`src/lib/rehype-highlight.ts`),
which embeds per-group character offsets as `data-hl-<group>` attributes on `<code>` elements.
The client script (`src/client/index.ts`) reads those offsets,
maps them to DOM Range objects, and registers CSS Custom Highlights.

No Lezer code ships to the browser.
The client bundle is ~1.8 KB (single file) versus ~313 KB (9 files) when parsers ran client-side.
The `data-hl-*` attributes add ~1.1 KB compressed across all pages --
a 99.4% net reduction in total transfer size for syntax highlighting.

## Output

Built files go to `dist/` as flat HTML with Caddy `try_files` providing clean URLs.
Cache manifest lives at `.cache/build-manifest.json`.

## Asset fingerprinting

All static assets in `dist/` are renamed with a 10-character content hash
before their extension (e.g. `styles.f1da372f3a.css`, `inter.693b77d4f3.woff2`).
References in HTML, CSS, and `manifest.webmanifest` are rewritten to match.

This runs as a post-processing step (`src/build/fingerprint.ts`) in three phases
to respect the dependency chain between assets:

1. **Leaf assets** -- images, fonts, JS, PDFs, favicons (no outgoing references to other hashable assets)
2. **CSS** -- rewrite font `url()` references with hashed names from phase 1, then hash the CSS itself
3. **Reference rewriting** -- replace original basenames with hashed basenames in all HTML files and `manifest.webmanifest`

Phase 3 uses basename-level `replaceAll` (e.g. `inter.woff2` -> `inter.693b77d4f3.woff2`),
which handles both absolute paths (`/inter.woff2`) and relative paths (`../glass-collection.avif`)
without needing to parse HTML.

**Excluded from fingerprinting**:
HTML (entry points), MDX source files, `pagefind/` (manages its own hashing),
`robots.txt`, RSS feeds, `manifest.webmanifest` (rewritten but not renamed, since PWA expects a stable URL).

**Cache headers** (configured in `Caddyfile`):
- Fingerprinted assets: `Cache-Control: public, max-age=31536000, immutable`
- HTML: `Cache-Control: no-cache` (revalidate with ETag every request)

Stale fingerprinted files from previous builds are cleaned up automatically
before each fingerprinting run.
