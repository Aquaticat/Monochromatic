import { $ as named, } from '../p n/index.ts';

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
export function $(str: string, trimmer: string,): string {
  return named({ str, trimmer, },);
}
