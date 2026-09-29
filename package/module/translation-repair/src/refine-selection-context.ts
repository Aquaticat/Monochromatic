import type { AbsoluteNaturalnessFinding, } from './absolute-naturalness-review-wire.ts';
import type { SelectEvidence, } from './candidate-select-wire.ts';
import { citedReferenceEvidence, } from './cited-reference-rule.ts';
import { declaredNamesEvidence, } from './declared-names-evidence.ts';
import { HOUSE_FORM_CORRECTION_KEEPS_MEANING, } from './house-form-corrections.ts';

//region Refinement selection context
// Keeps exploratory refinement and required correction from asking selectors
// contradictory questions about whether current wording may remain.
//
// OBJECTION CORRECTION (owner, 2026-09-27, the fourteenth and fifteenth
// addenda of `doc/decision/translation-repair-ineligible-standing.md`). Over a
// standing the deterministic rule refused, the consolidation ships whatever
// the gate or the slate judges held against it, so their objections become
// corrections to make where the ORIGINAL supports them. Unlike required
// naturalness correction the text still ships unchanged when no candidate
// earns its place: an objection is a claim, and the base remains the fallback.

/**
 Judges whose objections an objection correction answers.
 */
export type ObjectionOrigin = 'consolidation gate' | 'consolidation slate';

/**
 What one set of judges objected to.

 @example
 ```ts
 const group: ObjectionGroup = { origin: 'consolidation gate', objections: ['adds a purr'], };
 ```
 */
export type ObjectionGroup = {
  /**
   Judges the objections come from.
   */
  readonly origin: ObjectionOrigin;

  /**
   Each objecting judge's reason as written, a claim to check against the
   ORIGINAL rather than a fact.
   */
  readonly objections: readonly string[];
};

/**
 Names every set of objecting judges, for a sentence.

 @param groups - objections by the judges they come from

 @returns The judges joined with "and"

 @example
 ```ts
 objectingJudgesOf({ groups, },); // => 'consolidation slate and consolidation gate'
 ```
 */
export function objectingJudgesOf(
  { groups, }: { readonly groups: readonly ObjectionGroup[]; },
): string {
  return groups
    .map(function originOf(group,): string {
      return group.origin;
    },)
    .join(' and ',);
}

/**
 One prior correction outcome that failed to replace rejected text.
 
 @example
 ```ts
 const prior: PriorNaturalnessCorrection = { candidateText: 'The cat slept.', findings: ['gate kept rejected input'], };
 ```
 */
export type PriorNaturalnessCorrection = {
  /**
   Exact proposal prior round tried to authorize.
   */
  readonly candidateText: string;

  /**
   Generation,
   selection,
   structure,
   and fidelity findings explaining failure.
   */
  readonly findings: readonly string[];
};

/**
 Renders prior failed corrections as evidence against repeating them, one
 block per attempt in the order tried.

 The refine selection context and the consolidation gate's correction sheet
 each kept their own copy of this rendering (audit area six, 2026-09-28);
 two sheets showing one history two ways would let the judges and the
 selectors read different evidence.

 @param priors - failed corrections, oldest first

 @returns One rendered block per attempt

 @example
 ```ts
 renderPriorCorrections({ priors: [{ candidateText: 'The cat slept.', findings: ['It repeats itself.',], },], },);
 // ['Attempt 1 candidate:\nThe cat slept.\nFindings:\nIt repeats itself.']
 ```
 */
export function renderPriorCorrections(
  { priors, }: { readonly priors: readonly PriorNaturalnessCorrection[]; },
): readonly string[] {
  return priors.map(function renderPrior(
    prior,
    index,
  ): string {
    /**
     Prior findings rendered in original order.
     */
    const findings = prior.findings
      .join('\n',);
    return `Attempt ${String(index + 1,)} candidate:\n${prior.candidateText}\nFindings:\n${findings}`;
  },);
}

/**
 Why refinement is running and whether unchanged text remains admissible.
 
 @example
 ```ts
 const mode: RefineStageMode = { kind: 'comparative', };
 ```
 */
export type RefineStageMode =
  | {
    /**
     Exploratory improvement where accepted input remains fallback.
     */
    readonly kind: 'comparative';
  }
  | {
    /**
     Mandatory correction because absolute review rejected input.
     */
    readonly kind: 'required-naturalness-correction';

    /**
     Material defects candidate must resolve together.
     */
    readonly findings: readonly AbsoluteNaturalnessFinding[];

    /**
     Earlier failed strategies next correction must not repeat.
     */
    readonly priorCorrections?: readonly PriorNaturalnessCorrection[];
  }
  | {
    /**
     Correction of what judges objected to, the input remaining the fallback.
     */
    readonly kind: 'objection-correction';

    /**
     Objections by the judges they come from, each set under its own
     heading: the slate's reasons where it was declined twice and the gate's
     where it objected (fourteenth and fifteenth addenda).
     */
    readonly groups: readonly ObjectionGroup[];
  };

/**
 Heading every sheet gives an objection correction's objections.

 @param origin - judges the objections come from

 @returns Heading naming the judges and what the objections are

 @example
 ```ts
 objectionsHeading({ origin: 'consolidation gate', },);
 // => 'OBJECTIONS FROM THE CONSOLIDATION GATE, claims to check against the ORIGINAL'
 ```
 */
export function objectionsHeading(
  { origin, }: { readonly origin: ObjectionOrigin; },
): string {
  return `OBJECTIONS FROM THE ${origin.toUpperCase()}, claims to check against the ORIGINAL`;
}

/**
 Inputs candidate selector receives after refinement generation.
 
 @example
 ```ts
 const context = buildRefineSelectionContext({ mode, sourceText, repairedText, });
 ```
 */
export type RefineSelectionContext = {
  /**
   One-sentence candidate task.
   */
  readonly task: string;

  /**
   Ordered candidate ranking rules.
   */
  readonly criteria: readonly string[];

  /**
   Fenced source, baseline and review data.
   */
  readonly evidence: readonly SelectEvidence[];

  /**
   Refusal consequence when accepted fallback is unavailable.
   */
  readonly declineConsequence?: string;
};

/**
 Builds selector question matching refinement mode.
 
 @param mode - comparative exploration or required correction
 
 @param sourceText - original Chinese fidelity anchor
 
 @param repairedText - exact current English wording
 
 @param referenceContext - what the pages the original cites say, with
 their rule, when the original cites any (class forty-one)
 
 @param identityContext - declared names and handles the refiner was told
 survive exactly, so its judges are told so too (ledger B28)
 
 @returns Candidate-ranking context with review findings fenced as evidence
 
 @example
 ```ts
 const context = buildRefineSelectionContext({ mode: { kind: 'comparative' }, sourceText, repairedText, });
 ```
 */
export function buildRefineSelectionContext(
  {
    mode,
    sourceText,
    repairedText,
    referenceContext,
    identityContext,
  }: {
    readonly mode: RefineStageMode;
    readonly sourceText: string;
    readonly repairedText: string;
    readonly referenceContext?: string;
    readonly identityContext?: string;
  },
): RefineSelectionContext {
  /**
   The declared names and then the references, as evidence the judges read
   beside the texts: the names the refiner was told survive exactly (ledger
   B28), and the pages the original cites (class forty-one), each none when
   the page has none.
   */
  const pageEvidence = [
    ...declaredNamesEvidence((identityContext === undefined) ? {} : { identityContext, },),
    ...citedReferenceEvidence(
      (referenceContext === undefined) ? {} : { referenceContext, },
    ),
  ];
  if (mode.kind === 'comparative') {
    return {
      task: 'Each candidate is a revision of the CURRENT English translation below, meant to read more naturally without changing what it says.',
      criteria: [
        `Says exactly what the CURRENT text says: nothing added, dropped, softened, sharpened, or reattributed. ${HOUSE_FORM_CORRECTION_KEEPS_MEANING}`,
        'Faithful to the Chinese ORIGINAL.',
        'Reads more naturally than the CURRENT text by a clear margin, or brings it into line with a house rule of form.',
      ],
      evidence: [
        {
          label: 'ORIGINAL (Chinese)',
          text: sourceText,
        },
        {
          label: 'CURRENT English translation, which ships unchanged unless a candidate clearly beats it',
          text: repairedText,
        },
        ...pageEvidence,
      ],
    };
  }
  if (mode.kind === 'objection-correction') {
    return {
      task: `Each candidate corrects the CURRENT English translation where the ${
        objectingJudgesOf({ groups: mode.groups, },)
      } objected to it.`,
      criteria: [
        'Faithful to the Chinese ORIGINAL: nothing it does not say, and nothing it says left out.',
        'Resolves each objection the ORIGINAL supports. An objection is a claim: one the ORIGINAL does not '
          + 'support is ignored, and a candidate acting on it has introduced an error.',
        'Changes nothing an objection the ORIGINAL supports does not concern, beyond a clear naturalness fix '
          + `that keeps the meaning. ${HOUSE_FORM_CORRECTION_KEEPS_MEANING}`,
        'Reads as natural English.',
      ],
      evidence: [
        {
          label: 'ORIGINAL (Chinese)',
          text: sourceText,
        },
        {
          label: 'CURRENT English translation, which ships unchanged unless a candidate resolves an objection '
            + 'the ORIGINAL supports',
          text: repairedText,
        },
        ...pageEvidence,
        ...mode.groups
          .map(function groupEvidence(group,): SelectEvidence {
            return {
              label: objectionsHeading({ origin: group.origin, },),
              text: group.objections
                .map(function listed(objection,): string {
                  return `- ${objection}`;
                },)
                .join('\n',),
            };
          },),
      ],
      declineConsequence: 'the CURRENT text ships unchanged, with the objections recorded',
    };
  }
  /**
   Structured findings rendered only at selector evidence boundary.
   */
  const selectionFindings = mode.findings
    .map(function renderFinding(finding,): string {
      return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
    },)
    .join('\n',);
  /**
   Failed prior strategies rendered as evidence against repetition.
   */
  const priorCorrections = renderPriorCorrections({ priors: mode.priorCorrections ?? [], },)
    .join('\n\n',);
  return {
    task: 'The CURRENT English translation failed an independent absolute-quality review. Choose a faithful correction that resolves every REQUIRED FINDING. Decline every candidate when each one still contains any material naturalness defect.',
    criteria: [
      'Hard eligibility floor, not a ranking preference: a candidate must preserve exact meaning, resolve every REQUIRED FINDING, and contain no material naturalness defect a careful native editor would change.',
      'Before comparing candidates, assess each candidate in isolation against absolute publication quality. Improvement over CURRENT or another candidate is irrelevant to eligibility.',
      'For each candidate, scan every sentence for grammar, collocation, word order, and reference defects, then reread complete affected paragraphs for flow, register, repetition, and defects introduced outside REQUIRED FINDINGS.',
      `Says exactly what the CURRENT text says: nothing added, dropped, softened, sharpened, or reattributed. ${HOUSE_FORM_CORRECTION_KEEPS_MEANING}`,
      'Faithful to the Chinese ORIGINAL.',
      'Resolves every REQUIRED FINDING across each affected paragraph.',
      'Treats findings as a minimum, not an edit whitelist: reward additional material naturalness fixes that preserve exact meaning.',
      'After checking required findings, reread every affected paragraph sentence by sentence and decline any candidate that is merely the least awkward option.',
      'Reads as publication-quality natural English when considered as a whole.',
    ],
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: sourceText,
      },
      {
        label: 'CURRENT English translation, which cannot ship unchanged',
        text: repairedText,
      },
      ...pageEvidence,
      {
        label: 'REQUIRED FINDINGS from independent absolute-quality review',
        text: selectionFindings,
      },
      ...(priorCorrections === ''
        ? []
        : [{
          label: 'PRIOR CORRECTION STRATEGIES THAT FAILED; choose a materially different approach',
          text: priorCorrections,
        },]),
    ],
    declineConsequence: 'the caller refuses publication because CURRENT already failed absolute review',
  };
}

//endregion Refinement selection context
