/**
 TypeScript fork of [`quick-lru`](https://github.com/sindresorhus/quick-lru) by
 Sindre Sorhus (MIT): a dual-cache Least Recently Used map with lazy `maxAge`
 expiry, eviction notifications, `resize`, and `evict`.
 
 Derived from `quick-lru` 7.3.0; see `LICENSES/MIT.txt` and this package's
 README for the full attribution. Cache semantics match upstream exactly,
 including its dual-cache size variance and coercion quirks. The only
 API-shape deviations are lint-mandated: the cache is a factory-built object
 instead of a `Map` subclass instance, `set` takes a destructured options
 object instead of three positional parameters, and `forEach` takes one
 destructured options object.
 
 @example
 ```ts
 import { createQuickLru, } from '\@monochromatic-dev/module-quick-lru-fork';
 
 const lru = createQuickLru<string, string>({ maxSize: 1000, });
 lru.set({
   key: '🦄',
   value: '🌈',
 },);
 lru.get('🦄',); // => '🌈'
 ```
 
 @packageDocumentation
 */

import {
  resolveQuickLruOptions,
  type QuickLruOptions,
  validateMaxSize,
} from './quick-lru-options.ts';

//region Types

/**
 One stored cache item: its value and optional absolute expiry timestamp.
 
 Mirrors upstream `quick-lru`'s internal `{value, expiry}` record, which is
 observable through the `__oldCache` test hook. An item that never expires
 carries no `expiry` property at all; upstream carries `expiry: undefined`,
 and every read path treats the two shapes identically.
 
 @typeParam Value - cache value type
 
 @example
 ```ts
 const item: QuickLruItem<number> = {
   value: 7,
   expiry: 1_700_000_000_000,
 };
 ```
 */
export type QuickLruItem<Value> = {
  /**
   Stored value, returned while the item is live.
   */
  readonly value: Value;
  /**
   `Date.now()` reading after which the item counts as expired, absent for
   items that never expire.
   */
  readonly expiry?: number;
};

/**
 Destructured call shape of {@link QuickLru}'s `set`.
 
 Upstream's `set(key, value, options)` positional form is banned by
 repository lint, so the key, value, and per-item lifetime arrive as one
 options object.
 
 @typeParam Key - cache key type
 
 @typeParam Value - cache value type
 
 @example
 ```ts
 const entry: QuickLruSetOptions<string, number> = {
   key: 'a',
   value: 1,
   maxAge: 60_000,
 };
 ```
 */
export type QuickLruSetOptions<Key, Value> = {
  /**
   Key to store the value under.
   */
  readonly key: Key;
  /**
   Value to store.
   */
  readonly value: Value;
  /**
   Milliseconds this item may live, overriding the cache's global `maxAge`.
   Absent means the global bound applies.
   */
  readonly maxAge?: number;
};

/**
 Visitor called per entry by {@link QuickLru}'s `forEach`.
 
 The positional `(value, key, cache)` signature is dictated by `Map`
 compatibility, which upstream `quick-lru` preserves.
 
 @typeParam Key - cache key type
 
 @typeParam Value - cache value type
 */
export type QuickLruVisitor<Key, Value> = (
  value: Value,
  key: Key,
  cache: QuickLru<Key, Value>,
) => void;

/**
 Destructured call shape of {@link QuickLru}'s `forEach`.
 
 Upstream's `forEach(callbackFunction, thisArgument)` positional form is
 banned by repository lint, so both arrive in one options object.
 
 @typeParam Key - cache key type
 
 @typeParam Value - cache value type
 
 @example
 ```ts
 lru.forEach({
   callback: function logEntry(value: string, key: string): void {
     console.log(key, value);
   },
 },);
 ```
 */
export type QuickLruForEachOptions<Key, Value> = {
  /**
   Visitor run per live entry, oldest entry first.
   */
  readonly callback: QuickLruVisitor<Key, Value>;
  /**
   `this` value the visitor is called with. Defaults to the cache itself,
   matching upstream `quick-lru`.
   */
  readonly thisArgument?: unknown;
};

/**
 A Least Recently Used cache over upstream `quick-lru`'s dual-cache
 algorithm.
 
 Upstream `quick-lru` returns a `Map` subclass instance; repository lint
 bans classes, so this fork returns a factory-built object with the same
 members instead. Every member here mirrors one upstream member, and the
 fuzz sidecar's differential oracle checks that parity against upstream
 `quick-lru` 7.3.0 directly.
 
 @typeParam Key - cache key type
 
 @typeParam Value - cache value type
 
 @example
 ```ts
 import { createQuickLru, } from '\@monochromatic-dev/module-quick-lru-fork';
 
 const lru: QuickLru<string, number> = createQuickLru({ maxSize: 2, },);
 lru.set({ key: 'a', value: 1, },);
 lru.get('a',); // => 1
 ```
 */
export type QuickLru<Key, Value> = {
  /**
   Stores one value under one key, refreshing its lifetime. Returns the
   cache, so calls chain.
   
   @param options - Key, value, and optional per-item lifetime.
   
   @returns The cache itself.
   */
  readonly set: (options: QuickLruSetOptions<Key, Value>,) => QuickLru<Key, Value>;
  /**
   Reads one value and marks it most recently used.
   
   @param key - Key to read.
   
   @returns Stored value, or `undefined` when the key is absent or its item
   expired during this read.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `get(key): ValueType | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  readonly get: (key: Key,) => Value | undefined;
  /**
   Checks one key without marking it recently used; expired items are
   removed during the check.
   
   @param key - Key to check.
   
   @returns Whether a live item exists under the key.
   */
  readonly has: (key: Key,) => boolean;
  /**
   Reads one value without marking it recently used.
   
   @param key - Key to read.
   
   @returns Stored value, or `undefined` when the key is absent or its item
   expired during this read.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `peek(key): ValueType | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  readonly peek: (key: Key,) => Value | undefined;
  /**
   Removes one item.
   
   @param key - Key to remove.
   
   @returns Whether an item was removed.
   */
  readonly delete: (key: Key,) => boolean;
  /**
   Removes every item without eviction notifications.
   */
  readonly clear: () => void;
  /**
   Reads one item's remaining lifetime without marking it recently used
   and without removing it when it is already expired.
   
   @param key - Key to inspect.
   
   @returns Remaining milliseconds, `Number.POSITIVE_INFINITY` for items
   without expiry, or `undefined` when the key is absent.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `expiresIn(key): number | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  readonly expiresIn: (key: Key,) => number | undefined;
  /**
   Updates `maxSize` in place, discarding items as necessary.
   
   @param maxSize - New target maximum number of items.
   
   @throws InvalidMaxSizeError when the value is not truthy and greater
   than `0`.
   */
  readonly resize: (maxSize: number,) => void;
  /**
   Evicts the least recently used items, keeping at least one.
   
   @param count - Number of items to evict.
   
   @defaultValue 1
   */
  readonly evict: (count?: number,) => void;
  /**
   Iterates every live key, most recently used first.
   */
  readonly keys: () => IterableIterator<Key>;
  /**
   Iterates every live value, most recently used first.
   */
  readonly values: () => IterableIterator<Value>;
  /**
   Iterates every live entry, oldest first. Exists for `Map`
   compatibility; prefer `entriesAscending`.
   */
  readonly entries: () => IterableIterator<[Key, Value]>;
  /**
   Iterates every live entry, oldest first.
   */
  readonly entriesAscending: () => IterableIterator<[Key, Value]>;
  /**
   Iterates every live entry, newest first.
   */
  readonly entriesDescending: () => IterableIterator<[Key, Value]>;
  /**
   Runs one visitor per live entry, oldest first. Exists for `Map`
   compatibility; prefer `entriesAscending`.
   
   @param options - Visitor and optional `this` value.
   */
  readonly forEach: (options: QuickLruForEachOptions<Key, Value>,) => void;
  /**
   Stored item count, capped at `maxSize` even though the dual-cache design
   may hold more.
   */
  readonly size: number;
  /**
   The set maximum number of items.
   */
  readonly maxSize: number;
  /**
   The set global lifetime in milliseconds.
   */
  readonly maxAge: number;
  /**
   The old cache's raw items, upstream `quick-lru`'s `__oldCache` test hook,
   mirrored so tests and the differential oracle can observe promotion.
   */
  readonly __oldCache: Map<Key, QuickLruItem<Value>>;
  /**
   Renders the cache like upstream: `QuickLRU(<size>/<maxSize>)`.
   */
  readonly toString: () => string;
  /**
   Iterates every live entry, most recently used first.
   */
  readonly [Symbol.iterator]: () => IterableIterator<[Key, Value]>;
  /**
   `Object.prototype.toString` tag, kept at upstream's `QuickLRU`.
   */
  readonly [Symbol.toStringTag]: string;
};

//endregion Types

//region Constants

/**
 `Node.js` custom inspection symbol upstream `quick-lru` implements as
 `[Symbol.for('nodejs.util.inspect.custom')]`.
 */
const NODE_INSPECT_SYMBOL = Symbol.for('nodejs.util.inspect.custom',);

//endregion Constants

//region Item helpers

/**
 Builds one stored item, mirroring upstream's `{value, expiry}` record.
 
 @param value - Value to store.
 
 @param expiry - Absolute expiry timestamp, `undefined` for items that never
 expire.
 
 @returns Item record carrying the value and its lifetime.
 
 @example
 ```ts
 const item = createItem(7, Number.NaN,);
 ```
 */
function createItem<Value>(value: Value, expiry?: number,): QuickLruItem<Value> {
  return (expiry === undefined)
    ? {
      value,
    }
    : {
      value,
      expiry,
    };
}

//endregion Item helpers

//region Member attachment

/**
 Attaches one method member with upstream's class-prototype descriptor
 flags: writable data property, non-enumerable, configurable.
 
 @param target - Object gaining the member.
 
 @param name - Member key, string or symbol.
 
 @param method - Function stored under the key.
 
 @example
 ```ts
 attachMethod(self, 'clear', clear,);
 ```
 */
function attachMethod(target: object, name: PropertyKey, method: unknown,): void {
  Object.defineProperty(
    target,
    name,
    {
      value: method,
      writable: true,
      enumerable: false,
      configurable: true,
    },
  );
}

/**
 Attaches one getter member with upstream's class-prototype accessor
 flags: non-enumerable, configurable, no setter.
 
 @param target - Object gaining the member.
 
 @param name - Member key, string or symbol.
 
 @param getter - Function backing the read.
 
 @example
 ```ts
 attachGetter(self, 'size', readSize,);
 ```
 */
function attachGetter(target: object, name: PropertyKey, getter: () => unknown,): void {
  Object.defineProperty(
    target,
    name,
    {
      get: getter,
      enumerable: false,
      configurable: true,
    },
  );
}

//endregion Member attachment

//region Cache

/**
 Creates one dual-cache LRU map over upstream `quick-lru`'s constructor
 shape.
 
 The cache keeps between `maxSize` and `2 × maxSize` items because the
 dual-cache design avoids per-write deletes; `size` still reports at most
 `maxSize`, matching upstream.
 
 @param options - `maxSize` plus optional global `maxAge` and `onEviction`.
 
 @returns Cache object with upstream `quick-lru`'s full member surface.
 
 @throws InvalidMaxSizeError when `maxSize` is not truthy and greater than
 `0`.
 
 @throws InvalidMaxAgeError when `maxAge` is exactly the number `0`.
 
 @throws TypeError when `options` is `null`, from the same property read
 upstream performs, matching upstream `quick-lru`.
 
 @example
 ```ts
 import { createQuickLru, } from '\@monochromatic-dev/module-quick-lru-fork';
 
 const lru = createQuickLru<string, number>({
   maxSize: 2,
   onEviction: function reportEvicted(key: string, value: number): void {
     console.log('evicted', key, value);
   },
 },);
 ```
 */
export function createQuickLru<Key, Value>(options: QuickLruOptions<Key, Value>,): QuickLru<Key, Value> {
  /**
   Validated bounds; resolving first keeps every later branch free of input
   shape checks.
   */
  const resolved = resolveQuickLruOptions(options,);
  /**
   Mutable cache state, read and written by the closures below. The two
   maps mirror upstream's `#cache` (recent) and `#oldCache` (older); the
   counter mirrors upstream's `#size`, which counts inserts into the
   recent map since the last rollover.
   */
  const state = {
    /**
     Recently used items, mirroring upstream `quick-lru`'s `#cache`.
     */
    cache: new Map<Key, QuickLruItem<Value>>(),
    /**
     Less recently used items, mirroring upstream `quick-lru`'s
     `#oldCache`.
     */
    oldCache: new Map<Key, QuickLruItem<Value>>(),
    /**
     Inserts into `cache` since the last rollover, mirroring upstream
     `quick-lru`'s `#size`.
     */
    cacheSize: 0,
    /**
     Target maximum number of items, replaceable through `resize`.
     */
    maxSize: resolved.maxSize,
    /**
     Global lifetime bound in milliseconds.
     */
    maxAge: resolved.maxAge,
    /**
     Eviction callback as passed in, `undefined` when the input carried
     none, mirroring upstream `quick-lru`'s `#onEviction`.
     */
    onEviction: options.onEviction,
  };
  /**
   The cache object handed to callers. Every member is attached below with
   upstream's prototype descriptor flags, so the surface check in the fuzz
   sidecar can pin it against upstream `quick-lru`.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `self` gains every QuickLru member through the attachMethod/attachGetter calls below before it is returned; the empty shell exists so closures can return the cache itself for chaining
  const self = {} as QuickLru<Key, Value>;

  //region Cache internals

  /**
   Notifies the eviction callback for each item leaving the cache, exactly
   as upstream `#emitEvictions` does: no notification and no iteration at
   all when the input carried no callable callback.
   
   @param items - Leaving items as key and item pairs, map or snapshot.
   */
  function emitEvictions(items: Iterable<readonly [Key, QuickLruItem<Value>]>,): void {
    /**
     Eviction callback, absent or non-callable exactly when upstream skips
     notification.
     */
    const notify = state.onEviction;
    if ((typeof notify) !== 'function')
      return;

    for (const [key, item] of items)
      notify(key, item.value,);
  }

  /**
   Removes one item from both maps, mirroring upstream's `delete`.
   
   @param key - Key to remove.
   
   @returns Whether an item was removed.
   */
  function deleteEntry(key: Key,): boolean {
    /**
     Whether the recent map held the key.
     */
    const deleted = state.cache.delete(key,);
    if (deleted)
      state.cacheSize -= 1;

    return state.oldCache.delete(key,) || deleted;
  }

  /**
   Lazily expires one item, notifying and removing it when its expiry has
   passed, mirroring upstream's `#deleteIfExpired`.
   
   @param key - Key the item is stored under.
   
   @param item - Stored item to check.
   
   @returns Whether the item expired and was removed now.
   */
  function deleteIfExpired(key: Key, item: QuickLruItem<Value>,): boolean {
    if (((typeof item.expiry) === 'number') && (item.expiry <= Date.now())) {
      /**
       Eviction callback, notified exactly as upstream does before the
       lazy removal.
       */
      const notify = state.onEviction;
      if ((typeof notify) === 'function')
        notify(key, item.value,);

      return deleteEntry(key,);
    }

    return false;
  }

  /**
   Inserts one item into the recent map, rolling the maps over when the
   recent one fills, mirroring upstream's `#set`.
   
   @param key - Key to store the item under.
   
   @param item - Stored item to insert.
   */
  function insertRecentItem(key: Key, item: QuickLruItem<Value>,): void {
    state.cache.set(key, item,);
    state.cacheSize += 1;

    if (state.cacheSize >= state.maxSize) {
      state.cacheSize = 0;
      emitEvictions(state.oldCache,);
      state.oldCache = state.cache;
      state.cache = new Map<Key, QuickLruItem<Value>>();
    }
  }

  /**
   Moves one old item back into the recent map, marking it most recently
   used, mirroring upstream's `#moveToRecent`.
   
   @param key - Key the item is stored under.
   
   @param item - Stored item to promote.
   */
  function promoteItem(key: Key, item: QuickLruItem<Value>,): void {
    state.oldCache.delete(key,);
    insertRecentItem(key, item,);
  }

  //endregion Cache internals

  //region Iteration

  /**
   Iterates raw stored items oldest first, skipping keys duplicated in the
   recent map and dropping items that expire during iteration, mirroring
   upstream's `#entriesAscending`.
   */
  function* iterateItemEntriesAscending(): IterableIterator<readonly [Key, QuickLruItem<Value>]> {
    for (const entry of state.oldCache) {
      const [key, item] = entry;
      if ((!state.cache.has(key,)) && (!deleteIfExpired(key, item,)))
        yield entry;
    }

    for (const entry of state.cache) {
      const [key, item] = entry;
      if (!deleteIfExpired(key, item,))
        yield entry;
    }
  }

  /**
   Iterates live entries most recently used first: recent map before old
   map, mirroring upstream's `[Symbol.iterator]`.
   */
  function* iterateEntries(): IterableIterator<[Key, Value]> {
    for (const entry of state.cache) {
      const [key, item] = entry;
      if (!deleteIfExpired(key, item,)) {
        /**
         Live entry as an upstream-shaped key and value pair.
         */
        const pair: [Key, Value] = [
          key,
          item.value,
        ];
        yield pair;
      }
    }

    for (const entry of state.oldCache) {
      const [key, item] = entry;
      if ((!state.cache.has(key,)) && (!deleteIfExpired(key, item,))) {
        /**
         Live entry as an upstream-shaped key and value pair.
         */
        const pair: [Key, Value] = [
          key,
          item.value,
        ];
        yield pair;
      }
    }
  }

  /**
   Iterates live entries newest first within each map, mirroring upstream's
   `entriesDescending`.
   */
  function* iterateEntriesDescending(): IterableIterator<[Key, Value]> {
    for (const entry of [...state.cache].reverse()) {
      const [key, item] = entry;
      if (!deleteIfExpired(key, item,)) {
        /**
         Live entry as an upstream-shaped key and value pair.
         */
        const pair: [Key, Value] = [
          key,
          item.value,
        ];
        yield pair;
      }
    }

    for (const entry of [...state.oldCache].reverse()) {
      const [key, item] = entry;
      if ((!state.cache.has(key,)) && (!deleteIfExpired(key, item,))) {
        /**
         Live entry as an upstream-shaped key and value pair.
         */
        const pair: [Key, Value] = [
          key,
          item.value,
        ];
        yield pair;
      }
    }
  }

  /**
   Iterates live entries oldest first, mirroring upstream's
   `entriesAscending`.
   */
  function* iterateEntriesAscending(): IterableIterator<[Key, Value]> {
    for (const [key, item] of iterateItemEntriesAscending()) {
      /**
       Live entry as an upstream-shaped key and value pair.
       */
      const pair: [Key, Value] = [
        key,
        item.value,
      ];
      yield pair;
    }
  }

  /**
   Iterates live keys most recently used first, mirroring upstream's
   `keys`.
   */
  function* iterateKeys(): IterableIterator<Key> {
    for (const [key] of iterateEntries())
      yield key;
  }

  /**
   Iterates live values most recently used first, mirroring upstream's
   `values`.
   */
  function* iterateValues(): IterableIterator<Value> {
    for (const [, value] of iterateEntries())
      yield value;
  }

  //endregion Iteration

  //region Cache members

  /**
   Stores one value under one key with an optional per-item lifetime,
   refreshing its expiry, mirroring upstream's `set`.
   
   @param options - Key, value, and optional per-item lifetime.
   
   @returns The cache itself, so calls chain.
   
   @example
   ```ts
   lru.set({
     key: 'a',
     value: 1,
     maxAge: 500,
   },);
   ```
   */
  function set({
    key,
    value,
    maxAge = state.maxAge,
  }: QuickLruSetOptions<Key, Value>,): QuickLru<Key, Value> {
    /**
     Absolute expiry timestamp, `undefined` for items that never expire,
     computed exactly as upstream computes it.
     */
    const expiry = (((typeof maxAge) === 'number') && (maxAge !== Number.POSITIVE_INFINITY))
      ? (Date.now() + maxAge)
      : undefined;
    /**
     Item record built once so both insertion paths share upstream's
     `{value, expiry}` shape.
     */
    const item = createItem(value, expiry,);

    if (state.cache.has(key,))
      state.cache.set(key, item,);
    else
      insertRecentItem(key, item,);

    return self;
  }

  /**
   Reads one value and marks it most recently used when it sat in the old
   map, mirroring upstream's `get`.
   
   @param key - Key to read.
   
   @returns Stored value, or `undefined` when the key is absent or expired
   during this read.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `get(key): ValueType | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  function get(key: Key,): Value | undefined {
    /**
     Item stored in the recent map, when present.
     */
    const recentItem = state.cache.get(key,);
    if (recentItem !== undefined) {
      if (!recentItem.expiry)
        return recentItem.value;

      return deleteIfExpired(key, recentItem,)
        ? undefined
        : recentItem.value;
    }

    /**
     Item stored in the old map, when present.
     */
    const oldItem = state.oldCache.get(key,);
    if (oldItem !== undefined) {
      if (!deleteIfExpired(key, oldItem,)) {
        promoteItem(key, oldItem,);
        return oldItem.value;
      }
    }
  }

  /**
   Reads one value without marking it recently used, mirroring upstream's
   `peek`.
   
   @param key - Key to read.
   
   @returns Stored value, or `undefined` when the key is absent or expired
   during this read.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `peek(key): ValueType | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  function peek(key: Key,): Value | undefined {
    /**
     Item stored in the recent map, when present.
     */
    const recentItem = state.cache.get(key,);
    if (recentItem !== undefined) {
      if (!recentItem.expiry)
        return recentItem.value;

      return deleteIfExpired(key, recentItem,)
        ? undefined
        : recentItem.value;
    }

    /**
     Item stored in the old map, when present.
     */
    const oldItem = state.oldCache.get(key,);
    if (oldItem !== undefined) {
      if (!oldItem.expiry)
        return oldItem.value;

      return deleteIfExpired(key, oldItem,)
        ? undefined
        : oldItem.value;
    }
  }

  /**
   Checks one key without marking it recently used, mirroring upstream's
   `has`.
   
   @param key - Key to check.
   
   @returns Whether a live item exists under the key.
   */
  function has(key: Key,): boolean {
    /**
     Item stored in the recent map, when present.
     */
    const recentItem = state.cache.get(key,);
    if (recentItem !== undefined)
      return !deleteIfExpired(key, recentItem,);

    /**
     Item stored in the old map, when present.
     */
    const oldItem = state.oldCache.get(key,);
    if (oldItem !== undefined)
      return !deleteIfExpired(key, oldItem,);

    return false;
  }

  /**
   Reads one item's remaining lifetime without lazily expiring it,
   mirroring upstream's `expiresIn`.
   
   @param key - Key to inspect.
   
   @returns Remaining milliseconds, `Number.POSITIVE_INFINITY` for items
   without expiry, or `undefined` when the key is absent.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors upstream quick-lru 7.3.0's `expiresIn(key): number | undefined` return; absence stays `undefined` so migrating callers and the fuzz differential oracle observe the upstream shape
  function expiresIn(key: Key,): number | undefined {
    /**
     Item stored under the key in either map, recent map taking precedence
     exactly as upstream reads it.
     */
    const item = state.cache.get(key,) ?? state.oldCache.get(key,);
    if (item !== undefined)
      return item.expiry
        ? (item.expiry - Date.now())
        : Number.POSITIVE_INFINITY;
  }

  /**
   Removes every item without eviction notifications, mirroring upstream's
   `clear`.
   */
  function clear(): void {
    state.cache.clear();
    state.oldCache.clear();
    state.cacheSize = 0;
  }

  /**
   Updates the target maximum in place, mirroring upstream's `resize`:
   growing keeps every item in the recent map, shrinking evicts the oldest
   ones first with notifications.
   
   @param maxSize - New target maximum number of items.
   
   @throws InvalidMaxSizeError when the value is not truthy and greater
   than `0`.
   */
  function resize(maxSize: number,): void {
    /**
     Validated new bound, stored exactly as upstream stores it.
     */
    const validatedMaxSize = validateMaxSize(maxSize,);
    /**
     Live items oldest first, collected through the same lazy-expiry walk
     upstream uses.
     */
    const items = [...iterateItemEntriesAscending()];
    /**
     How many oldest items the new bound no longer fits.
     */
    const removeCount = items.length - validatedMaxSize;

    if (removeCount < 0) {
      state.cache = new Map(items,);
      state.oldCache = new Map<Key, QuickLruItem<Value>>();
      state.cacheSize = items.length;
    }
    else {
      if (removeCount > 0)
        emitEvictions(items.slice(0, removeCount,),);

      state.oldCache = new Map(items.slice(removeCount,),);
      state.cache = new Map<Key, QuickLruItem<Value>>();
      state.cacheSize = 0;
    }

    state.maxSize = validatedMaxSize;
  }

  /**
   Evicts the least recently used items with notifications, keeping at
   least one, mirroring upstream's `evict`.
   
   @param count - Number of items to evict.
   
   @defaultValue 1
   */
  function evict(count = 1,): void {
    /**
     Coerced eviction request, `undefined` exactly when upstream gives up
     before touching the cache.
     */
    const requested = Number(count,);
    if ((!requested) || (requested <= 0))
      return;

    /**
     Live items oldest first, collected through the same lazy-expiry walk
     upstream uses.
     */
    const items = [...iterateItemEntriesAscending()];
    /**
     How many oldest items leave, never the final item.
     */
    const evictCount = Math.trunc(Math.min(requested, Math.max(items.length - 1, 0,),),);
    if (evictCount <= 0)
      return;

    emitEvictions(items.slice(0, evictCount,),);
    state.oldCache = new Map(items.slice(evictCount,),);
    state.cache = new Map<Key, QuickLruItem<Value>>();
    state.cacheSize = 0;
  }

  /**
   Runs one visitor per live entry oldest first, mirroring upstream's
   `forEach`.
   
   @param options - Visitor and optional `this` value.
   */
  function forEach({
    callback,
    thisArgument = self,
  }: QuickLruForEachOptions<Key, Value>,): void {
    for (const [key, value] of iterateEntriesAscending())
      callback.call(thisArgument, value, key, self,);
  }

  /**
   Reports the stored item count capped at the target maximum, mirroring
   upstream's `size` getter and its duplicate-key accounting.
   
   @returns Stored item count as upstream reports it.
   */
  function readSize(): number {
    if (!state.cacheSize)
      return state.oldCache.size;

    /**
     Old-map keys absent from the recent map, counted in a container
     because repository lint bans function-root `let` bindings.
     */
    const tally = {
      uniques: 0,
    };
    for (const key of state.oldCache.keys()) {
      if (!state.cache.has(key,))
        tally.uniques += 1;
    }

    return Math.min(state.cacheSize + tally.uniques, state.maxSize,);
  }

  /**
   Renders the cache like upstream's `toString`.
   
   @returns `QuickLRU(<size>/<maxSize>)`.
   */
  function toString(): string {
    return `QuickLRU(${readSize()}/${state.maxSize})`;
  }

  /**
   Handles `Node.js` custom inspection like upstream: the same text as
   `toString`.
   
   @returns `QuickLRU(<size>/<maxSize>)`.
   */
  function inspectCustom(): string {
    return toString();
  }

  //endregion Cache members

  //region Attachment

  attachMethod(self, 'set', set,);
  attachMethod(self, 'get', get,);
  attachMethod(self, 'has', has,);
  attachMethod(self, 'peek', peek,);
  attachMethod(self, 'delete', deleteEntry,);
  attachMethod(self, 'clear', clear,);
  attachMethod(self, 'expiresIn', expiresIn,);
  attachMethod(self, 'resize', resize,);
  attachMethod(self, 'evict', evict,);
  attachMethod(self, 'keys', iterateKeys,);
  attachMethod(self, 'values', iterateValues,);
  attachMethod(self, 'entries', iterateEntriesAscending,);
  attachMethod(self, 'entriesAscending', iterateEntriesAscending,);
  attachMethod(self, 'entriesDescending', iterateEntriesDescending,);
  attachMethod(self, 'forEach', forEach,);
  attachMethod(self, 'toString', toString,);
  attachMethod(self, Symbol.iterator, iterateEntries,);
  attachMethod(self, NODE_INSPECT_SYMBOL, inspectCustom,);
  attachGetter(self, 'size', readSize,);
  attachGetter(self, 'maxSize', function readMaxSize(): number {
    return state.maxSize;
  },);
  attachGetter(self, 'maxAge', function readMaxAge(): number {
    return state.maxAge;
  },);
  attachGetter(self, '__oldCache', function readOldCache(): Map<Key, QuickLruItem<Value>> {
    return state.oldCache;
  },);
  attachGetter(self, Symbol.toStringTag, function readToStringTag(): string {
    return 'QuickLRU';
  },);

  //endregion Attachment

  return self;
}

//endregion Cache
