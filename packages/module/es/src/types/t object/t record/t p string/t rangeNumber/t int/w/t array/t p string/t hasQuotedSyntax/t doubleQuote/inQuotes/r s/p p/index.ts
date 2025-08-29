import type {
  $ as DoubleQuote,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t/index.ts';
import type { $ as Value, } from '../../../../../../../../t/index.ts';

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
 * @param strs - Array of double-quoted syntax strings to analyze
 * @returns Updated Value object with merged quote status information in the inQuotes map
 * @example
 * ```ts
 * const range = { startInclusive: 1, endInclusive: 1, __brand: { rangeNumber: true } };
 * const strings = ['"hello"', 'world"test"'] as DoubleQuote[];
 * const result = $(range, strings);
 * // result.__brand.inQuotes will contain the quote status for each string
 * ```
 */
export function $(value: Value, strs: DoubleQuote[],): Value {
  // Create new map for quote status results
  const newQuoteStatusMap = new Map<string, boolean>();

  // For each string, check if effective (unescaped) quotes before value.startInclusive are evenly paired
  for (const str of strs) {
    const strBefore = str.slice(0, value.startInclusive,);

    // Count effective double quotes using regex that handles escaped quotes properly
    const effectiveDoubleQuotesInStrBefore = Array
      .from(strBefore.matchAll(/(?<!\\)(?:\\\\)*"/g,),)
      .length;

    // Odd count means inside quotes, even count means outside quotes
    const isInsideQuotes = effectiveDoubleQuotesInStrBefore % 2 !== 0;

    // Use the original branded string as the key
    newQuoteStatusMap.set(str, isInsideQuotes,);
  }

  // Merge new map with original
  const existingQuoteMap = value.__brand.inQuotes || new Map<string, boolean>();
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
