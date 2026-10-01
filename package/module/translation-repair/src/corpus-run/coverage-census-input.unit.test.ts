/**
 Tests what the coverage census reads (ledger T8): the suite's markers
 counted by occurrence rather than by line, its command line with every
 refusal strict `parseArgs` and the census add, and an earlier census's
 stretches and loaded sources, read only from a file of the current census
 format. Paths are cat-themed invention.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
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
  readBaselineCensus,
  readCensusArguments,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { lineOf, } from './command-line.test-fixture.ts';

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
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: markerCount.name,
      concurrency: DEFAULT_CONCURRENCY,
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
    },),

    describe({
      name: readCensusArguments.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS TEST FILES, A BASELINE AND EVERY SOURCE NAMED, and nothing when nothing is written',
          fn: async () => {
            expect(readCensusArguments({
              line: lineOf({
                command: 'coverage-census',
                typed: [
                  'src/nap.unit.test.ts',
                  '--baseline',
                  '/tmp/census.json',
                  '--source',
                  'src/nap.ts',
                  '--source',
                  'src/purr.ts',
                ],
              },),
            },),).toEqual({
              testFiles: ['src/nap.unit.test.ts',],
              baseline: ['/tmp/census.json',],
              sources: ['src/nap.ts', 'src/purr.ts',],
            },);
            expect(readCensusArguments({
              line: lineOf({
                command: 'coverage-census',
                typed: [],
              },),
            },),).toEqual({
              testFiles: [],
              baseline: [],
              sources: [],
            },);
          },
        },),
        it({
          name: 'REFUSES a flag written last, a flag followed by another flag, an unknown flag, and --source with no --baseline to read',
          fn: async () => {
            for (
              const typed of [
                ['--baseline',],
                ['--baseline', '--source', 'src/nap.ts',],
                ['--nap',],
                ['--source', 'src/nap.ts',],
              ]
            ) {
              expect(() => readCensusArguments({
                line: lineOf({
                  command: 'coverage-census',
                  typed,
                },),
              },),).toThrow(StatedRefusalError,);
            }
          },
        },),
      ],
    },),

    describe({
      name: readBaselineCensus.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE COMMIT, STRETCHES AND LOADED SOURCES OF A CENSUS FILE of the current format, taken from a '
            + 'tree matching its commit',
          fn: async () => {
            expect(readBaselineCensus({
              path: '/tmp/census.json',
              text: JSON.stringify({
                format: CENSUS_FORMAT,
                head: 'abc',
                clean: true,
                stretches: [STRETCH,],
                loadedSources: ['src/nap.ts', 'src/purr.ts',],
              },),
            },),).toEqual({
              head: 'abc',
              stretches: [STRETCH,],
              loadedSources: new Set(['src/nap.ts', 'src/purr.ts',],),
            },);
          },
        },),
        it({
          name: 'REFUSES A CENSUS NAMING NO COMMIT, one not saying whether its tree matched it, and one taken with '
            + 'uncommitted changes: a later reading tells an edited source by comparing the tree with that commit, '
            + 'and a census of uncommitted code has lines no commit holds',
          fn: async () => {
            for (const [text, says,] of [
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  clean: true,
                  stretches: [STRETCH,],
                  loadedSources: [],
                },),
                'it names no commit it was taken at',
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  head: 'abc',
                  stretches: [STRETCH,],
                  loadedSources: [],
                },),
                'it does not say whether its tree matched that commit',
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  head: 'abc',
                  clean: false,
                  stretches: [STRETCH,],
                  loadedSources: [],
                },),
                'it was taken with uncommitted changes under the package, so its lines match no commit a later reading '
                + 'can compare the tree with; commit, then take the baseline again',
              ],
            ] as const) {
              /**
               The read, repeated for each check.
               */
              const read = () =>
                readBaselineCensus({
                  path: '/tmp/census.json',
                  text,
                },);
              expect(read,).toThrow(CensusBaselineError,);
              expect(read,).toThrow(`baseline /tmp/census.json does not read as a census this command wrote: ${says}`,);
            }
          },
        },),
        it({
          name: 'REFUSES, each for its own reason, a file that is not an object, one of an earlier format or none (the '
            + 'census before ledger M67), one with no stretches, one holding a stretch missing a field, one with no '
            + 'loaded sources, and one whose loaded sources hold something not a path',
          fn: async () => {
            for (const [text, says,] of [
              ['null', 'it is not an object',],
              [
                JSON.stringify({
                  head: 'abc',
                  stretches: [STRETCH,],
                  loadedSources: [],
                },),
                `it is not census format ${String(CENSUS_FORMAT,)}`,
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT - 1,
                  stretches: [STRETCH,],
                  loadedSources: [],
                },),
                `it is not census format ${String(CENSUS_FORMAT,)}`,
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  head: 'abc',
                  loadedSources: [],
                },),
                'it has no list of stretches',
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  stretches: [{
                    ...STRETCH,
                    startLine: '1',
                  },],
                  loadedSources: [],
                },),
                'it has no list of stretches',
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  stretches: [STRETCH,],
                },),
                'it has no list of loaded sources',
              ],
              [
                JSON.stringify({
                  format: CENSUS_FORMAT,
                  stretches: [STRETCH,],
                  loadedSources: ['src/nap.ts', 7,],
                },),
                'it has no list of loaded sources',
              ],
            ] as const) {
              /**
               The read, repeated for each check.
               */
              const read = () =>
                readBaselineCensus({
                  path: '/tmp/census.json',
                  text,
                },);
              expect(read,).toThrow(CensusBaselineError,);
              expect(read,).toThrow(says,);
            }
          },
        },),
      ],
    },),
  ],
},);
