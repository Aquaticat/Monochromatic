import type { ProducerInputComparisonChildObservation, } from './producer-input-comparison-child.ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';

//region Closed output metadata and native namespace grammar

/**
 * Input runs use the existing fixed native prefix.
 */
export const RUN_PREFIX = 'producer-input-';
/**
 * Namespace grammar is structural identity only, not creation authentication.
 */
const UUID_PREFIX_WIDTH = 8;
/**
 * Interior UUID groups retain the same hexadecimal width.
 */
const UUID_INTERIOR_WIDTH = 4;
/**
 * Final UUID group width is checked independently of version and variant.
 */
const UUID_SUFFIX_WIDTH = 12;
/**
 * Fixed namespace spelling is validated without accepting alternate separators.
 */
const UUID_GROUP_WIDTHS = [
  UUID_PREFIX_WIDTH,
  UUID_INTERIOR_WIDTH,
  UUID_INTERIOR_WIDTH,
  UUID_INTERIOR_WIDTH,
  UUID_SUFFIX_WIDTH,
] as const;
/**
 * Reads closed JSON metadata without forwarding native parser messages.
 *
 * @param text - bounded private native metadata
 *
 * @param keys - exact role-specific keys
 *
 * @param directory - owned comparison evidence locator
 *
 * @returns Owned parsed fields for explicit binding checks
 *
 * @throws ProducerInputComparisonError when syntax or closed shape differs
 *
 * @example
 * ```ts
 * const frame = comparisonMetadata({ text, keys, directory });
 * ```
 */
export function comparisonMetadata({
  text,
  keys,
  directory,
}: {
  readonly text: string;
  readonly keys: readonly string[];
  readonly directory: string;
},): Readonly<Record<string, unknown>> {
  try {
    /**
     * Native JSON parsing does not expose caller getters or prototype methods.
     */
    const value: unknown = JSON.parse(text);
    if (((typeof value) !== 'object') || (value === null)
      || Array.isArray(value))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory
      });
    /**
     * Unknown fields cannot become execution or review authority.
     */
    const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
    if ((Object.keys(fields)
      .length
      !== keys.length) || (!keys.every(function present(key): boolean { return Object.hasOwn(
        fields,
        key
      ); })))
      throw new ProducerInputComparisonError({
        kind: 'output',
        directory
      });
    return fields;
  }
  catch (error) {
    if (Error.isError(error) && (error instanceof ProducerInputComparisonError))
      throw error;
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory
    });
  }
}

/**
 * Checks bounded ASCII identity syntax without code-point or grapheme iteration.
 *
 * @param value - decoded identity or UUID group
 *
 * @param length - fixed width required by its role
 *
 * @returns Whether exact width and lowercase hexadecimal spelling both match
 *
 * @example
 * ```ts
 * const valid = comparisonHex({ value, length: CONTAINER_ID_WIDTH });
 * ```
 */
export function comparisonHex({
  value,
  length
}: {
  readonly value: unknown;
  readonly length: number;
},): boolean {
  if (((typeof value) !== 'string') || (value.length !== length))
    return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index)))
      return false;
  }
  return true;
}

/**
 * Requires one directory with the native canonical UUIDv4 spelling before constructing a retained path.
 *
 * @param observation - bounded direct-child metadata from the dedicated native output parent
 *
 * @param directory - comparison evidence locator for a refusal
 *
 * @returns Canonical input-run identity without granting creation authenticity
 *
 * @throws ProducerInputComparisonError when observation or namespace grammar differs
 *
 * @example
 * ```ts
 * const runId = comparisonInputRunId({ observation, directory });
 * ```
 */
export function comparisonInputRunId({
  observation,
  directory,
}: {
  readonly observation: ProducerInputComparisonChildObservation;
  readonly directory: string;
},): string {
  /**
   * The single-child branch must still prove that its entry is a directory.
   */
  const [child] = observation.children;
  if ((observation.state !== 'single') || (!observation.completeEnumeration)
    || (observation.children
      .length
      !== 1)
    || (child === undefined)
    || (child.kind !== 'directory')
    || (!child.name
      .startsWith(RUN_PREFIX)))
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory
    });
  /**
   * Removing a fixed prefix does not normalize the identifier.
   */
  const runId = child.name
    .slice(RUN_PREFIX.length);
  /**
   * Exact group widths prevent traversal and alternate UUID spellings.
   */
  const groups = runId.split('-');
  /**
   * Presence, version and variant remain explicit independently of the group-width check.
   */
  const [version, variant] = groups.slice(2);
  if ((groups.length !== UUID_GROUP_WIDTHS.length)
    || (!UUID_GROUP_WIDTHS.every(function validGroup(
      width,
      index
    ): boolean {
      return comparisonHex({
        value: groups[index],
        length: width,
      });
    }))
    || (version === undefined)
    || (!version.startsWith('4'))
    || (variant === undefined)
    || (!'89ab'.includes(variant.charAt(0))))
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory
    });
  return runId;
}

//endregion Closed output metadata and native namespace grammar
