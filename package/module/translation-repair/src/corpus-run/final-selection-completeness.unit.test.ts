/**
 * Tests for refusing final archive fallback without semantic endorsement.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactContestVerdict,
  assertFinalSelectionSettled,
  UnsettledFinalSelectionError,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 * Archive wording in fixture.
 */
const ARCHIVE = 'The cat naps.';

/**
 * Repair wording in fixture.
 */
const REPAIR = 'The cat is napping.';

/**
 * Translate wording in fixture.
 */
const TRANSLATE = 'A cat naps.';

/**
 * Builds final-selection source with chosen contest verdict and optional consolidation.
 *
 * @param verdict - contest result at fixture slice
 *
 * @param consolidated - whether third rendering settled fresh wording
 *
 * @param polished - whether polish attempts to rewrite unchanged baseline
 *
 * @returns Source accepted by would-ship reader
 *
 * @example
 * ```ts
 * const source = sourceWith({ verdict: { kind: 'lane-won', lane: 'repair', }, });
 * ```
 */
function sourceWith(
  {
    verdict,
    consolidated = false,
    polished = false,
  }: {
    readonly verdict: ArtifactContestVerdict;
    readonly consolidated?: boolean;
    readonly polished?: boolean;
  },
): WouldShipSource {
  return {
    comparison: [{
      sliceIndex: 0,
      incumbentKind: 'present',
      incumbentText: ARCHIVE,
      repairText: REPAIR,
      translateText: TRANSLATE,
      laneRelation: 'both-differ',
      repairOutcome: { kind: 'decided', acceptedText: REPAIR, },
      translateOutcome: { kind: 'decided', acceptedText: TRANSLATE, },
      decisionComparison: { kind: 'comparable', verdict: 'different', },
      repairDelivery: { kind: 'replacement-shipped', },
      translateDelivery: { kind: 'replacement-shipped', },
    },],
    laneSelection: {
      kind: 'contested',
      slices: [{
        sliceIndex: 0,
        verdict,
        ballots: [],
        usable: 10,
      },],
    },
    consolidation: consolidated
      ? {
        kind: 'settled',
        slices: [{
          sliceIndex: 0,
          terminal: 'consolidated',
          shipped: { kind: 'consolidated', text: 'The cat sleeps.', },
          rewrapped: false,
          demoted: false,
          verdicts: [],
        },],
      }
      : polished
      ? {
        kind: 'settled',
        slices: [{
          sliceIndex: 0,
          terminal: 'gate-kept-standing',
          shipped: { kind: 'unchanged', },
          rewrapped: false,
          demoted: false,
          verdicts: [],
          polish: {
            kind: 'settled',
            baseText: ARCHIVE,
            proposedText: 'The cat rested.',
            text: 'The cat rested.',
            changed: true,
            refinersHeard: ['hf:zai-org/GLM-5.2',],
            contributors: ['hf:zai-org/GLM-5.2',],
            roundCount: 1,
            findings: [],
          },
        },],
      }
      : { kind: 'not-run', },
  } as unknown as WouldShipSource;
}

await describe({
  name: assertFinalSelectionSettled.name,
  children: [
    it({
      name: 'ACCEPTS lane winner because archive does not become fallback',
      fn: async () => {
        expect(assertFinalSelectionSettled({
          entryId: 'Cat',
          artifact: sourceWith({ verdict: { kind: 'lane-won', lane: 'repair', }, }),
        },),).toBeUndefined();
      },
    },),
    it({
      name: 'ACCEPTS archive fallback explicitly endorsed by contest',
      fn: async () => {
        expect(assertFinalSelectionSettled({
          entryId: 'Cat',
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'endorsed', },
          }),
        },),).toBeUndefined();
      },
    },),
    it({
      name: 'REFUSES archive contest explicitly declined',
      fn: async () => {
        let thrown: unknown;
        try {
          assertFinalSelectionSettled({
            entryId: 'Cat',
            artifact: sourceWith({
              verdict: { kind: 'settled-neither', archive: 'declined', },
            }),
          },);
        }
        catch (error) {
          thrown = error;
        }

        expect(thrown,).toBeInstanceOf(UnsettledFinalSelectionError,);
        expect((thrown as UnsettledFinalSelectionError).sliceIndices,).toEqual([0,]);
      },
    },),
    it({
      name: 'REFUSES archive fallback after contest misses quorum',
      fn: async () => {
        expect(function refuseThinContest(): void {
          assertFinalSelectionSettled({
            entryId: 'Cat',
            artifact: sourceWith({ verdict: { kind: 'quorum-not-met', }, }),
          },);
        },).toThrow(UnsettledFinalSelectionError,);
      },
    },),
    it({
      name: 'REFUSES POLISH BYPASS over unendorsed archive baseline',
      fn: async () => {
        expect(function refusePolishedFallback(): void {
          assertFinalSelectionSettled({
            entryId: 'Cat',
            artifact: sourceWith({
              verdict: { kind: 'settled-neither', archive: 'declined', },
              polished: true,
            }),
          },);
        },).toThrow(UnsettledFinalSelectionError,);
      },
    },),
    it({
      name: 'ACCEPTS fresh consolidation after contest declined archive',
      fn: async () => {
        expect(assertFinalSelectionSettled({
          entryId: 'Cat',
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'declined', },
            consolidated: true,
          }),
        },),).toBeUndefined();
      },
    },),
  ],
},);
