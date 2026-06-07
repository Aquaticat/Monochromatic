# nushell startup spawns `tput` six times via crossterm when stdout is not a TTY, amplified by a long PATH

nushell `0.113.1`, crossterm `0.29.0`: a 105-entry PATH turns each `tput` spawn into ~94 failed `execve`.

## Symptom

Benchmarking mise's task shell, `nu -c` showed wildly variable startup while `node -e` was rock stable:

- `nu --no-config-file -c 'print hi'` (full repo PATH, piped stdout): mean 72.7 ms, range 20.3 ms to 605.6 ms.
- `node -e 'console.log("hi")'` (same PATH): mean 18.0 ms, range 15.9 ms to 22.6 ms.

The variance is the tell: nushell's floor (~18 ms) matches node, but it spikes by 30x intermittently.
`strace -f -c` on the nushell run showed the cause shape:

- `execve`: 571 calls, 564 failing.
- `wait4`: 6 calls (six child processes).
- `clone`: 7 calls.

node by contrast performs zero PATH scans and spawns nothing.

## Root cause

Two independent mechanisms stack.

### 1. crossterm shells out to `tput` when the terminal-size ioctl fails

`print hi` renders through nushell's table viewer, which queries the terminal size.
The stack trace from the stripped musl binary (captured with `strace -k`) names the chain:

```text
nu_cli::print::Print::run
  nu_protocol::pipeline::pipeline_data::PipelineData::print_table
    nu_command::viewers::table::CmdInput::parse
      crossterm::terminal::sys::unix::size
        crossterm::terminal::sys::unix::tput_value
          std::process::Command::output   ->  execve("tput", ["tput","cols"|"lines"])
```

nushell's own size helper is a thin wrapper over crossterm
(`crates/nu-utils/src/utils.rs:524`, nushell main):

```rust
pub fn terminal_size() -> io::Result<(u16, u16)> {
    #[cfg(feature = "os")]
    return crossterm::terminal::size();
    ...
}
```

crossterm 0.29.0 (the version pinned in nushell's `Cargo.lock`) does the fallback in
`src/terminal/sys/unix.rs`:

```rust
// size(), line 99
pub(crate) fn size() -> io::Result<(u16, u16)> {
    if let Ok(window_size) = window_size() {   // ioctl(TIOCGWINSZ)
        return Ok((window_size.columns, window_size.rows));
    }
    tput_size().ok_or_else(|| std::io::Error::last_os_error().into())   // fallback
}

// window_size(), line 61, libc variant
let file = File::open("/dev/tty").map(|file| FileDesc::new(file.into_raw_fd(), true));
let fd = if let Ok(file) = &file { file.raw_fd() } else { STDOUT_FILENO };
if wrap_with_result(unsafe { ioctl(fd, TIOCGWINSZ.into(), &mut size) }).is_ok() {
    return Ok(size.into());
}
Err(std::io::Error::last_os_error().into())

// tput_value(), line 276
fn tput_value(arg: &str) -> Option<u16> {
    let output = process::Command::new("tput").arg(arg).output().ok()?;
    ...
}
```

So when `/dev/tty` cannot be opened and the `ioctl(TIOCGWINSZ)` on `STDOUT_FILENO` fails,
which is exactly the case when stdout is a pipe or there is no controlling terminal,
crossterm spawns `tput cols` and `tput lines`. The table viewer queries size three times per render,
so `print hi` produces six spawns.

This is confirmed against a real pty: under `script -qec "...nu..." /dev/null` the size ioctl succeeds and
`wait4` count is zero (no `tput`). Piped, `wait4` is six. So the fallback is gated on the absence of a usable
terminal, not on nushell config.

### 2. A 105-entry PATH turns each spawn into ~94 failed `execve`

The spawn uses the bare name `tput`, so libc's `execvp` walks every `$PATH` entry, issuing one `execve`
per directory until one succeeds. In this repo the generated `mise.toml` injects a workspace-bin PATH:
105 entries, including 26 `node_modules/.bin` directories. `/usr/bin` (where `tput` lives) sits at position 95.

This PATH is not incidental bloat that can be trimmed. `file-enforcer.config.ts` (`generateMiseToml`, the
`_.path` block) generates it from `node_modules/.bin` plus a glob over every `packages/*/*/node_modules/.bin`,
and mise prepends those entries so package-local binaries resolve first. That prepend is exactly why
`/usr/bin` lands last. Removing the entries breaks task command resolution; reordering `/usr/bin` to the
front defeats the local-binary shadowing the entries exist to provide. So PATH length is a fixed constraint
here, not a tuning knob.

So each `tput` spawn issues 94 failing `execve` calls before the hit. Six spawns give 564 failures,
matching the strace count exactly. The wall-clock cost is six `fork`+`wait` cycles plus ~564 filesystem
lookups across directories that may be on overlay or otherwise contended storage, which is where the
20 ms to 600 ms variance comes from.

The spawn count is not limited to commands that render a value. Measured `wait4` (tput) counts per
invocation: `print hi` 6, `echo hi` 4, `^echo hi` 5, `ls /tmp | length` 4, `mise --version` 5, `^true` 5.
So roughly four to six `tput` spawns fire on essentially every nushell `-c` invocation in a non-TTY context,
including pure external-command pass-through tasks.

Neither mechanism alone is severe. Combined, they produce the pathological tail.

### What was wrong in the first reading

The initial benchmark was read as "node is 5x faster than nushell, nushell is a heavier interpreter."
That is wrong. With a sane PATH, nushell is `15.4 ms +/- 1.0`, slightly faster than node (`18.0 ms`).
The slowdown is not interpreter weight; it is the crossterm `tput` fallback amplified by PATH length,
and it only appears when stdout is not a TTY.

## Verification

Versions under test:

- nushell `0.113.1`, static musl build from `aqua:nushell/nushell`.
- crossterm `0.29.0` (from nushell `Cargo.lock`; source read at crossterm `main`, commit `d4e9929`,
  where `size()`/`tput_value()` are unchanged from 0.29.0).
- node `v26.3.0`.
- PATH: 105 entries, `/usr/bin` at position 95.

Reproduce the spawn and the PATH amplification:

```bash
NU=$(mise which nu)
# count syscalls; note execve failures and wait4 count
strace -f -c -e trace=execve,wait4,clone "$NU" --no-config-file -c 'print hi' </dev/null >/dev/null
# see the actual tput calls
strace -f -e trace=execve "$NU" --no-config-file -c 'print hi' 2>&1 >/dev/null | grep tput | head
```

Patterns that trigger the tax:

- stdout piped or redirected (no TTY): six `tput` spawns.
- large PATH with system dirs late: each spawn does many failed `execve`.

Patterns that do not:

- a real controlling terminal (ioctl succeeds, zero spawns), verified with `script -qec`.
- node `-e` (never queries terminal size, never scans PATH).

PATH-size effect, measured with `hyperfine --warmup 10`:

- `nu --no-config-file -c 'print hi'`, full PATH (105): mean 72.7 ms, max 605.6 ms.
- `env PATH=/usr/bin:/bin nu --no-config-file -c 'print hi'`: mean 15.4 ms, max 19.8 ms.
- `node -e 'console.log("hi")'`, full PATH: mean 18.0 ms, max 22.6 ms.

## Verified workarounds

Note up front: trimming or reordering PATH is not available here. The `_.path` entries are generated by
`file-enforcer.config.ts` and prepended so package-local binaries resolve first; removing them breaks task
command resolution, and pulling `/usr/bin` to the front defeats that shadowing (see Root cause). So the
levers below do not include PATH surgery.

- Use node (or any runtime that does not query terminal size on startup) as the task shell. This is the
  most effective lever given the PATH constraint: node never spawns `tput`, so it eliminates the four-to-six
  size-detection scans per task outright. Tradeoff: any external command a node shell spawns by bare name
  still costs one PATH scan, so node removes the `tput` overhead but not the per-command lookup cost, and a
  literal `node -e` inline shell cannot run the command-line task bodies that are not valid JavaScript.
- Build or source a nushell whose crossterm has the `tput` fallback removed (the `rustix` path already omits
  it; crossterm#422 proposes removing it from the libc path too). Tradeoff: requires a custom build or an
  upstream change; not available from the stock `aqua:nushell/nushell` binary.
- Shadow `tput` in an early PATH directory (for example a symlink to `/usr/bin/tput` in the repo-root
  `node_modules/.bin`, which is position 2). This makes each lookup hit immediately. Tradeoff: adds a
  hand-placed artifact into a file-enforcer-managed tree, which is fragile and easily lost on regeneration.
- Run tasks attached to a TTY where possible. Tradeoff: not controllable in CI or when output is captured
  (the `enter` hook's `| complete`, any `from json` over a captured subprocess), so this does not cover the
  contexts that matter most.
- Use node (or any runtime that does not query terminal size on startup) as the task shell for the affected
  tasks. Tradeoff: sidesteps nushell's `tput` fallback specifically, but any external command a node shell
  spawns by bare name still pays the same PATH-scan cost, so this does not fix the underlying PATH bloat.

## What does not work

- Setting `COLUMNS` and `LINES` environment variables. crossterm's `size()` does not consult them before the
  ioctl/`tput` path, so the six spawns still happen (verified: `wait4` count stays at six).
- `--no-config-file`. The spawns originate in output rendering, not config loading, so disabling config
  changes nothing.

## Upstream filing decision

`.out-of-scope/` was checked: no exemption matches crossterm, nushell, tput, or mise.

Duplicate search (`gh search issues --repo crossterm-rs/crossterm tput --include-prs`) found the behavior is
already tracked upstream:

- crossterm issue #422, "Remove TPUT fallback when fetching terminal size", open since 2021,
  labeled `enhancement`, `help wanted`, `difficulty: medium`.
- crossterm PR #283, "add a tput based computation of terminal size", merged 2019, introduced the fallback.
- related closed issues #419 and #276, "terminal size inside a subshell".

6-constraint check:

1. Upstream's fault? Partly. The `tput` fallback is a deliberate crossterm design for the no-ioctl case.
   The PATH amplification is this repo's environment, not crossterm.
2. Can upstream fix it? Yes. The `not(feature = "libc")` path already uses `rustix::termios::tcgetwinsize`
   with no `tput` fallback; the libc path could drop the spawn or gate it behind an opt-in.
3. Supporting this use case? Yes, terminal-size detection is core crossterm surface.
4. Would the repo welcome a contribution? Not assessed in depth; not filing, so not required here.
5. Will they likely fix it? Open since 2021 with `help wanted` and no merge; leaning slow, not a won't-fix.
6. Minimal fix prototyped? No.

Decision: do not file. The behavior is already tracked by crossterm #422, and the dominant lever for this
repo is local PATH hygiene, not an upstream change. The additive insight we hold that #422 lacks is the
PATH-length amplification (cost is O(PATH entries) per spawn), but the user has not requested an upstream
contribution, so no comment is posted. If a future session wants to contribute, the additive comment would
be the PATH-amplification measurement plus the suggestion to mirror the `rustix` path's no-`tput` behavior in
the libc path.

```md
do not file as-is

Existing issue: crossterm-rs/crossterm#422.

Additive content if ever posted: on a host with a large PATH (here 105 entries, /usr/bin at position 95),
the tput fallback costs ~94 failed execve per spawn and ~564 per size() render, because the spawn uses the
bare name "tput" and libc walks PATH. Measured: 72.7 ms mean (max 605 ms) piped, vs 15.4 ms with a short
PATH. Suggestion: mirror the rustix path (no tput fallback) in the libc path, or cache the first size() result.
```
