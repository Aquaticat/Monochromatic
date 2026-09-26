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
// a rendering inflects and the judges still choose among renderings. The
// owner added the same day that the term is refused even where the existing
// translation keeps it, so the page's own text earns no exception; comments
// are cut on both sides.

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
 Every index at which a needle starts in a text, overlapping starts included.

 @param text - lower-cased candidate text

 @param needle - lower-cased form looked for

 @returns Start indices in ascending order, empty where the needle is absent

 @example
 ```ts
 occurrenceStarts({ text: 'head and head', needle: 'head', },);
 // => [0, 9]
 ```
 */
function occurrenceStarts(
  {
    text,
    needle,
  }: {
    readonly text: string;
    readonly needle: string;
  },
): readonly number[] {
  /**
   Starts found so far; a linear cursor scan, since the text is unbounded.
   */
  const starts: number[] = [];
  /**
   Index the next search starts from.
   */
  let cursor = text.indexOf(needle,);
  while (cursor !== (-1)) {
    starts.push(cursor,);
    cursor = text.indexOf(
      needle,
      cursor + 1,
    );
  }
  return starts;
}

/**
 Whether a refused-form occurrence is the opening of a longer accepted
 rendering, as "inside her head" opens "inside her headpiece" (class one
 hundred sixty-three). A rendering excuses the occurrence only when it starts
 inside the occurrence and runs past its end; one that ends inside it ("a
 minor" in "a minor trans girl") excuses nothing.

 @param entry - term whose renderings may excuse the occurrence

 @param lowered - lower-cased candidate text

 @param start - index the refused-form occurrence starts at

 @param end - index just past the refused-form occurrence

 @returns True where an accepted rendering carries the occurrence inside it

 @example
 ```ts
 renderingCarries({ entry, lowered: 'inside her headpiece', start: 0, end: 15, },);
 // => true
 ```
 */
function renderingCarries(
  {
    entry,
    lowered,
    start,
    end,
  }: {
    readonly entry: CommunityTerm;
    readonly lowered: string;
    readonly start: number;
    readonly end: number;
  },
): boolean {
  return entry
    .renderings
    .some(function carries(rendering,): boolean {
      /**
       Rendering in lower case, matched as the refused forms are.
       */
      const needle = rendering.toLowerCase();
      return occurrenceStarts({
        text: lowered,
        needle,
      },)
        .some(function spans(renderingStart,): boolean {
          return (renderingStart >= start)
            && (renderingStart < end)
            && ((renderingStart + needle.length) > end);
        },);
    },);
}

/**
 First form the entry refuses that a text writes, in any casing, where some
 occurrence is not the opening of an accepted rendering (`renderingCarries`).

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
      /**
       Form in lower case, matched against the lowered text.
       */
      const needle = form.toLowerCase();
      return occurrenceStarts({
        text: lowered,
        needle,
      },)
        .some(function standsApart(start,): boolean {
          return !renderingCarries({
            entry,
            lowered,
            start,
            end: start + needle.length,
          },);
        },);
    },);
  return found ?? '';
}

/**
 Findings for glossary terms the original carries that a candidate keeps in
 Han or writes in a refused form.

 @param sourceText - original passage

 @param candidateText - rendering under the floor

 @param glossary - terms to hold; defaults to the corpus glossary

 @param noun - what the finding calls a term, so a word from the rendering
 glossary (`rendering-glossary.ts`) is not called the community's

 @returns One finding per term the candidate fails, empty where it passes

 @example
 ```ts
 const findings = communityTermFindings({ sourceText, candidateText, },);
 ```
 */
export function communityTermFindings(
  {
    sourceText,
    candidateText,
    glossary = COMMUNITY_GLOSSARY,
    noun = 'community term',
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly glossary?: readonly CommunityTerm[];
    readonly noun?: string;
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
  return carried.flatMap(function findingsFor(entry,): readonly string[] {
    /**
     Term as the finding names it, without the leading space a Latin term
     (" OD") carries so it does not match inside a longer word.
     */
    const shownTerm = entry
      .term
      .trim();
    if (candidate.includes(entry.term,)) {
      return [
        `Your translation leaves the ${noun} ${shownTerm} untranslated. Render it as ${
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
      `Your translation writes "${refused}" for the ${noun} ${entry.term}. Render it as ${
        renderingList({ entry, },)
      }: ${entry.why}.`,
    ];
  },);
}

//endregion Community term floor
