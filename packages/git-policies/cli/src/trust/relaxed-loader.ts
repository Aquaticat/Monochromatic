/**
 * Explicit per-identity relaxed metadata-triggered refresh. @module
 */
import {
  executeStoredConfig,
  TrustedConfigError,
} from './config-loader.ts';
import { validateMjs, } from './mjs-validator.ts';
import { captureTrustSource, } from './candidate.ts';
import { createPrivateBuildDirectory, } from './explicit-typescript-trust.ts';
import { prepareMjsRecord, } from './registry-storage.ts';
import { prepareTypeScriptRecord, } from './registry-typescript-storage.ts';
import { buildTypeScriptCandidate, } from './typescript-builder.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustRecord,
  TrustWarning,
} from './types.ts';

/**
 * Executes unchanged stored bundle without live-byte comparison.
 *
 * @param recordDirectory - exact record directory
 *
 * @param record - validated record
 *
 * @returns loaded stored config
 */
async function executeExisting({
  recordDirectory,
  record,
}: Readonly<{
  recordDirectory: string;
  record: TrustRecord;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Runtime-authoritative stored executable.
   */
  const validated = await executeStoredConfig(`${recordDirectory}/${record.executableSnapshotFile}`,);
  return {
    validated,
    record,
  };
}

/**
 * Refreshes MJS snapshot only when source metadata changed.
 *
 * @param registryRoot - complete registry root
 *
 * @param recordDirectory - exact record directory
 *
 * @param candidate - exact live candidate
 *
 * @param record - validated existing record
 *
 * @param recordedAt - refresh timestamp
 *
 * @returns old or refreshed loaded config
 */
async function loadRelaxedMjs({
  registryRoot,
  recordDirectory,
  candidate,
  record,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  recordDirectory: string;
  candidate: TrustCandidate;
  record: TrustRecord;
  recordedAt: string;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Sole MJS source metadata.
   */
  const [source,] = record.sources;
  if ((source === undefined) || (record.sources
    .length
    !== 1))
    throw new Error('Relaxed MJS record has invalid source metadata.',);
  if ((source.size === candidate.size) && (source.mtimeNanoseconds === candidate.mtimeNanoseconds))
    return await executeExisting({
      recordDirectory,
      record,
    },);
  validateMjs({
    bytes: candidate.bytes,
    sourceName: candidate.discovered
      .configPath,
  },);
  /**
   * Private replacement validated before atomic commit.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
    recursiveChildren: record.recursiveChildren,
    authorizingRoots: record.authorizingRoots,
  },);
  /**
   * Replacement config validation result.
   */
  const validated = await executeStoredConfig(prepared.executablePath,);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}

/**
 * Reports whether tracked TypeScript metadata remains unchanged.
 *
 * @param candidate - exact current entry
 *
 * @param record - existing TypeScript record
 *
 * @returns whether every tracked size and mtime matches
 */
async function typeScriptMetadataUnchanged({
  candidate,
  record,
}: Readonly<{
  candidate: TrustCandidate;
  record: TrustRecord;
}>,): Promise<boolean> {
  /**
   * Every live tracked metadata value.
   */
  const comparisons = await Promise.all(record.sources
    .map(async function metadataMatches(source,) {
    /**
     * Current source metadata.
     */
    const current = source.canonicalPath
      === candidate.discovered
      .configPath
      ? candidate
      : await captureTrustSource(source.canonicalPath,);
    return (source.size === current.size) && (source.mtimeNanoseconds === current.mtimeNanoseconds);
  },),);
  return comparisons.every(function matches(value,) {
    return value;
  },);
}

/**
 * Refreshes TypeScript bundle only when tracked metadata changed.
 *
 * @param registryRoot - complete registry root
 *
 * @param recordDirectory - exact record directory
 *
 * @param candidate - exact live entry candidate
 *
 * @param record - validated existing record
 *
 * @param recordedAt - refresh timestamp
 *
 * @param warn - package invalidation warning sink
 *
 * @returns old or rebuilt loaded config
 */
async function loadRelaxedTypeScript({
  registryRoot,
  recordDirectory,
  candidate,
  record,
  recordedAt,
  warn,
}: {
  readonly registryRoot: string;
  readonly recordDirectory: string;
  readonly candidate: TrustCandidate;
  readonly record: TrustRecord;
  readonly recordedAt: string;
  readonly warn: (warning: TrustWarning,) => void;
},): Promise<LoadedTrustedConfig> {
  if (await typeScriptMetadataUnchanged({
    candidate,
    record,
  },))
    return await executeExisting({
      recordDirectory,
      record,
    },);
  /**
   * Disposable private tsdown output directory.
   */
  await using buildDirectory = await createPrivateBuildDirectory();
  /**
   * Fresh automatic private rebuild.
   */
  const rebuilt = await buildTypeScriptCandidate({
    discovered: candidate.discovered,
    buildDirectory: buildDirectory.path,
  },);
  if ((rebuilt.entry
    .identity
    .filesystemId
    !== candidate.identity
    .filesystemId)
    || (rebuilt.entry
      .identity
      .canonicalConfigPath
      !== candidate.identity
      .canonicalConfigPath)) {
    throw new TrustedConfigError(
      'config-changed',
      'TypeScript config filesystem identity changed during relaxed rebuild.',
    );
  }
  rebuilt.barePackageImports
    .forEach(function warnPackage(specifier,) {
    warn({
      code: 'typescript-package-import-not-invalidated',
      message: `Relaxed TypeScript rebuild bundles bare package outside automatic invalidation: ${specifier}`,
    },);
  },);
  /**
   * Private replacement validated before atomic commit.
   */
  await using prepared = await prepareTypeScriptRecord({
    registryRoot,
    candidate: rebuilt,
    recordedAt,
    recursiveChildren: record.recursiveChildren,
    authorizingRoots: record.authorizingRoots,
  },);
  /**
   * Replacement config validation result.
   */
  const validated = await executeStoredConfig(prepared.executablePath,);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}

/**
 * Loads explicitly relaxed exact identity by metadata signal.
 *
 * @param registryRoot - complete registry root
 *
 * @param recordDirectory - exact record directory
 *
 * @param candidate - exact live entry candidate
 *
 * @param record - validated existing record
 *
 * @param recordedAt - refresh timestamp
 *
 * @param warn - prominent warning sink
 *
 * @returns old or refreshed loaded config
 *
 * @throws {@link TrustedConfigError} or build error when refresh fails
 *
 * @example
 * ```ts
 * await loadRelaxedConfig({ registryRoot, recordDirectory, candidate, record, recordedAt, warn });
 * ```
 */
export async function loadRelaxedConfig({
  registryRoot,
  recordDirectory,
  candidate,
  record,
  recordedAt,
  warn,
}: {
  readonly registryRoot: string;
  readonly recordDirectory: string;
  readonly candidate: TrustCandidate;
  readonly record: TrustRecord;
  readonly recordedAt: string;
  readonly warn: (warning: TrustWarning,) => void;
},): Promise<LoadedTrustedConfig> {
  return record.format === 'mjs'
    ? await loadRelaxedMjs({
      registryRoot,
      recordDirectory,
      candidate,
      record,
      recordedAt,
    },)
    : await loadRelaxedTypeScript({
      registryRoot,
      recordDirectory,
      candidate,
      record,
      recordedAt,
      warn,
    },);
}
