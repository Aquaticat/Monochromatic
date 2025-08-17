import type { Promisable, } from 'type-fest';
import type { Getable, } from './getable.basic.ts';
import type { Identifiable, } from './identifiable.basic.ts';
import type { MaybeAsyncIterableIterator, } from './iterable.type.maybe.ts';
import type { MinimalMapLike, } from './minimalMapLike.basic.ts';

/**
 * Full-featured map-like interface extending MinimalMapLike with additional methods.
 * Provides a complete set of Map-like operations including iteration, querying, and bulk operations.
 *
 * @typeParam K - Type of keys
 * @typeParam V - Type of values
 */
export type MapLike<K = unknown, V = unknown,> = MinimalMapLike<K, V> & {
  set(key: K, value: V,): Promisable<MapLike<K, V>>;
} & {
  /** Removes all key-value pairs from the map */
  clear(): Promisable<void>;

  /** Returns an iterator for entries (key-value pairs) */
  entries(): MaybeAsyncIterableIterator<[K, V,]>;

  /** Executes a provided function once for each key-value pair */
  forEach(
    fn: (value: V, key: K, map: MapLike<K, V>,) => Promisable<unknown>,
  ): Promisable<void>;

  /** Checks if a key exists in the map */
  has(key: K,): Promisable<boolean>;

  /** Returns an iterator for values */
  values(): MaybeAsyncIterableIterator<V>;
} & Getable<K, V> & Partial<Identifiable> & MaybeAsyncIterableIterator<[K, V,]>;
