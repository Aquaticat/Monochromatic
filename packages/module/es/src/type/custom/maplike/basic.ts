import type { Promisable, } from 'type-fest';
import type {
  Getable,
  GetableSync,
} from '../object/getable/getable.basic.ts';
import type { Identifiable, } from '../object/identifiable/identifiable.basic.ts';
import type { Logged, } from '../object/logged/logged.basic.ts';
import type {
  MaybeAsyncIterable,
  MaybeAsyncIterableIterator,
} from './iterable.basic.ts';
import type {
  MinimalMapLike,
  MinimalMapLikeSync,
} from './minimal/basic.ts';

/**
 * Full-featured map-like interface extending MinimalMapLike with additional methods.
 * Provides a complete set of Map-like operations including iteration, querying, and bulk operations.
 *
 * @typeParam K - Type of keys
 * @typeParam V - Type of values
 */
export type MapLike<K = unknown, V = unknown,> = MinimalMapLike<K, V> & {
  /** Removes all key-value pairs from the map */
  clear({ l, }: Partial<Logged>,): Promisable<unknown>;

  /** Returns an iterator for entries (key-value pairs) */
  entries({ l, }: Partial<Logged>,): MaybeAsyncIterable<[K, V,]>;

  /** Checks if a key exists in the map */
  has({ key, }: { key: K; } & Partial<Logged>,): Promisable<boolean>;
};
export type MapLikeSync<K = unknown, V = unknown,> = MinimalMapLikeSync<K, V> & {
  /** Removes all key-value pairs from the map */
  clear({ l, }: Partial<Logged>,): unknown;

  /** Returns an iterator for entries (key-value pairs) */
  entries({ l, }: Partial<Logged>,): Iterable<[K, V,]>;

  /** Checks if a key exists in the map */
  has({ key, }: { key: K; } & Partial<Logged>,): boolean;
};
