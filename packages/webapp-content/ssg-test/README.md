# ssg-test

Static site generator for the Aquaticat blog.
Converts MDX content into flat HTML pages served by Caddy with clean URLs.

## Architecture

The build pipeline runs as a single Bun script (`src/build.ts`) that:

1.  Loads MDX files from `src/content/{lang}/` and validates frontmatter with Zod
2.  Processes changed files through a remark/rehype pipeline (with SHA-256 content caching)
3.  Pre-computes syntax highlight ranges via `rehype-highlight` (Lezer parsers, build-only)
4.  Generates HTML pages from h-html templates
5.  Generates CSS from h-css declarations
6.  Generates RSS feeds per language via feedsmith
7.  Copies static assets from `public/`
8.  Minifies HTML with rehype-preset-minify
9.  Compresses output with zstd

## Commands

- `mise run build:site` -- full incremental build
- `mise run build:site:clean` -- build from scratch (no cache)
- `mise run dev:site` -- build, serve with Caddy, rebuild on changes
- `mise run format:images` -- convert raster images to AVIF
- `mise run watch:site` -- rebuild on source changes (no server)

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
