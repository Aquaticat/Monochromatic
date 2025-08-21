import type { UnknownRecord, } from 'type-fest';

/**
 * Tests if a value is a plain object (not an array, function, or other object type).
 * Uses Object.prototype.toString to check for '[object Object]' which indicates a plain object.
 *
 * @param value - Value to check for plain object type
 * @returns True if value is a plain object, false otherwise
 *
 * @example
 * ```ts
 * const plainObj = { key: 'value' };
 * const arr = [1, 2, 3];
 * const func = () => {};
 * const date = new Date();
 *
 * console.log(isObject(plainObj)); // true
 * console.log(isObject(arr)); // false
 * console.log(isObject(func)); // false
 * console.log(isObject(date)); // false
 * console.log(isObject(null)); // false
 * console.log(isObject(undefined)); // false
 *
 * // Object literals and Object.create(null)
 * console.log(isObject({})); // true
 * console.log(isObject(Object.create(null))); // false (no prototype)
 * console.log(isObject(new Object())); // true
 * ```
 */
export function isObject(value: unknown,): value is UnknownRecord {
  return Object.prototype.toString.call(value,) === '[object Object]';
}