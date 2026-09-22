//region Page apparatus clause
// THE EIGHTY-FIFTH CLASS (CuspariaKLSY6, 2026-09-22). The archive carried a
// translator's gloss line, "“Ling Shui Yu Yu Zi” means fish in clear water.",
// inside a paragraph the Chinese is silent about. The lane contest's policy
// and the consolidate gate's policy say such content is the page's own and
// dropping it is a fault; the slate criteria said "nothing added" and the
// consolidation writers' KEEP rule listed a name, a referent, a credit and a
// citation's translator, so every consolidation wrote the seven Chinese lines
// without the gloss, the slate rewarded it ("nothing added or dropped"), and
// the gate refused it 3 to 2 for dropping page content, shipping the archive
// in the present tense the house rule moves to the past. CuspariaKLSY5 had
// gone the other way on the same slice (the gloss lost, the tense past). One
// clause, on every sheet that writes or judges against the archive, so the
// page's apparatus is carried and the house rule can act on the rest.

/**
 What the existing translation carries and the original is silent about, and
 what every writer and judge is to make of it: the page's own apparatus, kept.

 ONE WORDING FOR EVERY SHEET, because the class arose from four sheets saying
 four things about the same line; a writer told to carry it and a judge told
 it is an addition produce a candidate the next judge refuses.

 @example
 ```ts
 const rule = `Faithfulness: nothing added. ${PAGE_APPARATUS_IS_KEPT}`;
 ```
 */
export const PAGE_APPARATUS_IS_KEPT: string = [
  'WHAT THE EXISTING TRANSLATION CARRIES AND THE ORIGINAL IS SILENT ABOUT IS KEPT IN PLACE:',
  'a gloss of a name or a term (a line or a parenthesis saying what it means), an explanatory aside,',
  'a spelled-out referent, a contributor credit, a citation\'s translator. It is the page\'s own apparatus,',
  'so a candidate carrying it where the page has it has added nothing, and a candidate leaving it out',
  'has dropped page content. Only what the ORIGINAL contradicts is an addition. The house rules still',
  'apply to it as to the rest of the passage: its tense follows the passage, and its spelling follows',
  'the declared names.',
].join(' ',);

//endregion Page apparatus clause
