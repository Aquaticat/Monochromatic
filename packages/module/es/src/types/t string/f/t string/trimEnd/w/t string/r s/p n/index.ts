/**
 * Removes all occurrences of trimmer string from the end of the input string.
 *
 * Repeatedly removes the trimmer from the end until no more matches are found.
 * Case-sensitive matching is used for trimmer detection.
 *
 * @param str - to trim from the end
 * @param trimmer - substring to remove from the end
 * @returns String with all trailing occurrences of trimmer removed
 * @throws Error If trimmer is an empty string
 *
 * @example
 * ```ts
 * $({ str: 'StringSuffix', trimmer: 'Suffix' }); // 'String'
 * $({ str: 'TextSuffixSuffix', trimmer: 'Suffix' }); // 'Text'
 * $({ str: 'abcaaa', trimmer: 'a' }); // 'abc'
 * $({ str: 'String', trimmer: 'prefix' }); // 'String' (no change)
 *
 * // Multiple consecutive trimmers are removed
 * $({ str: 'file.txt.txt.txt', trimmer: '.txt' }); // 'file'
 *
 * // Case sensitive matching
 * $({ str: 'StringSUFFIX', trimmer: 'suffix' }); // 'StringSUFFIX' (no change)
 * $({ str: 'StringSUFFIX', trimmer: 'SUFFIX' }); // 'String'
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
 * // Remove trailing slashes from URLs
 * $({ str: 'https://example.com/', trimmer: '/' }); // 'https://example.com'
 * $({ str: 'path/to/directory///', trimmer: '/' }); // 'path/to/directory'
 *
 * // Clean file extensions
 * $({ str: 'document.backup.backup', trimmer: '.backup' }); // 'document'
 *
 * // Remove repeated suffixes
 * $({ str: 'testTestTest', trimmer: 'Test' }); // 'test'
 * ```
 *
 * Note: For trimming from the start of strings, use the corresponding trimStartWith function
 * which follows the same pattern but removes from the beginning of the string.
 */
export function $({ str, trimmer, }: { str: string; trimmer: string; },): string {
  if (trimmer === '')
    throw new Error('trimmer cannot be empty',);
  if (!str.endsWith(trimmer,))
    return str;

  // Use Intl.Segmenter for proper Unicode-aware string segmentation
  /** Segmenter for Unicode-aware string segmentation */
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme', },);
  /** Segmented trimmer string as array of graphemes */
  const trimmerSegments = Array.from(segmenter.segment(trimmer,),
    segment => segment.segment,);
  /** Reversed trimmer segments joined into string */
  const reversedTrimmer = trimmerSegments.toReversed().join('',);

  /** Working copy of the input string being modified */
  let modifyingString = str;
  while (modifyingString.endsWith(trimmer,)) {
    /** Segmented main string as array of graphemes */
    const stringSegments = Array.from(segmenter.segment(modifyingString,), segment =>
      segment.segment,);
    modifyingString = Array
      .from(segmenter.segment(
        stringSegments.toReversed().join('',).replace(reversedTrimmer, '',),
      ), segment => segment.segment,)
      .toReversed()
      .join('',);
  }
  return modifyingString;
}