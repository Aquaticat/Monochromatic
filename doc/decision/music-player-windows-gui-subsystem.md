# music-player: the Windows executable is a GUI-subsystem program that attaches to the console of its parent

Status:
 Implemented on branch `feat/music-player-windows-gui-subsystem`, proven on GitHub's Windows runners, not merged.
 Awaiting acceptance of one tradeoff: in PowerShell, `music-player --version > out.txt` leaves an empty file
 (it worked with the console-subsystem build of release 0.1.3); see "Consequences for users".
Decided:
 2026-10-15 (the details; the release agent proposed the approach after release 0.1.3).
Applies to `package/music-player/desktop-app` and the three Windows release files.

## Context

Release `music-player-v0.1.3` shipped three Windows executables linked for the console subsystem.
Windows opens a console window next to the app for every double-click start of such a file.
The release notes, `package/music-player/README.md` and `doc/decision/music-player-releases.md` said so.
The proposed follow-up was `#![windows_subsystem = "windows"]` plus `AttachConsole(ATTACH_PARENT_PROCESS)`,
so `music-player --version` still prints in a terminal.
This record checks that design against the Rust and Windows documentation and the sources, and records the details.

## Decision

- `src/main.rs` carries `#![cfg_attr(all(windows, not(test)), windows_subsystem = "windows")]`.
  The attribute alone is enough on both linkers; no `-mwindows` flag and no `.cargo/config.toml` change is needed.
  The `not(test)` part keeps the unit-test build of the binary a console program, so nextest output is unchanged.
  The debug build is a GUI program too, so the CI check inspects the same subsystem the release has.
- `main` calls `attach_parent_console()` (`src/console_attach_win32.rs`) before `logging::init()` and before
  `Cli::parse()`, because both print.
  The outcome is logged at debug level after the logger exists, so `--version` and a normal start print no extra line.
- The attach is skipped when both stdout and stderr already hold a usable handle (a pipe, a file, a console the shell
  passed on).
- When a handle is missing, the process attaches to the console of its parent.
  Afterwards, for each of stdout and stderr:
  a handle the process started with is put back when the attach replaced or cleared it;
  a handle that was missing and is still missing after the attach is pointed at `CONOUT$`;
  a handle that was missing and was supplied by the attach is kept.
  The decisions are pure functions in `src/console_attach.rs`, tested on every host (10 tests).
- A double-click start has no parent console (Explorer has none), so the attach fails with `ERROR_INVALID_HANDLE`
  and the program runs without a console. Its log lines and its startup error messages are not shown anywhere.
- Every Windows item is behind `cfg(windows)`; the pure half compiles on Linux and macOS.
  `windows` crate features added: `Win32_Security`, `Win32_Storage_FileSystem`, `Win32_System_Console`.
  `Cargo.lock` did not change.

## Sources checked

- The Rust reference, runtime chapter, `windows_subsystem`: accepted values are `"console"` and `"windows"`;
  the attribute applies to the crate root; it is ignored on non-Windows targets and on crate types other than `bin`;
  the `"windows"` subsystem runs detached from any existing console.
- rustc at commit `e9bbadf6824e` (the commit of the pinned `nightly-2026-10-13`),
  `compiler/rustc_codegen_ssa/src/back/linker.rs`:
  for the gcc driver (`GccLinker`, line 892) `windows_subsystem` passes `--subsystem` and the value to the linker
  (`-Wl,--subsystem,windows`, seen in the printed link line of the GNU job);
  for `MsvcLinker` (line 1151) it passes `/SUBSYSTEM:windows` and `/ENTRY:mainCRTStartup`.
  This is why the attribute alone works with GNU ld.
- Rust standard library at the same commit (`library/std/src/sys/stdio/windows.rs`, `library/std/src/io/stdio.rs`):
  `get_handle` returns `ERROR_INVALID_HANDLE` for a null handle, and `handle_ebadf` turns that error into a successful
  write that goes nowhere. `print!`, `eprintln!`, the panic message and the `tracing` stderr writer therefore never
  panic on a missing standard handle. The handle is read on the first write, so the attach has to run before it.
- Microsoft, `AttachConsole`: `ATTACH_PARENT_PROCESS` is `(DWORD)-1`; the call fails with `ERROR_ACCESS_DENIED`
  when the process already has a console and with `ERROR_INVALID_HANDLE` when the target has none; it is meant
  for programs linked with `/SUBSYSTEM:WINDOWS`, whose standard handles "will likely be invalid on startup".
- Microsoft, `GetStdHandle`, section "Attach/detach behavior": when attaching to a console, standard handles are
  "always replaced with console handles unless `STARTF_USESTDHANDLES` was specified during process creation".
  This is why a handle the process started with is put back after the attach
  (`> out.txt` passed by a parent that did not use `STARTF_USESTDHANDLES` would otherwise end up on the console).
- `windows` crate 0.62.2 (`src/Windows/Win32/System/Console/mod.rs`): `AttachConsole(u32)`, `GetStdHandle`
  (an `Err` for a null and for an invalid handle), `SetStdHandle`, `ATTACH_PARENT_PROCESS`.
- Microsoft, `start` command: "If you run a 32-bit graphical user interface (GUI) application, `cmd` doesn't wait for
  the application to quit before returning to the command prompt."
- PowerShell, `NativeCommandProcessor.cs`: a Windows GUI application at the end of a pipeline is started as a
  background process (`_isRunningInBackground = isWindowsApplication`), so PowerShell does not wait for it
  and does not read its output.

## Consequences for users

- Double-click: no console window.
- `cmd.exe` and PowerShell return to the prompt at once, because they do not wait for a GUI program.
  The program prints on the terminal it attached to, so the text can appear after the prompt.
- `music-player --version > out.txt` in `cmd.exe` and in bash writes the file. In PowerShell `>` gives an empty file for
  every GUI program, because PowerShell never reads the output (the CI step compares `music-player` with a probe program
  that has no console code; both gave 0 bytes). Use `music-player --version | Out-File out.txt`, `| Out-String`,
  or `Start-Process -Wait -NoNewWindow -RedirectStandardOutput out.txt`.
- Ctrl+C and closing the terminal reach the attached program as they reach any process attached to that console.
- A start by double-click that fails (no display, no graphics) shows no message; the exit status is 1 and nothing is
  logged anywhere. A log file or a message box would fix that and is not part of this change.

## Evidence

All runs are on GitHub-hosted runners with `.github/workflows/music-player-windows.yml` on this branch,
jobs `msvc-x64`, `msvc-arm64` and `gnu-x64-ucrt64`.

- Positive control, run 38751509147 at `a9b4a681d2` (the new checks, no attribute): all three jobs failed.
  The PE step printed `Subsystem in the PE header: 3 (IMAGE_SUBSYSTEM_WINDOWS_CUI)` and the link-line check failed.
  The bash and PowerShell `--version` steps and the 15 second launch passed on the console build, which is the baseline.
- First run with the attribute, run 38752464513 at `3434eaa455`: Subsystem 2 on all three jobs.
  The PowerShell step failed: `> out.txt` in PowerShell gave an empty file (see "Consequences for users").
- Run 38756439754 at `2db98160ed` and run 38757787904 at `7e5024d176`: all three jobs passed.
  Subsystem 2 (`IMAGE_SUBSYSTEM_WINDOWS_GUI`) read with `pefile` 2024.8.26;
  the printed link line holds `/SUBSYSTEM:windows` (MSVC) and `-Wl,--subsystem,windows` (GNU);
  `--version` through a bash pipe, `> file` in bash, `2>` of a bad argument (exit status 2),
  PowerShell pipeline capture, `2>&1`, `| Out-File`, `Start-Process -RedirectStandardOutput` and `cmd.exe > file`
  (the file held the text 105 to 117 ms after `cmd.exe` returned) all gave `music-player 0.1.3`;
  the 15 second launch check passed and the log file held the `tracing` lines;
  nextest ran 1432 tests with 1432 passed and 1 skipped on each job.
- The attach branch, run on a real console: a Python process creates a console of its own and starts the program with
  `CreateProcessW`. With no standard handle, `--version` and a bad argument (exit status 2) appeared in the console
  screen buffer. With stdout as an inherited file and stderr missing, with and without `STARTF_USESTDHANDLES`,
  the version stayed in the file with an empty console,
  and the bad-argument text reached the console with an empty file.
  This held on all three jobs.
- On `msvc-arm64` only, in the cases where stdout is a file and stderr is the console,
  the console held clap's error text with literal ESC characters (shown as left arrows).
  `anstream` 1.0.0 `AutoStream::always` passes ANSI through
  without enabling virtual terminal processing when `TERM` is set (the runners set `TERM=xterm-256color`) and stdout is
  not a console. The x64 jobs print plain text in the same case. That code does not depend on the attach,
  but no control run of a console-subsystem build covered this exact case.

- Release workflow, dispatch with `dry-run` true from this branch, run 38757804504 at `7e5024d176`: every job passed.
  The detect job printed `dry_run=true`; the step "Package (Windows executable)" printed `subsystem 2` for the x64,
  arm64 and GNU executables of the release profile; the notes carry "The executable opens no console window";
  the release job printed `DRY RUN, would run: gh release create` and created nothing.
- Positive control for that release check: the exact Python text extracted from `music-player-release.yml`
  was run with `pefile` 2024.8.26 on two executables from the windows-gnu image's `x86_64-w64-mingw32-gcc`.
  The `-mconsole` file (Subsystem 3) failed with the `::error::The Subsystem field ... is 3` line and exit status 1;
  the `-mwindows` file (Subsystem 2) passed.
  The release run itself did not build a console-subsystem file.

## Not verified

- Nobody looked at a Windows desktop: that a double-click opens no window is inferred from Subsystem 2 and the
  documentation, not seen.
- The attach to an interactive terminal (`cmd.exe`, PowerShell, Windows Terminal) was not run; the runner steps used
  pipes, files and a console created by a Python process.
- The prompt-returns-at-once behavior of `cmd.exe` and PowerShell is documented (`start` page, PowerShell source) and
  matches the measured `cmd.exe` return after about 100 ms, but no interactive session was observed.
- The windows-gnu container (`test:windows-gnu`, under Wine) was not run for this change.
- `clippy` for `x86_64-pc-windows-gnu` (run in the windows-gnu image with the clippy component added)
  reports 9 findings in code this change does not touch
  (`launcher.rs`, `change_set.rs`, `ui_progress.rs`, `ui_files.rs` and one function in `main.rs`)
  and none in the new files.
  The repository has no Windows clippy task, so these findings were never reported.
