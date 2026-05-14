/**
 * Per-page asset collection pipeline.
 *
 * Given an HTML file inside a dist root, computes the total wire transfer
 * size of the HTML itself plus every asset a browser would fetch to render it.
 */
import { readFile, } from 'node:fs/promises';
import { extname, } from 'node:path';

import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';

import { extractCssUrls, } from './css.ts';
import { extractHtmlRefs, } from './html.ts';
import { resolveReference, } from './resolve.ts';
import { wireSize, } from './size.ts';

/**
 * Result of weighing a single HTML page.
 */
export type PageWeight = {
  /** Path of the HTML file relative to the dist root. */
  page: string;
  /** Sum of wire sizes of the HTML and every asset it references. */
  totalBytes: number;
  /** Number of unique assets contributing to the total (including the HTML). */
  resourceCount: number;
  /** References the walker saw but could not resolve to a file under root. */
  missing: string[];
};

/**
 * Reads a UTF-8 text file. Thin wrapper kept so callers read clearly.
 *
 * @param absolutePath - absolute filesystem path
 *
 * @returns file contents as a string
 */
function readText(absolutePath: string,): Promise<string> {
  return readFile(
    absolutePath,
    'utf8',
  );
}

/**
 * Reads a CSS file and returns the raw source, or `null` if it cannot be read.
 *
 * Skipping on read failure keeps the pipeline robust against broken links
 * without masking them; the caller still receives the path via `missing`.
 *
 * @param absolutePath - absolute CSS path
 *
 * @returns CSS source or `null`
 */
async function readCssOrNull(absolutePath: string,): Promise<string | null> {
  try {
    return await readText(absolutePath,);
  }
  catch {
    return null;
  }
}

/**
 * Walks a CSS file's `url()` references into resolved absolute paths,
 * recursing through `@import` chains.
 *
 * @param startPath - absolute path of the initial CSS file
 *
 * @param root - absolute dist root
 *
 * @param seen - mutable set of absolute paths already counted (de-dup store)
 *
 * @param missing - mutable accumulator of references that could not resolve
 *
 * @returns absolute paths of assets referenced by the CSS graph
 */
async function walkCss(
  {
    startPath,
    root,
    seen,
    missing,
  }: {
    startPath: string;
    root: string;
    seen: Set<string>;
    missing: string[];
  },
): Promise<string[]> {
  const collected: string[] = [];
  const queue: string[] = [startPath,];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const cssPath = nonNullishOrThrow(queue.shift(),);
    if (visited.has(cssPath,))
      continue;
    visited.add(cssPath,);

    const source = await readCssOrNull(cssPath,);
    if (source === null)
      continue;

    for (const ref of extractCssUrls(source,)) {
      const resolved = resolveReference({
        root,
        fromFile: cssPath,
        ref,
      },);
      if (resolved === null) {
        missing.push(ref,);
        continue;
      }
      if (extname(resolved,).toLowerCase() === '.css' && !visited.has(resolved,))
        queue.push(resolved,);
      if (!seen.has(resolved,)) {
        seen.add(resolved,);
        collected.push(resolved,);
      }
    }
  }

  return collected;
}

/**
 * Computes the wire transfer size of one HTML page.
 *
 * Algorithm:
 *
 * 1. Add the HTML's own wire size.
 * 2. Walk HTML for referenced assets (link, script, img, picture, ...).
 * 3. For each CSS reference, walk its `url()` graph to pick up fonts,
 *    background images, and chained `@import`s.
 * 4. For each `<style>` block, apply the same CSS `url()` scan using the
 *    HTML's own path as the resolution base.
 * 5. Sum the unique wire sizes.
 *
 * @param htmlPath - absolute path to the HTML file
 *
 * @param root - absolute dist root
 *
 * @returns a `PageWeight` record
 *
 * @example
 * ```ts
 * const weight = await weighPage({
 *   htmlPath: '/srv/dist/index.html',
 *   root: '/srv/dist',
 * });
 * ```
 */
export async function weighPage(
  {
    htmlPath,
    root,
  }: {
    htmlPath: string;
    root: string;
  },
): Promise<PageWeight> {
  const missing: string[] = [];
  const seen = new Set<string>([htmlPath,],);
  const assets: string[] = [htmlPath,];

  const htmlSource = await readText(htmlPath,);
  const {
    urls,
    inlineStyles,
  } = extractHtmlRefs(htmlSource,);

  for (const ref of urls) {
    const resolved = resolveReference({
      root,
      fromFile: htmlPath,
      ref,
    },);
    if (resolved === null) {
      missing.push(ref,);
      continue;
    }
    if (!seen.has(resolved,)) {
      seen.add(resolved,);
      assets.push(resolved,);
    }
    if (extname(resolved,).toLowerCase() === '.css') {
      const nested = await walkCss({
        startPath: resolved,
        root,
        seen,
        missing,
      },);
      for (const asset of nested)
        assets.push(asset,);
    }
  }

  for (const inline of inlineStyles) {
    for (const ref of extractCssUrls(inline,)) {
      const resolved = resolveReference({
        root,
        fromFile: htmlPath,
        ref,
      },);
      if (resolved === null) {
        missing.push(ref,);
        continue;
      }
      if (!seen.has(resolved,)) {
        seen.add(resolved,);
        assets.push(resolved,);
      }
    }
  }

  let totalBytes = 0;
  for (const asset of assets) {
    const size = await wireSize(asset,);
    if (size === null) {
      missing.push(asset,);
      continue;
    }
    totalBytes += size;
  }

  const relativePage = htmlPath.startsWith(root,)
    ? htmlPath.slice(root.length + 1,)
    : htmlPath;

  return {
    page: relativePage,
    totalBytes,
    resourceCount: assets.length,
    missing,
  };
}
