//region Neutral pronoun rendering
// A TRANSLATION THAT LEAVES THE CORPUS'S NEUTRAL PRONOUN IN LATIN LETTERS has
// not translated it. The sources write `TA`, `Ta` or `ta` for a person who did
// not specify a pronoun, and English has a rendering for that: singular they.
//
// WHY THIS IS A FLOOR RULE AND NOT A PROMPT ALONE. The SS3B_0016 run of
// 2026-09-04 (13:51 UTC) shipped "a small room for Ta, to give Ta's memorial a
// little warmth" on a page that says "they" for the same person everywhere
// else, and three of five contest ballots plus the consolidation gate kept it
// as "the original's neutral Ta". Judges reading a passage cannot tell an
// untranslated word from a preserved choice when the house rule names TA as a
// pronoun the original uses and never says what English makes of it. The rule
// now says so, and this refuses the candidate before any judge is asked.
//
// WHAT THE CORPUS SAYS. Measured over the pinned corpus the same day: sources
// write the pronoun as `TA` in 2 entries, `Ta` in 7 and `ta` in 8, every
// occurrence a pronoun; of those entries' archives, one (a rewrite) keeps a
// bare `TA`, and the rest render it "they". An archive that kept it fails this
// rule as a standing text, which is what the owner's ineligible-standing
// decision provides for: the slate prefers a valid proposal.
//
// THE BOUNDARY IS THE WORD, NOT THE CASING. `DATA`, `STATION`, `meta`, a
// romanised handle, a path segment and an address all contain the letters and
// none is the pronoun, so an occurrence counts only where what precedes it
// could open a word and what follows it could close one.

/**
 * Spellings the sources give the neutral pronoun, and so the spellings an
 * untranslated one keeps.
 */
const PRONOUN_SPELLINGS = [
  'TA',
  'Ta',
  'ta',
] as const;

/**
 * What `indexOf` answers when the spelling is not found.
 */
const NOT_FOUND = -1;

/**
 * First code point of the CJK ranges, above which a character is taken as
 * script rather than as part of a Latin word. A pronoun beside a han character
 * is still a word of its own.
 */
const CJK_FLOOR = 0x2E80;

/**
 * Marks that may open a word in English prose: quotes and brackets.
 */
const OPENING_MARKS = new Set([
  '"',
  '\'',
  '“',
  '‘',
  '(',
  '[',
  '「',
],);

/**
 * Marks that may close a word in English prose: sentence and clause
 * punctuation, quotes and brackets. An apostrophe closes too, so "Ta's" counts.
 */
const CLOSING_MARKS = new Set([
  ',',
  '.',
  ';',
  ':',
  '!',
  '?',
  '"',
  '\'',
  '’',
  '”',
  ')',
  ']',
  '」',
],);

/**
 * Whether a character is whitespace, which bounds a word on either side.
 *
 * @param character - one character, empty at either end of the text
 *
 * @returns Whether it is a space, a tab or a line break
 *
 * @example
 * ```ts
 * isBlank({ character: ' ', },);
 * // => true
 * ```
 */
function isBlank({ character, }: { readonly character: string; },): boolean {
  return (character === ' ') || (character === '\t') || (character === '\n') || (character === '\r');
}

/**
 * Whether a character belongs to a CJK range.
 *
 * @param character - one character, empty at either end of the text
 *
 * @returns Whether its code point sits at or above the CJK floor
 *
 * @example
 * ```ts
 * isHan({ character: '的', },);
 * // => true
 * ```
 */
function isHan({ character, }: { readonly character: string; },): boolean {
  /**
   * Code point, or nothing at either end of the text.
   */
  const point = character.codePointAt(0,);
  return (point !== undefined) && (point >= CJK_FLOOR);
}

/**
 * Whether what precedes an occurrence lets it be a word of its own.
 *
 * @param character - character before the occurrence, empty at the start
 *
 * @returns Whether the occurrence may begin here
 *
 * @example
 * ```ts
 * opensWord({ character: '', },);
 * // => true
 * ```
 */
function opensWord({ character, }: { readonly character: string; },): boolean {
  return (character === '')
    || isBlank({ character, },)
    || OPENING_MARKS.has(character,)
    || isHan({ character, },);
}

/**
 * Whether what follows an occurrence lets it be a word of its own.
 *
 * @param character - character after the occurrence, empty at the end
 *
 * @returns Whether the occurrence may end here
 *
 * @example
 * ```ts
 * closesWord({ character: '\'', },);
 * // => true
 * ```
 */
function closesWord({ character, }: { readonly character: string; },): boolean {
  return (character === '')
    || isBlank({ character, },)
    || CLOSING_MARKS.has(character,)
    || isHan({ character, },);
}

/**
 * Counts how often one spelling stands as a word of its own.
 *
 * ONE LINEAR PASS with the string API: each occurrence is found from the end
 * of the previous one and its two neighbours are read once.
 *
 * @param text - candidate translation
 *
 * @param spelling - fixed form to count
 *
 * @returns Occurrences bounded as words
 *
 * @example
 * ```ts
 * countSpelling({ text: 'Ta smiled. DATA', spelling: 'Ta', },);
 * // => 1
 * ```
 */
function countSpelling(
  {
    text,
    spelling,
  }: {
    readonly text: string;
    readonly spelling: string;
  },
): number {
  /**
   * Occurrences and the position to search from, advanced together.
   */
  const scan = {
    count: 0,
    from: 0,
  };
  for (
    let at = text.indexOf(
      spelling,
      scan.from,
    );
    at !== NOT_FOUND;
    at = text.indexOf(
      spelling,
      scan.from,
    )
  ) {
    /**
     * Whether both neighbours let this stand as a word.
     */
    const standsAlone = opensWord({ character: text.charAt(at - 1,), },)
      && closesWord({ character: text.charAt(at + spelling.length,), },);
    if (standsAlone)
      scan.count += 1;
    scan.from = at + spelling.length;
  }
  return scan.count;
}

/**
 * Names an untranslated neutral pronoun in a candidate, written for the model
 * that wrote the candidate.
 *
 * @param candidateText - translation as the model returned it
 *
 * @returns One finding naming each spelling found with its count, or nothing
 * when the candidate carries none
 *
 * @example
 * ```ts
 * neutralPronounFindings({ candidateText: 'We set up a room for Ta.', },);
 * // => ['Your translation carries the pronoun untranslated as "Ta" (1 time): ...']
 * ```
 */
export function neutralPronounFindings(
  { candidateText, }: { readonly candidateText: string; },
): readonly string[] {
  /**
   * Each spelling the candidate keeps, with its count.
   */
  const kept = PRONOUN_SPELLINGS
    .map(function counted(spelling,): { readonly spelling: string; readonly count: number; } {
      return {
        spelling,
        count: countSpelling({
          text: candidateText,
          spelling,
        },),
      };
    },)
    .filter(function found(entry,): boolean {
      return entry.count > 0;
    },);
  if (kept.length === 0)
    return [];

  /**
   * Spellings and counts as one phrase.
   */
  const named = kept
    .map(function phrase(entry,): string {
      return `"${entry.spelling}" (${String(entry.count,)} ${(entry.count === 1) ? 'time' : 'times'})`;
    },)
    .join(' and ',);
  return [
    `Your translation carries the pronoun untranslated as ${named}: the ORIGINAL writes its neutral pronoun `
    + 'as TA, Ta or ta, and English renders it as singular they (they, them, their), with TA 们 as plural '
    + 'they; a Ta left standing in the English is an untranslated word, not a preserved choice.',
  ];
}

//endregion Neutral pronoun rendering
