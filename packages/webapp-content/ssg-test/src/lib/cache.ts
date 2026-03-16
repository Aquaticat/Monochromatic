/**
 * Build-time incremental cache for the SSG pipeline.
 *
 * Stores content hashes and rendered HTML from the unified pipeline to skip
 * re-processing unchanged MDX files. Cache is persisted to `.cache/build-manifest.json`.
 *
 * Invalidation:
 * - Content hash change: re-process that file only
 * - Pipeline hash change: invalidate all entries (config/plugin change)
 * - File deletion: stale entries cleaned after build
 */
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, } from 'node:path';

import { z, } from 'zod';

import { postFrontmatterSchema, } from './content.ts';

// File justification: 164 lines -- schema definitions, I/O, and lookup form a
// cohesive cache API; splitting into 3+ sub-40-line files adds indirection
// without improving navigability.
export { computePipelineHash, sha256, } from './cache-hash.ts';

//region Schema and types

/** Zod schema for a single cache entry. */
const cacheEntrySchema = z.object({
  contentHash: z.string(),
  html: z.string(),
  frontmatter: postFrontmatterSchema,
},);

/** Per-file cache entry with content hash and pre-rendered HTML. */
export type CacheEntry = z.infer<typeof cacheEntrySchema>;

/** Zod schema for the on-disk build manifest. */
const buildManifestSchema = z.object({
  pipelineHash: z.string(),
  content: z.record(z.string(), cacheEntrySchema,),
},);

/** On-disk cache structure at `.cache/build-manifest.json`. */
export type BuildManifest = z.infer<typeof buildManifestSchema>;

//endregion Schema and types

/** Default path for the cache manifest file. */
const CACHE_PATH = '.cache/build-manifest.json';

//region Cache I/O

/**
 * Reads the build manifest from disk.
 *
 * Returns `undefined` when the cache file does not exist.
 * Logs and discards corrupted or invalid manifests rather than
 * crashing the build, since a missing cache just triggers a full rebuild.
 *
 * @returns parsed and validated manifest, or `undefined` on any failure
 */
export async function readCache(): Promise<BuildManifest | undefined> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8',);
    return buildManifestSchema.parse(JSON.parse(raw,),);
  }
  catch (error) {
    // ENOENT is expected on first build; everything else is worth logging
    const isFileNotFound = error instanceof Error
      && 'code' in error
      && error.code === 'ENOENT';

    if (!isFileNotFound) {
      console.error('Failed to read or validate build cache, starting fresh:', error,);
    }
    return undefined;
  }
}

/**
 * Writes the build manifest to disk, creating the `.cache/` directory if needed.
 *
 * @param manifest - build manifest to persist
 */
export async function writeCache(manifest: BuildManifest,): Promise<void> {
  await mkdir(dirname(CACHE_PATH,), { recursive: true, },);
  await writeFile(CACHE_PATH, JSON.stringify(manifest, undefined, 2,), 'utf8',);
}

//endregion Cache I/O

//region Cache lookup

/**
 * Looks up a cached entry for a given file path and content hash.
 *
 * @param manifest - current build manifest (or undefined if no cache)
 *
 * @param filePath - relative path to the MDX file
 *
 * @param contentHash - SHA-256 of the current file contents
 *
 * @returns cached entry if the content hash matches, otherwise `undefined`
 */
export function getCachedEntry(
  { manifest, filePath, contentHash, }: {
    manifest: BuildManifest | undefined;
    filePath: string;
    contentHash: string;
  },
): CacheEntry | undefined {
  if (manifest === undefined)
    return undefined;

  const entry = manifest.content[filePath];
  if (entry === undefined)
    return undefined;

  if (entry.contentHash !== contentHash)
    return undefined;

  return entry;
}

/**
 * Creates a new cache entry for a processed MDX file.
 *
 * @param contentHash - SHA-256 of the raw file contents
 *
 * @param html - rendered HTML from the unified pipeline
 *
 * @param frontmatter - validated frontmatter data
 *
 * @returns cache entry ready for insertion into the manifest
 */
export function createCacheEntry(
  { contentHash, html, frontmatter, }: {
    contentHash: string;
    html: string;
    frontmatter: CacheEntry['frontmatter'];
  },
): CacheEntry {
  return { contentHash, html, frontmatter, };
}

/**
 * Builds a new manifest from processed entries, cleaning up stale paths.
 *
 * @param pipelineHash - current pipeline configuration hash
 *
 * @param entries - record of file paths to cache entries
 *
 * @returns new build manifest
 */
export function buildManifest(
  { pipelineHash, entries, }: {
    pipelineHash: string;
    entries: Record<string, CacheEntry>;
  },
): BuildManifest {
  return { pipelineHash, content: entries, };
}

//endregion Cache lookup
