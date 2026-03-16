/**
 * Static site build script.
 *
 * Orchestrates the full SSG pipeline:
 * 1. Load and validate MDX content
 * 2. Process changed files through the unified pipeline (with caching)
 * 3. Generate all HTML pages via h-html templates
 * 4. Generate CSS via h-css
 * 5. Generate RSS feeds per language
 * 6. Copy static assets from public/
 * 7. Post-process: HTML minification + zstd compression
 *
 * Run via `mise run build:site` or `bun src/build.ts`.
 */
import { readFile, } from 'node:fs/promises';
import { relative, } from 'node:path';

import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

import { generateAssets, } from './build/assets.ts';
import { generatePages, } from './build/pages.ts';
import { postProcess, } from './build/post-process.ts';
import {
  buildManifest,
  computePipelineHash,
  createCacheEntry,
  getCachedEntry,
  readCache,
  sha256,
  writeCache,
} from './lib/cache.ts';
import { loadContent, } from './lib/content.ts';
import { createProcessor, } from './lib/markdown.ts';

// File justification: 120 lines -- linear pipeline script; splitting the
// orchestration across multiple files would scatter the build sequence.
export {}; // eslint module boundary marker

await initPromise;

/** Tagged logger for the build pipeline. */
const l = tagged({ tag: 'build', l: $, },);

/** Site base URL for RSS feed links. */
const SITE_URL = 'https://aquati.cat';

/** Content source directory. */
const CONTENT_DIR = 'src/content';

/** Pipeline config source path (for cache invalidation). */
const PIPELINE_SOURCE = 'src/lib/markdown.ts';

//region Build orchestration -- loads content, processes MDX, generates pages and assets

l.info('starting',);

/** Loaded posts, cached manifest, and pipeline hash fetched concurrently. */
const [posts, cache, pipelineHash,] = await Promise.all([
  loadContent(CONTENT_DIR,),
  readCache(),
  computePipelineHash(PIPELINE_SOURCE,),
],);

l.info(`loaded ${posts.length} posts`,);

/** Whether the processing pipeline source has changed since last build. */
const pipelineChanged = cache?.pipelineHash !== pipelineHash;
if (pipelineChanged) {
  l.info('pipeline changed, invalidating all cache entries',);
}

/** Cache to use for lookups; `undefined` forces full reprocessing on pipeline change. */
const effectiveCache = pipelineChanged ? undefined : cache;

/** Configured unified processor for MDX-to-HTML conversion. */
const processor = createProcessor();

/** Results from processing each post: rendered HTML and cache entry. */
const processResults = await Promise.all(posts.map(async function processPost(post,) {
  const contentHash = sha256(await readFile(post.filePath, 'utf8',),);
  const cacheKey = relative('.', post.filePath,);
  const cached = getCachedEntry({
    manifest: effectiveCache,
    filePath: cacheKey,
    contentHash,
  },);

  if (cached !== undefined) {
    return { contentKey: `${post.lang}/${post.name}`, cacheKey, entry: cached, fromCache: true, };
  }

  const result = await processor.process(post.body,);
  const html = String(result,);
  const entry = createCacheEntry({ contentHash, html, frontmatter: post.data, },);
  return { contentKey: `${post.lang}/${post.name}`, cacheKey, entry, fromCache: false, };
},),);

/** Map of `lang/name` content keys to rendered HTML strings. */
const renderedContent = new Map(
  processResults.map(function toContentEntry({ contentKey, entry, },) {
    return [contentKey, entry.html,] as const;
  },),
);

/** Cache entries keyed by relative file path for manifest persistence. */
const cacheEntries = Object.fromEntries(
  processResults.map(function toCacheEntry({ cacheKey, entry, },) {
    return [cacheKey, entry,];
  },),
);

/** Number of posts served from cache without reprocessing. */
const cacheHits = processResults.filter(function wasFromCache({ fromCache, },) {
  return fromCache;
},).length;

l.info(`processed ${posts.length - cacheHits} files, ${cacheHits} from cache`,);

await generatePages({ posts, renderedContent, l, },);
await generateAssets({ posts, siteUrl: SITE_URL, contentDir: CONTENT_DIR, l, },);
await postProcess({ l, },);

await writeCache(buildManifest({ pipelineHash, entries: cacheEntries, },),);
l.info('done',);

//endregion Build orchestration
