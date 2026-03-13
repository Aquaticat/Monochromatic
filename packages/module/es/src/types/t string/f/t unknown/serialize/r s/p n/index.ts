import decircular from 'decircular';

import type { Serializer, } from '../../../../../../t object/t store/t/index.ts';
import { $ as hasCycle, } from '../../../../../../t boolean/f/t unknown/hasCycle/r s/p p/index.ts';
import { $ as defaultLogger, } from '../../../../../../t object/t logger/f/t never/r s/p p/index.ts';

/** Max characters for value previews in log messages. */
const DEFAULT_LOG_LIMIT = 100;

/**
 * Named-parameter options for value serialization with cycle handling.
 *
 * @example
 * ```ts
 * const opts: SerializeOptions = {
 *   value: { x: 1 },
 *   serializer: JSON.stringify,
 *   lossyForCircular: true,
 * };
 * ```
 */
export type SerializeOptions = {
  /** Input data to serialize. */
  value: unknown;
  /** Serialization function that converts a value to a string. */
  serializer: Serializer;
  /**
   * When `true`, cyclic graphs are decycled and persisted lossy
   * instead of throwing. When `false`, throws `TypeError` on cycles.
   */
  lossyForCircular: boolean;
};

/**
 * Serialize a value for storage, handling cyclic graphs based on configuration.
 *
 * When the value contains circular references and `lossyForCircular` is `true`,
 * the value is decycled (lossy) and a warning is logged. When `lossyForCircular`
 * is `false`, a `TypeError` is thrown instead.
 *
 * @param options - serialization configuration
 *
 * @returns serialized string representation
 *
 * @throws TypeError when value has cycles and `lossyForCircular` is `false`
 *
 * @example
 * Acyclic value:
 * ```ts
 * const serialized = $({
 *   value: { x: 1 },
 *   serializer: JSON.stringify,
 *   lossyForCircular: true,
 * });
 * // '{"x":1}'
 * ```
 *
 * @example
 * Cyclic value with lossy allowed:
 * ```ts
 * const obj: Record<string, unknown> = { a: 1 };
 * obj.self = obj;
 * const serialized = $({
 *   value: obj,
 *   serializer: JSON.stringify,
 *   lossyForCircular: true,
 * });
 * // Logs warning, returns decycled serialization
 * ```
 *
 * @example
 * Cyclic value with lossy disallowed:
 * ```ts
 * const obj: Record<string, unknown> = {};
 * obj.self = obj;
 * $({
 *   value: obj,
 *   serializer: JSON.stringify,
 *   lossyForCircular: false,
 * });
 * // throws TypeError
 * ```
 */
export function $(options: SerializeOptions,): string {
  const { value, serializer, lossyForCircular, } = options;

  if (hasCycle(value,)) {
    const decycled = decircular(value as object,);
    const serialized = serializer(decycled,);
    if (!lossyForCircular) {
      throw new TypeError(
        `Cannot store value perfectly because it has cycles: ${serialized.slice(0, DEFAULT_LOG_LIMIT,)}`,
      );
    }
    defaultLogger.warn(
      `Value has cycles, storing decycled version: ${serialized.slice(0, DEFAULT_LOG_LIMIT,)}`,
    );
    return serialized;
  }
  return serializer(value,);
}
