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
  finalSelectionFindings,
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
            refinersHeard: ['hf:zai-org/GLM-5.3-Flash',],
            contributors: ['hf:zai-org/GLM-5.3-Flash',],
            roundCount: 1,
            findings: [],
          },
        },],
      }
      : { kind: 'not-run', },
  } as unknown as WouldShipSource;
}

await describe({
  name: finalSelectionFindings.name,
  children: [
    it({
      name: 'REPORTS NOTHING for a lane winner because archive does not become fallback',
      fn: async () => {
        expect(finalSelectionFindings({
          artifact: sourceWith({ verdict: { kind: 'lane-won', lane: 'repair', }, }),
        },),).toEqual([],);
      },
    },),
    it({
      name: 'REPORTS NOTHING for archive fallback explicitly endorsed by contest',
      fn: async () => {
        expect(finalSelectionFindings({
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'endorsed', },
          }),
        },),).toEqual([],);
      },
    },),
    it({
      name: 'RECORDS a declined archive contest as a finding rather than a refusal',
      fn: async () => {
        /**
         * Findings for an archive standing without endorsement.
         */
        const findings = finalSelectionFindings({
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'declined', },
          }),
        },);
        expect(findings,).toHaveLength(1,);
        expect(
          findings[0]
            ?.includes('final-selection-unendorsed (slice 0)',),
        ).toBe(true,);
      },
    },),
    it({
      name: 'RECORDS archive fallback after contest misses quorum',
      fn: async () => {
        expect(finalSelectionFindings({
          artifact: sourceWith({ verdict: { kind: 'quorum-not-met', }, }),
        },),).toHaveLength(1,);
      },
    },),
    it({
      name: 'RECORDS a polish over an unendorsed archive baseline',
      fn: async () => {
        expect(finalSelectionFindings({
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'declined', },
            polished: true,
          }),
        },),).toHaveLength(1,);
      },
    },),
    it({
      name: 'REPORTS NOTHING for fresh consolidation after contest declined archive',
      fn: async () => {
        expect(finalSelectionFindings({
          artifact: sourceWith({
            verdict: { kind: 'settled-neither', archive: 'declined', },
            consolidated: true,
          }),
        },),).toEqual([],);
      },
    },),
  ],
},);
