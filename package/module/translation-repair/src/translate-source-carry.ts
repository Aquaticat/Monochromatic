import type { DeclaredNamePair, } from './linked-title-declared-name.ts';
import { droppedAddressFindings, } from './translate-address-drop.ts';
import { declaredLinkNameFindings, } from './translate-declared-link-name.ts';
import { hanTitleFindings, } from './translate-han-title.ts';
import { droppedMarkerFindings, } from './translate-marker-drop.ts';

//region Source carry floors
// What the original passage carries that every candidate must carry too,
// read before any judge: its footnote markers (class ninety-two), its
// second-person address (class ninety-seven), its bracketed work titles
// in English (class ninety-eight) and a declared name inside a linked title
// in its declared form (class one hundred fourteen). The floors run in that order and the
// first one that speaks decides, so a candidate is refused for one thing at
// a time.

/**
 Findings of the first source-carry floor a candidate fails, empty where it
 passes them all.

 @param sourceText - original passage

 @param candidateText - rendering under the floors

 @param pageText - text the rendering would replace, empty where the page
 has none

 @param declared - name pairs the front matter declares, none where the
 caller has no front matter to read

 @returns Findings of the first failing floor, or none

 @example
 ```ts
 const findings = sourceCarryFindings({ sourceText, candidateText, pageText, },);
 ```
 */
export function sourceCarryFindings(
  {
    sourceText,
    candidateText,
    pageText,
    declared = [],
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText: string;
    readonly declared?: readonly DeclaredNamePair[];
  },
): readonly string[] {
  /**
   Footnote markers the candidate dropped.
   */
  const markerFindings = droppedMarkerFindings({
    sourceText,
    candidateText,
  },);
  if (markerFindings.length > 0)
    return markerFindings;
  /**
   Second-person address the candidate turned into the third person.
   */
  const addressFindings = droppedAddressFindings({
    sourceText,
    candidateText,
  },);
  if (addressFindings.length > 0)
    return addressFindings;
  /**
   Bracketed work titles the candidate left in Han.
   */
  const titleFindings = hanTitleFindings({
    sourceText,
    candidateText,
    pageText,
  },);
  if (titleFindings.length > 0)
    return titleFindings;
  return declaredLinkNameFindings({
    sourceText,
    candidateText,
    declared,
  },);
}

//endregion Source carry floors
