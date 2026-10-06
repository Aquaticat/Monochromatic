/**
 Holds the package to the production modules found with no unit test of
 their own (ledger B102). A module added without `<stem>.unit.test.ts`
 beside it fails this scan until it gets one or a reviewed `ALLOWLIST` line,
 and a listed module that gains one, turns out exempt, or is removed fails
 it until its line goes, so the list only shrinks.

 WHAT THE SCAN READS: every `.ts` file `readPackageSource` returns under
 `src`. A production module is any that is not `*.unit.test.ts`,
 `*.test-fixture.ts` or `*.scratch.ts`, and it has an own test when
 `<dir>/<stem>.unit.test.ts` is among the files.

 WHAT IT EXEMPTS, read off each module's own syntax tree, since none of
 these carries logic a test could lose:

 - a runner entry, one of the `'./src/...'` paths `src/build-entries.ts`
   lists, the library index left out: a program the corpus harness runs,
   not a library export a unit test calls;
 - a barrel, every top-level statement an import, an `export * from` or an
   export list with no inline declaration;
 - a types-only module, every top-level statement a type alias, an
   interface, an import, or a variable declaration whose every initialiser
   is absent or literal-like (a literal, a template with no expressions, a
   signed literal, an array or object of literal-like values, any of those
   under `as`, `satisfies`, `!` or parentheses).

 A bare export list is never types-only on its own, so a file mixing one
 with a declaration needs an `ALLOWLIST` line.

 OUT OF ITS REACH: whether a module's tests exercise every branch, which
 the coverage census measures; a module outside `src`; and a runner known
 only by a top-level `await` or a `process.argv` read, which shows here as
 a module to list rather than as a fourth exemption.

 THE FIXTURE CASE COMES FIRST, so the package case is read against a scan
 shown able to tell each shape apart and to find both failure kinds
 (ledger M21). Fixtures are cat-themed; the package case reads this
 package's own source.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isTreeNode,
  literalText,
  nodesUnder,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
} from './source-scan.test-fixture.ts';
import { expectRecordAsListed, } from './scan-findings.test-fixture.ts';

//region Own-test ratchet scan
// What a production module classifies as: own-tested, exempt by shape
// (runner, barrel, types-only), or needing a line on ALLOWLIST. The scan never decides WHICH test reaches a module,
// only whether `dir/stem.unit.test.ts` exists beside it and, when it does
// not, whether the module's own syntax rules it out of needing one.

/**
 Whether a file's path names a production module: not a unit test, not a
 shared test fixture, not a scratch file.

 @param path - file path, relative to `src`

 @returns Whether the path is production rather than test support

 @example
 ```ts
 const production = isProductionModulePath({ path: 'cited-reference.ts', },); // true
 ```
 */
function isProductionModulePath({ path, }: { readonly path: string; },): boolean {
  return !(path.endsWith('.unit.test.ts',)
    || path.endsWith('.test-fixture.ts',)
    || path.endsWith('.scratch.ts',));
}

/**
 Directory and stem (file name without its trailing `.ts`) a path splits
 into.

 @param path - file path, relative to `src`

 @returns Its directory, empty at the top of `src`, and its stem

 @example
 ```ts
 const split = dirAndStem({ path: 'corpus-run/bench-sample.ts', },); // { dir: 'corpus-run', stem: 'bench-sample', }
 ```
 */
function dirAndStem({ path, }: { readonly path: string; },): {
  readonly dir: string;
  readonly stem: string;
} {
  /**
   Index of the last path separator, absent at the top of `src`.
   */
  const slash = path.lastIndexOf('/',);
  /**
   File name alone, the directory cut away.
   */
  const fileName = (slash === (-1)) ? path : path.slice(slash + 1,);
  return {
    dir: (slash === (-1)) ? '' : path.slice(0, slash,),
    stem: fileName.endsWith('.ts',) ? fileName.slice(0, -'.ts'.length,) : fileName,
  };
}

/**
 Path a module's own unit test would sit at, beside it.

 @param path - module path, relative to `src`

 @returns The exact own-test path the scan looks for

 @example
 ```ts
 const own = ownTestPathFor({ path: 'corpus-run/bench-sample.ts', },); // 'corpus-run/bench-sample.unit.test.ts'
 ```
 */
function ownTestPathFor({ path, }: { readonly path: string; },): string {
  /**
   The module's directory and stem.
   */
  const { dir, stem, } = dirAndStem({ path, },);
  return (dir === '') ? `${stem}.unit.test.ts` : `${dir}/${stem}.unit.test.ts`;
}

/**
 A module's path as `ALLOWLIST` writes it: from the package root, `src`
 included.

 @param path - module path, relative to `src`

 @returns The path prefixed with `src/`

 @example
 ```ts
 const named = packagePath({ path: 'cited-reference.ts', },); // 'src/cited-reference.ts'
 ```
 */
function packagePath({ path, }: { readonly path: string; },): string {
  return `src/${path}`;
}

/**
 Opening every runner entry's source path carries in
 `src/build-entries.ts`.
 */
const ENTRY_SOURCE_OPENING = './src/';

/**
 Path of the file whose string literals name the runner entries, read off
 its parse: tests reach this package through its built bundle, never a
 relative import into `src`.
 */
const BUILD_ENTRIES_FILE_PATH = 'build-entries.ts';

/**
 The library index, which `nodeEntries` also holds but which names library
 source, not a runner the scan should exempt.
 */
const LIBRARY_INDEX_SOURCE = 'src/index.ts';

/**
 Runner entry sources `src/build-entries.ts` lists, read as text,
 package-rooted (`src/corpus-run/...`).

 @param files - files read; only one whose path is `build-entries.ts`
 matters, and its absence (the fixture case) yields no runner entries

 @returns Runner entry sources, the library index left out

 @example
 ```ts
 const runners = runnerEntrySourcePaths({ files, },);
 runners.has('src/corpus-run/corpus-pass.ts',); // true
 ```
 */
function runnerEntrySourcePaths({ files, }: { readonly files: readonly SourceText[]; },): ReadonlySet<string> {
  /**
   `src/build-entries.ts`, absent in a fixture with no such file.
   */
  const buildEntriesFile = files.find(function isBuildEntriesFile({ path, },): boolean {
    return path === BUILD_ENTRIES_FILE_PATH;
  },);
  if (buildEntriesFile === undefined)
    return new Set();
  return new Set(nodesUnder({ root: parseSource({ file: buildEntriesFile, },).program, },)
    .map(function textOf(node,): string {
      return literalText({ node, },);
    },)
    .filter(function isEntrySource(text,): boolean {
      return text.startsWith(ENTRY_SOURCE_OPENING,) && text.endsWith('.ts',);
    },)
    .map(function packageRooted(text,): string {
      return text.slice('./'.length,);
    },)
    .filter(function isRunnerSource(source,): boolean {
      return source !== LIBRARY_INDEX_SOURCE;
    },),);
}

/**
 Whether a top-level statement is barrel-shaped: an import, an
 `export * from`, or an export list with no inline declaration, type-only
 or not.

 @param statement - top-level statement read

 @returns Whether the statement alone would let its file be a barrel

 @example
 ```ts
 const barrelShaped = isBarrelStatement({ statement, },); // true for `export { x } from './y.ts';`
 ```
 */
function isBarrelStatement({ statement, }: { readonly statement: TreeNode; },): boolean {
  if (statement.type === 'ImportDeclaration')
    return true;
  if (statement.type === 'ExportAllDeclaration')
    return true;
  return (statement.type === 'ExportNamedDeclaration') && (!isTreeNode(statement.declaration,));
}

/**
 Whether every top-level statement of a module is barrel-shaped.

 @param module - module read

 @returns Whether the module is a barrel, vacuously true for an empty file

 @example
 ```ts
 const barrel = isBarrelModule({ module, },);
 ```
 */
function isBarrelModule({ module, }: { readonly module: SourceText; },): boolean {
  return topLevelStatementsOf({ module, },)
    .every(function each(statement,): boolean { return isBarrelStatement({ statement, },); },);
}

/**
 Top-level statements of a parsed module, non-node entries filtered out.

 @param module - module read

 @returns Its program's top-level statements

 @example
 ```ts
 const statements = topLevelStatementsOf({ module, },);
 ```
 */
function topLevelStatementsOf({ module, }: { readonly module: SourceText; },): readonly TreeNode[] {
  /**
   The module's parsed program.
   */
  const { program, } = parseSource({ file: module, },);
  /**
   Its top-level statement list, possibly absent on an unexpected program
   shape.
   */
  const body: unknown = program.body;
  return (Array.isArray(body,) ? body : []).filter(function isNode(node,): node is TreeNode {
    return isTreeNode(node,);
  },);
}

/**
 The declaration an `ExportNamedDeclaration` carries inline, or the
 statement itself for any other kind.

 @param statement - top-level statement read

 @returns The node whose kind the types-only check reads

 @example
 ```ts
 const declaration = declarationOf({ statement, },); // the `type Cat = ...` node under `export type Cat = ...;`
 ```
 */
function declarationOf({ statement, }: { readonly statement: TreeNode; },): TreeNode {
  /**
   The statement's inline declaration, absent on a bare export list or any
   other statement kind.
   */
  const { declaration, } = statement;
  return ((statement.type === 'ExportNamedDeclaration') && isTreeNode(declaration,)) ? declaration : statement;
}

/**
 Node kinds `isLiteralLikeExpression` unwraps without changing whether the
 value underneath is literal-like, `ChainExpression` left out since a
 literal is never optionally chained.
 */
const LITERAL_WRAPPER_KINDS: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'ParenthesizedExpression',
  'TSTypeAssertion',
],);

/**
 Whether an expression a `const` initialises with is literal-like, so the
 declaration carries no logic.

 @param node - initialiser expression read, absent for a bare `let x;`

 @returns Whether it is literal-like, true where there is no initialiser

 @example
 ```ts
 const literalLike = isLiteralLikeExpression({ node: declarator.init, },); // true for `{ tabby: 1, } as const`
 ```
 */
function isLiteralLikeExpression({ node, }: { readonly node: unknown; },): boolean {
  // No initialiser at all carries no logic.
  if (!isTreeNode(node,))
    return true;
  if (node.type === 'Literal')
    return true;
  if (node.type === 'TemplateLiteral') {
    /**
     Interpolated expressions the template holds, none for a plain string.
     */
    const expressions: unknown = node.expressions;
    return (Array.isArray(expressions,) ? expressions : []).length === 0;
  }
  if ((node.type === 'UnaryExpression') && ['-', '+',].includes(node.operator as string,))
    return isLiteralLikeExpression({ node: node.argument, },);
  if (node.type === 'ArrayExpression') {
    /**
     The array's elements, a hole read as `null`.
     */
    const elements: unknown = node.elements;
    return (Array.isArray(elements,) ? elements : [])
      .every(function each(element,): boolean {
        return (element === null) || isLiteralLikeExpression({ node: element, },);
      },);
  }
  if (node.type === 'ObjectExpression') {
    /**
     The object's properties, each a plain property or a spread.
     */
    const properties: unknown = node.properties;
    return (Array.isArray(properties,) ? properties : [])
      .every(function each(property,): boolean {
        return isTreeNode(property,)
          && ((property.type === 'SpreadElement')
            ? isLiteralLikeExpression({ node: property.argument, },)
            : isLiteralLikeExpression({ node: property.value, },));
      },);
  }
  return LITERAL_WRAPPER_KINDS.has(node.type,) && isLiteralLikeExpression({ node: node.expression, },);
}

/**
 Whether a top-level statement is types-only-shaped: a bare export list
 never qualifies on its own, so a file mixing one with a type declaration
 needs an `ALLOWLIST` line.

 @param statement - top-level statement read

 @returns Whether the statement alone would let its file be types-only

 @example
 ```ts
 const typesOnlyShaped = isTypesOnlyStatement({ statement, },); // true for `export const TABBY = 'tabby' as const;`
 ```
 */
function isTypesOnlyStatement({ statement, }: { readonly statement: TreeNode; },): boolean {
  /**
   The statement's inline declaration, or the statement itself.
   */
  const declaration = declarationOf({ statement, },);
  if (['TSTypeAliasDeclaration', 'TSInterfaceDeclaration',].includes(declaration.type,))
    return true;
  if (statement.type === 'ImportDeclaration')
    return true;
  if (declaration.type !== 'VariableDeclaration')
    return false;
  /**
   The declaration's individual declarators, each `const x = ...`.
   */
  const declarators: unknown = declaration.declarations;
  return (Array.isArray(declarators,) ? declarators : [])
    .every(function each(declarator,): boolean {
      return isTreeNode(declarator,) && isLiteralLikeExpression({ node: declarator.init, },);
    },);
}

/**
 Whether every top-level statement of a module is types-only-shaped.

 @param module - module read

 @returns Whether the module is types-only, vacuously true for an empty file

 @example
 ```ts
 const typesOnly = isTypesOnlyModule({ module, },);
 ```
 */
function isTypesOnlyModule({ module, }: { readonly module: SourceText; },): boolean {
  return topLevelStatementsOf({ module, },)
    .every(function each(statement,): boolean { return isTypesOnlyStatement({ statement, },); },);
}

/**
 Whether a production module without an own test is exempt by shape: a
 runner entry, a barrel, or types-only.

 @param module - module read, already known to lack an own test

 @param runnerEntrySources - runner entry sources `src/build-entries.ts` lists

 @returns Whether the module needs no `ALLOWLIST` line despite lacking one

 @example
 ```ts
 const exempt = isExemptByShape({ module, runnerEntrySources, },);
 ```
 */
function isExemptByShape(
  {
    module,
    runnerEntrySources,
  }: {
    readonly module: SourceText;
    readonly runnerEntrySources: ReadonlySet<string>;
  },
): boolean {
  return runnerEntrySources.has(packagePath({ path: module.path, },),)
    || isBarrelModule({ module, },)
    || isTypesOnlyModule({ module, },);
}

/**
 Paths, package-rooted and sorted, of every production module that lacks an
 own test and is not exempt by shape: the live set `ALLOWLIST` tracks.

 @param files - files read, production modules and their tests alike

 @returns Package-rooted paths needing an `ALLOWLIST` line, sorted

 @example
 ```ts
 const needing = modulesNeedingAllowlistEntry({ files, },); // ['src/nap-schedule.ts']
 ```
 */
function modulesNeedingAllowlistEntry({ files, }: { readonly files: readonly SourceText[]; },): readonly string[] {
  /**
   Paths of every `.unit.test.ts` file read, own-test lookups check this.
   */
  const unitTestPaths = new Set(files
    .filter(function isUnitTest({ path, },): boolean { return path.endsWith('.unit.test.ts',); },)
    .map(function pathOf({ path, },): string { return path; },),);
  /**
   Runner entry sources, read once so every module's `isExemptByShape` call
   reuses them.
   */
  const runnerEntrySources = runnerEntrySourcePaths({ files, },);
  return files
    .filter(function isProduction({ path, },): boolean { return isProductionModulePath({ path, },); },)
    .filter(function lacksOwnTest({ path, },): boolean { return !unitTestPaths.has(ownTestPathFor({ path, },),); },)
    .filter(function notExempt(module,): boolean { return !isExemptByShape({ module, runnerEntrySources, },); },)
    .map(function toPackagePath({ path, },): string { return packagePath({ path, },); },)
    .toSorted();
}

/**
 `ALLOWLIST` entries now stale, and live-set entries still missing from
 `ALLOWLIST`: the ratchet's two failure kinds.
 */
type RatchetFindings = {
  /**
   Package-rooted paths the live set holds that `ALLOWLIST` does not: a
   module lacking an own test and not exempt by shape, left unlisted.
   */
  readonly unlisted: readonly string[];

  /**
   `ALLOWLIST` entries the live set no longer holds: the module gained an
   own test, turned out exempt by shape, or no longer exists.
   */
  readonly stale: readonly string[];
};

/**
 Compares the live set of modules needing an `ALLOWLIST` line against
 `ALLOWLIST` itself, in both directions.

 @param files - files read, production modules and their tests alike

 @param allowlist - the ratchet list compared against

 @returns Unlisted live entries and stale allowlist entries, each sorted

 @example
 ```ts
 const findings = ownTestRatchetFindings({ files, allowlist: ALLOWLIST, },);
 ```
 */
function ownTestRatchetFindings(
  {
    files,
    allowlist,
  }: {
    readonly files: readonly SourceText[];
    readonly allowlist: readonly string[];
  },
): RatchetFindings {
  /**
   The live set: paths needing an `ALLOWLIST` line right now.
   */
  const live = modulesNeedingAllowlistEntry({ files, },);
  /**
   The live set, for the stale-entry direction's membership check.
   */
  const liveSet = new Set(live,);
  /**
   `ALLOWLIST` itself, for the unlisted-entry direction's membership check.
   */
  const allowedSet = new Set(allowlist,);
  return {
    unlisted: live.filter(function notAllowed(path,): boolean { return !allowedSet.has(path,); },),
    stale: allowlist.filter(function notLive(path,): boolean { return !liveSet.has(path,); },),
  };
}

//endregion Own-test ratchet scan

/**
 Production modules under `src` that lack an own test and are not exempt by
 shape, sorted: the 300 found when this scan was added (ledger B102), each
 logic some other module's test reaches or no test reaches. An entry goes
 when its module gains an own test, turns out exempt by shape, or is
 removed; adding one is a reviewed decision.
 */
const ALLOWLIST: readonly string[] = [
  'src/active-footnote-markers.ts',
  'src/align-blocks-walk.ts',
  'src/apply-patch-markup.ts',
  'src/archive-block-naturalness.ts',
  'src/archive-block-selection-evidence.ts',
  'src/archive-replacement-candidates.ts',
  'src/artifact-schema-version.ts',
  'src/artifact-v1-read.ts',
  'src/assembly-container-halves.ts',
  'src/assembly-contract-fault.ts',
  'src/assembly-regressions.ts',
  'src/bedrock-bound-ledger.ts',
  'src/bench-seating.ts',
  'src/bilingual-line-clause.ts',
  'src/candidate-judge-rules.ts',
  'src/candidate-select-count.ts',
  'src/candidate-select-model.ts',
  'src/candidate-select-record.ts',
  'src/chat-contract.ts',
  'src/chunk-insertion.ts',
  'src/cited-reference-lookup.ts',
  'src/cited-reference-rule.ts',
  'src/cited-reference-scan.ts',
  'src/claim-panel-voters.ts',
  'src/closing-punctuation.ts',
  'src/community-glossary-words.ts',
  'src/consolidate-archive-stand-in.ts',
  'src/consolidate-driver-acquire.ts',
  'src/consolidate-driver-index.ts',
  'src/consolidate-driver-records.ts',
  'src/consolidate-persistence.ts',
  'src/consolidate-settle-context.ts',
  'src/consolidate-settle-gate.ts',
  'src/consolidation-ledger-gap.ts',
  'src/consolidation-naturalness-state.ts',
  'src/consolidation-polish-gate-wire.ts',
  'src/consolidation-polish-round.ts',
  'src/consolidation-polish-skip.ts',
  'src/contributor-translation-guard.ts',
  'src/corpus-git-context.ts',
  'src/corpus-run/archive-block-source-context.ts',
  'src/corpus-run/archive-italic-spans.ts',
  'src/corpus-run/archive-name-runs.ts',
  'src/corpus-run/artifact-generation.ts',
  'src/corpus-run/artifact-pool.ts',
  'src/corpus-run/artifact-producer-read.ts',
  'src/corpus-run/artifact-two-lane-comparison-fault.ts',
  'src/corpus-run/artifact-two-lane-contract.ts',
  'src/corpus-run/artifact-two-lane-derive.ts',
  'src/corpus-run/artifact-two-lane-read-consolidate-slice.ts',
  'src/corpus-run/artifact-two-lane-read-contest-ballot.ts',
  'src/corpus-run/artifact-two-lane-read-contest-eligibility.ts',
  'src/corpus-run/artifact-two-lane-read-contest-verdict.ts',
  'src/corpus-run/artifact-two-lane-read-evidence.ts',
  'src/corpus-run/artifact-two-lane-read-fields.ts',
  'src/corpus-run/artifact-two-lane-read-lanes.ts',
  'src/corpus-run/artifact-two-lane-read-naturalness-confirmation.ts',
  'src/corpus-run/artifact-two-lane-read-naturalness-digest.ts',
  'src/corpus-run/artifact-two-lane-read-naturalness-round.ts',
  'src/corpus-run/artifact-two-lane-read-naturalness-seat.ts',
  'src/corpus-run/artifact-two-lane-read-polish-gate.ts',
  'src/corpus-run/artifact-two-lane-read-rows.ts',
  'src/corpus-run/artifact-two-lane-row-equality.ts',
  'src/corpus-run/artifact-vote-read.ts',
  'src/corpus-run/attribution-decode.ts',
  'src/corpus-run/attribution-line.ts',
  'src/corpus-run/bench-sample.ts',
  'src/corpus-run/blockquote-paragraphs.ts',
  'src/corpus-run/canadian-date-parts.ts',
  'src/corpus-run/canadian-date-read-leading.ts',
  'src/corpus-run/canadian-date-read.ts',
  'src/corpus-run/canadian-date-words.ts',
  'src/corpus-run/canadian-date.ts',
  'src/corpus-run/canadian-spelling-capital.ts',
  'src/corpus-run/canadian-spelling-context.ts',
  'src/corpus-run/canadian-spelling-pairs-doubled-l.ts',
  'src/corpus-run/canadian-spelling-pairs-word.ts',
  'src/corpus-run/canadian-spelling-pairs.ts',
  'src/corpus-run/canadian-spelling-words.ts',
  'src/corpus-run/cap-census-read.ts',
  'src/corpus-run/cap-census-rule.ts',
  'src/corpus-run/coverage-census-baseline.ts',
  'src/corpus-run/coverage-file.ts',
  'src/corpus-run/coverage-pieces.ts',
  'src/corpus-run/destination-completeness.ts',
  'src/corpus-run/draw-reconcile.ts',
  'src/corpus-run/final-naturalness-completeness.ts',
  'src/corpus-run/insertion-carried-anchor.ts',
  'src/corpus-run/insertion-carried-decide.ts',
  'src/corpus-run/insertion-carried-neighbours.ts',
  'src/corpus-run/insertion-carried-shift.ts',
  'src/corpus-run/insertion-container-blocks.ts',
  'src/corpus-run/insertion-coverage-model.ts',
  'src/corpus-run/ledger-parse.ts',
  'src/corpus-run/line-ending-fold.ts',
  'src/corpus-run/page-agreement.ts',
  'src/corpus-run/page-assembly-passes.ts',
  'src/corpus-run/page-slice-rewrite.ts',
  'src/corpus-run/pass-archive.ts',
  'src/corpus-run/pass-carried-fold.ts',
  'src/corpus-run/pass-consolidate-reseat.ts',
  'src/corpus-run/pass-consolidate.ts',
  'src/corpus-run/pass-contest-reseat.ts',
  'src/corpus-run/pass-contest.ts',
  'src/corpus-run/pass-entry-artifact.ts',
  'src/corpus-run/pass-entry-caches.ts',
  'src/corpus-run/pass-entry-persist.ts',
  'src/corpus-run/pass-footnote-relabel-read.ts',
  'src/corpus-run/pass-insertion-reseat.ts',
  'src/corpus-run/pass-lanes.ts',
  'src/corpus-run/pass-overlap.ts',
  'src/corpus-run/pass-page-assembly.ts',
  'src/corpus-run/pass-page-guards.ts',
  'src/corpus-run/pass-pictures-reseat.ts',
  'src/corpus-run/pass-prepare-reseat.ts',
  'src/corpus-run/pass-prepare.ts',
  'src/corpus-run/pass-reseat-hook.ts',
  'src/corpus-run/pass-seated-pictures.ts',
  'src/corpus-run/pass-visual-evidence.ts',
  'src/corpus-run/published-page-disagreement.ts',
  'src/corpus-run/rendering-audit-settled-band.ts',
  'src/corpus-run/rendering-audit-settled-buy.ts',
  'src/corpus-run/rendering-audit-settled-digest.ts',
  'src/corpus-run/rendering-audit-settled-relocation.ts',
  'src/corpus-run/rendering-audit-settled-runs.ts',
  'src/corpus-run/roster-card-ask.ts',
  'src/corpus-run/run-config-error.ts',
  'src/corpus-run/run-providers.ts',
  'src/corpus-run/run-timing-parse.ts',
  'src/corpus-run/run-timing-read.ts',
  'src/corpus-run/slice-cache-claims.ts',
  'src/corpus-run/slice-cache-dir-read.ts',
  'src/corpus-run/text-runs.ts',
  'src/corpus-run/title-reference-locate.ts',
  'src/corpus-run/title-reference-rewrite.ts',
  'src/coverage-foreign-region.ts',
  'src/decision-context-refusal.ts',
  'src/declared-identity-rule.ts',
  'src/declared-names-evidence.ts',
  'src/derive-seeds.ts',
  'src/displacement-ratio.ts',
  'src/document-node.ts',
  'src/editor-envelope-context.ts',
  'src/editor-selection-sheet.ts',
  'src/fidelity-reference-build.ts',
  'src/fidelity-reference-error.ts',
  'src/fidelity-reference-manifest.ts',
  'src/fidelity-reference-select.ts',
  'src/fidelity-reference-text.ts',
  'src/fidelity-reference-trials.ts',
  'src/fidelity-window-positions.ts',
  'src/footnote-closure-input.ts',
  'src/footnote-protected-ranges.ts',
  'src/footnote-retained-labels.ts',
  'src/footnote-rewrite-error.ts',
  'src/footnote-rewrite-map.ts',
  'src/footnote-slice-labels.ts',
  'src/front-matter-comment-authority.ts',
  'src/front-matter-repair.ts',
  'src/front-matter-translation.ts',
  'src/group-merge.ts',
  'src/group-nodes.ts',
  'src/group-source-anchor.ts',
  'src/han-title-read.ts',
  'src/house-form-corrections.ts',
  'src/house-policy.ts',
  'src/identity-han-items.ts',
  'src/inline-container-tags.ts',
  'src/lane-comparison-fault.ts',
  'src/lane-slice-coverage-error.ts',
  'src/lexical-restoration.ts',
  'src/line-starts.ts',
  'src/line-structure-addendum.ts',
  'src/line-structure-inherit.ts',
  'src/linked-title-declared-name.ts',
  'src/markdown-blocks.ts',
  'src/naturalness-completeness-error.ts',
  'src/naturalness-quorum.ts',
  'src/naturalness-repair-interrupted-error.ts',
  'src/no-provider-for-model-error.ts',
  'src/openrouter-chunk-scan.ts',
  'src/pace-saturation.ts',
  'src/page-apparatus-clause.ts',
  'src/page-headings.ts',
  'src/page-title-lexicon-stage.ts',
  'src/page-title-lexicon-wire.ts',
  'src/page-visible-text.ts',
  'src/pair-contested-target.ts',
  'src/pairing-pictures.ts',
  'src/pairing-question-key.ts',
  'src/panel-stage.ts',
  'src/parse-slice-body.ts',
  'src/patch-model.ts',
  'src/per-model-limiter.ts',
  'src/polish-gate-house-rules.ts',
  'src/preparation-seal.ts',
  'src/preparation-unclaimed.ts',
  'src/prepare-block-pairing-finish.ts',
  'src/probe-issue-index.ts',
  'src/protected-atom.ts',
  'src/provider-meters.ts',
  'src/provider-router-reask.ts',
  'src/queried-block-pairing-details.ts',
  'src/quote-depth-clamp.ts',
  'src/quote-neighbours.ts',
  'src/read-text-if-present.ts',
  'src/reference-attest-claims.ts',
  'src/reference-attest-confirm-wire.ts',
  'src/reference-attest-match.ts',
  'src/reference-attest-stage.ts',
  'src/reference-attest-wire.ts',
  'src/refine-phase-slice.ts',
  'src/refine-selection-context.ts',
  'src/repair-assemble.ts',
  'src/repair-chunk-evidence.ts',
  'src/repair-chunk-proof.ts',
  'src/repair-chunk-settle.ts',
  'src/repair-chunk.ts',
  'src/repair-entry.ts',
  'src/repair-replacements.ts',
  'src/repair-scorecard.ts',
  'src/repair-slice-settle.ts',
  'src/repair-stage-findings.ts',
  'src/resolution-authorship.ts',
  'src/restore-ellipsis.ts',
  'src/retry-stated-wait.ts',
  'src/roster-quorum-size.ts',
  'src/sample-draw-identity.ts',
  'src/sealed-node-ids.ts',
  'src/seed-detection.ts',
  'src/select-decline-consequence.ts',
  'src/severity-scale.ts',
  'src/slice-cost-log.ts',
  'src/slice-delivery-decide.ts',
  'src/slice-delivery-fault.ts',
  'src/soft-break-fold.ts',
  'src/span-edge-match.ts',
  'src/stream-bound-hold.ts',
  'src/stream-delivered-chars.ts',
  'src/tally-claim.ts',
  'src/tally-issue.ts',
  'src/translate-absence.ts',
  'src/translate-address-original.ts',
  'src/translate-alignment-refusals.ts',
  'src/translate-archive-floor.ts',
  'src/translate-atom-floor.ts',
  'src/translate-candidates.ts',
  'src/translate-community-term.ts',
  'src/translate-declared-link-name.ts',
  'src/translate-definition-leak.ts',
  'src/translate-escape-leak.ts',
  'src/translate-han-residue.ts',
  'src/translate-han-title.ts',
  'src/translate-marker-drop.ts',
  'src/translate-produce.ts',
  'src/translate-runoff-tie.ts',
  'src/translate-sheet-leak.ts',
  'src/translate-signer-handle.ts',
  'src/translate-skeleton-page.ts',
  'src/translate-slate-evidence.ts',
  'src/translate-slice-buy.ts',
  'src/translate-slice-settle.ts',
  'src/translate-source-carry.ts',
  'src/translate-stage-repair.ts',
  'src/translate-suicide-drop.ts',
  'src/translate-unfloored.ts',
  'src/translate-unwrapped-link.ts',
  'src/translate-validate-blocks.ts',
  'src/translated-slate-criteria.ts',
  'src/translation-repair-interrupted-error.ts',
  'src/typography-prose-mask.ts',
  'src/unpartnered-gap-steps.ts',
  'src/unprepared-slice.ts',
  'src/upstream-model-hold.ts',
  'src/work-title-scan.ts',
];

await describe({
  name: 'own unit tests ratchet (ledger B102)',
  children: [
    it({
      name: 'FINDS a logic module with no own test missing from ALLOWLIST, the library index among them, and an '
        + 'ALLOWLIST entry whose module already has an own test; PASSES a module with an own test, a barrel, a '
        + 'types-only module, and a runner entry build-entries.ts lists',
      fn: async () => {
        expect(ownTestRatchetFindings({
          files: [
            {
              path: 'whisker-count.ts',
              isTest: false,
              text: 'export function whiskerCount(cat: string): number { return cat.length; }',
            },
            {
              path: 'whisker-count.unit.test.ts',
              isTest: true,
              text: 'export const tabby = 1;',
            },
            {
              path: 'cat-barrel.ts',
              isTest: false,
              text: [
                'export { Purr, } from \'./purr.ts\';',
                'export * from \'./meow.ts\';',
                'export type { CatBreed, } from \'./cat-breed.ts\';',
              ].join('\n',),
            },
            {
              path: 'cat-breed.ts',
              isTest: false,
              text: [
                'export type CatBreed = \'tabby\' | \'calico\';',
                'export const DEFAULT_BREED = \'tabby\' as const;',
                'export const WHISKER_COUNT = 12;',
                'export const FAVOURITE_NAPS = [\'sunbeam\', \'laundry basket\',] as const;',
              ].join('\n',),
            },
            {
              path: 'nap-schedule.ts',
              isTest: false,
              text: 'export function napDuration(hours: number): number { return hours * 60; }',
            },
            {
              path: 'build-entries.ts',
              isTest: false,
              text: 'export const nodeEntries = { purr: \'./src/purr-cli.ts\', index: \'./src/index.ts\', } as const;',
            },
            {
              path: 'purr-cli.ts',
              isTest: false,
              text: 'export function purrLoudly(times: number): string { return \'purr\'.repeat(times); }',
            },
            {
              path: 'index.ts',
              isTest: false,
              text: 'export function meow(): string { return \'meow\'; }',
            },
          ],
          allowlist: ['src/whisker-count.ts',],
        },),).toEqual({
          unlisted: [
            'src/index.ts',
            'src/nap-schedule.ts',
          ],
          stale: ['src/whisker-count.ts',],
        },);
      },
    },),
    it({
      name: 'HOLDS EVERY MODULE WITHOUT AN OWN TEST in ALLOWLIST and NO STALE ALLOWLIST ENTRY in this package',
      fn: async () => {
        /**
         Every package file, tests among them, which own-test lookups need.
         */
        const files = await readPackageSource();
        expect(files.length,).toBeGreaterThan(0,);
        expectRecordAsListed({
          found: ownTestRatchetFindings({ files, allowlist: ALLOWLIST, },),
          listed: {
            unlisted: [],
            stale: [],
          },
        },);
      },
    },),
  ],
},);
