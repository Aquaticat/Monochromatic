import { withoutComments, } from './translate-address-drop.ts';

//region Closing quotation marks with no opening one
// CLASS ONE HUNDRED SIXTY-FIVE (TianqiChen6665, 2026-09-26). The original's
// final message quotes each of its three lines with 「」, and the archive's
// rendering closed the last line with ” and opened none; the page shipped it
// on an unendorsed standing. A quotation mark that closes nothing is a
// broken sentence on the page whatever the judges read, so a candidate
// carrying one is refused before any judge reads it, which also makes such
// an archive rendering an ineligible standing. THE FLOOR STANDS ASIDE where
// the original itself closes a quotation it never opened (a slice boundary
// inside a quotation), since the rendering then owes the same shape. An
// opening mark with no closing one is no fault: a quotation over several
// paragraphs opens each and closes only the last. Straight quotes and single
// marks are left alone, since an apostrophe is a single closing mark.

/**
 Closing mark of each quotation pair, keyed by its opening mark.
 */
const CLOSER_OF: Readonly<Record<string, string>> = {
  '“': '”',
  '「': '」',
  '『': '』',
};

/**
 Opening mark of each quotation pair, keyed by its closing mark.
 */
const OPENER_OF: Readonly<Record<string, string>> = {
  '”': '“',
  '」': '「',
  '』': '『',
};

/**
 Closing marks in a text that close no quotation opened before them, in
 text order.

 @param text - passage to scan, comments already cut

 @returns Each stray closing mark

 @example
 ```ts
 strayClosers({ text: '猫说。」', },); // ['」']
 ```
 */
function strayClosers({ text, }: { readonly text: string; },): readonly string[] {
  /**
   Open quotations of each kind so far.
   */
  const depth = new Map<string, number>();
  /**
   Closing marks met with nothing of their kind open.
   */
  const strays: string[] = [];
  // Code-unit scan: every quotation mark read here is one BMP code unit, so
  // surrogate halves and combining marks read as neither opener nor closer.
  for (let index = 0; index < text.length; index += 1) {
    /**
     Code unit under the cursor.
     */
    const character = text.charAt(index,);
    if (character in CLOSER_OF) {
      depth.set(
        character,
        (depth.get(character,) ?? 0) + 1,
      );
      continue;
    }
    /**
     Opening mark this character would close.
     */
    const opener = OPENER_OF[character];
    if (opener === undefined)
      continue;
    /**
     Quotations of this kind still open.
     */
    const open = depth.get(opener,) ?? 0;
    if (open === 0) {
      strays.push(character,);
      continue;
    }
    depth.set(
      opener,
      open - 1,
    );
  }
  return strays;
}

/**
 Findings for a candidate carrying a closing quotation mark with no opening
 mark before it, where the original's own marks close only what they open.

 @param sourceText - original slice

 @param candidateText - candidate under validation

 @returns One finding naming the stray marks, or none

 @example
 ```ts
 const findings = strayClosingQuoteFindings({ sourceText: '「猫。」', candidateText: 'The cat.”', },);
 ```
 */
export function strayClosingQuoteFindings(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   Closing marks in the original that close nothing.
   */
  const sourceStrays = strayClosers({ text: withoutComments({ text: sourceText, },), },);
  if (sourceStrays.length > 0)
    return [];
  /**
   Closing marks in the candidate that close nothing.
   */
  const strays = strayClosers({ text: withoutComments({ text: candidateText, },), },);
  if (strays.length === 0)
    return [];
  /**
   Stray marks as the finding names them.
   */
  const named = strays.join(' ',);
  /**
   Finding telling the writer what to repair.
   */
  const finding = `Your translation closes a quotation it never opened (${named}): the ORIGINAL opens every `
    + 'quotation it closes. Open each quoted passage where the ORIGINAL opens it, and close it where the '
    + 'ORIGINAL closes it.';
  return [finding,];
}

//endregion Closing quotation marks with no opening one
