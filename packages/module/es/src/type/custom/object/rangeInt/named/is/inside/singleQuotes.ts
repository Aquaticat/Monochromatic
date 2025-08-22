import type { $ as rangeInt, } from '../../../unnamed/index.ts';

// assume str is well-formed: even number of effective quotes.
// TODO: Validate str's well-formedness in another type.

/**
 * Determines if a range position is inside single quotes by counting non-escaped quotes preceding it.
 *
 * Uses quote parity logic: odd count of effective quotes before position indicates inside quotes,
 * even count indicates outside quotes. Handles escaped backslashes properly to distinguish
 * between escaped quotes (`\'`) and quotes following escaped backslashes (`\\\'`).
 *
 * Assumes input string is well-formed with even total number of effective quotes (all quotes properly paired).
 *
 * @param value - Range object with startInclusive position to check
 * @param str - String to analyze, assumed to have even number of effective quotes
 * @returns True if position is inside double quotes, false if outside
 * @example
 * ```ts
 * // Position 1 in quoted content
 * doubleQuotes({value: {startInclusive: 1, endInclusive: 1}, str: `'a'`}); // true
 *
 * // Position 0 before any quotes
 * doubleQuotes({value: {startInclusive: 0, endInclusive: 0}, str: `a''`}); // false
 *
 * // Position 3 after opening quotes
 * doubleQuotes({value: {startInclusive: 3, endInclusive: 3}, str: `'''a'`}); // true
 * ```
 */
export function $(
  { value, str, }: { value: rangeInt; str: string; },
): boolean {
  const strBefore = str.slice(0, value.startInclusive,);
  // Odd or even?
  const effectiveSingleQuotesInStrBefore =
    Array.from(strBefore.matchAll(/(?<!\\)(?:\\\\)*'/g,),).length;
  return (effectiveSingleQuotesInStrBefore % 2 !== 0);
}
