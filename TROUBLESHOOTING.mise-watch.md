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

Two layers of filtering, both applied in the `watchexec` command:

**Layer 1: `--no-meta`**: suppresses `Modify(Metadata(Any))` events at the
kernel level. Handles `touch`, `chmod`, and similar metadata-only changes.

**Layer 2: `-j @content-changed.jaq`**: a jaq filter program that compares
file content hashes via watchexec's `kv_store` / `kv_fetch` builtins.
Only passes events where the file's content hash differs from the last stored hash.
First-seen files store their hash silently (no restart on initial scan).

The jaq program (`content-changed.jaq`):

```jaq
any(.tags[] | select(.kind == "path" and .filetype == "file"); .absolute as $p | ($p | file_hash) as $h | (kv_fetch($p) // null) as $prev | $h | kv_store($p) | ($prev != null and $prev != $h))
```

**Behavior matrix:**

| Event                   | `--no-meta` | Content-hash filter         | Result      |
| ----------------------- | ----------- | --------------------------- | ----------- |
| `touch` (mtime only)    | Suppressed  | --                          | No restart  |
| `chmod` (perms only)    | Suppressed  | --                          | No restart  |
| Write identical content | Passes      | Hash matches stored         | No restart  |
| Write different content | Passes      | Hash differs                | **Restart** |
| `git checkout` (revert) | Passes      | Hash differs from modified  | **Restart** |
| New file created        | Passes      | No stored hash (first-seen) | No restart  |

### Constraints

- The jaq filter file must be single-line. Watchexec's `@file` loader does not
  support multi-line jaq programs or `#` comments (jaq has no comment syntax).
- `kv_store` is in-memory only with no persistence across watchexec restarts.
  After each restart, all files are "first-seen" and suppressed until their
  next change. This is the correct behavior for a dev watcher.
- `file_hash` reads the entire file on every event. For large files this adds
  latency to event processing, but source files in `src/server/` are small.

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

Either:

1. Drop `-j @src/server/content-changed.jaq` from the `dev:server` task in
   `packages/desktop-daemon/editord/mise.toml`. Ctrl+C exits cleanly.
   Trade-off: editor saves that produce identical file content trigger a
   server restart, losing WebSocket connections and LSP servers. This is
   the same regression that the "Unnecessary restarts on metadata-only or
   same-content writes" section above was added to solve.
2. Keep `-j` and recover the terminal manually after Ctrl+C:
   `pkill -9 -f 'watchexec -w src/server'` from another terminal.

A third option, replacing watchexec's content-hash filter with a bun-side
hash check on startup, eliminates the dependency on `-j` but requires
restructuring the dev loop.

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

```sh
mkdir -p /tmp/quietdir && echo "true" > /tmp/minimal.jaq
watchexec -w /tmp/quietdir -j @/tmp/minimal.jaq -- sleep 9999
```

Press Ctrl+C. `[Waiting 10s for processes to exit before stopping...]` is
printed, `sleep` exits within a second, but `watchexec` never exits.
Further SIGINT/SIGTERM signals are ignored; only SIGKILL terminates the
process.

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


