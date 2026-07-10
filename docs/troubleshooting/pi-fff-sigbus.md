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

## Prototype

The exact coredump query is unavailable, but FFF issue 618 provides a close,
red-capable reproducer for native live grep with an overflow file and a path
constraint.

The prototype used a fresh disposable checkout of FFF. It added the published
issue reproducer at `crates/fff-core/tests/grep_overflow_path_constraint_segfault.rs`
and ran the test with a 2 GiB memory and two CPU container bound:

```bash
podman run --memory=2g --cpus=2 --rm \\
  --volume /tmp/agent/fff-prototype-20260709-a:/work:Z \\
  --volume /var/home/user/fff-prototype-target:/target:Z \\
  --volume /var/home/user/fff-prototype-cargo-home:/cargo-home:Z \\
  --workdir /work \\
  --env CARGO_HOME=/cargo-home \\
  --env CARGO_TARGET_DIR=/target \\
  docker.io/library/rust:1.88-bookworm \\
  cargo test --package fff-search --test grep_overflow_path_constraint_segfault
```

At the pre-fix parent commit `b8e16d884bbef3625db6de13fb02f8a4275ed26d`,
the test reproduced an abort:

```text
unsafe precondition(s) violated: slice::from_raw_parts requires the pointer to be aligned and non-null
process didn't exit successfully ... (signal: 6, SIGABRT)
```

Applying the source patch from upstream fix commit
`8e8b09f2d37882cf48254f8287ab4bf663abecaf` made the same test pass:

```text
test grep_path_constraint_on_overflow_file_does_not_segfault ... ok
test result: ok. 1 passed; 0 failed
```

The patch passes the correct base or overflow arena through constraint matching,
grep prefiltering, and scoring. The complete prototype patch is stored in
[`pi-fff-sigbus.patch`](pi-fff-sigbus.patch). This proves a real adjacent native
crash can be reproduced and fixed; it does not yet prove that the user's
coredump is the same defect. The installed v0.9.6 source already contains this
published fix, so the remaining coredump may be another FFF native grep defect.

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
6. **Minimal fix prototyped:** yes for the adjacent issue 618 reproducer. The
   prototype applies upstream commit `8e8b09f2d37882cf48254f8287ab4bf663abecaf`
   and turns the reproducer from SIGABRT into a passing test. The exact coredump
   still needs its query and fixture before claiming the same fix applies.

[fff-422]: https://github.com/dmtrKovalenko/fff/issues/422
[fff-476]: https://github.com/dmtrKovalenko/fff/issues/476
[fff-618]: https://github.com/dmtrKovalenko/fff/issues/618
