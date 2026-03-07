import { $ as notNullishOrThrow, } from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import Watcher from 'watcher';
import { l, } from './log.ts';
import {
  INDEX_HTML_PATH,
  STATIC_PATH,
} from './path.ts';

/**
 * Extracts CSS and JavaScript asset paths from index.html content using regex.
 * Finds the first `<link>` href and `<script>` src attribute values.
 * @param indexHtmlString - HTML content to parse for asset paths
 * @returns Object containing the JavaScript and CSS subpaths
 * @throws {@link Error} If required link href or script src cannot be found
 * @example
 * ```typescript
 * const htmlContent = await getIndexHtmlString();
 * const { jsSubpath, cssSubpath } = getAssetSubpaths(htmlContent);
 * ```
 */
function getAssetSubpaths(
  indexHtmlString: string,
): { jsSubpath: string; cssSubpath: string; } {
  l.debug(`getAssetSubpaths`);

  const cssMatch = indexHtmlString.match(/href=['"]([^'"]+)['"]/,);
  const jsMatch = indexHtmlString.match(/src=['"]([^'"]+)['"]/,);

  const cssSubpath = notNullishOrThrow(cssMatch?.[1],);
  const jsSubpath = notNullishOrThrow(jsMatch?.[1],);

  const result = { cssSubpath, jsSubpath, };
  l.debug(`getAssetSubpaths ${JSON.stringify(result,)}`);
  return result;
}

/**
 * Reads CSS and JavaScript asset files from the file system.
 * Used to embed the assets directly in the HTML response for the RSS reader.
 * @param assetSubpaths - Object containing the JavaScript and CSS subpaths
 * @returns Promise resolving to an object with the JavaScript and CSS content
 * @throws {@link Error} If the asset files cannot be read from the file system
 * @example
 * ```typescript
 * const assetPaths = { jsSubpath: 'assets/main.js', cssSubpath: 'assets/style.css' };
 * const { js, css } = await getAssetStrings(assetPaths);
 * ```
 * @see {@link STATIC_PATH} for the base directory of assets
 */
async function getAssetStrings(
  assetSubpaths: { jsSubpath: string; cssSubpath: string; },
): Promise<{ js: string; css: string; }> {
  l.debug(`getAssetStrings`);
  const css = await readFile(join(STATIC_PATH, assetSubpaths.cssSubpath,), 'utf8',);
  const js = await readFile(join(STATIC_PATH, assetSubpaths.jsSubpath,), 'utf8',);
  const result = { css, js, };
  l.debug(`getAssetStrings ${result.css.slice(0, 100,)} ${result.js.slice(0, 100,)}`);
  return result;
}

/**
 * Reads the index.html file content as a string for processing.
 * Used to extract asset paths for CSS and JavaScript files.
 * @returns Promise resolving to the content of index.html
 * @throws {@link Error} If the index.html file cannot be read
 * @example
 * ```typescript
 * const htmlContent = await getIndexHtmlString();
 * ```
 * @see {@link INDEX_HTML_PATH} for the file path
 */
async function getIndexHtmlString(): Promise<string> {
  l.debug(`getIndexHtmlString`);
  return await readFile(INDEX_HTML_PATH, 'utf8',);
}

/**
 * File watcher for the index.html file to automatically update asset content.
 * Watches for changes to the index.html file and refreshes CSS/JS assets.
 *
 * Note: This watcher is initialized with `ignoreInitial: false`, which means
 * the `updateCssJs` callback will be called immediately upon initialization.
 *
 * @see {@link Watcher} for the file watching implementation
 * @see {@link INDEX_HTML_PATH} for the watched file path
 * @see {@link updateCssJs} for the update handler
 */
export const indexHtmlWatcher: Watcher = new Watcher(INDEX_HTML_PATH, {
  ignoreInitial: false,
  debounce: 100,
},);

/**
 * Updates the CSS and JavaScript asset content when the index.html file changes.
 * Called automatically by the file watcher when index.html is modified.
 *
 * This function may be called twice during execution:
 * 1. During initial startup when the file watcher is initialized with `ignoreInitial: false`
 * 2. When the index.html file is actually modified by the user
 *
 * @returns Promise that resolves when assets are updated
 * @see {@link getAssetStrings} for reading asset files
 * @see {@link getAssetSubpaths} for parsing asset paths
 * @see {@link getIndexHtmlString} for reading the HTML file
 */
export async function updateCssJs(): Promise<void> {
  l.debug(`updateCssJs`);
  const assetStrings = await getAssetStrings(
    getAssetSubpaths(await getIndexHtmlString(),),
  );

  ({ js, css, } = assetStrings);

  const hashBuffer = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(assetStrings,),),);
  // Base64 encoded string
  hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer,),),);

  indexHtmlStart = `<!DOCTYPE html>
    <html lang=en data-asset-hash=${hash}>
    <head>
    <meta charset=UTF-8>
    <meta name=viewport content='width=device-width,initial-scale=1.0'>
    <style>${css}</style>
    <script type=module>${js.replaceAll(/<\/script>/gvi, '<\\/script>',)}</script>
    </head>
    <body>`;

  l.debug(`updateCssJs ${hash} ${assetStrings.js.slice(0, 100,)} ${assetStrings.css.slice(0, 100,)}`);
}

/**
 * Current JavaScript asset content for the RSS reader interface.
 * Updated automatically when the index.html file changes.
 * @see {@link indexHtmlWatcher} for the file watching mechanism
 * @see {@link getAssetStrings} for the update process
 */
export let js = '';

/**
 * Current CSS asset content for the RSS reader interface.
 * Updated automatically when the index.html file changes.
 * @see {@link indexHtmlWatcher} for the file watching mechanism
 * @see {@link getAssetStrings} for the update process
 */
export let css = '';

/**
 * Base64-encoded SHA-256 hash of the current inlined assets (CSS/JS).
 * Used by the client to detect server-side asset changes and trigger reload.
 * @see {@link updateCssJs} for hash computation
 */
export let hash = '';

/**
 * Beginning of the HTML template (doctype, html/head/body start) with inlined CSS and JS.
 * Includes a data-asset-hash attribute used by the client to compare against the server hash.
 * @see {@link hash} for the computed value
 * @see {@link updateCssJs} for template regeneration
 */
export let indexHtmlStart = '';

indexHtmlWatcher.on('all', updateCssJs,);
