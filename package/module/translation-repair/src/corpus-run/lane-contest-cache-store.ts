import type { LaneContestOutcome, } from '../lane-contest-stage.ts';
import type { LaneContestBallot, } from '../lane-contest-wire.ts';
import type { SliceCache, } from '../slice-cache.ts';
import { isJsonRecord, } from '../json-guard.ts';
import {
  LANE_CONTEST_NAMESPACE,
  openNamespacedCache,
} from './slice-cache-namespace.ts';

//region Lane contest cache store
// Resuming ballots an earlier run already bought for a contested slice.
//
// SEPARATE FROM THE LANE STORE because a contest is not a slice of either lane:
// it is bought after both have settled one, keyed by what the two of them
// produced. It shares the entry directory and therefore retires with the entry,
// which is what `discardSliceCache` already guarantees.
//
// THE SHAPE IS CHECKED DOWN TO THE BALLOT, rather than to the outcome. The
// artifact reader refuses a ballot it cannot read, so a store that accepted one
// would let a corrupted cache file settle an entry into an artifact that no
// reader will take. Refusing it here costs one re-asked slice.

/**
 * Whether a value is a candidate name a judge may use.
 *
 * @param value - name from a cache file
 *
 * @returns Whether it names a lane or the refusal
 *
 * @example
 * ```ts
 * const named = isLaneChoiceName(parsed.choice,);
 * ```
 */
function isLaneChoiceName(value: unknown,): boolean {
  return (value === 'repair')
    || (value === 'translate')
    || (value === 'neither');
}

/**
 * Whether a value is one judge`s ballot as this schema writes it.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a readable ballot
 *
 * @example
 * ```ts
 * const readable = isLaneContestBallot(parsed,);
 * ```
 */
function isLaneContestBallot(value: unknown,): value is LaneContestBallot {
  return isJsonRecord(value,)
    && isLaneChoiceName(value.choice,)
    && Array.isArray(value.unsupported,)
    && Array.isArray(value.unsupportedRaw,)
    && Array.isArray(value.dropped,)
    && Array.isArray(value.droppedRaw,)
    && ((typeof value.reason) === 'string');
}

/**
 * Whether a value is a settled contest as this schema writes it.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is this schema`s contest outcome
 *
 * @example
 * ```ts
 * if (isLaneContestOutcome(parsed,)) resumed.set(key, parsed,);
 * ```
 */
function isLaneContestOutcome(value: unknown,): value is LaneContestOutcome {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Ballots the file carries, before any of them is known to be one.
   */
  const { ballots, } = value;
  return isLaneChoiceName(value.choice,)
    && Array.isArray(ballots,)
    && ballots.every(isLaneContestBallot,)
    && ((typeof value.usable) === 'number')
    && (value.usable === ballots.length)
    && Array.isArray(value.findings,);
}

/**
 * Opens the per-entry store of ballots already bought.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - pipeline this run belongs to
 *
 * @returns Cache of settled contests, keyed by slice hash
 *
 * @example
 * ```ts
 * const cache = await openLaneContestCache({ dir: entryCacheDir, generation: pipelineDigest, },);
 * ```
 */
export async function openLaneContestCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<LaneContestOutcome>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: LANE_CONTEST_NAMESPACE,
    isValue: isLaneContestOutcome,
  },);
}

//endregion Lane contest cache store
