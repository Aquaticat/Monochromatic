#!/usr/bin/env bun

/**
 * `deps-cube` CLI entrypoint.
 *
 * Reads the workspace catalog, probes every entry, renders the HTML
 * report, writes it to `<package>/dist/deps-cube-<YYYY-MM-DD>.html`,
 * and prints exactly one line to stdout: `Saved to <abs-path>`. Probe
 * progress goes to stderr via `console.error` in {@link probeAll}.
 *
 * Output is anchored to this package's `dist/`, located via {@link
 * findPackageRoot} walking up from `import.meta.dirname` until the
 * package's own `package.json` (matched by name) is found. A
 * hardcoded relative path (e.g. `import.meta.dirname + '..' +
 * 'dist'`) would break once tsdown emits `<pkg>/dist/cli.mjs` and the
 * `package.json#bin` points at that built file: `import.meta.dirname`
 * is `<pkg>/dist/` in built mode and `<pkg>/src/` in source mode, so a
 * single relative offset cannot cover both. Find-up returns the same
 * package root regardless of where the executing file actually lives.
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
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  resolve as resolvePath,
} from 'node:path';

import { createCache, } from './cache.ts';
import { readCatalog, } from './catalog.ts';
import { probeAll, } from './probe.ts';
import { renderHtml, } from './render-html.ts';

//region Helpers

/**
 * Name of this package as recorded in its `package.json`. Used by
 * {@link findPackageRoot} to confirm the walk found this package's
 * own manifest, not a parent's monorepo `package.json` if the local
 * one is somehow missing or malformed.
 */
const PACKAGE_NAME = '@monochromatic-dev/dev-script-deps-cube';

/**
 * Walks up from `dir` searching for a `package.json` whose `name`
 * field equals {@link PACKAGE_NAME}, and returns the directory that
 * contains it. Recursion terminates either at the matching package
 * (success) or at the filesystem root (throws).
 *
 * Why find-up instead of a fixed relative offset: in source mode
 * `import.meta.dirname` is `<pkg>/src/`; after a tsdown build that
 * emits `<pkg>/dist/cli.mjs` and re-points `package.json#bin` there,
 * `import.meta.dirname` is `<pkg>/dist/`. A single hardcoded `'..'`
 * cannot resolve to the same package root from both starting points,
 * but walking until the package's own manifest is found does.
 *
 * The name check is defensive: if the local `package.json` were
 * deleted or corrupted, the walk would otherwise silently land on a
 * parent manifest. Matching by name forces an explicit error instead.
 *
 * @param dir - Starting directory; the function tests `dir/package.json` first, then recurses to `dirname(dir)`.
 *
 * @returns Absolute path of this package's root directory.
 *
 * @throws When no matching `package.json` is found up to the filesystem root.
 *
 * @example
 * ```ts
 * const root = await findPackageRoot({ dir: import.meta.dirname });
 * ```
 */
async function findPackageRoot(
  { dir, }: { dir: string; },
): Promise<string> {
  const candidate = resolvePath(dir, 'package.json',);
  try {
    const contents = await readFile(candidate, 'utf8',);
    const parsed = JSON.parse(contents,) as { name?: string; };
    if (parsed.name === PACKAGE_NAME) return dir;
  } catch {
    // candidate file missing, unreadable, or malformed JSON: keep walking upward
  }
  const parent = dirname(dir,);
  if (parent === dir) {
    throw new Error(
      `could not find package.json with name ${PACKAGE_NAME} walking up from ${dir}`,
    );
  }
  return findPackageRoot({ dir: parent, },);
}

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

/** Absolute path of this package's root, located by walking up from `import.meta.dirname` until the package's own `package.json` is found. */
const packageRoot = await findPackageRoot({
  dir: import.meta.dirname,
},);

/** Absolute path of this package's `dist/` directory. */
const distDir = resolvePath(packageRoot, 'dist',);

await mkdir(distDir, { recursive: true, },);

/** Absolute path of today's output file under `<package>/dist/`. */
const absPath = resolvePath(distDir, todaysOutputFilename(),);

await writeFile(absPath, html, 'utf8',);
console.log(`Saved to ${absPath}`,);

//endregion Entry
