import { StatedRefusalError, } from '../stated-refusal.ts';
import type { MappedFunction, } from './coverage-lines.ts';
import type { MappedStretch, } from './coverage-pieces.ts';

//region Coverage census report
// Ledger T8: what the census says about the unit suite, from the cold
// stretches and uncalled functions mapped to source lines. It splits the
// package's library source from the runner entry files the build names (their
// bodies are command-line mains) and from other workspace packages built into
// the bundles, and it compares a run against an earlier census so a batch of
// tests can prove it reached the stretches it claims.

/**
 Where a source sits for the census.

 @example
 ```ts
 const kind: SourceKind = 'library source';
 ```
 */
export type SourceKind = 'entry file' | 'library source' | 'other package' | 'unmapped';

/**
 A cold stretch as the census records it: bundle offsets and the source lines
 they cover.

 @example
 ```ts
 const stretch: CensusStretch = { bundle: 'index.mjs', start: 10, end: 20, name: '', source: 'src/nap.ts', startLine: 4, endLine: 6, };
 ```
 */
export type CensusStretch = {
  /**
   Bundle holding it.
   */
  readonly bundle: string;

  /**
   Its first bundle offset.
   */
  readonly start: number;

  /**
   One past its last.
   */
  readonly end: number;

  /**
   Name of the uncalled function it is exactly, empty for code inside a
   function that ran or an anonymous one.
   */
  readonly name: string;

  /**
   Source file relative to the package, or `(unmapped) <bundle>`.
   */
  readonly source: string;

  /**
   First source line it covers, 0 when unmapped.
   */
  readonly startLine: number;

  /**
   Last source line it covers.
   */
  readonly endLine: number;
};

/**
 One source file's cold code.

 @example
 ```ts
 const row: SourceRow = { source: 'src/nap.ts', kind: 'library source', stretches: 2, lines: 5, uncalled: 1, };
 ```
 */
export type SourceRow = {
  /**
   Source file relative to the package.
   */
  readonly source: string;

  /**
   Where it sits.
   */
  readonly kind: SourceKind;

  /**
   Cold stretches in it.
   */
  readonly stretches: number;

  /**
   Distinct source lines they cover.
   */
  readonly lines: number;

  /**
   Uncalled functions starting in it.
   */
  readonly uncalled: number;
};

/**
 One kind's totals.

 @example
 ```ts
 const total: KindTotal = { kind: 'library source', files: 1, stretches: 2, lines: 5, uncalled: 1, };
 ```
 */
export type KindTotal = Omit<SourceRow, 'source'> & {
  /**
   Source files of this kind holding cold code.
   */
  readonly files: number;
};

/**
 What a baseline stretch reads as in a later run.

 @example
 ```ts
 const status: StretchStatus = 'ran';
 ```
 */
export type StretchStatus = 'not loaded' | 'ran' | 'still cold';

/**
 What a batch reads of an earlier census.

 @example
 ```ts
 const baseline: BaselineCensus = { stretches: [], loadedSources: new Set(['src/nap.ts',],), };
 ```
 */
export type BaselineCensus = {
  /**
   Its stretches.
   */
  readonly stretches: readonly CensusStretch[];

  /**
   Sources its loaded bundles carried, which tell a claimed source holding no
   stretch because the baseline ran all of it from one holding none because
   the baseline never loaded it.
   */
  readonly loadedSources: ReadonlySet<string>;
};

/**
 A claimed source the baseline holds no stretch in, with both censuses'
 standing for it.

 @example
 ```ts
 const claim: EmptyClaim = { source: 'src/nap.ts', loadedAtBaseline: false, loadedNow: true, coldNow: 0, };
 ```
 */
export type EmptyClaim = {
  /**
   Source claimed.
   */
  readonly source: string;

  /**
   Whether a bundle the baseline loaded carried it; when none did, the
   baseline proves nothing of it and this run's standing is the only reading.
   */
  readonly loadedAtBaseline: boolean;

  /**
   Whether a bundle this run loaded carried it.
   */
  readonly loadedNow: boolean;

  /**
   Cold stretches this run left in it.
   */
  readonly coldNow: number;
};

/**
 Records a mapped stretch as one census stretch per piece, each over the
 source lines its characters map to (ledger M67: one record per stretch put
 every source after the first out of the census).

 @param stretch - stretch split into its pieces

 @returns The census records, in bundle order

 @example
 ```ts
 const recorded = censusStretchesOf({ stretch, },);
 ```
 */
export function censusStretchesOf({ stretch, }: { readonly stretch: MappedStretch; },): readonly CensusStretch[] {
  /**
   Uncalled function name, when the stretch is exactly one; it starts in the
   first piece.
   */
  const name = (stretch.shape
    .kind
    === 'function') ? stretch.shape
      .name : '';
  return stretch.pieces
    .map(function recordOf(
      piece,
      index,
    ): CensusStretch {
      /**
       The fields every record carries.
       */
      const placed = {
        bundle: stretch.bundle,
        start: piece.start,
        end: piece.end,
        name: (index === 0) ? name : '',
      };
      if (piece.span
        .kind
        === 'unmapped') {
        return {
          ...placed,
          source: `(unmapped) ${stretch.bundle}`,
          startLine: 0,
          endLine: 0,
        };
      }
      return {
        ...placed,
        source: piece.span
          .source,
        startLine: piece.span
          .firstLine,
        endLine: piece.span
          .lastLine,
      };
    },);
}

/**
 How many misplaced functions the refusal names; the count names the rest.
 */
const MISPLACED_NAMED = 5;

/**
 Refuses a census that places an uncalled function in no cold stretch of its
 own source. An uncalled function is cold throughout, so its first line must
 sit in one; one that does not names cold code the census recorded under
 another source, which is how ledger M67 hid `src/repair-chunk.ts`.

 @param stretches - census stretches

 @param uncalled - uncalled functions with their lines

 @throws StatedRefusalError naming up to five functions left uncovered

 @example
 ```ts
 requirePlacedFunctions({ stretches, uncalled, },);
 ```
 */
export function requirePlacedFunctions(
  {
    stretches,
    uncalled,
  }: {
    readonly stretches: readonly CensusStretch[];
    readonly uncalled: readonly MappedFunction[];
  },
): void {
  /**
   Uncalled functions no stretch of their own source covers.
   */
  const misplaced = uncalled.filter(function uncovered(fn,): boolean {
    /**
     Source and line the function starts on, as the census records them.
     */
    const {
      source,
      line,
    } = (fn.at
      .kind
      === 'mapped')
      ? fn.at
      : {
        source: `(unmapped) ${fn.bundle}`,
        line: 0,
      };
    return !stretches.some(function covers(stretch,): boolean {
      return (stretch.bundle === fn.bundle)
        && (stretch.source === source)
        && (stretch.startLine <= line)
        && (stretch.endLine >= line);
    },);
  },);
  if (misplaced.length === 0)
    return;
  /**
   The first few named by bundle, offset and name.
   */
  const named = misplaced
    .slice(
      0,
      MISPLACED_NAMED,
    )
    .map(function nameOf(fn,): string {
      return `${fn.bundle}:${String(fn.start,)} ${fn.name}`;
    },)
    .join(', ',);
  throw new StatedRefusalError({
    says: `the census places ${String(misplaced.length,)} uncalled functions in no cold stretch of their own source `
      + `(${named}); an uncalled function is cold throughout, so the mapping is wrong and no report is written`,
  },);
}

/**
 Says where a source sits.

 @param source - source relative to the package, or `(unmapped) <bundle>`

 @param entryFiles - sources the build names as runner entries

 @returns Its kind

 @example
 ```ts
 sourceKindOf({ source: 'src/nap.ts', entryFiles: new Set(), },); // 'library source'
 ```
 */
export function sourceKindOf(
  {
    source,
    entryFiles,
  }: {
    readonly source: string;
    readonly entryFiles: ReadonlySet<string>;
  },
): SourceKind {
  if (source.startsWith('(unmapped) ',))
    return 'unmapped';
  if (!source.startsWith('src/',))
    return 'other package';
  return entryFiles.has(source,) ? 'entry file' : 'library source';
}

/**
 One row per source holding cold code, most cold lines first.

 @param stretches - census stretches

 @param uncalled - uncalled functions with their lines

 @param entryFiles - sources the build names as runner entries

 @returns Rows, ties by source name

 @example
 ```ts
 const rows = sourceRowsOf({ stretches, uncalled, entryFiles, },);
 ```
 */
export function sourceRowsOf(
  {
    stretches,
    uncalled,
    entryFiles,
  }: {
    readonly stretches: readonly CensusStretch[];
    readonly uncalled: readonly MappedFunction[];
    readonly entryFiles: ReadonlySet<string>;
  },
): readonly SourceRow[] {
  /**
   Every source holding a stretch.
   */
  const sources = [...new Set(stretches.map(function sourceOf(stretch,): string {
    return stretch.source;
  },),),];
  return sources
    .map(function rowOf(source,): SourceRow {
      /**
       Its stretches.
       */
      const own = stretches.filter(function inSource(stretch,): boolean {
        return stretch.source === source;
      },);
      /**
       Distinct lines they cover.
       */
      const lines = new Set(own.flatMap(function linesOf(stretch,): readonly number[] {
        return Array.from(
          { length: (stretch.endLine - stretch.startLine) + 1, },
          function lineAt(
            _unused,
            index,
          ): number {
            return stretch.startLine + index;
          },
        );
      },),);
      return {
        source,
        kind: sourceKindOf({
          source,
          entryFiles,
        },),
        stretches: own.length,
        lines: lines.size,
        uncalled: uncalled.filter(function startsIn(fn,): boolean {
          return (fn.at
            .kind
            === 'mapped') && (fn.at
              .source
              === source);
        },)
          .length,
      };
    },)
    .toSorted(function mostLinesFirst(
      left,
      right,
    ): number {
      return (right.lines - left.lines)
        || left.source
        .localeCompare(right.source,);
    },);
}

/**
 Totals per kind, in a fixed order.

 @param rows - source rows

 @returns One total per kind holding any row

 @example
 ```ts
 const totals = kindTotalsOf({ rows, },);
 ```
 */
export function kindTotalsOf({ rows, }: { readonly rows: readonly SourceRow[]; },): readonly KindTotal[] {
  /**
   Kinds in report order.
   */
  const kinds: readonly SourceKind[] = [
    'library source',
    'entry file',
    'other package',
    'unmapped',
  ];
  return kinds.flatMap(function totalOf(kind,): readonly KindTotal[] {
    /**
     Rows of this kind.
     */
    const own = rows.filter(function ofKind(row,): boolean {
      return row.kind === kind;
    },);
    if (own.length === 0)
      return [];
    return [{
      kind,
      files: own.length,
      stretches: own.reduce(
        function sum(
          total,
          row,
        ): number {
        return total + row.stretches;
      },
        0,
      ),
      lines: own.reduce(
        function sum(
          total,
          row,
        ): number {
        return total + row.lines;
      },
        0,
      ),
      uncalled: own.reduce(
        function sum(
          total,
          row,
        ): number {
        return total + row.uncalled;
      },
        0,
      ),
    },];
  },);
}

/**
 Reads each baseline stretch in the named sources against a later run.

 A stretch STILL COLD overlaps a cold stretch of the later run in the same
 source; one NOT LOADED sits in a source no bundle of the later run carried,
 which proves nothing either way; the rest RAN. Lines are compared, not
 offsets, so a batch that edits a source it claims shifts its lines and is
 read against a fresh census instead.

 @param baseline - stretches of the earlier census

 @param current - stretches of the later run

 @param loadedSources - sources the later run's loaded bundles carry

 @param sources - sources the batch claims, empty for every source

 @returns Each baseline stretch in those sources with its status

 @example
 ```ts
 const read = baselineStatusesOf({ baseline, current, loadedSources, sources: new Set(['src/nap.ts',],), },);
 ```
 */
export function baselineStatusesOf(
  {
    baseline,
    current,
    loadedSources,
    sources,
  }: {
    readonly baseline: readonly CensusStretch[];
    readonly current: readonly CensusStretch[];
    readonly loadedSources: ReadonlySet<string>;
    readonly sources: ReadonlySet<string>;
  },
): readonly {
  readonly stretch: CensusStretch;
  readonly status: StretchStatus;
}[] {
  return baseline
    .filter(function claimed(stretch,): boolean {
      return (sources.size === 0) || sources.has(stretch.source,);
    },)
    .map(function statusOf(stretch,) {
      if (!loadedSources.has(stretch.source,))
        return {
          stretch,
          status: 'not loaded',
        } as const;
      /**
       Whether a later cold stretch in the same source shares a line with it.
       */
      const overlapped = current.some(function overlaps(later,): boolean {
        return (later.source === stretch.source)
          && (later.startLine <= stretch.endLine)
          && (later.endLine >= stretch.startLine);
      },);
      return {
        stretch,
        status: overlapped ? 'still cold' : 'ran',
      } as const;
    },);
}

/**
 Names each claimed source the baseline holds no stretch in, which the
 stretch statuses count nowhere: the baseline either ran all of it or never
 loaded it (a source only an unloaded bundle carried), and in the second case
 only this run's standing speaks for it. The placement batch of ledger T8
 read `ran 0, still cold 0, not loaded 0` for a source its baseline never
 loaded, which reads as nothing left to do.

 @param baseline - earlier census read

 @param current - stretches of this run

 @param loadedSources - sources this run's loaded bundles carry

 @param sources - sources the batch claims, empty for every source

 @returns Each such claimed source, sorted, with both censuses' standing

 @example
 ```ts
 const claims = emptyClaimsOf({ baseline, current, loadedSources, sources: new Set(['src/nap.ts',],), },);
 ```
 */
export function emptyClaimsOf(
  {
    baseline,
    current,
    loadedSources,
    sources,
  }: {
    readonly baseline: BaselineCensus;
    readonly current: readonly CensusStretch[];
    readonly loadedSources: ReadonlySet<string>;
    readonly sources: ReadonlySet<string>;
  },
): readonly EmptyClaim[] {
  /**
   The baseline's stretches, and the sources its loaded bundles carried.
   */
  const {
    stretches: baselineStretches,
    loadedSources: loadedAtBaseline,
  } = baseline;
  /**
   Sources holding a baseline stretch.
   */
  const stretched = new Set(baselineStretches.map(function sourceOf(stretch,): string {
    return stretch.source;
  },),);
  return [...sources,]
    .filter(function holdsNone(source,): boolean {
      return !stretched.has(source,);
    },)
    .toSorted()
    .map(function standing(source,): EmptyClaim {
      return {
        source,
        loadedAtBaseline: loadedAtBaseline.has(source,),
        loadedNow: loadedSources.has(source,),
        coldNow: current.filter(function inSource(stretch,): boolean {
          return stretch.source === source;
        },)
          .length,
      };
    },);
}

//endregion Coverage census report
