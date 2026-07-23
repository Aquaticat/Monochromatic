# Handover: `prefer-readonly-parameter-type` effect architecture

Living record for the catalog-free,
fail-closed effect architecture in
`package/oxlint-plugin/prefer-readonly-parameter-type`.

## Final decision

Keep the rule as an Oxlint JavaScript plugin using the released JavaScript-plugin boundary and
TypeScript 7.0.2's `typescript/unstable/sync` semantic API.
Do not add Rust,
Node-API,
`ttsc`,
or a custom linter distribution.
Do not fork or contribute to Oxlint or `tsgolint` for this rule.

A parameter-reachable call has exactly one accepted outcome:

- derive effects from the exact repository-owned or shipped runtime implementation;
- prove that a separately verified isolated value shares no caller-owned identity or capability;
- reject the call as opaque.

Handwritten package,
ECMAScript,
DOM,
and Node effect catalogs are removed.
`@mutates` is documentation only and cannot discharge unresolved behavior.
`ForeignBorrowed` records ownership provenance but cannot make an opaque call acceptable.
Static plain-data typing is not runtime isolation proof.

## Implemented architecture

### Demand-driven effects

`effect-demand-index.ts` starts from callables in each active Oxlint source.
It follows exact owned callee and callback identities through semantic call edges.
Missing reached sources,
missing callable summaries,
and analysis-budget exhaustion fail closed.
The 120-second budget is a pathological-graph safety ceiling,
not the latency acceptance target.

### Exact package runtime analysis

Package analysis resolves the selected conditional export to its shipped JavaScript or TypeScript runtime entry.
It follows runtime re-exports and iteratively includes declaration-adjacent runtime shadows selected incorrectly by
the TypeScript project.
Tests cover conditional exports,
runtime barrels,
transitive runtime files,
declaration and runtime sibling mismatch,
shipped TypeScript,
source-map distraction,
and missing runtime implementation.
Native and unresolved boundaries remain opaque.

### Host opacity

TypeScript library declarations establish identity and shape,
not behavior.
Parameter-reachable bodyless ECMAScript,
DOM,
and Node calls are therefore opaque.
Removed special cases include global `String`,
observational collection methods,
host methods,
shallow frozen copies retaining nested identity,
and statically plain structured values.

### Cache model

Persistent cache schema 4 contains only mechanically derived summaries.
It binds exact source,
module,
semantic call,
compiler-option,
declaration-surface,
lockfile,
analyzer,
and external implementation identities.
There is no catalog result origin or documented-uncertainty acceptance state.

Process-local final indexes use TypeScript's immutable semantic `Project` snapshot object as authority.
The former `effectProjectSourceSignatures()` project-wide metadata scan is removed.
A regression changes the active overlay without closing the bridge and proves a new snapshot writes a new final index.
`closeSemanticBridge()` clears every process cache.

### Foreign ownership

A reached inferred `ForeignBorrowed` candidate triggers exact
`Project.checker.getSignatureUsage()` queries instead of scanning every callable in every source.
The analysis walks backwards through callable owners.
Each usage must produce its own exact owned call edge.
Non-call escapes,
top-level or excluded callers,
unavailable usage queries,
and unresolved exact edges add an ordinary inbound and remove inferred provenance.

The installed TypeScript 7.0.2 API probe returned both calls to a shared helper in 6.3 milliseconds in a configured
287-source project.
The unit corpus covers an otherwise unreached ordinary caller and an overload family with a value alias escape beside
a matching call.

### Self-hosting boundary

The strict effect rule does not apply to its own package.
Its implementation necessarily uses bodyless TypeScript handles,
Oxlint host methods,
and ECMAScript collections.
Self-application could pass only by restoring forbidden host authorities or by rejecting the implementation itself.

`package/config/oxlint/src/overrides.ts` disables only
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` under this package.
Every other configured Oxlint rule remains active.
The package's semantic corpus and external-consumer tests execute the strict rule directly.

## Removed authority surface

The completed removal deleted 65 files and 10,355 lines from the catalog-oriented implementation and tests.
The former handwritten surface contained 492 entries:

- 222 ECMAScript entries;
- 54 DOM entries;
- 34 Node entries;
- 182 package entries.

`catalog-free-architecture.unit.test.ts` prevents production catalog,
host-authority,
evidence-table,
plain-data authority modules,
and removed opacity-discharge identifiers from returning.

## Latency evidence

The exact acceptance command is:

```bash
mise run //package/config/oxlint:lint:oxlint
```

The pre-change whole-project implementation reproduced at 49.6 seconds.
An empty package catalog alone still took 67.5 seconds,
which proved that catalog deletion without demand-bounded implementation analysis was insufficient.

Final catalog-free Linux x64 measurements process 13 files with 479 rules and zero diagnostics:

- cold empty persistent cache:
   838 milliseconds in Oxlint and 2.02 seconds wall;
- warm unchanged state:
   844 milliseconds in Oxlint and 1.41 seconds wall;
- changed source:
   835 milliseconds in Oxlint and 2.03 seconds wall;
- invalidated compiler options:
   824 milliseconds in Oxlint and 2.01 seconds wall.

The changed-source and compiler-option runs used
`/home/user/temp/agent/readonly-catalog-final-gates-20260723`,
a disposable worktree.
No prior daemon,
background analyzer,
or hidden precomputation is required for the cold result.

## Verification evidence

The final local boundary checks passed:

- package JavaScript build;
- package TypeScript lint;
- complete package unit corpus;
- semantic-bridge host lifecycle;
- staged external consumer;
- package Oxlint with zero warnings and zero errors over 91 current files;
- exact cold,
warm,
changed-source,
and compiler-option-invalidated latency gates.

The package file count is now 91 rather than the traversal phase's 143 because catalog production and test files were
deleted.

GitHub Actions workflow `readonly-semantic-bridge.yml` run `29982799056` passed the built bridge and external
consumer on Ubuntu,
macOS 15 arm64,
and Windows x64 for commit `50240278b`.

## Key commit sequence

Traversal and cache foundation:

- `6f473bea6` implements demand-driven traversal and schema-3 semantic edges;
- `4bdbc0478` adds fail-closed missing-edge and budget handling;
- `656444e0a` closes the traversal-phase latency gate.

Catalog-free authority:

- `2bf5f6bc5` removes catalog and evidence modules;
- `04731605b` removes documented uncertainty and advances schema 4;
- `5892f9844` follows reached runtime shadow files;
- `9c3599a09` makes mutable-capable bodyless callables opaque;
- `903d9addc` removes project-wide final-index source signatures;
- `32d110bdc` replaces complete foreign source scans with exact signature inbounds;
- `350caf669` adds the catalog-absence architecture regression;
- `64a40ca6b` proves snapshot invalidation and exact signature escape fallback;
- `32a06a75b` documents and configures the self-hosting boundary.

## Preserved artifact and cleanup

Preserve
`/var/home/user/temp/agent/readonly-no-package-catalog-20260722`
for inspection.
Remove the disposable final-gate worktree after final documentation and measurements are committed.

Unrelated concurrent changes must remain untouched:

- `mise.toml`;
- `package/webapp-productivity/done-postcss/data/done.db-wal`.
