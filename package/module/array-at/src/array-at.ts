/**
 * Public throwing array accessor.
 *
 * @module
 */

import type {
  ArrayAtArgument,
  ArrayAtResult,
  ValidateArrayAtArgument,
} from './array-at-types.ts';
import { runtimeIndexOrThrow, } from './runtime-index.ts';

/**
 * Returns assigned array element at positive or negative index.
 *
 * Fixed tuples and literal indices resolve to exact element types. Plain
 * `number` indices require proof through {@link asSafeInteger},
 * {@link assertSafeInteger}, or {@link isSafeInteger}. Runtime validation
 * remains authoritative for dynamic arrays, mutation, and actual sparse slots.
 *
 * @param argument - Correlated array and requested signed index
 *
 * @returns Exact selected element when statically knowable
 *
 * @throws {@link ArrayAtError} with unordered runtime diagnostics when access fails
 *
 * @example
 * ```ts
 * const last = arrayAt({ array: [10, 20, 30], index: -1, });
 * // last has type 30.
 * ```
 */
export function arrayAt<const Argument extends ArrayAtArgument>(
  argument: Argument & ValidateArrayAtArgument<Argument>,
): ArrayAtResult<Argument> {
  const { array, index, } = argument as ArrayAtArgument;
  const resolvedIndex = runtimeIndexOrThrow({ array, index, });
  return array[resolvedIndex] as ArrayAtResult<Argument>;
}
