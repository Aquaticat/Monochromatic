# Handover: execute module-es split (round 1)

Executing `docs/planning/module-es-split.md` on branch `feat/module-es-split` in the worktree at
`/var/home/user/worktrees/module-es-split`. Tracks issue #185. This doc lets a fresh session continue after
context compaction.

## Current state

Three of the four new packages are implemented, verified (build, lint with zero warnings, tests pass), and
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

`async-iter` and `observable` were produced by two `spawn-claude` children (specs at
`/tmp/spec-async-iter.md` and `/tmp/spec-observable.md`), then independently re-verified before commit.

The `packages/module/memoize/` scaffold (package.json, mise.toml, tsconfig.json, two tsdown configs) exists
but is untracked: no `src/`, tests, or README yet. The committed lockfile already references
`@monochromatic-dev/module-memoize`, so it is slightly ahead of the committed manifests; this is harmless
and resolves when memoize is committed.

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

## Remaining steps (plan implementation order)

2. Implement `memoize`. Port from module-es (full source was read this session):
   `packages/module/es/src/types/t function/f/t function/memoize/{r a/p n,r s/p n,t,cacheKey}`. Public
   exports: `memoize`, `memoizeAsync`, `MemoizedFunction`, `MemoizedAsyncFunction`, and the option/call
   types (`MemoizeOptions`, `MemoizeAsyncOptions`, `MemoizedCallOptions`, `MemoizeNamedOptions`,
   `MemoizeAsyncNamedOptions`). Import `createStore`, `createSyncStore`, and types `Store`, `SyncStore`
   from `@monochromatic-dev/module-kv-store` (package root). Keep `buildCacheKey` internal. Apply `readonly`
   to option-type properties up front. Tests must cover sync and async, LRU, store injection, clear,
   delete, size, salt, in-flight dedup, error retry, and the `undefined`-recomputation behavior. Preserve
   the `${argKey}:${salt}` key format and stored-`undefined`-is-a-miss behavior. Commit per package.
3. (async-iter) done. 4. (observable) done.
5. Migrate `webapp-productivity/rss`: `feed.ts`, `ignore.ts`, `opml-text.ts` import `mapIterableAsync` from
   `@monochromatic-dev/module-async-iter`; `index.ts` imports `memoizeAsync` from
   `@monochromatic-dev/module-memoize`. Add both deps, remove `@monochromatic-dev/module-es`.
6. Migrate `webapp-search/exa-search`: `client-dom.ts` and `client.ts` import `createObservable` and
   `type Observable` from `@monochromatic-dev/module-observable`. Convert observable `.value` reads/writes
   to `getValue()` / `setValue()`. Observables are only `apiKey`, `numTotalSearches`, `numResults`. Leave
   DOM `.value` alone (`numResultsInput.value`, `searchInput.value`). `numTotalSearches.value++` becomes
   `numTotalSearches.setValue(numTotalSearches.getValue() + 1)`. Add the dep, remove module-es.
7. Remove the 18 unused `module-es` manifest deps (listed in the plan context section); refresh the
   lockfile. Separate commit.
8. Remove migrated named subpath exports from `packages/module/es/package.json`: `./create-observable`,
   `./create-observable-async`, `./map-iterable-async`, `./memoize-async`. Keep `./binary`, `./ts`,
   `./ts/*`. Do not remove any module-es source file.
9. Update memoize guidance to point at `@monochromatic-dev/module-memoize`: `AGENTS.md` (module-root `let`
   guidance), `packages/config/oxlint/src/rules/restriction.ts`,
   `packages/config/oxlint-no-restricted-syntax/src/rules/no-module-root-let.ts`. If `AGENTS.md` changes,
   regenerate managed outputs with file-enforcer (do not edit `CLAUDE.md` by hand).
10. Add GitHub correction comments to #93 and #183 (exact text in the plan).
11. Create the round-1 implementation issue, the round-2 planning issue, and the tsdown audit issue; add
    pointers on deferred issues; close #185.

## Verification before declaring done

Plan lines 467 to 523: per-package `build`/`lint`/`test:unit`; consumer verification for rss and
exa-search; the four `rg` import/manifest checks (no external module-es source imports, no external
manifest declarations, migrated subpaths gone, `./ts` and `./ts/*` remain); repo-wide build/lint/test; and
browser verification of exa-search with `agent-browser` exercising every rewritten observable path (api key
read/update, total-search increment, result-count input).
