# Plan: split module/es (tracer-bullet round 1)

GitHub issue: [Aquaticat/Monochromatic#185](https://github.com/Aquaticat/Monochromatic/issues/185)

## Context

Issue #185 asks to plan splitting `packages/module/es/` (582 TS files, 26,943 LOC; "comprehensive functional programming utility library") into smaller focused packages and ultimately delete `module/es`. Companion issues (#47, #50, #67, #87, #93, #94, #95, #100, #152, #171, #172, #179, #180, #181, #182, #183, #184) propose adding utilities; each needs a destination before retargeting.

**Empirical surface inventory** (verified via `rg "from '@monochromatic-dev/module-es" packages/`):

- 3 external workspace packages actually import from `module-es`:
  - `packages/webapp-productivity/rss/`: `mapIterableAsync` (3 files), `memoizeAsync` (1 file)
  - `packages/webapp-search/exa-search/`: `createObservable` (1 file)
  - `packages/build-tool/css/`: POSIX path helpers (`dirname`, `resolve`, `join`, `isAbsolute`, `sep`) from `module-es/ts/path/index.ts` (3 files; the target `src/path/` does not exist in `module-es`. Verified: `mise run //packages/build-tool/css:lint:types` currently fails with `TS2307: Cannot find module '@monochromatic-dev/module-es/ts/path/index.ts'` on all 3 files.)
- 18 other workspace packages declare `module-es` as a dependency but do not import it.
- ~500 type-taxonomy files under `src/types/t .../` have no external consumer; `AUDIT.fallow-tools.md` already disables `unused-*` rules there.

**Settled by precedent** (no decision needed):

- Concept-driven, single-concept package naming (matches every prior extraction: `async-time`, `logger`, `numeric-const`, `numeric-format`, `or-throw`).
- Flat `src/<name>.ts + src/<name>.unit.test.ts + src/index.ts` layout (matches every sibling).
- Migration discipline: additive+verified+committed first, consumer migration each commit green, deletion last (`PLANNING.extract-refactor-guardrail.md`).
- Issues #50 (numeric constants) and #67 (format helpers like `formatBytes`/`formatMs`) already have homes: `@monochromatic-dev/module-numeric-const` (byte/fraction/http-status/time) and `@monochromatic-dev/module-numeric-format` (byte/duration).

**User decisions (2026-05-14):**

- Granularity: tracer-bullet: define only the 3 packages needed for actual consumer migrations. Defer remaining issues to follow-up planning rounds.
- Round-1 deletion scope: nothing in `module/es` is deleted in round 1. The remaining symbols (taxonomy, `binary`, JSONC parser, etc.) stay in `module/es` pending further planning rounds that will assign them to better homes. `module/es` itself is deleted only at the end of all migration work, after every symbol has a destination. The "eventually delete with `module/es`" framing applies to the final milestone, not round 1.
- Issue #184 (Result/Option): close as wontfix; AGENTS.md "throw, not return errors" is unambiguous.
- Deliverable: decision doc + issue retargeting. No code lands.

## Recommended approach

### Round-1 packages (3)

- **`@monochromatic-dev/module-async-iter`**
  - Initial exports: `asyncMap`.
  - Source path in `module-es`: `src/types/t object/t array/f/t iterable/map/r a/p p/index.ts` (currently `module-es/map-iterable-async`).
  - Drives consumer: `webapp-productivity/rss`.
- **`@monochromatic-dev/module-memoize`**
  - Initial exports: `memoize` (sync), `memoizeAsync` (async).
  - Source paths in `module-es`: `src/types/t function/f/t function/memoize/r s/p p/index.ts` and `.../r a/p n/index.ts` (currently `module-es/memoize-async`).
  - Drives consumer: `webapp-productivity/rss`.
- **`@monochromatic-dev/module-observable`**
  - Initial exports: `createObservable` (sync), `createObservableAsync` (async).
  - Source paths in `module-es`: `src/types/t object/t proxy/f/t any/createObservable/r s/p p/index.ts` and `.../r a/p p/index.ts` (currently `module-es/create-observable`, `module-es/create-observable-async`).
  - Drives consumer: `webapp-search/exa-search`.

Directory layout: `packages/module/{async-iter,memoize,observable}/`. Each follows the shape of `packages/module/async-time/`: `package.json`, `mise.toml`, `README.md`, `tsconfig.json`, `tsdown.config.ts` (or browser/node split), `src/index.ts`, `src/<name>.ts`, `src/<name>.unit.test.ts`.

Naming note: rename `mapIterableAsync` → `asyncMap` to match issue #93's proposed convention and the `async-X` sibling pattern (`module-async-time` exports `wait` directly, not `waitAsync`). Consumer rewrites are one-line each.

The `$ as <name>` import idiom in current `module-es` consumers (e.g. `import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async'`) goes away in round-1 packages; new packages use plain named exports per sibling-module convention.

### Pre-existing broken-import fix (in round 1 because the symbols don't belong in `module-es`)

`packages/build-tool/css/src/{index.ts, package-resolver.ts, import.ts}` import POSIX helpers from `@monochromatic-dev/module-es/ts/path/index.ts`. That path resolves to `module-es/src/path/index.ts`, which does not exist (`find packages/module/es/src -name 'path*'` returns nothing). The imports are pre-existing-broken. Retarget to `node:path` directly: the imported names (`dirname`, `resolve`, `join`, `isAbsolute`, `sep`) are exact Node aliases. This is not a `module-es` extraction (the symbols never lived there); it's a fix that goes into round 1 because round 1 is the moment `build-tool/css`'s `module-es` dep relationship is being reconsidered.

### Symbol-to-destination map (round 1 scope)

The five entries below are the only symbols that move in round 1. Everything else in `module/es` stays put pending later planning rounds.

- `module-es/map-iterable-async` (`asyncMap`) → `module-async-iter` root export. Rename `mapIterableAsync` to `asyncMap`.
- `module-es/memoize-async` (`memoizeAsync`) → `module-memoize` root export.
- `module-es` taxonomy: sync `memoize` (no subpath, but tests exist) → `module-memoize` root export. Paired with async.
- `module-es/create-observable` (`createObservable`) → `module-observable` root export.
- `module-es/create-observable-async` (`createObservableAsync`) → `module-observable` root export. Declared subpath but no external consumer; ship anyway as paired API.

The migrated source files stay in place inside `module-es` for round 1 (the new packages contain fresh implementations). The `module-es` subpath exports continue to exist for any unmigrated consumer or test inside `module-es` itself. Later planning rounds decide when to remove the now-unused subpath exports from `module-es/package.json`.

Round-1-adjacent fix (not a `module-es` symbol):

- `module-es/ts/path/index.ts` (broken POSIX path import in `build-tool/css`) → `node:path`. Imports are pre-existing-broken; verified via `mise run //packages/build-tool/css:lint:types` failing with TS2307.

Stays in `module/es` (pending future planning rounds):

- `module-es/binary` (declared subpath, no external consumer; future-round destination TBD)
- ~500 type-taxonomy files under `src/types/t .../` (future rounds decide per-symbol destinations)
- The full taxonomy `src/index.ts`, JSONC parser, store helpers, regex helpers, iterable generators, string helpers, etc., all stay in place

### Issue retargeting

**Close as wontfix:**

- #184 Result / Option types. Comment: "Closing per the AGENTS.md rule that errors are thrown, not returned (see `AGENTS.md` → `## Before editing code` → TypeScript → Programming patterns: `Custom error classes; throw over error codes/null/result types`). Reopening requires an ADR overturning that decision; out of scope for #185."

**Retarget to round-1 packages:**

- #93 async iterator utilities. Comment: "Destination is the new `@monochromatic-dev/module-async-iter` package (#185 round 1). Round 1 ships only `asyncMap`; `asyncFilter`/`asyncReduce`/`asyncTake`/`asyncSkip`/`asyncBatch`/`asyncParallel` track here for follow-up. Renames the current `module-es` export `mapIterableAsync` to `asyncMap`."
- #183 functional composition helpers. Comment: "Split scope. `memoize`/`memoizeAsync` retarget to the new `@monochromatic-dev/module-memoize` package (#185 round 1). `debounce`/`throttle`/`curry` blocked on #185 round 2; destination TBD."

**Block on round 2** (comment with `blocked-on-185-r2` label):

- Feature-add issues: #47, #50, #67, #87, #94, #95, #172, #179, #180, #181, #182.
- Maintenance against `module/es` source: #100 (missing exports), #152 (JSONC parser rationale), #171 (TS2677 errors). These stay valid while `module/es` is alive but should not be invested in until the migration assigns those symbols to new homes; resolving them inside `module/es` would be wasted work.
- Destination-TBD candidates that name `module/es` as a candidate home: #44, #48, #49, #51, #52, #70, #82.
- Comment text (template): "Blocked on #185 round 2. `module/es` is being incrementally split; round 1 only moves the three packages with active external consumers (`async-iter`, `memoize`, `observable`). All other symbols remain in `module/es` until their destinations are defined in follow-up planning rounds. Do not add to `module/es` while the split is in flight."
- Additional comment for #50: "Note: `@monochromatic-dev/module-numeric-const` already exists with `byte`/`fraction`/`http-status`/`time` modules and is the likely destination; round 2 will confirm and migrate callers."
- Additional comment for #67: "Note: `@monochromatic-dev/module-numeric-format` already exists with `byte`/`duration` modules covering `formatBytes`/`formatMs`/`formatRelative` shapes; round 2 will confirm and migrate."

### Migration order for the round-1 implementation (separate follow-up PRs)

Per `PLANNING.extract-refactor-guardrail.md` (additive-first; each commit green):

1. Create `module-async-iter` skeleton + `asyncMap` + tests. Commit. Verify `mise run //packages/module/async-iter:lint` and `:test`.
2. Create `module-memoize` skeleton + `memoize`/`memoizeAsync` + tests. Commit. Verify.
3. Create `module-observable` skeleton + `createObservable`/`createObservableAsync` + tests. Commit. Verify.
4. Migrate `webapp-productivity/rss/src/{feed,ignore,opml-text}.ts` to `module-async-iter`. Add the new dep to `rss/package.json`; keep `module-es` for `memoizeAsync` (removed in step 5). Commit. Verify `mise run //packages/webapp-productivity/rss:lint:types` and `:test`.
5. Migrate `webapp-productivity/rss/src/index.ts` to `module-memoize`. Drop `module-es` from `rss/package.json` once no `rss/src/*` file imports it. Commit. Verify.
6. Migrate `webapp-search/exa-search/src/client-dom.ts` to `module-observable`. Drop `module-es` from `exa-search/package.json`. Commit. Verify.
7. Fix `build-tool/css/src/{index,package-resolver,import}.ts` to import from `node:path` (or `module-fs-path` if it exposes the helpers). Drop `module-es` from `build-tool/css/package.json`. Commit. Verify; the previously failing `:lint:types` should now pass.
8. Open issue "#185 round 2: define destinations for the next batch of `module/es` symbols," referencing the 21 deferred issues.

Round 1 ends here. `module/es` itself remains in place; its other ~500 source files, the `binary` subpath, the JSONC parser, the store/regex/iterable/string helpers, and any nominal `module-es` deps in the remaining 18 packages all stay untouched. Future rounds extract them piece by piece. The final deletion of `module/es` happens in the last round, after every symbol has a destination.

### Out of scope (round 1)

- Deletion of `module/es` itself (final milestone after every symbol has a destination).
- Removal of any `module/es` source file, subpath export, or sub-tree (taxonomy, `binary`, JSONC parser, store helpers, etc. all stay until later rounds).
- Cleanup of nominal `@monochromatic-dev/module-es` deps in the 18 packages that declare but do not import it (deferred until the actual symbols those packages might use are homed).
- Destinations for the 21 deferred issues: feature-adds #47, #50, #67, #87, #94, #95, #172, #179, #180, #181, #182; maintenance #100, #152, #171; destination-TBD candidates #44, #48, #49, #51, #52, #70, #82.
- `debounce`, `throttle`, `curry` from #183.
- The post-edit-typecheck PostToolUse hook discussed in `PLANNING.extract-refactor-guardrail.md`.
- Renaming `packages/module/` → `packages/library/` (proposed in stale `TODO.package-structure.md`).
- Resolving the `getRandomId` reference noted in `TODO.2-week-presentability.md` (pre-existing internal bug in code that stays in `module/es`).

## Critical files

**This plan modifies only one file**: it is a decision doc.

The current plan lives at `/home/user/.claude/plans/https-github-com-aquaticat-monochromatic-tidy-rossum.md` (planning-session-internal). When ExitPlanMode runs, copy the contents into:

- `PLANNING.module-es-split.md` (new, repo root): the durable, committed artifact for #185 round 1. Whoever executes round 1 reads this file, not the planning-session copy.

**Round-1 follow-up PRs will create** (skeletons modelled after `packages/module/async-time/`):

- `packages/module/async-iter/{package.json, mise.toml, README.md, tsconfig.json, tsdown.config.ts, src/index.ts, src/async-map.ts, src/async-map.unit.test.ts}`
- `packages/module/memoize/{package.json, mise.toml, README.md, tsconfig.json, tsdown.config.ts, src/index.ts, src/memoize.ts, src/memoize.unit.test.ts, src/memoize-async.ts, src/memoize-async.unit.test.ts}`
- `packages/module/observable/{package.json, mise.toml, README.md, tsconfig.json, tsdown.config.ts, src/index.ts, src/create-observable.ts, src/create-observable.unit.test.ts, src/create-observable-async.ts, src/create-observable-async.unit.test.ts}`

**Round-1 follow-up PRs will edit**:

- `packages/webapp-productivity/rss/src/{feed.ts, ignore.ts, opml-text.ts, index.ts}`: switch imports to the new packages
- `packages/webapp-productivity/rss/package.json`: add new deps; drop `module-es` once unused by `rss/src/*`
- `packages/webapp-search/exa-search/src/client-dom.ts`: switch imports to `module-observable`
- `packages/webapp-search/exa-search/package.json`: swap dep
- `packages/build-tool/css/src/{index.ts, package-resolver.ts, import.ts}`: swap `module-es/ts/path` for `node:path`
- `packages/build-tool/css/package.json`: drop `module-es` dep

**Round-1 follow-up PRs will NOT modify**:

- `packages/module/es/` (stays in place; round 1 is additive only)
- The 18 other `package.json` files that declare `module-es` as a nominal dep (cleanup deferred until those packages' future consumer needs are addressed)
- Documentation files (`AUDIT.*.md`, `PLANNING.*.md`, `TODO.*.md`) that reference `module/es` as a canonical home: those references remain accurate while `module/es` is alive

## Verification

End-to-end checks once the round-1 follow-up PRs land:

1. `rg "from '@monochromatic-dev/module-es" packages/ | grep -v "packages/module/es/"`: only `module-es/ts/path/index.ts` cleared (that import path is removed entirely from `build-tool/css`); the four `module-es` subpath imports in `webapp-productivity/rss` and the one in `webapp-search/exa-search` are gone.
2. `find packages/module/es -type d | head -5`: still returns the directory (round 1 does not delete it).
3. `mise run lint`: clean for the full workspace; `mise run //packages/build-tool/css:lint:types` now passes (it currently fails with TS2307).
4. `mise run test`: passes for `module-async-iter`, `module-memoize`, `module-observable`, `webapp-productivity/rss`, `webapp-search/exa-search`, `build-tool/css`.
5. `pnpm install`: succeeds.
6. Each new package: README.md present, tests cover every exported symbol (AGENTS.md "Test coverage matches the public API surface"), zero lint errors.
7. `gh issue list -R Aquaticat/Monochromatic --label "blocked-on-185-r2" --state open`: returns the 21 deferred issues (11 feature-adds + 3 maintenance + 7 destination-TBD).
8. `gh issue view 184 -R Aquaticat/Monochromatic`: state `CLOSED`, reason `not planned`.
9. `gh issue view 93 -R Aquaticat/Monochromatic` and `gh issue view 183 -R Aquaticat/Monochromatic`: comments reference the new packages.
10. `module/es` still builds (`mise run //packages/module/es:build`) and its tests still pass; the original subpath exports remain valid for any future symbol-by-symbol migration.

Deliverable for #185 itself (this round): the `PLANNING.module-es-split.md` file plus the GitHub issue updates (close #184 wontfix; retarget #93 and #183; block-comment on the 21 deferred issues including #100, #152, #171). Implementation of the three packages and the consumer migration is follow-up work, not part of #185 round 1.
