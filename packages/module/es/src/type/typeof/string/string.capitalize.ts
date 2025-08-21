// From https://stackoverflow.com/a/53930826 under https://creativecommons.org/licenses/by-sa/4.0/

/**
 * Capitalizes the first character of a string using Unicode-aware locale-sensitive transformation.
 *
 * Uses Unicode property `\p{CWU}` (Changes When Uppercased) to identify characters that have uppercase variants,
 * ensuring proper capitalization across different languages and writing systems. This approach handles
 * complex Unicode cases like ligatures, accented characters, and non-Latin scripts correctly.
 * The locale parameter enables culture-specific capitalization rules (for example, Turkish i/İ distinction).
 *
 * @param str - Input string to capitalize
 * @param locale - Optional locale identifier for culture-specific uppercasing rules
 * @returns String with first character capitalized according to locale rules
 *
 * @example
 * Basic English capitalization:
 * ```ts
 * const result = capitalizeString("hello world");
 * console.log(result); // "Hello world"
 * ```
 *
 * @example
 * Handling accented characters:
 * ```ts
 * const french = capitalizeString("éléphant");
 * console.log(french); // "Éléphant"
 *
 * const german = capitalizeString("über");
 * console.log(german); // "Über"
 * ```
 *
 * @example
 * Locale-specific capitalization (Turkish):
 * ```ts
 * const turkish = capitalizeString("istanbul", "tr-TR");
 * console.log(turkish); // "İstanbul" (with dotted İ)
 *
 * const english = capitalizeString("istanbul", "en-US");
 * console.log(english); // "Istanbul" (with regular I)
 * ```
 *
 * @example
 * Preserving existing capitalization patterns:
 * ```ts
 * const mixed = capitalizeString("iPhone");
 * console.log(mixed); // "IPhone" (first char capitalized)
 *
 * const already = capitalizeString("Hello");
 * console.log(already); // "Hello" (unchanged)
 * ```
 *
 * @example
 * Working with Unicode and special characters:
 * ```ts
 * const emoji = capitalizeString("🎉 party time");
 * console.log(emoji); // "🎉 party time" (emoji unchanged, first letter not affected)
 *
 * const greek = capitalizeString("ωmega");
 * console.log(greek); // "Ωmega"
 * ```
 *
 * @example
 * Handling edge cases:
 * ```ts
 * capitalizeString("") // "" (empty string)
 * capitalizeString("a") // "A" (single character)
 * capitalizeString("123abc") // "123abc" (numbers don't have uppercase)
 * capitalizeString("-hello") // "-hello" (punctuation doesn't change)
 * ```
 *
 * @example
 * Text processing pipeline:
 * ```ts
 * const titles = ["the great gatsby", "to kill a mockingbird", "1984"];
 * const capitalized = titles.map(title => capitalizeString(title));
 * console.log(capitalized);
 * // ["The great gatsby", "To kill a mockingbird", "1984"]
 *
 * // For proper title case, combine with word processing:
 * function titleCase(text: string): string {
 *   return text.split(' ')
 *     .map(word => capitalizeString(word.toLowerCase()))
 *     .join(' ');
 * }
 * ```
 */
export function capitalizeString(str: string, locale?: string,): string {
  return str.replace(/^\p{CWU}/v, function replacer(char,) {
    return char.toLocaleUpperCase(locale,);
  },);
}
