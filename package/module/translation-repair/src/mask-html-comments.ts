//region HTML comment masking
// Corpus pages carry HTML comments, which the MDX grammar rejects outright:
// 23 of 92 pinned zh/en pairs fail strict parsing exactly this way and no
// other failure class exists in the pinned corpus. Masking replaces each
// comment with same-length whitespace before the strict parse, so every
// offset keeps referring to the original text, comments become inter-node
// whitespace, and the rest of the document keeps full MDX semantics.

/**
 * Opening delimiter of an HTML comment.
 */
const COMMENT_OPEN = '<!--';

/**
 * Closing delimiter of an HTML comment.
 */
const COMMENT_CLOSE = '-->';

/**
 * One masked comment region in offsets of the unmasked input.
 *
 * @example
 * ```ts
 * const region: MaskedCommentRegion = {
 *   startOffset: 10,
 *   endOffset: 24,
 *   terminated: true,
 * };
 * ```
 */
export type MaskedCommentRegion = {
  /**
   * Offset of the region's opening `<!--`.
   */
  readonly startOffset: number;

  /**
   * Exclusive end offset: past the closing `-->`,
   * or the input's end when the comment never closes.
   */
  readonly endOffset: number;

  /**
   * Whether the comment closed;
   * an unterminated comment swallows the rest of the input.
   */
  readonly terminated: boolean;
};

/**
 * Replaces one region's characters with spaces, preserving newlines so line
 * structure survives for line-sensitive block parsing.
 * Iterates UTF-16 units (not code points):
 * one space per unit keeps the masked string's length identical even when
 * the comment carries astral characters.
 *
 * @param region - comment slice to blank out
 *
 * @returns Same-length whitespace with original newlines kept
 *
 * @example
 * ```ts
 * blankRegion({ region: '<!-- x -->', },);
 * ```
 */
function blankRegion({ region, }: { readonly region: string; },): string {
  /**
   * One whitespace unit per UTF-16 unit of the region.
   */
  const units: string[] = [];
  for (
    let index = 0;
    index < region.length;
    index += 1
  ) {
    units.push(
      region.charAt(index,) === '\n'
        ? '\n'
        : ' ',
    );
  }
  return units.join('',);
}

/**
 * Masks every HTML comment with same-length whitespace.
 * Single linear pass; the output is byte-length-identical to the input,
 * so positions parsed from the masked text index the original text exactly.
 *
 * @param text - body text possibly carrying HTML comments
 *
 * @returns Masked text plus each region in original offsets
 *
 * @example
 * ```ts
 * const { masked, regions, } = maskHtmlComments({ text: body, },);
 * ```
 */
export function maskHtmlComments(
  { text, }: { readonly text: string; },
): {
  readonly masked: string;
  readonly regions: readonly MaskedCommentRegion[];
} {
  /**
   * Alternating kept and blanked slices in source order.
   */
  const parts: string[] = [];

  /**
   * Masked regions in source order.
   */
  const regions: MaskedCommentRegion[] = [];

  /**
   * Scan position; everything before it is already in parts.
   */
  let cursor = 0;

  while (cursor < text.length) {
    /**
     * Next comment opening at or past the cursor.
     */
    const openAt = text.indexOf(
      COMMENT_OPEN,
      cursor,
    );
    if (openAt === (-1)) {
      parts.push(text.slice(cursor,),);
      break;
    }

    /**
     * Matching close past the opening delimiter, when the comment closes.
     */
    const closeAt = text.indexOf(
      COMMENT_CLOSE,
      openAt + COMMENT_OPEN.length,
    );

    /**
     * Whether this comment closed before the input ended.
     */
    const terminated = closeAt !== (-1);

    /**
     * Exclusive end of the comment region.
     */
    const endOffset = terminated
      ? closeAt + COMMENT_CLOSE.length
      : text.length;

    parts.push(
      text.slice(
      cursor,
      openAt,
    ),
      blankRegion({
      region: text.slice(
        openAt,
        endOffset,
      ),
    },)
    );
    regions.push({
      startOffset: openAt,
      endOffset,
      terminated,
    },);
    cursor = endOffset;
  }

  /**
   * Masked result;
   * the comment-free fast path keeps the original string untouched.
   */
  const result = regions.length === 0
    ? {
      masked: text,
      regions,
    }
    : {
      masked: parts.join('',),
      regions,
    };
  return result;
}

//endregion HTML comment masking
