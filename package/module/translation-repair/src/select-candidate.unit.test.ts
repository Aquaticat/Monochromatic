/**
 * Tests for lexicographic candidate selection.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type CandidateMeasurements,
  type RepairCandidate,
  selectRepairCandidate,
  UNCHANGED_CANDIDATE_ID,
  UNCHANGED_MEASUREMENTS,
} from '../dist/final/neutral/index.mjs';

/**
 * The always-competing unchanged candidate.
 */
const UNCHANGED: RepairCandidate = {
  candidateId: UNCHANGED_CANDIDATE_ID,
  text: 'The cat naps in the sun.',
  measurements: UNCHANGED_MEASUREMENTS,
};

/**
 * Repaired candidate with chosen measurements.
 */
function repaired(
  {
    suffix,
    measurements,
  }: {
    readonly suffix: string;
    readonly measurements: CandidateMeasurements;
  },
): RepairCandidate {
  return {
    candidateId: `candidate/${suffix}`,
    text: `The cat naps in the warm sun. (${suffix})`,
    measurements,
  };
}

await describe({
  name: selectRepairCandidate.name,
  children: [
    it({
      name: 'prefers a proven repair over the unchanged translation',
      fn: async () => {
        /** Repair resolving one critical issue cleanly. */
        const fixer = repaired({
          suffix: 'fixer',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 1,
            resolvedTotal: 1,
            regressionCount: 0,
            changedCharCount: 20,
          },
        },);
        /** Selection over both. */
        const { winner, } = selectRepairCandidate({ candidates: [UNCHANGED, fixer,], },);
        expect(winner.candidateId,).toBe('candidate/fixer',);
      },
    },),

    it({
      name: 'returns the unchanged translation when nothing demonstrably beats it',
      fn: async () => {
        /** Repair that resolved nothing and changed text anyway. */
        const churner = repaired({
          suffix: 'churner',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 0,
            resolvedTotal: 0,
            regressionCount: 0,
            changedCharCount: 35,
          },
        },);
        /** Selection over both. */
        const { winner, } = selectRepairCandidate({ candidates: [churner, UNCHANGED,], },);
        expect(winner.candidateId,).toBe(UNCHANGED_CANDIDATE_ID,);
      },
    },),

    it({
      name: 'ranks integrity above every resolution count',
      fn: async () => {
        /** Repair resolving everything but breaking document structure. */
        const breaker = repaired({
          suffix: 'breaker',
          measurements: {
            integrityOk: false,
            resolvedHighSeverity: 5,
            resolvedTotal: 8,
            regressionCount: 0,
            changedCharCount: 10,
          },
        },);
        /** Selection over both. */
        const { winner, ranking, } = selectRepairCandidate({
          candidates: [breaker, UNCHANGED,],
        },);
        expect(winner.candidateId,).toBe(UNCHANGED_CANDIDATE_ID,);
        expect(ranking.at(-1,)?.candidateId,).toBe('candidate/breaker',);
      },
    },),

    it({
      name: 'ranks high-severity resolution above regression count and preservation above ties',
      fn: async () => {
        /** Repair resolving two criticals with one regression. */
        const bold = repaired({
          suffix: 'bold',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 2,
            resolvedTotal: 2,
            regressionCount: 1,
            changedCharCount: 60,
          },
        },);
        /** Repair resolving one critical cleanly. */
        const timid = repaired({
          suffix: 'timid',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 1,
            resolvedTotal: 1,
            regressionCount: 0,
            changedCharCount: 15,
          },
        },);
        /** Same measurements as timid but touching more text. */
        const sprawling = repaired({
          suffix: 'sprawling',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 1,
            resolvedTotal: 1,
            regressionCount: 0,
            changedCharCount: 90,
          },
        },);
        /** Selection over the full slate. */
        const { ranking, } = selectRepairCandidate({
          candidates: [
            sprawling,
            timid,
            UNCHANGED,
            bold,
          ],
        },);
        expect(ranking.map(function toId(candidate,) {
          return candidate.candidateId;
        },),).toEqual([
          'candidate/bold',
          'candidate/timid',
          'candidate/sprawling',
          UNCHANGED_CANDIDATE_ID,
        ],);
      },
    },),

    it({
      name: 'throws when the unchanged candidate is missing from the slate',
      fn: async () => {
        /** Lone repaired candidate. */
        const only = repaired({
          suffix: 'only',
          measurements: UNCHANGED_MEASUREMENTS,
        },);
        expect(function selectWithoutUnchanged() {
          selectRepairCandidate({ candidates: [only,], },);
        },).toThrow('always competes',);
      },
    },),
  ],
},);
