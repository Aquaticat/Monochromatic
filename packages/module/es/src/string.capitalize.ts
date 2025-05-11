// From https://stackoverflow.com/a/53930826 under https://creativecommons.org/licenses/by-sa/4.0/

/**
 * Capitalizes the first character of a string according to the specified locale.
 * @param {string} str - The string to capitalize.
 * @param {string} [locale] - The locale to use for uppercasing the first character.
 * @return {string} The capitalized string.
 */
export function capitalize(str: string, locale?: string): string {
  return str.replace(/^\p{CWU}/u, function replacer(char) {
    return char.toLocaleUpperCase(locale);
  });
}
