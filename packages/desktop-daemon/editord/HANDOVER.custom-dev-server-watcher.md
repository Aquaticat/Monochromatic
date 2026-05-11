# Handover: extract editord's dev-server watcher into a standalone dev-script package

## What you are picking up

editord's dev loop currently shells out to `watchexec` for file-watching and bun-process restart. The relevant task is in `packages/desktop-daemon/editord/mise.toml`:

```toml
run = "watchexec -w src/server --no-meta -r -- bun src/server/index.ts"
```

Two earlier rounds of work landed pieces that you should treat as the starting state, not the destination:

1.  `--no-meta` suppresses `Modify(Metadata(Any))` events. Documented in `TROUBLESHOOTING.mise-watch.md`.
2.  `saveFile` in `src/server/operations/save.ts` short-circuits when on-disk content already matches the requested write. Commit `27051b66`. The earlier `-j @content-changed.jaq` filter on watchexec was dropped because watchexec hangs on SIGINT when `-j` is used (`TROUBLESHOOTING.mise-watch.md`, "watchexec `-j` filter program hangs on SIGINT").

What is still on watchexec and what this handover is about:

-   External editors (vim, vscode) doing format-on-save with byte-identical output still trigger a restart. The save-side skip cannot see those writes because they do not pass through editord. Rare but real.
-   `watchexec` is an external native binary for a single dev task in a TypeScript-first monorepo, with documented architectural failure modes (SIGINT hang, signal propagation through process trees) the project has paid for once already.
-   No other workspace package has a clean way to reuse the watch-and-restart pattern; `watch:build:css` is the obvious near-term candidate to also benefit from a content-hash filter.

## The decision

Create a new dev-script package at `packages/dev-script/watch-restart/` (npm name `@monochromatic-dev/dev-script-watch-restart`). It exposes:

-   A library API (`startWatchRestart(...)`) for programmatic use.
-   A CLI bin entry `watch-restart` mirroring the watchexec invocation shape used today.

editord's `dev:server` task becomes a thin consumer of that package's CLI. The package is workspace-internal (`private: true`), built and consumed via pnpm catalog the same way `dev-script-file-enforcer` is.

For the watching layer use **chokidar 5** (the current major; verified by cloning `paulmillr/chokidar`, `package.json` shows `5.0.0`). For the restart driver use a small `node:child_process.spawn` wrapper. The previous "stay editord-local" recommendation is overridden: the watcher stands on its own as a package.

The save-side content-equality skip in `save.ts` stays. It is independently good and complements the watcher (cheaper than a watcher firing and re-hashing for an editord-internal save).

## Alternatives and prior art

Two orthogonal axes; conflating them muddles the comparison. Pick one from each.

### Axis 1: file watching

| Option | Cost to add | Fit | Notes |
|---|---|---|---|
| **chokidar 5** | new workspace dep (chokidar + readdirp, both maintained by paulmillr) | strong | `atomic: true` handles rename+create atomic saves out of the box; `awaitWriteFinish` handles chunked writes; recursive watching cross-platform. Production user list spans webpack, rollup, vite, gulp. Listed in `AUDIT.md` as "to evaluate"; adopting it here clears that item. |
| `@parcel/watcher` | new dep with native binding (prebuilt binaries per OS/arch) | viable | Native C++ via N-API; very fast; recursive native everywhere. Adds compile/install surface (prebuilds usually work but failure mode is uglier than a JS lib). Used in Parcel, Lit. |
| `watcher` (`fabiospampinato/watcher`) | new dep, no transitive deps | acceptable | Smaller alternative to chokidar; listed in `AUDIT.md` separately from chokidar. Less production track record than chokidar. |
| native `node:fs/promises.watch` | zero deps | viable but more code | The path `packages/dev-script/file-enforcer/src/watch/` already takes; ~150 LOC plus tests for atomic-save, debounce, hash-compare. Not a great fit for a *package* deliverable that should minimize surprise. |
| `watchman` | external native daemon | overkill | Facebook's daemon, requires user install, separate process. Designed for very large repos. |

### Axis 2: restart driver

| Option | Cost to add | Fit | Notes |
|---|---|---|---|
| **custom `child_process.spawn` wrapper** | ~80 LOC | strong | Direct control over signal propagation. Disqualifies the watchexec-style "SIGTERM does not reach the grandchild" failure mode by construction (one level of process tree). Tested pattern: `packages/desktop-daemon/editord/src/server/operations/spawn-detached.ts`. |
| `nodemon` | new dep | poor | Designed to wrap Node, not Bun; assumes JS modules; no first-class content-hash filter; configuration is JSON-file-driven; restart semantics rely on Node module-cache invalidation that does not apply to Bun. |
| `pm2` | new dep, heavy | poor | Production process manager, not a dev tool. Out of scope. |
| `bun --watch` / `bun --hot` | zero | does not fit | (a) watches the **import graph**, not the source tree, so files not imported at startup do not trigger; (b) no content-hash filter, byte-identical writes still restart; (c) `--hot` is HMR-like (preserves state) which is the wrong semantics for a server that holds sockets/tokens; (d) `--watch` restart semantics under stdio inherit are undocumented for our config. Save the planning agent the detour. |
| `watchexec` (current) | already installed via mise | rejected | The whole reason for this work. SIGINT hang with `-j` (analyzed in `TROUBLESHOOTING.mise-watch.md`); process-tree signal propagation problems also documented. |

### Recommendation

**chokidar 5 + custom `child_process.spawn` wrapper.**

The two failures we already paid for (signal propagation in deep process trees, SIGINT hang) both stem from wrapping a process with a tool whose internal async model we cannot inspect. A direct `spawn` keeps the tree one level deep, which makes signals trivially reliable. The watching layer is the part where reaching for a battle-tested library is worth the dependency: chokidar handles atomic-save rename+create natively, debouncing, cross-platform recursion, and the edge cases the prior-art `file-enforcer` watcher had to reimplement.

If the planning agent disagrees and prefers native `fs.watch` (matching `file-enforcer`'s pattern), the package shape and API are unchanged; only the watcher implementation differs. State the choice in the package README so future readers see the trade-off without re-deriving it.

## The hash cache stays regardless of library choice

Chokidar's `atomic: true` detects `mv _tmp file` atomic saves and emits a single `change` event for them. `awaitWriteFinish` waits for chunked writes to settle before firing. **Neither suppresses byte-identical writes.** An external editor with format-on-save that produces identical output emits `change` under chokidar, under `@parcel/watcher`, and under native `fs.watch` alike.

The byte-identical case is exactly the failure mode the original watchexec `-j @content-changed.jaq` filter targeted. The replacement is a `Map<absolutePath, sha256hex>` content-hash cache: on every event, re-hash the file and compare. Different hash, restart and store. Same hash, skip silently. Deletion or first-seen, store without restart (first-seen) or trigger (deletion).

Do not remove the hash cache when adopting chokidar. The settle-detection is orthogonal.

## Why standalone package

The previous handover argued for keeping the watcher editord-local under "Three similar lines is better than a premature abstraction" (`AGENTS.md`). That decision is overridden because:

-   The watcher needs its own README, tests, and stable API to "stand on its own"; a package is the existing workspace shape for that.
-   Watchexec's failure modes are not editord-specific. Any package that wraps a long-running process for development would hit them. Centralizing the fix avoids the rule's other failure mode: hard-coding a pattern into one consumer makes the second consumer reimplement it.
-   `AUDIT.md` already lists `chokidar` and `watcher` as "to evaluate". Adopting one here gives a concrete reason for the eval and a single integration point.
-   The package can later absorb `watch:build:css` (which currently runs `mise watch -w src/client -g '...' -r -- build:css`) when content-hash filtering becomes worth the move. The library API supports that without a second extraction.

## Package shape

Follow `packages/dev-script/file-enforcer` as the closest existing model (library + CLI; build to `dist`; published surface via `exports`). `packages/dev-script/task-util` is the next closest (CLI-only with multiple `bin` entries) but the watcher needs a library export, so file-enforcer is the better template.

-   `packages/dev-script/watch-restart/package.json`: name `@monochromatic-dev/dev-script-watch-restart`, `private: true`, `main`/`exports` pointing at the built dist plus a `./ts` export for direct source consumption (file-enforcer pattern), `bin.watch-restart` pointing at the CLI entry.
-   `packages/dev-script/watch-restart/mise.toml`: `extends`-only tasks for `build`, `build:js:node`, `watch:build:js:node`, `lint`, `lint:types`, `lint:oxlint`, `test:unit`.
-   `packages/dev-script/watch-restart/tsdown.node.config.ts`: same pattern as file-enforcer.
-   `packages/dev-script/watch-restart/tsconfig.json`: workspace standard.
-   `packages/dev-script/watch-restart/README.md`: motivation, CLI usage, library usage, the chokidar-vs-fs.watch choice with reason.
-   `packages/dev-script/watch-restart/src/index.ts`: CLI entry, `#!/usr/bin/env bun` shebang. Library export goes through a separate `mod.ts` or named exports in `index.ts`; pick whichever matches file-enforcer's current layout when you read it.
-   `packages/dev-script/watch-restart/src/`: split files to stay under the max-lines limit. Suggested decomposition (the planning agent finalizes):
    -   watcher (chokidar adapter, event normalization)
    -   hash-cache (Map of path -> sha256 hex; uses the helper at `packages/module/es/src/types/t string/f/t string/hash/`)
    -   child-process (spawn/restart/stop with SIGTERM-then-SIGKILL timeout)
    -   cli (argument parsing via `@optique/run` consistent with task-util)
    -   logger (use `@monochromatic-dev/module-logger` per `AGENTS.md`)
-   Unit tests at `*.unit.test.ts` covering: byte-identical save produces no restart, atomic rename with new content fires once, two writes inside the debounce window coalesce to one restart, deletion fires once, SIGTERM exits cleanly within ~1s.

### CLI surface

Mirror the subset of watchexec flags the project uses, so the editord `mise.toml` change is mechanical:

```
watch-restart -w <dir> [-w <dir>...] [--debounce <ms>] [--stop-timeout <ms>] -- <cmd> [<args>...]
```

No `-r` flag (restart-on-change is the only mode). No `-j`/filter DSL (the hash cache subsumes it). No `--no-meta` (metadata-only changes produce identical hashes and are skipped by construction).

The exact library API signature (`startWatchRestart(...)` and any auxiliary exports) is left to the planning agent. The CLI surface above is the only consumer contract this handover commits to.

### editord consumer side

-   `packages/desktop-daemon/editord/package.json`: add `@monochromatic-dev/dev-script-watch-restart` to `dependencies` (workspace dep).
-   `packages/desktop-daemon/editord/mise.toml`: `dev:server.run` becomes `watch-restart -w src/server -- bun src/server/index.ts`. Remove the watchexec comment block; replace with a one-liner pointing at this package.

## Signal handling constraint (carries over)

This is the constraint that disqualifies several "easy" restart options and the planning agent needs it written down:

-   watchexec hung on SIGINT because of an internal reference cycle. We cannot adopt a tool whose async runtime we cannot inspect.
-   The earlier `watchexec → mise → nu → bun` chain dropped SIGTERM and orphaned bun. Anything that introduces a process layer between the watcher and the server is suspect.
-   Direct `proc.kill('SIGTERM')` against the spawned bun child, with a 5-second timer and SIGKILL fallback, matches the documented `--stop-timeout 0` discussion in `TROUBLESHOOTING.mise-watch.md` and keeps the tree one level deep.

## Scope

In scope:

-   New package `packages/dev-script/watch-restart/` as described.
-   Add chokidar (and its single dep `readdirp`) to the pnpm catalog and the new package's `dependencies`.
-   Update editord's `package.json` and `mise.toml` to consume it.
-   Amend `TROUBLESHOOTING.mise-watch.md`: the watchexec sections stay (they are upstream-bug documentation). Update the "Workaround" paragraph of the SIGINT-hang section to note the loop has migrated off watchexec entirely. The save-side skip section stays accurate.

Out of scope:

-   Any change to `watch:build:js:client`, `watch:build:js:node`, `watch:build:css`. These do not use `-j` and are not in the failure mode we are addressing. Migrating them is a separate decision once the library API has settled.
-   Any change to the editord runtime `DirWatcher` at `src/server/operations/watch-filesystem.ts`. That watches user files served to the browser, not server source files.
-   Any change to `save.ts` content-equality skip. Keep it.
-   Filing the upstream watchexec patch. The draft is in `TROUBLESHOOTING.mise-watch.md` and is a separate task.
-   Cross-platform recursive logic for macOS or Windows beyond what chokidar handles for free. Chokidar already abstracts FSEvents and ReadDirectoryChangesW; the planning agent verifies, the package documents.
-   Persisting the hash cache to disk. In-memory is correct: a process restart re-scans and treats files as first-seen, no spurious restart.

## Acceptance criteria

1.  `packages/dev-script/watch-restart/` exists with `README.md`, `package.json`, `mise.toml`, `tsconfig.json`, `tsdown.node.config.ts`, and `src/`.
2.  `mise run //packages/dev-script/watch-restart:build` succeeds and produces a runnable `dist/`.
3.  `mise run //packages/dev-script/watch-restart:lint` exits zero.
4.  `mise run //packages/dev-script/watch-restart:lint:types` exits zero.
5.  `mise run //packages/dev-script/watch-restart:test:unit` passes; tests cover at minimum the five cases listed under "Unit tests" above.
6.  `mise run //packages/desktop-daemon/editord:dev:server` starts the bun server through `watch-restart`, prints startup logs, and responds to HTTP on the configured port.
7.  Editing any file under `src/server/` with new content triggers exactly one restart; previous bun process exits, new bun process starts on the same port (no `EADDRINUSE`).
8.  Saving a file under `src/server/` with byte-identical content from any source (editord's own save handler *or* an external editor) produces no restart.
9.  `touch src/server/index.ts` produces no restart. The hash compare short-circuits a metadata-only event.
10. Ctrl+C in the dev terminal exits the watcher within ~1 second. The bun child exits. The terminal prompt returns. A subsequent `mise run //packages/desktop-daemon/editord:dev:server` succeeds.
11. `kill -TERM <pid>` against the watcher process produces the same clean shutdown.
12. The bun child's stdout and stderr appear in the dev terminal unchanged (stdio inherit; do not buffer or transform).
13. `rg 'watchexec' packages/desktop-daemon/editord/` returns no matches (the binary may still resolve via `mise install`; the editord package no longer references it).
14. A second consumer can import the library: `import { startWatchRestart } from '@monochromatic-dev/dev-script-watch-restart'` resolves through the workspace, types check, and a smoke test in the package exercises the API surface that consumers would use.

## Files to touch

-   `packages/dev-script/watch-restart/` (new package, structure above)
-   `pnpm-workspace.yaml`: add `chokidar` and `readdirp` to the catalog (or confirm chokidar's transitive `readdirp` does not need its own catalog entry, depending on workspace conventions; check sibling additions like `nano-spawn`).
-   `packages/desktop-daemon/editord/package.json`: add workspace dep on `@monochromatic-dev/dev-script-watch-restart`.
-   `packages/desktop-daemon/editord/mise.toml`: rewrite `dev:server.run`; replace the watchexec comment block with a one-liner pointing at this package.
-   `TROUBLESHOOTING.mise-watch.md`: amend the SIGINT-hang section's "Workaround" paragraph; preserve the upstream-bug analysis and draft issue.
-   `AUDIT.md`: tick `chokidar` (or `watcher`, depending on what the planning agent picks) as evaluated, with a one-line reason and the package path that uses it.

## Files to leave alone

-   `packages/desktop-daemon/editord/src/server/`: server runtime; the watcher is dev-loop-side.
-   `packages/desktop-daemon/editord/src/server/operations/save.ts`: keep the content-equality skip.
-   `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts`: editord runtime watcher for browser-served files. Different concern.
-   `watch:build:js:*` and `watch:build:css` tasks: out of scope.
-   `packages/dev-script/file-enforcer/src/watch/`: reference implementation; do not refactor. The new package borrows the shape but uses chokidar instead of `fs.watch`.

## Reference material

-   Watchexec failure-mode analysis (the constraint that disqualifies wrapper-tool restart options): `TROUBLESHOOTING.mise-watch.md`, sections "EADDRINUSE from deep process trees on restart" and "watchexec `-j` filter program hangs on SIGINT".
-   Prior-art directory watcher (native `fs.watch`): `packages/dev-script/file-enforcer/src/watch/watch-dir.ts:37-79`.
-   Prior-art watcher orchestration with debounce and abort: `packages/dev-script/file-enforcer/src/watch/watch.ts:34-168`.
-   Prior-art `DirWatcher` class with debounce and per-path suppression (heavier than needed but shows the per-path classify pattern): `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts:45-271`.
-   Save-side content-equality skip (already shipped, do not modify): `packages/desktop-daemon/editord/src/server/operations/save.ts:31-77`.
-   SHA-256 hex helper in `@monochromatic-dev/module-es`: `packages/module/es/src/types/t string/f/t string/hash/`; exported through the package's standard surface.
-   Package shape template: `packages/dev-script/file-enforcer/{package.json,mise.toml,tsdown.node.config.ts,tsconfig.json}`.
-   CLI shape template (for the bin entry and argument parser choice): `packages/dev-script/task-util/`.
-   Chokidar 5 verification: cloned from `paulmillr/chokidar`; `package.json` reports `5.0.0` with single dep `readdirp ^5.0.0`; `awaitWriteFinish` and `atomic` are first-class options; `engines.node >= 20.19.0`.
-   `AGENTS.md` rules: TS-only dev scripts (no bash), tagged loggers from `@monochromatic-dev/module-logger`, package-completeness (README + zero-error lint + tests on every code path), max-lines remediation by splitting.
