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

import * as v from 'valibot';

import {
  type PostFrontmatter,
  postFrontmatterSchema,
} from './content.ts';
import type { Logger, } from './types.ts';

// File justification: 164 lines; schema definitions, I/O, and lookup form a
// cohesive cache API; splitting into 3+ sub-40-line files adds indirection
// without improving navigability.
export {
  computePipelineFingerprint,
  sha256,
} from './cache-hash.ts';

//region Schema and types

/** Per-file cache entry with content hash and pre-rendered HTML. */
export type CacheEntry = {
  contentHash: string;
  html: string;
  frontmatter: PostFrontmatter;
};

/** Valibot schema for a single cache entry. */
const cacheEntrySchema = v.object({
  contentHash: v.string(),
  html: v.string(),
  frontmatter: postFrontmatterSchema,
},);

/** On-disk cache structure at `.cache/build-manifest.json`. */
export type BuildManifest = {
  pipelineHash: string;
  /**
   * HEAD commit SHA captured when this manifest was written.
   * Used to validate cached git-derived publication/update dates:
   * when the current HEAD matches, cached dates are reusable without
   * re-probing git. When HEAD has moved, dates are re-derived.
   */
  headSha: string;
  content: Record<string, CacheEntry>;
};

/** Valibot schema for the on-disk build manifest. */
const buildManifestSchema = v.object({
  pipelineHash: v.string(),
  headSha: v.string(),
  content: v.record(
    v.string(),
    cacheEntrySchema,
  ),
},);

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
 * @param l - logger for cache read errors
 *
 * @returns parsed and validated manifest, or `undefined` on any failure
 *
 * @example
 * ```ts
 * const manifest = await readCache({ l: logger });
 * ```
 */
export async function readCache(
  { l, }: { l: Logger; },
): Promise<BuildManifest | undefined> {
  try {
    /** Raw JSON text read before schema validation so parse errors and validation errors share the same catch. */
    const raw = await readFile(
      CACHE_PATH,
      'utf8',
    );
    return v.parse(
      buildManifestSchema,
      JSON.parse(raw,),
    );
  }
  catch (error) {
    // ENOENT is expected on first build; everything else is worth logging
    /** Distinguishes the benign first-build case from genuine failures so logs stay quiet on the happy path. */
    const isFileNotFound = (error instanceof Error)
      && ('code' in error)
      && (error.code === 'ENOENT');

    if (!isFileNotFound) {
      l.error(
        `Failed to read or validate build cache, starting fresh: ${String(error,)}`,
      );
    }
    return undefined;
  }
}

/**
 * Writes the build manifest to disk, creating the `.cache/` directory if needed.
 *
 * @param manifest - build manifest to persist
 *
 * @example
 * ```ts
 * await writeCache(manifest);
 * ```
 */
export async function writeCache(manifest: BuildManifest,): Promise<void> {
  await mkdir(
    dirname(CACHE_PATH,),
    { recursive: true, },
  );
  await writeFile(
    CACHE_PATH,
    JSON.stringify(
      manifest,
      undefined,
      2,
    ),
    'utf8',
  );
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
 *
 * @example
 * ```ts
 * const entry = getCachedEntry({ manifest, filePath: 'en/hello.mdx', contentHash: hash });
 * ```
 */
export function getCachedEntry(
  {
    manifest,
    filePath,
    contentHash,
  }: {
    manifest: BuildManifest | undefined;
    filePath: string;
    contentHash: string;
  },
): CacheEntry | undefined {
  if (manifest === undefined)
    return undefined;

  /** Lookup separated from the hash check so the missing-key and stale-hash branches both early-return. */
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
 *
 * @example
 * ```ts
 * const entry = createCacheEntry({ contentHash: hash, html: '<p>Hello</p>', frontmatter: data });
 * ```
 */
export function createCacheEntry(
  {
    contentHash,
    html,
    frontmatter,
  }: {
    contentHash: string;
    html: string;
    frontmatter: CacheEntry['frontmatter'];
  },
): CacheEntry {
  return {
    contentHash,
    html,
    frontmatter,
  };
}

/**
 * Builds a new manifest from processed entries, cleaning up stale paths.
 *
 * @param pipelineHash - current pipeline configuration hash
 *
 * @param headSha - HEAD commit SHA to persist for git-date reuse
 *
 * @param entries - record of file paths to cache entries
 *
 * @returns new build manifest
 *
 * @example
 * ```ts
 * const manifest = buildManifest({ pipelineHash, headSha, entries });
 * ```
 */
export function buildManifest(
  {
    pipelineHash,
    headSha,
    entries,
  }: {
    pipelineHash: string;
    headSha: string;
    entries: Record<string, CacheEntry>;
  },
): BuildManifest {
  return {
    pipelineHash,
    headSha,
    content: entries,
  };
}

//endregion Cache lookup
