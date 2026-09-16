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

/**
 The same rule for the sheets that weigh renderings against each other: the
 lane contest, the consolidation writer and gate, and the slate judge.
 Written against the Mio20 loss (class thirty-six, 2026-09-16): the panel
 rejected the addition claim and the repair lane kept "who is also trans",
 then three of five contest judges called the repair candidate unsupported
 for carrying it, the translate lane won, and the consolidation wrote from
 the lane that never had it.
 */
export const CITED_REFERENCE_CANDIDATE_RULE: string = 'CITED REFERENCES are what the pages the ORIGINAL itself links say, fetched once and kept.'
  + ' A detail the ARCHIVE RENDERING or a candidate carries that the ORIGINAL does not state but a cited reference states'
  + ' is ACCURATE detail the translator took from the ORIGINAL\'s own references:'
  + ' never count it unsupported, never prefer a rendering for dropping it,'
  + ' and treat it as the accurate archive detail the rules say to keep.'
  + ' The references are evidence for judging what a rendering already says and nothing else:'
  + ' they never license adding to a rendering, never outrank the ORIGINAL where the two disagree,'
  + ' and never license a finding elsewhere.';

/**
 Fenced lines carrying the references and the candidate-sheet rule for a
 sheet assembled line by line, or nothing at all when the original links
 nowhere.

 @param fence - delimiter chosen against every text on the sheet, the
 references included

 @param referenceContext - reference lines, one per page, from
 `citedReferenceBlock`

 @returns Lines ending in a blank one, or no lines

 @example
 ```ts
 const lines = citedReferenceCandidateLines({ fence: '=====', referenceContext, },);
 ```
 */
export function citedReferenceCandidateLines(
  {
    fence,
    referenceContext,
  }: {
    readonly fence: string;
    readonly referenceContext?: string;
  },
): readonly string[] {
  if ((referenceContext === undefined) || (referenceContext === ''))
    return [];
  return [
    `${fence} CITED REFERENCES, EVIDENCE ONLY ${fence}`,
    referenceContext,
    `${fence} ${CITED_REFERENCE_CANDIDATE_RULE} ${fence}`,
    '',
  ];
}

/**
 The references as one labelled evidence entry for a sheet that renders
 evidence by label, or none when the original links nowhere.

 @param referenceContext - reference lines, one per page

 @returns One entry carrying the rule in its label, or none

 @example
 ```ts
 const evidence = [...citedReferenceEvidence({ referenceContext, },),];
 ```
 */
export function citedReferenceEvidence(
  { referenceContext, }: { readonly referenceContext?: string; },
): readonly {
  readonly label: string;
  readonly text: string;
}[] {
  if ((referenceContext === undefined) || (referenceContext === ''))
    return [];
  return [
    {
      label: `CITED REFERENCES, EVIDENCE ONLY. ${CITED_REFERENCE_CANDIDATE_RULE}`,
      text: referenceContext,
    },
  ];
}

//endregion Cited-reference rule
