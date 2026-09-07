/**
 * Tests for the seatable ids a probe measures beside the seated roster.
 *
 * THE CIRCLE THIS BREAKS: a model takes a role on the numbers the probes
 * report, the probes ran the run roster, and the run roster holds only models
 * with numbers. `--candidates` lets a probe ask a seatable model for its number
 * without seating it first.
 *
 * THE REFUSALS ARE THE POINT, as in `asked-count.unit.test.ts`: a probe started
 * for a model it then quietly ran without would print a clean standing over
 * the wrong roster.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BEDROCK_ONLY_ROSTER_IDS,
  probeRosterWith,
  readCandidateIds,
  readCandidatesAlone,
  ROSTER_MODEL_IDS,
  RUN_ROSTER,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

//region Probe candidate tests

/**
 * What `process.argv` carries before anything a person typed.
 */
const BEFORE_FLAGS: readonly string[] = [
  '/usr/bin/node',
  '/somewhere/judge-fidelity-probe.mjs',
];

/**
 * Both unmeasured sizes, as typed after the flag.
 */
const BOTH_UNMEASURED = BEDROCK_ONLY_ROSTER_IDS.join(',',);

/**
 * A seated model, to prove a candidate the roster already carries is not
 * seated twice.
 */
const SEATED = nonNullishOrThrow(RUN_ROSTER[0],);

/**
 * Command line with what a person typed after the script path.
 *
 * @example
 * ```ts
 * const argv = commandLine({ typed: ['--candidates', 'google.gemma-4-e2b',], },);
 * ```
 */
function commandLine(
  { typed, }: { readonly typed: readonly string[]; },
): readonly string[] {
  return [
    ...BEFORE_FLAGS,
    ...typed,
  ];
}

await describe({
  name: readCandidateIds.name,
  children: [
    it({
      name: 'READS NONE when the flag is absent, so every existing invocation runs the seated roster',
      fn: async () => {
        expect(readCandidateIds({ argv: commandLine({ typed: ['--cap', '4',], },), },),).toEqual([],);
      },
    },),
    it({
      name: 'READS the seatable ids named, in the order written',
      fn: async () => {
        expect(
          readCandidateIds({ argv: commandLine({ typed: ['--candidates', BOTH_UNMEASURED,], },), },),
        ).toEqual([...BEDROCK_ONLY_ROSTER_IDS,],);
        for (const id of BEDROCK_ONLY_ROSTER_IDS) {
          expect(ROSTER_MODEL_IDS.includes(id,),).toBe(true,);
          expect(RUN_ROSTER.includes(id,),).toBe(false,);
        }
      },
    },),
    it({
      name: 'REFUSES a flag that names nothing, rather than running the seated roster under a candidate flag',
      fn: async () => {
        expect(() => {
          readCandidateIds({ argv: commandLine({ typed: ['--candidates',], },), },);
        },).toThrow(StatedRefusalError,);
        expect(() => {
          readCandidateIds({ argv: commandLine({ typed: ['--candidates', ',',], },), },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'REFUSES an id the roster does not know, naming the ids it does',
      fn: async () => {
        expect(() => {
          readCandidateIds({ argv: commandLine({ typed: ['--candidates', 'google.gemma-4-e2b,nobody/such-model',], },), },);
        },).toThrow(StatedRefusalError,);
        expect(() => {
          readCandidateIds({ argv: commandLine({ typed: ['--candidates', 'nobody/such-model',], },), },);
        },).toThrow('nobody/such-model',);
        expect(() => {
          readCandidateIds({ argv: commandLine({ typed: ['--candidates', 'nobody/such-model',], },), },);
        },).toThrow(BEDROCK_ONLY_ROSTER_IDS[0],);
      },
    },),
  ],
},);

await describe({
  name: probeRosterWith.name,
  children: [
    it({
      name: 'RUNS THE SEATED ROSTER ALONE with no candidates',
      fn: async () => {
        expect(probeRosterWith({
          candidates: [],
          alone: false,
        },),).toEqual(RUN_ROSTER,);
      },
    },),
    it({
      name: 'APPENDS the candidates after the seated roster, each once, and never re-seats a seated one',
      fn: async () => {
        const roster = probeRosterWith({
          candidates: [
            SEATED,
            ...BEDROCK_ONLY_ROSTER_IDS,
            BEDROCK_ONLY_ROSTER_IDS[0],
          ],
          alone: false,
        },);
        expect(roster,).toEqual([
          ...RUN_ROSTER,
          ...BEDROCK_ONLY_ROSTER_IDS,
        ],);
        expect(roster.filter(function isSeated(id,): boolean {
          return id === SEATED;
        },).length,).toBe(1,);
      },
    },),
    it({
      name: 'RUNS THE CANDIDATES ALONE, each once, leaving every seated judge out, when asked to',
      fn: async () => {
        const roster = probeRosterWith({
          candidates: [
            ...BEDROCK_ONLY_ROSTER_IDS,
            BEDROCK_ONLY_ROSTER_IDS[0],
          ],
          alone: true,
        },);
        expect(roster,).toEqual([...BEDROCK_ONLY_ROSTER_IDS,],);
        expect(roster.includes(SEATED,),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES to run alone over nobody, rather than probing an empty roster',
      fn: async () => {
        expect(() => {
          probeRosterWith({
            candidates: [],
            alone: true,
          },);
        },).toThrow(StatedRefusalError,);
      },
    },),
  ],
},);

await describe({
  name: readCandidatesAlone.name,
  children: [
    it({
      name: 'READS the flag only when written',
      fn: async () => {
        expect(readCandidatesAlone({ argv: commandLine({ typed: ['--candidates', BOTH_UNMEASURED,], },), },),).toBe(false,);
        expect(
          readCandidatesAlone({ argv: commandLine({ typed: ['--candidates', BOTH_UNMEASURED, '--candidates-alone',], },), },),
        ).toBe(true,);
      },
    },),
  ],
},);

//endregion Probe candidate tests
