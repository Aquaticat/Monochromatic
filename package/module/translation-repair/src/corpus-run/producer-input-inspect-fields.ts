import { isDeepStrictEqual, } from 'node:util';
import { ProducerInputRunError, } from './producer-input-error.ts';

/**
 * Narrows native JSON objects without accepting arrays as maps.
 *
 * @param value - decoded native metadata
 *
 * @returns Whether named fields can be inspected
 *
 * @example
 * ```ts
 * if (record(value)) inspect(value.Id);
 * ```
 */
export function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value));
}

/**
 * Reads exactly one native inspection object with fixed diagnostics.
 *
 * @param text - bounded native stdout
 *
 * @returns Owned decoded inspection record
 *
 * @throws ProducerInputRunError when native metadata does not have the expected envelope
 *
 * @example
 * ```ts
 * const inspection = inspectionRecord(text);
 * ```
 */
export function inspectionRecord(text: string): Readonly<Record<string, unknown>> {
  try {
    /**
     * Native JSON is data, never a script or configuration import.
     */
    const decoded: unknown = JSON.parse(text);
    if (!Array.isArray(decoded))
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: 'container inspection envelope',
      });
    /**
     * Keep untrusted row types unknown after the native array check.
     */
    const rows: readonly unknown[] = decoded;
    /**
     * No extra inspection result can silently change the selected container.
     */
    const [value] = rows;
    if ((rows.length !== 1) || (!record(value)))
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: 'container inspection envelope',
      });
    return value;
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'container inspection JSON',
    });
  }
}

/**
 * Checks one named metadata field without printing its supplied value.
 *
 * @param fields - native metadata object
 *
 * @param name - fixed field label
 *
 * @param expected - value independently derived from the initialized host
 *
 * @throws ProducerInputRunError when a binding differs
 *
 * @example
 * ```ts
 * fieldMatches({ fields, name: 'Image', expected: host.launch.imageId });
 * ```
 */
export function fieldMatches({
  fields,
  name,
  expected,
}: {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly expected: unknown
},): void {
  if (!isDeepStrictEqual(
    fields[name],
    expected
  ))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: `container field ${name}`,
    });
}

/**
 * Reads a complete string-list field before treating its ordering as irrelevant.
 *
 * @param value - native field value
 *
 * @param name - fixed field label
 *
 * @returns Detached string values in lexical order
 *
 * @throws ProducerInputRunError when list shape differs
 *
 * @example
 * ```ts
 * const values = strings({ value, name: 'Env' });
 * ```
 */
export function strings({
  value,
  name,
}: {
  readonly value: unknown;
  readonly name: string
},): readonly string[] {
  if (!Array.isArray(value))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: `container field ${name}`,
    });
  /**
   * Values remain unknown until checked, including holes and unexpected element types.
   */
  const rows: readonly unknown[] = value;
  return rows.map(function text(item): string {
    if ((typeof item) !== 'string')
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: `container field ${name}`,
      });
    return item;
  })
    .toSorted();
}
