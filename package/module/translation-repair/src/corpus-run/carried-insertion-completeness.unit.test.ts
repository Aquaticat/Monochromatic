/**
 * Tests final boundary for passages proven rendered elsewhere before lanes.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertCarriedInsertionsRemain,
  type ChunkPair,
  TranslationRepairInterruptedError,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 * Archive wording carrying proof region.
 */
const TARGET = 'The cat sleeps in warm sunlight.\n';

/**
 * One content slice spanning whole target.
 */
const SLICES: readonly ChunkPair[] = [{
  source: {
    sliceIndex: 0,
    nodes: [],
    startOffset: 0,
    endOffset: 2,
    text: '猫。',
  },
  target: {
    sliceIndex: 0,
    nodes: [],
    startOffset: 0,
    endOffset: TARGET.length,
    text: TARGET,
  },
},];

/**
 * Builds final-stage source selecting one replacement.
 *
 * @param text - wording final contest selects
 *
 * @returns Narrow artifact source read by publication assembler
 *
 * @example
 * ```ts
 * const artifact = artifactShipping({ text: TARGET, });
 * ```
 */
function artifactShipping({ text, }: { readonly text: string; },): WouldShipSource {
  return {
    comparison: [{
      sliceIndex: 0,
      incumbentKind: 'present',
      incumbentText: TARGET,
      repairText: TARGET,
      translateText: text,
      laneRelation: 'both-differ',
      repairOutcome: { kind: 'decided', acceptedText: TARGET, },
      translateOutcome: { kind: 'decided', acceptedText: text, },
      decisionComparison: { kind: 'comparable', verdict: 'different', },
      repairDelivery: { kind: 'incumbent-retained', },
      translateDelivery: { kind: 'replacement-shipped', },
    },],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [{
        sliceIndex: 0,
        verdict: { kind: 'lane-won', lane: 'translate', },
        ballots: [],
        usable: 3,
      },],
    },
  } as unknown as WouldShipSource;
}

/**
 * Carried-complete proof shared by cases.
 */
const CARRIED = [{
  position: 1,
  sliceIndex: 1,
  sourceText: '猫在阳光下睡觉。',
  evidence: ['cat sleeps in warm sunlight',],
},];

await describe({
  name: assertCarriedInsertionsRemain.name,
  children: [
    it({
      name: 'ACCEPTS final page retaining exact carried region',
      fn: async () => {
        expect(() => assertCarriedInsertionsRemain({
          artifact: artifactShipping({ text: TARGET, }),
          slices: SLICES,
          targetText: TARGET,
          carried: CARRIED,
        },),).not.toThrow();
      },
    },),
    it({
      name: 'PAUSES when final stage removes carried region instead of publishing omission',
      fn: async () => {
        expect(() => assertCarriedInsertionsRemain({
          artifact: artifactShipping({ text: 'The cat waits by the window.\n', }),
          slices: SLICES,
          targetText: TARGET,
          carried: CARRIED,
        },),).toThrow(TranslationRepairInterruptedError,);
      },
    },),
  ],
},);
