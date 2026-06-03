import {
  basename,
  resolve,
} from 'node:path';
import { configDependencyPaths, } from '../context.ts';
import {
  addWatchedPaths,
  setWriteTimestamp,
  trackDest,
} from '../tracker.ts';
import {
  loadManifest,
  resolveManifestPath,
} from './staleness-manifest.ts';
import {
  fileStampListsMatch,
  globStampsMatch,
  readFileStamps,
} from './staleness-stamps.ts';
import {
  selectDestinations,
  selectSources,
  uniqueGlobStamps,
  uniqueStampsByPath,
} from './staleness-aggregate.ts';
import {
  MISSING_STAMPS,
  type DestinationStamp,
  type FileStamp,
  type StalenessEntry,
  type StalenessOptions,
} from './staleness-types.ts';

/**
 * File name that marks direct file-enforcer config execution.
 */
const CONFIG_FILE_NAME = 'file-enforcer.config.ts';

/**
 * Returns whether current process is directly executing a file-enforcer config.
 *
 * @returns Whether `process.argv[1]` is `file-enforcer.config.ts`.
 *
 * @example
 * ```ts
 * const direct = isDirectFileEnforcerConfigRun();
 * ```
 */
function isDirectFileEnforcerConfigRun(): boolean {
  /**
   * Script entry point from process arguments.
   */
  const [, entryPoint,] = process.argv;
  if (entryPoint === undefined)
    return false;

  return basename(entryPoint,) === CONFIG_FILE_NAME;
}

/**
 * Exits a directly executed config before consumer builders run when the manifest is fresh.
 *
 * @example
 * ```ts
 * await exitIfFreshDirectConfigRun();
 * ```
 */
export async function exitIfFreshDirectConfigRun(): Promise<void> {
  if (!isDirectFileEnforcerConfigRun())
    return;

  /**
   * Absolute entry point, used to avoid exiting when the package is imported by a nested helper.
   */
  const [, entryPoint,] = process.argv;
  if (entryPoint === undefined)
    return;
  if (resolve(entryPoint,) !== configDependencyPaths()[0])
    return;

  if (!await freshStalenessManifest({}))
    return;

  // oxlint-disable-next-line unicorn/no-process-exit -- required to stop direct config execution before consumer builders run on a fresh staleness manifest.
  process.exit(0,);
}

/**
 * Returns whether a manifest entry belongs to the active config file.
 *
 * @param entry - Manifest entry to inspect.
 *
 * @param configPaths - Active config paths that every matching entry must include.
 *
 * @returns Whether the entry was recorded for the active config.
 *
 * @example
 * ```ts
 * const belongs = entryBelongsToActiveConfig({ entry, configPaths: new Set(['/repo/file-enforcer.config.ts']) });
 * ```
 */
function entryBelongsToActiveConfig(
  {
    entry,
    configPaths,
  }: {
    readonly entry: StalenessEntry;
    readonly configPaths: ReadonlySet<string>;
  },
): boolean {
  return entry
    .sourceFiles
    .some(function sourceIsActiveConfig(sourceFile,): boolean {
      return configPaths.has(sourceFile.path,);
    },);
}

/**
 * Registers source and destination paths after a fresh whole-manifest check.
 *
 * @param sourceFiles - Fresh source stamps.
 *
 * @param destinationFiles - Fresh destination stamps.
 *
 * @example
 * ```ts
 * registerFreshManifestPaths({ sourceFiles, destinationFiles });
 * ```
 */
function registerFreshManifestPaths(
  {
    sourceFiles,
    destinationFiles,
  }: {
    readonly sourceFiles: readonly FileStamp[];
    readonly destinationFiles: readonly DestinationStamp[];
  },
): void {
  addWatchedPaths(sourceFiles.map(function sourcePath(sourceFile,): string {
    return sourceFile.path;
  },),);
  destinationFiles.forEach(function registerDestination(destinationFile,): void {
    trackDest(destinationFile.path,);
    setWriteTimestamp({
      filePath: destinationFile.path,
      timestamp: Math.floor(destinationFile.mtimeMs,),
    },);
  },);
}

/**
 * Checks whether every persisted manifest entry is fresh.
 * Used by the CLI to skip importing a no-op config entirely on one-shot runs.
 *
 * @param manifestPath - Optional custom manifest path.
 *
 * @returns Whether all persisted entries are fresh.
 *
 * @example
 * ```ts
 * const fresh = await freshStalenessManifest({});
 * ```
 */
export async function freshStalenessManifest(
  {
    manifestPath,
  }: StalenessOptions,
): Promise<boolean> {
  /**
   * Absolute manifest path selected the same way writer calls select it.
   */
  const resolvedManifestPath = manifestPath === undefined
    ? resolveManifestPath({},)
    : resolveManifestPath({ manifestPath, },);
  /**
   * Manifest loaded from the selected path.
   */
  const manifest = loadManifest(resolvedManifestPath,);
  /**
   * Active config dependency paths for this CLI invocation.
   */
  const configPaths = new Set(configDependencyPaths(),);
  /**
   * Persisted entries for the active config run.
   */
  const entries = Object.values(manifest.entries,)
    .filter(function keepActiveConfigEntry(entry,): boolean {
      return entryBelongsToActiveConfig({
        entry,
        configPaths,
      },);
    },);
  if (entries.length === 0)
    return false;

  /**
   * Unique source stamps across every active entry.
   */
  const sourceFiles = uniqueStampsByPath({
    entries,
    selectStamps: selectSources,
  },);
  /**
   * Unique destination stamps across every active entry.
   */
  const destinationFiles = uniqueStampsByPath({
    entries,
    selectStamps: selectDestinations,
  },);
  /**
   * Unique glob path-set stamps across every active entry.
   */
  const sourceGlobs = uniqueGlobStamps(entries,);
  /**
   * Current source metadata.
   */
  const currentSources = readFileStamps(sourceFiles.map(function sourcePath(sourceFile,): string {
    return sourceFile.path;
  },),);
  if (currentSources === MISSING_STAMPS)
    return false;
  if (!fileStampListsMatch({
    currentStamps: currentSources,
    recordedStamps: sourceFiles,
  }))
    return false;

  /**
   * Current destination metadata.
   */
  const currentDestinations = readFileStamps(destinationFiles.map(function destinationPath(destinationFile,): string {
    return destinationFile.path;
  },),);
  if (currentDestinations === MISSING_STAMPS)
    return false;
  if (!fileStampListsMatch({
    currentStamps: currentDestinations,
    recordedStamps: destinationFiles,
  }))
    return false;
  if (!await globStampsMatch(sourceGlobs,))
    return false;

  registerFreshManifestPaths({
    sourceFiles,
    destinationFiles,
  },);
  return true;
}
