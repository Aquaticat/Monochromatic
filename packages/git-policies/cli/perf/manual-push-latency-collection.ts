/**
 * Sequential sample collection for repository-scale manual-push latency measurements.
 *
 * @module
 */

import {
  MAXIMUM_WARMUPS,
  type PairCollectionState,
  RUNS,
  type Sample,
} from './manual-push-latency-contracts.ts';
import { runPair } from './manual-push-latency-fixture.ts';
import { warmupsAreStable } from './manual-push-latency-statistics.ts';

/**
 * Create numeric sequence from zero to count minus one.
 *
 * @param count - Number of indices required.
 *
 * @returns Ordered numeric indices.
 *
 * @example
 * ```ts
 * createIndices(2);
 * ```
 */
function createIndices(count: number): readonly number[] {
  return Array.from(
    { length: count },
    function selectIndex(
    _unused: unknown,
    index: number,
  ): number {
    return index;
  }
  );
}

/**
 * Collect paired measurements sequentially through immutable reducer state.
 *
 * @param count - Maximum number of pairs to collect.
 *
 * @param baseOid - Revision restored before each pair.
 *
 * @param stopWhenStable - Whether collection ends after stable warm-up windows.
 *
 * @returns Ordered paired measurements and stability state.
 *
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectPairs({ count: 2, baseOid: '0123456789abcdef', stopWhenStable: false });
 * ```
 */
function collectPairs({
  count,
  baseOid,
  stopWhenStable,
}: Readonly<{
  count: number;
  baseOid: string;
  stopWhenStable: boolean;
}>): Promise<PairCollectionState> {
  return createIndices(count)
    .reduce(
    async function appendSequentialPair(
      previousPromise: Promise<PairCollectionState>,
      index: number,
    ): Promise<PairCollectionState> {
      /**
       * State produced by all earlier sequential pair measurements.
       */
      const previous = await previousPromise;
      if (previous.stable) {
        return previous;
      }
      /**
       * Next pair measured only after earlier state resolves.
       */
      const sample = await runPair({
        wrapperFirst: (index % 2) === 1,
        baseOid
      });
      /**
       * Immutable ordered pair list including new sample.
       */
      const samples = [
        ...previous.samples,
        sample
      ];
      return {
        samples,
        stable: stopWhenStable && warmupsAreStable(samples),
      };
    },
    Promise.resolve<PairCollectionState>({
      samples: [],
      stable: false
    }),
  );
}

/**
 * Collect warm-up pairs until stability or maximum count.
 *
 * @param baseOid - Revision restored before each pair.
 *
 * @returns Warm-up state with ordered samples and stability result.
 *
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectWarmups({ baseOid: '0123456789abcdef' });
 * ```
 */
export function collectWarmups({
  baseOid,
}: Readonly<{ baseOid: string }>): Promise<PairCollectionState> {
  return collectPairs({
    count: MAXIMUM_WARMUPS,
    baseOid,
    stopWhenStable: true
  });
}

/**
 * Collect fixed count of recorded paired measurements.
 *
 * @param baseOid - Revision restored before each pair.
 *
 * @returns Ordered recorded samples.
 *
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectSamples({ baseOid: '0123456789abcdef' });
 * ```
 */
export async function collectSamples({
  baseOid,
}: Readonly<{ baseOid: string }>): Promise<readonly Sample[]> {
  /**
   * Pair state after requested recorded count.
   */
  const state = await collectPairs({
    count: RUNS,
    baseOid,
    stopWhenStable: false
  });
  return state.samples;
}
