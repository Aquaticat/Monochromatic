//region Sheet evidence copied into a candidate
// MEASURED ON MIO27 (2026-09-17): of 68 translate slate candidates, four
// carried the writer sheet's own WHAT THE PICTURES HERE SAY block, copied
// under the picture component with the readers' transcript inside, and on
// both slices that had one the judges chose it (three of four on slice 11,
// praising it for "all transcribed text exactly as in the ORIGINAL"). The
// contest chose the poem slice's carrier five of five; the consolidation
// replaced it because it was 10.9 times the original's size, not because
// anyone named the block. A sheet's evidence blocks are shown to a writer and
// are never part of the passage, so a candidate carrying one of their labels
// is not a rendering of the original and never reaches a judge.

/**
 Labels the sheets fence their evidence blocks with, none of which a page
 carries.
 */
const SHEET_LABELS: readonly string[] = [
  'WHAT THE PICTURES HERE SAY',
  'EXISTING TRANSLATION',
  'ATTESTED DETAILS',
  'DECLARED NAMES',
  'CITED REFERENCES',
  'LATEST REJECTION',
  'ARCHIVE RENDERING',
];

/**
 Findings for a candidate that carries one of the sheet's evidence labels the
 original and the page do not.

 @param sourceText - original slice

 @param pageText - page slice the candidate would replace, empty where none

 @param candidateText - candidate under validation

 @returns One finding per label the candidate alone carries

 @example
 ```ts
 const findings = sheetLeakFindings({ sourceText: '猫睡了。', pageText: '', candidateText: 'The cat slept.\n===== ATTESTED DETAILS =====', },);
 ```
 */
export function sheetLeakFindings(
  {
    sourceText,
    pageText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  return SHEET_LABELS
    .filter(function leaked(label,): boolean {
      return candidateText.includes(label,)
        && (!sourceText.includes(label,))
        && (!pageText.includes(label,));
    },)
    .map(function toFinding(label,): string {
      return `Your translation carries the sheet's own "${label}" block, which is evidence shown to you and `
        + 'never part of the passage. Render the ORIGINAL alone and leave every fenced block out.';
    },);
}

//endregion Sheet evidence copied into a candidate
