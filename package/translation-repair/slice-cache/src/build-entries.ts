//region Build entries
// Every RUNNER is a build entry, not just the library index.
//
// The tasks used to invoke `node src/corpus-run/<name>.ts` directly, so what
// executed was loose source while the tests imported the built bundle. That
// split is what made "which pipeline produced this artifact" hard to answer at
// all: there was no single artifact to point at, only a transitive closure of
// source files that had to be reconstructed to be identified.
//
// Building the runners makes the executed thing a FILE. Identity, staleness and
// reproducibility all become questions about `dist/final/node` rather than
// about an import graph.
//
// KEPT IN SOURCE rather than in the build config because two readers need it:
// the normal build and the coverage build (`rolldown.node.config.ts`,
// `rolldown.coverage.config.ts`), and the coverage census, which tells a
// runner's command-line main from library source by this list (ledger T8).

/**
 Named entries of the normal build and the coverage build, each a path from
 the package directory. A map, as every table keyed by a name is (ledger
 B77); the build configs hand rolldown its entries as an object.

 @example
 ```ts
 const runner = nodeEntries.get('coverage-census',); // './src/corpus-run/coverage-census.ts'
 ```
 */
export const nodeEntries: ReadonlyMap<string, string> = new Map([
  [
    'index',
    './src/index.ts',
  ],
  [
    'cache-account-audit',
    './src/corpus-run/cache-account-audit.ts',
  ],
  [
    'slice-census',
    './src/corpus-run/slice-census.ts',
  ],
  [
    'slice-cost-report',
    './src/corpus-run/slice-cost-report.ts',
  ],
],);

/**
 Source files of the runner entries, as the census names sources: from the
 package directory, with no leading `./`. The library index is left out,
 since what it reaches is library source. Every entry is written from
 `./src/`, which `build-entries.unit.test.ts` holds the list to, so the prefix
 is cut without asking.

 @returns Runner entry sources

 @example
 ```ts
 runnerEntrySources().has('src/corpus-run/corpus-pass.ts',); // true
 ```
 */
export function runnerEntrySources(): ReadonlySet<string> {
  return new Set(
    [...nodeEntries,]
      .filter(function isRunner([name,],): boolean {
        return name !== 'index';
      },)
      .map(function sourceOf([, path,],): string {
        return path.slice('./'.length,);
      },),
  );
}

//endregion Build entries
