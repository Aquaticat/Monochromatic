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
 * console.log(isMap(map)); // true
 * console.log(isMap(weakMap)); // false
 * console.log(isMap(obj)); // false
 * console.log(isMap([])); // false
 * console.log(isMap(new Set())); // false
 *
 * // Works with Maps from different contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeMap = new iframe.contentWindow.Map();
 * console.log(isMap(iframeMap)); // true
 * ```
 */
export function isMap(value: unknown,): value is Map<any, any> {
  return Object.prototype.toString.call(value,) === '[object Map]';
}

/**
 * Tests if a value is a WeakMap instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 *
 * @param value - Value to check for WeakMap type
 * @returns True if value is a WeakMap instance, false otherwise
 *
 * @example
 * ```ts
 * const weakMap = new WeakMap();
 * const map = new Map();
 * const obj = {};
 *
 * console.log(isWeakMap(weakMap)); // true
 * console.log(isWeakMap(map)); // false
 * console.log(isWeakMap(obj)); // false
 * console.log(isWeakMap(null)); // false
 *
 * // WeakMaps can only have object keys
 * const key = {};
 * weakMap.set(key, 'value');
 * console.log(isWeakMap(weakMap)); // true
 * ```
 */
export function isWeakMap(
  value: unknown,
): value is WeakMap<any, any> {
  return Object.prototype.toString.call(value,) === '[object WeakMap]';
}