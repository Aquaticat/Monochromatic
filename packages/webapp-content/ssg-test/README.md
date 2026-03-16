# ssg-test

Static site generator for the Aquaticat blog.
Converts MDX content into flat HTML pages served by Caddy with clean URLs.

## Architecture

The build pipeline runs as a single Bun script (`src/build.ts`) that:

1.  Loads MDX files from `src/content/{lang}/` and validates frontmatter with Zod
2.  Processes changed files through a remark/rehype pipeline (with SHA-256 content caching)
3.  Generates HTML pages from h-html templates
4.  Generates CSS from h-css declarations
5.  Generates RSS feeds per language via feedsmith
6.  Copies static assets from `public/`
7.  Minifies HTML with rehype-preset-minify
8.  Compresses output with zstd

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

## Output

Built files go to `dist/` as flat HTML with Caddy `try_files` providing clean URLs.
Cache manifest lives at `.cache/build-manifest.json`.
