import {
  type BilingualPair,
  pairBoundFindings,
} from './bilingual-pair-bound.ts';
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
 
 @returns Each such pair, in order
 
 @example
 ```ts
 const pairs = bilingualPairs({ lines: contentLines({ text: sourceText, },), },);
 ```
 */
function bilingualPairs({ lines, }: { readonly lines: readonly string[]; },): readonly BilingualPair[] {
  /**
   Pairs found so far.
   */
  const pairs: BilingualPair[] = [];
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
    if (carriesHan({ line: here, },) && isOwnEnglish({ line: next, },)) {
      pairs.push({
        han: here,
        english: next,
      },);
      at += 2;
      continue;
    }
    if (isOwnEnglish({ line: here, },) && carriesHan({ line: next, },)) {
      pairs.push({
        han: next,
        english: here,
      },);
      at += 2;
      continue;
    }
    at += 1;
  }
  return pairs;
}

/**
 Content of a line as a key for counting repeats: the quote markers and the
 surrounding whitespace off, the wording kept as written.

 @param line - one content line

 @returns Wording the line carries

 @example
 ```ts
 const key = lineKey({ line: '> From *The Cat Show*', },);
 ```
 */
function lineKey({ line, }: { readonly line: string; },): string {
  for (let start = 0; start < line.length; start += 1) {
    /**
     Character at the cursor.
     */
    const character = line.charAt(start,);
    if ((character !== '>') && (character.trim() !== '')) {
      /**
       Wording from the first content character on.
       */
      const wording = line.slice(start,);
      return wording.trim();
    }
  }
  return '';
}

/**
 How many times each wording occurs among some lines.

 @param lines - content lines of one passage

 @returns Occurrences by wording

 @example
 ```ts
 const counts = lineCounts({ lines: contentLines({ text, },), },);
 ```
 */
function lineCounts({ lines, }: { readonly lines: readonly string[]; },): ReadonlyMap<string, number> {
  /**
   Occurrences seen so far.
   */
  const counts = new Map<string, number>();
  for (const line of lines) {
    /**
     Wording of this line.
     */
    const key = lineKey({ line, },);
    counts.set(
      key,
      (counts.get(key,) ?? 0) + 1,
    );
  }
  return counts;
}

/**
 Most often any one wording occurs among some lines.

 @param lines - content lines of one passage

 @returns Highest occurrence count, zero for no lines

 @example
 ```ts
 const refrain = maxRepeat({ lines: contentLines({ text, },), },);
 ```
 */
function maxRepeat({ lines, }: { readonly lines: readonly string[]; },): number {
  return Math.max(
    0,
    ...lineCounts({ lines, },)
      .values(),
  );
}

/**
 Names a governed rendering that carries a line more often than its original
 carries any line.

 CLASS SEVENTY-FOUR (shi_Yumiaoya6, 2026-09-21). The original quoted a film
 line in Chinese with its English beside it and attributed it the same way,
 Chinese line then English line; the page rendered the Chinese attribution
 into the very words of the English one beside it and kept both, so the
 attribution stood twice. The shortfall check never sees a surplus. A refrain
 the original itself repeats is owed its repeats, and a rendering's wording
 cannot be matched to the original's across languages, so the bound is how
 often the original repeats any line of its own.

 @param sourceLines - content lines of the original

 @param candidateLines - content lines of the rendering

 @returns One finding per wording carried more often than the original
 carries it

 @example
 ```ts
 const found = repeatedLines({ sourceLines, candidateLines, },);
 ```
 */
function repeatedLines(
  {
    sourceLines,
    candidateLines,
  }: {
    readonly sourceLines: readonly string[];
    readonly candidateLines: readonly string[];
  },
): readonly string[] {
  /**
   Most often the original repeats any one line.
   */
  const allowed = maxRepeat({ lines: sourceLines, },);
  /**
   Occurrences in the rendering, by wording.
   */
  const carried = lineCounts({ lines: candidateLines, },);
  /**
   Wordings and their counts, for the scan.
   */
  const entries = [...carried.entries(),];
  return entries.flatMap(function toFinding([
    wording,
    times,
  ],): readonly string[] {
    if ((times < 2) || (times <= allowed))
      return [];
    return [
      `This slice is LINE-STRUCTURED and your rendering repeats the line \`${wording}\` `
        + `${String(times,)} times where the ORIGINAL repeats no line more than ${String(allowed,)} times. A Chinese line `
        + `and its own English beside it are one line to render, not two. Drop the repeat, keeping `
        + `the wording you chose.`,
    ];
  },);
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
 
 @param pageText - translation of the slice as the page stands, which bounds a
 bilingual pair to one line where it carries the pair so (class eighty,
 `bilingual-pair-bound.ts`); absent where the slice has none
 
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
    pageText,
  }: {
    readonly lineStructured: boolean;
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText?: string;
  },
): readonly string[] {
  if (!lineStructured)
    return [];

  /**
   Content lines of the original.
   */
  const sourceLines = contentLines({ text: sourceText, },);

  /**
   Han lines the original gives with their own English beside them.
   */
  const pairs = bilingualPairs({ lines: sourceLines, },);

  /**
   Lines the original keeps apart, a Han line beside its own English owed once.
   */
  const owed = sourceLines.length - pairs.length;

  /**
   Content lines of the rendering.
   */
  const candidateLines = contentLines({ text: candidateText, },);

  /**
   Lines the rendering carries.
   */
  const carried = candidateLines.length;

  /**
   Wordings the rendering repeats beyond the original's own repeats (class
   seventy-four).
   */
  const repeats = repeatedLines({
    sourceLines,
    candidateLines,
  },);
  if (carried >= owed)
    return [
      ...pairBoundFindings({
        pairs,
        ...((pageText === undefined) ? {} : { pageText, }),
        candidateText,
      },),
      ...repeats,
    ];

  return [
    `This slice is LINE-STRUCTURED: every line stands as its own unit, so your `
      + `rendering owes one line per line of the ORIGINAL and may never merge two `
      + `into one. Yours carries ${String(carried,)} lines of content where the `
      + `ORIGINAL has ${String(owed,)}. Put back the line breaks you merged, keeping `
      + `the wording you chose.`,
    ...repeats,
  ];
}
//endregion Line structure guard
