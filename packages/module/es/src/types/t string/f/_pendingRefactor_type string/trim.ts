/**
 * Removes all occurrences of trimmer string from the end of the input string.
 *
 * Repeatedly removes the trimmer from the end until no more matches are found.
 * Case-sensitive matching is used for trimmer detection.
 *
 * @param str - to trim from the end
 *
 * @param trimmer - substring to remove from the end
 *
 * @returns String with all trailing occurrences of trimmer removed
 *
 * @throws Error if trimmer is an empty string
 *
 * @example
 * ```ts
 * trimEndWith('StringSuffix', 'Suffix'); // 'String'
 * trimEndWith('TextSuffixSuffix', 'Suffix'); // 'Text'
 * trimEndWith('abcaaa', 'a'); // 'abc'
 * trimEndWith('String', 'prefix'); // 'String' (no change)
 * ```
 */
export function trimEndWith(str: string, trimmer: string,): string {
  if (trimmer === '')
    throw new Error('trimmer cannot be empty',);
  let result = str;
  while (result.endsWith(trimmer,))
    result = result.slice(0, -trimmer.length,);
  return result;
}

/**
 * Removes all occurrences of trimmer string from the start of the input string.
 *
 * Repeatedly removes the trimmer from the beginning until no more matches are found.
 * Case-sensitive matching is used for trimmer detection.
 *
 * @param str - to trim from the start
 *
 * @param trimmer - substring to remove from the start
 *
 * @returns String with all leading occurrences of trimmer removed
 *
 * @throws Error if trimmer is an empty string
 *
 * @example
 * ```ts
 * trimStartWith('prefixString', 'prefix'); // 'String'
 * trimStartWith('prefixprefixText', 'prefix'); // 'Text'
 * trimStartWith('aaaaabc', 'a'); // 'bc'
 * trimStartWith('String', 'suffix'); // 'String' (no change)
 * ```
 */
export function trimStartWith(str: string, trimmer: string,): string {
  if (trimmer === '')
    throw new Error('trimmer cannot be empty',);
  if (!str.startsWith(trimmer,))
    return str;
  let modifyingString = str;
  while (modifyingString.startsWith(trimmer,))
    modifyingString = modifyingString.replace(trimmer, '',);
  return modifyingString;
}
