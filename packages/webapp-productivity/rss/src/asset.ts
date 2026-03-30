import { readFile, } from 'node:fs/promises';

import clientCss from './client.css' with { type: 'text', };
import { l, } from './log.ts';

l.debug(`asset module loading`,);

/**
 * CSS source for the RSS reader interface.
 * Imported at build time via static asset import.
 * Also used by `itemToFeed` in html.ts for iframe content styling.
 *
 * @see `indexHtmlStart` for where it is inlined into the page
 */
export const css: string = clientCss;

/**
 * Bundled client-side JavaScript for the RSS reader interface.
 * Pre-built by tsdown via `mise run build:js:client` and read from disk at startup.
 *
 * @see `indexHtmlStart` for where it is inlined into the page
 */
export const js: string = await readFile(
  './dist/client/client.js',
  'utf8',
);

/**
 * Opening HTML fragment (doctype through body start) with inlined CSS and JS.
 * Served as the beginning of every page response.
 *
 * @see `css` for the inlined stylesheet
 *
 * @see `js` for the inlined client bundle
 */
export const indexHtmlStart: string = `<!DOCTYPE html>
    <html lang=en>
    <head>
    <meta charset=UTF-8>
    <meta name=viewport content='width=device-width,initial-scale=1.0'>
    <style>${css}</style>
    <script type=module>${
  js.replaceAll(
    '</script>',
    String.raw`<\/script>`,
  )
}</script>
    </head>
    <body>`;

l.debug(`asset module loaded, css ${css.length} chars, js ${js.length} chars`,);
