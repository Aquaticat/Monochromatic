export type Jsonl = string & { __brand: 'Jsonl'; };

/**
 * Type guard that checks if a value is a valid JSON Lines string.
 *
 * JSON Lines format requires each line to be a complete valid JSON object.
 * Empty lines are allowed. Lines are separated by newlines.
 *
 * @param value - Value to test for JSON Lines format compliance
 * @returns True if value is a valid JSON Lines string, false otherwise
 * @example
 * ```ts
 * isJsonl(''); // true
 * isJsonl('{}'); // true
 * isJsonl('{}\n{}'); // true
 * isJsonl('{'); // false
 * isJsonl('true'); // false
 * isJsonl('{}{}'); // false
 * isJsonl('[]'); // false
 * ```
 */
export function isJsonl(value: unknown,): value is Jsonl {
  // Check if value is a string
  if (typeof value !== 'string')
    return false;

  // Empty string is valid
  if (value === '')
    return true;

  // Split by newlines and validate each line
  const lines = value.split('\n',);

  // Iteration is okay here because it's a relatively small operation and write it in a non-iteration way won't improve performance.
  for (const line of lines) {
    // Empty lines are valid
    if (line === '')
      continue;

    // Try to parse each line as JSON
    try {
      const parsed: unknown = JSON.parse(line,);
      // Check if parsed value is a plain object
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed,))
        return false;
    }
    catch {
      // If parsing fails, it's not valid JSON
      return false;
    }
  }

  return true;
}
