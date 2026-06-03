import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { configDependencyPaths, } from '../context.ts';
import {
  l,
  tagged,
} from '../log.ts';
import { isStalenessManifest, } from './staleness-guards.ts';
import {
  CACHE_DIRECTORY_NAME,
  EACH_ENTRY_PREFIX,
  MANIFEST_FILE_NAME,
  MANIFEST_VERSION,
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
 * Returns the default empty manifest.
 *
 * @returns Empty manifest for a cache file that does not exist yet.
 *
 * @example
 * ```ts
 * const manifest = emptyManifest();
 * ```
 */
function emptyManifest(): StalenessManifest {
  return {
    version: MANIFEST_VERSION,
    entries: {},
  };
}

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
   * First implicit config dependency, or current directory when no entry path exists.
   */
  const anchorPath = configDependencyPaths()[0]
    ?? process.cwd();

  return join(
    dirname(anchorPath,),
    'node_modules',
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
 * Reads a manifest from disk without throwing on absent or invalid files.
 *
 * @param manifestPath - Absolute manifest path.
 *
 * @returns Parsed manifest or an empty manifest.
 *
 * @example
 * ```ts
 * const manifest = readManifestFromDisk('/tmp/manifest.json');
 * ```
 */
function readManifestFromDisk(manifestPath: string,): StalenessManifest {
  /**
   * Function-scoped logger tagged for manifest diagnostics.
   */
  const rl = tagged({
    tag: readManifestFromDisk.name,
    l,
  },);

  try {
    /**
     * Raw JSON manifest content.
     */
    const rawManifest = readFileSync(
      manifestPath,
      'utf8',
    );
    /**
     * Parsed JSON manifest value.
     */
    const parsedManifest: unknown = JSON.parse(rawManifest,);
    if (isStalenessManifest(parsedManifest,))
      return parsedManifest;

    rl.debug(`ignoring invalid staleness manifest: ${manifestPath}`,);
    return emptyManifest();
  }
  catch {
    return emptyManifest();
  }
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
  mkdirSync(
    dirname(manifestPath,),
    { recursive: true, },
  );
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      manifest,
      null,
      2,
    )}\n`,
  );
}
