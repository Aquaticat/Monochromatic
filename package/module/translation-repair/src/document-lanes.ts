import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { assertDeliveryAgreesWithDocument, } from './delivery-invariants.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { PairedReading, } from './image-reading-pair.ts';
import type { IdentifiedDeliveryLedger, } from './lane-comparison.ts';
import type { LaneSliceText, } from './lane-slice-text.ts';
import { preparationIdentity, } from './preparation-identity.ts';
import type {
  ChunkRepairOutcome,
  RepairModels,
} from './repair-contract.ts';
import type { RepairTranslationResult, } from './repair-result.ts';
import { repairPreparedDocument, } from './repair-translation.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
import type { SliceCache, } from './slice-cache.ts';
import {
  buildSliceDelivery,
  type SliceDeliveryRecord,
} from './slice-delivery.ts';
import type {
  TranslateDocumentResult,
  TranslateModels,
  TranslateSliceRecord,
} from './translate-document-contract.ts';
import { translateDocument, } from './translate-document.ts';

//region Document lanes
// Both lanes over ONE preparation, arbitrating nothing.
//
// The two lanes answer different questions about the same document. The repair
// lane keeps the archive's English and mends it where critics find defects; the
// translate lane renders every slice afresh from the Chinese and lets judges
// choose between what it wrote and what the archive already had. Which of those
// two documents should ship is Question 5 in
// `doc/planning/translation-repair-open-decisions.md`, and it is the user's to
// answer.
//
// So this driver returns both and picks neither. It exists to make the two
// comparable: one preparation means one slicing, one alignment and one identity
// block, so a difference between the outputs is a difference between the lanes
// rather than between two runs of the aligner.
//
// It costs both lanes. A caller that wants one lane calls that lane.

/**
 * What running both lanes over one preparation produced.
 *
 * Deliberately has no winner, no preferred lane and no merged text. Adding one
 * would answer Question 5 in code, and it would answer it invisibly: every
 * later count would inherit the choice without anything recording that a choice
 * had been made.
 *
 * @example
 * ```ts
 * const lanes: DocumentLanesResult = await runDocumentLanes({ ... },);
 * ```
 */
export type DocumentLanesResult = {
  /**
   * Alignment findings from the shared preparation, reported once.
   *
   * They belong to the preparation rather than to either lane, and both lanes
   * ran over the same one, so counting them per lane would count one defect in
   * the archive twice. The repair result repeats them inside its own findings,
   * which is that lane's existing contract and is left alone here.
   */
  readonly alignmentFindings: readonly string[];

  /**
   * What the repair lane returned, exactly as it returned it.
   */
  readonly repair: RepairTranslationResult;

  /**
   * What the translate lane returned, exactly as it returned it.
   */
  readonly translate: TranslateDocumentResult;

  /**
   * Every prepared slice as the repair lane delivered it.
   *
   * DERIVED, not decided: one row per slice saying what was translated, what
   * the archive had, what the lane chose and what its document carries. Adding
   * it answers no question about which lane wins, since each ledger describes
   * its own lane's document and neither mentions the other.
   *
   * CARRIES THE SLICING IT WAS BUILT OVER, stamped here rather than by whoever
   * reads it later. This driver is the only place that holds the preparation
   * and the rows at once; a name applied downstream is the applier's claim
   * about the rows, and a consumer that stamps both ledgers itself makes every
   * later identity check agree with itself by construction.
   */
  readonly repairDelivery: IdentifiedDeliveryLedger;

  /**
   * Every prepared slice as the translate lane delivered it.
   */
  readonly translateDelivery: IdentifiedDeliveryLedger;
};

/**
 * Builds one lane's ledger and checks it against that lane's own document.
 *
 * CHECKED HERE rather than trusted, because the ledger joins what the lane
 * DECIDED to what its index sets say the document CARRIES, and those are two
 * derivations. They agree by construction today; a driver holding the document
 * is the first place able to say so rather than assume it.
 *
 * @param slices - preparation both lanes ran over
 *
 * @param incumbentText - archive's own translation, which both lanes wrote into
 *
 * @param documentText - text this lane returned
 *
 * @param wordings - what this lane decided per slice
 *
 * @param shippedChunkIndices - slices this lane's document carries a change for
 *
 * @param withdrawnChunkIndices - slices whose change assembly took back
 *
 * @param blocked - whether this lane refused the whole document before assembly
 *
 * @returns One row per prepared slice, in document order
 *
 * @throws {@link SliceDeliveryError} when the lane's own reports cannot
 * describe one delivery, and {@link DeliveryInvariantError} when the rows do
 * not describe the returned document
 *
 * @example
 * ```ts
 * const ledger = laneDelivery({ slices, incumbentText, documentText, wordings, ... },);
 * ```
 */
function laneDelivery(
  {
    slices,
    incumbentText,
    documentText,
    wordings,
    shippedChunkIndices,
    withdrawnChunkIndices,
    blocked,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly incumbentText: string;
    readonly documentText: string;
    readonly wordings: readonly LaneSliceText[];
    readonly shippedChunkIndices: readonly number[];
    readonly withdrawnChunkIndices: readonly number[];
    readonly blocked: boolean;
  },
): readonly SliceDeliveryRecord[] {
  /**
   * Rows joining this lane's three reports, one per prepared slice.
   */
  const ledger = buildSliceDelivery({
    slices,
    wordings,
    shippedChunkIndices,
    withdrawnChunkIndices,
    blocked,
  },);
  assertDeliveryAgreesWithDocument({
    ledger,
    slices,
    incumbentText,
    documentText,
    shippedChunkIndices,
  },);
  return ledger;
}

/**
 * Runs both lanes over one prepared pair and returns both outputs.
 *
 * Sequential rather than concurrent, and repair first. Concurrency would put
 * two fanned-out stages over the same provider capacity, which buys nothing:
 * the quota spent is identical and both lanes already serialize their own
 * slices for that reason. Repair runs first because its naturalness lane
 * settles AFTER the slice loop and nothing persists what it produced, while the
 * translate lane caches every slice as it finishes. Under a deadline that cuts
 * the entry, running the uncheckpointed phase first is the order that loses
 * less of what was bought.
 *
 * No abort check sits between the lanes on purpose. Both drivers let a fully
 * cached lane finish after an abort, because resuming cached slices buys
 * nothing, and a gate here would refuse that.
 *
 * @param client - injected model client, shared by both lanes
 *
 * @param prepared - one preparation both lanes read
 *
 * @param repairModels - roster for the repair lane
 *
 * @param translateModels - roster for the translate lane
 *
 * @param adjudicationConfig - tally thresholds and weights for the repair lane
 *
 * @param signal - entry abort both lanes honor
 *
 * @param perCallTimeoutMs - deadline per exchange, passed to both lanes rather
 * than left to each lane's default, which differ
 *
 * @param repairSliceCache - repair lane's cache, in its own namespace
 *
 * @param translateSliceCache - translate lane's cache, in its own namespace
 *
 * @param l - logger both lanes tag under, so one entry reads as one run
 *
 * @returns Both lane results and the preparation's alignment findings
 *
 * @throws Whatever either lane throws, the caller's abort reason included; a
 * failure in the first lane means the second never runs
 *
 * @example
 * ```ts
 * const lanes = await runDocumentLanes({
 *   client,
 *   prepared,
 *   repairModels,
 *   translateModels,
 *   signal,
 *   perCallTimeoutMs,
 *   l,
 * },);
 * ```
 */
export async function runDocumentLanes(
  {
    client,
    prepared,
    repairModels,
    translateModels,
    adjudicationConfig,
    pictureReadings,
    signal,
    perCallTimeoutMs,
    repairSliceCache,
    translateSliceCache,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly repairModels: RepairModels;
    readonly translateModels: TranslateModels;
    readonly adjudicationConfig?: AdjudicationConfig;

    /**
     * What each of this document's pictures was read as, gathered before either
     * lane starts.
     *
     * THE TRANSLATE LANE ONLY, today. The repair lane edits the archive in
     * place against critic claims, and none of its stages asks what a picture
     * says; the translate lane writes each slice fresh from the source, which is
     * where a passage transcribing a picture has no source without this.
     */
    readonly pictureReadings?: ReadonlyMap<string, PairedReading>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly repairSliceCache?: SliceCache<ChunkRepairOutcome>;
    readonly translateSliceCache?: SliceCache<TranslateSliceRecord>;
    readonly l: Logger;
  }>,
): Promise<DocumentLanesResult> {
  // BOTH rosters before EITHER lane starts, in ONE check. Each driver checks
  // its own, which is what makes the check unbypassable, but repair runs first
  // and would otherwise spend an entire document before an unconfigured
  // translate roster was discovered. Neither of these is the enforcement; both
  // are the courtesy.
  //
  // ONE call rather than two, because two stop at the repair lane: an operator
  // with a role empty in EACH lane would pay a preflight per lane to learn
  // that, which is the cost this check exists to spare them.
  //
  // The role names carry their lane, and that is required rather than tidy.
  // Both lanes have a `judgeModelIds`, one object cannot hold that key twice,
  // and an unprefixed map would quietly report on one lane's judges only.
  assertRostersConfigured({
    lane: 'repair and translate',
    roles: {
      'repair.criticModelIds': repairModels.criticModelIds,
      'repair.panelModelIds': repairModels.panelModelIds,
      'repair.editorModelIds': repairModels.editorModelIds,
      'repair.judgeModelIds': repairModels.judgeModelIds,
      'repair.checkerModelIds': repairModels.checkerModelIds,
      'translate.translatorModelIds': translateModels.translatorModelIds,
      'translate.judgeModelIds': translateModels.judgeModelIds,
    },
  },);

  /**
   * Logger tagged with this driver, which both lanes then tag under.
   */
  const dl = tagged({
    tag: runDocumentLanes.name,
    l,
  },);
  dl.info(
    `both lanes over ${String(prepared.slices
      .length,)} slices, repair first`,
  );

  /**
   * Repair lane's answer: the archive's English, mended where critics found
   * defects.
   */
  const repair = await repairPreparedDocument({
    client,
    prepared,
    models: repairModels,
    ...((adjudicationConfig === undefined)
      ? {}
      : { adjudicationConfig, }),
    signal,
    perCallTimeoutMs,
    ...((repairSliceCache === undefined)
      ? {}
      : { sliceCache: repairSliceCache, }),
    parentLogger: dl,
  },);

  /**
   * Translate lane's answer: every slice rendered afresh, with the archive's
   * own English standing as one candidate.
   */
  const translate = await translateDocument({
    client,
    prepared,
    models: translateModels,
    ...((pictureReadings === undefined)
      ? {}
      : { pictureReadings, }),
    signal,
    perCallTimeoutMs,
    ...((translateSliceCache === undefined)
      ? {}
      : { sliceCache: translateSliceCache, }),
    l: dl,
  },);
  dl.info(
    `repair ${repair.status}, translate changed ${
      String(translate.changedSliceCount,)
    }/${String(prepared.slices
      .length,)} slices; neither was chosen over the other`,
  );

  /**
   * Name the slicing both lanes ran over gives itself, computed once and
   * stamped onto both ledgers.
   *
   * ONE COMPUTATION FOR TWO LEDGERS is exactly right here and would be wrong
   * anywhere else: both were built from `prepared` in this function, so one
   * name is a fact rather than an assumption. A later consumer holding two
   * ledgers cannot say that, which is why the name travels with them.
   */
  const slicing = preparationIdentity({ prepared, },);

  return {
    alignmentFindings: prepared.alignmentFindings,
    repair,
    translate,
    repairDelivery: {
      preparationIdentity: slicing,
      records: laneDelivery({
        slices: prepared.slices,
        incumbentText: prepared.targetText,
        documentText: repair.repairedText,
        wordings: repair.sliceTexts,
        shippedChunkIndices: repair.shippedChunkIndices,
        withdrawnChunkIndices: repair.withdrawnChunkIndices,
        // The dominance refusal, which returns the archive untouched however
        // many slices had decided a repair by the time it fired. Without this
        // the rows for those slices would read as a contradiction rather than
        // as what they are: decisions the document was refused before it could
        // carry.
        blocked: repair.status === 'blocked-non-translation',
      },),
    },
    translateDelivery: {
      preparationIdentity: slicing,
      records: laneDelivery({
        slices: prepared.slices,
        incumbentText: prepared.targetText,
        documentText: translate.translatedText,
        wordings: translate.sliceTexts,
        shippedChunkIndices: translate.shippedChunkIndices,
        withdrawnChunkIndices: translate.withdrawnChunkIndices,
        // The translate lane has no whole-document refusal: it assembles what
        // its slices decided, and the only thing that takes a decision back is
        // the assembly guard, which the withdrawn set already names.
        blocked: false,
      },),
    },
  };
}

//endregion Document lanes
