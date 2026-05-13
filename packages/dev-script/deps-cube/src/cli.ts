#!/usr/bin/env bun

/**
 * `deps-cube` CLI entrypoint.
 *
 * Reads the workspace catalog, probes every entry, renders the HTML
 * report, writes it to `<package>/dist/deps-cube-<YYYY-MM-DD>.html`,
 * and prints exactly one line to stdout: `Saved to <abs-path>`. Probe
 * progress goes to stderr via `console.error` in {@link probeAll}.
 *
 * Output is anchored to this package's `dist/` via {@link PACKAGE_ROOT}
 * from `./find-package-root.ts`, which walks up from
 * `import.meta.dirname` until the package's own `package.json` is
 * found. This works identically in source mode (`bun src/cli.ts`) and
 * in built mode (tsdown emits `<pkg>/dist/final/node/cli.mjs` and
 * `package.json#bin` points there). A hardcoded relative offset would
 * land on different absolute paths in the two modes.
 *
 * No flags: the CLI is intentionally zero-config. Same-day re-runs
 * overwrite in place (the date stem stays constant) so iterating
 * after a cache refresh is simple.
 *
 * @example
 * ```bash
 * deps-cube
 * # → Saved to /abs/path/to/deps-cube/dist/deps-cube-2026-05-12.html
 * ```
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  resolve as resolvePath,
} from 'node:path';

import { createCache, } from './cache.ts';
import { readCatalog, } from './catalog.ts';
import { PACKAGE_ROOT, } from './find-package-root.ts';
import { probeAll, } from './probe.ts';
import { renderHtml, } from './render-html.ts';

//region Helpers

/**
 * Builds the output filename for today's run.
 *
 * Uses `YYYY-MM-DD` in the file's local-time zone so the date matches
 * what the user sees on the clock; date-only granularity means
 * multiple runs on the same day overwrite in place.
 *
 * @returns Filename like `deps-cube-2026-05-12.html`.
 */
function todaysOutputFilename(): string {
  const now = new Date();
  const year = now.getFullYear().toString().padStart(4, '0',);
  const month = (now.getMonth() + 1).toString().padStart(2, '0',);
  const day = now.getDate().toString().padStart(2, '0',);
  return `deps-cube-${year}-${month}-${day}.html`;
}

//endregion Helpers

//region Entry

/** Catalog entries parsed from `pnpm-workspace.yaml` upward from cwd. */
const entries = await readCatalog();

/** Shared per-package JSON file cache rooted at `~/.cache/monochromatic/deps-cube`. */
const cache = createCache();

/** Resolved attribute vector for every catalog entry. */
const probes = await probeAll({
  entries,
  cache,
},);

/** Composed self-contained HTML report. */
const html = await renderHtml({
  probes,
},);

/** Absolute path of this package's `dist/` directory, anchored on {@link PACKAGE_ROOT}. */
const distDir = resolvePath(PACKAGE_ROOT, 'dist',);

await mkdir(distDir, { recursive: true, },);

/** Absolute path of today's output file under `<package>/dist/`. */
const absPath = resolvePath(distDir, todaysOutputFilename(),);

await writeFile(absPath, html, 'utf8',);
console.log(`Saved to ${absPath}`,);

//endregion Entry
