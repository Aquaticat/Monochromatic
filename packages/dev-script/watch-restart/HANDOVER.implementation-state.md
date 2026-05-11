# Handover: watch-restart implementation in progress

## What you are picking up

The package `packages/dev-script/watch-restart/` is being built per the approved plan at `/home/user/.claude/plans/plan-this-first-question-abstract-hopcroft.md`. Read that plan first; it has the full design, the option matrix that produced each decision, and the verification checklist. The original product handover at `packages/desktop-daemon/editord/HANDOVER.custom-dev-server-watcher.md` has the architectural rationale (the failures we are excluding by construction, the chokidar-vs-watchman analysis, etc.).

Tasks 1 and 2 are done. Tasks 3 through 10 remain. The package builds and lints clean with a placeholder `src/index.ts`.

## State on disk (verified before this handover)

```
packages/dev-script/watch-restart/
├── HANDOVER.implementation-state.md  ← this file
├── README.md                          ← committed; CLI surface and design choices
├── mise.toml                          ← extends-only tasks; no concrete runs yet
├── package.json                       ← name, bin (src/cli.ts), exports, dependencies
├── src/
│   └── index.ts                       ← placeholder; `export const placeholder = true`
├── tsconfig.json
└── tsdown.node.config.ts
```

`pnpm-workspace.yaml` gained two catalog entries: `chokidar: '>=5.0.0'` and `picomatch: '>=4.0.4'`. `pnpm install` ran cleanly; 2 packages were added (chokidar + readdirp as chokidar's transitive). `readdirp` is intentionally **not** in the catalog or in `dependencies`: it is a chokidar internal that we do not import directly.

Verification at this checkpoint:

- `mise run //packages/dev-script/watch-restart:build` → exits 0, emits to `dist/final/node/`.
- `mise run //packages/dev-script/watch-restart:lint` → 0 warnings, 0 errors.
- `mise run //packages/dev-script/watch-restart:lint:types` → exits 0.

## Decisions made during implementation that the plan did not pin

The plan said "chokidar + readdirp to catalog." `readdirp` is chokidar's only transitive dep; we do not import it directly anywhere, so the catalog gains chokidar only. Catalog also gains `picomatch` because the plan's `globFilter()` implementation uses it directly. `picomatch` is already a transitive in the workspace via tsdown/rolldown/tinyglobby (per `AUDIT.md`); we adopt the same major (4.x).

The plan said `bin: { watch-restart: <tsdown output for cli.ts> }`. I went with `bin: { watch-restart: src/cli.ts }` instead, matching `packages/dev-script/task-util`. The shebang `#!/usr/bin/env bun` handles TS execution at runtime; no separate build step is needed for the CLI. Library consumers still hit `dist/final/node/index.js` per `exports["."]`. If the implementer prefers shipping a pre-built CLI to `dist/`, the path is `dist/final/node/cli.js` — but the cost (rebuild before invocation) outweighs the cold-start saving on a long-running dev loop.

The plan's `WatchCtx` shape was `{ logger, signal }`. The implementer should add `hashCache: HashCache` to `WatchCtx` so `contentHashFilter()` can run as a stateless predicate over a shared cache. Rationale: the watcher pre-populates the cache during chokidar's initial walk (events before `ready`); the filter does live comparison after `ready`. Both need the same `Map<absolutePath, sha256hex>`, so the cache lives in the orchestrator (start.ts) and is passed via `ctx`. Without this, `contentHashFilter()` cannot share state with the pre-population step.

When implementing per-instance state (HashCache, the running watcher, the child process), use a class with `#private` state. Precedent: `packages/desktop-daemon/editord/src/server/operations/watch-filesystem.ts:45-130` (`DirWatcher`). AGENTS.md "Composition over inheritance; `readonly` and `#private` by default" applies; classes are not banned, only inheritance is discouraged. file-enforcer prefers module-level state via top-level `const map = new Map()`, but that pattern only works for one cache per process; we need one per `startWatchRestart()` call.

## Pending tasks (in order)

The task list IDs match `TaskList` entries.

3. **Implement `hash-cache.ts` + tests.** Class `HashCache` with `#private` `Map<string, string>` and `#maxHashSize: number`. Methods: `hashFile(absolutePath): Promise<string | null>` (returns null if file size > maxHashSize), `get`, `has`, `set` (use destructured `{ path, hash }`), `delete`, `size`. Uses `crypto.subtle.digest('SHA-256', uint8array)` directly (no module-es hash helper; that one hashes strings, we hash file bytes). Tests cover hashFile round-trip, maxHashSize cap, get/set/delete/has behaviour, size accounting.

4. **Implement `watcher.ts` + tests.** chokidar 5 adapter. Constructs `chokidar.watch(paths, { atomic: true, awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }, ignoreInitial: false, ignored: <exclude globs from include/exclude/ext flag-compiled matcher> })`. Listens for `add`, `change`, `unlink`, `ready`, `error`. Pre-`ready` events: pre-populate hash cache (await `hashCache.hashFile(path)`, then `hashCache.set({path, hash})`) and do not emit. Post-`ready` events: normalise to `WatchEvent` and emit to the orchestrator. Exposes `stop(): Promise<void>` to call `chokidar.close()`. Tests use a temp dir and `fs.promises.writeFile` to simulate events; verify atomic-save (rename `_tmp` → file), debounce coalescing, deletion.

5. **Implement `child.ts` + tests.** `spawn(command, args, { stdio: 'inherit' })` from `node:child_process`. State machine: idle → running → stopping → idle. `restart()` sends SIGTERM, awaits exit (or SIGKILL after `stopTimeout`), spawns a new child. `stop()` likewise. Tests stub `child_process.spawn` via sinon; verify SIGTERM-then-SIGKILL escalation, stdio passes through unchanged, restart on running process kills the prior one first.

6. **Implement built-in filters + tests.** Files: `filters/content-hash.ts`, `filters/ext.ts`, `filters/glob.ts`, `filters/compose.ts`. `contentHashFilter()` returns `WatchFilter` that reads `ctx.hashCache`. `extFilter(extensions)` checks `event.ext` against the array; case-insensitive; leading dot optional. `globFilter({ include, exclude })` uses `picomatch` to build matcher functions and tests `event.path` (or `event.relativePath`?). `composeFilters(...)` returns a filter that short-circuits on first `false` (all-of). `anyFilter(...)` short-circuits on first `true` (any-of). Tests for each: include/exclude/both, case sensitivity for ext, async-predicate composition, ctx.signal abort propagation.

7. **Implement `start.ts` + tests.** `startWatchRestart(options)` orchestrates: build HashCache → build chokidar watcher → build child wrapper → compose flag-derived filter with user `filter?` → on each post-ready event run the filter chain; if it passes, debounce-then-restart. Returns `{ stop }`. The flag-to-filter compilation logic can either live inline or be extracted to `flags-to-filter.ts` (task 8 splits it out). Tests use a temp dir, write files, assert restart spy was called the expected number of times.

8. **Implement `cli.ts` + `flags-to-filter.ts` + tests.** CLI: `#!/usr/bin/env bun` shebang, `@optique/core` + `@optique/run`, mirror `packages/dev-script/task-util/src/command.ts:54-82`. Flags: `-w`, `-i`, `-e`, `--ext`, `--events`, `--no-content-changed`, `--max-hash-size`, `--debounce`, `--stop-timeout`, `--no-initial`, plus `--` rest. `flags-to-filter.ts` compiles the parsed flag bag into a `WatchFilter` (composing `globFilter` and `extFilter`). The cli passes options through to `startWatchRestart` and awaits its handle; handles SIGINT/SIGTERM by calling `handle.stop()`. Tests stub `startWatchRestart` and assert option mapping.

9. **Switch editord `dev:server` to `watch-restart`.** Add `"@monochromatic-dev/dev-script-watch-restart": "workspace:*"` to `packages/desktop-daemon/editord/package.json` dependencies. Rewrite the `dev:server` task in `packages/desktop-daemon/editord/mise.toml` from `watchexec -w src/server --no-meta -r -- bun src/server/index.ts` to `watch-restart -w src/server -- bun src/server/index.ts`. Drop the comment block above the task. Run `pnpm install` to link the workspace dep. Verify end-to-end per the plan's "Verification" section (start the server, edit a file, watch the restart; touch a file, no restart; Ctrl+C, clean shutdown).

10. **Create `TROUBLESHOOTING.mise-watch.md` + tick AUDIT.md.** Lift the failure-mode analysis from the handover (`HANDOVER.custom-dev-server-watcher.md`) into `packages/desktop-daemon/editord/TROUBLESHOOTING.mise-watch.md`. Two sections: "EADDRINUSE from deep process trees on restart" (SIGTERM not propagating through `watchexec → mise → nu → bun`) and "watchexec `-j` filter program hangs on SIGINT" (Tokio reference cycle in `FilterProgs::new`). Both include the upstream-bug analysis and the workaround note: the loop has migrated off watchexec entirely. Update `AUDIT.md`: tick `chokidar` and remove the empty `watcher` line (or tick it with note that we picked chokidar instead).

## Workspace conventions the implementer must follow

These rules come from `AGENTS.md`; the implementer should re-read it but these specifically apply to this work:

- Tagged loggers from `@monochromatic-dev/module-logger`. Compose tags at every module/function boundary. See `packages/dev-script/file-enforcer/src/log.ts` for the root-tag pattern.
- Function declarations only; no arrow functions, no const-bound function expressions. Class methods are fine. Callbacks dictated by external APIs (chokidar event handlers, `child_process.on('exit', ...)`) get named function expressions: `function handleAdd(path) { ... }`.
- 2+ parameter functions use a destructured object parameter: `set({path, hash})`, not `set(path, hash)`. Exception: external-API callback shapes.
- Trailing commas everywhere per dprint. Match the style in `packages/dev-script/file-enforcer/src/io/cache.ts`.
- TSDoc on every declaration. Include `@example` tags. Don't use `the`/`a`/`an` in `@param`/`@returns`; explain why, not what.
- `const` over `let`. Module-root `let` is hard-banned by oxlint; use `Map`/`WeakMap`/IIFE-into-const. Function-root `let` is also banned outside the named-IIFE escape hatch.
- No `switch`. Use if/else or `Record` lookups.
- `async`/`await` only; no `.then()`/`.catch()`. `using`/`await using` for cleanup; no `try...finally`.
- `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!`. `outdent` from `@cspotcode/outdent` for multi-line error messages. Both already in `package.json`.
- Throw on unreachable branches. Never silently discard unexpected states.
- File max-lines is enforced; remediate by splitting (re-export from `index.ts`, move helpers to siblings, types to `types.ts`). Never disable or work around.

## Test harness

`@monochromatic-dev/module-test` provides `describe`, `it`, `expect`. Top-level usage: `await describe({ name: '', children: [...] })`. Pattern from `packages/dev-script/file-enforcer/src/io/cache.unit.test.ts`. Tests live next to source files as `*.unit.test.ts`. Use `mkdtemp` + `rm` for filesystem fixtures.

## Verification before declaring task complete

After each implemented module:

```
mise run //packages/dev-script/watch-restart:build
mise run //packages/dev-script/watch-restart:lint
mise run //packages/dev-script/watch-restart:lint:types
mise run //packages/dev-script/watch-restart:test:unit
```

All four must exit zero. `lint:types` builds the tsbuildinfo and can lag the source by a step; rebuild if you suspect a stale type cache.

Final verification (after task 9) lives in the plan's "Verification (end-to-end)" section. Cases 5 to 11 require running the dev server interactively; case 12 (`rg 'watchexec'`) and case 13 (cross-package import smoke test) are mechanical.

## Hand-off

The plan, this handover, and the in-tree state are mutually consistent. The next agent's first move is task 3 (hash-cache.ts + tests). Do not re-litigate the design questions; they are resolved in the plan with the option matrix that produced each call. If a new question surfaces during implementation, write the rationale into this file and proceed.
