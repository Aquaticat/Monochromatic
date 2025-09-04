import {$ as named} from '../p n/index.ts';

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
 * $('PrefixString', 'Prefix'); // 'String'
 * $('PrefixPrefixText', 'Prefix'); // 'Text'
 * $('aaabc', 'a'); // 'abc'
 * $('String', 'suffix'); // 'String' (no change)
 *
 * // Multiple consecutive trimmers are removed
 * $('.txt.txt.txtfile', '.txt'); // 'file'
 *
 * // Case sensitive matching
 * $('PREFIXString', 'prefix'); // 'PREFIXString' (no change)
 * $('PREFIXString', 'PREFIX'); // 'String'
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
 * // Remove leading slashes from paths
 * $('/path/to/file', '/'); // 'path/to/file'
 * $('///directory/path', '/'); // 'directory/path'
 *
 * // Clean file extensions
 * $('backup.backup.document', 'backup.'); // 'document'
 *
 * // Remove repeated prefixes
 * $('TestTesttest', 'Test'); // 'test'
 * ```
 *
 * Note: For trimming from the end of strings, use the corresponding trimEndWith function
 * which follows the same pattern but removes from the end of the string.
 */
export function $(str: string, trimmer: string,): string {
  return named({str, trimmer});
}
