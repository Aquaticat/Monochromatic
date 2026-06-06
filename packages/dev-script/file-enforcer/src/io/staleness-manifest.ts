import {
  join,
  resolve,
} from 'node:path';
import {
  readManifestFromDisk,
  writeMergedManifest,
} from './staleness-manifest-persist.ts';
import {
  findNodeModulesRoot,
  NODE_MODULES_DIRECTORY_NAME,
} from './staleness-root.ts';
import {
  CACHE_DIRECTORY_NAME,
  EACH_ENTRY_PREFIX,
  MANIFEST_FILE_NAME,
  SINGLE_ENTRY_PREFIX,
  type StalenessEntry,
  type StalenessManifest,
  type StalenessOptions,
} from './staleness-types.ts';

/**
 * Read-only manifest shape accepted by the serializer.
 */
type ReadonlyStalenessManifest = Readonly<{
  /**
   * Manifest schema version.
   */
  readonly version: number;

  /**
   * Read-only entry map for serialization.
   */
  readonly entries: Readonly<Record<string, StalenessEntry>>;
}>;

/**
 * Options for writing a manifest file.
 */
type WriteManifestOptions = Readonly<{
  /**
   * Absolute manifest path.
   */
  readonly manifestPath: string;

  /**
   * Manifest object to serialize.
   */
  readonly manifest: ReadonlyStalenessManifest;
}>;

/**
 * In-memory manifest cache keyed by absolute manifest path.
 */
const manifestCache: Map<string, StalenessManifest> = new Map<string, StalenessManifest>();

/**
 * Manifest paths changed in memory and awaiting a process-exit flush.
 */
const dirtyManifestPaths: Set<string> = new Set<string>();

/**
 * Writes one cached manifest to disk.
 *
 * @param manifestPath - Absolute manifest path to flush.
 *
 * @example
 * ```ts
 * flushManifestPath('/repo/node_modules/.cache/file-enforcer/staleness-manifest.json');
 * ```
 */
function flushManifestPath(manifestPath: string,): void {
  /**
   * Cached manifest to flush.
   */
  const manifest = manifestCache.get(manifestPath,);
  if (manifest === undefined)
    return;

  /**
   * Manifest merged with any entries other processes wrote while this process ran.
   */
  const mergedManifest = writeMergedManifest({
    manifestPath,
    manifest,
  },);
  manifestCache.set(
    manifestPath,
    mergedManifest,
  );
}

/**
 * Flushes all dirty manifests before a normal process exit.
 *
 * @example
 * ```ts
 * flushDirtyManifests();
 * ```
 */
function flushDirtyManifests(): void {
  dirtyManifestPaths.forEach(function flushDirtyManifest(manifestPath,): void {
    flushManifestPath(manifestPath,);
  },);
  dirtyManifestPaths.clear();
}

process.on(
  'exit',
  flushDirtyManifests,
);

/**
 * Resolves the manifest path for a write call.
 *
 * @param manifestPath - Optional caller-provided manifest path.
 *
 * @returns Absolute manifest file path.
 *
 * @example
 * ```ts
 * const path = resolveManifestPath({ manifestPath: './cache.json' });
 * ```
 */
export function resolveManifestPath(
  {
    manifestPath,
  }: StalenessOptions,
): string {
  if (manifestPath !== undefined)
    return resolve(manifestPath,);

  /**
   * Workspace root discovered by walking up until `node_modules` exists.
   */
  const nodeModulesRoot = findNodeModulesRoot(process.cwd(),);
  return join(
    nodeModulesRoot,
    NODE_MODULES_DIRECTORY_NAME,
    '.cache',
    CACHE_DIRECTORY_NAME,
    MANIFEST_FILE_NAME,
  );
}

/**
 * Builds a manifest key for a single-destination overwrite.
 *
 * @param dest - Destination path passed to `overwrite()`.
 *
 * @returns Stable manifest entry key.
 *
 * @example
 * ```ts
 * const key = stalenessKeyForDest('./CLAUDE.md');
 * ```
 */
export function stalenessKeyForDest(dest: string,): string {
  return `${SINGLE_ENTRY_PREFIX}${resolve(dest,)}`;
}

/**
 * Builds a manifest key for a glob-mirror overwrite.
 *
 * @param destGlob - Destination glob passed to `overwriteEach()`.
 *
 * @returns Stable manifest entry key.
 *
 * @example
 * ```ts
 * const key = stalenessKeyForDestGlob('./out/*​/*.md');
 * ```
 */
export function stalenessKeyForDestGlob(destGlob: string,): string {
  return `${EACH_ENTRY_PREFIX}${resolve(destGlob,)}`;
}

/**
 * Loads a manifest, reusing the per-process cache after the first read.
 *
 * @param manifestPath - Absolute manifest path.
 *
 * @returns Mutable in-memory manifest object.
 *
 * @example
 * ```ts
 * const manifest = loadManifest('/tmp/manifest.json');
 * ```
 */
export function loadManifest(manifestPath: string,): StalenessManifest {
  /**
   * Cached manifest for this path.
   */
  const cachedManifest = manifestCache.get(manifestPath,);
  if (cachedManifest !== undefined)
    return cachedManifest;

  /**
   * Manifest loaded from disk or initialized empty.
   */
  const manifest = readManifestFromDisk(manifestPath,);
  manifestCache.set(
    manifestPath,
    manifest,
  );
  return manifest;
}

/**
 * Persists a manifest synchronously so async builders cannot race stale writes.
 *
 * @param manifestPath - Absolute manifest path.
 *
 * @param manifest - Manifest object to serialize.
 *
 * @example
 * ```ts
 * writeManifest({ manifestPath: '/tmp/manifest.json', manifest });
 * ```
 */
export function writeManifest(
  {
    manifestPath,
    manifest,
  }: WriteManifestOptions,
): void {
  manifestCache.set(
    manifestPath,
    {
      version: manifest.version,
      entries: { ...manifest.entries, },
    },
  );
  dirtyManifestPaths.add(manifestPath,);
}
