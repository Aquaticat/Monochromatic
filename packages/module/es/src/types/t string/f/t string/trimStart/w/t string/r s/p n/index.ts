import {$ as stringToRegexp} from '@_/types/t object/t regexp/f/t string/r s/p p/index.ts';
import {$ as regexpToGlobalRegexp} from '@_/types/t object/t regexp/t global/f/t object/t regexp/r s/p p/index.ts';
import {$ as trimStartRegex} from '@_/types/t string/f/t string/trimStart/w/t object/t regexp/t global/r s/p n/index.ts';

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
  const globalRegexp = regexpToGlobalRegexp(stringToRegexp(trimmer));

  return trimStartRegex({str, trimmer: globalRegexp});
}
