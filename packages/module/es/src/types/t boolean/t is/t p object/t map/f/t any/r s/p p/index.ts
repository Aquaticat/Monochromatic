/**
 * Tests if a value is a Map instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 * Special handling in includesArrayLike for performance optimization.
 *
 * @param value - Value to check for Map type
 * @returns True if value is a Map instance, false otherwise
 *
 * @example
 * ```ts
 * const map = new Map([['key', 'value']]);
 * const weakMap = new WeakMap();
 * const obj = { key: 'value' };
 *
 * $(map); // true
 * $(weakMap); // false
 * $(obj); // false
 * $([]); // false
 * $(new Set()); // false
 *
 * // Works with Maps from different contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeMap = new iframe.contentWindow.Map();
 * $(iframeMap); // true
 * ```
 */
export function $<const MyValue>(value: MyValue,): value is MyValue extends Map<infer K, infer V> ? MyValue & Map<K, V> : MyValue & Map<unknown, unknown> {
  return Object.prototype.toString.call(value,) === '[object Map]';
}
