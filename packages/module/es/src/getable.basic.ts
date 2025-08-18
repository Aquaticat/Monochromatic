import type { Promisable, } from 'type-fest';
import type { Logged, } from './logged.basic.ts';
import type { Weightful, } from './weightful.basic';

/**
 * Represents an object that can retrieve values asynchronously by key.
 *
 * @typeParam K - Type of keys used to retrieve values
 * @typeParam V - Type of values that can be retrieved
 *
 * @example
 * ```ts
 * const asyncCache: Getable<string, number> = {
 *   get: async ({ key }) => {
 *     // retrieve value by key
 *     return 42;
 *   }
 * };
 * ```
 */
export type Getable<K = unknown, V = unknown,> = {
  get: (
    { key, l, }: { key: K; } & Partial<Logged>,
  ) => Promisable<V | undefined>;
} & Partial<Weightful>;

/**
 * Represents an object that can retrieve values synchronously by key.
 *
 * @typeParam K - Type of keys used to retrieve values
 * @typeParam V - Type of values that can be retrieved
 *
 * @example
 * ```ts
 * const syncCache: GetableSync<string, number> = {
 *   get: ({ key }) => {
 *     // retrieve value by key
 *     return 42;
 *   }
 * };
 * ```
 */
export type GetableSync<K = unknown, V = unknown,> = {
  get: ({ key, l, }: { key: K; } & Partial<Logged>,) => V | undefined;
} & Partial<Weightful>;
