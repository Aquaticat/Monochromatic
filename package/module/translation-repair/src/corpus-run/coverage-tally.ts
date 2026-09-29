import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';

//region Coverage tally
// LEDGER T8: WHICH BUNDLE CODE NO TEST PROCESS RAN, read from the files
// `NODE_V8_COVERAGE` writes. V8 reports, per process and per script, each
// function as a tree of ranges whose innermost count is the count of the code
// under it, and it DROPS A NESTED RANGE WHOSE COUNT EQUALS ITS PARENT'S
// (`MergeNestedRanges` in V8's `src/debug/debug-coverage.cc`). A range one
// process lists as cold can therefore have run in a process that does not
// list it: summing the listed ranges alone called 1,061 of 2,371 blocks cold
// that ran (ledger T8, 2026-09-29).
//
// THE TALLY CUTS each bundle at every range boundary any process reported,
// gives each piece the count of its innermost enclosing range in each process,
// and sums over processes. That needs every boundary before the first piece is
// counted, so the coverage files are read twice: once through
// `noteBoundaries`, then once through `paint`.
//
// MUTABLE BY DESIGN. A full unit suite writes about 8 GB of coverage over some
// 860 processes; the tally folds each process into per-bundle typed arrays as
// it is read, rather than holding every process's ranges at once.
//
// FUNCTIONS ARE KEYED BY BOTH ENDS. A function that opens its chunk starts at
// offset 0, as the chunk's own top-level script function does, and keying by
// the start alone merged the two: the function took the script's empty name
// and the script's count (all five "unmatched" exports of 2026-09-28).

/**
 One counted range of a function, as V8 reports it.

 @example
 ```ts
 const range: CoverageRange = { startOffset: 0, endOffset: 40, count: 2, };
 ```
 */
export type CoverageRange = {
  /**
   Offset of the range's first character in the script.
   */
  readonly startOffset: number;

  /**
   Offset one past its last character.
   */
  readonly endOffset: number;

  /**
   How often the code under it ran in this process.
   */
  readonly count: number;
};

/**
 One function of a script, as V8 reports it: its whole extent first, then the
 blocks whose counts differ from their parent's.

 @example
 ```ts
 const napping: FunctionCoverage = { functionName: 'nap', ranges: [{ startOffset: 0, endOffset: 40, count: 1, },], };
 ```
 */
export type FunctionCoverage = {
  /**
   Name V8 gave the function, empty for a script's top level and for anonymous ones.
   */
  readonly functionName: string;

  /**
   Its ranges, the whole function first.
   */
  readonly ranges: readonly CoverageRange[];
};

/**
 One bundle's coverage from one process.

 @example
 ```ts
 const script: BundleScript = { bundle: 'index.mjs', functions: [], };
 ```
 */
export type BundleScript = {
  /**
   Bundle file name inside the build directory.
   */
  readonly bundle: string;

  /**
   Every function V8 reported for it.
   */
  readonly functions: readonly FunctionCoverage[];
};

/**
 A coverage file that does not read as V8 writes one.

 @example
 ```ts
 throw new CoverageFileError({ path: '/tmp/coverage-1.json', says: 'its result is not a list', },);
 ```
 */
export class CoverageFileError extends Error {
  /**
   Declares this message safe to forward: it names a file this process
   listed and a shape this module describes.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal naming the file and what did not read.

   @param path - coverage file read

   @param says - what in it did not read

   @example
   ```ts
   new CoverageFileError({ path: '/tmp/coverage-1.json', says: 'its result is not a list', },);
   ```
   */
  constructor({
    path,
    says,
  }: {
    readonly path: string;
    readonly says: string;
  },) {
    super(`coverage file ${path} does not read as V8 writes one: ${says}`,);
    this.name = 'CoverageFileError';
  }
}

/**
 A tally asked to paint before its boundaries were all noted, or handed a
 range the first reading never reported.

 @example
 ```ts
 throw new CoverageTallyError({ says: 'boundaries noted after painting began', },);
 ```
 */
export class CoverageTallyError extends Error {
  /**
   Declares this message safe to forward: it names bundles and offsets this
   process computed.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal.

   @param says - what the two readings disagreed on

   @example
   ```ts
   new CoverageTallyError({ says: 'boundaries noted after painting began', },);
   ```
   */
  constructor({ says, }: { readonly says: string; },) {
    super(`the coverage tally cannot count: ${says}; the two readings of the coverage directory must see the same files`,);
    this.name = 'CoverageTallyError';
  }
}

/**
 Narrows one parsed range.

 @param value - candidate from parsed JSON

 @returns Whether it carries three finite numbers
 */
function isCoverageRange(value: unknown,): value is CoverageRange {
  return isJsonRecord(value,)
    && Number.isFinite(value['startOffset'],)
    && Number.isFinite(value['endOffset'],)
    && Number.isFinite(value['count'],);
}

/**
 Narrows one parsed function.

 @param value - candidate from parsed JSON

 @returns Whether it carries a name and at least its whole extent
 */
function isFunctionCoverage(value: unknown,): value is FunctionCoverage {
  return isJsonRecord(value,)
    && ((typeof value['functionName']) === 'string')
    && isJsonArray(value['ranges'],)
    && (value['ranges'].length > 0)
    && value['ranges'].every(isCoverageRange,);
}

/**
 Reads the bundle scripts out of one coverage file, leaving every other script
 (Node's own, the test runner's) unread.

 @param path - file read, for the refusal

 @param text - its contents

 @param bundleUrlPrefix - `file://` URL of the build directory with a trailing slash

 @returns Each bundle script the process loaded

 @throws CoverageFileError where the file or a bundle script in it does not
 read as V8 writes one

 @example
 ```ts
 const scripts = bundleScriptsOf({ path, text, bundleUrlPrefix: 'file:///pkg/dist/final/node/', },);
 ```
 */
export function bundleScriptsOf(
  {
    path,
    text,
    bundleUrlPrefix,
  }: {
    readonly path: string;
    readonly text: string;
    readonly bundleUrlPrefix: string;
  },
): readonly BundleScript[] {
  /**
   The file as JSON.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isJsonRecord(parsed,) || !isJsonArray(parsed['result'],))
    throw new CoverageFileError({
      path,
      says: 'it has no result list',
    },);
  return parsed['result'].flatMap(function bundleScript(script,): readonly BundleScript[] {
    if (!isJsonRecord(script,) || ((typeof script['url']) !== 'string'))
      throw new CoverageFileError({
        path,
        says: 'a script carries no url',
      },);
    /**
     Where the script was loaded from.
     */
    const url = String(script['url'],);
    if (!url.startsWith(bundleUrlPrefix,))
      return [];
    if (!isJsonArray(script['functions'],) || !script['functions'].every(isFunctionCoverage,))
      throw new CoverageFileError({
        path,
        says: `${url} carries a function that is not a name with ranges`,
      },);
    return [{
      bundle: url.slice(bundleUrlPrefix.length,),
      functions: script['functions'],
    },];
  },);
}

/**
 One bundle cut at every boundary any process reported, with each piece's
 count summed over processes so far.
 */
type BundlePieces = {
  /**
   Every boundary, ascending; piece `i` runs from `offsets[i]` to `offsets[i + 1]`.
   */
  readonly offsets: readonly number[];

  /**
   Position of each boundary in `offsets`.
   */
  readonly indexOf: ReadonlyMap<number, number>;

  /**
   Summed count per piece.
   */
  readonly total: Float64Array;

  /**
   1 where some process had a range over the piece.
   */
  readonly covered: Uint8Array;
};

/**
 Where a function sits and what V8 called it.
 */
type FunctionSite = {
  /**
   Bundle holding it.
   */
  readonly bundle: string;

  /**
   Its first offset.
   */
  readonly start: number;

  /**
   One past its last offset.
   */
  readonly end: number;

  /**
   Name V8 gave it.
   */
  readonly name: string;
};

/**
 A stretch of bundle code no process ran, either a whole function or the
 blocks inside one that ran.

 @example
 ```ts
 const stretch: ColdStretch = { bundle: 'index.mjs', start: 10, end: 20, shape: { kind: 'block', }, };
 ```
 */
export type ColdStretch = {
  /**
   Bundle holding it.
   */
  readonly bundle: string;

  /**
   Its first offset.
   */
  readonly start: number;

  /**
   One past its last offset.
   */
  readonly end: number;

  /**
   A whole function no process called, with its name, or code inside one.
   */
  readonly shape: { readonly kind: 'block'; } | {
    readonly kind: 'function';
    readonly name: string;
  };
};

/**
 A function no process called.

 @example
 ```ts
 const uncalled: UncalledFunction = { bundle: 'index.mjs', start: 10, end: 20, name: 'nap', nested: false, };
 ```
 */
export type UncalledFunction = FunctionSite & {
  /**
   Whether it sits inside another function no process called, so fixing the
   outer one reaches it.
   */
  readonly nested: boolean;
};

/**
 Key of one function in one bundle, by both ends.

 @param site - function's place

 @returns Key unique within the tally
 */
function functionKey(site: Pick<FunctionSite, 'bundle' | 'end' | 'start'>,): string {
  return `${site.bundle}|${String(site.start,)}|${String(site.end,)}`;
}

/**
 Orders ranges so an enclosing range paints before anything inside it.

 @param left - one range

 @param right - another

 @returns Negative when `left` paints first
 */
function outerFirst(left: CoverageRange, right: CoverageRange,): number {
  return (left.startOffset - right.startOffset) || (right.endOffset - left.endOffset);
}

/**
 Merges one bundle's cold pieces into stretches.

 @param bundle - bundle name

 @param pieces - its pieces after every process painted

 @param calls - summed call count per function key

 @param sites - function per key

 @returns Its cold stretches in bundle order
 */
function stretchesOf(
  {
    bundle,
    pieces,
    calls,
    sites,
  }: {
    readonly bundle: string;
    readonly pieces: BundlePieces;
    readonly calls: ReadonlyMap<string, number>;
    readonly sites: ReadonlyMap<string, FunctionSite>;
  },
): readonly ColdStretch[] {
  /**
   Stretches found so far.
   */
  const stretches: ColdStretch[] = [];
  /**
   Whether piece `index` is code some process loaded and none ran.
   */
  const cold = (index: number,): boolean => (pieces.covered[index] === 1) && (pieces.total[index] === 0);
  /**
   Last piece: `offsets` holds one more boundary than there are pieces.
   */
  const pieceCount = pieces.offsets.length - 1;
  for (let piece = 0; piece < pieceCount; piece += 1) {
    if (!cold(piece,))
      continue;
    /**
     Last cold piece of this stretch.
     */
    let last = piece;
    while (((last + 1) < pieceCount) && cold(last + 1,))
      last += 1;
    /**
     The stretch's offsets.
     */
    const start = pieces.offsets[piece] ?? 0;
    /**
     One past its last character.
     */
    const end = pieces.offsets[last + 1] ?? start;
    /**
     The function with exactly these ends, if any.
     */
    const key = functionKey({
      bundle,
      start,
      end,
    },);
    /**
     That function, when it is one no process called.
     */
    const whole = (calls.get(key,) === 0) ? sites.get(key,) : undefined;
    stretches.push({
      bundle,
      start,
      end,
      shape: (whole === undefined) ? { kind: 'block', } : {
        kind: 'function',
        name: whole.name,
      },
    },);
    piece = last;
  }
  return stretches;
}

/**
 Counts which bundle code the unit suite ran, over every process's coverage
 file, read twice.

 @example
 ```ts
 const tally = new CoverageTally();
 for (const scripts of readings) tally.noteBoundaries({ scripts, },);
 for (const scripts of readings) tally.paint({ scripts, },);
 const cold = tally.coldStretches();
 ```
 */
export class CoverageTally {
  /**
   Every boundary noted per bundle during the first reading.
   */
  readonly #boundaries = new Map<string, Set<number>>();

  /**
   Pieces per bundle, cut when painting begins.
   */
  readonly #pieces = new Map<string, BundlePieces>();

  /**
   Summed call count per function key.
   */
  readonly #calls = new Map<string, number>();

  /**
   Each function by key.
   */
  readonly #sites = new Map<string, FunctionSite>();

  /**
   Notes every boundary one process reported.

   @param scripts - bundle scripts of one coverage file

   @throws CoverageTallyError once painting has begun, since pieces cut
   before a boundary was noted would count across it

   @example
   ```ts
   tally.noteBoundaries({ scripts, },);
   ```
   */
  noteBoundaries({ scripts, }: { readonly scripts: readonly BundleScript[]; },): void {
    if (this.#pieces.size > 0)
      throw new CoverageTallyError({ says: 'a boundary was noted after painting began', },);
    for (const script of scripts) {
      /**
       Boundaries of this bundle so far.
       */
      const held = this.#boundaries.get(script.bundle,) ?? new Set<number>();
      for (const fn of script.functions) {
        for (const range of fn.ranges) {
          held.add(range.startOffset,);
          held.add(range.endOffset,);
        }
      }
      this.#boundaries.set(script.bundle, held,);
    }
  }

  /**
   Cuts every bundle at its noted boundaries, once.
   */
  #cut(): void {
    if (this.#pieces.size > 0)
      return;
    for (const [bundle, held,] of this.#boundaries) {
      /**
       Its boundaries ascending.
       */
      const offsets = [...held,].toSorted((left, right,) => left - right);
      this.#pieces.set(bundle, {
        offsets,
        indexOf: new Map(offsets.map((offset, index,) => [offset, index,] as const),),
        total: new Float64Array(offsets.length,),
        covered: new Uint8Array(offsets.length,),
      },);
    }
  }

  /**
   Adds one process's counts: each piece takes the count of its innermost
   enclosing range, then joins the sum.

   @param scripts - bundle scripts of one coverage file, as the first reading saw them

   @throws CoverageTallyError where a bundle or a boundary was not noted in
   the first reading

   @example
   ```ts
   tally.paint({ scripts, },);
   ```
   */
  paint({ scripts, }: { readonly scripts: readonly BundleScript[]; },): void {
    this.#cut();
    for (const script of scripts) {
      /**
       The bundle's pieces.
       */
      const pieces = this.#pieces.get(script.bundle,);
      if (pieces === undefined)
        throw new CoverageTallyError({ says: `${script.bundle} was not in the first reading`, },);
      /**
       This process's count per piece.
       */
      const painted = new Float64Array(pieces.offsets.length,);
      /**
       Position of a boundary the first reading noted.
       */
      const indexOf = (offset: number,): number => {
        /**
         Its position.
         */
        const index = pieces.indexOf.get(offset,);
        if (index === undefined)
          throw new CoverageTallyError({ says: `${script.bundle} offset ${String(offset,)} was not in the first reading`, },);
        return index;
      };
      for (const range of script.functions.flatMap((fn,) => fn.ranges).toSorted(outerFirst,)) {
        painted.fill(range.count, indexOf(range.startOffset,), indexOf(range.endOffset,),);
        pieces.covered.fill(1, indexOf(range.startOffset,), indexOf(range.endOffset,),);
      }
      for (let piece = 0; piece < painted.length; piece += 1)
        pieces.total[piece] = (pieces.total[piece] ?? 0) + (painted[piece] ?? 0);
      for (const fn of script.functions) {
        /**
         Its whole extent; a function V8 reports always has one.
         */
        const [whole,] = fn.ranges;
        if (whole === undefined)
          continue;
        /**
         Where it sits.
         */
        const site: FunctionSite = {
          bundle: script.bundle,
          start: whole.startOffset,
          end: whole.endOffset,
          name: fn.functionName,
        };
        /**
         Its key.
         */
        const key = functionKey(site,);
        this.#sites.set(key, site,);
        this.#calls.set(key, (this.#calls.get(key,) ?? 0) + whole.count,);
      }
    }
  }

  /**
   Every stretch of loaded bundle code no process ran, adjacent cold pieces
   merged, so a block inside a cold block reads as the outer one.

   @returns Stretches by bundle name, then offset

   @example
   ```ts
   const cold = tally.coldStretches();
   ```
   */
  coldStretches(): readonly ColdStretch[] {
    return [...this.#pieces,]
      .toSorted(([left,], [right,],) => left.localeCompare(right,))
      .flatMap(([bundle, pieces,],) =>
        stretchesOf({
          bundle,
          pieces,
          calls: this.#calls,
          sites: this.#sites,
        },)
      );
  }

  /**
   Every function no process called, each marked when it sits inside another
   such function.

   @returns Functions by bundle name, then offset

   @example
   ```ts
   const uncalled = tally.uncalledFunctions();
   ```
   */
  uncalledFunctions(): readonly UncalledFunction[] {
    /**
     Uncalled functions, enclosing ones first.
     */
    const uncalled = [...this.#sites,]
      .filter(([key,],) => this.#calls.get(key,) === 0)
      .map(([, site,],) => site)
      .toSorted((left, right,) =>
        left.bundle.localeCompare(right.bundle,) || (left.start - right.start) || (right.end - left.end)
      );
    /**
     End of the outermost uncalled function open in the current bundle.
     */
    let outer = {
      bundle: '',
      end: -1,
    };
    return uncalled.map((site,) => {
      /**
       Whether the open outer function holds this one.
       */
      const nested = (site.bundle === outer.bundle) && (site.end <= outer.end);
      if (!nested)
        outer = {
          bundle: site.bundle,
          end: site.end,
        };
      return {
        ...site,
        nested,
      };
    },);
  }

  /**
   Bundles some process loaded.

   @returns Their names, sorted

   @example
   ```ts
   const loaded = tally.loadedBundles();
   ```
   */
  loadedBundles(): readonly string[] {
    return [...this.#boundaries.keys(),].toSorted();
  }
}

//endregion Coverage tally
