import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';
import  {$ as trimRegexpStart} from '../../../../../../../trimStart/w/t object/t regexp/t global/r s/p n/index.ts';
import  {$ as trimRegexpEnd} from '../../../../../../../trimEnd/w/t object/t regexp/t global/r s/p n/index.ts';

/**
 * Removes all occurrences of patterns matching the regex trimmer from both the start and end of the input string.
 *
 * Repeatedly removes matching patterns from the start and end until no more matches are found.
 * The regex pattern is applied using Unicode-aware string segmentation for proper character handling.
 *
 * @param str - to trim from both ends
 * @param trimmer - regex pattern to match and remove from both ends
 * @returns String with all leading and trailing occurrences matching the regex pattern removed
 * @throws Error If trimmer is an empty regex or invalid regex pattern
 *
 * @example
 * ```ts
 * $({ str: '123abc123def123', trimmer: /\d+/g }); // 'abc123def'
 * $({ str: '   Hello World   ', trimmer: /\s+/g }); // 'Hello World'
 * $({ str: '///path/to/file///', trimmer: /\//g }); // 'path/to/file'
 * $({ str: 'prefixprefixTextsuffixsuffix', trimmer: /(prefix|suffix)/g }); // 'Text'
 * $({ str: 'PREFIXStringSUFFIX', trimmer: /(prefix|suffix)/ig }); // 'String' (case insensitive)
 * $({ str: 'aaabcaaa', trimmer: /a+/g }); // 'bc'
 * $({ str: 'String', trimmer: /different/g }); // 'String' (no change)
 *
 * // Multiple consecutive patterns are removed
 * $({ str: '.txt.txt.txtfile.txt.txt', trimmer: /\.txt/g }); // 'file'
 *
 * // Unicode-aware matching
 * $({ str: '世界Hello世界世界', trimmer: /世界/g }); // 'Hello'
 * $({ str: '🚀🚀test🚀🚀', trimmer: /🚀+/g }); // 'test'
 *
 * // Edge cases
 * $({ str: '', trimmer: /anything/g }); // ''
 * $({ str: 'unchanged', trimmer: /different/g }); // 'unchanged'
 * ```
 *
 * @example
 * Common use cases for pattern-based trimming:
 * ```ts
 * // Remove whitespace variations from both ends
 * $({ str: '\t\n  Hello\t\n  ', trimmer: /[\s\t\n]+/g }); // 'Hello'
 *
 * // Remove numbers from both ends
 * $({ str: '123abc456', trimmer: /\d+/g }); // 'abc'
 * $({ str: '00123abc00456', trimmer: /0+\d{0,}/g }); // 'abc'
 *
 * // Remove repeated prefixes/suffixes with patterns
 * $({ str: 'TestTesttestTestTest', trimmer: /Test+/ig }); // 'test'
 *
 * // Remove file extension patterns from both ends
 * $({ str: '.backup.document.backup', trimmer: /\.backup/g }); // 'document'
 * ```
 *
 * Note: For trimming from only one end of strings with regex patterns, use the corresponding trimStartWith or trimEndWith functions
 * which follow the same pattern but remove from only one end of the string.
 */
export function $(
  { str, trimmer, }: { str: string; trimmer: Global; },
): string {
  // First trim from the start
  const startTrimmed = trimRegexpStart({str, trimmer},);

  // Then trim from the end
  return trimRegexpEnd({str: startTrimmed, trimmer},);
}
