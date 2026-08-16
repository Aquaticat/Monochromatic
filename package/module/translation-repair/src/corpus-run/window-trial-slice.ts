import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from '../chunk-document.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import { neighbouringSource, } from '../fidelity-window.ts';
import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import { judgeTranslateSlate, } from '../translate-judge.ts';
import { produceTranslateSlate, } from '../translate-produce.ts';
import {
  appendTrialRow,
  type WindowTrialRow,
} from './window-trial-ledger.ts';
import { TRIAL_ARMS, } from './window-trial-report.ts';

//region Window trial slice
// One slice's three arms, over ONE slate.
//
// PRODUCING ONCE IS THE WHOLE POINT. `runTranslateStage` writes candidates and
// judges them in one call, so asking the same slice twice used to resample the
// candidates: the two answers then differed in the slate as well as in the
// evidence, and no reading could say which moved the verdict. `#109` split the
// stage so this can buy the slate once and put it to the judges three times.
//
// THE THIRD ARM IS NOT A LUXURY. Judges are stochastic, so a narrow-to-wide
// difference means nothing until it beats the difference between two narrow runs
// of the same slate. That second narrow arm is the only thing that supplies it.

/**
 * Arms in the order they are bought.
 *
 * NARROW, NARROW, WIDE rather than narrow, wide, narrow. The two narrow arms sit
 * together so the band is measured across the smallest stretch of provider
 * weather, which is the thing most likely to move a rate for reasons the trial
 * is not about.
 */
const ARM_ORDER = [
  TRIAL_ARMS.narrowFirst,
  TRIAL_ARMS.narrowSecond,
  TRIAL_ARMS.wide,
] as const;

/**
 * Runs the arms one slice still owes, appending each as it completes.
 *
 * SKIPS THE WHOLE SLICE when the ledger already holds all three arms, without
 * producing a slate. Producing is the expensive half, and a resumed run that
 * bought a slate only to throw it away would pay most of the cost of the work it
 * is skipping.
 *
 * @param client - injected model client
 *
 * @param slices - every prepared slice of this entry, for the window
 *
 * @param chunkIndex - position of the slice under trial
 *
 * @param sliceClass - class the screen flagged, or the control label
 *
 * @param entryId - entry the slice belongs to
 *
 * @param protocol - digest this run buys under
 *
 * @param ledgerPath - where completed arms are appended
 *
 * @param done - arms already bought, as keys
 *
 * @param models - translator and judge rosters
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - run logger
 *
 * @returns Rows this call appended, empty when the slice was already complete
 *
 * @throws Whatever the stage throws; a slice that cannot be judged is a defect
 * rather than a datum, and recording it as a keep would report a failed arm as
 * the judges preserving the archive
 *
 * @example
 * ```ts
 * const rows = await runSliceArms({ client, slices, chunkIndex, ... },);
 * ```
 */
export async function runSliceArms(
  {
    client,
    slices,
    chunkIndex,
    sliceClass,
    entryId,
    protocol,
    ledgerPath,
    done,
    models,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly slices: readonly ChunkPair[];
    readonly chunkIndex: number;
    readonly sliceClass: string;
    readonly entryId: string;
    readonly protocol: string;
    readonly ledgerPath: string;
    readonly done: ReadonlySet<string>;
    readonly models: {
      readonly translatorModelIds: readonly SyntheticModelId[];
      readonly judgeModelIds: readonly SyntheticModelId[];
    };
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<readonly WindowTrialRow[]> {
  /**
   * Arms this slice still owes, in buying order.
   */
  const owed = ARM_ORDER.filter(function notBought(arm,): boolean {
    return !done.has([
      protocol,
      entryId,
      String(chunkIndex,),
      arm,
    ].join(' ',),);
  },);
  if (owed.length === 0)
    return [];

  // A PARTLY BOUGHT SLICE IS SPOILED, NOT RESUMABLE. The slate cannot be
  // reproduced, so finishing the remaining arms here would judge different
  // candidates from the arms already on disk, and the ledger would then hold a
  // triple that looks complete while its arms disagree about the slate as well
  // as the evidence. That is precisely the confound `#109` was split to remove,
  // arriving through resumption instead of through the stage. Left as it is,
  // the slice stays incomplete, and the report already excludes it and says so.
  if (owed.length !== ARM_ORDER.length) {
    l.warn(
      `${entryId}/${String(chunkIndex,)}: ${
        String(ARM_ORDER.length - owed.length,)
      } of ${String(ARM_ORDER.length,)} arms survive from an interrupted run; `
        + `skipping rather than finishing them over a slate the earlier arms `
        + `never saw`,
    );
    return [];
  }

  /**
   * Slice under trial.
   */
  const slice = slices[chunkIndex];
  if (slice === undefined)
    throw new RangeError(
      `${entryId} has no slice ${String(chunkIndex,)}; the draw and the `
        + `preparation disagree, which means they were made from different text`,
    );

  /**
   * Neighbouring original, which only the wide arm is shown.
   *
   * Computed BEFORE any call, so a slice whose window turns out empty is
   * refused here rather than after two thirds of its quota is spent.
   */
  const neighbouringSourceText = neighbouringSource({
    slices,
    sliceIndex: chunkIndex,
  },);
  if (neighbouringSourceText === '')
    throw new RangeError(
      `${entryId}/${String(chunkIndex,)} has no neighbouring section, so its `
        + `wide arm would be its narrow arm and the pair would report a false null`,
    );

  /**
   * Slate every arm judges, bought once.
   */
  const produced = await produceTranslateSlate({
    client,
    translatorModelIds: models.translatorModelIds,
    sourceText: slice.source
      .text,
    incumbentText: slice.target
      .text,
    lineStructured: false,
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Rows this call appended.
   */
  const appended: WindowTrialRow[] = [];
  for (const arm of owed) {
    /**
     * What the judges made of the same slate under this arm's evidence.
     */
    /* oxlint-disable-next-line no-await-in-loop -- arms are bought one at a time on purpose, so a kill loses one arm rather than three */
    const decided = await judgeTranslateSlate({
      client,
      produced,
      judgeModelIds: models.judgeModelIds,
      sourceText: slice.source
        .text,
      incumbentText: slice.target
        .text,
      incumbentKind: isInsertionChunk(slice.target,) ? 'absent' : 'present',
      ...((arm === TRIAL_ARMS.wide) ? { neighbouringSourceText, } : {}),
      signal,
      perCallTimeoutMs,
      l,
    },);

    /**
     * Row recording it.
     */
    const row: WindowTrialRow = {
      protocol,
      entryId,
      chunkIndex,
      arm,
      sliceClass,
      shipped: decided.origin !== 'incumbent',
      decision: decided.decision,
      winnerText: decided.text,
      judgesHeard: decided.tally
        .ballots,
      judgesSeated: decided.tally
        .judgesAvailable,
    };

    // APPENDED BEFORE THE NEXT ARM STARTS, which is what makes a kill cost one
    // arm rather than the slice.
    /* oxlint-disable-next-line no-await-in-loop -- durability is the reason this is sequential */
    await appendTrialRow({
      path: ledgerPath,
      row,
    },);
    appended.push(row,);
  }
  return appended;
}

//endregion Window trial slice
