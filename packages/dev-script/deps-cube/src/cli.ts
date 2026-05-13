#!/usr/bin/env bun

/**
 * `deps-cube` CLI entrypoint.
 *
 * Reads the workspace catalog, probes every entry, renders the HTML
 * report, writes it to
 * `<package>/dist/deps-cube-<YYYY-MM-DDTHH-MM-SSZ>.html`, and prints
 * exactly one line to stdout: `Saved to <abs-path>`. Probe progress
 * goes to stderr via `console.error` in {@link probeAll}.
 *
 * Output is anchored to this package's `dist/` via {@link PACKAGE_ROOT}
 * from `./find-package-root.ts`, which walks up from
 * `import.meta.dirname` until the package's own `package.json` is
 * found. This works identically in source mode (`bun src/cli.ts`) and
 * in built mode (tsdown emits `<pkg>/dist/final/node/cli.mjs` and
 * `package.json#bin` points there). A hardcoded relative offset would
 * land on different absolute paths in the two modes.
 *
 * No flags: the CLI is intentionally zero-config. Filenames carry
 * ISO 8601 UTC down to seconds (with `:` rewritten as `-` for
 * filesystem safety), so each invocation produces a distinct artifact
 * and re-runs do not overwrite earlier reports.
 *
 * @example
 * ```bash
 * deps-cube
 * # → Saved to /abs/path/to/deps-cube/dist/deps-cube-2026-05-12T21-23-45Z.html
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
 * Builds the output filename for the current run.
 *
 * Uses ISO 8601 UTC down to seconds: `YYYY-MM-DDTHH-MM-SSZ`. The `:`
 * separators required by the canonical ISO form are replaced with
 * `-` so the name is filesystem-safe (Windows refuses `:` in
 * filenames, and shell history is friendlier without quoting). UTC
 * keeps re-runs across timezones stably ordered, and second
 * granularity means each invocation gets its own artifact rather
 * than overwriting earlier runs.
 *
 * @returns Filename like `deps-cube-2026-05-12T21-23-45Z.html`.
 */
function currentRunOutputFilename(): string {
  const iso = new Date().toISOString();
  /** Drop the millisecond suffix and trailing `Z` ({@link iso} = `YYYY-MM-DDTHH:MM:SS.sssZ`). */
  const seconds = iso.slice(0, 19,);
  /** Filesystem-safe form: every `:` becomes `-`. */
  const stem = seconds.replace(/:/g, '-',);
  return `deps-cube-${stem}Z.html`;
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
const absPath = resolvePath(distDir, currentRunOutputFilename(),);

await writeFile(absPath, html, 'utf8',);
console.log(`Saved to ${absPath}`,);

//endregion Entry
