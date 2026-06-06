import { configDependencyPaths, } from '../context.ts';
import {
  addWatchedPaths,
  setWriteTimestamp,
  trackDest,
  type TrackedGlob,
} from '../tracker.ts';
import { destinationStampListsMatch, } from './staleness-destination-match.ts';
import { destinationStamps, } from './staleness-destinations.ts';
import {
  loadManifest,
  resolveManifestPath,
  stalenessKeyForDest,
  stalenessKeyForDestGlob,
  writeManifest,
} from './staleness-manifest.ts';
import { hashSourceSet, } from './staleness-hash.ts';
import {
  fileStampListsMatch,
  globStampsMatch,
  normalizeGlobStamps,
  readFileStamps,
} from './staleness-stamps.ts';
import {
  ABSENT_FILE_STAMPS,
  type StalenessDestination,
  type StalenessEntry,
  type StalenessEntryKind,
  type StalenessOptions,
} from './staleness-types.ts';

export type {
  StalenessDestination,
  StalenessEntryKind,
  StalenessOptions,
} from './staleness-types.ts';
export {
  resolveManifestPath,
  stalenessKeyForDest,
  stalenessKeyForDestGlob,
};

/**
 * Checks source metadata, glob path sets, and destination metadata for a cached entry.
 *
 * @param entry - Persisted entry to validate.
 *
 * @returns Whether the entry is still fresh.
 *
 * @example
 * ```ts
 * const fresh = await entryMetadataMatches(entry);
 * ```
 */
async function entryMetadataMatches(entry: StalenessEntry,): Promise<boolean> {
  /**
   * Whether captured glob path sets are unchanged.
   */
  const globsFresh = await globStampsMatch(entry.sourceGlobs,);
  if (!globsFresh)
    return false;

  /**
   * Current source metadata.
   */
  const sourcePaths = entry
    .sourceFiles
    .map(function sourcePath(sourceFile,): string {
      return sourceFile.path;
    },);
  /**
   * Current metadata for source files.
   */
  const currentSources = readFileStamps(sourcePaths,);
  if (currentSources === ABSENT_FILE_STAMPS)
    return false;
  if (!fileStampListsMatch({
    currentStamps: currentSources,
    recordedStamps: entry.sourceFiles,
  }))
    return false;

  /**
   * Current destination metadata and content hashes.
   */
  if (!destinationStampListsMatch({ recordedStamps: entry.destinationFiles, }))
    return false;

  return true;
}

/**
 * Registers source and destination paths from a fresh manifest entry.
 *
 * @param entry - Fresh manifest entry.
 *
 * @example
 * ```ts
 * registerFreshEntryPaths(entry);
 * ```
 */
function registerFreshEntryPaths(entry: StalenessEntry,): void {
  /**
   * Source paths to restore into the global tracker.
   */
  const sourcePaths = entry
    .sourceFiles
    .map(function sourcePath(sourceFile,): string {
      return sourceFile.path;
    },);
  addWatchedPaths(sourcePaths,);
  entry.destinationFiles
    .forEach(function registerDestination(destinationFile,): void {
      trackDest(destinationFile.path,);
      setWriteTimestamp({
        filePath: destinationFile.path,
        timestamp: Math.floor(destinationFile.mtimeMs,),
      },);
    },);
}

/**
 * Checks whether a cached manifest entry is fresh and registers its tracked paths.
 *
 * @param manifestPath - Optional custom manifest path.
 *
 * @param key - Manifest key to inspect.
 *
 * @param kind - Expected entry kind.
 *
 * @returns Whether the builder can be skipped.
 *
 * @example
 * ```ts
 * const fresh = await freshStalenessEntryExists({ key, kind: 'single' });
 * ```
 */
export async function freshStalenessEntryExists(
  {
    manifestPath,
    key,
    kind,
  }: StalenessOptions & {
    readonly key: string;
    readonly kind: StalenessEntryKind;
  },
): Promise<boolean> {
  /**
   * Absolute manifest path.
   */
  const resolvedManifestPath = manifestPath === undefined
    ? resolveManifestPath({},)
    : resolveManifestPath({ manifestPath, },);
  /**
   * Persisted entry for this builder.
   */
  const entry = loadManifest(resolvedManifestPath,)
    .entries[key];
  if (entry === undefined)
    return false;
  if (entry.kind !== kind)
    return false;

  /**
   * Whether filesystem metadata still matches the entry.
   */
  const fresh = await entryMetadataMatches(entry,);
  if (!fresh)
    return false;

  registerFreshEntryPaths(entry,);
  return true;
}

/**
 * Builds source metadata for a manifest entry.
 *
 * @param trackedReads - Source file reads captured while the builder ran.
 *
 * @returns Source metadata, or sentinel when a source disappeared.
 *
 * @example
 * ```ts
 * const sourceFiles = await sourceStampsForReads(['./AGENTS.md']);
 * ```
 */
function sourceStampsForReads(
  trackedReads: readonly string[],
): StalenessEntry['sourceFiles'] | typeof ABSENT_FILE_STAMPS {
  return readFileStamps([
    ...configDependencyPaths(),
    ...trackedReads,
  ],);
}

/**
 * Records a fresh manifest entry after a builder computes and reconciles output.
 *
 * @param manifestPath - Optional custom manifest path.
 *
 * @param key - Manifest key to update.
 *
 * @param kind - Entry kind to persist.
 *
 * @param trackedReads - Source file reads captured while the builder ran.
 *
 * @param trackedGlobs - Glob expansions captured while the builder ran.
 *
 * @param destinations - Destinations generated by the builder.
 *
 * @example
 * ```ts
 * await rememberFreshStalenessEntry({ key, kind: 'single', trackedReads, trackedGlobs, destinations });
 * ```
 */
export function rememberFreshStalenessEntry(
  {
    manifestPath,
    key,
    kind,
    trackedReads,
    trackedGlobs,
    destinations,
  }: StalenessOptions & {
    readonly key: string;
    readonly kind: StalenessEntryKind;
    readonly trackedReads: readonly string[];
    readonly trackedGlobs: readonly TrackedGlob[];
    readonly destinations: readonly StalenessDestination[];
  },
): void {
  /**
   * Source file metadata, including the config file as an implicit dependency.
   */
  const sourceFiles = sourceStampsForReads(trackedReads,);
  if (sourceFiles === ABSENT_FILE_STAMPS)
    return;

  /**
   * Destination metadata after reconciliation.
   */
  const destinationFiles = destinationStamps(destinations,);
  if (destinationFiles === ABSENT_FILE_STAMPS)
    return;

  /**
   * Captured glob expansions.
   */
  const sourceGlobs = normalizeGlobStamps(trackedGlobs,);
  /**
   * Entry to persist.
   */
  const entry: StalenessEntry = {
    kind,
    sourceFiles,
    sourceGlobs,
    destinationFiles,
    sourceSetHash: hashSourceSet({
      sourceFiles,
      sourceGlobs,
    },),
    updatedAt: new Date().toISOString(),
  };
  /**
   * Absolute manifest path.
   */
  const resolvedManifestPath = manifestPath === undefined
    ? resolveManifestPath({},)
    : resolveManifestPath({ manifestPath, },);
  /**
   * Mutable manifest object for this path.
   */
  const manifest = loadManifest(resolvedManifestPath,);
  manifest.entries[key] = entry;
  writeManifest({
    manifestPath: resolvedManifestPath,
    manifest,
  },);
}
