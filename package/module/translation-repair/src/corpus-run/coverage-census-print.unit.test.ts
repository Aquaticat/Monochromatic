/**
 Tests the coverage census's printed report (ledger T8): the heading's
 commit, scope and passes; a line per kind; the bundles no test loaded with
 the library sources only they carry; library rows alone; the outermost
 uncalled functions in package source by source and line number, anonymous
 ones named so; and a baseline reading's counts and unproven stretches.
 Paths and names are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  baselineReportLines,
  type CensusSummary,
  censusReportLines,
  type MappedFunction,
} from '../../dist/final/node/index.mjs';

/**
 An uncalled function in a source at a line.

 @param source - source file

 @param line - 1-based line

 @param name - name V8 gave it

 @param nested - whether it sits inside another uncalled function

 @returns The mapped function
 */
function uncalledAt({
  source,
  line,
  name,
  nested,
}: {
  readonly source: string;
  readonly line: number;
  readonly name: string;
  readonly nested: boolean;
},): MappedFunction {
  return {
    bundle: 'nap.mjs',
    start: 0,
    end: 1,
    name,
    nested,
    at: {
      kind: 'mapped',
      source,
      line,
    },
  };
}

/**
 A census with one row and total of each kind, two unloaded sources, and
 uncalled functions of every sort the report filters.
 */
const CENSUS: CensusSummary = {
  head: 'abc123def',
  clean: true,
  testFiles: [],
  passes: 12,
  totals: [
    {
      kind: 'library source',
      files: 1,
      stretches: 2,
      lines: 5,
      uncalled: 3,
    },
    {
      kind: 'entry file',
      files: 1,
      stretches: 1,
      lines: 4,
      uncalled: 0,
    },
  ],
  rows: [
    {
      source: 'src/nap.ts',
      kind: 'library source',
      stretches: 2,
      lines: 5,
      uncalled: 3,
    },
    {
      source: 'src/corpus-run/nap-probe.ts',
      kind: 'entry file',
      stretches: 1,
      lines: 4,
      uncalled: 0,
    },
  ],
  uncalled: [
    uncalledAt({
      source: 'src/nap.ts',
      line: 10,
      name: 'doze',
      nested: false,
    },),
    uncalledAt({
      source: 'src/nap.ts',
      line: 9,
      name: '',
      nested: false,
    },),
    uncalledAt({
      source: 'src/nap.ts',
      line: 11,
      name: 'yawn',
      nested: true,
    },),
    uncalledAt({
      source: '../../module/whisker/src/index.ts',
      line: 3,
      name: 'twitch',
      nested: false,
    },),
    {
      ...uncalledAt({
        source: 'src/nap.ts',
        line: 1,
        name: 'blink',
        nested: false,
      },),
      at: { kind: 'unmapped', },
    },
  ],
  unloadedBundles: ['nap-probe.mjs',],
  unloadedSources: [
    {
      source: 'src/corpus-run/nap-probe.ts',
      kind: 'entry file',
      lines: 40,
    },
    {
      source: 'src/corpus-run/nap-layout.ts',
      kind: 'library source',
      lines: 20,
    },
  ],
  censusPath: '/tmp/census.json',
};

await describe({
  name: censusReportLines.name,
  children: [
    it({
      name: 'PRINTS THE HEADING, KINDS, UNLOADED BUNDLES, LIBRARY ROWS AND OUTERMOST UNCALLED FUNCTIONS in package source by line number',
      fn: async () => {
        expect(censusReportLines({ census: CENSUS, },),).toEqual([
          `coverage-census at ${CENSUS.head}: the unit suite, ${String(CENSUS.passes,)} passes`,
          'library source: 1 files, 2 stretches over 5 lines, 3 functions never called',
          'entry file: 1 files, 1 stretches over 4 lines, 0 functions never called',
          'bundles no test loaded: 1, carrying 2 sources and 60 physical lines',
          '  library source only those bundles carry: src/corpus-run/nap-layout.ts',
          'library source by cold lines:',
          '  src/nap.ts: 2 stretches, 5 lines, 3 never called',
          'functions never called in package source, outermost:',
          '  src/nap.ts:9 (anonymous)',
          '  src/nap.ts:10 doze',
          `census written to ${CENSUS.censusPath}`,
        ],);
      },
    },),
    it({
      name: 'SAYS WHEN THE FILES DIFFERED FROM THE COMMIT, and how many test files ran when some were named',
      fn: async () => {
        expect(censusReportLines({
          census: {
            ...CENSUS,
            clean: false,
            testFiles: ['src/nap.unit.test.ts', 'src/purr.unit.test.ts',],
          },
        },)[0],).toBe(`coverage-census at ${CENSUS.head} with uncommitted changes: 2 test files, ${String(CENSUS.passes,)} passes`,);
      },
    },),
  ],
},);

await describe({
  name: baselineReportLines.name,
  children: [
    it({
      name: 'COUNTS EACH STATUS, then lists every stretch not proven run',
      fn: async () => {
        const stretch = {
          bundle: 'nap.mjs',
          start: 0,
          end: 1,
          name: '',
          source: 'src/nap.ts',
          startLine: 3,
          endLine: 5,
        };
        expect(baselineReportLines({
          path: '/tmp/census.json',
          statuses: [
            {
              stretch,
              status: 'ran',
            },
            {
              stretch: {
                ...stretch,
                startLine: 8,
                endLine: 8,
              },
              status: 'still cold',
            },
            {
              stretch: {
                ...stretch,
                source: 'src/purr.ts',
              },
              status: 'not loaded',
            },
          ],
        },),).toEqual([
          'against /tmp/census.json: ran 1, still cold 1, not loaded 1',
          '  still cold: src/nap.ts:8-8',
          '  not loaded: src/purr.ts:3-5',
        ],);
      },
    },),
  ],
},);
