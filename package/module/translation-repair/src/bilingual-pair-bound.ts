//region Bilingual pair bound
// CLASS EIGHTY, SECOND ARM (shi_Yumiaoya11, 2026-09-22). The sheet clause of
// `bilingual-line-clause.ts` reached the translators, the judges and the
// editors, and the slate still chose the candidate that rendered the film
// quote's Chinese line a second time in English: deepseek-v4.1-flash called
// the candidate carrying the English alone "a dropped line ... ineligible"
// under the line criterion, and gemma-4-26b reasoned that the Chinese line
// "is a literal translation of the sentiment, which is distinct from the
// actual English quote". A judge without the film cannot see that the two
// lines are one, and no wording on a sheet gives it the film.
//
// THE EXISTING TRANSLATION SETTLES IT. The human translator carried the pair
// as one line, and that count is on the sheet as the PAGE AS IT STANDS. So
// where the original carries such a pair and the page carries exactly the
// lines owed (each pair once), a rendering carrying more has invented a line
// and is refused before the judges see it, the way class sixty-six withholds
// a rule-refused candidate. Where there is no page text, or the page itself
// keeps the adjacent lines apart (Arita, NIGHT81473140, gqt and seven other
// entries carry a Chinese line followed by an English line of DIFFERENT
// content, which the pair count cannot tell from a translation pair), nothing
// is refused and the judges decide on the clause.

/**
 Content lines of a text, the caller's own reading so this bound counts the
 page the way the floor counts the original and the rendering.
 */
type ContentLines = (args: { readonly text: string; },) => readonly string[];

/**
 Names a governed rendering that carries more lines than the page where the
 original gives a line in Chinese and in English beside it and the page
 carries each such pair once.

 @param pairs - Han lines the original gives with their own English beside
 them, as the floor counted them

 @param owed - lines the rendering owes, the original's less one per pair

 @param carried - lines the rendering carries

 @param pageText - translation of the slice as the page stands, absent or
 empty where the slice has none

 @param contentLines - line reader shared with the floor

 @returns One finding where the page bounds the pair and the rendering
 exceeds it, none otherwise

 @example
 ```ts
 const found = pairBoundFindings({ pairs: 2, owed: 3, carried: 4, pageText, contentLines, },);
 ```
 */
export function pairBoundFindings(
  {
    pairs,
    owed,
    carried,
    pageText,
    contentLines,
  }: {
    readonly pairs: number;
    readonly owed: number;
    readonly carried: number;
    readonly pageText?: string;
    readonly contentLines: ContentLines;
  },
): readonly string[] {
  if ((pairs === 0) || (carried <= owed))
    return [];
  if ((pageText === undefined) || (pageText.trim() === ''))
    return [];
  /**
   Content lines the page carries for the slice.
   */
  const pageLines = contentLines({ text: pageText, },);
  if (pageLines.length !== owed)
    return [];
  return [
    `This slice is LINE-STRUCTURED and the ORIGINAL gives ${String(pairs,)} of its lines twice, `
      + `once in Chinese and once in English directly beside it; each such pair is ONE line whose English `
      + `is already its rendering, and the EXISTING TRANSLATION carries it so, ${String(owed,)} lines in all. `
      + `Yours carries ${String(carried,)}. Drop the second rendering of the pair (the Chinese line, or a `
      + `second English wording of it), keeping the film's own English line and the wording you chose elsewhere.`,
  ];
}

//endregion Bilingual pair bound
