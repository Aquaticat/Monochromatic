/**
 * Composes the final HTML audit report.
 *
 * Bundles the browser-side controller via `Bun.build` (IIFE,
 * minified), inlines the probe array as `window.__PROBES__`, embeds
 * the control-panel HTML from {@link renderControls}, and wraps
 * everything in an HTML document with the package's CSS in a
 * `<style>` block. The output is a single self-contained HTML file:
 * no external `<link>` or `<script src>` references; open from disk
 * and the page renders.
 *
 * @example
 * ```ts
 * import { renderHtml } from './render-html.ts';
 * import { writeFile } from 'node:fs/promises';
 * const html = await renderHtml({ probes });
 * await writeFile('deps-cube-2026-05-12.html', html, 'utf8');
 * ```
 */

import { readFile, } from 'node:fs/promises';
import { resolve as resolvePath, } from 'node:path';

import { findPackageRootCached, } from '@monochromatic-dev/module-fs-path';

import type { PackageProbe, } from './probe.ts';
import { renderControls, } from './render-controls.ts';
import { defaultState, } from './scripts/state.ts';

//region Constants

/**
 * Absolute path of this package's root directory, resolved at module load.
 *
 * Walks up from `import.meta.dirname` to the `package.json` whose
 * `name` matches `@monochromatic-dev/dev-script-deps-cube`. Result is
 * memoised by the helper, so `cli.ts` (which also resolves this root)
 * shares the same walk.
 */
const PACKAGE_ROOT = await findPackageRootCached({
  dir: import.meta.dirname,
  name: '@monochromatic-dev/dev-script-deps-cube',
},);

/**
 * Absolute path to the browser-side controller source entry point.
 *
 * Anchored on {@link PACKAGE_ROOT} so it points at
 * `<pkg>/src/scripts/controller.ts` regardless of where this module
 * is evaluated from: an `import.meta.url`-relative path would resolve
 * to `<pkg>/dist/final/node/scripts/controller.ts` after tsdown
 * bundles this file into a single `cli.mjs`, and that target doesn't
 * exist. `Bun.build` needs the original TypeScript source path; the
 * source tree is shipped alongside the built artifacts (see
 * `package.json#files`) so the path resolves in both modes.
 */
const CONTROLLER_ENTRY_PATH = resolvePath(
  PACKAGE_ROOT,
  'src',
  'scripts',
  'controller.ts',
);

/**
 * Inlined contents of `src/styles.css`, read once at module load.
 *
 * Originally imported via `with { type: 'text' }`, but tsdown's
 * `css-guard` plugin throws unconditionally on `.css` files (no
 * configuration opt-out) when bundling for Node. Replacing the
 * import-attribute with a runtime `readFile` lets tsdown bundle
 * `render-html.ts` without invoking the CSS plugin, while still
 * inlining the stylesheet as a string at first use. The styles file
 * is shipped via `package.json#files: ["src"]` so the path resolves
 * after a tsdown build.
 */
const stylesCss = await readFile(
  resolvePath(
    PACKAGE_ROOT,
    'src',
    'styles.css',
  ),
  'utf8',
);

/** Document `<title>` for the generated HTML. */
const PAGE_TITLE = 'deps-cube; catalog dependency audit';

//endregion Constants

//region Helpers

/**
 * Bundles the browser-side controller via Bun's bundler into a
 * single self-contained IIFE string.
 *
 * @returns Minified IIFE JS, ready to splice into a `<script>` block.
 *
 * @throws When the bundle fails; the bundler's logs are joined into
 *   the error message so the CLI surfaces them.
 */
async function bundleController(): Promise<string> {
  /** Bundle handle from Bun's bundler; carries either the IIFE output or diagnostic logs. */
  const result = await Bun.build({
    entrypoints: [
      CONTROLLER_ENTRY_PATH,
    ],
    format: 'iife',
    minify: true,
    target: 'browser',
  },);
  if (!result.success) {
    /** Newline-joined bundler diagnostic messages; surfaced in the thrown error so the CLI can print them. */
    const messages = result
      .logs
      .map(function describeLog(log,) {
        return log.message;
      },)
      .join('\n',);
    throw new Error(`Failed to bundle controller for HTML inlining:\n${messages}`,);
  }
  /** First (and only) output artifact from the single-entrypoint build; further `outputs[0..n]` are unused. */
  const [output,] = result.outputs;
  if (output === undefined)
    throw new Error('Bun.build returned no outputs for controller entry point',);
  return await output.text();
}

/**
 * Escapes a string for safe inlining inside an HTML `<script>` block.
 *
 * The two dangerous sequences are `</script` (closes the script tag
 * prematurely so following content is parsed as HTML) and `<!--`
 * (an HTML comment opener that browsers tolerate inside scripts but
 * parse specially in legacy modes). Both are neutralised by
 * inserting a backslash; the JS engine still parses the result as
 * the original token.
 *
 * @param js - Source string destined for a `<script>` block.
 *
 * @returns Same string with unsafe sequences neutralised.
 */
function escapeForScriptTag(js: string,): string {
  return js
    .replaceAll(
      '</script',
      String.raw`<\/script`,
    )
    .replaceAll(
      '<!--',
      String.raw`<\!--`,
    );
}

//endregion Helpers

//region Public API

/**
 * Composes the full HTML report.
 *
 * @param probes - Resolved package probes for every catalog entry.
 *
 * @returns Self-contained HTML document as a single string.
 *
 * @example
 * ```ts
 * const html = await renderHtml({ probes });
 * await writeFile('out.html', html, 'utf8');
 * ```
 */
export async function renderHtml(
  {
    probes,
  }: {
    probes: readonly PackageProbe[];
  },
): Promise<string> {
  /** Initial controller state used to seed the control-panel markup; the browser-side controller re-derives its state from this. */
  const initialState = defaultState({
    probes,
  },);
  /** Pre-rendered control panel HTML, spliced into `<main>` below so the page is usable before JS executes. */
  const controlsHtml = renderControls({
    probes,
    state: initialState,
  },);
  /** Minified IIFE JS for the browser-side controller; built once per `renderHtml` call. */
  const bundleJs = await bundleController();
  /** Probe array serialised for inlining as `window.__PROBES__`; escaped below to neutralise `</script>` sequences. */
  const probesJson = JSON.stringify(probes,);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${PAGE_TITLE}</title>
  <style>${stylesCss}</style>
</head>
<body>
  <main id="canvas-host"><canvas id="deck-canvas"></canvas></main>
  ${controlsHtml}
  <script>window.__PROBES__ = ${escapeForScriptTag(probesJson,)};</script>
  <script>${escapeForScriptTag(bundleJs,)}</script>
</body>
</html>
`;
}

//endregion Public API
