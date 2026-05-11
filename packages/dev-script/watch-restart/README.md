# @monochromatic-dev/dev-script-watch-restart

Watch source files and restart a long-running child process on content change.

Replaces `watchexec` in editord's dev loop and is reusable as a library for any
workspace dev server. Two failures the previous loop paid for are excluded by
construction: signal propagation through deep process trees (the watcher owns
one child, not a tree), and the SIGINT hang from watchexec's `-j` filter (no
filter DSL, no embedded interpreter).

## Why a package

editord originally shelled out to `watchexec -w src/server --no-meta -r --
bun src/server/index.ts`. Two failure modes documented in
`packages/desktop-daemon/editord/TROUBLESHOOTING.mise-watch.md` motivated the
replacement: a Tokio reference-cycle SIGINT hang in watchexec's jaq filter
mode, and SIGTERM not reaching grandchildren through the `watchexec → mise → nu
→ bun` chain. A workspace-local TypeScript implementation pins the runtime we
can audit (chokidar plus `child_process.spawn`) and exposes a library API that
other dev servers in the workspace can reuse without learning a new tool.

The save-side content-equality skip in
`packages/desktop-daemon/editord/src/server/operations/save.ts` is unchanged
and complementary: editord's own writes never reach the watcher, and the
watcher's content-hash filter catches byte-identical writes from external
editors (vim, vscode) that bypass save.ts entirely.

## CLI

```text
watch-restart [-w <dir>...] [-i <glob>...] [-e <glob>...] [--ext <ext>...]
              [--events <list>] [--no-content-changed] [--max-hash-size <bytes>]
              [--debounce <ms>] [--stop-timeout <ms>] [--no-initial]
              -- <cmd> [<args>...]
```

editord's invocation:

```bash
watch-restart -w src/server -- bun src/server/index.ts
```

### Flags

- `-w`, `--watch <dir>`: directory to watch recursively. Repeatable. Required.
- `-i`, `--include <glob>`: include glob, OR'd across repeats. Default: everything.
- `-e`, `--exclude <glob>`: exclude glob, OR'd across repeats; suppresses on match. Default: none.
- `--ext <ext>`: file-extension shorthand (with or without dot). Repeatable; comma list accepted. ANDs with `--include` if both supplied.
- `--events <list>`: comma-separated subset of `create,change,delete`. Default: all three.
- `--no-content-changed`: pass byte-identical writes through. Default: byte-identical writes are skipped.
- `--max-hash-size <bytes>`: files above this size bypass the hash compare and always fire. Default: `16777216` (16 MiB).
- `--debounce <ms>`: coalesce events within this window into one restart. Default: `100`.
- `--stop-timeout <ms>`: SIGTERM-then-SIGKILL grace period. Default: `5000`.
- `--no-initial`: skip the initial run; only restart on events. Default: run immediately.

The CLI does not accept a filter expression. Compositions beyond
`AND-of-categories with OR-within-category` (e.g. `(A AND B) OR (C AND D)`)
fall back to the library API's `filter?` option, which accepts a TypeScript
predicate function. This is a deliberate design choice; see
`HANDOVER.custom-dev-server-watcher.md` for the analysis.

## Library

```ts
import {
  startWatchRestart,
  contentHashFilter,
  extFilter,
  globFilter,
  composeFilters,
  anyFilter,
  type WatchEvent,
  type WatchCtx,
  type WatchFilter,
} from '@monochromatic-dev/dev-script-watch-restart';

const handle = await startWatchRestart({
  paths: ['src/server'],
  command: 'bun',
  args: ['src/server/index.ts'],
  extensions: ['.ts'],
  contentChanged: true,
  debounce: 100,
  stopTimeout: 5000,
});

// later:
await handle.stop();
```

`filter` accepts a custom predicate that is AND'd with the flag-derived filter.
Use this for boolean compositions the CLI flags cannot express.

## Choices

- **chokidar 5** for file watching, not `@parcel/watcher` (native install
  surface), `fabiospampinato/watcher` (smaller production track record),
  native `fs.watch` (atomic-save and chunked-write handling is on us), or
  watchman (daemon designed to amortise across many tools; one project is the
  wrong scale).
- **Custom `child_process.spawn` wrapper** for restart, not `nodemon`
  (Node-only restart semantics), `pm2` (production process manager), or
  `bun --watch` / `--hot` (watches the import graph, no content-hash filter,
  HMR-like semantics wrong for a server with sockets/tokens).
- **No DSL filter language**. Structured CLI flags compile down to a
  TypeScript predicate internally; the library API's `filter?` covers cases
  the flag set does not. The handover document records the option matrix
  (CEL via `@marcbachmann/cel-js`, JSONLogic, jq via WASM, custom mini-DSL).
- **In-memory content-hash cache**. Pre-populated during chokidar's initial
  walk (events before the `ready` event record without restarting); after
  `ready` an unknown path is treated as a genuinely new file and fires.
  Persisting the cache to disk is intentionally out of scope.

## Tests

`mise run //packages/dev-script/watch-restart:test:unit` covers:

1. Byte-identical write produces no restart.
2. Atomic save (rename `_tmp` → file) with new content fires once.
3. Two writes inside the debounce window coalesce to one restart.
4. Deletion fires once and clears the file's cache entry.
5. SIGTERM exits the watcher and child cleanly within `--stop-timeout`.
6. `--ext .ts` filters change events on non-`.ts` files.
7. `--exclude '**/*.test.ts'` suppresses change events on excluded files.
8. `--no-content-changed` lets a byte-identical write through.
9. Pre-populate-on-start: pre-`ready` events record without restarting;
   subsequent same-hash events skip; different-hash events restart.
10. `--no-initial` does not run the child at startup; the first qualifying
    event still triggers a start.
