import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import {
  type ArtifactContestSlice,
  contestEligibleIndexes,
  describeContestSlice,
} from './corpus-run/artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './corpus-run/artifact-two-lane-derive.ts';
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
import type { RosterModelId, } from './synthetic-catalog.ts';
import {
  reuseTwinOrBuy,
  type TwinMemo,
  type TwinStored,
} from './twin-memo.ts';

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
//
// IDENTICAL QUESTIONS SHARE ONE CACHE-ELIGIBLE PURCHASE. Contest keys omit
// slice position because position changes nothing the roster sees, and contest
// outcomes carry no slice index that needs restamping. The promise memo keeps
// overlapped twins from buying contradictory ballots or racing to overwrite one
// cache file. An unheard outcome is neither persisted nor memoized, so its twin
// asks again exactly as a warm run would.

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
 * Fresh contest outcome beside whether it became warm-run evidence.
 *
 * @example
 * ```ts
 * const bought: BoughtLaneContest = { outcome, persisted: true, };
 * ```
 */
type BoughtLaneContest = {
  readonly outcome: LaneContestOutcome;
  readonly persisted: boolean;
};

/**
 * Reads cache-eligible record from fresh contest purchase.
 *
 * @param bought - fresh result beside persistence status
 *
 * @returns Record a twin may reuse, or deliberate nothing
 *
 * @example
 * ```ts
 * const stored = storedContestOf({ outcome, persisted: true, },);
 * ```
 */
function storedContestOf(
  bought: BoughtLaneContest,
): TwinStored<LaneContestOutcome> {
  return bought.persisted
    ? {
      kind: 'stored',
      record: bought.outcome,
    }
    : { kind: 'nothing', };
}

/**
 * Persists a bought contest only when caller remains live and quorum made its
 * ballots reusable.
 *
 * Kept as a testable boundary because gather rounds normally surface an abort
 * before returning, making the final pre-write defense unreachable in a
 * transport fixture.
 *
 * @param key - exact contest question this outcome answers
 *
 * @param outcome - bought ballots and their settled choice
 *
 * @param cache - contest persistence boundary
 *
 * @param signal - caller abort checked before write
 *
 * @returns Whether outcome was persisted and may be reused by a twin
 *
 * @throws Whatever caller abort reason or persistence throws
 *
 * @example
 * ```ts
 * await persistLaneContestOutcome({ key, outcome, cache, signal, },);
 * ```
 *
 * @internal
 */
export async function persistLaneContestOutcome(
  {
    key,
    outcome,
    cache,
    signal,
  }: ForeignBorrowed<{
    readonly key: string;
    readonly outcome: LaneContestOutcome;
    readonly cache: SliceCache<LaneContestOutcome>;
    readonly signal: AbortSignal;
  }>,
): Promise<boolean> {
  signal.throwIfAborted();
  if (!worthResuming({ outcome, }))
    return false;
  await cache.persist({
    key,
    serialized: JSON.stringify(outcome,),
  },);
  return true;
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
 * @param overlap - most contested slices in flight; one reproduces former loop
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
    overlap = 1,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly projected: ProjectedLanes;
    readonly modelIds: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly cache: SliceCache<LaneContestOutcome>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly overlap?: number;
    readonly l: Logger;
  },
): Promise<readonly ArtifactContestSlice[]> {
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
        row.sliceIndex,
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
   * Comparison rows whose lane wordings differ, in document order.
   */
  const eligibleRows = projected.comparison
    .filter(function isEligible(row,): boolean {
      return eligible.has(row.sliceIndex,);
    },);

  /**
   * Slices the two lanes covered at all, which the eligible count is read
   * against.
   */
  const compared = projected.comparison
    .length;
  dl.info(`lane contest: ${String(eligible.size,)}/${String(compared,)} slices differ`,);

  /**
   * Cache-eligible purchases in this document, shared by every contested row.
   */
  const twins: TwinMemo<LaneContestOutcome> = new Map();

  return await mapOverlapped({
    items: eligibleRows,
    overlap,
    oneItem: async function contestOne({ item: row, }): Promise<ArtifactContestSlice> {
      /**
       * Original of this slice, which every ledger row carries.
       */
      const sourceText = sourceTexts.get(row.sliceIndex,);
      if (sourceText === undefined) {
        throw new Error(
          `lane contest: slice ${String(row.sliceIndex,)} is compared and does not appear in the repair ledger`,
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

      /**
       * What the roster settled here, bought, resumed, or reused from a twin.
       */
      const outcome = await (async function resumeOrBuy(): Promise<LaneContestOutcome> {
        if (resumed !== undefined)
          return resumed;
        /**
         * Twin's persisted ballots or this row's fresh purchase.
         */
        const asked = await reuseTwinOrBuy({
          key,
          memo: twins,
          buy: async function buyThisRow(): Promise<BoughtLaneContest> {
            /**
             * Ballots bought for this question.
             */
            const bought = await contestLaneSlice({
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
            // Gather rounds degrade torn-down calls to silence. A quorum that
            // arrived before the abort must not make the abandoned entry look
            // done or become warm-run evidence.
            /**
             * Whether this purchase became reusable evidence.
             */
            const persisted = await persistLaneContestOutcome({
              key,
              outcome: bought,
              cache,
              signal,
            },);
            return {
              outcome: bought,
              persisted,
            };
          },
          persistedOf: storedContestOf,
          l: dl,
        },);
        if (asked.kind === 'reused')
          return asked.twin;
        return asked.bought
          .outcome;
      })();
      return describeContestSlice({
        sliceIndex: row.sliceIndex,
        outcome,
      },);
    },
  },);
}

//endregion Lane contest driver
