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
import { createHash, } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, } from 'node:path';

import type { PostFrontmatter, } from './content.ts';

//region Types

/** Per-file cache entry with content hash and pre-rendered HTML. */
type CacheEntry = {
  /** SHA-256 hex digest of the raw MDX file contents. */
  contentHash: string;
  /** Pre-rendered HTML from the unified pipeline. */
  html: string;
  /** Parsed and validated frontmatter (avoids re-parsing gray-matter + Zod). */
  frontmatter: PostFrontmatter;
};

/** On-disk cache structure at `.cache/build-manifest.json`. */
type BuildManifest = {
  /** SHA-256 of the pipeline configuration file (markdown.ts). */
  pipelineHash: string;
  /** Per-file cache entries keyed by relative file path. */
  content: Record<string, CacheEntry>;
};

//endregion Types

/** Default path for the cache manifest file. */
const CACHE_PATH = '.cache/build-manifest.json';

//region Hash utilities

/**
 * Computes a SHA-256 hex digest of a string.
 *
 * @param input - string to hash
 *
 * @returns hex-encoded SHA-256 digest
 */
export function sha256(input: string,): string {
  return createHash('sha256',).update(input,).digest('hex',);
}

/**
 * Computes the pipeline hash by hashing the markdown.ts source file.
 *
 * When this hash changes, all cached content entries are invalidated
 * because the processing pipeline configuration has changed.
 *
 * @param pipelineSourcePath - absolute path to the pipeline config source
 *
 * @returns hex-encoded SHA-256 digest of the pipeline source
 */
export async function computePipelineHash(
  pipelineSourcePath: string,
): Promise<string> {
  const source = await readFile(pipelineSourcePath, 'utf8',);
  return sha256(source,);
}

//endregion Hash utilities

//region Cache I/O

/**
 * Reads the build manifest from disk.
 *
 * @returns parsed manifest, or `undefined` if the cache file does not exist
 */
export async function readCache(): Promise<BuildManifest | undefined> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8',);
    return JSON.parse(raw,) as BuildManifest;
  }
  catch {
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
    frontmatter: PostFrontmatter;
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
