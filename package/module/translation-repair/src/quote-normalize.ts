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
 * Collapses every line break onto a plain space.
 * Shares the length guarantee of `normalizePunctuation`, so a position found
 * in the result still indexes the input.
 *
 * FOR DISPLAY, NOT FOR MATCHING: this flattens a paragraph break as readily as
 * a soft wrap, which is right for a one-line diagnostic and wrong for deciding
 * whether a quote occurs. Matching uses {@link collapseSoftLineBreaks}.
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

/**
 * Whether one position holds a line-break unit.
 *
 * @param text - text being scanned
 *
 * @param index - position to read, which may sit outside the text
 *
 * @returns Whether that position holds a line break
 *
 * @example
 * ```ts
 * const breaks = isLineBreakAt({ text: 'a\nb', index: 1, },);
 * ```
 */
function isLineBreakAt(
  {
    text,
    index,
  }: {
    readonly text: string;
    readonly index: number;
  },
): boolean {
  return LINE_BREAK_CANON[text.charAt(index,)] !== undefined;
}

/**
 * Collapses only SOLE line breaks onto plain spaces, leaving a run of them as
 * it stands.
 *
 * WHY A RUN IS LEFT ALONE: a lone break inside a paragraph is a soft wrap, and
 * a model quoting across it writes a space, so the two forms mean the same text.
 * A run of breaks is a STRUCTURAL boundary. Collapsing those too made a blank
 * line into two spaces, so a quote carrying two spaces matched straight across
 * a paragraph boundary the document keeps: safe only for as long as every model
 * joined lines with exactly one space, which is not a property this pipeline can
 * assume of its inputs. A run now matches nothing but itself.
 *
 * WHAT IT STILL DOES NOT PROTECT: boundaries a single line break represents,
 * inside fenced code, between list items, and between table rows, plus a
 * Markdown hard break, whose two trailing spaces plus a wrap read as three
 * spaces. Those need the parse rather than the characters, and `#106` records
 * it.
 *
 * Length-preserving like everything here, so offsets still index the input.
 *
 * @param text - text whose soft wraps collapse
 *
 * @returns Same-length text reading sole line breaks as spaces
 *
 * @example
 * ```ts
 * collapseSoftLineBreaks({ text: 'her\nshop', },);
 * ```
 */
export function collapseSoftLineBreaks({ text, }: { readonly text: string; },): string {
  /**
   * Units in input order, each either collapsed or kept.
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

    /**
     * Whether this break stands alone between non-break neighbours.
     */
    const sole = (LINE_BREAK_CANON[unit] !== undefined)
      && (!isLineBreakAt({
        text,
        index: index - 1,
      },))
      && (!isLineBreakAt({
        text,
        index: index + 1,
      },));
    units.push(sole ? ' ' : unit,);
  }
  return units.join('',);
}

//endregion Quote normalization
