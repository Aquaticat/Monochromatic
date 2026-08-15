//region Heading affinity
// Written as a prototype for `#71`, and WIRED SINCE: `align-headings-grid.ts`
// calls it for every candidate pairing, and `alignHeadingsForced` decides on
// the grid that builds.
//
// Scores how much two section headings look like each other across the language
// boundary, so sections can be paired by EVIDENCE rather than by position.
//
// The case it is built from: `XingZ60` carries fourteen headings against the
// translation's twelve, and the aligner USED TO fall back to distributing them
// proportionally by character fraction. That slid every section by two, so
// 其六：Mikä was paired with a section headed Ann while a section headed Mikä
// sat two places away. The names were sitting in both headings the whole time.
//
// Latin runs are the signal that survives translation. A memorial archive names
// its contributors by handle, and a handle is usually carried across unchanged
// or transliterated recognisably: Mikä stays Mikä, wing stays wing, 白毛 suki
// becomes Baimao suki. Chinese-only headings score zero against everything,
// which is correct: they carry no evidence, and an aligner should say so rather
// than guess.

/**
 * Shortest Latin run worth treating as a name.
 *
 * One and two letter runs are mostly noise from markup and initials, and they
 * match far too freely across unrelated headings.
 */
const MIN_TOKEN_LENGTH = 3;

/**
 * Whether a character is an ASCII letter.
 *
 * @param character - character to classify
 *
 * @returns Whether it belongs to a Latin run
 *
 * @example
 * ```ts
 * isLatinLetter({ character: 'w', },);
 * ```
 */
function isLatinLetter({ character, }: { readonly character: string; },): boolean {
  /**
   * Lowercased form, so one comparison covers both cases.
   */
  const lower = character.toLowerCase();

  return (lower >= 'a') && (lower <= 'z');
}

/**
 * Extracts lowercase Latin runs from a heading.
 *
 * Written as an index scan rather than a pattern: the rule is one predicate per
 * character with one run buffer, and a heading is arbitrary text that must not
 * be able to make the scan backtrack.
 *
 * @param text - heading text
 *
 * @returns Distinct lowercase runs of at least {@link MIN_TOKEN_LENGTH}
 *
 * @example
 * ```ts
 * latinTokens({ text: '### 其八：白毛 suki', },);
 * ```
 */
export function latinTokens({ text, }: { readonly text: string; },): ReadonlySet<string> {
  return (function scan(): ReadonlySet<string> {
    /**
     * Runs found so far.
     */
    const found = new Set<string>();

    /**
     * Characters of the run currently open.
     */
    let run = '';
    for (let index = 0; index < text.length; index += 1) {
      /**
       * Character under the cursor.
       */
      const character = text.charAt(index,);
      if (isLatinLetter({ character, },)) {
        run += character.toLowerCase();
        continue;
      }
      if (run.length >= MIN_TOKEN_LENGTH)
        found.add(run,);

      run = '';
    }
    if (run.length >= MIN_TOKEN_LENGTH)
      found.add(run,);

    return found;
  })();
}

/**
 * Scores how much two headings look like the same section.
 *
 * Overlap of Latin runs, scaled by the smaller heading's run count, so a
 * heading carrying one name and matching it scores as strongly as one carrying
 * three and matching all three. Zero when either side offers no runs, which is
 * the honest answer for a heading written entirely in Chinese: no evidence is
 * not weak evidence.
 *
 * @param source - original-side heading
 *
 * @param target - translation-side heading
 *
 * @returns Affinity from 0 to 1
 *
 * @example
 * ```ts
 * headingAffinity({ source: '### 其七：wing', target: '### wing', },);
 * ```
 */
export function headingAffinity(
  {
    source,
    target,
  }: {
    readonly source: string;
    readonly target: string;
  },
): number {
  /**
   * Runs each heading carries.
   */
  const sourceTokens = latinTokens({ text: source, },);

  /**
   * Same for the translation side.
   */
  const targetTokens = latinTokens({ text: target, },);
  if ((sourceTokens.size === 0) || (targetTokens.size === 0))
    return 0;

  /**
   * Runs present on both sides.
   */
  const shared = [...sourceTokens,]
    .filter(function isShared(token,) {
      return targetTokens.has(token,);
    },)
    .length;

  return shared / Math.min(
    sourceTokens.size,
    targetTokens.size,
  );
}

//endregion Heading affinity
