import type { Promisable, } from 'type-fest';

//region Store Interface -- Core store contract definition

/** Store contract.
 * Implement a simple store API with optional tiering.
 */
export type Store = {
  /** Retrieve value by key; returns content or undefined when missing. */
  get<const T extends unknown,>(key: string,): Promisable<T | undefined>;
  /** Persist serialized value by key and return storage backend for chaining. */
  set(key: string, value: unknown,): Promisable<Store>;
  /** Remove all persisted entries from this backend. */
  clear(): Promisable<void>;
  /** Delete entry for key; returns true when deletion occurred. */
  delete(key: string,): Promisable<boolean>;
  /** Optional priority tier for consensus (higher value means higher tier). */
  priority?: number;
};

//endregion Store Interface

//region MemoryStore Implementation -- Map-based in-memory store with documented limitations

/**
 * In-memory store implementation that extends Map to implement Store interface.
 *
 * **Limitations and Behavioral Notes:**
 *
 * - **Type inference**: The generic `get<const T>()` method loses type safety since Map's `get()`
 *   returns `any` rather than the expected generic type `T | undefined`. Callers must rely on
 *   type assertions or trust the return type.
 *
 * - **Return type compatibility**: Map's `set()` method returns the Map instance, while Store's
 *   `set()` expects `Promisable<Store>`. This works at runtime due to structural typing
 *   (both are truthy and chainable), but strict equality checks expecting exactly a Store
 *   interface may behave unexpectedly.
 *
 * - **Missing property handling**: The optional `priority?: number` property from Store interface
 *   is not explicitly defined but can be set at runtime. TypeScript may issue warnings when
 *   accessing this property without explicit type assertions.
 *
 * - **No explicit method overrides**: Relies entirely on Map's built-in implementation without
 *   custom logic for Store interface compliance. This works for basic operations but provides
 *   no additional validation or Store-specific behavior.
 *
 * **Usage Considerations:**
 * - Suitable for simple in-memory caching scenarios where type safety is not critical
 * - For production use with strict type requirements, consider explicit method implementations
 * - All Map methods remain available alongside Store interface methods
 *
 * @example
 * ```ts
 * const store = new MemoryStore();
 *
 * // Basic operations work as expected
 * await store.set('key', 'value');
 * const value = store.get<string>('key'); // Type assertion needed for safety
 *
 * // Optional priority can be set but may need type assertion
 * (store as Store).priority = 1;
 * ```
 */
export class MemoryStore extends Map implements Store {}

//endregion MemoryStore Implementation
