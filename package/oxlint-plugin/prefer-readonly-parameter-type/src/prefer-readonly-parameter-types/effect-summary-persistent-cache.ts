/**
 * Content-addressed incremental persistent cache for direct effect summaries.
 *
 * @module
 */

import { randomUUID, } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { MutableEffectSummary, } from './effect-summary-model.ts';
import {
  ENVELOPE_INVALID,
  type PersistentEffectCacheEnvelope,
  type PersistentEffectDependencyState,
  validatePersistentEnvelope,
} from './effect-cache-envelope.ts';
import { maintainPersistentEffectCache, } from './effect-summary-cache-maintenance.ts';
import {
  analyzerDigest,
  contentDigest,
  effectCacheRoot,
  EFFECT_CACHE_SCHEMA,
} from './effect-summary-cache-identity.ts';
import type { EffectProjectSurfaces, } from './effect-project-fingerprint.ts';
import {
  deserializeEffectSummaries,
  serializeEffectSummaries,
} from './effect-summary-serialization.ts';

/**
 * Persistent cache logger.
 */
const l = tagged({ tag: 'effect-summary-persistent-cache', },);

/**
 * Bytes in one kibibyte.
 */
const BYTES_PER_KIBIBYTE = 1_024;

/**
 * Kibibytes in one mebibyte.
 */
const KIBIBYTES_PER_MEBIBYTE = 1_024;

/**
 * Mebibytes accepted for one persistent entry.
 */
const MAX_CACHE_ENTRY_MEBIBYTES = 16;

/**
 * Maximum persistent entry size accepted before JSON decoding.
 */
const MAX_CACHE_ENTRY_BYTES = MAX_CACHE_ENTRY_MEBIBYTES
  * KIBIBYTES_PER_MEBIBYTE
  * BYTES_PER_KIBIBYTE;

/**
 * Sentinel returned when persistent cache cannot prove an exact hit.
 */
export const PERSISTENT_EFFECT_CACHE_MISS: unique symbol = Symbol(
  'persistent effect cache miss',
);

/**
 * Cache address shared by reads and writes.
 *
 * `projectKey` carries the configured project path plus analysis-scope
 * policy; per-project content identity lives in each envelope's dependency
 * snapshot rather than the address, so one changed file relocates nothing.
 */
export type PersistentEffectCacheAddress = {
  readonly projectKey: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly cacheRootOverride?: string;
};

/**
 * Dependency-closure snapshot written into one entry.
 *
 * `resolved` distinguishes an exact transitive closure from the whole-scope
 * fallback used when module references cannot be fully resolved.
 */
export type EffectDependencyClosure = {
  readonly resolved: boolean;
  readonly directDependencies: readonly string[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
};

/**
 * Validated persistent hit: rehydrated summaries plus recorded closure edges.
 */
export type PersistentEffectCacheHit = {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly dependenciesResolved: boolean;
  readonly directDependencies: readonly string[];
};

/**
 * Builds exact cache identity and path for source snapshot.
 *
 * @param address - Project,
 * source,
 * and optional test cache root.
 *
 * @returns cache path and every validated identity component.
 */
function cacheIdentity(
  address: PersistentEffectCacheAddress,
): {
  readonly analyzer: string;
  readonly source: string;
  readonly path: string;
  readonly directory: string;
  readonly root: string;
} {
  /**
   * Analyzer implementation and TypeScript runtime digest.
   */
  const analyzer = analyzerDigest();
  /**
   * Exact source-text digest.
   */
  const source = contentDigest(address.sourceText,);
  /**
   * Project scope identity isolating configurations without content coupling.
   */
  const projectDirectoryName = contentDigest(address.projectKey,);
  /**
   * Source path identity isolating files with equal contents.
   */
  const fileDirectoryName = contentDigest(address.fileName,);
  /**
   * Dependency-local or disposable persistent cache root.
   */
  const root = effectCacheRoot({
    projectKey: address.projectKey,
    ...(address.cacheRootOverride === undefined)
      ? {}
      : { override: address.cacheRootOverride, },
  },);
  /**
   * Content-addressed directory for project scope and source path.
   */
  const directory = join(
    root,
    projectDirectoryName,
    fileDirectoryName,
  );
  return {
    analyzer,
    source,
    directory,
    root,
    path: join(
      directory,
      `${source}-${analyzer}.json`,
    ),
  };
}

/**
 * Reads direct summaries from persistent entry validated against program state.
 *
 * @param address - Project and source identity.
 *
 * @param state - Current whole-scope surfaces and per-source digests.
 *
 * @returns rehydrated summaries with recorded closure edges,
 * or cache-miss sentinel.
 *
 * @example
 * ```ts
 * readPersistentEffectSummaries({ address, state });
 * ```
 */
export function readPersistentEffectSummaries({
  address,
  state,
}: {
  readonly address: PersistentEffectCacheAddress;
  readonly state: PersistentEffectDependencyState;
},): PersistentEffectCacheHit | typeof PERSISTENT_EFFECT_CACHE_MISS {
  /**
   * Current content-addressed cache path.
   */
  const identity = cacheIdentity(address,);
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous Oxlint visitor must finish cache lookup before reporting diagnostics.
  if (!existsSync(identity.path,))
    return PERSISTENT_EFFECT_CACHE_MISS;
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous Oxlint visitor validates cache size before reading. */
    /**
     * Published cache entry metadata checked before allocation and decoding.
     */
    const metadata = statSync(identity.path,);
    /* oxlint-enable no-restricted-syntax/no-sync */
    if (metadata.size > MAX_CACHE_ENTRY_BYTES)
      return PERSISTENT_EFFECT_CACHE_MISS;
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous Oxlint visitor must finish cache lookup before reporting diagnostics. */
    /**
     * Complete cache JSON read after atomic publication.
     */
    const text = readFileSync(
      identity.path,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    if (Buffer.byteLength(text,) > MAX_CACHE_ENTRY_BYTES)
      return PERSISTENT_EFFECT_CACHE_MISS;
    /**
     * Untrusted parsed cache value narrowed by envelope validation.
     */
    const parsed = JSON.parse(text,) as unknown;
    /**
     * Cache envelope matching requested identity and current program state.
     */
    const envelope = validatePersistentEnvelope({
      value: parsed,
      identity: {
        analyzerDigest: identity.analyzer,
        projectKey: address.projectKey,
        fileName: address.fileName,
        sourceDigest: identity.source,
      },
      state,
    },);
    if (envelope === ENVELOPE_INVALID)
      return PERSISTENT_EFFECT_CACHE_MISS;
    return {
      summaries: deserializeEffectSummaries(envelope.payload,),
      dependenciesResolved: envelope.dependenciesResolved,
      directDependencies: envelope.directDependencies,
    };
  }
  catch (error) {
    l.debug(`cache read miss for ${identity.path}: ${String(error,)}`,);
    return PERSISTENT_EFFECT_CACHE_MISS;
  }
}

/**
 * Writes direct summaries atomically to persistent cache.
 *
 * Existing entries are replaced: a write follows a validation miss, so any
 * entry already at this path carries a stale dependency snapshot that must
 * not outlive the rebuild that disproved it.
 *
 * @param address - Project and source identity.
 *
 * @param summaries - Direct summaries for exact source snapshot.
 *
 * @param surfaces - Whole-scope surface digests at creation time.
 *
 * @param closure - Dependency-closure snapshot for exact source.
 *
 * @example
 * ```ts
 * writePersistentEffectSummaries({ address, summaries, surfaces, closure });
 * ```
 */
export function writePersistentEffectSummaries({
  address,
  summaries,
  surfaces,
  closure,
}: {
  readonly address: PersistentEffectCacheAddress;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly surfaces: EffectProjectSurfaces;
  readonly closure: EffectDependencyClosure;
},): void {
  /**
   * Current content-addressed cache path.
   */
  const identity = cacheIdentity(address,);
  /**
   * Cache envelope tied to source,
   * project scope,
   * analyzer,
   * and dependency snapshot identity.
   */
  const envelope: PersistentEffectCacheEnvelope = {
    schema: EFFECT_CACHE_SCHEMA,
    analyzerDigest: identity.analyzer,
    projectKey: address.projectKey,
    fileName: address.fileName,
    sourceDigest: identity.source,
    surfaces,
    dependenciesResolved: closure.resolved,
    directDependencies: closure.directDependencies,
    dependencyDigests: closure.dependencyDigests,
    payload: serializeEffectSummaries(summaries,),
  };
  /**
   * Unique sibling temporary file for atomic rename.
   */
  const temporaryPath = join(
    identity.directory,
    `${process.pid
      .toString()}-${randomUUID()}.tmp`,
  );
  try {
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous Oxlint visitor creates cache directory before atomic write.
    mkdirSync(
      identity.directory,
      { recursive: true, },
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous Oxlint visitor writes data-only cache entry before atomic rename.
    writeFileSync(
      temporaryPath,
      JSON.stringify(envelope,),
      {
        encoding: 'utf8',
        flag: 'wx',
      },
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Atomic rename prevents readers from observing partial JSON.
    renameSync(
      temporaryPath,
      identity.path,
    );
    maintainPersistentEffectCache({
      root: identity.root,
      retainedPath: identity.path,
    },);
  }
  catch (error) {
    l.debug(`cache write skipped for ${identity.path}: ${String(error,)}`,);
    try {
      // oxlint-disable-next-line no-restricted-syntax/no-sync -- Failed atomic write removes only its unique temporary sibling.
      unlinkSync(temporaryPath,);
    }
    catch (cleanupError) {
      l.debug(`cache temporary cleanup skipped for ${temporaryPath}: ${String(cleanupError,)}`,);
    }
  }
}
