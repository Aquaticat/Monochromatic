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
`mise run` invocations, which is the kind of persistence a kv-store filesystem backend abstracts. The
immediate goal is shipping the backend for memoize's persistence story. Whether file-enforcer adopts
memoize or this backend is undecided and may stay that way; the backend is built to stand on its own
regardless.

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

## Hidden hazards (verified against the running store)

A probe ran the real `createStore` with stub backends to observe consensus, healing, and eviction.
Setup, reproducible in the package directory:

```ts
// seed a "file" backend with a real serialized value, then read it back behind a cold Map
const file = mapBackend([]);                 // get/set/delete over a Map, optional priority
const s0 = await createStore({ backends: [file] });
await s0.set('k', { v: 42 });                // file now holds '{"json":{"v":42}}'
const cold = mapBackend([]);                 // empty, default priority 0
const s1 = await createStore({ backends: [cold, file] });
await s1.get('k');                           // observe
```

Observed results:

-   `[Map(p0, empty), file(p0, value)]` **throws** `store.get consensus failure ... no majority in
    highest tier`. Two equal-priority backends disagree (one ABSENT, one value); `pickMajority`
    requires a bucket strictly larger than `floor(total / 2)`, and 1 is not greater than 1
    (`src/consensus.ts:85`, `src/consensus.ts:127`).
-   `[file]` alone returns the value, and ABSENT for a missing key. No throw, and healing writes nothing
    because the sole value already equals canonical (`src/heal.ts:48`).
-   `[Map(p0), file(p1)]` returns the value and heals the Map to match (read-through populate,
    `src/heal.ts:48-53`).
-   `[Map(p1, empty), file(p0, value)]` returns ABSENT **and deletes the value from the file**: a cold
    higher-priority cache makes canonical ABSENT, and healing deletes every backend that held a value
    (`src/heal.ts:42-45`). Silent data loss.

### Hazard 1: safe only as the sole backend or the strictly-highest-priority one

The natural "in-memory cache in front, file behind" layering (`[Map, file]`, equal priority) throws on
the first cold read. Giving the cache higher priority is worse: a cold cache deletes the persisted
value. For pure persistence, use the file backend as the **sole** backend (`backends: [fileBackend]`),
which sidesteps consensus. Layer only with the file at strictly highest priority, and only for backend
redundancy, not caching.

### Hazard 2: layering buys no read acceleration

`get` queries every backend on every call (`src/backends-async.ts:43-55`, `src/backends-sync.ts:40-51`);
there is no try-fast-then-fallback short-circuit. A Map in front of the file does not avoid the disk
read. "Map caches, file persists" is false for this store; every read hits the file.

### Hazard 3: in-memory LRU does not bound a persistent backend

The LRU key set is an in-memory `Set` created fresh per store construction (`src/create-store.ts:117`,
`src/lru-key-set.ts`), so a one-shot process starts with an empty LRU while the file backend may already
hold many files. Eviction is driven by in-session access count against `maxSize`, so pre-existing files
are never pruned across sessions and the directory grows without bound; eviction can also drop a
just-relevant key while ancient files persist. An LRU policy gives a persistent backend no cross-session
capacity bound. The backend needs its own pruning, or this limit must be documented for consumers.

### Hazard 4: write atomicity differs by runtime

The node backend can write a temp sibling then `rename` for atomic replacement. OPFS has no atomic
per-key rename (`FileSystemHandle.move` support is limited), so the async OPFS backend writes via
`createWritable` then `close` (logger notes `getFile()` reads stale content while a writable is open,
`packages/module/logger/src/sinks/opfs.ts:60`); a crash mid-write can leave a partial file. Durability
is not uniform across the two builds; state this in the public contract.

### Hazard 5: the backend must implement clear, and sync size hits disk

`store.clear()` only clears a backend that exposes `clear` (`src/create-store.ts:226`); a file backend
without `clear()` makes `store.clear()` a silent no-op. The sync store reports `.size` from
`backends[0].size` (`src/create-sync-store.ts:143`), so if the file backend exposes `size` via
`readdir`, every `.size` read (for example memoize's) performs disk IO.

### Hazard 6: file-per-key IO granularity versus bulk-load consumers

A file-per-key backend turns a bulk read into one `stat`-plus-read per key. file-enforcer's manifest
loads every entry from one JSON file once per process (`loadManifest`,
`packages/dev-script/file-enforcer/src/io/staleness-manifest.ts:248`), and a no-op run reads all entries
to check staleness. Backing that with a file-per-key kv-store backend makes the same check N reads
instead of one. A no-op run writes nothing either way, so the cost is read fan-out, not writes. The fs
backend suits key-by-key access; a consumer that loads its whole keyspace at once may keep a single-file
store. Whether file-enforcer adopts memoize or this backend is undecided and may stay that way; if it
ever does, this read fan-out is the property to weigh against its current single-manifest load.
Shipping the backend for memoize does not depend on that decision.

### Hazard 7: only node-family and browser-main-thread runtimes are served

The export map resolves `node` to the node:fs build and everything else (`browser`, `default`) to the
OPFS build. An edge runtime (for example Cloudflare Workers) resolves `default` to the OPFS build but
has neither `node:fs` nor main-thread OPFS, so the backend fails there at runtime. The async backend
needs a browser main thread for OPFS, and the sync browser backend needs localStorage. State the
supported runtime matrix in the public contract.

### Hazard 8: the sync store does not content-address empty keys

The async store derives a key from the value hash when the key is empty (`src/create-store.ts:151`); the
sync store writes the literal empty key (`src/create-sync-store.ts:153`), so every empty-key sync `set`
collides on one file. memoize requires a `keyFn`, so keys are non-empty in that path; the hazard is for
direct sync-store callers.

### Hazard 9: a flat per-key directory degrades at large keyspaces

`clear` and `size` `readdir` the whole directory, and a single flat directory holding many thousands of
key files slows those operations and stresses some filesystems. Shard by a hash prefix (for example the
first two hex characters as a subdirectory) if large keyspaces are expected. memoize's default LRU bound
(1024) caps this for memoize, but a directly-constructed unbounded store does not (see Hazard 3).

### Hazard 10: the built-export wiring is partly unprecedented

Overriding `entry` to emit a second module per build is precedented: `deps-cube`'s
`tsdown.node.config.ts` spreads the base config and sets `entry: ['./src/index.ts', './src/cli.ts']`,
landing both as `.mjs` in one `outDir`. Changing this package's tsdown config is allowed (not required).
What no repo package does yet is ship a built subpath whose `node` and `browser` conditions resolve to
divergent built files; that part is new here, so validate the emitted filenames, the per-entry `.d.mts`,
and condition resolution under both Node and a bundler before relying on it. Two placements are
possible: expose `./fs` as a new subpath (isolates the divergence, leaves the `.` entry untouched), or
fold the backend into `.` (reuses the existing `node`/`default` conditions but requires splitting
`index.ts` into per-runtime entry files). `./fs` is the smaller change.

### Hazard 11: memoize salt rotation orphans persistent entries

memoize composes the cache key as `${argKey}:${salt}` (`buildCacheKey`,
`packages/module/memoize/src/cache-key.ts:24`) and never deletes the previous salt's entry; a salt
change writes a new key and stops reading the old one (`packages/module/memoize/src/memoize-async.ts:218`,
and the README's `String(time % 3600000)` hourly-expiry pattern). With an in-memory store, orphaned
entries evict under LRU. With a persistent file backend they do not (Hazard 3: an in-memory LRU does not
bound a persistent backend across sessions), so every salt rotation orphans a file that nothing removes.
The salt feature's headline use case, time-bucketed expiry, becomes one new dead file per key per bucket,
unbounded. memoize's `delete` takes the full `${argKey}:${salt}` key (`memoize-async.ts:235`), so there
is no "delete all salts for an argKey" operation; pruning superseded salts is manual. A persistent
memoize cache needs an eviction story the file backend enforces itself (size or age cap), or salt
rotation paired with explicit deletion of superseded keys. memoize itself may be changed (for example a
key model that supersedes prior salts for an `argKey`, or built-in salt pruning), so the fix is not
confined to the backend.

### Non-blockers confirmed

-   Type libs are sufficient. `@monochromatic-dev/config-typescript/dom` sets
    `lib: ['ESNext', 'DOM', 'WebWorker']` (`packages/config/typescript/README.md:12`), so both platform
    files type-check under one tsconfig, including the WebWorker-only `FileSystemSyncAccessHandle`.
-   Bun and Deno resolve the `node` export condition through their node-compat layers, so the node:fs
    build serves the repo's Bun runtime (file-enforcer) as well as Node.
-   Workspace consumers import TypeScript source via `./ts/*`, which bypasses export conditions, so they
    import the per-runtime file directly (`backend-fs.node.ts`); conditions apply only to the built
    `./fs` specifier.
-   Under Option 2, `dts: true` emits one `.d.mts` per entry per build; the `./fs` `types` condition
    points at one, so both impls should conform to a shared neutral types-only module to prevent drift.

## Open questions for the reviewer

1.  Mechanism: Option 2 (recommended), Option 3, or Option 1 (which would reverse the async-plus-sync
    decision).
2.  Sync browser persistence: localStorage (recommended) or single-container OPFS (Worker-only). A
    file-per-key sync OPFS backend is not implementable.
3.  Whether logger consistency should outweigh internal uniformity, which is the crux of Option 2
    versus Option 3.
4.  Eviction: an LRU policy does not bound a persistent backend (Hazard 3). Decide between the backend
    self-pruning by a size cap and documenting unbounded growth as accepted.
5.  Usage shape: confirm the sole-backend recommendation (Hazard 1). Consumers wanting persistence pass
    `backends: [fileBackend]` rather than layering a Map in front.

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
-   Namespace each store. A file backend writes under a per-`storeId` subdirectory so `clear`, `size`,
    and eviction never touch another store's files; the localStorage sync backend prefixes keys with the
    `storeId` so it never collides with other origin data.
-   `set` propagates storage-full errors. node `ENOSPC`, OPFS and localStorage `QuotaExceededError`
    surface to the caller, since the store does not catch backend `set` failures
    (`src/create-store.ts:154`).
-   The localStorage sync backend must detect unavailability (private-browsing mode or disabled storage
    throws on access) and fail construction clearly rather than at first use.
-   Verification must run at the user boundary: exercise the real built artifact against a throwaway
    directory (`mktemp -d`), and drive the OPFS path through a real browser via `agent-browser`, since
    bun cannot evaluate OPFS.
