/**
 Tests what the coverage census reads (ledger T8): the suite's markers
 counted by occurrence rather than by line, its command line with every
 refusal strict `parseArgs` and the census add, and an earlier census's
 stretches, read only from a file of the current census format. Paths are
 cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CENSUS_FORMAT,
  CensusBaselineError,
  FAIL_MARKER,
  markerCount,
  PASS_MARKER,
  readBaselineStretches,
  readCensusArguments,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 Process arguments up to the script, as Node passes them.
 */
const SCRIPT = ['node', 'coverage-census.mjs',] as const;

/**
 One stretch as the census writes it.
 */
const STRETCH = {
  bundle: 'nap.mjs',
  start: 0,
  end: 4,
  name: '',
  source: 'src/nap.ts',
  startLine: 1,
  endLine: 2,
} as const;

await describe({
  name: markerCount.name,
  children: [
    it({
      name: 'COUNTS OCCURRENCES, NOT LINES: two tests\' markers on one line of a parallel log count twice',
      fn: async () => {
        const text = `${PASS_MARKER} nap${PASS_MARKER} purr\n${FAIL_MARKER} knead\n`;
        expect(markerCount({
          text,
          marker: PASS_MARKER,
        },),).toBe(2,);
        expect(markerCount({
          text,
          marker: FAIL_MARKER,
        },),).toBe(1,);
        expect(markerCount({
          text: '',
          marker: PASS_MARKER,
        },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: readCensusArguments.name,
  children: [
    it({
      name: 'READS TEST FILES, A BASELINE AND EVERY SOURCE NAMED, and nothing when nothing is written',
      fn: async () => {
        expect(readCensusArguments({
          argv: [
            ...SCRIPT,
            'src/nap.unit.test.ts',
            '--baseline',
            '/tmp/census.json',
            '--source',
            'src/nap.ts',
            '--source',
            'src/purr.ts',
          ],
        },),).toEqual({
          testFiles: ['src/nap.unit.test.ts',],
          baseline: ['/tmp/census.json',],
          sources: ['src/nap.ts', 'src/purr.ts',],
        },);
        expect(readCensusArguments({ argv: [...SCRIPT,], },),).toEqual({
          testFiles: [],
          baseline: [],
          sources: [],
        },);
      },
    },),
    it({
      name: 'REFUSES a flag written last, a flag followed by another flag, an unknown flag, and --source with no --baseline to read',
      fn: async () => {
        for (const args of [
          ['--baseline',],
          ['--baseline', '--source', 'src/nap.ts',],
          ['--nap',],
          ['--source', 'src/nap.ts',],
        ]) {
          expect(() => readCensusArguments({ argv: [...SCRIPT, ...args,], },),).toThrow(StatedRefusalError,);
        }
      },
    },),
  ],
},);

await describe({
  name: readBaselineStretches.name,
  children: [
    it({
      name: 'READS THE STRETCHES OF A CENSUS FILE of the current format',
      fn: async () => {
        expect(readBaselineStretches({
          path: '/tmp/census.json',
          text: JSON.stringify({
            format: CENSUS_FORMAT,
            head: 'abc',
            stretches: [STRETCH,],
          },),
        },),).toEqual([STRETCH,],);
      },
    },),
    it({
      name: 'REFUSES a file that is not an object, one of an earlier format or none (the census before ledger M67), '
        + 'one with no stretches, or one holding a stretch missing a field',
      fn: async () => {
        for (const text of [
          'null',
          JSON.stringify({
            head: 'abc',
            stretches: [STRETCH,],
          },),
          JSON.stringify({
            format: CENSUS_FORMAT - 1,
            stretches: [STRETCH,],
          },),
          JSON.stringify({
            format: CENSUS_FORMAT,
            head: 'abc',
          },),
          JSON.stringify({
            format: CENSUS_FORMAT,
            stretches: [{
              ...STRETCH,
              startLine: '1',
            },],
          },),
        ]) {
          expect(() => readBaselineStretches({
            path: '/tmp/census.json',
            text,
          },),).toThrow(CensusBaselineError,);
        }
      },
    },),
  ],
},);
