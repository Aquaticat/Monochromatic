import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';

/**
 * Removes all occurrences of patterns matching the regex trimmer from the end of the input string.
 *
 * Repeatedly removes matching patterns from the end until no more matches are found.
 * The regex pattern is applied using Unicode-aware string segmentation for proper character handling.
 *
 * @param str - to trim from the end
 *
 * @param trimmer - regex pattern to match and remove from the end
 *
 * @returns String with all trailing occurrences matching the regex pattern removed
 *
 * @throws Error If trimmer is an empty regex or invalid regex pattern
 *
 * @example
 * ```ts
 * $({ str: 'abc123def123', trimmer: /\d+/g }); // 'abc123def'
 * $({ str: 'Hello World   ', trimmer: /\s+/g }); // 'Hello World'
 * $({ str: 'path/to/file///', trimmer: /\//g }); // 'path/to/file'
 * $({ str: 'Textsuffixsuffix', trimmer: /suffix/g }); // 'Text'
 * $({ str: 'StringSUFFIX', trimmer: /suffix/ig }); // 'String' (case insensitive)
 * $({ str: 'bcaaa', trimmer: /a+/g }); // 'bc'
 * $({ str: 'String', trimmer: /prefix/g }); // 'String' (no change)
 *
 * // Multiple consecutive patterns are removed
 * $({ str: 'file.txt.txt.txt', trimmer: /\.txt/g }); // 'file'
 *
 * // Unicode-aware matching
 * $({ str: 'Hello世界世界', trimmer: /世界/g }); // 'Hello世界'
 * $({ str: 'test🚀🚀', trimmer: /🚀+/g }); // 'test'
 *
 * // Edge cases
 * $({ str: '', trimmer: /anything/g }); // ''
 * $({ str: 'unchanged', trimmer: /different/g }); // 'unchanged'
 * ```
 *
 * @example
 * Common use cases for pattern-based trimming:
 * ```ts
 * // Remove trailing whitespace variations
 * $({ str: 'Hello\t\n  ', trimmer: /[\s\t\n]+/g }); // 'Hello'
 *
 * // Remove trailing numbers
 * $({ str: 'abc123', trimmer: /\d+/g }); // 'abc'
 * $({ str: 'abc00123', trimmer: /\d{0,}0+/g }); // 'abc'
 *
 * // Remove repeated suffixes with patterns
 * $({ str: 'middleTESTTest', trimmer: /Test/gi }); // 'middle'
 *
 * // Remove file extension patterns
 * $({ str: 'document.backup.backup', trimmer: /\.backup/g }); // 'document'
 * ```
 *
 * Note: For trimming from the start of strings with regex patterns, use the corresponding trimStartWith function
 * which follows the same pattern but removes from the start of the string.
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
  /**
   * All regex matches as an iterator; consumed once below into an array for reverse traversal.
   */
  const matches = str.matchAll(trimmer,);

  /**
   * Matches reversed so the scan walks inward from the string's end.
   */
  const matchArray = [...matches,].toReversed();

  /**
   * Running count of characters to strip from the end as consecutive trailing matches are confirmed; held on an object so the function root stays const-only.
   */
  const trimState = { totalTrimLength: 0, };

  // Process matches in reverse order to find consecutive trailing matches
  for (const match of matchArray) {
    // Index 0: the full matched text
    // Index 1+: captured groups (parentheses parts)
    // Extra properties: index (position), input (original string)
    /**
     * Start offset of this match in the original string.
     */
    const matchIndex = match.index;
    /**
     * Length of the matched substring; added to `trimState.totalTrimLength` when the match abuts the current trim boundary.
     */
    const matchLength = match[0]
      .length;

    /**
     * Exclusive end offset of this match; used to detect whether it abuts the current trim boundary.
     */
    const matchEndsAt = matchIndex + matchLength;
    /**
     * Current trim boundary; matches must end exactly here to count as consecutive trailing matches.
     */
    const currentBoundary = str.length
      - trimState
      .totalTrimLength;

    // If match doesn't end exactly at the current trim boundary, stop
    if (matchEndsAt !== currentBoundary)
      break;

    // Add this match length to total trim
    trimState.totalTrimLength += matchLength;
  }

  // Return string with all consecutive trailing matches removed
  return str.slice(
    0,
    str.length
      - trimState
      .totalTrimLength,
  );
}
