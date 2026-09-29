/**
 Tests the coverage census's mapping from bundle offsets to source lines
 (ledger T8): which map files it refuses, what it keeps of one it reads, line
 starts, a position before the first mapping read as unmapped rather than as
 line 1, sources named from the package whether the map writes them relative
 or as file URLs, and a stretch's or function's lines. The map is written by
 hand: bundle line 0 has no mapping, lines 1 and 2 map to source lines 1 and 2.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  bundleLinesOf,
  lineStartsOf,
  mapFunction,
  mapStretch,
  readSourceMap,
  SourceMapFileError,
  sourceLineAt,
} from '../../dist/final/node/index.mjs';

/**
 Package directory the fixture names sources from.
 */
const PACKAGE = '/cattery';

/**
 Build directory beside it.
 */
const DIST = '/cattery/dist/final/node';

/**
 Bundle text: three lines, the first unmapped.
 */
const BUNDLE_TEXT = 'x\ny\nz';

/**
 A map whose bundle line 0 has no segment and whose lines 1 and 2 map to
 source lines 0 and 1 (0-based) of its one source.

 @param source - the source as the map writes it

 @returns The map file's text
 */
function mapText({ source, }: { readonly source: string; },): string {
  return JSON.stringify({
    version: 3,
    sources: [source,],
    names: ['nap', 7,],
    mappings: ';AAAA;AACA',
  },);
}

/**
 The fixture bundle's lines, its map naming the given source.

 @param source - the source as the map writes it

 @returns What sourceLineAt reads
 */
function linesWith({ source, }: { readonly source: string; },) {
  return bundleLinesOf({
    text: BUNDLE_TEXT,
    map: readSourceMap({
      path: 'nap.mjs.map',
      text: mapText({ source, },),
    },).map,
    mapDirectory: DIST,
    packageDirectory: PACKAGE,
  },);
}

await describe({
  name: readSourceMap.name,
  children: [
    it({
      name: 'REFUSES a map that is not an object, is not version 3, names sources that are not strings, or has no mappings',
      fn: async () => {
        for (const text of [
          'null',
          JSON.stringify({
            version: 2,
            sources: [],
            mappings: '',
          },),
          JSON.stringify({
            version: 3,
            sources: [1,],
            mappings: '',
          },),
          JSON.stringify({
            version: 3,
            mappings: '',
          },),
          JSON.stringify({
            version: 3,
            sources: [],
          },),
        ]) {
          expect(() => readSourceMap({
            path: 'nap.mjs.map',
            text,
          },),).toThrow(SourceMapFileError,);
        }
      },
    },),
    it({
      name: 'KEEPS SOURCE NAMES AND DROPS THEIR CONTENTS, with no file named read as empty and names that are not strings dropped',
      fn: async () => {
        const { map, sources, } = readSourceMap({
          path: 'nap.mjs.map',
          text: JSON.stringify({
            ...JSON.parse(mapText({ source: '../../../src/nap.ts', },),),
            sourcesContent: ['the whole source',],
          },),
        },);
        expect(sources,).toEqual(['../../../src/nap.ts',],);
        expect(map.payload.sourcesContent,).toEqual([],);
        expect(map.payload.file,).toBe('',);
        expect(map.payload.names,).toEqual(['nap',],);
      },
    },),
  ],
},);

await describe({
  name: lineStartsOf.name,
  children: [
    it({
      name: 'STARTS AT 0 AND AFTER EVERY NEWLINE, a trailing newline opening an empty last line',
      fn: async () => {
        expect(lineStartsOf({ text: 'ab\nc\n', },),).toEqual([0, 3, 5,],);
        expect(lineStartsOf({ text: '', },),).toEqual([0,],);
      },
    },),
  ],
},);

await describe({
  name: sourceLineAt.name,
  children: [
    it({
      name: 'READS A POSITION BEFORE THE FIRST MAPPING AS UNMAPPED, and one after it as its 1-based source line named from the package',
      fn: async () => {
        const lines = linesWith({ source: '../../../src/nap.ts', },);
        expect(sourceLineAt({
          lines,
          offset: 0,
        },),).toEqual({ kind: 'unmapped', },);
        expect(sourceLineAt({
          lines,
          offset: BUNDLE_TEXT.indexOf('y',),
        },),).toEqual({
          kind: 'mapped',
          source: 'src/nap.ts',
          line: 1,
        },);
        expect(sourceLineAt({
          lines,
          offset: BUNDLE_TEXT.indexOf('z',),
        },),).toEqual({
          kind: 'mapped',
          source: 'src/nap.ts',
          line: 2,
        },);
      },
    },),
    it({
      name: 'NAMES A SOURCE THE MAP WRITES AS A FILE URL from the package too',
      fn: async () => {
        expect(sourceLineAt({
          lines: linesWith({ source: `file://${PACKAGE}/src/purr.ts`, },),
          offset: BUNDLE_TEXT.indexOf('y',),
        },),).toEqual({
          kind: 'mapped',
          source: 'src/purr.ts',
          line: 1,
        },);
      },
    },),
  ],
},);

await describe({
  name: mapStretch.name,
  children: [
    it({
      name: 'NAMES THE LINES OF A STRETCH\'S FIRST AND LAST CHARACTERS, a one-character stretch reading one line for both',
      fn: async () => {
        const lines = linesWith({ source: '../../../src/nap.ts', },);
        const stretch = {
          bundle: 'nap.mjs',
          start: BUNDLE_TEXT.indexOf('y',),
          end: BUNDLE_TEXT.length,
          shape: { kind: 'block', },
        } as const;
        expect(mapStretch({
          lines,
          stretch,
        },),).toEqual({
          ...stretch,
          from: {
            kind: 'mapped',
            source: 'src/nap.ts',
            line: 1,
          },
          to: {
            kind: 'mapped',
            source: 'src/nap.ts',
            line: 2,
          },
        },);
        expect(mapStretch({
          lines,
          stretch: {
            ...stretch,
            end: stretch.start + 1,
          },
        },).to,).toEqual({
          kind: 'mapped',
          source: 'src/nap.ts',
          line: 1,
        },);
      },
    },),
  ],
},);

await describe({
  name: mapFunction.name,
  children: [
    it({
      name: 'NAMES THE LINE AN UNCALLED FUNCTION STARTS ON',
      fn: async () => {
        const uncalled = {
          bundle: 'nap.mjs',
          start: BUNDLE_TEXT.indexOf('z',),
          end: BUNDLE_TEXT.length,
          name: 'nap',
          nested: false,
        };
        expect(mapFunction({
          lines: linesWith({ source: '../../../src/nap.ts', },),
          uncalled,
        },),).toEqual({
          ...uncalled,
          at: {
            kind: 'mapped',
            source: 'src/nap.ts',
            line: 2,
          },
        },);
      },
    },),
  ],
},);
