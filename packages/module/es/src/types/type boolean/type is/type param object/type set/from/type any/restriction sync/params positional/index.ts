import type {
  $ as Is,
} from '@_/types/type function/type is/type/restriction sync/params positional/index.ts';

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
 * $(set); // true
 * $(weakSet); // false
 * $(arr); // false
 * $({});; // false
 *
 * // Sets are iterable
 * for (const item of set) {
 *   console.log(item); // 1, 2, 3
 * }
 *
 * // Works across different execution contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeSet = new iframe.contentWindow.Set([1, 2, 3]);
 * $(iframeSet); // true
 * ```
 */
export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends Set<infer T> ? MyValue & Set<T> : MyValue & Set<unknown> {
  return Object.prototype.toString.call(value,) === '[object Set]';
}

const _$: Is = $;
