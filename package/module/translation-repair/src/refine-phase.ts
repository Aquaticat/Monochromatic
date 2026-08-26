import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  everyStageHeard,
  silentStagesOf,
} from './stage-silence.ts';
import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { parseDocument, } from './parse-document.ts';
import {
  neighbouringIncumbent,
  neighbouringSource,
} from './fidelity-window.ts';
import { collectDefinitions, } from './refine-envelope.ts';
import {
  refineRunShape,
  refineSliceKey,
} from './refine-slice-key.ts';
import {
  type RefinedSliceSettlement,
  settleRefinedSlice,
} from './refine-slice-settle.ts';
import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
import { repairReplacements, } from './repair-replacements.ts';
import type { SliceCache, } from './slice-cache.ts';
import { spliceSlices, } from './splice-slices.ts';
import { UnpreparedSliceError, } from './unprepared-slice.ts';

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
//
// IT CACHES ITS OWN SLICES, in its own namespace, for the reason
// `refine-slice-key.ts` records: the accuracy pass persists before this lane
// runs, so a resumed run used to replay accuracy from disk and then buy the
// whole lane again. That published different text at 7 of 18 repair-lane slices
// across two runs over identical inputs.

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

  /**
   * Whether any rewriter was asked anything.
   *
   * The driver reads this to apply the rule the slice loop already follows: a
   * run whose work was all resumed finishes under a caller's abort, and a run
   * that had to ask somebody does not. False when the lane is off, false when
   * every slice turned out to have nothing eligible to rewrite, and false when
   * every slice came off disk.
   *
   * A RESUMED SLICE NEVER SETS IT, which is what makes the rule mean what it
   * says now that this phase caches. Before the cache, refinement was the one
   * phase a fully cached document still had to buy, so this was true on every
   * run that reached a rewritable slice.
   */
  readonly askedRewriters: boolean;
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
 * @param declaredNames - same declarations as strings a guard compares, kept
 * apart from the prose the models read
 *
 * @param refineCache - optional cross-run cache in this phase's own namespace;
 * a hit skips every model call for that slice
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
 * const phase = await runRefinePhase({ client, targetText, slices, outcomes, models, declaredNames, signal, perCallTimeoutMs, l, },);
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
    declaredNames,
    refineCache,
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
    readonly declaredNames: readonly string[];
    readonly refineCache?: SliceCache<RefinedSliceSettlement>;
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
      askedRewriters: false,
    };
  assertCheckerIndependence({
    editorModelIds: models.editorModelIds,
    refinerModelIds,
    checkerModelIds: models.checkerModelIds,
    selfCertificationPermitted: models.checkerSelfCertificationPermitted ?? false,
  },);
  assertCheckerQuorumReachable({ checkerModelIds: models.checkerModelIds, },);

  /**
   * Definitions of the assembled `T1`, so a paragraph's references resolve
   * during gating even when the definition lives in another slice.
   *
   * IN THE CACHE KEY as well as in the prompt, because it is derived from what
   * EVERY slice settled: a neighbour settling differently changes what this
   * slice's rewriter is shown, and a key blind to that resumes a stale rewrite.
   */
  const definitions = collectDefinitions({
    document: parseDocument({
      text: spliceSlices({
        targetText,
        slices,
        replacements: repairReplacements({ outcomes, },),
      },),
    },),
  },);

  /**
   * What this run asks, which no resumed slice may have been asked differently.
   */
  const runShape = refineRunShape({
    refinerModelIds,
    judgeModelIds: models.judgeModelIds,
    checkerModelIds: models.checkerModelIds,
    ...(identityContext === undefined ? {} : { identityContext, }),
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

  /**
   * Whether any slice reached a rewriter, which decides whether an aborted run
   * may still call itself finished.
   */
  const asked = { any: false, };
  for (const outcome of outcomes) {
    /**
     * Prepared slice this outcome belongs to, which carries both the anchor
     * this lane rewrites against and the archive wording it must not claim to
     * have changed when it lands back on it.
     */
    const prepared = slices[outcome.sliceIndex];

    // REFUSED BEFORE ANY CALL. The tolerance this replaced read an empty
    // original and the outcome's own text as the archive wording, bought
    // rewriter calls against them, and was refused by `repair-refine-step.ts`
    // afterwards anyway; the refusal comes first now and costs nothing.
    if (prepared === undefined)
      throw new UnpreparedSliceError({ sliceIndex: outcome.sliceIndex, },);

    /**
     * Source text of this slice, the faithfulness anchor.
     */
    const sourceText = prepared.source
      .text;

    /**
     * Archive wording of this slice.
     *
     * A refinement is measured against the ACCURACY text it rewrites, so
     * `refined.changed` says only that the rewriter moved off that text. It can
     * move back onto the archive's own words, which is a slice nothing happened
     * in: recording it as changed would name it in the shipped set beside text
     * nobody touched, and assembly refuses a replacement carrying the archive
     * wording, so the whole document would fail for a run the models got right.
     */
    const incumbentText = prepared.target
      .text;

    /**
     * Original and archive English of the passages either side, for the damage
     * probe inside {@link settleRefinedSlice}.
     *
     * GUARDED ON `prepared` RATHER THAN ON THE INDEX. {@link neighbouringSource}
     * throws on a position this entry does not have, and this loop already
     * tolerates an outcome with no prepared slice behind it: `sourceText` and
     * `incumbentText` above both fall back rather than fail. A window that
     * threw where those fall back would turn a tolerated shape into a crash.
     * A present `prepared` means the lookup found an element, so the index is
     * an integer inside the array and neither call can throw.
     *
     * ADDRESSED BY THE STAMPED INDEX, like everything else in this loop. That
     * agrees with the position because `document-preparation.ts` stamps
     * `baseIndex: slices.length`, a running counter over emitted slices, so a
     * prepared slice's stamp IS its position. `#99` records that this does not
     * hold of every `sliceIndex` in the codebase, which is why it is said here
     * rather than assumed; were it ever to break, this window would be wrong in
     * exactly the way `sourceText` and `incumbentText` were already wrong, and
     * disagreeing with them would be worse than sharing their fate.
     */
    const windowFragment = (prepared === undefined)
      ? {}
      : {
        neighbouringSourceText: neighbouringSource({
          slices,
          slicePosition: outcome.sliceIndex,
        },),
        neighbouringIncumbentText: neighbouringIncumbent({
          slices,
          slicePosition: outcome.sliceIndex,
        },),
      };

    /**
     * Key this slice's refinement answers.
     *
     * HANDED THE RESOLVED `incumbentText` RATHER THAN RE-DERIVING IT. The
     * fallback to `outcome.repairedText` fires wherever no prepared slice
     * sits at this index, so a key re-reading `prepared?.target.text` would
     * cover an absent incumbent while the settlement below compared against
     * the repaired text. The two would then answer different questions on
     * exactly the path that has no archive wording to check.
     */
    const key = refineSliceKey({
      runShape,
      sourceText,
      repairedText: outcome.repairedText,
      incumbentText,
      definitions,
      declaredNames,
      issues: outcome.issues,
      resolvedIssueIds: outcome.resolvedIssueIds,
      nonTranslationStanding: outcome.nonTranslationStanding,
      ...windowFragment,
    },);

    /**
     * What an earlier run settled for this exact question, when one did.
     */
    const stored = refineCache?.resumed
      .get(key,);
    if (stored !== undefined) {
      collected.outcomes
        .push(stored.outcome,);
      collected.findings
        .push(...stored.findings,);
      continue;
    }

    /* oxlint-disable no-await-in-loop -- slices run sequentially by the same rule as the accuracy pass: aggregate concurrency beyond one stream per model collapses throughput on this plan */
    /**
     * What refinement decided for this slice, bought now.
     */
    const settled = await settleRefinedSlice({
      client,
      outcome,
      sourceText,
      incumbentText,
      definitions,
      models,
      refinerModelIds,
      ...(identityContext === undefined ? {} : { identityContext, }),
      declaredNames,
      ...windowFragment,
      signal,
      perCallTimeoutMs,
      l,
    },);
    if (settled.asked)
      asked.any = true;
    collected.outcomes
      .push(settled.outcome,);
    collected.findings
      .push(...settled.findings,);

    // NOTHING IS PERSISTED AFTER AN ABORT, the check the accuracy pass makes
    // before its own write. Today every aborted call propagates as a throw and
    // never reaches this line; the line is what keeps that true should a later
    // path turn an abort into a settled outcome.
    signal.throwIfAborted();

    // Persisted before the next slice starts, matching the accuracy pass, so an
    // abort leaves settled refinements recoverable rather than rebought. NOT
    // when a stage heard fewer than quorum: that settlement is an outage, not a
    // decision, and cached it would resume on every later run (`#238`).
    if (everyStageHeard({ findings: settled.findings, },)) {
      await refineCache?.persist({
        key,
        serialized: JSON.stringify({
          outcome: settled.outcome,
          findings: settled.findings,
        } satisfies RefinedSliceSettlement,),
      },);
    }
    else {
      /**
       * Which stages fell short, for the warn line.
       */
      const silent = silentStagesOf({ findings: settled.findings, },)
        .join('; ',);
      l.warn(
        `slice ${String(outcome.sliceIndex,)}: a stage heard fewer than quorum, so the refinement is NOT cached: ${
          silent
        }`,
      );
    }
    /* oxlint-enable no-await-in-loop */
  }
  return {
    outcomes: collected.outcomes,
    findings: collected.findings,
    askedRewriters: asked.any,
  };
}

//endregion Refinement phase
