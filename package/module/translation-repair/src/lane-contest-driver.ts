import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type ArtifactContestSliceV2,
  contestEligibleIndexes,
  describeContestSlice,
} from './corpus-run/artifact-v2-contest.ts';
import type { ProjectedLanesV2, } from './corpus-run/artifact-v2-derive.ts';
import {
  contestLaneSlice,
  LANE_CONTEST_QUORUM,
  type LaneContestOutcome,
} from './lane-contest-stage.ts';
import {
  laneContestRunShape,
  laneContestSliceKey,
} from './lane-contest-key.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Lane contest driver
// The contest over one document: which slices are worth asking about, and what
// the roster said at each.
//
// ASKS NOTHING WHERE THE TWO LANES AGREE. A contest between two identical
// candidates has no question to put and no answer worth buying, and the slices
// where they agree are the majority of most documents.
//
// AN EMPTY CONTEST IS STILL A CONTEST. A document whose lanes never differed
// returns no slices, and the caller records that as a contest that ran and
// found nothing rather than as a question nobody asked. Those are different
// facts and the artifact keeps them apart.

/**
 * Whether a bought outcome is worth keeping across runs.
 *
 * SETTLED VERDICTS ONLY. An unheard roster is a transient fact about a provider
 * on one night, not a property of the question, and writing it to the cache
 * would freeze that night into every later resume of the entry. The ballots
 * that did arrive are discarded with it, which is the point: half a panel is
 * not an answer, and re-asking is what the quorum is for.
 *
 * @param outcome - what the roster settled
 *
 * @returns Whether to persist it
 *
 * @example
 * ```ts
 * const keep = worthResuming({ outcome, },);
 * ```
 */
function worthResuming(
  { outcome, }: { readonly outcome: LaneContestOutcome; },
): boolean {
  return outcome.usable >= LANE_CONTEST_QUORUM;
}

/**
 * Asks the roster which lane should ship, at every slice the two lanes worded
 * differently.
 *
 * @param client - synthetic chat client
 *
 * @param projected - both ledgers as version 2 rows, beside their comparison
 *
 * @param modelIds - roster to ask
 *
 * @param identityContext - names and handles both documents declare
 *
 * @param cache - per-entry store of ballots already bought
 *
 * @param signal - abort shared with the rest of the entry
 *
 * @param perCallTimeoutMs - per-call ceiling
 *
 * @param l - logger to tag
 *
 * @returns One record per contested slice, in comparison-row order
 *
 * @example
 * ```ts
 * const slices = await contestDocumentLanes({ client, projected, modelIds, cache, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function contestDocumentLanes(
  {
    client,
    projected,
    modelIds,
    identityContext,
    cache,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly projected: ProjectedLanesV2;
    readonly modelIds: readonly SyntheticModelId[];
    readonly identityContext?: string;
    readonly cache: SliceCache<LaneContestOutcome>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<readonly ArtifactContestSliceV2[]> {
  /**
   * Logger naming this driver.
   */
  const dl = tagged({
    l,
    tag: contestDocumentLanes.name,
  },);

  /**
   * Original of each slice, which the comparison does not carry and the ledger
   * does.
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
   * Slices worth asking about.
   */
  const eligible = new Set(contestEligibleIndexes({ comparison: projected.comparison, },),);

  /**
   * What this run asks, folded into every key.
   */
  const runShape = laneContestRunShape({
    modelIds,
    ...((identityContext === undefined) ? {} : { identityContext, }),
  },);

  /**
   * One record per contested slice, in comparison-row order.
   */
  const slices: ArtifactContestSliceV2[] = [];

  /**
   * Slices the two lanes covered at all, which the eligible count is read
   * against.
   */
  const compared = projected.comparison
    .length;
  dl.info(`lane contest: ${String(eligible.size,)}/${String(compared,)} slices differ`,);
  for (const row of projected.comparison) {
    if (!eligible.has(row.chunkIndex,))
      continue;

    /**
     * Original of this slice, which every ledger row carries.
     */
    const sourceText = sourceTexts.get(row.chunkIndex,);
    if (sourceText === undefined) {
      throw new Error(
        `lane contest: slice ${String(row.chunkIndex,)} is compared and does not appear in the repair ledger`,
      );
    }

    /**
     * Key these ballots resume under.
     */
    const key = laneContestSliceKey({
      runShape,
      sourceText,
      incumbentText: row.incumbentText,
      incumbentKind: row.incumbentKind,
      repairText: row.repairText,
      translateText: row.translateText,
    },);

    /**
     * Ballots an earlier run already bought for this slice, if any.
     */
    const resumed = cache
      .resumed
      .get(key,);

    /* oxlint-disable no-await-in-loop -- sequential by design, matching `translateDocument` and `readDocumentPictures`: the client`s limiter grants one stream per model, so contesting two slices at once queues behind the same slot rather than doubling throughput, and settling one slice before starting the next is what makes an aborted run resumable to the slice it reached */

    /**
     * What the roster settled here, bought or resumed.
     */
    const outcome = resumed ?? await contestLaneSlice({
      client,
      modelIds,
      subject: {
        sourceText,
        incumbentText: row.incumbentText,
        repairText: row.repairText,
        translateText: row.translateText,
        ...((identityContext === undefined) ? {} : { identityContext, }),
      },
      signal,
      exchangeTimeoutMs: perCallTimeoutMs,
      l: dl,
    },);
    if ((resumed === undefined) && worthResuming({ outcome, },)) {
      await cache.persist({
        key,
        serialized: JSON.stringify(outcome,),
      },);
    }
    /* oxlint-enable no-await-in-loop */
    slices.push(describeContestSlice({
      chunkIndex: row.chunkIndex,
      outcome,
    },),);
  }
  return slices;
}

//endregion Lane contest driver
