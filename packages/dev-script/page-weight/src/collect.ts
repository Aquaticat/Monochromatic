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
  /** Accumulator of unique asset paths discovered through the CSS graph. */
  const collected: string[] = [];
  /**
   * BFS frontier so chained `@import`s are followed before the function returns.
   */
  const queue: string[] = [startPath,];
  /** Cycle guard so a CSS file reached twice is not re-parsed. */
  const visited = new Set<string>();

  while (queue.length > 0) {
    /** Next stylesheet to process; the while-condition guarantees a value. */
    const cssPath = nonNullishOrThrow(queue.shift(),);
    if (visited.has(cssPath,))
      continue;
    visited.add(cssPath,);

    /** CSS text, or `null` when the file cannot be read so dead links don't abort the walk. */
    // oxlint-disable-next-line eslint/no-await-in-loop -- BFS over a queue that grows as each iteration parses imports; each step depends on the previous shift and the shared `visited` set, so parallelisation would race on dedup state.
    const source = await readCssOrNull(cssPath,);
    if (source === null)
      continue;

    for (const ref of extractCssUrls(source,)) {
      /** Absolute asset path, or `null` when the reference escapes the dist root. */
      const resolved = resolveReference({
        root,
        fromFile: cssPath,
        ref,
      },);
      if (resolved === null) {
        missing.push(ref,);
        continue;
      }
      if ((extname(resolved,).toLowerCase() === '.css') && (!visited.has(resolved,))) {
        queue.push(resolved,);
      }
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
  /** Accumulator for unresolvable references, surfaced on the returned record. */
  const missing: string[] = [];
  /** Dedup set seeded with the HTML so it is not re-added via a self-reference. */
  const seen = new Set<string>([htmlPath,],);
  /** Ordered list of unique asset paths, beginning with the HTML itself. */
  const assets: string[] = [htmlPath,];

  /** Raw HTML scanned for asset references. */
  const htmlSource = await readText(htmlPath,);
  /** Destructured pair so direct URLs and inline `<style>` blocks can be walked separately. */
  const {
    urls,
    inlineStyles,
  } = extractHtmlRefs(htmlSource,);

  for (const ref of urls) {
    /** Absolute path of the referenced asset, or `null` when it escapes the dist root. */
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
      /**
       * Assets reachable through the CSS `@import` / `url()` graph rooted at this stylesheet.
       */
      // oxlint-disable-next-line eslint/no-await-in-loop -- walkCss mutates the shared `seen` and `missing` accumulators, so parallel calls would race on those sets; ordering also determines which `@import` chain claims a given asset path first.
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
      /** Absolute asset path for an inline `<style>` reference, or `null` when it escapes the dist root. */
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

  /** Wire sizes per asset, computed in parallel; `null` slots are surfaced via `missing` below. */
  const sizes = await Promise.all(assets.map(function measure(asset: string,): Promise<number | null> {
    return wireSize(asset,);
  },),);
  /** Sum of every successfully measured asset, with unmeasurable assets recorded into `missing`. */
  const totalBytes = sizes.reduce(
    function sumNonNull(
      acc: number,
      size: number | null,
      index: number,
    ): number {
      if (size === null) {
        missing.push(nonNullishOrThrow(assets[index],),);
        return acc;
      }
      return acc + size;
    },
    0,
  );

  /** Page path stripped of the dist root prefix so the report stays readable. */
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
