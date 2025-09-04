/**
 * Removes all occurrences of trimmer string from the start of the input string.
 *
 * Repeatedly removes the trimmer from the start until no more matches are found.
 * Case-sensitive matching is used for trimmer detection.
 *
 * @param str - to trim from the start
 * @param trimmer - substring to remove from the start
 * @returns String with all leading occurrences of trimmer removed
 * @throws Error If trimmer is an empty string
 *
 * @example
 * ```ts
 * $({ str: 'PrefixString', trimmer: 'Prefix' }); // 'String'
 * $({ str: 'PrefixPrefixText', trimmer: 'Prefix' }); // 'Text'
 * $({ str: 'aaabc', trimmer: 'a' }); // 'abc'
 * $({ str: 'String', trimmer: 'suffix' }); // 'String' (no change)
 *
 * // Multiple consecutive trimmers are removed
 * $({ str: '.txt.txt.txtfile', trimmer: '.txt' }); // 'file'
 *
 * // Case sensitive matching
 * $({ str: 'PREFIXString', trimmer: 'prefix' }); // 'PREFIXString' (no change)
 * $({ str: 'PREFIXString', trimmer: 'PREFIX' }); // 'String'
 *
 * // Edge cases
 * $({ str: '', trimmer: 'anything' }); // ''
 * $({ str: 'unchanged', trimmer: '' }); // throws Error
 * $({ str: 'same', trimmer: 'different' }); // 'same'
 * ```
 *
 * @example
 * Common use cases for path and URL handling:
 * ```ts
 * // Remove leading slashes from paths
 * $({ str: '/path/to/file', trimmer: '/' }); // 'path/to/file'
 * $({ str: '///directory/path', trimmer: '/' }); // 'directory/path'
 *
 * // Clean file extensions
 * $({ str: 'backup.backup.document', trimmer: 'backup.' }); // 'document'
 *
 * // Remove repeated prefixes
 * $({ str: 'TestTesttest', trimmer: 'Test' }); // 'test'
 * ```
 *
 * Note: For trimming from the end of strings, use the corresponding trimEndWith function
 * which follows the same pattern but removes from the end of the string.
 */
export function $({ str, trimmer, }: { str: string; trimmer: string; },): string {
  if (trimmer === '')
    throw new Error('trimmer cannot be empty',);
  if (!str.startsWith(trimmer,))
    return str;

  // Use Intl.Segmenter for proper Unicode-aware string segmentation
  /** Segmenter for Unicode-aware string segmentation */
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme', },);
  /** Segmented trimmer string as array of graphemes */
  const trimmerSegments = Array.from(segmenter.segment(trimmer,),
    segment => segment.segment,);

  /** Working copy of the input string being modified */
  let modifyingString = str;
  while (modifyingString.startsWith(trimmer,)) {
    /** Segmented main string as array of graphemes */
    const stringSegments = Array.from(segmenter.segment(modifyingString,), segment =>
      segment.segment,);
    modifyingString = stringSegments
      .slice(trimmerSegments.length,)
      .join('',);
  }
  return modifyingString;
}
