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
 * $(plainObj); // true
 * $(arr); // false
 * $(func); // false
 * $(date); // false
 * $(null); // false
 * $(undefined); // false
 *
 * // Object literals and Object.create(null)
 * $({}); // true
 * $(Object.create(null)); // false (no prototype)
 * $(new Object()); // true
 *
 * // Works across different execution contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeObject = new iframe.contentWindow.Object();
 * $(iframeObject); // true
 * ```
 */
export function $<const MyValue>(value: MyValue,): value is MyValue extends Record<infer K, infer V> ? MyValue & Record<K, V> : MyValue & Record<string|number|symbol, unknown> {
  return Object.prototype.toString.call(value,) === '[object Object]';
}
