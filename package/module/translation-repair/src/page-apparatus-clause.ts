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
//
// THE ONE HUNDRED FORTY-THIRD CLASS (hulicaijia26, 2026-09-26). The archive's
// footnote 7 explained the wordplay between 晚安 (goodnight) and 金刚烷胺
// (amantadine). A critic filed it as an addition, the panel accepted it 2 to
// 1, class one hundred seven disputed the archive, and four of five contest
// judges called the note an addition. No sheet named a note explaining
// wordplay, and the critic and panel sheets carried their own shorter list.
// The same clause also said only a contradicted detail is an addition, which a
// class one hundred eight gate ballot used to keep an invented overdose
// detail. Apparatus explains the text; what happened is never apparatus.

/**
 A translator's note explaining what the English cannot carry by itself.

 NAMED ON EVERY SHEET THAT FILES, VOTES ON OR WRITES AGAINST THE ARCHIVE
 (critic, panel, contest, writers), because hulicaijia26 showed each sheet's
 list of accurate translator detail read as exhaustive: a note on a pun was
 on none of them, and three stages in a row called it an addition.

 @example
 ```ts
 const kinds = `a contributor credit, ${TRANSLATOR_NOTE_KIND}`;
 ```
 */
export const TRANSLATOR_NOTE_KIND: string = 'a translator\'s note explaining a pun, wordplay, an allusion or a term'
  + ' the English cannot carry by itself (the pun or allusion is in the ORIGINAL, so explaining it states'
  + ' nothing the ORIGINAL does not)';

/**
 The bound on apparatus: narrative detail is an addition however silent the
 original is about it.

 STATED BESIDE THE APPARATUS, not in place of it, because the older wording
 ("only what the ORIGINAL contradicts is an addition") was read by a class one
 hundred eight gate ballot as licence to keep "She took medication that
 night" where the original never says she did.

 @example
 ```ts
 const policy = `${PAGE_APPARATUS_IS_KEPT} ${NARRATIVE_DETAIL_IS_NOT_APPARATUS}`;
 ```
 */
export const NARRATIVE_DETAIL_IS_NOT_APPARATUS: string = 'WHAT HAPPENED IS NEVER APPARATUS: an event, an action,'
  + ' a method, a time, a cause or a characterisation the ORIGINAL does not state is an addition even where'
  + ' nothing in the ORIGINAL contradicts it.';

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
  'a gloss of a name or a term (a line or a parenthesis saying what it means),',
  `${TRANSLATOR_NOTE_KIND},`,
  'an explanatory aside, a spelled-out referent, a contributor credit, a citation\'s translator.',
  'It is the page\'s own apparatus: it explains the text and asserts nothing about what happened,',
  'so a candidate carrying it where the page has it has added nothing, and a candidate leaving it out',
  'has dropped page content.',
  NARRATIVE_DETAIL_IS_NOT_APPARATUS,
  'The house rules still apply to the apparatus as to the rest of the passage: its tense follows the',
  'passage, and its spelling follows the declared names.',
].join(' ',);

//endregion Page apparatus clause
