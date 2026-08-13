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
 * CJK corner brackets join the quote classes:
 * models paraphrase 「」 as curly or ASCII quotes when quoting zh sources
 * (live: a model closing 「...。」 as ...。”), and every bracket here is a
 * single UTF-16 unit, so the length guarantee holds.
 */
const PUNCTUATION_CANON: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '「': '"',
  '」': '"',
  '『': "'",
  '』': "'",
  ' ': ' ',
};

/**
 * Line-break units a model returns as a plain space when it quotes across a
 * soft wrap.
 * Deliberately NOT part of `PUNCTUATION_CANON`:
 * collapsing these changes which quotes match, so admitting them is a
 * behaviour change awaiting a decision, and only the diagnostic path may
 * consult this map today.
 */
const LINE_BREAK_CANON: Readonly<Record<string, string>> = {
  '\n': ' ',
  '\r': ' ',
};

/**
 * Rewrites each UTF-16 unit through one canonicalization map.
 * Length-preserving by construction, since every mapping replaces one unit
 * with one unit, so a position found in the result indexes the input exactly.
 *
 * @param text - text whose units canonicalize
 *
 * @param map - canonical replacement per unit, absent units left alone
 *
 * @returns Same-length text with mapped units replaced
 *
 * @example
 * ```ts
 * canonicalize({ text: 'father’s', map: PUNCTUATION_CANON, },);
 * ```
 */
function canonicalize(
  {
    text,
    map,
  }: {
    readonly text: string;
    readonly map: Readonly<Record<string, string>>;
  },
): string {
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
    units.push(map[unit] ?? unit,);
  }
  return units.join('',);
}

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
  return canonicalize({
    text,
    map: PUNCTUATION_CANON,
  },);
}

/**
 * Collapses soft line breaks onto plain spaces.
 * Shares the length guarantee of `normalizePunctuation`, so a position found
 * in the result still indexes the input.
 * A blank line stays unmatchable by a space-joined quote, because it carries
 * two line breaks where such a quote carries one space.
 *
 * @param text - text whose line breaks collapse
 *
 * @returns Same-length text reading line breaks as spaces
 *
 * @example
 * ```ts
 * collapseLineBreaks({ text: 'her\nshop', },);
 * ```
 */
export function collapseLineBreaks({ text, }: { readonly text: string; },): string {
  return canonicalize({
    text,
    map: LINE_BREAK_CANON,
  },);
}

//endregion Quote normalization
