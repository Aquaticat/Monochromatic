import type { Promisable, } from 'type-fest';
import type { Getable, GetableSync, } from './getable.basic.ts';
import type { Identifiable, } from './identifiable.basic.ts';
import type { MaybeAsyncIterableIterator, } from './iterable.type.maybe.ts';

/**
 * Minimal map-like interface with essential operations.
 * Contains the minimal set of features that can be transformed into a full MapLike via pure functions.
 * Provides basic key-value storage operations: set, delete, and keys iteration.
 *
 * @typeParam K - Type of keys
 * @typeParam V - Type of values
 */
export type MinimalMapLike<K = unknown, V = unknown,> = {
  /** Stores value under the specified key */
  set(key: K, value: V,): Promisable<unknown>;
  /** Removes the key-value pair for the specified key */
  delete(key: K,): Promisable<unknown>;
  /** Iterates all available keys in the storage */
  keys(): MaybeAsyncIterableIterator<K>;
} & Getable<K, V> & Partial<Identifiable>;

export type MinimalMapLikeSync<K = unknown, V=unknown> = {
  set(key: K, value: V): unknown;
  delete(key: K): unknown;
  keys(): IterableIterator<K>;
} & GetableSync<K,V> & Partial<Identifiable>;
