/**
 * Tests for the selection minimum on a short bench: the absolute minimum
 * stands wherever the reachable bench reaches quorum, and scales by reachable
 * over quorum where it does not (owner, 2026-09-09).
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MIN_SELECTION_BALLOTS,
  MIN_SELECTION_WEIGHT,
  rosterQuorumSize,
  selectionMinimum,
  shortBenchFinding,
} from '../dist/final/node/index.mjs';

/**
 * Seated wide bench the production run carries, as a size.
 */
const SEATED_BENCH = 11;

/**
 * Seats Bedrock alone reaches on that bench.
 */
const BEDROCK_REACHABLE = 3;

await describe({
  name: selectionMinimum.name,
  children: [
    it({
      name: 'KEEPS THE ABSOLUTE MINIMUM on a bench at or above quorum, unreachable seats or not',
      fn: async () => {
        /** Quorum over the seated bench. */
        const quorum = rosterQuorumSize({ rosterSize: SEATED_BENCH, },);
        /** A full bench. */
        const full = selectionMinimum({ benchSize: SEATED_BENCH, unreachable: 0, },);
        expect(full.weight,).toBe(MIN_SELECTION_WEIGHT,);
        expect(full.short,).toBe(false,);
        expect(full.quorum,).toBe(quorum,);
        /** A bench that lost seats down to exactly quorum. */
        const atQuorum = selectionMinimum({ benchSize: SEATED_BENCH, unreachable: SEATED_BENCH - quorum, },);
        expect(atQuorum.weight,).toBe(MIN_SELECTION_WEIGHT,);
        expect(atQuorum.short,).toBe(false,);
        /** The archive-block review's four seats, every one reachable. */
        const four = selectionMinimum({ benchSize: 4, unreachable: 0, },);
        expect(four.weight,).toBe(MIN_SELECTION_WEIGHT,);
      },
    },),

    it({
      name: 'SCALES THE MINIMUM BY REACHABLE OVER QUORUM below quorum, the share of a quorum '
        + 'bench the absolute minimum already is, and names the bench in the finding',
      fn: async () => {
        /** Quorum over the seated bench. */
        const quorum = rosterQuorumSize({ rosterSize: SEATED_BENCH, },);
        /** Bedrock alone. */
        const minimum = selectionMinimum({
          benchSize: SEATED_BENCH,
          unreachable: SEATED_BENCH - BEDROCK_REACHABLE,
        },);
        expect(minimum.short,).toBe(true,);
        expect(minimum.reachable,).toBe(BEDROCK_REACHABLE,);
        expect(minimum.weight,).toBe((MIN_SELECTION_WEIGHT * BEDROCK_REACHABLE) / quorum,);
        expect(minimum.weight,).toBeLessThan(MIN_SELECTION_WEIGHT,);
        // Two ballots stay the floor whatever the weight falls to.
        expect(MIN_SELECTION_BALLOTS,).toBe(2,);
        expect(shortBenchFinding({ minimum, benchSize: SEATED_BENCH, },),).toBe(
          `select-short-bench (reachable ${String(BEDROCK_REACHABLE,)} of ${String(SEATED_BENCH,)}, minimum ${
            minimum.weight
              .toFixed(2,)
          })`,
        );
      },
    },),
  ],
},);
