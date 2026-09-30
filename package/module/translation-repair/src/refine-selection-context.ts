import type { SelectEvidence, } from './candidate-select-wire.ts';
import { citedReferenceEvidence, } from './cited-reference-rule.ts';
import { declaredNamesEvidence, } from './declared-names-evidence.ts';
import { HOUSE_FORM_CORRECTION_KEEPS_MEANING, } from './house-form-corrections.ts';

//region Refinement selection context
// Keeps exploratory refinement and objection correction from asking selectors
// contradictory questions about what they are choosing for.
//
// OBJECTION CORRECTION (owner, 2026-09-27, the fourteenth and fifteenth
// addenda of `doc/decision/translation-repair-ineligible-standing.md`). Over a
// standing the deterministic rule refused, the consolidation ships whatever
// the gate or the slate judges held against it, so their objections become
// corrections to make where the ORIGINAL supports them. The text still ships
// unchanged when no candidate earns its place: an objection is a claim, and
// the base remains the fallback.
//
// NO REQUIRED NATURALNESS CORRECTION (ledger B47): a third mode corrected text
// the absolute naturalness review had rejected, with no fallback. Its loop
// went on 2026-09-01; the mode, its sheets and its "no correction" outcome
// stayed, built by tests alone, until B47 took them out.

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
   What declining every candidate leads to, where the sheet names it.
   */
  readonly declineConsequence?: string;
};

/**
 Builds selector question matching refinement mode.
 
 @param mode - comparative exploration or objection correction
 
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

//endregion Refinement selection context
