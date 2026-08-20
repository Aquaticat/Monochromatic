/**
 * Tests for converting a roster's pairing into alignment steps.
 *
 * THE PROPERTY THAT MATTERS: every block appears exactly once on its own side.
 * The grouper measures characters per step, so a block counted twice inflates a
 * run past its budget and cuts the document somewhere it should not.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { blockPairingToSteps, } from '../dist/final/node/index.mjs';

/**
 * Counts how often each index appears on one side of the steps.
 *
 * @param steps - converted steps
 *
 * @param side - which side to count
 *
 * @returns Appearances per index
 *
 * @example
 * ```ts
 * const seen = appearances({ steps, side: 'source', },);
 * ```
 */
function appearances(
  {
    steps,
    side,
  }: {
    readonly steps: readonly { readonly kind: string; readonly sourceIndex?: number; readonly targetIndex?: number; }[];
    readonly side: 'source' | 'target';
  },
): ReadonlyMap<number, number> {
  /**
   * Appearances so far.
   */
  const seen = new Map<number, number>();
  for (const step of steps) {
    /**
     * Index this step contributes on the side being counted.
     */
    const index = (side === 'source') ? step.sourceIndex : step.targetIndex;
    if (index === undefined)
      continue;
    seen.set(
      index,
      (seen.get(index,) ?? 0) + 1,
    );
  }
  return seen;
}

await describe({
  name: blockPairingToSteps.name,
  children: [
    it({
      name: 'CARRIES one original rendered by two translation blocks',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 0,
              target: 1,
            },
          ],
          sourceCount: 1,
          targetCount: 2,
        },);
        expect(steps.length,).toBe(2,);
        expect(steps[0]?.kind,).toBe('paired',);
        // The SECOND rendering carries its own text and must not re-count the
        // original's characters.
        expect(steps[1]?.kind,).toBe('target-only',);

        /**
         * The continuation step, narrowed so its own field is readable.
         */
        const continuation = steps.find(function isContinuation(step,) {
          return (step.kind === 'target-only') && (step.targetIndex === 1);
        },);
        // IT MUST NOT BE CUT AWAY from the original it renders, or the critics
        // see a passage with no source beside it.
        expect((continuation?.kind === 'target-only') && continuation.continuesPairing,).toBe(true,);
      },
    },),
    it({
      name: 'COUNTS every block exactly once on its own side',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 2,
              target: 2,
            },
            {
              source: 2,
              target: 3,
            },
          ],
          sourceCount: 4,
          targetCount: 5,
        },);
        const sources = appearances({
          steps,
          side: 'source',
        },);
        const targets = appearances({
          steps,
          side: 'target',
        },);
        for (let at = 0; at < 4; at += 1)
          expect(sources.get(at,) ?? 0,).toBe(1,);
        for (let at = 0; at < 5; at += 1)
          expect(targets.get(at,) ?? 0,).toBe(1,);
      },
    },),
    it({
      name: 'NAMES an unpaired original as source-only rather than dropping it',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 1,
              target: 0,
            },
          ],
          sourceCount: 2,
          targetCount: 1,
        },);
        expect(steps.some(function isSourceOnly(step,) {
          return (step.kind === 'source-only') && (step.sourceIndex === 0);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'MARKS an unpaired translation as standing alone, not continuing a pairing',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
          ],
          sourceCount: 1,
          targetCount: 2,
        },);

        /**
         * The genuinely unpaired translation block.
         */
        const lone = steps.find(function isLast(step,) {
          return (step.kind === 'target-only') && (step.targetIndex === 1);
        },);
        expect(lone,).toBeDefined();
        // A block nothing renders stands alone, so the grouper may cut before
        // it. Marking it cohesive would glue unrelated text into one slice.
        expect((lone?.kind === 'target-only') && (lone.continuesPairing === true),).toBe(false,);
      },
    },),
    it({
      name: 'NAMES an unpaired translation as target-only rather than dropping it',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
          ],
          sourceCount: 1,
          targetCount: 3,
        },);
        expect(steps.filter(function isTargetOnly(step,) {
          return step.kind === 'target-only';
        },).length,).toBe(2,);
      },
    },),
    it({
      name: 'KEEPS document order, so a run never gathers text from two places',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 2,
            },
          ],
          sourceCount: 2,
          targetCount: 3,
        },);

        /**
         * Translation indices in the order the steps emit them.
         */
        const order = steps
          .flatMap(function toTarget(step,): readonly number[] {
            return (step.kind === 'source-only') ? [] : [ step.targetIndex, ];
          },);
        expect(order,).toEqual([
          0,
          1,
          2,
        ],);
      },
    },),
    it({
      name: 'RETURNS every block as unpaired when the roster agreed on nothing',
      fn: async () => {
        const steps = blockPairingToSteps({
          pairs: [],
          sourceCount: 2,
          targetCount: 2,
        },);
        expect(steps.length,).toBe(4,);
      },
    },),
  ],
},);
