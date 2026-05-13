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

import { fileURLToPath, } from 'node:url';

import type { PackageProbe, } from './probe.ts';
import { renderControls, } from './render-controls.ts';
import { defaultState, } from './scripts/state.ts';
import stylesCss from './styles.css' with { type: 'text', };

//region Constants

/**
 * Absolute path to the browser-side controller entry point, resolved
 * relative to this module via `import.meta.url` so it works whether
 * run from source (`bun src/cli.ts`) or from a bundled dist.
 */
const CONTROLLER_ENTRY_PATH = fileURLToPath(new URL('./scripts/controller.ts', import.meta.url,),);

/** Document `<title>` for the generated HTML. */
const PAGE_TITLE = 'deps-cube — catalog dependency audit';

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
  const result = await Bun.build({
    entrypoints: [
      CONTROLLER_ENTRY_PATH,
    ],
    format: 'iife',
    minify: true,
    target: 'browser',
  },);
  if (!result.success) {
    const messages = result.logs.map(function describeLog(log,) {
      return log.message;
    },).join('\n',);
    throw new Error(`Failed to bundle controller for HTML inlining:\n${messages}`,);
  }
  const [output,] = result.outputs;
  if (output === undefined) throw new Error('Bun.build returned no outputs for controller entry point',);
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
    .replaceAll('</script', '<\\/script',)
    .replaceAll('<!--', '<\\!--',);
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
  const initialState = defaultState({
    probes,
  },);
  const controlsHtml = renderControls({
    probes,
    state: initialState,
  },);
  const bundleJs = await bundleController();
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
