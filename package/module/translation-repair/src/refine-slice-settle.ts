import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { runIntroducedDefectProbe, } from './introduced-defect-probe.ts';
import { parseDocument, } from './parse-document.ts';
import { deriveRefinableEnvelopes, } from './refine-envelope.ts';
import { runRefineStage, } from './refine-stage.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import { collectRefinedAuthors, } from './issue-authors.ts';
import { runCheckerStage, } from './repair-edit-stages.ts';

//region Refine slice settle
// What the naturalness lane does to ONE slice, separated from the loop that
// walks them.
//
// Its own file so the cache in `refine-phase.ts` has a single call to wrap.
// Inline, the resume check would have to sit above four separate exits and the
// persist below each of them, which is how a cache ends up storing three of the
// four answers a stage can give.

/**
 * What one slice's refinement settled, as the cache stores it.
 *
 * `asked` IS DELIBERATELY NOT IN HERE, and that absence is the point. It says
 * whether this RUN reached a rewriter, which decides whether a run overtaken by
 * an abort may still call itself finished. A slice resumed from disk asked
 * nobody anything, so a stored `asked` would be a previous run's answer to a
 * question only the current run can be asked.
 *
 * @example
 * ```ts
 * const settled: RefinedSliceSettlement = { outcome, findings: [], };
 * ```
 */
export type RefinedSliceSettlement = {
  /**
   * Final outcome for this slice, refined where a rewrite won and survived.
   */
  readonly outcome: ChunkRepairOutcome;

  /**
   * Findings this slice contributed, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Same settlement plus whether this run reached a rewriter.
 *
 * @example
 * ```ts
 * const bought: RefinedSliceOutcome = { outcome, findings: [], asked: true, };
 * ```
 */
export type RefinedSliceOutcome = RefinedSliceSettlement & {
  /**
   * Whether this slice had anything eligible to rewrite, which is what makes a
   * run one that BOUGHT rather than one that only resumed.
   */
  readonly asked: boolean;
};

/**
 * Runs the naturalness lane over one settled slice.
 *
 * @param client - injected model client
 *
 * @param outcome - settled accuracy outcome for this slice
 *
 * @param sourceText - slice original, which is the faithfulness anchor
 *
 * @param incumbentText - archive wording, which a rewrite may land back on
 *
 * @param definitions - definitions of the assembled document, so references
 * resolve during gating even when their definition lives in another slice
 *
 * @param models - role roster
 *
 * @param refinerModelIds - rewriters, already known non-empty
 *
 * @param identityContext - declared names and handles, when any
 *
 * @param declaredNames - same declarations as strings a guard compares
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Final outcome, findings, and whether a rewriter was reached
 *
 * @param neighbouringSourceText - original of the passages either side, handed
 * to the damage probe so a phrase that moved next door is not read as one this
 * rewrite deleted
 *
 * @param neighbouringIncumbentText - archive English of those same two, which is
 * the side a relocation shows
 *
 * @example
 * ```ts
 * const settled = await settleRefinedSlice({ client, outcome, sourceText, incumbentText, definitions, models, refinerModelIds, declaredNames, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function settleRefinedSlice(
  {
    client,
    outcome,
    sourceText,
    incumbentText,
    definitions,
    models,
    refinerModelIds,
    identityContext,
    declaredNames,
    neighbouringSourceText,
    neighbouringIncumbentText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly outcome: ChunkRepairOutcome;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly definitions: string;
    readonly models: RepairModels;
    readonly refinerModelIds: RepairModels['checkerModelIds'];
    readonly identityContext?: string;
    readonly declaredNames: readonly string[];
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefinedSliceOutcome> {
  // A slice the critics ruled non-translation shipped deliberately untouched;
  // rewriting it for fluency would undo that decision.
  if (outcome.nonTranslationStanding)
    return {
      outcome,
      findings: [],
      asked: false,
    };

  /**
   * Eligible paragraphs of this slice's repaired text.
   */
  const slice = deriveRefinableEnvelopes({
    document: parseDocument({ text: outcome.repairedText, },),
  },);

  /**
   * Whether this slice had anything to rewrite at all.
   */
  const asked = slice.envelopes
    .length
    > 0;

  /**
   * What refinement decided for this slice.
   */
  const refined = await runRefineStage({
    client,
    refinerModelIds,
    judgeModelIds: models.judgeModelIds,
    sourceText,
    repairedText: outcome.repairedText,
    envelopes: slice.envelopes,
    definitions,
    ...(identityContext === undefined ? {} : { identityContext, }),
    declaredNames,
    chunkIndex: outcome.chunkIndex,
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * This slice with the refinement round appended to what the editor stage
   * already recorded.
   *
   * BUILT BEFORE THE EXITS BELOW, because a refinement that lost is exactly the
   * round worth reading: it says the panel looked at the repaired text and
   * either could not agree or preferred a rewrite the guards then refused.
   * Returning the bare outcome on those paths would keep the ballots only when
   * they agreed with the result.
   */
  const withRefineRounds: ChunkRepairOutcome = {
    ...outcome,
    rounds: [
      ...outcome.rounds,
      ...refined.rounds,
    ],
  };
  if (!refined.changed)
    return {
      outcome: withRefineRounds,
      findings: [
        ...slice.findings,
        ...refined.findings,
      ],
      asked,
    };

  /**
   * Whether every issue the checkers had confirmed is still confirmed in the
   * refined text.
   */
  const retained = await retainsResolvedIssues({
    client,
    models,
    // BOTH STAGES' ROUNDS, not the bare `outcome`. The recheck reads text the
    // editors repaired and the refiners then rewrote, so a checker that had a
    // hand in either is judging its own work and must be discounted for it.
    outcome: withRefineRounds,
    sourceText,
    refinedText: refined.refinedText,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (!retained.retained)
    return {
      outcome: withRefineRounds,
      findings: [
        ...slice.findings,
        ...refined.findings,
        ...retained.findings,
      ],
      asked,
    };

  /**
   * Shadow-mode audit of damage the REWRITE caused.
   *
   * The accuracy probe already ran, but it compared the original translation
   * with the repaired one and finished before this lane started, so it says
   * nothing about the text this rewrite produced. Auditing one whole slice
   * rather than each rewritten paragraph matches the unit the lane itself
   * decides in: `retainsResolvedIssues` rolls back the whole slice too.
   *
   * The roster is the checkers, exactly as the accuracy probe uses, and
   * `assertCheckerIndependence` in the phase above has already established that
   * no refiner is among them, so nobody audits their own rewrite.
   */
  const refinementDefects = await runIntroducedDefectProbe({
    client,
    proberModelIds: models.checkerModelIds,
    sourceText,
    baselineText: outcome.repairedText,
    regions: [
      {
        envelopeId: `refinement/${String(outcome.chunkIndex,)}`,
        issueIds: outcome.issues
          .map(function toId(issue,) {
            return issue.issueId;
          },),
        before: outcome.repairedText,
        editorAfter: refined.refinedText,
      },
    ],
    issues: outcome.issues,
    editKind: 'naturalness-refinement',
    // THE SAME WINDOW THE ACCURACY LANE'S PROBE GETS, which is what makes the
    // two lanes' damage telemetry comparable at all. Without it this auditor
    // reasons about a slice in isolation while its counterpart reasons about
    // one in context, so a difference between their findings could be the
    // lanes differing or could be the windows differing, and no reading of the
    // numbers can separate those.
    //
    // It matters more here than for the accuracy probe, not less. This lane
    // rewrites for FLUENCY, and the commonest fluent rewrite of a paragraph
    // that repeats what the paragraph next door already said is to drop the
    // repetition. Judged alone that is a deletion; judged with the neighbour
    // visible it is the redundancy it was.
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
    // Withheld for the same reason the accuracy stage withholds, and with more
    // force here: this lane rewrites text whose accepted issues were ALREADY
    // repaired, so listing them describes defects that are no longer present
    // and excuses damage to wording that was correct.
    disclosure: 'withheld',
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Whether the text this slice now returns differs from the archive's, which
   * is a different question from whether the rewriter changed anything.
   */
  const changed = refined.refinedText !== incumbentText;
  return {
    outcome: {
      ...withRefineRounds,
      repairedText: refined.refinedText,
      changed,
      // Dropped when the refinement landed back on the archive wording, by the
      // same rule the accuracy stage applies: a resolution credited to text the
      // document does not carry is a repair no reader saw.
      resolvedIssueIds: changed ? outcome.resolvedIssueIds : [],
      // Marks every recorded repair in this slice as pre-refinement text, so a
      // grading sheet can say so instead of presenting an editor replacement as
      // the words that shipped.
      refined: true,
      refinementDefects,
    },
    findings: [
      ...slice.findings,
      ...refined.findings,
      ...retained.findings,
      ...refinementDefects.findings,
    ],
    asked,
  };
}

/**
 * Whether a refinement kept every issue the checkers had already confirmed.
 *
 * Rolls back the WHOLE slice when it did not. Checkers report per ISSUE while
 * refinement happens per paragraph, and an issue can span paragraphs, so which
 * paragraph broke a given issue is not derivable from what the checker returns.
 * The regressed issue is named in the findings so a later session can judge
 * whether finer attribution is worth building.
 *
 * @param client - injected model client
 *
 * @param models - role roster
 *
 * @param outcome - settled accuracy outcome for this slice, carrying the rounds
 * of BOTH stages so authorship of the refined text is readable
 *
 * @param sourceText - original chunk text
 *
 * @param refinedText - candidate text the refinement produced
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Whether refinement may ship, plus findings
 *
 * @example
 * ```ts
 * const retained = await retainsResolvedIssues({ client, models, outcome, sourceText, refinedText, signal, perCallTimeoutMs, l, },);
 * ```
 */
async function retainsResolvedIssues(
  {
    client,
    models,
    outcome,
    sourceText,
    refinedText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly models: RepairModels;
    readonly outcome: ChunkRepairOutcome;
    readonly sourceText: string;
    readonly refinedText: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<{
  readonly retained: boolean;
  readonly findings: readonly string[];
}> {
  /**
   * Issues the checkers had confirmed fixed in `T1`.
   */
  const confirmed = outcome.issues
    .filter(function wasResolved(issue,) {
      return outcome.resolvedIssueIds
        .includes(issue.issueId,);
    },);

  // Nothing was proved about this slice, so a refinement cannot un-prove it.
  // This is the common case: the lane's whole target is text with no accepted
  // issue, and spending a checker round there would buy nothing.
  if (confirmed.length === 0)
    return {
      retained: true,
      findings: [],
    };

  /**
   * Checker verdicts over the refined text.
   */
  const checker = await runCheckerStage({
    client,
    checkerModelIds: models.checkerModelIds,
    sourceText,
    patchedText: refinedText,
    issues: confirmed,
    authorship: collectRefinedAuthors({
      rounds: outcome.rounds,
      repairRegions: outcome.repairRegions,
    },),
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Issues the refinement broke, named so the rollback is explainable.
   */
  const regressed = confirmed
    .filter(function brokeIt(issue,) {
      return checker.tallies[issue.issueId]
        ?.resolved
        !== true;
    },)
    .map(function toId(issue,) {
      return issue.issueId;
    },);
  if (regressed.length === 0)
    return {
      retained: true,
      findings: [`refine-recheck-passed (${String(confirmed.length,)} issues)`,],
    };
  return {
    retained: false,
    findings: [`refine-rolled-back (${regressed.join(', ',)})`,],
  };
}

//endregion Refine slice settle
