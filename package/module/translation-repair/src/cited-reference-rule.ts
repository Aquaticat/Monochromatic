//region Cited-reference rule
// The one sentence both sheets carry with the references, and the fenced
// block that carries it. Shared by `critic-prompt.ts` and
// `adjudicate-prompt.ts` so the critic that files and the panel that votes
// read the same rule (class thirty-five, 2026-09-16).

/**
 What the references are for and what they are not. Written against the
 Mio19 deletion: four critics reported "older sister who is also trans" as
 an addition because the ORIGINAL does not say it, and the blog the
 ORIGINAL cites does.
 */
export const CITED_REFERENCE_RULE: string = 'CITED REFERENCES are what the pages the ORIGINAL itself links say, fetched once and kept.'
  + ' A detail the TRANSLATION carries that the ORIGINAL does not state but a cited reference states'
  + ' is ACCURATE detail the translator took from the ORIGINAL\'s own references:'
  + ' never report or support it as accuracy/addition, and never as any other defect for being absent from the ORIGINAL.'
  + ' The references are evidence for judging what the TRANSLATION already says and nothing else:'
  + ' they never license adding to the TRANSLATION, never outrank the ORIGINAL where the two disagree,'
  + ' and never license a defect elsewhere.';

/**
 Fenced block carrying the references and the rule, or nothing at all when
 the original links nowhere, so a sheet never carries an empty heading.

 @param fence - delimiter chosen against every text on the sheet, the
 references included

 @param referenceContext - reference lines, one per page, from
 `citedReferenceBlock`

 @returns Block ending in a newline, or an empty string

 @example
 ```ts
 const block = citedReferenceBlockText({ fence: '=====', referenceContext, },);
 ```
 */
export function citedReferenceBlockText(
  {
    fence,
    referenceContext,
  }: {
    readonly fence: string;
    readonly referenceContext?: string;
  },
): string {
  if ((referenceContext === undefined) || (referenceContext === ''))
    return '';
  return `${fence} CITED REFERENCES, EVIDENCE ONLY ${fence}
${referenceContext}
${fence} ${CITED_REFERENCE_RULE} ${fence}
`;
}

//endregion Cited-reference rule
