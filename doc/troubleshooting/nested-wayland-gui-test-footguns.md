# nested-wayland-session 0.1.1: keystrokes sent before the hosted app maps its window are silently dropped, plus two operational traps when driving the compositor by hand

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Cluster of footguns hit while writing keyboard-driven boundary tests against
`package/cli/nested-wayland-session` (repo-owned tool) for
`package/desktop-app/file-manager-gtk-sticky` and during manual driving of the compositor.

## Symptom

- Keystroke drop:
   the boundary test polled the app's observed-state file,
   saw the boot state,
  sent `key enter`,
   and the app never reacted (test timed out waiting for `paneCount: 2`),
  while the same `key enter` sent a few seconds after launch worked every time.
  The control socket answered `ok` for the dropped key;
   there is no error anywhere.
- AF_UNIX path length:
   placing the control socket under this session's deep scratchpad path
  failed with `OSError: AF_UNIX path too long` (client side) and,
   compositor side,
  `Error: binding control socket ...: path must be shorter than SUN_LEN`.
- Self-kill:
   `pkill -f nested-wayland-session` inside a compound shell command killed the
  invoking shell itself (exit 144),
   because `-f` matches the full command line and the shell's
  own command line contains the pattern;
   the cleanup then half-ran and left a stale state.

## Root cause

Keystroke drop:
 Wayland keyboard events are delivered to a focused surface.
Until the hosted client creates and maps its toplevel,
 the compositor has no surface to focus,
and a `key` control command synthesizes input that reaches nothing.
The `ok` response only acknowledges the injection,
 not delivery.
The window for this race is real in GTK apps:
 `file-manager-gtk-sticky` writes its first
observed state during controller construction,
 BEFORE `window.present()` completes and the
surface maps,
 so a test that gates on "state file exists" fires keys too early.
The Electron counterpart never hit it because its renderer reports state only after the page
loads inside an already-shown window.

AF_UNIX:
 kernel limit;
 `sockaddr_un.sun_path` is ~108 bytes on Linux.
The scratchpad prefix alone
(`/tmp/claude-1000/-var-home-user-Monochromatic/<uuid>/scratchpad/...`) exceeds it.

pkill:
 documented `pkill -f` semantics;
 the invoking shell's `-c` command string contains the
pattern text.

## Verification

Environment:
 nested-wayland-session 0.1.1 (release build),
 GTK app above,
 Wayland host
session.

- Drop reproduction:
   pre-fix `file-manager-gtk-sticky` (observed `ready: true` written
  pre-map) plus a test that sends `key enter` immediately after the first state read:
   times
  out deterministically (10s deadline,
   5 consecutive runs during diagnosis).
  Same binary,
   `sleep 3` before the key:
   works every time (manual driving).
- Fix verification:
   app gates `ready` on GTK `connect_map`
  (`file-manager-gtk-sticky/src/strip.rs`,
   `wire_window_map`);
   the boundary test waits for
  `ready: true` before its first key.
   Test passes repeatedly in under a second
  (`mise run //package/desktop-app/file-manager-gtk-sticky:test:wayland`).
- AF_UNIX:
   `python3 -c "import socket; s=socket.socket(socket.AF_UNIX); s.connect('<108+ byte path>')"`
  raises `AF_UNIX path too long`;
   a socket at `/tmp/agent/fms.sock` works.

## Verified workarounds

- Have the app expose an observable "surface mapped" fact and gate the first synthetic key on
  it.
   GTK:
   `window.connect_map(...)` flips the mirrored `ready` field.
  Tradeoff:
   every keyboard-driven GUI under test needs such a fact;
   a bare "process started"
  or "state file exists" signal is NOT sufficient.
- Short socket paths:
   create sockets under `/tmp/agent/` (`mkdir --parents /tmp/agent;
  chmod 700 /tmp/agent`).
   Tradeoff:
   fixed shared prefix rather than per-session isolation;
  use unique basenames.
- Process cleanup while driving manually:
   prefer asking the compositor to exit over signals
  (`quit` on the control socket);
   if a signal is unavoidable,
   match on the exact binary path
  with `pkill -f '/target/release/monochromatic-nested-wayland-session'` from a command line
  that does not itself contain that string,
   or use `pgrep` first and `kill` by pid.
  Tradeoff:
   none beyond care.

## What does not work

- Gating on the state file's existence or on `ready` written before map:
   the file appears
  while the surface still does not exist;
   keys sent then are gone.
- Sleeping a fixed delay in tests:
   works but is the flakiness generator the map-gate removes.
- Treating the control socket's `ok` as delivery confirmation:
   it confirms injection only.

## Upstream filing decision

`.out-of-scope/` was checked:
 no matching exemption.
The compositor is this repository's own package,
 so "upstream" is this repo:
 no external
filing is applicable (constraint 1 resolves internally).
Improvement idea recorded for a future session instead of an issue filed elsewhere:
 the
control protocol could optionally report whether a hosted surface currently holds keyboard
focus (e.g. a `focused` query,
 or `key` answering `err no-surface`),
 which would let harnesses
gate on the compositor side instead of requiring every app to expose a mapped fact.
The kernel AF_UNIX limit and `pkill` semantics are documented platform behavior;
 nothing to
file.
