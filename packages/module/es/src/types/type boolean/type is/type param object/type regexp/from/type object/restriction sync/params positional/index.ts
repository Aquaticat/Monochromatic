import type {
  $ as Is,
} from '../../../../../../../../type function/type is/type/restriction sync/params positional/index.ts';

/**
 * Type guard that checks if a value is a RegExp object using Object.prototype.toString.
 * This method provides more reliable RegExp detection than instanceof, especially across
 * different execution contexts or when dealing with RegExp objects from different realms.
 *
 * @param value - Value to test for RegExp type
 * @returns True if value is a RegExp object, false otherwise
 * @example
 * ```ts
 * const pattern = /[a-z]+/;
 * const notPattern = "[a-z]+";
 *
 * isObjectRegexp(pattern); // true
 * isObjectRegexp(notPattern); // false
 * isObjectRegexp(new RegExp("test")); // true
 * ```
 */
export function $(
  value: object,
): value is RegExp {
  return Object.prototype.toString.call(value,) === '[object RegExp]';
}

const _$: Is<object, RegExp> = $;
