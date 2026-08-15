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
  winnerChangedText,
} from '../dist/final/node/index.mjs';

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
            regressedKnownIssues: 0,
            touchedRegionChars: 20,
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
            regressedKnownIssues: 0,
            touchedRegionChars: 35,
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
            regressedKnownIssues: 0,
            touchedRegionChars: 10,
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
            regressedKnownIssues: 1,
            touchedRegionChars: 60,
          },
        },);
        /** Repair resolving one critical cleanly. */
        const timid = repaired({
          suffix: 'timid',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 1,
            resolvedTotal: 1,
            regressedKnownIssues: 0,
            touchedRegionChars: 15,
          },
        },);
        /** Same measurements as timid but touching more text. */
        const sprawling = repaired({
          suffix: 'sprawling',
          measurements: {
            integrityOk: true,
            resolvedHighSeverity: 1,
            resolvedTotal: 1,
            regressedKnownIssues: 0,
            touchedRegionChars: 90,
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

await describe({
  name: winnerChangedText.name,
  children: [
    it({
      name: 'reads the unchanged winner as no change, which is the ordinary case',
      fn: async () => {
        expect(winnerChangedText({
          winner: UNCHANGED,
          incumbentText: UNCHANGED.text,
        },),).toBe(false,);
      },
    },),
    it({
      name: 'reads a patched winner carrying different wording as a change',
      fn: async () => {
        expect(winnerChangedText({
          winner: {
            candidateId: 'candidate/chunk-0',
            text: 'The cat is asleep in the sun.',
            measurements: UNCHANGED_MEASUREMENTS,
          },
          incumbentText: UNCHANGED.text,
        },),).toBe(true,);
      },
    },),
    it({
      name: 'reads a patched winner whose text equals the archive as NO change, which is the case '
        + 'the patch gate cannot catch: it refuses an operation that rewrites its own region to '
        + 'itself, and two operations in adjacent envelopes can each change their own region while '
        + 'concatenating back to the archive text. A slice nothing happened in must not be counted '
        + 'as one this lane changed',
      fn: async () => {
        expect(winnerChangedText({
          winner: {
            candidateId: 'candidate/chunk-0',
            text: UNCHANGED.text,
            measurements: UNCHANGED_MEASUREMENTS,
          },
          incumbentText: UNCHANGED.text,
        },),).toBe(false,);
      },
    },),
  ],
},);
