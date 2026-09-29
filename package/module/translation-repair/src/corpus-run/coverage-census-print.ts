import type {
  CensusStretch,
  KindTotal,
  SourceKind,
  SourceRow,
  StretchStatus,
} from './coverage-census-report.ts';
import type { MappedFunction, } from './coverage-lines.ts';

//region Coverage census print
// Ledger T8: the census's report as lines, apart from the entry that runs the
// suite, so what an operator reads is tested without a subprocess. Every line
// names package files, lines, bundle names and counts; no corpus text reaches
// a coverage report.

/**
 A source a runner bundle carries that no test loaded.

 @example
 ```ts
 const unloaded: UnloadedSource = { source: 'src/corpus-run/corpus-pass.ts', kind: 'entry file', lines: 400, };
 ```
 */
export type UnloadedSource = {
  /**
   Source file relative to the package.
   */
  readonly source: string;

  /**
   Where it sits.
   */
  readonly kind: SourceKind;

  /**
   Its physical lines.
   */
  readonly lines: number;
};

/**
 What the census found, ready to print.

 @example
 ```ts
 const lines = censusReportLines({ census, },);
 ```
 */
export type CensusSummary = {
  /**
   Commit the build was made from.
   */
  readonly head: string;

  /**
   Whether the package's files matched that commit.
   */
  readonly clean: boolean;

  /**
   Test files asked for, empty for the whole unit suite.
   */
  readonly testFiles: readonly string[];

  /**
   `[PASS]` markers the suite printed.
   */
  readonly passes: number;

  /**
   Totals per kind.
   */
  readonly totals: readonly KindTotal[];

  /**
   One row per source holding cold code.
   */
  readonly rows: readonly SourceRow[];

  /**
   Uncalled functions with their lines.
   */
  readonly uncalled: readonly MappedFunction[];

  /**
   Bundles no test process loaded.
   */
  readonly unloadedBundles: readonly string[];

  /**
   Sources only those bundles carry.
   */
  readonly unloadedSources: readonly UnloadedSource[];

  /**
   Where the census file was written.
   */
  readonly censusPath: string;
};

/**
 The report an operator reads after a census.

 @param census - what the census found

 @returns Lines to print, in order

 @example
 ```ts
 for (const line of censusReportLines({ census, },)) console.log(line,);
 ```
 */
export function censusReportLines({ census, }: { readonly census: CensusSummary; },): readonly string[] {
  /**
   Which tests ran.
   */
  const scope = (census.testFiles
    .length
    === 0) ? 'the unit suite' : `${String(census.testFiles
      .length,)} test files`;
  /**
   Uncalled functions in package source that no uncalled function holds.
   */
  const outermost = census.uncalled
    .flatMap(function outermostInPackage(fn,): readonly {
      readonly source: string;
      readonly line: number;
      readonly name: string;
    }[] {
      if (fn.nested || (fn.at
        .kind
        === 'unmapped')
        || (!fn.at
          .source
          .startsWith('src/',)))
        return [];
      return [{
        source: fn.at
          .source,
        line: fn.at
          .line,
        name: (fn.name === '') ? '(anonymous)' : fn.name,
      },];
    },)
    .toSorted(function bySourceThenLine(
      left,
      right,
    ): number {
      return left.source
        .localeCompare(right.source,)
        || (left.line - right.line);
    },)
    .map(function placed(fn,): string {
      return `  ${fn.source}:${String(fn.line,)} ${fn.name}`;
    },);
  /**
   Physical lines the unloaded sources hold.
   */
  const unloadedLines = census.unloadedSources
    .reduce(
      function sum(
        total,
        unloaded,
      ): number {
    return total + unloaded.lines;
  },
      0,
    );
  return [
    `coverage-census at ${census.head}${census.clean ? '' : ' with uncommitted changes'}: ${scope}, ${String(census.passes,)} passes`,
    ...census.totals
      .map(function totalLine(total,): string {
      return `${total.kind}: ${String(total.files,)} files, ${String(total.stretches,)} stretches over ${String(total.lines,)} lines, `
        + `${String(total.uncalled,)} functions never called`;
    },),
    `bundles no test loaded: ${String(census.unloadedBundles
      .length,)}, carrying ${String(census.unloadedSources
        .length,)} sources `
    + `and ${String(unloadedLines,)} physical lines`,
    ...census.unloadedSources
      .filter(function isLibrary(unloaded,): boolean {
        return unloaded.kind === 'library source';
      },)
      .map(function unloadedLine(unloaded,): string {
        return `  library source only those bundles carry: ${unloaded.source}`;
      },),
    'library source by cold lines:',
    ...census.rows
      .filter(function isLibrary(row,): boolean {
        return row.kind === 'library source';
      },)
      .map(function rowLine(row,): string {
        return `  ${row.source}: ${String(row.stretches,)} stretches, ${String(row.lines,)} lines, ${String(row.uncalled,)} never called`;
      },),
    'functions never called in package source, outermost:',
    ...outermost,
    `census written to ${census.censusPath}`,
  ];
}

/**
 The report of a batch read against an earlier census.

 @param path - earlier census read

 @param statuses - each of its stretches in the claimed sources with its status

 @returns Lines to print, in order: counts, then every stretch not proven run

 @example
 ```ts
 for (const line of baselineReportLines({ path, statuses, },)) console.log(line,);
 ```
 */
export function baselineReportLines(
  {
    path,
    statuses,
  }: {
    readonly path: string;
    readonly statuses: readonly {
      readonly stretch: CensusStretch;
      readonly status: StretchStatus;
    }[];
  },
): readonly string[] {
  /**
   How many stretches read as one status.

   @param status - status counted

   @returns Stretches reading as it
   */
  function countOf(status: StretchStatus,): number {
    return statuses.filter(function hasStatus(read,): boolean {
      return read.status === status;
    },)
      .length;
  }
  return [
    `against ${path}: ran ${String(countOf('ran',),)}, still cold ${String(countOf('still cold',),)}, `
    + `not loaded ${String(countOf('not loaded',),)}`,
    ...statuses
      .filter(function unproven(read,): boolean {
        return read.status !== 'ran';
      },)
      .map(function unprovenLine(read,): string {
        return `  ${read.status}: ${read.stretch
          .source}:${String(read.stretch
            .startLine,)}-${String(read.stretch
              .endLine,)}`;
      },),
  ];
}

//endregion Coverage census print
