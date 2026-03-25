/**
 * Primitive input validation helpers for task API handlers.
 *
 * The large `parseTaskUpdateInput` function lives in `tasks-parse-update.ts`.
 */
import {
  TASK_PRIORITIES,
  type TaskPriority,
} from '../../lib/types.ts';

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>(TASK_PRIORITIES,);

/**
 * Narrows `unknown` to a plain object for property access.
 *
 * @param value - Value to check
 *
 * @returns True when value is a non-null object
 */
export function isRecord(value: unknown,): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extracts a trimmed, non-empty string array from untrusted input.
 *
 * @param value - Raw input that may be an array
 *
 * @returns Parsed array, or `null` when the input is not an array
 */
export function parseStringArray(value: unknown,): string[] | null {
  if (!Array.isArray(value,))
    return null;
  const parsedValues = value
    .filter(function isString(entry,): entry is string {
      return typeof entry === 'string';
    },)
    .map(function trimEntry(entry,) {
      return entry.trim();
    },)
    .filter(function isNonEmpty(entry,) {
      return entry.length > 0;
    },);
  return parsedValues;
}

/**
 * Parses a nullable enum field (priority or complexity) from untrusted input.
 * Returns `undefined` when the value is absent or not a recognized member,
 * `null` when explicitly cleared, or the validated string otherwise.
 *
 * @param value - Raw input value
 *
 * @param validValues - Set of recognized enum strings
 *
 * @returns Validated enum value, null, or undefined
 */
export function parseEnumValue<T extends string,>(
  value: unknown,
  validValues: Set<string>,
): T | null | undefined
{
  if (value === undefined)
    return undefined;
  if (value === null)
    return null;
  if (typeof value !== 'string')
    return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
  return validValues.has(value,) ? (value as T) : undefined;
}

/**
 * Returns the recognized priority/complexity values set for use by API handlers.
 *
 * @returns Set of recognized priority strings
 */
export function getPriorities(): Set<string> {
  return priorities;
}
