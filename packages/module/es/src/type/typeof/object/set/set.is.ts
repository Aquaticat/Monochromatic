/**
 * Tests if a value is a Set instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 * Special handling in includesArrayLike for performance optimization.
 *
 * @param value - Value to check for Set type
 * @returns True if value is a Set instance, false otherwise
 *
 * @example
 * ```ts
 * const set = new Set([1, 2, 3]);
 * const weakSet = new WeakSet();
 * const arr = [1, 2, 3];
 *
 * console.log(isSet(set)); // true
 * console.log(isSet(weakSet)); // false
 * console.log(isSet(arr)); // false
 * console.log(isSet({})); // false
 *
 * // Sets are iterable
 * console.log(isIterable(set)); // true
 * for (const item of set) {
 *   console.log(item); // 1, 2, 3
 * }
 * ```
 */
export function isSet(value: unknown,): value is Set<any> {
  return Object.prototype.toString.call(value,) === '[object Set]';
}

/**
 * Tests if a value is a WeakSet instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 *
 * @param value - Value to check for WeakSet type
 * @returns True if value is a WeakSet instance, false otherwise
 *
 * @example
 * ```ts
 * const weakSet = new WeakSet();
 * const set = new Set();
 * const arr = [];
 *
 * console.log(isWeakSet(weakSet)); // true
 * console.log(isWeakSet(set)); // false
 * console.log(isWeakSet(arr)); // false
 * console.log(isWeakSet({})); // false
 *
 * // WeakSets can only contain objects
 * const obj = {};
 * weakSet.add(obj);
 * console.log(isWeakSet(weakSet)); // true
 * ```
 */
export function isWeakSet(value: unknown,): value is WeakSet<any> {
  return Object.prototype.toString.call(value,) === '[object WeakSet]';
}