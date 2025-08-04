import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  notNullishOrThrow,
} from '@monochromatic-dev/module-es';
import { Window, } from 'happy-dom';
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import Watcher from 'watcher';
import {
  INDEX_HTML_PATH,
  STATIC_PATH,
} from './path.ts';

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'asset',],);

/**
 * Extract CSS and JavaScript asset paths from the index.html content.
 * Uses a virtual DOM to parse the HTML and find link and script tags.
 * @param indexHtmlString - The HTML content to parse for asset paths
 * @returns Object containing the JavaScript and CSS subpaths
 * @throws {@link Error} If required DOM elements cannot be found in the HTML
 * @example
 * ```typescript
 * const htmlContent = await getIndexHtmlString();
 * const { jsSubpath, cssSubpath } = getAssetSubpaths(htmlContent);
 * ```
 * @see {@link Window} for the virtual DOM implementation
 * @see {@link notNullishOrThrow} for element validation
 */
function getAssetSubpaths(
  indexHtmlString: string,
): { jsSubpath: string; cssSubpath: string; } {
  l.debug`getAssetSubpaths`;
  const window = new Window();
  const document = window.document;
  document.write(indexHtmlString,);
  document.close();
  const cssSubpath = notNullishOrThrow(document.querySelector('link',),).href;
  const jsSubpath = notNullishOrThrow(document.querySelector('script',),).src;
  window
    .happyDOM
    .abort()
    .then(function logSuccess() {
      l.debug`success releasing happy dom`;
    },)
    .catch(function logError() {
      l
        .debug`failed to release happy dom. This error has no effects other than taking up a bit more memory.`;
    },);

  const result = { cssSubpath, jsSubpath, };
  l.debug`getAssetSubpaths ${result}`;
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
 * @see {@link readFile} for the file reading implementation
 * @see {@link join} for path joining logic
 */
async function getAssetStrings(
  assetSubpaths: { jsSubpath: string; cssSubpath: string; },
): Promise<{ js: string; css: string; }> {
  l.debug`getAssetStrings`;
  const css = await readFile(join(STATIC_PATH, assetSubpaths.cssSubpath,), 'utf8',);
  const js = await readFile(join(STATIC_PATH, assetSubpaths.jsSubpath,), 'utf8',);
  const result = { css, js, };
  l.debug`getAssetStrings ${result.css.slice(0, 100,)} ${result.js.slice(0, 100,)}`;
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
 * @see {@link readFile} for the file reading implementation
 */
async function getIndexHtmlString(): Promise<string> {
  l.debug`getIndexHtmlString`;
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
const indexHtmlWatcher: Watcher = new Watcher(INDEX_HTML_PATH, {
  ignoreInitial: false,
  debounce: 100,
},);

export async function updateCssJs(): Promise<void> {
  l.debug`updateCssJs`;
  ({ js, css, } = await getAssetStrings(
    getAssetSubpaths(await getIndexHtmlString(),),
  ));
  l.debug`updateCssJs ${js.slice(0, 100,)} ${css.slice(0, 100,)}`;
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
indexHtmlWatcher.on('all', updateCssJs,);
