import {
  COMMUNITY_GLOSSARY,
  type CommunityTerm,
  communityTermsIn,
} from './community-glossary.ts';
import { withoutComments, } from './translate-address-drop.ts';

//region Community term floor
// CLASS ONE HUNDRED NINETEEN (shi_Yumiaoya19, 2026-09-24). The glossary put
// the community's words on every sheet as evidence to weigh, and for 药娘 the
// judges weighed the archive translator's comment higher and kept the word
// in Han, where two earlier runs had written two different English forms.
// The owner ruled on 2026-09-24 that the page says "trans girl" or "trans
// woman". A candidate that keeps a glossary term the original carries in
// Han, or writes a form the entry refuses (the pinyin), is refused HERE
// before any judge reads it. A rendering the entry lists is not required:
// a rendering inflects and the judges still choose among renderings. A term
// the page itself keeps outside a comment is left to the judges, and
// comments are cut on every side.

/**
 Accepted renderings quoted for a finding.

 @param entry - term whose renderings are listed

 @returns Renderings quoted and joined with "or"

 @example
 ```ts
 renderingList({ entry, },);
 // => '"trans girl" or "trans woman" or "trans women"'
 ```
 */
function renderingList(
  { entry, }: { readonly entry: CommunityTerm; },
): string {
  return entry.renderings
    .map(function quoted(rendering,): string {
      return `"${rendering}"`;
    },)
    .join(' or ',);
}

/**
 First form the entry refuses that a text writes, in any casing.

 @param entry - term whose refused forms are looked for

 @param text - candidate text with comments cut

 @returns Refused form found, empty where none is

 @example
 ```ts
 refusedFormIn({ entry, text: 'a little yaoniang', },);
 // => 'yaoniang'
 ```
 */
function refusedFormIn(
  {
    entry,
    text,
  }: {
    readonly entry: CommunityTerm;
    readonly text: string;
  },
): string {
  /**
   Text in lower case, since a form is refused in any casing.
   */
  const lowered = text.toLowerCase();
  /**
   Refused form the text writes, undefined where it writes none.
   */
  const found = entry
    .refusedForms
    .find(function written(form,): boolean {
      return lowered.includes(form.toLowerCase(),);
    },);
  return found ?? '';
}

/**
 Findings for glossary terms the original carries that a candidate keeps in
 Han or writes in a refused form.

 @param sourceText - original passage

 @param candidateText - rendering under the floor

 @param pageText - text the rendering would replace, empty where the page
 has none

 @param glossary - terms to hold; defaults to the corpus glossary

 @returns One finding per term the candidate fails, empty where it passes

 @example
 ```ts
 const findings = communityTermFindings({ sourceText, candidateText, pageText: '', },);
 ```
 */
export function communityTermFindings(
  {
    sourceText,
    candidateText,
    pageText,
    glossary = COMMUNITY_GLOSSARY,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText: string;
    readonly glossary?: readonly CommunityTerm[];
  },
): readonly string[] {
  /**
   Terms the original carries outside its comments.
   */
  const carried = communityTermsIn({
    text: withoutComments({ text: sourceText, },),
    glossary,
  },);
  if (carried.length === 0)
    return [];
  /**
   Candidate with its comments cut.
   */
  const candidate = withoutComments({ text: candidateText, },);
  /**
   Page text with its comments cut.
   */
  const page = withoutComments({ text: pageText, },);
  return carried.flatMap(function findingsFor(entry,): readonly string[] {
    // A term the page itself keeps is the page's own choice, left to the judges.
    if (page.includes(entry.term,))
      return [];
    if (candidate.includes(entry.term,)) {
      return [
        `Your translation leaves the community term ${entry.term} in Han. Render it as ${
          renderingList({ entry, },)
        }: ${entry.why}.`,
      ];
    }
    /**
     Refused form the candidate writes, empty for none.
     */
    const refused = refusedFormIn({
      entry,
      text: candidate,
    },);
    if (refused === '')
      return [];
    return [
      `Your translation writes "${refused}" for the community term ${entry.term}. Render it as ${
        renderingList({ entry, },)
      }: ${entry.why}.`,
    ];
  },);
}

//endregion Community term floor
