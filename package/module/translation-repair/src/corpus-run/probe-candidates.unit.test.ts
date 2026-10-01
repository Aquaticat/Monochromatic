/**
 Tests for the seatable ids a probe measures beside the seated roster.
 
 THE CIRCLE THIS BREAKS: a model takes a role on the numbers the probes
 report, the probes ran the run roster, and the run roster holds only models
 with numbers. `--candidates` lets a probe ask a seatable model for its number
 without seating it first.
 
 THE REFUSALS ARE THE POINT, as in `asked-count.unit.test.ts`: a probe started
 for a model it then quietly ran without would print a clean standing over
 the wrong roster.
 
 @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CommandLineOf,
  probeRosterWith,
  readCandidateIds,
  readCandidatesAlone,
  ROSTER_MODEL_IDS,
  RUN_ROSTER,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { SEAT_BEDROCK_ONLY_VISION_UNSEATED, } from '../roster-seats.test-fixture.ts';
import { BEDROCK_ONLY_ROSTER_IDS, } from '../roster-buckets.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';

//region Probe candidate tests

/**
 Both unmeasured sizes, as typed after the flag.
 */
const BOTH_UNMEASURED = BEDROCK_ONLY_ROSTER_IDS.join(',',);

/**
 A seated model, to prove a candidate the roster already carries is not
 seated twice.
 */
const SEATED = nonNullishOrThrow(RUN_ROSTER[0],);

/**
 The fidelity probe's command line, read as `reportingRefusals` reads it,
 with what a person typed after the script path.
 
 @example
 ```ts
 const line = probeLine({ typed: ['--candidates', SEAT_BEDROCK_ONLY_TEXT,], },);
 ```
 */
function probeLine(
  { typed, }: { readonly typed: readonly string[]; },
): CommandLineOf<'judge-fidelity-probe'> {
  return lineOf({
    command: 'judge-fidelity-probe',
    typed,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: readCandidateIds.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS NONE when the flag is absent, so every existing invocation runs the seated roster',
          fn: async () => {
            expect(readCandidateIds({ line: probeLine({ typed: ['--cap', '4',], },), },),).toEqual([],);
          },
        },),
        it({
          name: 'READS the seatable ids named, in the order written',
          fn: async () => {
            expect(
              readCandidateIds({ line: probeLine({ typed: ['--candidates', BOTH_UNMEASURED,], },), },),
            ).toEqual([...BEDROCK_ONLY_ROSTER_IDS,],);
            // The equals form once read as no flag, so the probe ran the seated
            // roster and measured none of the models it was started for (ledger B75).
            expect(
              readCandidateIds({ line: probeLine({ typed: [`--candidates=${BOTH_UNMEASURED}`,], },), },),
            ).toEqual([...BEDROCK_ONLY_ROSTER_IDS,],);
            for (const id of BEDROCK_ONLY_ROSTER_IDS)
              expect(ROSTER_MODEL_IDS.includes(id,),).toBe(true,);
            // The unseated size is what the flag exists for; the seated one is
            // named too, and joins nothing twice.
            expect(RUN_ROSTER.includes(SEAT_BEDROCK_ONLY_VISION_UNSEATED,),).toBe(false,);
          },
        },),
        it({
          name: 'REFUSES a flag that names nothing, rather than running the seated roster under a candidate flag',
          fn: async () => {
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates',], },), },);
            },).toThrow(StatedRefusalError,);
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates', ',',], },), },);
            },).toThrow(StatedRefusalError,);
          },
        },),
        it({
          name: 'REFUSES an id the roster does not know, naming the ids it does',
          fn: async () => {
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates', 'google.gemma-4-e2b,nobody/such-model',], },), },);
            },).toThrow(StatedRefusalError,);
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates', 'nobody/such-model',], },), },);
            },).toThrow('nobody/such-model',);
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates', 'nobody/such-model',], },), },);
            },).toThrow(BEDROCK_ONLY_ROSTER_IDS[0],);
          },
        },),
        it({
          name: 'QUOTES the id it refuses, so a spaced or mistyped id shows as typed (ledger B75)',
          fn: async () => {
            expect(() => {
              readCandidateIds({ line: probeLine({ typed: ['--candidates', 'nobody/such model',], },), },);
            },).toThrow('--candidates names "nobody/such model", which is not seatable',);
          },
        },),
      ],
    },),

    describe({
      name: probeRosterWith.name,
      concurrency: DEFAULT_CONCURRENCY,
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
                nonNullishOrThrow(BEDROCK_ONLY_ROSTER_IDS[0],),
              ],
              alone: false,
            },);
            expect(roster,).toEqual([
              ...RUN_ROSTER,
              ...BEDROCK_ONLY_ROSTER_IDS.filter(function unseated(id,): boolean {
                return !RUN_ROSTER.includes(id,);
              },),
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
                nonNullishOrThrow(BEDROCK_ONLY_ROSTER_IDS[0],),
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
    },),

    describe({
      name: readCandidatesAlone.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS the flag only when written',
          fn: async () => {
            expect(readCandidatesAlone({ line: probeLine({ typed: ['--candidates', BOTH_UNMEASURED,], },), },),).toBe(false,);
            expect(
              readCandidatesAlone({ line: probeLine({ typed: ['--candidates', BOTH_UNMEASURED, '--candidates-alone',], },), },),
            ).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);

//endregion Probe candidate tests
