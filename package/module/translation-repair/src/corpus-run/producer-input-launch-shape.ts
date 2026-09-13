import {
  isAbsolute,
  resolve,
} from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';

/**
 * Narrows native JSON objects without asserting a record type over arbitrary objects or arrays.
 *
 * @param value - decoded launch field
 *
 * @returns Whether named JSON fields can be inspected
 *
 * @example
 * ```ts
 * if (isLaunchRecord(value)) inspect(value.version);
 * ```
 */
function isLaunchRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value));
}

/**
 * Reads one JSON object only when its exact fixed key set is present.
 *
 * @param value - decoded launch field
 *
 * @param keys - fixed keys owned by this launch schema
 *
 * @param locator - authored field name for a privacy-safe refusal
 *
 * @returns Original JSON record after closed-shape validation
 *
 * @throws ProducerInputRunError when required keys or object shape differ
 *
 * @example
 * ```ts
 * const runtime = launchRecord({ value, keys: ['dir', 'manifest'], locator: 'launch.runtime' });
 * ```
 */
export function launchRecord({
  value,
  keys,
  locator,
}: {
  readonly value: unknown;
  readonly keys: readonly string[];
  readonly locator: string;
},): Readonly<Record<string, unknown>> {
  if (!isLaunchRecord(value))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  /**
   * Native JSON object keys cannot silently add a command, mode, mount or environment override.
   */
  const actual = Object.keys(value);
  if ((actual.length !== keys.length) || (!actual.every(function expected(key): boolean {
    return keys.includes(key);
  })))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}

/**
 * Validates fixed-width lowercase hexadecimal identity without a regular-expression parser.
 *
 * @param value - untrusted JSON identity field
 *
 * @param length - exact width of the owning digest domain
 *
 * @param locator - authored field name
 *
 * @returns Original canonical identity spelling
 *
 * @throws ProducerInputRunError when identity grammar differs
 *
 * @example
 * ```ts
 * const sha256 = launchHex({ value, length: 64, locator: 'launch.bootstrap.sha256' });
 * ```
 */
export function launchHex({
  value,
  length,
  locator,
}: {
  readonly value: unknown;
  readonly length: number;
  readonly locator: string;
},): string {
  if (((typeof value) !== 'string') || (value.length !== length))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index)))
      throw new ProducerInputRunError({
        operation: 'read-launch',
        locator,
      });
  }
  return value;
}

/**
 * Reads a safe exact byte allowance rather than silently rounding JSON numbers.
 *
 * @param value - untrusted extent
 *
 * @param locator - authored field name
 *
 * @returns Nonnegative safe integer extent
 *
 * @throws ProducerInputRunError when extent cannot bound an exact file read
 *
 * @example
 * ```ts
 * const bytes = launchBytes({ value, locator: 'launch.selection.bytes' });
 * ```
 */
export function launchBytes({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): number {
  if (((typeof value) !== 'number') || (!Number.isSafeInteger(value))
    || (value < 0))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}

/**
 * Refuses relative or lexically changing locators before mount construction.
 * Filesystem canonicalization and ownership remain host checks, not claims made by this parser.
 *
 * @param value - untrusted path field
 *
 * @param locator - authored field name
 *
 * @returns Absolute lexically canonical path
 *
 * @throws ProducerInputRunError when path syntax differs
 *
 * @example
 * ```ts
 * const dir = launchPath({ value, locator: 'launch.runtime.dir' });
 * ```
 */
export function launchPath({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): string {
  if (((typeof value) !== 'string') || (!isAbsolute(value))
    || value.includes('\0')
    || (resolve(value) !== value))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}
