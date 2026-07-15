/**
 * Content-addressed persistent cache for direct effect summaries.
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
import { maintainPersistentEffectCache, } from './effect-summary-cache-maintenance.ts';
import { isSerializedEffectSummaries, } from './effect-summary-cache-validation.ts';
import {
  analyzerDigest,
  contentDigest,
  effectCacheRoot,
  EFFECT_CACHE_SCHEMA,
} from './effect-summary-cache-identity.ts';
import {
  deserializeEffectSummaries,
  serializeEffectSummaries,
  type SerializedEffectSummaries,
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
 */
type PersistentEffectCacheAddress = {
  readonly projectKey: string;
  readonly projectDigest: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly cacheRootOverride?: string;
};

/**
 * Validated JSON cache envelope.
 */
type PersistentEffectCacheEnvelope = {
  readonly schema: number;
  readonly analyzerDigest: string;
  readonly projectKey: string;
  readonly projectDigest: string;
  readonly fileName: string;
  readonly sourceDigest: string;
  readonly payload: SerializedEffectSummaries;
};

/**
 * Tests whether unknown JSON value is property-bearing record.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether value can be inspected by string key.
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

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
   * Project directory identity isolating configurations.
   */
  const projectDirectoryName = contentDigest(
    `${address.projectKey}\0${address.projectDigest}`,
  );
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
   * Immutable content-addressed directory for project and source.
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
 * Validates parsed cache envelope against requested source identity.
 *
 * @param value - Parsed JSON value.
 *
 * @param address - Requested project and source identity.
 *
 * @param analyzer - Current analyzer digest.
 *
 * @param source - Current source digest.
 *
 * @returns validated envelope or miss sentinel.
 */
function validateEnvelope({
  value,
  address,
  analyzer,
  source,
}: {
  readonly value: unknown;
  readonly address: PersistentEffectCacheAddress;
  readonly analyzer: string;
  readonly source: string;
}): PersistentEffectCacheEnvelope | typeof PERSISTENT_EFFECT_CACHE_MISS {
  if ((!isRecord(value,))
    || (value.schema !== EFFECT_CACHE_SCHEMA)
    || (value.analyzerDigest !== analyzer)
    || (value.projectKey !== address.projectKey)
    || (value.projectDigest !== address.projectDigest)
    || (value.fileName !== address.fileName)
    || (value.sourceDigest !== source)
    || (!isSerializedEffectSummaries(value.payload,)))
    return PERSISTENT_EFFECT_CACHE_MISS;
  return {
    schema: EFFECT_CACHE_SCHEMA,
    analyzerDigest: analyzer,
    projectKey: address.projectKey,
    projectDigest: address.projectDigest,
    fileName: address.fileName,
    sourceDigest: source,
    payload: value.payload,
  };
}

/**
 * Reads direct summaries from exact persistent cache entry.
 *
 * @param address - Project and source identity.
 *
 * @returns rehydrated summaries or cache-miss sentinel.
 *
 * @example
 * ```ts
 * readPersistentEffectSummaries({ projectKey, fileName, sourceText });
 * ```
 */
export function readPersistentEffectSummaries(
  address: PersistentEffectCacheAddress,
): ReadonlyMap<string, MutableEffectSummary> | typeof PERSISTENT_EFFECT_CACHE_MISS {
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
     * Cache envelope matching exact requested identities.
     */
    const envelope = validateEnvelope({
      value: parsed,
      address,
      analyzer: identity.analyzer,
      source: identity.source,
    },);
    if (envelope === PERSISTENT_EFFECT_CACHE_MISS)
      return PERSISTENT_EFFECT_CACHE_MISS;
    return deserializeEffectSummaries(envelope.payload,);
  }
  catch (error) {
    l.debug(`cache read miss for ${identity.path}: ${String(error,)}`,);
    return PERSISTENT_EFFECT_CACHE_MISS;
  }
}

/**
 * Writes direct summaries atomically to persistent cache.
 *
 * @param address - Project and source identity.
 *
 * @param summaries - Direct summaries for exact source snapshot.
 *
 * @example
 * ```ts
 * writePersistentEffectSummaries({ address, summaries });
 * ```
 */
export function writePersistentEffectSummaries({
  address,
  summaries,
}: {
  readonly address: PersistentEffectCacheAddress;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
},): void {
  /**
   * Current content-addressed cache path.
   */
  const identity = cacheIdentity(address,);
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous Oxlint visitor completes cache persistence before process exit.
  if (existsSync(identity.path,))
    return;
  /**
   * JSON-safe direct summaries.
   */
  const payload = serializeEffectSummaries(summaries,);
  /**
   * Cache envelope tied to source,
   * project,
   * analyzer,
   * and payload identity.
   */
  const envelope: PersistentEffectCacheEnvelope = {
    schema: EFFECT_CACHE_SCHEMA,
    analyzerDigest: identity.analyzer,
    projectKey: address.projectKey,
    projectDigest: address.projectDigest,
    fileName: address.fileName,
    sourceDigest: identity.source,
    payload,
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
