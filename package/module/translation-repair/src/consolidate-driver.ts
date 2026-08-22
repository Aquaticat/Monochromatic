import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  consolidateRunShape,
  consolidateSliceKey,
} from './consolidate-key.ts';
import { produceConsolidations, } from './consolidate-produce.ts';
import {
  type ConsolidationSettlement,
  settleConsolidation,
} from './consolidate-settle.ts';
import { standingTextFor, } from './consolidate-standing.ts';
import {
  type ArtifactConsolidateSliceV2,
  describeConsolidateSlice,
} from './corpus-run/artifact-v2-consolidate.ts';
import type { ProjectedLanesV2, } from './corpus-run/artifact-v2-derive.ts';
import type { LaneContestOutcome, } from './lane-contest-stage.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Consolidate driver
// THE CONSOLIDATION OVER ONE DOCUMENT: which slices get a third rendering
// asked for, and what the roster settled at each.
//
// RUNS ONLY WHERE THE CONTEST RAN. A slice the two lanes worded identically has
// nothing to consolidate: the lanes agree, so a third rendering would be
// competing against their agreement rather than resolving a difference. The
// contest's own eligibility already selected those slices, so this drives off
// its records rather than re-deriving them.
//
// WHY A THIRD RENDERING AT ALL is argued in `consolidate-wire.ts` and measured
// in `doc/planning/the-third-rendering.md`: the lanes fail in opposite
// directions, and at least one slice was found where each lane was better than
// the other in a DIFFERENT PLACE of the same passage. No selection can produce
// that slice's best text, because that text is neither candidate.

/**
 * Whether a settlement is worth keeping across runs.
 *
 * SETTLED VERDICTS ONLY, matching the contest's rule for the same reason: a
 * thin panel is a transient fact about a provider on one night, not a property
 * of the question, and freezing it into the cache would answer every later
 * resume of this entry with that night.
 *
 * A settlement that never reached the gate IS still worth keeping when it was
 * the floor or an absent standing text that stopped it. Those are properties of
 * the slate and the contest, not of who answered.
 *
 * @param settlement - what the stage settled
 *
 * @returns Whether to persist it
 *
 * @example
 * ```ts
 * const keep = worthResuming({ settlement, },);
 * ```
 */
function worthResuming(
  { settlement, }: { readonly settlement: ConsolidationSettlement; },
): boolean {
  /**
   * What the gate settled, absent where the slice never reached it.
   */
  const { gate, } = settlement;
  if (gate === undefined)
    return (settlement.terminal === 'incumbent-only')
      || (settlement.terminal === 'no-standing-text')
      || (settlement.terminal === 'slate-kept-standing');
  return gate.usable > 0;
}

/**
 * Asks the roster for a third rendering at every slice the contest settled.
 *
 * @param client - synthetic chat client
 *
 * @param projected - both ledgers as version 2 rows, beside their comparison
 *
 * @param contests - what the lane contest settled, keyed by slice
 *
 * @param modelIds - roster to ask
 *
 * @param identityContext - names and handles both documents declare
 *
 * @param cache - per-entry store of settlements already bought
 *
 * @param signal - abort shared with the rest of the entry
 *
 * @param perCallTimeoutMs - per-call ceiling
 *
 * @param l - logger to tag
 *
 * @returns One record per consolidated slice, in comparison-row order
 *
 * @throws Error - when a contested slice has no row in the repair ledger, which
 * means the comparison and the ledger disagree about which slices exist
 *
 * @example
 * ```ts
 * const slices = await consolidateDocument({ client, projected, contests, modelIds, cache, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function consolidateDocument(
  {
    client,
    projected,
    contests,
    modelIds,
    identityContext,
    cache,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly projected: ProjectedLanesV2;
    readonly contests: ReadonlyMap<number, LaneContestOutcome>;
    readonly modelIds: readonly SyntheticModelId[];
    readonly identityContext?: string;
    readonly cache: SliceCache<ConsolidationSettlement>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<readonly ArtifactConsolidateSliceV2[]> {
  /**
   * Logger naming this driver.
   */
  const dl = tagged({
    l,
    tag: consolidateDocument.name,
  },);

  /**
   * Original of each slice, which only the repair ledger carries.
   */
  const sourceTexts = new Map(projected.delivery
    .repair
    .map(function nameSource(row,): readonly [
      number,
      string,
    ] {
      return [
        row.chunkIndex,
        row.sourceText,
      ];
    },),);

  /**
   * What this run asks, folded into every key.
   */
  const runShape = consolidateRunShape({
    modelIds,
    ...((identityContext === undefined) ? {} : { identityContext, }),
  },);

  /**
   * One record per consolidated slice, in comparison-row order.
   */
  const slices: ArtifactConsolidateSliceV2[] = [];

  dl.info(`consolidation: ${String(contests.size,)} contested slices to settle`,);
  for (const row of projected.comparison) {
    /**
     * What the contest settled here, absent where it never ran.
     */
    const contest = contests.get(row.chunkIndex,);
    if (contest === undefined)
      continue;

    /**
     * Original of this slice, which every ledger row carries.
     */
    const sourceText = sourceTexts.get(row.chunkIndex,);
    if (sourceText === undefined) {
      throw new Error(
        `consolidation: slice ${String(row.chunkIndex,)} was contested and does not appear in the repair ledger`,
      );
    }

    /**
     * Wording that would ship without this stage.
     */
    const standingText = standingTextFor({
      choice: contest.choice,
      repairText: row.repairText,
      translateText: row.translateText,
    },);

    /**
     * Slice as both halves take it.
     */
    const subject = {
      sourceText,
      incumbentText: row.incumbentText,
      repairText: row.repairText,
      translateText: row.translateText,
      ballots: contest.ballots,
      ...((identityContext === undefined) ? {} : { identityContext, }),
    };

    /**
     * Key this settlement resumes under.
     */
    const key = consolidateSliceKey({
      runShape,
      sourceText,
      incumbentText: row.incumbentText,
      repairText: row.repairText,
      translateText: row.translateText,
      standingText,
      ballots: contest.ballots,
    },);

    /**
     * A settlement an earlier run already bought for this slice, if any.
     */
    const resumed = cache
      .resumed
      .get(key,);

    /* oxlint-disable no-await-in-loop -- sequential by design, matching `contestDocumentLanes` and `translateDocument`: the client`s limiter grants one stream per model, so consolidating two slices at once queues behind the same slot rather than doubling throughput, and settling one slice before starting the next is what makes an aborted run resumable to the slice it reached */

    /**
     * What the roster settled here, bought or resumed.
     */
    const settlement = resumed ?? await (async function settleFresh(): Promise<ConsolidationSettlement> {
      /**
       * Slate this run buys, produced once and judged once, per `#109`.
       */
      const produced = await produceConsolidations({
        client,
        roster: modelIds,
        subject,
        standingText,
        signal,
        perCallTimeoutMs,
        l: dl,
      },);

      return settleConsolidation({
        client,
        roster: modelIds,
        subject,
        voices: produced.voices,
        validity: produced.validity,
        producedFindings: produced.findings,
        standingText,
        signal,
        perCallTimeoutMs,
        l: dl,
      },);
    })();
    if ((resumed === undefined) && worthResuming({ settlement, },)) {
      await cache.persist({
        key,
        serialized: JSON.stringify(settlement,),
      },);
    }
    /* oxlint-enable no-await-in-loop */
    slices.push(describeConsolidateSlice({
      chunkIndex: row.chunkIndex,
      settlement,
    },),);
  }
  return slices;
}

//endregion Consolidate driver
