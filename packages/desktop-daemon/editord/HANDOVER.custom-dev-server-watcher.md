# Handover: replace watchexec in editord's dev:server with a TypeScript watcher

## What you are picking up

editord's dev loop currently shells out to `watchexec` for file-watching and bun-process restart. Look at `packages/desktop-daemon/editord/mise.toml`, task `dev:server`:

```toml
run = "watchexec -w src/server --no-meta -r -- bun src/server/index.ts"
```

A previous round of work landed two things that you should treat as the starting state, not the destination:

1.  `--no-meta` suppresses `Modify(Metadata(Any))` events (commit predating this handover; documented in `TROUBLESHOOTING.mise-watch.md`).
2.  `saveFile` in `src/server/operations/save.ts` now short-circuits when on-disk content already matches the requested write. That commit (`27051b66`) dropped the watchexec `-j @content-changed.jaq` filter because the filter triggered a watchexec hang on SIGINT (also documented in `TROUBLESHOOTING.mise-watch.md`). It solves the dogfooding case (editord saving its own source) at the source, so removing `-j` did not regress that workflow.

What is still on watchexec at this point and what this handover is about:

-   External editors (vim, vscode) doing format-on-save with byte-identical output still trigger a restart. The save-side skip cannot see those writes because they do not pass through editord. This is rare, but it is real and currently unhandled.
-   `watchexec` remains an external native binary dependency in the dev loop for a single task in a TypeScript-first monorepo, with documented architectural failure modes (SIGINT hang, signal propagation through process trees) that the project has already paid for once.

The job: take watchexec out of `dev:server` and put a small TypeScript watcher in its place. Keep the save-side skip (it stays useful regardless: it cuts disk I/O and avoids spurious mtime touches).

## The decision

Write a single-package TypeScript watcher inside `packages/desktop-daemon/editord/src/dev-server/` that:

1.  Watches `src/server/` for content changes via `node:fs/promises.watch` (async iterator), one watcher per subdirectory, walked at startup.
2.  Compares each event's file content against an in-memory hash cache. Writes the new hash and triggers a restart only when the hash differs from the stored value. First-seen files store silently (no restart on initial scan).
3.  Spawns `bun src/server/index.ts` as a direct child, tracks its pid, and on a content-change event sends SIGTERM, awaits exit, then respawns.
4.  Installs SIGINT and SIGTERM handlers on its own process that propagate to the child and exit cleanly.

`dev:server` becomes `bun src/dev-server/index.ts`. No external watchexec binary. The watcher is editord-local, not a shared monorepo module: see "Why not a shared module right now" below.

## Why this path

The earlier round of work framed a custom watcher as expensive because it would inherit watchexec's edge cases. That framing was wrong on the merits, and the team is correcting it. Honest accounting:

-   **Atomic saves (rename+create)**. `fs.watch` on Linux/inotify emits both `rename` and `change` events. Treat `rename` as "the file might have new content; re-hash" and the behavior is identical to a write. About five lines, not a project.
-   **Symlinked sources**. `src/server/` has none. `fs.watch` follows them by default on Linux. Not a real obstacle for this scope; revisit only if a symlink ever appears in that tree.
-   **Recursive watching on macOS**. Bun's `Bun.watch` and newer Node `fs.watch` both support `{ recursive: true }` natively on macOS via FSEvents and on Windows via `ReadDirectoryChangesW`. On Linux we walk the tree once at startup and watch each directory non-recursively, matching what `file-enforcer/src/watch/watch.ts` already does.
-   **Inotify ENOSPC**. Kernel limit. `watchexec` hits it identically. Not a unique cost.
-   **Signal handling through process trees**. This is where watchexec *failed*. The TROUBLESHOOTING doc records: `-j` causes a permanent SIGINT hang because of a reference cycle in watchexec's async runtime, and the earlier `watchexec → mise → nu → bun` chain dropped SIGTERM and orphaned bun. A direct-spawn TS watcher is `proc.kill('SIGTERM')` one level down. **Easier for us than for watchexec.**

So the watcher inherits no real cost from watchexec's robustness story. The story watchexec sells is mostly features we don't need (a filter DSL with a kv store, a complex multi-runtime async actor model, cross-platform recursive support behind a wrapper) bundled with failures we have already hit.

Cost estimate: ~150 lines of source plus a unit-test file. There is prior art in the repo to copy from, not invent:

-   `packages/dev-script/file-enforcer/src/watch/watch-dir.ts` (79 lines): single-directory `fs.watch` async-iterator loop with `AbortSignal` teardown. Direct model for our per-directory watcher.
-   `packages/dev-script/file-enforcer/src/watch/watch.ts` (168 lines): top-level orchestration, `setupWatchers` / `closeAllWatchers`, debounce timer, `AbortController` per directory. Direct model for our orchestration.
-   `packages/dev-script/file-enforcer/src/watch/watch-filter.ts` (138 lines): event classification pattern. Useful shape, but our filter is simpler (only one kind of event matters here).
-   `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts` (271 lines): `DirWatcher` class with debounce and per-path suppression. Useful for the debounce pattern; the class shape is heavier than we need for the dev-server watcher.

You are gluing existing patterns, not designing a watcher from scratch.

## Why not a shared module right now

A shared module (`packages/dev-script/dev-watcher/` or similar) is tempting but pre-emptive. Concrete evidence:

-   Only one mise task in the entire workspace uses watchexec `-j`: editord's `dev:server`. Verify with `rg "watchexec" -t toml -g '!node_modules' .`.
-   `watch:build:js:client` and `watch:build:js:node` use `tsdown --watch` (tsdown's internal watcher, not watchexec).
-   `watch:build:css` in editord uses `mise watch -w src/client -g '...' -r -- build:css` (plain mise watch, no `-j`, no SIGINT hang reported).

The only second consumer that could plausibly appear is if `watch:build:css` later needs content-hash filtering. That's hypothetical. Ship the watcher local to editord first. If a second consumer materializes, lift it into `packages/dev-script/dev-watcher/` then. AGENTS.md is explicit on this point ("Three similar lines is better than a premature abstraction").

## Scope

In scope:

-   New directory `packages/desktop-daemon/editord/src/dev-server/`.
-   New file `src/dev-server/index.ts`: entry point. Top-level code per the project rule on Bun-runnable TS (no `main()` wrapper). Should not exceed the project max-lines limit; if it would, split into `watcher.ts`, `child-process.ts`, `hash-cache.ts`, and a tiny `index.ts` that wires them.
-   New file `src/dev-server/watcher.ts`: per-directory `fs.watch` loops, debounce, hash-cache lookup.
-   New file `src/dev-server/child-process.ts`: spawn bun, track pid, kill on SIGTERM with timeout, respawn.
-   New file `src/dev-server/hash-cache.ts`: `Map<string, string>` of absolute path to SHA-256 hex. Use the existing helper in `@monochromatic-dev/module-es` (search the `es` package for the SHA-256 hex function; the path is nested under the `t string` tree).
-   Optional but recommended: unit tests at `src/dev-server/watcher.unit.test.ts` covering atomic-save rename, content-equal skip, content-different fire, debounce coalescing. Use `node:fs/promises` against a temp directory; do not stub `fs.watch`.
-   Update `packages/desktop-daemon/editord/mise.toml`: `dev:server.run` becomes `bun src/dev-server/index.ts`. Remove the `watchexec` comment block; replace with a one-liner pointing at this handover's outcome.
-   Update `TROUBLESHOOTING.mise-watch.md`: the watchexec sections stay (they are upstream-bug documentation), but the "Resolved by removing `-j`..." paragraph in the SIGINT section should be amended to note that the loop has since been migrated off watchexec entirely. The save-side skip section stays accurate.

Out of scope:

-   Any change to `watch:build:js:client`, `watch:build:js:node`, `watch:build:css`. These do not use `-j` and are not in the failure mode we are addressing.
-   Any change to the editord runtime `DirWatcher` at `src/server/operations/watch-filesystem.ts`. That is a separate concern: it watches user files served to the browser client, not server source files.
-   Any change to `save.ts` content-equality skip. Keep it. It is independently good.
-   Any extraction into a shared module under `packages/dev-script/` or `packages/module/`.
-   Any filing of the upstream watchexec patch. The draft is in `TROUBLESHOOTING.mise-watch.md`; it is a separate task.
-   Any cross-platform recursive logic for macOS or Windows. Single-platform Linux suffices for this iteration. If a macOS dev wants in, add `{ recursive: true }` once and document.
-   Any persistence of the hash cache to disk. In-memory is correct: a process restart re-scans, files are first-seen, no spurious restart.

## Design sketch

`src/dev-server/index.ts` is the orchestrator:

```ts
// src/dev-server/index.ts
import { startWatcher, } from './watcher.ts';
import { ChildProcess, } from './child-process.ts';

const child = new ChildProcess({ command: 'bun', args: ['src/server/index.ts'], },);
await child.start();

const watcher = startWatcher({
  rootDir: 'src/server',
  onContentChange: async function restartOnChange(path,): Promise<void> {
    await child.restart();
  },
},);

function shutdown(signal): void {
  watcher.stop();
  void child.stop().then(function exit(): void {
    process.exit(0,);
  },);
}
process.on('SIGINT', shutdown,);
process.on('SIGTERM', shutdown,);
```

`src/dev-server/watcher.ts` exposes a `startWatcher({ rootDir, onContentChange }) => { stop }` function. Internally:

1.  Walk `rootDir` once with `readdir({ recursive: true, withFileTypes: true })` (Node 20+) or with a small recursive walk, collecting subdirectories.
2.  For each subdirectory, spawn an async iterator from `fs.watch(dir, { signal })`.
3.  For each event with a non-null filename, debounce per absolute path (~100 ms, matches `file-enforcer`).
4.  After debounce, read the file, hash it, compare to the in-memory map. If different, store and call `onContentChange(absolutePath)`. If equal, store silently. If the file is gone (rename without create), drop the cache entry and call `onContentChange` (deletion should trigger restart so the server picks up the deletion).
5.  `stop()` aborts every controller and clears the cache.

`src/dev-server/child-process.ts` exposes a small class:

```ts
class ChildProcess {
  constructor({ command, args, }: { command: string; args: readonly string[]; }): void;
  start(): Promise<void>;
  restart(): Promise<void>; // SIGTERM + wait + spawn
  stop(): Promise<void>;    // SIGTERM + wait
}
```

Use `node:child_process.spawn` rather than `Bun.spawn` initially; `nano-spawn` is overkill since we need long-running and incremental signalling. Keep stdio inherited so the bun server's logs land in the dev terminal unchanged. Track exit via the `'exit'` event. Restart logic: send SIGTERM, race against a 5-second timer; on timeout, send SIGKILL (matches the documented `--stop-timeout 0` discussion in TROUBLESHOOTING).

`src/dev-server/hash-cache.ts` is a thin wrapper around `Map<string, string>` with `read`, `write`, `delete`. The SHA-256 function lives in `@monochromatic-dev/module-es`; reference it once and pass the hex string through.

Three concrete behaviors to verify in tests:

1.  Write same bytes twice → second write produces no restart.
2.  `rename(tmp, target)` atomic save with new bytes → produces a restart.
3.  Two writes within the debounce window → produces exactly one restart.

## Files to touch

-   `packages/desktop-daemon/editord/src/dev-server/index.ts` (new)
-   `packages/desktop-daemon/editord/src/dev-server/watcher.ts` (new)
-   `packages/desktop-daemon/editord/src/dev-server/child-process.ts` (new)
-   `packages/desktop-daemon/editord/src/dev-server/hash-cache.ts` (new)
-   `packages/desktop-daemon/editord/src/dev-server/watcher.unit.test.ts` (new, recommended)
-   `packages/desktop-daemon/editord/mise.toml`: only the `dev:server` task's `run` field and its comment.
-   `packages/desktop-daemon/editord/package.json`: no new runtime dependencies needed. `@monochromatic-dev/module-es` is already a workspace dep.
-   `TROUBLESHOOTING.mise-watch.md` (root): amend the "Workaround" paragraph of the SIGINT-hang section to reflect the migration; preserve the upstream-bug analysis and draft issue.

## Files to leave alone

-   `packages/desktop-daemon/editord/src/server/`: server runtime. The watcher is on the dev-loop side, not the server side.
-   `packages/desktop-daemon/editord/src/server/operations/save.ts`: keep the content-equality skip. It complements the watcher (cheaper than a watcher firing and re-hashing for an editord-internal save).
-   `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts`: editord runtime watcher for files served to the browser. Different concern, different lifetime.
-   The `watch:build:js:*` and `watch:build:css` tasks: out of scope.
-   `packages/dev-script/file-enforcer/src/watch/`: this is the reference implementation. Do not refactor it; copy the shape into the new module.

## Acceptance criteria

1.  `mise run //packages/desktop-daemon/editord:dev:server` starts the bun server, prints its startup logs, and responds to HTTP on the configured port.
2.  Editing any file under `src/server/` with new content triggers exactly one restart: previous bun process exits, new bun process starts on the same port (no `EADDRINUSE`).
3.  Saving a file under `src/server/` with byte-identical content from any source (editord's own save handler *or* an external editor) produces no restart.
4.  `touch src/server/index.ts` produces no restart. This currently relies on `--no-meta` at the watchexec layer; for the TS watcher, achieve the same by comparing hashes: a metadata-only change does not change the file hash, so the hash compare short-circuits.
5.  Ctrl+C in the terminal exits the watcher within ~1 second. The bun child exits. The terminal prompt returns. A subsequent `mise run //packages/desktop-daemon/editord:dev:server` succeeds.
6.  `kill -TERM <pid>` against the watcher process produces the same clean shutdown.
7.  The bun child's stdout and stderr appear in the dev terminal unchanged (stdio inherit; do not buffer or transform).
8.  `mise run //packages/desktop-daemon/editord:lint:types` exits zero.
9.  `mise run //packages/desktop-daemon/editord:lint` exits zero against the new files.
10. `mise run //packages/desktop-daemon/editord:test:unit` includes the new tests and they pass.
11. `package.json` has no new entries.
12. `which watchexec` may still resolve (the tool stays installed via mise), but `rg 'watchexec' packages/desktop-daemon/editord/` returns no matches.

## Reference material

-   The watchexec failure modes that motivated this work: `TROUBLESHOOTING.mise-watch.md` (sections "EADDRINUSE from deep process trees on restart" and "watchexec `-j` filter program hangs on SIGINT").
-   Prior-art directory watcher: `packages/dev-script/file-enforcer/src/watch/watch-dir.ts:37-79`.
-   Prior-art orchestration: `packages/dev-script/file-enforcer/src/watch/watch.ts:34-168`.
-   Prior-art event classification (heavier than needed but shows the per-path classify pattern): `packages/dev-script/file-enforcer/src/watch/watch-filter.ts:64-108`.
-   Prior-art debounce + suppression (class-shaped, heavier than needed): `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts:45-271`.
-   Save-side content-equality skip (already shipped, do not modify): `packages/desktop-daemon/editord/src/server/operations/save.ts:31-77`.
-   SHA-256 hex helper in `@monochromatic-dev/module-es`: located under `src/types/t string/f/t string/hash/r a/p p/index.ts`; exported through the package's standard surface.
-   AGENTS.md rule against bash scripts and in favor of `mise.<action>.ts` TS scripts (relevant for the entry-point shape).
-   AGENTS.md rule "Three similar lines is better than a premature abstraction" (anchors the "stay local to editord" decision).
