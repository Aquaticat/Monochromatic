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
  // Base case: if TTL is exhausted, return current string to prevent infinite recursion
  // TODO: If ttl is <0, something's wrong, throw error.
  if (context.ttl <= 0)
    return str;

  // Create a copy of the regex with global flag and anchored to start
  // TODO: Do we really need this? Is there a better way?
  const globalRegex = new RegExp(trimmer.source,
    trimmer.flags.includes('g',) ? trimmer.flags : trimmer.flags + 'g',);
  const startAnchoredRegex = new RegExp('^' + globalRegex.source, globalRegex.flags,);

  // Find the longest match at the start
  const match = str.match(startAnchoredRegex,);

  // Base case: if no match or empty match, return the string as-is
  // TODO: Is empty match really "good"?
  if (!match || match[0] === '')
    return str;

  // Use Intl.Segmenter for proper Unicode-aware string segmentation
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme', },);

  // Segment the string and remove the matched portion
  const stringSegments = Array.from(segmenter.segment(str,), segment => segment.segment,);
  const matchSegments = Array.from(segmenter.segment(match[0],),
    segment => segment.segment,);

  // Remove the matched portion and recursively process the result
  const remainingString = stringSegments
    .slice(matchSegments.length,)
    .join('',);

  // Recursive call with decremented TTL
  return $({
    str: remainingString,
    trimmer,
    context: { ttl: context.ttl - 1, },
  },);
}
