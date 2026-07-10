# `@ff-labs/pi-fff` 0.9.6 live grep causes a native SIGBUS in Pi

## Symptom

Pi exits with:

```text
Bus error (core dumped) pi
```

The terminal remains in Pi's keyboard protocol after the crash. The shell then
interprets terminal response bytes as commands, producing strings such as:

```text
bash: command not found: pi2
bash: command not found: 1:3u5
```

The affected session's coredump reports signal `7 (BUS)`. Its native stack names
`libfff_c.so`, `ffi-rs.linux-x64-gnu.node`, and `fff_live_grep`.

## Root cause

The auto-mode ask notification is not the crashing process. The captured coredump
has its main Pi thread inside FFF's native live-grep path, not in `nano-spawn`,
`notify-send`, or auto-mode. The installed Pi package metadata identifies
`@ff-labs/pi-fff` and `@ff-labs/fff-node` as version `0.9.6`.

The v0.9.6 source trace is:

1. `packages/pi-fff/src/index.ts:633-645` calls `f.grep(...)` for the Pi
   `ffgrep` tool:

   ```ts
   const grepResult = f.grep(query, {
     mode,
     smartCase,
     maxMatchesPerFile: Math.min(effectiveLimit, 50),
   });
   ```

2. `packages/fff-node/src/ffi.ts:1352-1397` maps that call to the native
   `fff_live_grep` symbol through `ffi-rs`:

   ```ts
   const rawPtr = load({
     library: LIBRARY_KEY,
     funcName: "fff_live_grep",
   });
   ```

3. `crates/fff-core/src/file_picker.rs:1199-1220` runs the grep inside FFF's
   native search thread pool:

   ```rust
   SEARCH_THREAD_POOL.install(|| {
       grep_search(
           self.get_files(),
           query,
           options,
   ```

This places the fault in FFF's native grep implementation or its input/state, not
in the terminal notification subprocess. A direct `notify-send` probe on the
affected host exited with status `0` and wrote nothing to stdout or stderr.

FFF has related native crash reports for live grep and Pi integrations:

- [FFF issue 618][fff-618] records a Pi `ffgrep` path-constraint crash and its
  native constraint-path failure.
- [FFF issue 422][fff-422] records a Linux `SIGBUS` in `libfff_c.so` during grep.
- [FFF issue 476][fff-476] records Pi crashes in FFF's native watcher and grep
  integration.

## Verification

Version under observation:

- `@ff-labs/pi-fff`: `0.9.6`
- `@ff-labs/fff-node`: `0.9.6`
- Pi's coredump executable: Node `26.4.0`
- Source trace: FFF tag `v0.9.6`, commit `28321da22836b0e11da81e30f40f7a043b8f8fb4`

Captured crash harness:

```bash
# Run after Pi has produced a coredump.
coredumpctl --no-pager --since '10 minutes ago' info pi
```

Observed failing catalog:

- Pi's coredump reported `Signal: 7 (BUS)`.
- The stack included `fff_live_grep`, `libfff_c.so`, and `ffi-rs.linux-x64-gnu.node`.
- The shell received terminal protocol bytes after Pi exited.

Observed passing catalog:

```bash
notify-send --app-name=Pi 'Pi auto-mode approval required' 'diagnostic notification'
```

This exited with status `0`, with empty stdout and stderr. The auto-mode unit
suite also passed after the notification implementation was added, including the
notification failure path.

## Verified workarounds

- Temporarily remove `npm:@ff-labs/pi-fff` from the Pi package list and restart
  Pi. This removes the native FFF crash surface, but also removes `ffgrep`,
  `fffind`, and FFF-backed `@` completion.
- Use Pi's built-in grep and find tools instead of FFF while the native crash is
  being investigated. This trades FFF's indexing and fuzzy behavior for the
  host's non-native tools.
- After a crash, run `stty sane` or `reset` in the affected shell to restore
  terminal input handling. This repairs terminal state only; it does not prevent
  the FFF crash.

## What does not work

- Changing the `notify-send` title or action argument does not address the
  coredump's native `fff_live_grep` stack.
- Treating the shell's `pi2;1:3u5;1:3u` text as a second command failure misses
  the primary event. Those bytes are terminal protocol residue after Pi exited.
- Disabling only the notification's stderr or stdout output does not disable the
  FFF native extension that appears in the coredump.

## Upstream filing decision

No new upstream issue is drafted. The duplicate search found the related FFF
issues 422, 476, and 618, including completed fixes for earlier native crash
variants. The current coredump lacks the FFF query and project fixture needed to
prove which already-known native defect is active, so a new report would be
non-additive until that input is captured.

The six-constraint check is:

1. **Upstream fault:** yes, the coredump enters FFF's native library.
2. **Upstream can fix it:** yes, FFF has landed fixes for related native crashes.
3. **Supported use case:** yes, FFF explicitly provides Pi's `ffgrep` tool.
4. **Contribution welcome:** no `CONTRIBUTING.md` was present in the checked
   FFF tag, and no prohibition on external reports was found in its README.
5. **Likely to fix it:** yes, the related issues were triaged and closed with
   fixes.
6. **Minimal fix prototyped:** no, the exact crashing query and fixture are not
   present in the coredump, so a consumer-side patch would be speculative.

[fff-422]: https://github.com/dmtrKovalenko/fff/issues/422
[fff-476]: https://github.com/dmtrKovalenko/fff/issues/476
[fff-618]: https://github.com/dmtrKovalenko/fff/issues/618
