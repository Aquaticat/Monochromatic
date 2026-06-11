import type {
  $ as Value,
} from '@_/types/t object/t record/t p string/t rangeNumber/t int/t/index.ts';
import type {
  $ as DoubleQuote,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t/index.ts';

/**
 * Determines if a range position is inside double quotes for multiple strings and merges with existing quote information.
 *
 * For each string, uses quote parity logic: odd count of effective quotes before position indicates inside quotes,
 * even count indicates outside quotes. Handles escaped backslashes properly to distinguish
 * between escaped quotes (`\"`) and quotes following escaped backslashes (`\\\"`).
 *
 * Assumes all input strings are well-formed with even total number of effective quotes (all quotes properly paired).
 *
 * @param value - Range object with startInclusive position to check
 *
 * @param strs - Array of double-quoted syntax strings to analyze
 *
 * @returns Updated Value object with merged quote status information in the inQuotes map
 *
 * @example
 * ```ts
 * const range = { startInclusive: 1, endInclusive: 1, __brand: { rangeNumber: true } };
 * const strings = ['"hello"', 'world"test"'] as DoubleQuote[];
 * const result = $(range, strings);
 * // result.__brand.inQuotes will contain the quote status for each string
 * ```
 */
export function $({
  value,
  strs,
}: {
  value: Value;
  strs: DoubleQuote[];
},): Value {
  // Create new map for quote status results
  /**
   * Per-string in-quotes verdicts computed in this call.
   */
  const newQuoteStatusMap = new Map<string, boolean>();

  // For each string, check if effective (unescaped) quotes before value.startInclusive are evenly paired
  for (const str of strs) {
    /**
     * Substring up to the start index used to count preceding quotes.
     */
    const strBefore = str.slice(
      0,
      value.startInclusive,
    );

    // Count effective double quotes using regex that handles escaped quotes properly
    /**
     * Count of unescaped quotes preceding the start index.
     */
    // oxlint-disable-next-line no-restricted-syntax/no-regex -- canonical unescaped-quote enumeration; the lookbehind `(?<!\\)(?:\\\\)*` matches a `"` not preceded by an odd number of backslashes — expressing the escape-counting rule via index walk is significantly more code and equally bounded. Input length bounds runtime linearly; no nested quantifiers, no backtracking.
    const effectiveDoubleQuotesInStrBefore = [...strBefore
      .matchAll(/(?<!\\)(?:\\\\)*"/g,),]
      .length;

    // Odd count means inside quotes, even count means outside quotes
    /**
     * Parity verdict for whether the range starts inside a quoted span.
     */
    const isInsideQuotes = (effectiveDoubleQuotesInStrBefore % 2) !== 0;

    // Use the original branded string as the key
    newQuoteStatusMap.set(
      str,
      isInsideQuotes,
    );
  }

  // Merge new map with original
  /**
   * Pre-existing quote map carried on the input, defaulted to empty when absent.
   */
  const existingQuoteMap = value.__brand
    .inQuotes
    ?? new Map<string, boolean>();
  /**
   * Combined map preferring fresh per-string verdicts over the pre-existing entries.
   */
  const mergedQuoteMap = new Map<string, boolean>([
    ...existingQuoteMap,
    ...newQuoteStatusMap,
  ],);

  return {
    ...value,
    __brand: {
      ...value.__brand,
      inQuotes: mergedQuoteMap,
    },
  };
}
