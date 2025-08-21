import type { Promisable, } from 'type-fest';
import type {
  Getable,
  GetableSync,
} from '../../object/getable/getable.basic.ts';
import type { Identifiable, } from '../../object/identifiable/identifiable.basic.ts';
import type { Logged, } from '../../object/logged/logged.basic.ts';
import type {
  MaybeAsyncIterable,
  MaybeAsyncIterableIterator,
} from './iterable.basic.ts';

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
  set({ key, value, l, }: { key: K; value: V; } & Partial<Logged>,): Promisable<unknown>;
  /** Removes the key-value pair for the specified key */
  delete({ key, l, }: { key: K; } & Partial<Logged>,): Promisable<unknown>;
  /** Iterates all available keys in the storage */
  keys({ l, }: Partial<Logged>,): MaybeAsyncIterable<K>;
} & Getable<K, V> & Partial<Identifiable>;

export type MinimalMapLikeSync<K = unknown, V = unknown,> = {
  /** Stores value under the specified key */
  set({ key, value, l, }: { key: K; value: V; } & Partial<Logged>,): unknown;
  /** Removes the key-value pair for the specified key */
  delete({ key, l, }: { key: K; } & Partial<Logged>,): unknown;
  /** Iterates all available keys in the storage */
  keys({ l, }: Partial<Logged>,): Iterable<K>;
} & GetableSync<K, V> & Partial<Identifiable>;
