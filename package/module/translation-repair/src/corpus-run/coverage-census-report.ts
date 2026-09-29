import type {
  MappedFunction,
  MappedStretch,
} from './coverage-lines.ts';

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
 Records a mapped stretch by the source lines it covers: from its first
 character's line to its last's when both sit in one source, else its first
 character's line alone.

 @param stretch - stretch with the lines of both ends

 @returns The census record

 @example
 ```ts
 const recorded = censusStretchOf({ stretch, },);
 ```
 */
export function censusStretchOf({ stretch, }: { readonly stretch: MappedStretch; },): CensusStretch {
  /**
   Uncalled function name, when the stretch is exactly one.
   */
  const name = (stretch.shape
    .kind
    === 'function') ? stretch.shape
      .name : '';
  if (stretch.from
    .kind
    === 'unmapped')
    return {
      bundle: stretch.bundle,
      start: stretch.start,
      end: stretch.end,
      name,
      source: `(unmapped) ${stretch.bundle}`,
      startLine: 0,
      endLine: 0,
    };
  /**
   Last line, when the stretch ends in the source it starts in.
   */
  const endLine = ((stretch.to
    .kind
    === 'mapped') && (stretch.to
      .source
      === stretch.from
      .source))
    ? Math.max(
      stretch.from
        .line,
      stretch.to
        .line,
    )
    : stretch.from
      .line;
  return {
    bundle: stretch.bundle,
    start: stretch.start,
    end: stretch.end,
    name,
    source: stretch.from
      .source,
    startLine: stretch.from
      .line,
    endLine,
  };
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

//endregion Coverage census report
