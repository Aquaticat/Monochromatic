import { SourceMap, } from 'node:module';
import {
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import { lineStartsOf, } from '../line-starts.ts';
import type {
  ColdStretch,
  UncalledFunction,
} from './coverage-tally.ts';

//region Coverage lines
// Ledger T8: carries a bundle offset V8 counted back to the source line it was
// built from, through the source map the coverage build writes beside each
// chunk. A map entry names the NEAREST MAPPED POSITION AT OR BEFORE the one
// asked about. Under the minifier a stretch can therefore start a line late,
// on the return where it folds a log call and that return into one statement
// (`src/repair-chunk.ts` on 2026-09-29), so triage reads the bundle text beside
// the source lines.

/**
 A source map file that does not read as a version 3 map.

 @example
 ```ts
 throw new SourceMapFileError({ path: 'dist/final/node/index.mjs.map', says: 'it has no mappings', },);
 ```
 */
export class SourceMapFileError extends Error {
  /**
   Declares this message safe to forward: it names a file of the package's
   own build and a shape this module describes.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal naming the file and what did not read.

   @param path - map file read

   @param says - what in it did not read

   @example
   ```ts
   new SourceMapFileError({ path: 'dist/final/node/index.mjs.map', says: 'it has no mappings', },);
   ```
   */
  constructor({
    path,
    says,
  }: {
    readonly path: string;
    readonly says: string;
  },) {
    super(`source map ${path} does not read as a version 3 map: ${says}; build with the coverage config, which writes one beside every chunk`,);
    this.name = 'SourceMapFileError';
  }
}

/**
 One bundle's text positions and map, enough to name the source line under
 any offset.

 @example
 ```ts
 const lines = bundleLinesOf({ text, map: readSourceMap({ path, text: mapText, },), mapDirectory, packageDirectory, },);
 ```
 */
export type BundleLines = {
  /**
   Offset of each line's first character.
   */
  readonly lineStarts: readonly number[];

  /**
   The bundle's source map.
   */
  readonly map: SourceMap;

  /**
   Directory the map's source paths are relative to.
   */
  readonly mapDirectory: string;

  /**
   Package directory the named sources are made relative to.
   */
  readonly packageDirectory: string;
};

/**
 The source line under a bundle offset, or that no mapping precedes it.

 @example
 ```ts
 const place: SourceLine = { kind: 'mapped', source: 'src/nap.ts', line: 12, };
 ```
 */
export type SourceLine = {
  readonly kind: 'mapped';

  /**
   Source file, relative to the package directory.
   */
  readonly source: string;

  /**
   Its 1-based line.
   */
  readonly line: number;
} | { readonly kind: 'unmapped'; };

/**
 A cold stretch with the source lines of its first and last characters.

 @example
 ```ts
 const mapped: MappedStretch = { ...stretch, from: place, to: place, };
 ```
 */
export type MappedStretch = ColdStretch & {
  /**
   Source line of its first character.
   */
  readonly from: SourceLine;

  /**
   Source line of its last character.
   */
  readonly to: SourceLine;
};

/**
 An uncalled function with the source line it starts on.

 @example
 ```ts
 const mapped: MappedFunction = { ...uncalled, at: place, };
 ```
 */
export type MappedFunction = UncalledFunction & {
  /**
   Source line of its first character.
   */
  readonly at: SourceLine;
};

/**
 The source map format version the bundler writes and Node reads.
 */
const SOURCE_MAP_VERSION = 3;

/**
 Reads a map file into Node's source map reader, keeping the sources' names
 and dropping their contents, which the census never reads.

 @param path - map file read, named in the refusal

 @param text - its contents

 @returns The map, and the sources it names as written in it

 @throws SourceMapFileError where the file is not a version 3 map with
 named sources and mappings

 @example
 ```ts
 const { map, sources, } = readSourceMap({ path, text, },);
 ```
 */
export function readSourceMap(
  {
    path,
    text,
  }: {
    readonly path: string;
    readonly text: string;
  },
): {
  readonly map: SourceMap;
  readonly sources: readonly string[];
} {
  /**
   The file as JSON.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isJsonRecord(parsed,))
    throw new SourceMapFileError({
      path,
      says: 'it is not an object',
    },);
  /**
   The fields a version 3 map carries.
   */
  const {
    version,
    sources,
    names,
    mappings,
    file,
  } = parsed;
  if (version !== SOURCE_MAP_VERSION)
    throw new SourceMapFileError({
      path,
      says: `its version is not ${String(SOURCE_MAP_VERSION,)}`,
    },);
  if ((!isJsonArray(sources,)) || (!sources.every(function isName(source,): source is string {
    return (typeof source) === 'string';
  },)))
    throw new SourceMapFileError({
      path,
      says: 'its sources are not a list of names',
    },);
  if ((typeof mappings) !== 'string')
    throw new SourceMapFileError({
      path,
      says: 'it has no mappings',
    },);
  return {
    map: new SourceMap({
      version,
      file: (typeof file) === 'string' ? file : '',
      sources: [...sources,],
      sourcesContent: [],
      names: isJsonArray(names,)
        ? names.filter(function isName(name,): name is string {
          return (typeof name) === 'string';
        },)
        : [],
      mappings,
      sourceRoot: '',
    },),
    sources,
  };
}

/**
 Reads one bundle's positions and map.

 @param text - bundle text

 @param map - its source map

 @param mapDirectory - directory the map's source paths are relative to

 @param packageDirectory - directory sources are named from

 @returns What `sourceLineAt` needs

 @example
 ```ts
 const lines = bundleLinesOf({ text, map, mapDirectory, packageDirectory, },);
 ```
 */
export function bundleLinesOf(
  {
    text,
    map,
    mapDirectory,
    packageDirectory,
  }: {
    readonly text: string;
    readonly map: SourceMap;
    readonly mapDirectory: string;
    readonly packageDirectory: string;
  },
): BundleLines {
  return {
    lineStarts: lineStartsOf({ text, },),
    map,
    mapDirectory,
    packageDirectory,
  };
}

/**
 Names the source line under one bundle offset.

 @param lines - bundle's positions and map

 @param offset - bundle offset V8 reported

 @returns Source file relative to the package and its 1-based line, or that no
 mapping precedes the offset

 @example
 ```ts
 const place = sourceLineAt({ lines, offset: 120, },);
 ```
 */
export function sourceLineAt(
  {
    lines,
    offset,
  }: {
    readonly lines: BundleLines;
    readonly offset: number;
  },
): SourceLine {
  /**
   Line holding the offset, 0-based.
   */
  const line = lines.lineStarts
    .findLastIndex(function startsAtOrBefore(start,): boolean {
    return start <= offset;
  },);
  /**
   The nearest mapping at or before it.
   */
  const entry = lines.map
    .findEntry(
    line,
    offset - (lines.lineStarts[line] ?? 0),
  );
  if (!('originalSource' in entry))
    return { kind: 'unmapped', };
  /**
   The source as a path on disk.
   */
  const onDisk = entry.originalSource
    .startsWith('file:',)
    ? fileURLToPath(entry.originalSource,)
    : resolve(
      lines.mapDirectory,
      entry.originalSource,
    );
  return {
    kind: 'mapped',
    source: relative(
      lines.packageDirectory,
      onDisk,
    ),
    line: entry.originalLine + 1,
  };
}

/**
 Names the source lines of a cold stretch's first and last characters.

 @param lines - bundle's positions and map

 @param stretch - stretch in that bundle

 @returns The stretch with both lines

 @example
 ```ts
 const mapped = mapStretch({ lines, stretch, },);
 ```
 */
export function mapStretch(
  {
    lines,
    stretch,
  }: {
    readonly lines: BundleLines;
    readonly stretch: ColdStretch;
  },
): MappedStretch {
  return {
    ...stretch,
    from: sourceLineAt({
      lines,
      offset: stretch.start,
    },),
    to: sourceLineAt({
      lines,
      offset: Math.max(
        stretch.start,
        stretch.end - 1,
      ),
    },),
  };
}

/**
 Names the source line an uncalled function starts on.

 @param lines - bundle's positions and map

 @param uncalled - function in that bundle

 @returns The function with its line

 @example
 ```ts
 const mapped = mapFunction({ lines, uncalled, },);
 ```
 */
export function mapFunction(
  {
    lines,
    uncalled,
  }: {
    readonly lines: BundleLines;
    readonly uncalled: UncalledFunction;
  },
): MappedFunction {
  return {
    ...uncalled,
    at: sourceLineAt({
      lines,
      offset: uncalled.start,
    },),
  };
}

//endregion Coverage lines
