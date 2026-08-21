import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { assertSettledRecordAgrees, } from './slice-record-agreement.ts';
import {
  type RefinePhaseResult,
  runRefinePhase,
} from './refine-phase.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';

//region Repair refine step
// The naturalness lane as the DRIVER sees it: one call, plus the two abort
// rules that belong to the driver rather than to the phase.
//
// Its own file because the phase is the one piece of work a fully cached
// document still has to buy, so it is the only place in the driver where "may
// this run still finish?" has an answer other than the slice loop's. Inline,
// those rules read as an aside beside a call.

/**
 * Runs the naturalness lane and applies the driver's abort rules to it.
 *
 * TWO RULES, and they are the same rule from either side. A refinement torn
 * down by the caller's abort fails with the abort's own identity, so a spent
 * deadline and a provider fault are told apart by what is thrown rather than by
 * what it says. A refinement that SETTLED while the caller was giving up fails
 * too, but only when it asked somebody something: every abandoned exchange
 * reaches the stage as silence, and a rewriter that heard nothing keeps the
 * accuracy text, so the document would otherwise read as a finished run and be
 * cached as one.
 *
 * A run whose slices were all resumed and whose lane found nothing to rewrite
 * still finishes under an abort, which is the slice loop's own rule: what a
 * stopped run cannot do is BUY what it is missing.
 *
 * THE SECOND RULE IS COARSER THAN THAT DESCRIPTION, and the difference is a
 * real outcome rather than a caveat. `askedRewriters` says the lane asked
 * somebody something, not that anything was lost, so a refinement that
 * COMPLETED and was then overtaken by an abort fails here as well. Telling
 * those apart needs the phase to report whether an exchange was abandoned,
 * which it cannot today: every stage swallows a failed voice by design. The
 * coarse rule errs toward failing an entry whose work is finished, which costs
 * the entry a retry; the alternative errs toward returning a document that was
 * cut short as though it were whole, which costs a corpus a wrong artifact.
 *
 * @param client - injected model client
 *
 * @param targetText - archive translation, for assembling the text the lane
 * reads references against
 *
 * @param slices - slice pairs in document order
 *
 * @param outcomes - settled accuracy outcomes, one per slice
 *
 * @param models - role roster; an empty refiner roster turns the lane off
 *
 * @param identityContext - declared names and handles, when any
 *
 * @param signal - caller abort, honored by both rules
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns Final outcomes plus the phase's findings
 *
 * @throws Whatever `signal.reason` carries, once the caller aborts while this
 * lane is buying
 *
 * @example
 * ```ts
 * const phase = await refineSettledSlices({ client, targetText, slices, outcomes, models, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function refineSettledSlices(
  {
    client,
    targetText,
    slices,
    outcomes,
    models,
    identityContext,
    declaredNames,
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
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefinePhaseResult> {
  /**
   * What the lane settled on, with a torn-down exchange reported as the abort
   * it was rather than as whichever stage happened to surface.
   */
  const phase = await (async function underSignal(): Promise<RefinePhaseResult> {
    try {
      return await runRefinePhase({
        client,
        targetText,
        slices,
        outcomes,
        models,
        declaredNames,
        ...(identityContext === undefined ? {} : { identityContext, }),
        signal,
        perCallTimeoutMs,
        l,
      },);
    }
    catch (error) {
      if (!signal.aborted)
        throw error;
      l.warn(`refinement abandoned by the caller's abort (${String(error,)})`,);
      throw signal.reason;
    }
  })();
  if (phase.askedRewriters)
    signal.throwIfAborted();

  /**
   * Archive wording of every prepared slice, so a refined outcome is held to
   * the same rule its accuracy predecessor was held to before it was cached.
   */
  const incumbentByIndex = new Map(slices.map(function toEntry(slice,): [
    number,
    string,
  ] {
    return [
      slice.target
        .chunkIndex,
      slice.target
        .text,
    ];
  },),);

  // CHECKED HERE TOO, because refinement REPLACES the outcome that was checked
  // before the cache write. Nothing else looks at these: assembly reads only
  // the changed ones, so a refined outcome denying a change it made drops its
  // own wording in silence, which is the direction no later check can see.
  for (const outcome of phase.outcomes) {
    /**
     * Archive wording of this outcome's slice.
     */
    const incumbentText = incumbentByIndex.get(outcome.chunkIndex,);
    if (incumbentText === undefined) {
      throw new Error(
        `refinement returned slice ${
          String(outcome.chunkIndex,)
        }, which this preparation never produced`,
      );
    }
    assertSettledRecordAgrees({
      lane: 'repair',
      chunkIndex: outcome.chunkIndex,
      changed: outcome.changed,
      decidedText: outcome.repairedText,
      incumbentText,
    },);
  }
  return phase;
}

//endregion Repair refine step
