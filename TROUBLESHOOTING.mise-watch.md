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
