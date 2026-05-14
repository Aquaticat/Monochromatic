/**
 * Generic input validation and parsing helpers for API handlers.
 *
 * Pure functions with no task-domain coupling. Task-specific parsing
 * lives in task-validation-update.ts.
 */

/**
 * Narrows `unknown` to a plain object for property access.
 *
 * @param value - Value to check
 *
 * @returns True when value is a non-null object
 *
 * @example
 * ```ts
 * if (!isRecord(body)) return null;
 * ```
 */
export function isRecord(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Extracts a trimmed, non-empty string array from untrusted input.
 *
 * @param value - Raw input that may be an array
 *
 * @returns Parsed array, or `null` when the input is not an array
 *
 * @example
 * ```ts
 * const tags = parseStringArray(body.tags); // ['shopping', 'errands'] or null
 * ```
 */
export function parseStringArray(value: unknown,): string[] | null {
  if (!Array.isArray(value,))
    return null;

  return value
    .filter(function isString(entry,): entry is string {
      return (typeof entry) === 'string';
    },)
    .map(function trimEntry(entry,) {
      return entry.trim();
    },)
    .filter(function isNonEmpty(entry,) {
      return entry.length > 0;
    },);
}

/**
 * Parses a nullable enum field from untrusted input.
 *
 * @param value - Raw input value
 *
 * @param validValues - Set of recognized enum strings
 *
 * @returns Validated enum value, null, or undefined
 *
 * @example
 * ```ts
 * const priority = parseEnumValue<TaskPriority>({ value: body.priority, validValues: validPriorities });
 * ```
 */
export function parseEnumValue<T extends string,>(
  {
    value,
    validValues,
  }: {
    value: unknown;
    validValues: Set<string>;
  },
): T | null | undefined {
  if (value === undefined)
    return undefined;
  if (value === null)
    return null;
  if ((typeof value) !== 'string')
    return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
  return validValues.has(value,) ? (value as T) : undefined;
}
