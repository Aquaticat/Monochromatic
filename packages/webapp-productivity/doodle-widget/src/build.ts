/**
 * Build script: generates a single self-contained HTML doodle widget.
 *
 * Reads default SVG backgrounds for each page, removes white background
 * rects so canvas strokes show through, reads the pre-bundled client JS
 * from tsdown output, then assembles HTML/CSS/JS into a single file.
 *
 * Requires `mise run build:js:client` to have run first so
 * `dist/client/main.js` exists.
 */
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import pageSvg1 from './assets/output_1.svg' with { type: 'text', };
import pageSvg2 from './assets/output_2.svg' with { type: 'text', };

import { renderPage, } from './page.ts';
import { renderStyles, } from './styles.ts';
import { replaceWhiteFillStyles, } from './white-fill.ts';

export {};

/** Absolute path to this package's root directory */
const PACKAGE_DIR: string = new URL('..', import.meta.url,).pathname;

/** Output directory for the generated site */
const DIST_DIR = join(PACKAGE_DIR, 'dist', 'final',);

console.error('[doodle-widget] building...',);

/** Replace white fills with transparent so the canvas layer shows through */
const svgBackgrounds = [pageSvg1, pageSvg2,].map(replaceWhiteFillStyles,);

/** Minified CSS stylesheet */
const css = renderStyles();

/** Client-side canvas drawing and background management script, pre-bundled by tsdown */
const js = await readFile(join(PACKAGE_DIR, 'dist', 'client', 'main.js',), 'utf8',);

/** Complete self-contained HTML document */
const html = renderPage({ css, js, svgBackgrounds, },);

await mkdir(DIST_DIR, { recursive: true, },);
await writeFile(join(DIST_DIR, 'index.html',), html, 'utf8',);

console.error(`[doodle-widget] wrote ${join(DIST_DIR, 'index.html',)}`,);
