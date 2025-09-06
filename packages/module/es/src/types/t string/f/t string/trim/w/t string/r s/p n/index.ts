import {
  $ as stringToRegexp,
} from '@_/types/t object/t regexp/f/t string/r s/p p/index.ts';
import {
  $ as regexpToGlobalRegexp,
} from '@_/types/t object/t regexp/t global/f/t object/t regexp/r s/p p/index.ts';
import {
  $ as trimRegex,
} from '../../../t object/t regexp/t global/r s/p n/index.ts';

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
  const globalRegexp = regexpToGlobalRegexp(stringToRegexp(trimmer,),);

  return trimRegex({ str, trimmer: globalRegexp, },);
}
