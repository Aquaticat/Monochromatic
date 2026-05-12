# mise watch troubleshooting

## `mise watch` drops `--no-meta` and `-J` (filter-prog) flags

### Problem

`mise watch` advertises `--no-meta` and `-J`/`--filter-prog` in its `--help` output
but silently drops them when constructing the underlying `watchexec` command.

```sh
mise watch -w src/server --no-meta -J @src/server/content-changed.jaq -r -- start:server
```

Debug output shows the actual command:

```toml
DEBUG $ watchexec --restart --watch src/server -- /home/user/.local/bin/mise run start:server
```

`--no-meta` and `-J @src/server/content-changed.jaq` are both missing.

### Root cause

mise 2026.3.8 parses these flags on the CLI side (they appear in `--help`)
but does not forward them to watchexec when it spawns the child process.
The `-J` flag is particularly confusing because mise remaps watchexec's
lowercase `-j` (filter-prog) to uppercase `-J`, while taking `-j` for its own `--jobs`.

### Verified in

- mise 2026.3.8 linux-x64
- watchexec 2.5.0

### Solution

Call `watchexec` directly instead of `mise watch`,
and run the server command directly (not through `mise run`):

```toml
# mise.toml
[tasks."dev:server"]
# Calls watchexec directly because mise drops --no-meta and -j flags.
# Runs bun directly (not `mise run start:server`) to keep a flat process tree
# so SIGTERM reaches the server process -- see "EADDRINUSE from deep process trees" below.
run = "watchexec -w src/server --no-meta -j @src/server/content-changed.jaq -r -- bun src/server/index.ts"
```

Note the flag difference: use lowercase `-j` (watchexec native) not uppercase `-J` (mise alias).

### What does not work

- `mise watch --no-meta` -- flag parsed but not forwarded to watchexec
- `mise watch -J @file.jaq` -- same: parsed but dropped
- `mise watch --fs-events create,remove,rename,modify` -- untested but likely same issue

---

## Unnecessary restarts on metadata-only or same-content writes

### Problem

`mise watch -w src/server -r -- start:server` restarts the server process
when file metadata changes (mtime from `touch`, `chmod`) or when a file is
written with identical content (e.g. format-on-save producing the same output,
or Ctrl+S without changes).

This causes problems when editing the watched project's own source files
in a tool served by that project (editord editing its own source).
Every save restarts the server, killing WebSocket connections and LSP servers.

### Root cause

By default, watchexec triggers on all filesystem event types including
`Modify(Metadata(Any))`. A bare `touch` or `chmod` fires this event even
though file content is unchanged.

For content-preserving writes (editor saves identical bytes), the OS reports
`Modify(Data(Any))`, a real data write event, because it cannot distinguish
"same bytes" from "different bytes" at the kernel level.

### Solution

Two layers, in different places:

**Layer 1: `--no-meta` on watchexec**: suppresses `Modify(Metadata(Any))`
events at the kernel level. Handles `touch`, `chmod`, and similar
metadata-only changes.

**Layer 2: skip-on-identical-content in editord's save handler**:
`saveFile` reads the existing file before writing and returns early when
the new content matches. No write happens, no fs event fires, no restart.
This covers the dogfooding case (editing editord's own source from within
editord), which is the practical reason the filter existed.

An earlier version used `-j @content-changed.jaq` on watchexec for the
content-hash check. That layer was removed because watchexec hangs on
SIGINT when `-j` is used; see "watchexec `-j` filter program hangs on
SIGINT" below.

**Behavior, by event:**

- `touch` (mtime only): suppressed by `--no-meta`. No restart.
- `chmod` (perms only): suppressed by `--no-meta`. No restart.
- editord saves identical content: `saveFile` returns early without
  writing. No fs event, no restart.
- editord saves different content: `saveFile` writes through, watchexec
  fires. Restart.
- External editor writes identical bytes (rare): watchexec fires. Restart.
- External editor writes different bytes: watchexec fires. Restart.
- `git checkout` (revert): watchexec fires. Restart.
- New file created: watchexec fires. Restart.

### Constraints

- The save-side skip only covers writes routed through editord's own
  `saveFile`. External editors (vim, vscode) doing format-on-save with
  byte-identical output still trigger a restart. This is rare in practice;
  the common no-op-save case in this codebase is editord-on-editord.
- Skipping the write also skips the mtime touch. Any consumer that keys
  off mtime sees the file as unchanged, which matches the semantics.

### Update (2026-05): external-editor case is also covered now

editord's `dev:server` runs through `@monochromatic-dev/dev-script-watch-restart`,
which maintains an in-process content-hash cache and re-hashes every
file on each filesystem event. A write with identical bytes (whoever
issued it: editord's `saveFile`, vim's `formatprg`, vscode's
`editor.formatOnSave`, `cp -p` from a sibling shell) produces a cache
hit and no restart. The save-side skip in `saveFile` stays — it is
strictly cheaper than the watch-side compare (no write, no event, no
hash) for the editord-on-editord path it already covered.

---

## Server restart generates fresh auth token (client loses connection)

### Problem

When the dev server restarts (via watchexec or manual kill+restart),
the new instance generates a new `crypto.randomUUID()` auth token.
The browser client has the old token embedded in its WebSocket URL
and cannot reconnect; every reconnect attempt fails with "unauthorized".

### Root cause

The auth token was generated in-memory on every startup with no persistence.
The client's `EditorWsClient` reconnects with exponential backoff but always
uses the original token from `#wsUrl` (set once in the constructor).

### Solution

A token file at `$TMPDIR/editord-<port>.token` persists the token across restarts:

1. **On startup**: check if the token file exists and its mtime is within 3 seconds.
   If so, reuse the token (auto-restart detected). Otherwise generate a fresh UUID.
2. **While running**: re-write the token file every 1 second to keep its mtime fresh.
3. **On SIGTERM** (auto-restart from watchexec): stop the mtime touch interval
   but **keep the token file** so the next instance finds it fresh.
4. **On SIGINT** (user Ctrl+C): delete the token file since no restart is expected.

The 3-second freshness window is wide enough to cover the gap between
watchexec killing the old process and spawning the new one (typically < 500ms)
but narrow enough that a stale file from a crashed process won't be reused
on the next manual start.

### What does not work

- Deleting the token file on both SIGTERM and SIGINT -- the new process starts
  after the old one exits, and if the file is deleted, it has no token to reuse.
  This was the initial implementation bug: `handleShutdown` ran `cleanupToken()`
  which deleted the file before the new process could read it.
- Using the same cleanup function for both signals -- SIGTERM must preserve the
  file, SIGINT must delete it. Split into `handleSigterm` and `handleSigint`.

---

## EADDRINUSE from deep process trees on restart

### Problem

After switching to `watchexec` directly, restarts fail with `EADDRINUSE`
because the previous server process still holds the port.

### Root cause

When the inner command is `mise run start:server`, the process tree is:

```text
watchexec → mise → nu (nushell) → bun src/server/index.ts
```

watchexec sends SIGTERM to its direct child (`mise`) on restart.
mise exits, but the signal does not propagate through nushell to `bun`.
The bun process orphans and keeps the port bound.

### Solution

Run `bun` directly as the inner command so watchexec's SIGTERM reaches it:

```text
watchexec -w src/server -r -- bun src/server/index.ts
```

Process tree: `watchexec → bun`. SIGTERM goes directly to bun,
the signal handler runs, the port is released before the new instance starts.

### Update (2026-05)

editord's `dev:server` migrated off watchexec to
`@monochromatic-dev/dev-script-watch-restart`. The new tree is even
shallower (`watch-restart → bun`, no intermediate wrapper at all) because
the watcher spawns the bun child directly via `node:child_process.spawn`
with `stdio: 'inherit'`. SIGTERM still reaches bun by construction; the
mitigation principle (flat process tree) is preserved by tool choice
rather than by careful argv composition.

### What does not work

- `watchexec -r -- mise run start:server` -- SIGTERM does not propagate
  through the `mise → nushell → bun` chain, leaving orphaned bun processes

---

## watchexec `-j` filter program hangs on SIGINT (Ctrl+C does not return)

### Problem

`mise run //packages/desktop-daemon/editord:dev` does not return to the
terminal on Ctrl+C. Three processes survive the signal and block the
terminal indefinitely:

```text
mise run //packages/desktop-daemon/editord:dev
└── nu -c watchexec -w src/server --no-meta -j @src/server/content-changed.jaq -r -- bun src/server/index.ts
    └── watchexec ...
```

`bun` and the other two parallel tasks (`watch:build:js:client`,
`watch:build:css`) exit cleanly. `watchexec` does not. The wrapping `nu` and
the parent `mise` wait on it, so the terminal cannot be released.

Subsequent SIGINT and SIGTERM signals to the hung `watchexec` are ignored.
Only SIGKILL kills it.

### Root cause

`watchexec` enters a permanent hang on SIGINT when the `-j` (filter program)
flag is used. The bug is reproducible in isolation, with no editord plumbing:

```sh
mkdir -p /tmp/quietdir && echo "true" > /tmp/minimal.jaq
watchexec -w /tmp/quietdir -j @/tmp/minimal.jaq -- sleep 9999
# Press Ctrl+C
# `[Waiting 10s for processes to exit before stopping...]` is printed
# `sleep` exits within a second
# `watchexec` never exits; further Ctrl+C does nothing
```

Bisection of flags confirms `-j` is the trigger. First SIGINT exits the
following invocations cleanly:

- `watchexec -w DIR -r -- CMD`
- `watchexec -w DIR --no-meta -r -- CMD`

First SIGINT hangs the following invocations:

- `watchexec -w DIR -j @file.jaq -- CMD`
- `watchexec -w DIR -j @file.jaq -r -- CMD`
- `watchexec -w DIR --no-meta -j @file.jaq -r -- CMD` (the production form)
- `watchexec -w DIR -j 'true' -- CMD` (**inline jaq form, same hang**)

watchexec's `--help` documents `-j` accepts either an inline jaq expression or, if the argument starts with `@`, a path to a file containing a jaq program. The hang affects **both forms** because the cycle lives in `FilterProgs::new` (`crates/cli/src/filterer/progs.rs:66-115`), which is called whenever `-j` is present regardless of where the program comes from. Reproduced 2026-05-11 with watchexec 2.5.1: a process running `watchexec -w /tmp/x -j 'true' -- sleep 9999` survives the first SIGINT and only dies on SIGKILL.

The watchexec docs (CLI `--help` and the discussions link at <https://github.com/watchexec/watchexec/discussions/592>) advertise the inline form on equal footing with `@file`. There is no documented warning that either form hangs on SIGINT. The draft upstream issue at the end of this section should call out that inline jaq is affected too, so an upstream fix covers both code paths.

#### Source-level trace

`FilterProgs::new` in `crates/cli/src/filterer/progs.rs:66-115` (v2.5.1)
spawns a blocking task whose only exit path is the channel closing:

```rust
let task = spawn_blocking(move || {
    'chan: while let Some((event, sender)) = receiver.blocking_recv() {
        // run jaq programs
    }
    Ok(()) as miette::Result<()>
});

tokio::spawn(async {
    match task.await { /* log */ }
});
```

`receiver.blocking_recv()` returns `None` only when every `Sender` is
dropped. The matching `Sender` lives in `FilterProgs.channel`, held by
`Arc<WatchexecFilterer>` in `Config.filterer`
(`ChangeableFilterer = Arc<RwLock<Arc<dyn Filterer>>>`).

A strong reference cycle keeps `Arc<Config>` alive past shutdown:

```text
Arc<Config>
  .action_handler  (ChangeableFn = Arc<RwLock<Arc<dyn Fn>>>)
    closure        registered at crates/cli/src/config.rs:206-209
      captures     state = state.clone()  (Arc<InnerState>)
        Arc<InnerState>
          .watchexec  OnceLock<Arc<Watchexec>>   (state.rs:45)
            Arc<Watchexec>
              .config  Arc<Config>               (watchexec.rs:138-203)
                ^─────── cycles back ────────────┘
```

`InnerState.watchexec` is set inside `run_watchexec` (`crates/cli/src/lib.rs:42-45`)
after the closure has already captured `state`. The cycle is established
before the first event arrives.

When SIGINT fires:

1. The action handler calls `quit(action)` which schedules
   `action.quit_gracefully(stop_signal, stop_timeout)`
   (`crates/cli/src/config.rs:298-322`).
2. `bun` receives SIGTERM, runs its shutdown, exits.
3. The action worker breaks out of its loop
   (`crates/lib/src/action/worker.rs:63-86`).
4. The main task ends and runs `tasks.shutdown().await`
   (`crates/lib/src/watchexec.rs:191-193`), aborting the remaining async
   workers.
5. `wx.main().await` resolves, `run_watchexec` returns, `run` returns,
   the async block in `main()` completes, `block_on` returns.
6. The `tokio::runtime::Runtime` drops. Drop waits for `spawn_blocking`
   tasks to finish naturally (they cannot be aborted).
7. The `FilterProgs` blocking thread is still parked in
   `receiver.blocking_recv()` because the cycle is keeping `Arc<Config>`
   alive, which keeps `Arc<WatchexecFilterer>` alive, which keeps the
   `Sender` alive, which keeps the channel open.
8. The runtime never releases its threads; the process never exits.

Without `-j`, no `FilterProgs` and no `spawn_blocking` task is created,
so the runtime aborts the async tasks and exits despite the same cycle
existing on the closure side.

### Verified in

- watchexec 2.5.1 linux-x64 (from mise install)
- watchexec/watchexec HEAD at commit `9d8e3443` (post-2.5.1; both files
  above are byte-identical to v2.5.1)
- bun 1.3.13 linux-x64
- mise 2026.5.0 linux-x64

### Workaround

Resolved in two stages.

Stage 1 (2026-04, commit `27051b66`): remove `-j` from `dev:server`; move
the content-equality check into editord's `saveFile`. The `--no-meta`
flag stays. Covered the editord-on-editord dogfooding case but external
editors doing byte-identical format-on-save still triggered a restart.

Stage 2 (2026-05): editord's `dev:server` migrates off watchexec
entirely to `@monochromatic-dev/dev-script-watch-restart`. The new
package owns an in-process content-hash cache (suppressing byte-identical
writes regardless of writer, including external editors' format-on-save),
spawns the bun child directly via `node:child_process` (one process
layer; SIGTERM reaches the child without traversing a wrapper), and has
no jaq filter program at all — so neither the SIGINT hang nor the deep-
tree EADDRINUSE failure mode can recur for this task. The watchexec bug
remains real; the editord loop simply no longer touches the code path.

The "mise watch drops --no-meta and -J" section above still stands as a
general mise/watchexec interaction bug; the editord task's escape from
it was to call watchexec directly (stage 1) and then to leave watchexec
behind (stage 2).

Earlier alternatives considered:

1. Keep `-j` and recover the terminal manually after Ctrl+C:
   `pkill -9 -f 'watchexec -w src/server'`. Rejected because every dev
   session needs manual cleanup.
2. Drop `-j` with no replacement filter. Rejected because the dogfooding
   case (editord editing editord's source) restarts on every Ctrl+S, even
   when no content changed, which kills WebSocket connections and LSP
   servers.
3. Custom TypeScript watcher replacing watchexec entirely. Initially
   rejected as over-scoped (stage 1); revisited and adopted in stage 2
   once the external-editor format-on-save case and the architectural
   failure modes (SIGINT hang, deep-tree signal propagation) were
   weighed against the implementation cost. Lives at
   `packages/dev-script/watch-restart/`; see its README for the chokidar
   + custom `child_process.spawn` rationale.

### What does not work

- Sending a second or third SIGINT: the action handler's
  `quit_again.fetch_add` escalation (config.rs:298-322) is gated on the
  action worker receiving a fresh event, but the worker is already past
  the loop, blocked on graceful-shutdown await.
- Sending SIGTERM to the hung watchexec process: ignored for the same
  reason. SIGKILL is the only signal that works.
- `--stop-timeout 0`: addresses how long watchexec waits for the child
  to exit, not the runtime shutdown wait on the blocking thread.
- Upgrading watchexec: the relevant files (`crates/cli/src/filterer/progs.rs`,
  `crates/cli/src/config.rs:206-209`, `crates/cli/src/state.rs:45`) are
  byte-identical between v2.5.1 and the current HEAD.

### Draft upstream issue

To file against `watchexec/watchexec`:

````markdown
Title: `-j` (filter program) causes process to hang forever on SIGINT after the command exits

Labels: bug

#### Reproduction

The hang affects both forms of `-j` (file and inline). The CLI `--help`
documents both on equal footing; neither warns about the SIGINT issue.

File form:

```sh
mkdir -p /tmp/quietdir && echo "true" > /tmp/minimal.jaq
watchexec -w /tmp/quietdir -j @/tmp/minimal.jaq -- sleep 9999
```

Inline form (also hangs):

```sh
mkdir -p /tmp/quietdir
watchexec -w /tmp/quietdir -j 'true' -- sleep 9999
```

In either case, press Ctrl+C: `[Waiting 10s for processes to exit before
stopping...]` is printed, `sleep` exits within a second, but `watchexec`
never exits. Further SIGINT/SIGTERM signals are ignored; only SIGKILL
terminates the process.

Without `-j`, the same invocation (`watchexec -w /tmp/quietdir -- sleep
9999`) exits cleanly on the first SIGINT.

#### Diagnosis

`FilterProgs::new` in `crates/cli/src/filterer/progs.rs:66-115` spawns a
blocking task that exits only when the channel closes:

```rust
let task = spawn_blocking(move || {
    while let Some((event, sender)) = receiver.blocking_recv() { ... }
    Ok(())
});
```

The matching `Sender` lives through `Arc<WatchexecFilterer>` ->
`Config.filterer` -> `Arc<Config>`. A reference cycle between
`Arc<Config>`, the action-handler closure, and the captured
`Arc<InnerState>` (which holds `OnceLock<Arc<Watchexec>>` in
`crates/cli/src/state.rs:45` and is filled inside `run_watchexec` in
`crates/cli/src/lib.rs:42-45`) keeps `Arc<Config>` alive past shutdown.
The `Sender` never drops, the receiver never returns `None`, the blocking
thread never exits, and `Runtime::drop` waits on it indefinitely.

Without `-j` no blocking task is created, so the runtime exits despite
the same cycle.

#### Verified in

- watchexec 2.5.1 linux-x64
- HEAD at `9d8e3443`; the cited files are byte-identical to v2.5.1.

#### Suggested fix

Either break the cycle or give `FilterProgs` an explicit shutdown path:

- In `crates/cli/src/config.rs:206-209`, capture `Arc::downgrade(&state)`
  instead of `state.clone()` and upgrade inside the closure. The action
  handler runs only while the runtime is live, so a `Weak` upgrade will
  always succeed during normal operation, and the closure will not pin
  `Arc<InnerState>` past shutdown.
- Or, in `FilterProgs`, hold the `Sender` in a structure with a `Drop`
  impl that calls `mpsc::Sender::downgrade` or sends a sentinel to break
  out of the blocking loop. A `tokio::sync::Notify` wired into the loop
  would also work.
````


