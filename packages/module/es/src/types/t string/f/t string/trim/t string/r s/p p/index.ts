/**
 * Removes all occurrences of trimmer string from the end of the input string.
 *
 * Repeatedly removes the trimmer from the end until no more matches are found.
 * Case-sensitive matching is used for trimmer detection.
 *
 * @param str - to trim from the end
 * @param trimmer - substring to remove from the end
 * @returns String with all trailing occurrences of trimmer removed
 * @throws {Error} If trimmer is an empty string
 *
 * @example
 * ```ts
 * $('StringSuffix', 'Suffix'); // 'String'
 * $('TextSuffixSuffix', 'Suffix'); // 'Text'
 * $('abcaaa', 'a'); // 'abc'
 * $('String', 'prefix'); // 'String' (no change)
 * 
 * // Multiple consecutive trimmers are removed
 * $('file.txt.txt.txt', '.txt'); // 'file'
 * 
 * // Case sensitive matching
 * $('StringSUFFIX', 'suffix'); // 'StringSUFFIX' (no change)
 * $('StringSUFFIX', 'SUFFIX'); // 'String'
 * 
 * // Edge cases
 * $('', 'anything'); // ''
 * $('unchanged', ''); // throws Error
 * $('same', 'different'); // 'same'
 * ```
 * 
 * @example
 * Common use cases for path and URL handling:
 * ```ts
 * // Remove trailing slashes from URLs
 * $('https://example.com/', '/'); // 'https://example.com'
 * $('path/to/directory///', '/'); // 'path/to/directory'
 * 
 * // Clean file extensions
 * $('document.backup.backup', '.backup'); // 'document'
 * 
 * // Remove repeated suffixes
 * $('testTestTest', 'Test'); // 'test'
 * ```
 * 
 * Note: For trimming from the start of strings, use the corresponding trimStartWith function
 * which follows the same pattern but removes from the beginning of the string.
 */
/* @__NO_SIDE_EFFECTS__ */ export function $(str: string, trimmer: string): string {
  if (trimmer === '')
    throw new Error('trimmer cannot be empty');
  if (!str.endsWith(trimmer))
    return str;
  
  // Use Intl.Segmenter for proper Unicode-aware string segmentation
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const trimmerSegments = Array.from(segmenter.segment(trimmer), segment => segment.segment);
  const reversedTrimmer = trimmerSegments.toReversed().join('');
  
  let modifyingString = str;
  while (modifyingString.endsWith(trimmer)) {
    const stringSegments = Array.from(segmenter.segment(modifyingString), segment => segment.segment);
    modifyingString = Array.from(segmenter.segment(
      stringSegments.toReversed().join('').replace(reversedTrimmer, '')
    ), segment => segment.segment).toReversed().join('');
  }
  return modifyingString;
}