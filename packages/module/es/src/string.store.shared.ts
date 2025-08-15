import type { Promisable, } from 'type-fest';
import type { Logger, } from './string.log.ts';
import type { NonEmptyString, } from './string.type.ts';

export const persistentStringStoreDefaultPriority = 100;

export const sessionStringStoreDefaultPriority = 10;

export const memoryStringStoreDefaultPriority = 0;

/** Store contract.
 * Implement a simple string store API with optional tiering.
 */
export type StringStore = {
  /** Retrieve serialized value by key; returns serialized content or undefined when missing. */
  get(key: string,): Promisable<string | undefined>;
  /** Persist serialized value by key and return storage backend for chaining. */
  set(key: string, value: string,): Promisable<StringStore>;
  /** Remove all persisted entries from this backend. */
  clear(): Promisable<void>;
  /** Delete entry for key; returns true when deletion occurred. */
  delete(key: string,): Promisable<boolean>;
  /** Optional priority tier for consensus (higher value means higher tier). */
  priority?: number;
};

/**
 * In-memory store implementation that extends Map to implement StringStore interface.
 *
 * **Limitations and Behavioral Notes:**
 *
 * - **Return type compatibility**: Map's `set()` method returns the Map instance, while StringStore's
 *   `set()` expects `Promisable<StringStore>`. This works at runtime due to structural typing
 *   (both are truthy and chainable), but strict equality checks expecting exactly a StringStore
 *   interface may behave unexpectedly.
 *
 * - **Missing property handling**: The optional `priority?: number` property from StringStore interface
 *   is not explicitly defined but can be set at runtime. TypeScript may issue warnings when
 *   accessing this property without explicit type assertions.
 *
 * - **No explicit method overrides**: Relies entirely on Map's built-in implementation without
 *   custom logic for StringStore interface compliance. This works for basic operations but provides
 *   no additional validation or StringStore-specific behavior.
 *
 * **Usage Considerations:**
 * - Suitable for simple in-memory caching scenarios with string keys and values
 * - For production use with strict type requirements, consider explicit method implementations
 * - All Map methods remain available alongside StringStore interface methods
 *
 * @example
 * ```ts
 * const store = new StringMemoryStore();
 *
 * // Basic operations work as expected
 * await store.set('key', 'value');
 * const value = store.get('key'); // Returns string | undefined
 *
 * // Optional priority can be set but may need type assertion
 * (store as StringStore).priority = 1;
 * ```
 */
export class StringMemoryStore extends Map implements StringStore {}

export type StringStoreArguments = { id: NonEmptyString; priority?: number; l?: Logger;
  storage: SimpleStorage; };
