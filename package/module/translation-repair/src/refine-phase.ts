import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { runIntroducedDefectProbe, } from './introduced-defect-probe.ts';
import { parseDocument, } from './parse-document.ts';
import {
  collectDefinitions,
  deriveRefinableEnvelopes,
} from './refine-envelope.ts';
import { runRefineStage, } from './refine-stage.ts';
import {
  assertCheckerIndependence,
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
import { runCheckerStage, } from './repair-edit-stages.ts';
import { spliceSlices, } from './splice-slices.ts';

//region Refinement phase
// The naturalness lane as a SECOND per-slice phase, run after every accuracy
// outcome has settled and after non-translation dominance has been decided.
//
// It is not inside `repairChunk`, and that placement is load-bearing rather
// than tidy. `repairChunk` returns early when the votes stand, when no claim
// validates, when no envelope is cut, and when no operation survives the gate.
// Text carrying no accuracy defect takes the second of those returns, and text
// that is awkward rather than wrong is precisely what this lane exists for, so
// a lane at the bottom of that function would have missed its own target.

/**
 * Outcomes after refinement, with the phase's own telemetry.
 *
 * @example
 * ```ts
 * const { outcomes, findings, } = await runRefinePhase({ ... },);
 * ```
 */
export type RefinePhaseResult = {
  /**
   * Final per-slice outcomes, refined where a refinement won and survived.
   */
  readonly outcomes: readonly ChunkRepairOutcome[];

  /**
   * Phase telemetry in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the naturalness lane over every settled slice.
 *
 * @param client - injected model client
 *
 * @param targetText - original translation, for assembling `T1`
 *
 * @param slices - slice pairs in document order
 *
 * @param outcomes - settled accuracy outcomes, one per slice
 *
 * @param models - role roster; an absent refiner roster turns the lane off
 *
 * @param identityContext - declared names and handles, when any
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Final outcomes plus findings
 *
 * @example
 * ```ts
 * const phase = await runRefinePhase({ ... },);
 * ```
 */
export async function runRefinePhase(
  {
    client,
    targetText,
    slices,
    outcomes,
    models,
    identityContext,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly models: RepairModels;
    readonly identityContext?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefinePhaseResult> {
  /**
   * Rewriters, empty when the lane is configured off.
   */
  const refinerModelIds = models.refinerModelIds ?? [];
  if (refinerModelIds.length === 0)
    return {
      outcomes,
      findings: [],
    };
  assertCheckerIndependence({
    editorModelIds: models.editorModelIds,
    refinerModelIds,
    checkerModelIds: models.checkerModelIds,
  },);

  /**
   * Definitions of the assembled `T1`, so a paragraph's references resolve
   * during gating even when the definition lives in another slice.
   */
  const definitions = collectDefinitions({
    document: parseDocument({
      text: spliceSlices({
        targetText,
        slices,
        outcomes,
      },),
    },),
  },);

  /**
   * Final outcomes and phase findings, filled slice by slice.
   */
  const collected: {
    readonly outcomes: ChunkRepairOutcome[];
    readonly findings: string[];
  } = {
    outcomes: [],
    findings: [],
  };
  for (const outcome of outcomes) {
    /**
     * Source text of this slice, the faithfulness anchor.
     */
    const sourceText = slices[outcome.chunkIndex]
      ?.source
      .text
      ?? '';

    // A slice the critics ruled non-translation shipped deliberately
    // untouched; rewriting it for fluency would undo that decision.
    if (outcome.nonTranslationStanding) {
      collected.outcomes
        .push(outcome,);
      continue;
    }

    /**
     * Eligible paragraphs of this slice's repaired text.
     */
    const slice = deriveRefinableEnvelopes({
      document: parseDocument({ text: outcome.repairedText, },),
    },);

    /* oxlint-disable no-await-in-loop -- slices run sequentially by the same rule as the accuracy pass: aggregate concurrency beyond one stream per model collapses throughput on this plan */
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
      signal,
      perCallTimeoutMs,
      l,
    },);
    collected.findings
      .push(
        ...slice.findings,
        ...refined.findings,
      );
    if (!refined.changed) {
      collected.outcomes
        .push(outcome,);
      continue;
    }

    /**
     * Whether every issue the checkers had confirmed is still confirmed in
     * the refined text.
     */
    const retained = await retainsResolvedIssues({
      client,
      models,
      outcome,
      sourceText,
      refinedText: refined.refinedText,
      signal,
      perCallTimeoutMs,
      l,
    },);
    collected.findings
      .push(...retained.findings,);
    if (!retained.retained) {
      collected.outcomes
        .push(outcome,);
      continue;
    }
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
     * `assertCheckerIndependence` above has already established that no
     * refiner is among them, so nobody audits their own rewrite.
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
      // Withheld for the same reason the accuracy stage withholds, and with
      // more force here: this lane rewrites text whose accepted issues were
      // ALREADY repaired, so listing them describes defects that are no longer
      // present and excuses damage to wording that was correct.
      disclosure: 'withheld',
      signal,
      perCallTimeoutMs,
      l,
    },);

    // Same omission as the accuracy path: the refinement probe fans out to a
    // roster and loses voices like every other stage, and nothing carried what
    // it lost. Pushed here rather than beside the refine-stage findings above
    // because the probe has not run at that point.
    collected.findings
      .push(...refinementDefects.findings,);

    collected.outcomes
      .push({
        ...outcome,
        repairedText: refined.refinedText,
        changed: true,
        // Marks every recorded repair in this slice as pre-refinement text, so
        // a grading sheet can say so instead of presenting an editor
        // replacement as the words that shipped.
        refined: true,
        refinementDefects,
      },);
    /* oxlint-enable no-await-in-loop */
  }
  return {
    outcomes: collected.outcomes,
    findings: collected.findings,
  };
}

/**
 * Whether a refinement kept every issue the checkers had already confirmed.
 *
 * Rolls back the WHOLE slice when it did not. Checkers report per ISSUE while
 * refinement happens per paragraph, and an issue can span paragraphs, so which
 * paragraph broke a given issue is not derivable from what the checker
 * returns. The regressed issue is named in the findings so a later session can
 * judge whether finer attribution is worth building.
 *
 * @param client - injected model client
 *
 * @param models - role roster
 *
 * @param outcome - settled accuracy outcome for this slice
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
 * @returns Whether the refinement may ship, plus findings
 *
 * @example
 * ```ts
 * const retained = await retainsResolvedIssues({ ... },);
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

//endregion Refinement phase
