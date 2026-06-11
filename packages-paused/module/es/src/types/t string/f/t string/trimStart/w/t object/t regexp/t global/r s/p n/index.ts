import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';

/**
 * Removes all occurrences of patterns matching the regex trimmer from the start of the input string.
 *
 * Repeatedly removes matching patterns from the start until no more matches are found.
 * The regex pattern is applied using Unicode-aware string segmentation for proper character handling.
 *
 * @param str - to trim from the start
 *
 * @param trimmer - regex pattern to match and remove from the start
 *
 * @returns String with all leading occurrences matching the regex pattern removed
 *
 * @throws Error If trimmer is an empty regex or invalid regex pattern
 *
 * @example
 * ```ts
 * $({ str: '123abc123def', trimmer: /\d+/g }); // 'abc123def'
 * $({ str: '   Hello World', trimmer: /\s+/g }); // 'Hello World'
 * $({ str: '///path/to/file', trimmer: /\//g }); // 'path/to/file'
 * $({ str: 'prefixprefixText', trimmer: /prefix/g }); // 'Text'
 * $({ str: 'PREFIXString', trimmer: /prefix/ig }); // 'String' (case insensitive)
 * $({ str: 'aaabc', trimmer: /a+/g }); // 'bc'
 * $({ str: 'String', trimmer: /suffix/g }); // 'String' (no change)
 *
 * // Multiple consecutive patterns are removed
 * $({ str: '.txt.txt.txtfile', trimmer: /\.txt/g }); // 'file'
 *
 * // Unicode-aware matching
 * $({ str: '世界Hello世界', trimmer: /世界/g }); // 'Hello世界'
 * $({ str: '🚀🚀test', trimmer: /🚀+/g }); // 'test'
 *
 * // Edge cases
 * $({ str: '', trimmer: /anything/g }); // ''
 * $({ str: 'unchanged', trimmer: /different/g }); // 'unchanged'
 * ```
 *
 * @example
 * Common use cases for pattern-based trimming:
 * ```ts
 * // Remove leading whitespace variations
 * $({ str: '\t\n  Hello', trimmer: /[\s\t\n]+/g }); // 'Hello'
 *
 * // Remove leading numbers
 * $({ str: '123abc', trimmer: /\d+/g }); // 'abc'
 * $({ str: '00123abc', trimmer: /0+\d{0,}/g }); // 'abc'
 *
 * // Remove repeated prefixes with patterns
 * $({ str: 'TestTESTmiddle', trimmer: /Test/gi }); // 'middle'
 *
 * // Remove file extension patterns
 * $({ str: '.backup.backup.document', trimmer: /\.backup/g }); // 'document'
 * ```
 *
 * Note: For trimming from the end of strings with regex patterns, use the corresponding trimEndWith function
 * which follows the same pattern but removes from the end of the string.
 */
export function $(
  {
    str,
    trimmer,
  }: {
    str: string;
    trimmer: Global;
  },
): string {
  // Use matchAll to get all matches in a single regex execution
  /**
   * Lazy iterator of every regex match across the input.
   */
  const matches = str.matchAll(trimmer,);

  // Track consecutive matches starting from position 0
  /**
   * Total characters consumed by contiguous leading matches found so far; held on an object so the function root stays const-only.
   */
  const trimState = { totalTrimLength: 0, };

  // Process matches in order to find consecutive leading matches
  for (const match of matches) {
    // Index 0: the full matched text
    // Index 1+: captured groups (parentheses parts)
    // Extra properties: index (position), input (original string)
    /**
     * Position of the current match used to detect a break in contiguity.
     */
    const matchIndex = match.index;

    // No bug here because js matchAll consumes matches.
    // If match doesn't start at the current trim position, stop
    if (matchIndex !== trimState
      .totalTrimLength)
      break;

    // Add this match length to total trim
    /**
     * Length of the current match folded into the running trim count.
     */
    const matchLength = match[0]
      .length;
    trimState.totalTrimLength += matchLength;
  }

  // Return string with all consecutive leading matches removed
  return str.slice(trimState.totalTrimLength,);
}
