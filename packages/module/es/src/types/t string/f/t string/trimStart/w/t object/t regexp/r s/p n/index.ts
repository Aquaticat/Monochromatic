/**
 * Removes all occurrences of patterns matching the regex trimmer from the start of the input string.
 *
 * Repeatedly removes matching patterns from the start until no more matches are found.
 * The regex pattern is applied using Unicode-aware string segmentation for proper character handling.
 *
 * @param str - to trim from the start
 * @param trimmer - regex pattern to match and remove from the start
 * @param context - recursive context with TTL to prevent infinite loops
 * @returns String with all leading occurrences matching the regex pattern removed
 * @throws {Error} If trimmer is an empty regex or invalid regex pattern
 *
 * @example
 * ```ts
 * $({ str: '123abc123def', trimmer: /\d+/ }); // 'abc123def'
 * $({ str: '   Hello World', trimmer: /\s+/ }); // 'Hello World'
 * $({ str: '///path/to/file', trimmer: /\// }); // 'path/to/file'
 * $({ str: 'prefixprefixText', trimmer: /prefix/ }); // 'Text'
 * $({ str: 'PREFIXString', trimmer: /prefix/i }); // 'String' (case insensitive)
 * $({ str: 'aaabc', trimmer: /a+/ }); // 'bc'
 * $({ str: 'String', trimmer: /suffix/ }); // 'String' (no change)
 *
 * // Multiple consecutive patterns are removed
 * $({ str: '.txt.txt.txtfile', trimmer: /\.txt/ }); // 'file'
 *
 * // Unicode-aware matching
 * $({ str: '世界Hello世界', trimmer: /世界/ }); // 'Hello世界'
 * $({ str: '🚀🚀test', trimmer: /🚀+/ }); // 'test'
 *
 * // Edge cases
 * $({ str: '', trimmer: /anything/ }); // ''
 * $({ str: 'unchanged', trimmer: /different/ }); // 'unchanged'
 * ```
 *
 * @example
 * Common use cases for pattern-based trimming:
 * ```ts
 * // Remove leading whitespace variations
 * $({ str: '\t\n  Hello', trimmer: /[\s\t\n]+/ }); // 'Hello'
 *
 * // Remove leading numbers
 * $({ str: '123abc', trimmer: /\d+/ }); // 'abc'
 * $({ str: '00123abc', trimmer: /0+\d{0,}/ }); // 'abc'
 *
 * // Remove repeated prefixes with patterns
 * $({ str: 'TestTesttest', trimmer: /Test+/i }); // 'test'
 *
 * // Remove file extension patterns
 * $({ str: '.backup.backup.document', trimmer: /\.backup/ }); // 'document'
 * ```
 *
 * Note: For trimming from the end of strings with regex patterns, use the corresponding trimEndWith function
 * which follows the same pattern but removes from the end of the string.
 */
export function $(
  { str, trimmer, context = { ttl: 8, }, }: { str: string; trimmer: RegExp;
    context?: { ttl: number; }; },
): string {
  if (context.ttl < 0)
    throw new Error('ttl cannot be negative',);
  // Base case: if TTL is exhausted, return current string to prevent infinite recursion
  if (context.ttl == 0)
    return str;

  // Use trimmer.exec() to find the first match and check if it's at the start
  // TODO: Optimization opportunity here. Get all matches, then read until sequential matches end.
  const match = trimmer.exec(str,);

  // Base case: if no match or match isn't at start position or empty match, return the string as-is
  // Empty matches are treated as invalid - they don't represent actual content to trim
  // and could cause infinite recursion if processed. This is the correct behavior.
  if (!match || match.index !== 0 || match[0] === '')
    return str;

  // Use the match information directly to slice the string
  // This eliminates the need for segmenting both strings and array operations
  const result = str.slice(match[0].length,);

  // Recursively trim the result with the same trimmer and reduced TTL
  return $({ str: result, trimmer, context: { ttl: context.ttl - 1, }, },);
}

//region Trimming Logic -- Optimized implementation using matchAll to get all consecutive matches at once
function n(
  trimmer: RegExp,
  str: string,
  ttl: number,
): string {
  // Handle edge cases
  if (ttl <= 0 || str.length === 0)
    return str;

  // Use matchAll to get all matches in a single regex execution
  const matches = Array.from(str.matchAll(trimmer,),);

  // Track consecutive matches starting from position 0
  let totalTrimLength = 0;

  // Process matches in order to find consecutive leading matches
  for (const match of matches) {
    const matchIndex = match.index ?? 0;

    // If match doesn't start at the current trim position, stop
    if (matchIndex !== totalTrimLength)
      break;

    // Add this match length to total trim
    const matchLength = match[0]?.length ?? 0;
    totalTrimLength += matchLength;
  }

  // Return string with all consecutive leading matches removed
  return totalTrimLength === 0 ? str : str.slice(totalTrimLength,);
}
//endregion Trimming Logic
