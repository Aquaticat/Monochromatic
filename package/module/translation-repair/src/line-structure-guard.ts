import { isIdeograph, } from './preservation-tokens.ts';

//region Line structure guard
// WHY THIS IS NOT IN `translate-validate.ts`, where it was first written and
// where the obvious tidying would put it back: that file compares BLOCKS and
// ATOMS, and adding a third comparison took it past its line budget. Splitting
// at this seam rather than raising the budget keeps each file answering one
// question, and this one already had a family: `line-structure.ts` decides
// whether a slice is governed, `line-structure-inherit.ts` decides which
// slices inherit that from their chunk, and this refuses a rendering that
// merged the lines the rule protects.
/**
 Whether a line carries text, as against a blank line or a bare quote marker.
 
 A LINE OF NOTHING BUT `>` SEPARATES QUOTED BLOCKS the way a blank line
 separates plain ones (class forty-seven, shi_Yumiaoya2, 2026-09-17: the
 original wrote three of them inside one farewell quote and the archive one,
 and the count read that as two merged lines).
 
 @param line - one line of a passage
 
 @returns Whether the line carries content
 
 @example
 ```ts
 const counted = carriesContent({ line: '> 猫醒了。', },);
 ```
 */
function carriesContent({ line, }: { readonly line: string; },): boolean {
  for (const character of line) {
    if ((character !== '>') && (character.trim() !== ''))
      return true;
  }
  return false;
}

/**
 Lines of one passage that carry content, in order.
 
 BLANK LINES ARE NOT COUNTED. They separate blocks rather than carry text,
 and a rendering that writes a different number of them has not merged
 anything.
 
 @param text - passage to read
 
 @returns Lines carrying content
 
 @example
 ```ts
 const lines = contentLines({ text: candidateText, },);
 ```
 */
function contentLines({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('\n',)
    .filter(function kept(line,): boolean {
      return carriesContent({ line, },);
    },);
}

/**
 Whether a line carries a Han character.
 
 @param line - one line
 
 @returns Whether any character is an ideograph
 
 @example
 ```ts
 const han = carriesHan({ line: '猫醒了。', },);
 ```
 */
function carriesHan({ line, }: { readonly line: string; },): boolean {
  for (const character of line) {
    if (isIdeograph(character,))
      return true;
  }
  return false;
}

/**
 Whether a line carries a Latin letter and no Han character: an English line
 the original itself wrote.
 
 @param line - one line
 
 @returns Whether the line is the original's own English
 
 @example
 ```ts
 const english = isOwnEnglish({ line: 'From *The Cat Show*', },);
 ```
 */
function isOwnEnglish({ line, }: { readonly line: string; },): boolean {
  if (carriesHan({ line, },))
    return false;
  for (const character of line) {
    if (((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z')))
      return true;
  }
  return false;
}

/**
 Counts adjacent pairs of a Han line and an English line in the original,
 which an English rendering owes one line, not two.
 
 THE ENGLISH LINE IS THE RENDERING OF ITS NEIGHBOUR (class forty-seven,
 shi_Yumiaoya2, 2026-09-17): the original quoted a film line in Chinese with
 its English beside it, the archive carried the English once, and the floor
 refused every rendering that did not quote it twice. Each line joins at
 most one pair, taken in order.
 
 @param lines - content lines of the original
 
 @returns How many such pairs the original carries
 
 @example
 ```ts
 const pairs = bilingualPairCount({ lines: contentLines({ text: sourceText, },), },);
 ```
 */
function bilingualPairCount({ lines, }: { readonly lines: readonly string[]; },): number {
  /**
   Pairs found so far.
   */
  let pairs = 0;
  /**
   Cursor over the lines.
   */
  let at = 0;
  while ((at + 1) < lines.length) {
    /**
     Line at the cursor.
     */
    const here = lines[at] ?? '';
    /**
     Line after it.
     */
    const next = lines[at + 1] ?? '';
    /**
     Whether the two are a Han line and its English, either way round.
     */
    const paired = (carriesHan({ line: here, },) && isOwnEnglish({ line: next, },))
      || (isOwnEnglish({ line: here, },) && carriesHan({ line: next, },));
    if (paired) {
      pairs += 1;
      at += 2;
      continue;
    }
    at += 1;
  }
  return pairs;
}

/**
 Names a governed rendering that merged lines its original kept apart.
 
 AGAINST THE ORIGINAL, NEVER THE PAGE. A governed slice's page may itself be
 flat, since 50 of 64 archive incumbents already violate the line rule, and
 flooring on it would fault the producer that correctly unmerges: exactly the
 repair the rule demands.
 
 FEWER LINES ONLY, never an equality check. Measured over the 211
 line-structured slices of the pinned corpus, the archive's own English
 matches its Chinese line for line on 115 and differs on 96, and 80 of those
 carry MORE lines than the Chinese, because an English rendering of Chinese
 verse legitimately expands. Requiring equality would send back nearly half of
 every governed rendering, so only a shortfall is named.
 
 ONE BLIND SPOT, NAMED RATHER THAN CLOSED. The count is over the whole slice,
 so a rendering merging two lines in one block while splitting one in another
 nets to the same total and passes here. Closing that needs per-block
 alignment, a larger instrument than the flattening this was built to catch,
 and the blocks themselves are compared separately either way.
 
 @param lineStructured - whether the line-structure rule governs this slice,
 decided upstream over the slice and its enclosing chunk together
 
 @param sourceText - original slice, whose lines the rendering owes
 
 @param candidateText - proposed translation of it
 
 @returns One finding where lines were merged, none otherwise
 
 @example
 ```ts
 const found = compareLineCounts({ lineStructured, sourceText, candidateText, },);
 ```
 */
export function compareLineCounts(
  {
    lineStructured,
    sourceText,
    candidateText,
  }: {
    readonly lineStructured: boolean;
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  if (!lineStructured)
    return [];

  /**
   Content lines of the original.
   */
  const sourceLines = contentLines({ text: sourceText, },);

  /**
   Lines the original keeps apart, a Han line beside its own English owed once.
   */
  const owed = sourceLines.length - bilingualPairCount({ lines: sourceLines, },);

  /**
   Lines the rendering carries.
   */
  const carried = contentLines({ text: candidateText, },)
    .length;

  if (carried >= owed)
    return [];

  return [
    `This slice is LINE-STRUCTURED: every line stands as its own unit, so your `
      + `rendering owes one line per line of the ORIGINAL and may never merge two `
      + `into one. Yours carries ${String(carried,)} lines of content where the `
      + `ORIGINAL has ${String(owed,)}. Put back the line breaks you merged, keeping `
      + `the wording you chose.`,
  ];
}
//endregion Line structure guard
