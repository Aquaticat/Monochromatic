# Plan: split module/es (tracer-bullet round 1)

GitHub issue: [Aquaticat/Monochromatic#185](https://github.com/Aquaticat/Monochromatic/issues/185)

Status: revised decision document. Implementation work has not started.

## Context

Issue #185 tracks splitting `packages/module/es/` into focused packages and eventually deleting `module/es`.
Current repository measurements show `packages/module/es/` contains 552 TypeScript files and 19,931 TypeScript
lines.

Source-level imports outside `packages/module/es/` are limited to five files across two packages:

- `packages/webapp-productivity/rss/src/feed.ts`: `module-es/map-iterable-async`
- `packages/webapp-productivity/rss/src/ignore.ts`: `module-es/map-iterable-async`
- `packages/webapp-productivity/rss/src/opml-text.ts`: `module-es/map-iterable-async`
- `packages/webapp-productivity/rss/src/index.ts`: `module-es/memoize-async`
- `packages/webapp-search/exa-search/src/client-dom.ts`: `module-es/create-observable`

Twenty package manifests outside `module/es` declare `@monochromatic-dev/module-es`.
Two are active source consumers (`rss`, `exa-search`), and 18 have no current source imports:

- `packages/cli/git`
- `packages/cli/mvm`
- `packages/cli/rgffplay`
- `packages/cli/terminal-exec`
- `packages/dev-script/deps-cube`
- `packages/dev-script/file-enforcer`
- `packages/dev-script/inference-canary`
- `packages/dev-script/inference-canary-viewer`
- `packages/figma-parsers/kiwi`
- `packages/module/image-diff`
- `packages/module/token-count`
- `packages/webapp-edu/paper2vn`
- `packages/webapp-forge/seed`
- `packages/webapp-forge/server`
- `packages/webapp-productivity/done`
- `packages/webapp-productivity/done-postcss`
- `packages/webapp-productivity/syllable-break-demo`
- `packages/webapp-search/ai-tree`

`packages/build-tool/css` is not part of round 1.
It already imports POSIX path helpers from `@monochromatic-dev/module-fs-path`, and
`mise run //packages/build-tool/css:lint:types` passes.
The old broken-import section in the previous plan was stale.

## Current decisions

Round 1 uses a tracer-bullet split: extract only the concepts needed by current external consumers, plus the
store package needed to make memoize a real package instead of a memoize-private cache.

Round 1 creates four private packages:

- `@monochromatic-dev/module-kv-store`
- `@monochromatic-dev/module-memoize`
- `@monochromatic-dev/module-async-iter`
- `@monochromatic-dev/module-observable`

Every new package has tsdown setup.
Existing packages without tsdown setup are drift, not precedent.
Round 1 creates a separate audit issue for runtime-export packages that still lack tsdown setup.

Public runtime imports use package roots only.
No new runtime subpath exports such as `./sync` or `./async` are added.
Each package keeps `./ts` and `./ts/*` source escape hatches for exceptional source imports.

Every new package is private in round 1.
Public publishing can be decided later after dependency graphs and provenance are reviewed.

## Package shape

Each new package follows the built-output package shape used by current tsdown-backed module packages.
The package contains:

- `package.json`
- `mise.toml`
- `README.md`
- `tsconfig.json`
- `tsdown.browser.config.ts`
- `tsdown.node.config.ts`
- `src/index.ts`
- implementation files under `src/`
- `*.unit.test.ts` files beside implementation files

`tsdown.browser.config.ts` re-exports the neutral shared config:

```ts
export { default, } from '@monochromatic-dev/config-tsdown/.ts';
```

`tsdown.node.config.ts` re-exports the Node shared config:

```ts
export { default, } from '@monochromatic-dev/config-tsdown/.node.ts';
```

The runtime export map uses built root output only, plus source escape hatches:

```json
{
  "module": "dist/final/neutral/index.mjs",
  "exports": {
    ".": {
      "types": "./dist/final/neutral/index.d.mts",
      "node": "./dist/final/node/index.mjs",
      "default": "./dist/final/neutral/index.mjs"
    },
    "./ts": "./src/index.ts",
    "./ts/*": "./src/*"
  },
  "files": [
    "dist/final",
    "src"
  ]
}
```

The package `mise.toml` includes build, watch-build, lint, and test tasks.
The build tasks mirror tsdown-backed sibling packages:

```toml
[tasks.build]
extends = "build"

[tasks.'build:js']
extends = "build:js"

[tasks.'build:js:browser']
extends = "build:js:browser"

[tasks.'build:js:node']
extends = "build:js:node"

[tasks."watch:build"]
extends = "watch:build"

[tasks."watch:build:js"]
extends = "watch:build:js"

[tasks."watch:build:js:browser"]
extends = "watch:build:js:browser"

[tasks."watch:build:js:node"]
extends = "watch:build:js:node"

[tasks.lint]
extends = "lint"

[tasks."lint:oxlint"]
extends = "lint:oxlint"

[tasks."lint:types"]
extends = "lint:types"

[tasks."test:unit"]
extends = "test:unit"
```

## Round-1 packages

### `@monochromatic-dev/module-kv-store`

Root exports:

- `createStore`
- `createSyncStore`
- `configureDefaultBackendsBuilder`
- `Store`
- `SyncStore`
- `StorageBackend`
- `SyncStorageBackend`
- `StoreConfig`
- `SyncStoreConfig`
- store support types such as serializers, deserializers, eviction policies, and default-backend builders

The extraction preserves full current store behavior:

- sync and async stores
- ordered backend lists
- backend priority
- majority consensus
- highest-priority-tier fallback
- backend healing
- LRU eviction
- SuperJSON serialization
- lossy circular handling
- async empty-key hashing
- default async backend configuration

Current source paths that move or inform the implementation:

- `packages/module/es/src/types/t object/t store/`
- `packages/module/es/src/types/t string/f/t unknown/serialize/r s/p n/index.ts`
- `packages/module/es/src/types/t string/f/t string/hash/r a/p p/index.ts`
- `packages/module/es/src/types/t boolean/f/t unknown/hasCycle/r s/p p/index.ts`

Hashing, serialization, and cycle detection are internal helpers in `module-kv-store`.
They are not public exports in round 1.

Tests are ported from current store tests and rewritten to import the new package root.
Coverage must include sync and async stores, consensus, healing, LRU, serialization, circular handling, default backend
configuration, deletion, clearing, and size reporting.

### `@monochromatic-dev/module-memoize`

Root exports:

- `memoize`
- `memoizeAsync`
- `MemoizedFunction`
- `MemoizedAsyncFunction`
- memoize option and call option types

`module-memoize` depends on `@monochromatic-dev/module-kv-store`.
It preserves the current named-object call shape:

```ts
const memoized = await memoizeAsync({
  fn: fetchUser,
  keyFn: function keyUser(userId: string): string {
    return userId;
  },
});

await memoized({
  args: ['user-1'],
  salt: 'v1',
});
```

The package preserves current behavior:

- `store` injection in constructor options
- `.store`, `.clear()`, `.delete()`, and sync `.size`
- async in-flight deduplication
- `${argKey}:${salt}` cache key format
- current `undefined` handling, where stored `undefined` is not a cache hit and recomputes
- error behavior where failed async computations do not poison the cache

Current source paths that move or inform the implementation:

- `packages/module/es/src/types/t function/f/t function/memoize/r s/p n/index.ts`
- `packages/module/es/src/types/t function/f/t function/memoize/r a/p n/index.ts`
- `packages/module/es/src/types/t function/f/t function/memoize/t/index.ts`
- `packages/module/es/src/types/t function/f/t function/memoize/cacheKey.ts`

No positional compatibility wrapper is shipped in round 1.
Tests port the current memoize matrix and import the new package root.
Coverage must include sync and async variants, LRU, store injection, clear, delete, size, salt, in-flight deduplication,
error retry, and the `undefined` recomputation behavior.

### `@monochromatic-dev/module-async-iter`

Root export:

- `mapIterableAsync`

`mapIterableAsync` keeps the current name and current behavior.
It accepts a sync or async iterable, eagerly starts every mapper call, preserves input order in the output array,
and returns `Promise<R[]>`.
Concurrency remains unbounded in round 1.

Current source path:

- `packages/module/es/src/types/t object/t array/f/t iterable/map/r a/p p/index.ts`

Tests must cover sync iterables, async iterables, empty input, output order, mapper rejection, and eager concurrency.
The README must state that this helper is an eager collect-to-array mapper, not a lazy async-iterator transform.

### `@monochromatic-dev/module-observable`

Root exports:

- `createObservable`
- `createObservableAsync`
- `Observable`
- `ObservableAsync`

Round 1 deliberately changes the public API from property setters to methods.
Both sync and async observables expose `getValue()` and `setValue()`.

Sync shape:

```ts
const value = createObservable({
  initialValue: 0,
  onChange: function onCounterChange(newValue: number, oldValue: number): void {
    // observer body
  },
});

value.setValue(1,);
const current = value.getValue();
```

Async shape:

```ts
const value = await createObservableAsync({
  initialValue: 0,
  async onChange(newValue: number, oldValue: number): Promise<void> {
    // observer body
  },
});

await value.setValue(1,);
const current = value.getValue();
```

State updates before `onChange` runs.
Sync `setValue()` returns `void` and propagates thrown errors.
Async `setValue()` returns `Promise<void>` and propagates rejected handlers.

Current source paths that inform the implementation:

- `packages/module/es/src/types/t object/t proxy/f/t any/createObservable/r s/p p/index.ts`
- `packages/module/es/src/types/t object/t proxy/f/t any/createObservable/r a/p p/index.ts`

Tests must cover get/set behavior, old and new callback values, update-before-callback order, sync throw propagation,
async await behavior, and async rejection propagation.

## Consumer migration

### `webapp-productivity/rss`

`rss` moves from `module-es/map-iterable-async` and `module-es/memoize-async` to package-root imports:

```ts
import { mapIterableAsync, } from '@monochromatic-dev/module-async-iter';
import { memoizeAsync, } from '@monochromatic-dev/module-memoize';
```

Add package dependencies:

- `@monochromatic-dev/module-async-iter`
- `@monochromatic-dev/module-memoize`

Remove `@monochromatic-dev/module-es` from `rss/package.json` after both imports are migrated.

### `webapp-search/exa-search`

`exa-search` moves from `module-es/create-observable` to the package root:

```ts
import {
  createObservable,
  type Observable,
} from '@monochromatic-dev/module-observable';
```

Update all observable consumers from `.value` reads and writes to `getValue()` and `setValue()`.
Known current consumers are in:

- `packages/webapp-search/exa-search/src/client-dom.ts`
- `packages/webapp-search/exa-search/src/client.ts`

Add `@monochromatic-dev/module-observable` to `exa-search/package.json`.
Remove `@monochromatic-dev/module-es` after the migration.

## `module-es` cleanup boundary

Round 1 removes only migrated named export entries from `packages/module/es/package.json`, and only after all current
external source imports are migrated.

Remove these named subpaths:

- `./create-observable`
- `./create-observable-async`
- `./map-iterable-async`
- `./memoize-async`

Do not remove source files from `packages/module/es/` in round 1.
Do not remove the `./binary` export.
Do not remove `./ts` or `./ts/*`.
The `./ts` and `./ts/*` entries remain source escape hatches until a later round decides the package-wide policy.

## Dependency cleanup

Round 1 removes all 18 currently unused `@monochromatic-dev/module-es` manifest dependencies listed in the context
section.
This cleanup belongs in a separate commit after active consumers have migrated.
That keeps dependency-graph cleanup reviewable and prevents it from hiding code migrations.

Run the workspace install task after package manifest edits so lockfile changes are intentional.

## Active guidance cleanup

Round 1 updates active guidance that points new memoization users at `module-es`.
Known active references include:

- `AGENTS.md`: module-root `let` guidance that recommends `memoize()` from `@monochromatic-dev/module-es`
- `packages/config/oxlint/src/rules/restriction.ts`
- `packages/config/oxlint-no-restricted-syntax/src/rules/no-module-root-let.ts`

Update these to point at `@monochromatic-dev/module-memoize` after the new package exists.
If `AGENTS.md` changes, regenerate managed outputs through file-enforcer instead of editing generated files directly.

Historical audits and handover notes do not need a repo-wide rewrite in round 1.

## Issue updates

### Already settled

Issue #184 is closed as `NOT_PLANNED`.
No further action is required unless the issue needs a link to the revised doc.

### Add correction comments

Add a correction comment to #93 because an earlier comment said round 1 renames `mapIterableAsync` to `asyncMap`.
Use this decision instead:

```md
Correction to the earlier #185 round-1 comment: the new `@monochromatic-dev/module-async-iter` package keeps the
export name `mapIterableAsync`. It preserves the current eager, unbounded, collect-to-array behavior. Future lazy async
iterator helpers remain in this issue for a later round.
```

Add a supplemental comment to #183:

```md
Round 1 now extracts `@monochromatic-dev/module-kv-store` before `@monochromatic-dev/module-memoize`,
because the current memoize implementation depends on the store abstraction. `memoize` and `memoizeAsync` still move to
`@monochromatic-dev/module-memoize`. `debounce`, `throttle`, and `curry` remain blocked on round 2.
```

### Create follow-up issues

Close #185 after this revised decision doc lands and the follow-up issues are created.
Create two issues:

1. Round 1 implementation issue.
   Use one ordered checklist rather than package-per-issue tracking.
2. Round 2 planning issue.
   This issue defines destinations for the next batch of `module/es` symbols and becomes the human-readable target for
   deferred work.

Keep the existing `blocked-on-185-r2` label.
It currently marks 21 open deferred issues and does not need to be renamed.
Add comments to deferred issues pointing at the new round-2 planning issue when it exists.

### Create tsdown audit issue

Create a separate audit issue for runtime-export packages that lack tsdown setup.
The audit should cover packages with JavaScript or TypeScript public entrypoints and document explicit exceptions for
fixtures, assets, typefaces, config-only packages, and other non-runtime packages.

Current measured drift includes 10 `packages/module/*` packages missing tsdown config or build task references, but the
audit should cover runtime exports across the workspace rather than module packages only.

## Round-1 implementation order

Each step is a minimum logical unit and should be committed after verification.

1. Create `@monochromatic-dev/module-kv-store` with full tsdown setup, README, implementation, and ported tests.
2. Create `@monochromatic-dev/module-memoize` with full tsdown setup, README, implementation, and ported tests.
3. Create `@monochromatic-dev/module-async-iter` with full tsdown setup, README, implementation, and tests.
4. Create `@monochromatic-dev/module-observable` with full tsdown setup, README, implementation, and tests.
5. Migrate `webapp-productivity/rss` to `module-async-iter` and `module-memoize`.
6. Migrate `webapp-search/exa-search` to `module-observable` and the method-based observable API.
7. Remove the 18 unused `module-es` manifest dependencies and refresh package manager state.
8. Remove migrated named subpath exports from `packages/module/es/package.json`.
9. Update active memoize guidance to point at `module-memoize`.
10. Add GitHub correction comments.
11. Create the round-1 implementation issue, the round-2 planning issue, and the tsdown audit issue.

## Verification

Per-package verification for each new package:

```sh
mise run //packages/module/<package>:build
mise run //packages/module/<package>:lint
mise run //packages/module/<package>:test
```

Targeted consumer verification:

```sh
mise run //packages/webapp-productivity/rss:lint:types
mise run //packages/webapp-productivity/rss:test
mise run //packages/webapp-search/exa-search:build
mise run //packages/webapp-search/exa-search:lint
mise run //packages/webapp-search/exa-search:test
```

Workspace dependency verification after manifest edits:

```sh
mise run prepare:pnpm:install
```

Repository-wide verification after all implementation commits:

```sh
mise run build
mise run lint
mise run test
```

Import and manifest checks after migration:

```sh
rg -n "from ['\"]@monochromatic-dev/module-es" packages --glob '!packages/module/es/**'
rg -n '"@monochromatic-dev/module-es"' packages --glob package.json --glob '!packages/module/es/package.json'
rg -n '"\./(create-observable|create-observable-async|map-iterable-async|memoize-async)"' \
  packages/module/es/package.json
rg -n '"\./ts"|"\./ts/\*"' packages/module/es/package.json
```

Expected results:

- first command returns no external source imports
- second command returns no external package declarations
- third command returns no migrated named subpaths
- fourth command confirms source escape hatches remain

User-boundary verification for `exa-search` must load the built page in a browser and confirm no console errors.
It must exercise every rewritten observable path:

- API key read and update
- total-search count increment
- result-count input update

## Out of scope for round 1

- Deleting `packages/module/es/`
- Removing any `module/es` source file
- Removing `module-es` `./ts` or `./ts/*`
- Adding runtime subpath exports to the new packages
- Renaming `packages/module/` to another package family
- Choosing destinations for deferred symbols outside the four round-1 concepts
- Fixing all existing tsdown drift in the same PR
- Adding `asyncFilter`, `asyncReduce`, `asyncTake`, `asyncSkip`, `asyncBatch`, or `asyncParallel`
- Adding `debounce`, `throttle`, or `curry`
- Changing memoize cache key format
- Making `undefined` a cache hit
- Changing `mapIterableAsync` concurrency behavior
