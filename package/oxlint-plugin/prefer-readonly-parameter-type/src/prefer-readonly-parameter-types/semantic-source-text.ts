/**
 * Source text as TypeScript sees it, after Oxlint has finished with it.
 *
 * @module
 */

/**
 * UTF-16 byte-order mark restored when Oxlint strips it from source text.
 */
const BYTE_ORDER_MARK = '\uFEFF';

/**
 * Restores source text exactly as TypeScript sees it.
 *
 * Offsets are what this is for. Oxlint reports positions into text it has already stripped, and
 * TypeScript counts the mark, so text handed over without it puts every node one unit off.
 *
 * @param sourceText - Oxlint source text.
 *
 * @param hasBOM - Whether Oxlint removed leading byte-order mark.
 *
 * @returns source text with leading mark restored when necessary.
 *
 * @example
 * ```ts
 * sourceWithBOM({ sourceText, hasBOM: false });
 * ```
 */
export function sourceWithBOM({
  sourceText,
  hasBOM,
}: {
  readonly sourceText: string;
  readonly hasBOM: boolean;
},): string {
  return hasBOM ? `${BYTE_ORDER_MARK}${sourceText}` : sourceText;
}
