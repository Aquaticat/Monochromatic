import { isIdeograph, } from './preservation-tokens.ts';

//region Untranslated candidate
// MEASURED ON MIO25'S FIRST ATTEMPT (slice 16, 2026-09-17): two of the four
// translate candidates for the closing poem were the Chinese original
// returned as it stood, one judge chose one of them as "the most faithful
// rendering", the others abstained or split, the select missed its weight
// floor twice, and the entry ended with the translate lane's absence error
// because that slice has no archive translation to fall back on. A candidate
// that repeats a Han-carrying original is not a rendering of it and never
// belongs on a slate.
//
// EXACT REPETITION ONLY, after trimming. A slice that carries nothing to
// translate (a bare link, a component) is returned as it stands and must
// pass; the ideograph test is what separates the two.

/**
 Finding text for the repeated original.
 */
const UNTRANSLATED_FINDING = 'Your translation repeats the ORIGINAL untranslated, character for character. '
  + 'Write the passage in English; keep only the names, handles, links and code the original carries.';

/**
 Finding for a candidate that repeats a Han-carrying original untranslated.

 @param sourceText - original slice

 @param candidateText - candidate under validation

 @returns One finding when the candidate is the original, character for
 character, and the original carries an ideograph; none otherwise

 @example
 ```ts
 const findings = untranslatedFindings({ sourceText: '猫睡了。', candidateText: '猫睡了。', },);
 ```
 */
export function untranslatedFindings(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   Original without its surrounding whitespace.
   */
  const source = sourceText.trim();
  /**
   Candidate without its surrounding whitespace.
   */
  const candidate = candidateText.trim();
  if (source !== candidate)
    return [];
  // ONE LINEAR PASS over code points; a character in the ideograph range is
  // what makes the repetition an untranslated one rather than a bare link or
  // component returned as it stands.
  for (const character of source) {
    if (isIdeograph(character,))
      return [UNTRANSLATED_FINDING,];
  }
  return [];
}

//endregion Untranslated candidate
