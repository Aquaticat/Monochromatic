# Decision: filesystem backend for kv-store

Records the design options for adding a filesystem-backed `StorageBackend` to
`@monochromatic-dev/module-kv-store`, the constraints that eliminate some of them, and the rankings
among the survivors. Written for a fresh reviewer: the mechanism choice and the sync-browser
persistence choice are still open, and a second opinion is wanted before implementation.

## Context

kv-store ships a multi-backend key-value store (sync and async variants) whose default backend is a
single in-memory `Map`. It advertises itself as runtime-neutral and exposes
`configureDefaultBackendsBuilder` (`src/backends-async.ts:100`) as a hook for a platform to register
persistent backends, but **no filesystem backend was ever shipped**. The README only gestures at one
("for example a file or OPFS backend", `README.md`).

The trigger: `packages/dev-script/file-enforcer` hand-rolled a persisted staleness manifest
(in-memory cache, dirty-set, `process.on('exit')` flush, JSON read/write) to survive cold one-shot
`mise run` invocations, when the persistence half of that work is exactly what a kv-store filesystem
backend abstracts. Filling the kv-store gap lets that plumbing, and memoize's persistence story, lean
on one audited backend instead of ad-hoc code.

## Backend contracts

Both contracts live in `src/types.ts`:

-   `StorageBackend` (async, `src/types.ts:153`): `get` returns `Promisable<string | undefined | null>`,
    `set` and `delete` return `Promisable<unknown>`, optional `priority`, optional `clear`.
-   `SyncStorageBackend` (sync, `src/types.ts:199`): `get` returns `string | undefined`, `set` and
    `delete` return synchronously, optional `priority`, optional `clear`, optional `size`.

A filesystem backend that satisfies both contracts feeds `createStore` (async) and `createSyncStore`
(sync), which back `memoizeAsync` and `memoize` respectively.

## Constraints

Decided already (do not relitigate unless a constraint is wrong):

1.  Stays inside kv-store. Not a companion package.
2.  Going public very soon. The built subpath exports are the real API; `./ts/*` source imports are an
    escape hatch, not the public surface. No YAGNI trimming of the public surface.
3.  Both node and browser consumers must import from built `dist` using the **same specifier**.
4.  Both variants ship: async `createFileBackend` and sync `createSyncFileBackend`.
5.  Browser async persistence uses OPFS (Origin Private File System), not IndexedDB. OPFS is the
    filesystem API (matching "fs" semantics) and is supported in Firefox 111+, Safari 15.2+, and
    Chromium 86+, so the repo's Firefox ESR 140 baseline is clear.

Structural facts about the package:

-   Runtime-neutral core. `node:fs` is node-only and must never load at module-evaluation time in the
    neutral build, or a browser crashes on import.
-   The package builds a neutral bundle (`dist/final/neutral`) and a node bundle (`dist/final/node`)
    from the same `src/index.ts` (`tsdown.browser.config.ts`, `tsdown.node.config.ts`). The base
    configs hardcode `entry: ['./src/index.ts']` (`packages/config/tsdown/src/index.ts`,
    `index.node.ts`).
-   Cross-package workspace imports resolve to TypeScript source via `./ts` and `./ts/*`
    (`package.json`), so workspace consumers can reach any `src/*` file directly.

## The logger precedent

`packages/module/logger` already ships browser-specific and node-specific backends, so it is the
reference. What it actually does:

-   One universal bundle. `src/logger.ts` statically imports every sink (`console`, `opfs`,
    `session-storage`, `file`) at `src/logger.ts:1-16` and selects among them at runtime.
-   Runtime detection per sink. Each sink exposes a `verify()`; `initialize()` runs them once at module
    load (`src/logger.ts:83-107`).
-   Node-only code stays out of the neutral evaluation path by two devices, both in `src/sinks/file.ts`:
    -   node APIs are imported **type-only** (`import type { stat } from 'node:fs/promises'`,
        `file.ts:1-5`), which erases at build time.
    -   the real import is a **dynamic, guarded** `await import('node:fs/promises')` inside `runVerify`
        (`file.ts:148`), reached only after `globalThis.process?.versions?.node` confirms node
        (`file.ts:132-141`). A browser short-circuits before any `node:` URL is fetched.
-   The browser sink (`src/sinks/opfs.ts`) detects via `navigator.storage.getDirectory()`
    (`opfs.ts:43`) and writes on the main thread with `createWritable()` (`opfs.ts:65`).
-   The `package.json` `.` export's `node` and `default` conditions are build-target tuning only; both
    builds carry every sink from the same source.

The decisive limitation for this decision: **every logger sink is async** (`write` returns a Promise),
and the node path depends on `await import('node:fs')`. A dynamic import is asynchronous, so the logger
pattern cannot implement a synchronous backend. A static `import { readFileSync } from 'node:fs'`
would, in the neutral bundle, load `node:fs` at module evaluation and crash a browser on import. So a
sync filesystem backend forces `node:fs` entirely out of the neutral bundle, which only per-runtime
builds achieve.

## Options

### Option 1: logger-style universal bundle plus runtime detection

One `src/backend-fs.ts`, type-only node imports, dynamic guarded `import('node:fs')`, OPFS on the
browser path. Mirrors logger exactly.

-   Pros:
    -   Maximum consistency with the established logger pattern.
    -   One source file; one shared `.d.mts` that is honest by construction (one implementation
        surface).
    -   Same specifier resolves and works in both runtimes.
    -   No new export keys and no tsdown entry changes; reuses the existing node/default build split.
-   Cons:
    -   Cannot deliver the sync variant (constraint 4): dynamic import is async-only, and static
        `node:fs` in the neutral bundle crashes a browser at evaluation.
    -   Both platforms' code ships in both bundles (dead code per runtime).

### Option 2: per-runtime conditioned builds

`src/backend-fs.node.ts` (static `node:fs`) and `src/backend-fs.browser.ts` (OPFS), exporting identical
signatures. A `./fs` export maps the `node`, `browser`, and `default` conditions to the two builds with
one shared `types`.

-   Pros:
    -   Delivers async and sync cleanly: static imports work in sync code.
    -   Each bundle holds only its platform's code; no dead cross-platform code.
    -   Same specifier; both conditions resolve to real built files; shared types stay honest because
        both builds export the identical surface.
-   Cons:
    -   Diverges from logger's runtime-detection style (two patterns in the codebase for "platform
        backends").
    -   Requires tsdown entry overrides in both configs and explicit shared-types wiring (the two
        builds emit separate `.d.mts` files; one must be designated canonical, or the shared types must
        live in a neutral types-only module both impls import).

### Option 3: hybrid

Async `createFileBackend` via Option 1 (universal plus dynamic import); sync `createSyncFileBackend` via
Option 2 (per-runtime files).

-   Pros:
    -   Async path stays logger-consistent.
    -   Sync path uses the only mechanism that works for it.
-   Cons:
    -   Two mechanisms inside one feature; the least internally uniform and the most to document.

### Option 4 (eliminated): node-only `./fs` subpath

A `./fs` export exposing only a `node` condition. Eliminated by constraint 3: a browser importing
`./fs` hits a "no matching export condition" resolution error, so both runtimes cannot share the
specifier.

### Option 5 (eliminated): companion package

A separate `@monochromatic-dev/module-kv-store-fs` depending on the core's `StorageBackend` type.
Eliminated by constraints 1 and 3: a different specifier, plus a second package.json, mise.toml,
README, version, and build to keep in sync against the core type.

## Rankings

Mechanism, for the chosen async-plus-sync scope: **Option 2 > Option 3 > Option 1.**

-   Option 2 over Option 3: both deliver async and sync behind one specifier, but Option 2 uses one
    mechanism for both variants where Option 3 uses two; internal uniformity decides it.
-   Option 3 over Option 1: Option 3 delivers the sync variant (constraint 4); Option 1's dynamic-import
    pattern cannot implement a sync backend at all.

The tension a fresh reviewer should weigh: constraint toward logger consistency pulls up Option 1 and
Option 3, but Option 1 fails the sync requirement outright, and Option 3 buys logger consistency for
the async half at the price of a split internal structure. If logger consistency is valued above
internal uniformity, Option 3 is the logger-consistent option that still ships sync.

## Sync browser persistence

Relevant only because the sync variant ships. An earlier draft ranked "OPFS-Worker-only" first; that
was a defect. A file-per-key sync OPFS backend is not implementable, for two independent reasons.

-   Per-key handle acquisition is async. `navigator.storage.getDirectory()`,
    `getFileHandle(name, { create })`, and `createSyncAccessHandle()` all return Promises, and the sync
    access handle is Web Worker-only. The `SyncStorageBackend` contract (`src/types.ts:207`) requires
    `get`, `set`, and `delete` to be synchronous for any key, including one first seen at `set` time, so
    there is no synchronous way to open that key's file. Only operations on an already-open
    `FileSystemSyncAccessHandle` are synchronous.
-   Filename hashing is async in the browser. SHA-256 via `SubtleCrypto.digest()` returns a Promise, so
    a sync backend cannot derive a hashed filename synchronously. node's `node:crypto` `createHash` is
    synchronous, so the node sync backend is unaffected; this blocker is browser-specific.

The data-sharing-parity argument that drove the earlier ranking does not hold either. A sync OPFS
backend cannot use file-per-key, so its on-disk layout would differ from the async file-per-key OPFS
backend, and the two would not interoperate without also rewriting the async backend around the same
container format. The cited parity benefit does not exist without a much larger redesign.

Implementable choices:

-   localStorage:
    -   Pros: synchronous on the main thread for arbitrary keys, persistent, universal; localStorage
        keys are arbitrary strings, so no filesystem-safe filename and no async hashing is needed.
    -   Cons: roughly 5MB origin cap; not a filesystem; a browser sync store and async store do not
        share data, unlike node where both point at the same fs directory.
-   Single pre-opened OPFS container file (Worker-only):
    -   Pros: keeps data in OPFS; synchronous operations after an async setup.
    -   Cons: Worker-only; abandons file-per-key for one container that needs its own format,
        compaction, and versioning; a sync access handle takes an exclusive lock, so concurrent backends
        on the same file conflict; still does not interoperate with the async file-per-key backend.

Revised ranking: **localStorage > single-container OPFS**, decided by which option satisfies a
synchronously-constructible, main-thread sync backend for arbitrary keys. localStorage does; the
container design is Worker-only and is a separate storage format, warranted only if browser sync must
live in OPFS.

Note on the factory shape: making `createSyncFileBackend` an async factory (returning a backend whose
operations are sync) does not by itself rescue file-per-key OPFS, since a key first seen after
construction still needs an async handle. The async-setup-then-sync-ops shape only works combined with
the single pre-opened container.

## Open questions for the reviewer

1.  Mechanism: Option 2 (recommended), Option 3, or Option 1 (which would reverse the async-plus-sync
    decision).
2.  Sync browser persistence: localStorage (recommended) or single-container OPFS (Worker-only). A
    file-per-key sync OPFS backend is not implementable.
3.  Whether logger consistency should outweigh internal uniformity, which is the crux of Option 2
    versus Option 3.

## Cross-cutting design notes (apply to whichever option wins)

-   Key-to-filename encoding crosses a syntax boundary (arbitrary string key into a filesystem path).
    Keys carry `/`, `:`, and path separators, and exceed the 255-byte filename limit. Hash the key
    (sha256 hex) for the filename rather than encoding it, and add adversarial filename tests
    (path traversal tokens, separators, long keys, empty key) per the boundary-encoding rule in
    AGENTS.md. The node backends hash with `node:crypto` `createHash` (synchronous); the async browser
    backend can hash with Web Crypto. The browser sync backend (localStorage) sidesteps hashing
    entirely by using raw arbitrary-string keys, since `SubtleCrypto.digest()` is async.
-   Writes should be atomic (write to a temp sibling, then rename) so a concurrent reader never observes
    a torn file; the file-enforcer manifest's plain `writeFileSync` lacked this.
-   `get` returns `undefined` on a missing entry (ENOENT), and rethrows other errors.
-   `clear` and `size` operate over the backend's own directory; distinguish data files from temp files
    by a dot-free name predicate (sha256 hex has no dot; temp names do).
-   Verification must run at the user boundary: exercise the real built artifact against a throwaway
    directory (`mktemp -d`), and drive the OPFS path through a real browser via `agent-browser`, since
    bun cannot evaluate OPFS.
