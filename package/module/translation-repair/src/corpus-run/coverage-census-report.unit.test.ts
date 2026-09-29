/**
 Tests the coverage census's report (ledger T8): how a mapped stretch is
 recorded, one record per source piece, the refusal of a census that places an
 uncalled function outside its own source's stretches (ledger M67), how
 sources are sorted into kinds, the rows and totals, and how a batch's run
 reads an earlier census's stretches. Paths and names are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  baselineStatusesOf,
  type CensusStretch,
  censusStretchesOf,
  kindTotalsOf,
  type MappedStretch,
  requirePlacedFunctions,
  sourceKindOf,
  sourceRowsOf,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 A block stretch in `nap.mjs` from bundle offset 10 to 20.
 */
const BLOCK = {
  bundle: 'nap.mjs',
  start: 10,
  end: 20,
  shape: { kind: 'block', },
} as const;

/**
 A mapped source line.

 @param source - source file

 @param line - 1-based line

 @returns The line
 */
function at({
  source,
  line,
}: {
  readonly source: string;
  readonly line: number;
},) {
  return {
    kind: 'mapped',
    source,
    line,
  } as const;
}

/**
 A recorded stretch in one source over some lines.

 @param source - source file

 @param startLine - first line

 @param endLine - last line

 @returns The stretch
 */
function recorded({
  source,
  startLine,
  endLine,
}: {
  readonly source: string;
  readonly startLine: number;
  readonly endLine: number;
},): CensusStretch {
  return {
    bundle: 'nap.mjs',
    start: 0,
    end: 1,
    name: '',
    source,
    startLine,
    endLine,
  };
}

await describe({
  name: censusStretchesOf.name,
  children: [
    it({
      name: 'RECORDS EACH PIECE UNDER ITS OWN SOURCE, offsets and lines, so no source after the first drops out (ledger M67)',
      fn: async () => {
        const stretch: MappedStretch = {
          ...BLOCK,
          pieces: [
            {
              start: 10,
              end: 14,
              span: {
                kind: 'mapped',
                source: 'src/nap.ts',
                firstLine: 4,
                lastLine: 7,
              },
            },
            {
              start: 14,
              end: 20,
              span: {
                kind: 'mapped',
                source: 'src/purr.ts',
                firstLine: 1,
                lastLine: 9,
              },
            },
          ],
        };
        expect(censusStretchesOf({ stretch, },),).toEqual([
          {
            bundle: 'nap.mjs',
            start: 10,
            end: 14,
            name: '',
            source: 'src/nap.ts',
            startLine: 4,
            endLine: 7,
          },
          {
            bundle: 'nap.mjs',
            start: 14,
            end: 20,
            name: '',
            source: 'src/purr.ts',
            startLine: 1,
            endLine: 9,
          },
        ],);
      },
    },),
    it({
      name: 'RECORDS AN UNMAPPED PIECE under its bundle at line 0, and names an uncalled function on its first piece alone',
      fn: async () => {
        expect(censusStretchesOf({
          stretch: {
            ...BLOCK,
            shape: {
              kind: 'function',
              name: 'doze',
            },
            pieces: [
              {
                start: 10,
                end: 12,
                span: { kind: 'unmapped', },
              },
              {
                start: 12,
                end: 20,
                span: {
                  kind: 'mapped',
                  source: 'src/nap.ts',
                  firstLine: 4,
                  lastLine: 4,
                },
              },
            ],
          },
        },),).toEqual([
          {
            bundle: 'nap.mjs',
            start: 10,
            end: 12,
            name: 'doze',
            source: '(unmapped) nap.mjs',
            startLine: 0,
            endLine: 0,
          },
          {
            bundle: 'nap.mjs',
            start: 12,
            end: 20,
            name: '',
            source: 'src/nap.ts',
            startLine: 4,
            endLine: 4,
          },
        ],);
      },
    },),
  ],
},);

await describe({
  name: requirePlacedFunctions.name,
  children: [
    it({
      name: 'ACCEPTS A CENSUS PLACING EVERY UNCALLED FUNCTION in a stretch of its own bundle and source, unmapped ones at line 0',
      fn: async () => {
        const uncalled = {
          bundle: 'nap.mjs',
          start: 0,
          end: 1,
          name: 'doze',
          nested: false,
        };
        expect(() =>
          requirePlacedFunctions({
            stretches: [
              recorded({
                source: 'src/purr.ts',
                startLine: 2,
                endLine: 6,
              },),
              recorded({
                source: '(unmapped) nap.mjs',
                startLine: 0,
                endLine: 0,
              },),
            ],
            uncalled: [
              {
                ...uncalled,
                at: at({
                  source: 'src/purr.ts',
                  line: 6,
                },),
              },
              {
                ...uncalled,
                at: { kind: 'unmapped', },
              },
            ],
          },)
        ,).not.toThrow();
      },
    },),
    it({
      name: 'REFUSES THE SHAPE LEDGER M67 LEFT: a function in a second source whose cold code was recorded under the first, '
        + 'or in a stretch of another bundle',
      fn: async () => {
        const inPurr = {
          bundle: 'nap.mjs',
          start: 0,
          end: 1,
          name: 'doze',
          nested: false,
          at: at({
            source: 'src/purr.ts',
            line: 3,
          },),
        };
        expect(() =>
          requirePlacedFunctions({
            stretches: [recorded({
              source: 'src/nap.ts',
              startLine: 172,
              endLine: 172,
            },),],
            uncalled: [inPurr,],
          },)
        ,).toThrow(StatedRefusalError,);
        expect(() =>
          requirePlacedFunctions({
            stretches: [{
              ...recorded({
                source: 'src/purr.ts',
                startLine: 1,
                endLine: 9,
              },),
              bundle: 'purr.mjs',
            },],
            uncalled: [inPurr,],
          },)
        ,).toThrow(StatedRefusalError,);
      },
    },),
  ],
},);

await describe({
  name: sourceKindOf.name,
  children: [
    it({
      name: 'SORTS SOURCES INTO unmapped code, other packages, runner entry files and library source',
      fn: async () => {
        const entryFiles = new Set(['src/corpus-run/nap-probe.ts',],);
        expect([
          '(unmapped) nap.mjs',
          '../../module/whisker/src/index.ts',
          'src/corpus-run/nap-probe.ts',
          'src/nap.ts',
        ].map((source,) =>
          sourceKindOf({
            source,
            entryFiles,
          },)
        ),).toEqual(['unmapped', 'other package', 'entry file', 'library source',],);
      },
    },),
  ],
},);

await describe({
  name: sourceRowsOf.name,
  children: [
    it({
      name: 'COUNTS DISTINCT LINES AND THE UNCALLED FUNCTIONS STARTING IN EACH SOURCE, most cold lines first, ties by name',
      fn: async () => {
        const uncalled = {
          bundle: 'nap.mjs',
          start: 0,
          end: 1,
          name: 'doze',
          nested: false,
        };
        expect(sourceRowsOf({
          stretches: [
            recorded({
              source: 'src/purr.ts',
              startLine: 2,
              endLine: 3,
            },),
            recorded({
              source: 'src/nap.ts',
              startLine: 1,
              endLine: 3,
            },),
            recorded({
              source: 'src/nap.ts',
              startLine: 2,
              endLine: 4,
            },),
            recorded({
              source: 'src/knead.ts',
              startLine: 5,
              endLine: 6,
            },),
          ],
          uncalled: [
            {
              ...uncalled,
              at: at({
                source: 'src/nap.ts',
                line: 1,
              },),
            },
            {
              ...uncalled,
              at: { kind: 'unmapped', },
            },
          ],
          entryFiles: new Set(),
        },),).toEqual([
          {
            source: 'src/nap.ts',
            kind: 'library source',
            stretches: 2,
            lines: 4,
            uncalled: 1,
          },
          {
            source: 'src/knead.ts',
            kind: 'library source',
            stretches: 1,
            lines: 2,
            uncalled: 0,
          },
          {
            source: 'src/purr.ts',
            kind: 'library source',
            stretches: 1,
            lines: 2,
            uncalled: 0,
          },
        ],);
      },
    },),
  ],
},);

await describe({
  name: kindTotalsOf.name,
  children: [
    it({
      name: 'TOTALS EACH KIND HOLDING A ROW, library source first, leaving out kinds with none',
      fn: async () => {
        const row = {
          source: 'src/nap.ts',
          kind: 'library source',
          stretches: 2,
          lines: 4,
          uncalled: 1,
        } as const;
        expect(kindTotalsOf({
          rows: [
            {
              ...row,
              source: '../../module/whisker/src/index.ts',
              kind: 'other package',
            },
            row,
            {
              ...row,
              source: 'src/purr.ts',
            },
          ],
        },),).toEqual([
          {
            kind: 'library source',
            files: 2,
            stretches: 4,
            lines: 8,
            uncalled: 2,
          },
          {
            kind: 'other package',
            files: 1,
            stretches: 2,
            lines: 4,
            uncalled: 1,
          },
        ],);
      },
    },),
  ],
},);

await describe({
  name: baselineStatusesOf.name,
  children: [
    it({
      name: 'READS A STRETCH AS STILL COLD where a later cold stretch shares a line, RAN where none does, and NOT LOADED where its source was not loaded',
      fn: async () => {
        const baseline = [
          recorded({
            source: 'src/nap.ts',
            startLine: 3,
            endLine: 5,
          },),
          recorded({
            source: 'src/nap.ts',
            startLine: 8,
            endLine: 9,
          },),
          recorded({
            source: 'src/purr.ts',
            startLine: 1,
            endLine: 2,
          },),
        ];
        expect(baselineStatusesOf({
          baseline,
          current: [
            recorded({
              source: 'src/nap.ts',
              startLine: 5,
              endLine: 7,
            },),
          ],
          loadedSources: new Set(['src/nap.ts',],),
          sources: new Set(),
        },).map((read,) => read.status),).toEqual(['still cold', 'ran', 'not loaded',],);
      },
    },),
    it({
      name: 'READS ONLY THE CLAIMED SOURCES when any are named',
      fn: async () => {
        expect(baselineStatusesOf({
          baseline: [
            recorded({
              source: 'src/nap.ts',
              startLine: 3,
              endLine: 5,
            },),
            recorded({
              source: 'src/purr.ts',
              startLine: 1,
              endLine: 2,
            },),
          ],
          current: [],
          loadedSources: new Set(['src/nap.ts', 'src/purr.ts',],),
          sources: new Set(['src/purr.ts',],),
        },).map((read,) => [read.stretch.source, read.status,]),).toEqual([['src/purr.ts', 'ran',],],);
      },
    },),
  ],
},);
