import decircular from 'decircular';
import superjson from 'superjson';
import type { Promisable, } from 'type-fest';
import { hasCycle, } from './any.hasCycle.ts';
import { notUndefinedOrThrow, } from './error.throw.ts';
import { mapIterableAsync, } from './iterable.map.ts';
import { hashString, } from './string.hash.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

/** Serialize unknown data to deterministic string form. */
export type Serializer = (toSerialize: unknown,) => string;

/**
 * Deserialize string data into typed value.
 * @typeParam T - target value type
 */
export type Deserializer = <const T = unknown,>(toDeserialize: string,) => T;

/** Internal result record for Store.get aggregation */
type StoreValueResult = {
  /** Serialized value returned by a storage, or undefined if missing */
  value: string | undefined;
  /** Storage priority (higher value means higher tier) */
  priority: number;
  /** Storage instance that produced the value */
  storage: Storage;
};

/**
 * Pick the majority bucket by size from buckets map.
 * @param buckets - map from serialized value to result records
 * @param totalCount - total number of results for majority threshold
 * @returns Majority presence and the candidate serialized value
 */
function pickMajority({
  buckets,
  totalCount,
}: {
  buckets: Map<string | undefined, StoreValueResult[]>;
  totalCount: number;
},): { hasMajority: boolean; value?: string | undefined; } {
  /** Leader candidate and its bucket after sorting by descending bucket size. */
  const [leaderKey, leaderBucket,] = Array
    .from(buckets.entries(),)
    .toSorted(function byDescCount(
      [, aArray,],
      [, bArray,],
    ) {
      return bArray.length - aArray.length;
    },)
    .at(0,) ?? [undefined, [] as StoreValueResult[],];

  return {
    hasMajority: leaderBucket.length > Math.floor(totalCount / 2,),
    value: leaderKey,
  };
}

/**
 * Compute canonical serialized value from highest tier only.
 * Throws when there is no majority within the highest tier.
 * @param groupedHighestPriorityResults - buckets of highest tier results by value
 * @param highestPriorityResults - array of highest priority tier results
 * @param key - key for error context
 * @returns Canonical serialized value (can be undefined)
 * @throws Error when no majority in highest tier
 */
function computeFromHighestTier({
  groupedHighestPriorityResults,
  highestPriorityResults,
  key,
}: {
  groupedHighestPriorityResults: Map<string | undefined, StoreValueResult[]>;
  highestPriorityResults: readonly StoreValueResult[];
  key: string;
},): string | undefined {
  /** Majority result within the highest priority tier only. */
  const highestTier = pickMajority({
    buckets: groupedHighestPriorityResults,
    totalCount: highestPriorityResults.length,
  },);
  if (!highestTier.hasMajority) {
    throw new Error(
      `Store.get consensus failure for key "${key}" - no majority in highest tier`,
    );
  }
  return highestTier.value;
}

/**
 * Compute canonical serialized value across all tiers with fallback to highest tier.
 * @param results - all tier results
 * @param groupedHighestPriorityResults - buckets for highest tier only
 * @param highestPriorityResults - highest tier array
 * @param key - key for error context
 * @returns Canonical serialized value (can be undefined)
 */
function computeCanonicalSerialized({
  results,
  groupedHighestPriorityResults,
  highestPriorityResults,
  key,
}: {
  results: readonly StoreValueResult[];
  groupedHighestPriorityResults: Map<string | undefined, StoreValueResult[]>;
  highestPriorityResults: readonly StoreValueResult[];
  key: string;
},): string | undefined {
  /** Buckets across all tiers, grouped by serialized value. */
  const groupedAllResults = Map.groupBy(results, function byAll({ value, },) {
    return value;
  },);
  /** Overall majority across all tiers (may fall back to highest tier on tie). */
  const overall = pickMajority({
    buckets: groupedAllResults,
    totalCount: results.length,
  },);
  return overall.hasMajority
    ? overall.value
    : computeFromHighestTier({
      groupedHighestPriorityResults,
      highestPriorityResults,
      key,
    },);
}

/**
 * Heal storages to the canonical serialized value by deleting or setting mismatches.
 * @param results - all storage results
 * @param canonicalSerialized - canonical serialized value (or undefined)
 * @param key - key to heal
 */
async function healStorages({
  results,
  canonicalSerialized,
  key,
}: {
  results: readonly StoreValueResult[];
  canonicalSerialized: string | undefined;
  key: string;
},): Promise<void> {
  await mapIterableAsync(async function heal(result: StoreValueResult,) {
    const { value, storage, } = result;

    if (canonicalSerialized === undefined) {
      if (value !== undefined)
        await storage.delete(key,);
      return;
    }

    if (value !== canonicalSerialized)
      await storage.set(key, canonicalSerialized,);
  }, results,);
}

/**
 * Arguments for {@link Store}.
 */
export type StoreArguments = {
  /** Serializer for persisted values. Defaults to `superjson.stringify`. */
  serializer?: Serializer;
  /** Deserializer for loaded values. Defaults to `superjson.parse`. */
  deserializer?: Deserializer;
  /** Logger implementation. Defaults to {@link consoleLogger}. */
  l?: Logger;
  /** Max characters to include in logs when previewing values. Defaults to 100. */
  logLimit?: number;
  /**
   * When true, cyclic graphs are decycled and persisted lossy instead of throwing.
   * Defaults to true.
   */
  lossyForCircular?: boolean;
  /**
   * Ordered storage backends with optional priorities for consensus.
   * If omitted, a platform-specific default builder may be used; otherwise a single in-memory Map is used.
   */
  storages?: [Storage, ...Storage[],];
  /** Unique identifier used for default paths or namespacing. Defaults to random UUID. */
  storeId?: string;
};

type DefaultStoragesBuilder = (args: {
  storeId: string;
  l: Logger;
},) => Promise<[Storage, ...Storage[],]>;

/**
 * Multi-backend key-value store with consensus and self-healing.
 *
 * Persists serialized values across one or more {@link Storage} backends.
 * When reading, computes a canonical value via majority vote:
 * - Majority across all tiers wins
 * - On tie, majority in highest priority tier wins
 * - If still tied, throws an error
 *
 * After determining the canonical value, heals all backends to match it.
 */
export class Store {
  /** Serializer used when persisting values. */
  public readonly serializer: Serializer;
  /** Deserializer used when loading values. */
  public readonly deserializer: Deserializer;

  /** Logger used for diagnostics. */
  public readonly l: Logger;

  /** Character limit for value previews in logs. */
  public readonly logLimit: number;

  /** Whether to accept lossy serialization of cyclic graphs. */
  public readonly lossyForCircular: boolean;

  /** Ordered backends used by this store. */
  public readonly storages: [Storage, ...Storage[],];

  /** Unique identifier for this store instance. */
  public readonly storeId: string;

  /** Platform-provided default storages builder (configured by platform entry). */
  private static defaultStorageBuilder?: DefaultStoragesBuilder;

  /**
   * Configure a platform-specific default storages builder.
   * Call this at module load from a platform entry file.
   */
  public static configureDefaultStorageBuilder(
    builder: DefaultStoragesBuilder,
  ): void {
    Store.defaultStorageBuilder = builder;
  }

  /**
   * Create a store.
   * @param storeArguments - configuration
   */
  constructor(
    {
      serializer,
      deserializer,
      l,
      logLimit,
      lossyForCircular,
      storages,
      storeId,
    }: StoreArguments = {},
  ) {
    this.storeId = storeId ?? getRandomId();
    this.serializer = serializer ?? superjson.stringify;
    this.deserializer = deserializer ?? superjson.parse;
    this.l = l ?? consoleLogger;
    this.logLimit = logLimit ?? 100;
    this.lossyForCircular = lossyForCircular ?? true;
    // Fallback to in-memory tier if none provided and no platform builder used
    this.storages = storages ?? ([new Map<string, string>() as unknown as Storage,] as [
      Storage,
      ...Storage[],
    ]);
  }

  /**
   * Asynchronous constructor that prepares default backends when none are provided.
   * Uses a platform-configured builder if present; otherwise falls back to an in-memory Map.
   * @param storeArguments - configuration
   * @returns Initialized {@link Store}
   */
  static async asyncConstructor(
    storeArguments: StoreArguments = {},
  ): Promise<Store> {
    const { storages, l, storeId, } = storeArguments;
    (l ?? consoleLogger).trace('asyncConstructor',);
    const myStoreId = storeId ?? getRandomId();

    const myStorages = storages
      ?? (Store.defaultStorageBuilder
        ? await Store.defaultStorageBuilder({
          storeId: myStoreId,
          l: l ?? consoleLogger,
        },)
        : ([new Map<string, string>() as unknown as Storage,] as [
          Storage,
          ...Storage[],
        ]));

    const store = new Store({
      ...storeArguments,
      storeId: myStoreId,
      storages: myStorages,
    },);
    return store;
  }

  /**
   * Parse the overloaded arguments of {@link Store.set}.
   * @param argument1 - either key string or object with `{ value, key? }`
   * @param argument2 - value when key string form is used
   * @returns value/key pair
   */
  private parseSetArguments(
    argument1: string | { value: unknown; key?: string; },
    argument2?: unknown,
  ): { value: unknown; key?: string; } {
    this.l.trace('parseSetArguments',);
    return (function parseArguments(
      a1,
      a2,
    ): { value: unknown; key?: string; } {
      if (a2)
        return { key: a1 as string, value: a2, };
      return a1 as { value: unknown; key?: string; };
    })(argument1, argument2,);
  }

  /**
   * Serialize a value for storage, handling cyclic graphs based on configuration.
   * - If cyclic and {@link Store.lossyForCircular} is false, throws TypeError.
   * - If cyclic and {@link Store.lossyForCircular} is true, decycles and logs a warning.
   * @param value - input data to serialize
   * @returns serialized string
   * @throws TypeError when cyclic and lossyForCircular is false
   */
  private serializeValueForStorage(value: unknown,): string {
    this.l.trace('serializeValueForStorage',);
    const { l, serializer, logLimit, lossyForCircular, } = this;
    if (hasCycle(value,)) {
      const decycled = decircular(value as object,);
      const serialized = serializer(decycled,);
      if (!lossyForCircular) {
        throw new TypeError(
          `toStore ${
            serialized.slice(0, logLimit,)
          } cannot be stored perfectly because it has cycles.`,
        );
      }
      l.warn(
        `toStore ${
          serialized.slice(0, logLimit,)
        } cannot be stored perfectly because it has cycles. A version with cycle removed will be stored.`,
      );
      return serialized;
    }
    return serializer(value,);
  }

  /**
   * Persist a serialized value across all configured storages.
   * @param key - storage key
   * @param serialized - serialized content to save
   */
  private async setAcrossStorages(
    key: string,
    serialized: string,
  ): Promise<void> {
    this.l.trace('setAcrossStorages',);
    await mapIterableAsync(async function setStorage(storage: Storage,) {
      return await storage.set(key, serialized,);
    }, this.storages,);
  }

  public async set(key: string, value: unknown,): Promise<Store>;
  public async set(
    argument1: string | { value: unknown; key?: string; },
    argument2?: unknown,
  ): Promise<Store>;
  /**
   * Persist a value using either an object argument or key/value pair.
   *
   * - When `key` is omitted, uses a content-derived key computed from the serialized value.
   * - When value contains cycles:
   *   - If {@link Store.lossyForCircular} is true, persists a decycled representation and logs a warning.
   *   - Otherwise, throws a TypeError to avoid lossy persistence.
   *
   * @param argument1 - either storage key or object with `{ value, key? }`
   * @param argument2 - value when using the key/value form
   * @returns Store instance for chaining
   */
  public async set(
    argument1: string | { value: unknown; key?: string; },
    argument2?: unknown,
  ): Promise<Store> {
    const { l, } = this;
    l.trace('set',);
    const { value, key, } = this.parseSetArguments(argument1, argument2,);
    const serialized = this.serializeValueForStorage(value,);
    const myKey = key ?? (await hashString(serialized,));
    await this.setAcrossStorages(myKey, serialized,);
    return this;
  }

  /**
   * Read value by key using consensus and heal storages to canonical result.
   * @param key - lookup key
   * @returns Deserialized value or undefined
   * @example
   * ```ts
   * const store = await Store.asyncConstructor();
   * await store.set('k', { x: 1 });
   * const value = await store.get<{ x: number }>('k');
   * // value => { x: 1 }
   * ```
   */
  public async get<const T = unknown,>(key: string,): Promise<T | undefined> {
    this.l.trace('get',);
    /** Raw results from all storages including serialized value and priority tier. */
    const results = (await mapIterableAsync(
      async function getKeyAndPriority(storage: Storage,) {
        return {
          value: await storage.get(key,),
          priority: storage.priority ?? 0,
          storage,
        };
      },
      this.storages,
    )) as [StoreValueResult, ...StoreValueResult[],];

    /** Results grouped by priority for tiered consensus evaluation. */
    const grouped = Map.groupBy(results, function by({ priority, },) {
      return priority;
    },) as Map<number, [StoreValueResult, ...StoreValueResult[],]>;

    /** Array of tier buckets ordered by ascending priority (last = highest). */
    const array = Array
      .from(grouped.entries(),)
      .toSorted(function by([aPriority,], [bPriority,],) {
        return aPriority - bPriority;
      },)
      .map(function pure([, resultsByPriority,],) {
        return resultsByPriority;
      },);

    /** Results at the highest priority tier. */
    const highestPriorityResults = notUndefinedOrThrow(array.at(-1,),);

    // Do the highest priority results agree with each other?
    /** Buckets by serialized value within the highest tier to detect majority. */
    const groupedHighestPriorityResults: Map<
      string | undefined,
      StoreValueResult[]
    > = Map.groupBy(highestPriorityResults, function by({ value, },) {
      return value;
    },);

    /** Canonical serialized value chosen by consensus. */
    const canonicalSerialized = computeCanonicalSerialized({
      results,
      groupedHighestPriorityResults,
      highestPriorityResults,
      key,
    },);

    await healStorages({
      results,
      canonicalSerialized,
      key,
    },);

    // Return deserialized canonical value
    return canonicalSerialized === undefined
      ? undefined
      : this.deserializer<T>(canonicalSerialized,);
  }
}
