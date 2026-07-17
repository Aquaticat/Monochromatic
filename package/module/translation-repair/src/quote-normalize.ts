//region Quote normalization
// Models copy quote evidence with ASCII punctuation while the corpus uses
// curly variants (the en editing guide mandates them), so byte-exact
// location rejects real evidence: on Xu_Yushu, most unresolved issues
// failed exactly this way ("father's" vs "father’s"). Normalization maps
// punctuation variants onto one canonical character, strictly one-to-one in
// UTF-16 units, so an offset found in normalized text indexes the original
// text unchanged and anchors keep the document's canonical bytes.

/**
 * Punctuation variants mapped onto canonical ASCII, one UTF-16 unit each.
 */
const PUNCTUATION_CANON: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  ' ': ' ',
};

/**
 * Normalizes punctuation variants onto canonical characters.
 * Length-preserving by construction:
 * every mapping replaces one UTF-16 unit with one UTF-16 unit,
 * so offsets in the result index the input exactly.
 *
 * @param text - text whose punctuation variants collapse
 *
 * @returns Same-length text with canonical punctuation
 *
 * @example
 * ```ts
 * normalizePunctuation({ text: 'father’s shop', },);
 * ```
 */
export function normalizePunctuation({ text, }: { readonly text: string; },): string {
  /**
   * Canonicalized units in input order.
   */
  const units: string[] = [];
  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    /**
     * Unit at this position.
     */
    const unit = text.charAt(index,);
    units.push(PUNCTUATION_CANON[unit] ?? unit,);
  }
  return units.join('',);
}

//endregion Quote normalization
