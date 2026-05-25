# Handover: execute module-es split (round 1)

Executing `docs/planning/module-es-split.md` on branch `feat/module-es-split` in the worktree at
`/var/home/user/worktrees/module-es-split`. Tracks issue #185. This doc lets a fresh session continue after
context compaction.

## Current state

All four new packages are implemented, verified (build, lint with zero warnings, tests pass), and
committed on `feat/module-es-split`:

- `46d05616 feat(module-kv-store)`: extracted from module-es. Flat `src/` layout. Public exports:
  `createStore`, `createSyncStore`, `configureDefaultBackendsBuilder`, and the store support types
  (`Store`, `SyncStore`, `StorageBackend`, `SyncStorageBackend`, `StoreConfig`, `SyncStoreConfig`,
  `BaseStoreConfig`, `BaseStoreFields`, `Serializer`, `Deserializer`, `EvictionPolicy`,
  `LruEvictionPolicy`, `DefaultBackendsBuilder`). Internal-only (not exported): `consensus.ts`, `heal.ts`,
  `lru-key-set.ts`, `serialize.ts`, `hash.ts`, `has-cycle.ts`, `backends-async.ts`, `backends-sync.ts`.
  This commit also carries the `pnpm-lock.yaml` delta registering all four round-1 manifests.
- `3c513b92 feat(module-async-iter)`: `mapIterableAsync`, behavior unchanged (eager, unbounded,
  order-preserving collect-to-array).
- `dd48b752 feat(module-observable)`: `createObservable`, `createObservableAsync`, `Observable`,
  `ObservableAsync`. Public API deliberately changed to methods `getValue()` / `setValue()`. Async
  `setValue` awaits `onChange` so rejections propagate (a behavior change from the old fire-and-forget).
- `f54aa3ce refactor(module-kv-store)`: marked `Store`/`SyncStore` methods (`set`/`get`/`delete`/`clear`)
  `readonly`. Required so memoize's option types pass `prefer-readonly-parameter-types` (see lint patterns
  below). kv-store re-verified 0/0 and tests pass after the change.
- `440c876a feat(module-memoize)`: `memoize`, `memoizeAsync`, plus option/call/result types and
  `DEFAULT_MAX_CACHE_SIZE`. Renamed module-es's positional `$` entry points to `memoize`/`memoizeAsync`,
  kept `buildCacheKey` internal. Added the undefined-recomputation test (both variants) that module-es
  omitted; renamed the misleading "evicts cache entry on rejection" test to name the real mechanism
  (inflight cleanup, never a cache eviction). Imports kv-store from its package root.

`async-iter` and `observable` were produced by two `spawn-claude` children (specs at
`/tmp/spec-async-iter.md` and `/tmp/spec-observable.md`), then independently re-verified before commit.

## Environment learnings (do not rediscover)

- A fresh worktree has no built `dist/` for any workspace package, and dist is gitignored. Type-aware lint
  and tests of a new package fail with `TS2307` until the workspace deps it imports are built. Already built
  `module-test` and `module-logger` here. Before linting/testing memoize, kv-store must be built (it is).
  For the consumer migrations (rss, exa-search) build their workspace deps first, or run a wider build.
- `task-pnpm` (the install task's bin) does not exist until `node_modules` is bootstrapped. Bootstrapped
  once with a direct `pnpm install`; afterwards `mise run prepare:pnpm:install` works normally.
- The worktree needed `mise trust` once (done).
- A package's own tests import its `./index.ts` source (the zip-writer convention), not the package root,
  to avoid the stale-dist false-failure trap. Cross-package imports (memoize importing kv-store) use the
  package root `@monochromatic-dev/module-kv-store`, which requires kv-store to be built.
- `cli-git` enforces explicit pathspec on commit. Pattern that works: `git add <dir>` then
  `git commit -F - <dir>` (heredoc message). Plain `git commit` without a pathspec is rejected.
- Lint is `task-oxlint --type-aware` plus `task-tsgo --build`. The oxlint task denies warnings (exit 1 on
  any warning). module-es itself carries about 2160 warnings and 35 errors; that is debt, not precedent.
  New packages must be zero warnings and zero errors.

### Lint patterns that bit kv-store (apply to memoize)

- TSDoc `@example` import lines must escape the at-sign: `from '\@monochromatic-dev/module-...'`. Otherwise
  tsdoc reads `@monochromatic` as a tag.
- `typescript/prefer-readonly-parameter-types` fires on params whose value types are deeply mutable. Fix by
  making the types readonly: `readonly` on object properties (or wrap the param in `Readonly<{...}>`),
  `ReadonlyMap` (mutable `Map` is not allowlisted; only `ReadonlyMap`/`ReadonlySet` are), and
  `readonly T[]` arrays. Make record types like the option types readonly at the property level.
- `typescript/no-unnecessary-type-parameters` fires on a single-use return generic when the return is
  direct (`(...) => T | undefined`) but not when wrapped (`(...) => Promise<T | undefined>`). For
  intentional caller-specified return generics that cannot be restructured, use a scoped disable with
  justification. For block scope inside a type literal, put `/* oxlint-disable rule -- ... */` before the
  TSDoc and `/* oxlint-enable rule */` on the line right after the member; for an object-method
  implementation with no TSDoc, a `// oxlint-disable-next-line rule -- ...` directly above works.
- After fixing one layer, re-lint: more warnings surface once types resolve, and previously needed disables
  can become unused (an unused directive is itself an error to remove).
- `prefer-readonly-parameter-types` is deep: a param type embedding another type (memoize's `store?: Store`)
  fails unless that embedded type's data fields **and methods** are all `readonly`. Marking the option
  property `readonly store?` is not enough; the `Store`/`SyncStore` methods themselves had to become
  `readonly` in kv-store (commit `f54aa3ce`). Fix at the source type, not with a disable at the consumer.
- Rest params (`...args: TArgs`) in a callback **type** signature (`(this: void, ...args: TArgs) => string`)
  are not flagged: `no-restricted-syntax/no-rest-params` only visits `FunctionDeclaration`/`FunctionExpression`,
  not `TSFunctionType`. Do not add a disable for them; it would be unused, and `no-disable-no-rest-params`
  bans disabling that rule anyway.
- A whole family of rules cannot be disabled inline (`no-disable-*` meta-rules in
  `packages/config/oxlint/src/rules/restriction.ts` lines 111 to 129): `require-destructured-params`,
  `no-rest-params`, `no-arrow-function`, `require-tsdoc`, `no-switch`, `no-for-in`, `no-enum`, etc. When one
  fires, restructure the code; you cannot suppress it. For memoize's "multi-arg" test, a positional
  `fn(a, b)` is impossible (rule fires, no disable allowed) and `memoize` calls `fn(...args)` positionally,
  so the test uses a single destructured-object argument (`fn({ a, b })`, called as `args: [{ a, b }]`).
- Same-module value + type imports must be merged into one statement with an inline `type` qualifier
  (`import { createSyncStore, type SyncStore } from '...'`); separate `import {}` + `import type {}` from the
  same module trips `no-duplicate-imports`.
- A function destructuring its single object param (`function memoized({ args, salt }: ...)`) must document
  each destructured field (`@param args`, `@param salt`), not the synthetic param name; otherwise
  `tsdoc(check-param-names)` errors.

## Remaining steps (plan implementation order)

Steps 2 to 9 are done and committed on `feat/module-es-split`:

- `52dbb63f refactor(webapp-productivity-rss)`: rss now imports `mapIterableAsync` from
  `module-async-iter` and `memoizeAsync` from `module-memoize`; module-es dep dropped. Builds and
  type-checks clean. Pre-existing oxlint debt (28 warnings) left untouched; rss has no test task, and the
  plan's rss consumer bar is `lint:types` + `test` only (not `lint:oxlint`).
- `61a64d68 refactor(webapp-search-exa-search)`: observable `.value` reads/writes converted to
  `getValue()` / `setValue()` (`numTotalSearches.value++` became `setValue(getValue() + 1)`); DOM `.value`
  on `searchInput`/`numResultsInput` left alone. Type-checks and builds clean. The new `Observable` type
  has no `.value`, so tsc forced and validated every conversion. exa-search carries pre-existing oxlint
  debt (11 warnings across `asset.ts`, `exa-fetch.ts`, `client-display-result.ts`, and stale file-level
  directives) confirmed out of scope by the user. Browser verification skipped at user request.
- `098ea8d5 chore(*)`: removed the 18 unused `module-es` manifest deps (verified zero source imports) and
  relinked the lockfile; also dropped `module-es` from the `done`/`done-postcss` README dep lists.
- `b3de71cf refactor(module-es)`: removed the four migrated subpath exports
  (`./create-observable`, `./create-observable-async`, `./map-iterable-async`, `./memoize-async`); kept
  `./binary`, `./ts`, `./ts/*`. All four plan rg checks pass.
- `87d8d334 docs(*)`: memoize guidance now points at `@monochromatic-dev/module-memoize` in `AGENTS.md`,
  `restriction.ts`, and `no-module-root-let.ts` (TSDoc, runtime message, and example corrected to the real
  `memoize({ fn, keyFn })` API). `CLAUDE.md` is gitignored and untracked; file-enforcer regenerates it
  locally and it is not committed. The `sync:files` task also non-deterministically reorders `mise.toml`'s
  `_.path` bin list; that churn was reverted, not committed.

Steps 10 and 11 (GitHub issue management) are done (user approved the full batch):

- Correction comment on #93 (mapIterableAsync name kept) and supplemental comment on #183 (kv-store before
  memoize).
- Created #210 (round 2 planning), #211 (round 1 implementation checklist, all boxes checked), #212
  (tsdown audit of runtime-export packages).
- Commented on all 21 `blocked-on-185-r2` issues (44, 47 to 52, 67, 70, 82, 87, 94, 95, 100, 152, 171,
  172, 179 to 182) pointing at #210.
- Closed #185 with a comment linking #210/#211/#212.

All plan steps 1 to 11 are complete. The branch `feat/module-es-split` is ready to merge.

Verification done: per-package build/lint(0/0)/test for the four new packages; rss and exa-search
build + lint:types; the four plan rg import/manifest checks (all pass); sampled lint:types on three
dep-removal packages (cli/git, module/token-count, figma-parsers/kiwi), all clean. Skipped: exa-search
browser verification (user request) and a full repo-wide lint (not 0/0 because of pre-existing module-es
and consumer debt, which is drift, not a regression from this work).

## Verification before declaring done

Plan lines 467 to 523: per-package `build`/`lint`/`test:unit`; consumer verification for rss and
exa-search; the four `rg` import/manifest checks (no external module-es source imports, no external
manifest declarations, migrated subpaths gone, `./ts` and `./ts/*` remain); repo-wide build/lint/test; and
browser verification of exa-search with `agent-browser` exercising every rewritten observable path (api key
read/update, total-search increment, result-count input).
