/**
 * Test setup helper: loads the harness HTML and injects the built bundle
 * as an inline module script, then waits for the bridge to expose
 * `globalThis.moduleDom`. Centralised here so every `*.e2e.test.ts`
 * has the same loading guarantee without repeating boilerplate.
 *
 * Direct `<script type="module" src="...relative...">` loads from a
 * `file://` page are blocked in Chromium for security; injecting the
 * bundle inline via `page.addScriptTag` bypasses that restriction
 * because the content is treated as same-origin to the host page.
 *
 * @module
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import type { Page, } from '@playwright/test';

declare global {
  /** Bundled module-dom helpers exposed on `globalThis` by the test harness. */
  // oxlint-disable-next-line no-var -- global augmentation requires var declaration
  // oxlint-disable-next-line typescript-eslint/consistent-type-imports -- typeof import() cannot use import type syntax
  var moduleDom: typeof import('./index.ts');
}

/** Absolute file URL to the test harness HTML (empty body, no scripts). */
export const HARNESS_URL: string = pathToFileURL(
  join(
    import.meta.dirname,
    '..',
    'test',
    'harness.html',
  ),
).href;

/**
 * Absolute path to the built browser bundle that the tests exercise.
 * Built by `mise run //packages/module/dom:build:js:browser`.
 */
const BUNDLE_PATH: string = join(
  import.meta.dirname,
  '..',
  'dist',
  'final',
  'neutral',
  'index.mjs',
);

/**
 * Single-entry cache for the rewritten bundle source so each test does
 * not re-read the dist file. `let` at module root is banned by
 * `no-module-root-let`; a `Map` keyed on the bundle path is the
 * project-recommended container shape.
 */
const bundleSourceCache = new Map<string, string>();

/**
 * Reads the built bundle, rewrites its trailing `export ` ... ` `
 * statement into a `globalThis.moduleDom = ` ... ` ` assignment, and
 * returns the resulting module source ready for inline injection.
 *
 * @returns Module-script source that, when injected, exposes all named
 *   exports as `globalThis.moduleDom`
 *
 * @throws Error when the bundle is missing its trailing
 *   `export ` ... ` ` (the rebuild may have failed or the format changed)
 *
 * @example
 * ```ts
 * const content = await bundleAsGlobalAssignment();
 * await page.addScriptTag({ content, type: 'module', },);
 * ```
 */
async function bundleAsGlobalAssignment(): Promise<string> {
  const cached = bundleSourceCache.get(BUNDLE_PATH,);
  if (cached !== undefined)
    return cached;

  const source = await readFile(
    BUNDLE_PATH,
    'utf8',
  );
  const exportMatch = /export\s*\{\s*([^}]+)\s*\}\s*;?\s*$/.exec(source,);
  if (exportMatch === null) {
    throw new Error(
      'test setup: could not locate trailing `export { ... }` in bundle; rebuild may have failed',
    );
  }

  const [
    ,
    namedExports,
  ] = exportMatch;
  const stripped = source.slice(
    0,
    exportMatch.index,
  );
  const rewritten = `${stripped}globalThis.moduleDom = { ${namedExports} };`;
  bundleSourceCache.set(
    BUNDLE_PATH,
    rewritten,
  );
  return rewritten;
}

/**
 * Loads the harness page, injects the bundled helpers as an inline
 * script, and waits until `globalThis.moduleDom` is set so subsequent
 * `page.evaluate` calls can reference it directly.
 *
 * @param page - Playwright Page to set up
 *
 * @param query - Optional query string (with or without leading `?`)
 *   appended to the harness URL so `globalThis.location.search` reflects
 *   it when `onLoadSetCssFromUrlParams` runs
 *
 * @example
 * ```ts
 * await loadHarness({ page, query: '--brand=red', },);
 * await page.evaluate(() => globalThis.moduleDom.onLoadSetCssFromUrlParams(),);
 * ```
 */
export async function loadHarness(
  {
    page,
    query,
  }: {
    page: Page;
    query?: string;
  },
): Promise<void> {
  const url = (query === undefined) || (query === '')
    ? HARNESS_URL
    : `${HARNESS_URL}${query.startsWith('?',) ? query : `?${query}`}`;
  await page.goto(url,);

  const content = await bundleAsGlobalAssignment();
  await page.addScriptTag({
    content,
    type: 'module',
  },);

  await page.waitForFunction(function isReady() {
    return globalThis.moduleDom !== undefined;
  },);
}
