# music-player on Windows: first test runs failed on libc, path separators, case folding, notify events and CI plumbing

Date:
 2026-10-15.
Scope:
 `package/music-player/desktop-app` built for `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc` and
 `x86_64-pc-windows-gnu`, run on GitHub-hosted runners (`windows-2025`, `windows-11-arm`) and under Wine.
Decision record:
 [music-player-windows-linkers.md](../decision/music-player-windows-linkers.md).

The Windows test suite had never run before 2026-10-14.
Each section below is one cause found by the first runs, with the evidence and the fix that landed.
Most causes are in this repository's own code or CI, not in an external tool.
The external-tool findings are the `notify` Windows backend, GitHub's allowed-actions policy, GNU tar on Windows,
 `turso_sdk_kit`'s build script, and Wine.

## The lib-test build failed everywhere: `libc` is not a Windows dependency

### Symptom

Run 38668416002 (all four jobs) stopped before any test ran,
 because `src/refresh_cost_tests.rs` called into `libc`
 and the package depends on `libc` only for Linux and macOS targets.

### Root cause

`refresh_cost_tests.rs` measured the CPU time of the process with `libc::getrusage`.
The `libc` dependency sits under
 `[target.'cfg(any(target_os = "linux", target_os = "macos"))'.dependencies]` in `Cargo.toml`,
 so the symbol did not resolve on Windows.

### Fix

A `#[cfg(windows)] cpu_seconds` that reads `GetProcessTimes` through the `windows` crate (already a Windows dependency),
 and `#[cfg(not(windows))]` keeps the `libc` version.

## Eleven tests assumed Unix paths, symlinks and a case-sensitive disk

### Symptom

Run 38669400881 built on all four jobs and ran 1381 tests; the same eleven failed on every job, 1370 passed.

### Root cause and fix, by group

- A symlink assertion in `src/scan_stream_tests.rs` ran on Windows, where an unprivileged process cannot create the
  symlink: it is now `if cfg!(unix)`.
- `src/controller_refresh_flow_tests.rs` and `src/controller_flow_tests.rs` compared or built paths with a literal `/`:
  they now compare `/`-joined components and build paths with `.join("A").join("2.flac")`.
- `src/change_plan_tests.rs` and `src/walk_order_tests.rs` generated random file names that differ only by case.
  On NTFS (case-insensitive) two such names are the same file.
  `src/refresh_test_support.rs` probes once whether the temporary disk folds case (`folder_names_ignore_case`,
  a `OnceLock`) and `pick_stem` avoids a colliding stem. The Linux random sequences are unchanged.

## `Modify(Any)` from `notify` on Windows made every refresh request another refresh

### Symptom

Run 38670823208 failed five watch tests and run 38671794537 failed three, after the first fix.
The failing assertions expected only plain writes to the named files, and the events that arrived included
 `Modify(Any)` about the watched parent folder.

### Root cause

The `notify` 8.2.0 Windows backend maps every `FILE_ACTION_MODIFIED` to one unspecific kind:

```rust
// notify-8.2.0/src/windows.rs:448-449
FILE_ACTION_MODIFIED => {
    let kind = EventKind::Modify(ModifyKind::Any);
```

Linux and macOS report writes as `Modify(Data)` or `Modify(Metadata)`.
`Change::of_event` in `src/change_set.rs` treated every other modify kind as structural, so each Windows write made the
 refresh read the whole folder.

A second event came from a probe test added for one CI run on a GitHub Windows runner: `read_dir` of a watched folder,
 with no write at all, produced `Modify(Any)` for that folder and nothing else.
The watch filter in `windows.rs:284-290` lists file name, directory name, attributes, size, last write, creation and
 security, and does not list last access, so the mechanism that makes a plain read report a modification is not proven;
 only the measured event is.
The refresh itself reads folders, so with this event left in, each refresh would request the next one
 (inferred from the probe, not observed as a loop).

### Fix

`event_is_a_plain_write` (`src/change_set.rs`) treats `Modify(Any)` as a plain write on Windows only.
`folder_was_only_read_or_touched` drops an unspecific modified event about an existing folder on Windows only;
 real changes inside a folder arrive as their own events.
Both have unit tests in `src/change_set_tests.rs`; `src/watch_tests.rs` prints the event that arrived on failure and
 accepts the modified parent folder on Windows.

### Tradeoff

Dropping a folder's own `Modify(Any)` means a metadata-only change of a folder (for example an attribute change) does
 not request a refresh.
The app reads file names and file contents, not folder attributes, so nothing it displays depends
 on that event.

## A test was flaky: two sweeps of one load decoded a track twice

### Symptom

`measure::...two_sweeps_of_one_load_decode_a_track_only_once` failed once on the MSVC x64 job in run 38672700706
 ("2 vs 1") and once under Wine.

### Root cause

The non-quiet sweep peeks the cache when it starts and reports hits.
A thread that started late reported the track a second time, so the count depended on scheduling.

### Fix

The test waits for the first sweep's first progress report before it starts the quiet sweep (commit abd7619406).

## `startup_failure` from a workflow that uses `msys2/setup-msys2`

### Symptom

Run 38668138999 ended in `startup_failure` with no job started.

### Root cause

The repository's GitHub Actions policy is `selected` with `sha_pinning_required: true`.
`msys2/setup-msys2` is neither GitHub-owned, nor by a verified creator, nor in the pattern list:

```text
gh api repos/Aquaticat/Monochromatic/actions/permissions/selected-actions
patterns: pnpm/* cargo-bins/* google/* returntocorp/* ossf/* jdx/* changesets/*
```

### Fix

The workflow runs the MSYS2 that the `windows-2025` image already has at `C:\msys64` through
 `C:\msys64\usr\bin\bash.exe -lc 'pacman ...'`, and caches the pacman package downloads with `actions/cache`.
Check the allowed-actions list before adding a third-party action.

## GNU tar on Windows reads `C:` as a remote host

### Symptom

Run 38668190187 failed extracting the cargo-nextest archive with `tar (child): Cannot connect to C: resolve failed`.

### Root cause

`tar` from Git for Windows (GNU tar) treats `NAME:PATH` as `HOST:PATH`, so `--file C:\...` or `-C C:\...` names a host.

### Fix

The step changes into the target directory and passes relative paths to `tar`.

## `turso_sdk_kit` runs a bare `windres` for every non-MSVC Windows target

### Symptom

The cross build in the Fedora container stopped with "compile Windows version resource: No such file or directory".

### Root cause

The `turso_sdk_kit` 0.8.2 build script runs `windres` by that bare name for every Windows target that is not MSVC.
Fedora installs the cross tool only as `x86_64-w64-mingw32-windres`; MSYS2 on Windows has the bare name.

### Fix

`Containerfile.windows-gnu` links `/usr/local/bin/windres` to the prefixed tool.

## The default Fedora mirror was about 50 KiB/s

The image build downloads hundreds of megabytes of packages (gcc, mingw, Wine).
`podman build --build-arg FEDORA_MIRROR=https://mirrors.kernel.org/fedora` replaces the metalink with that mirror;
 package signatures are still checked.

## Wine differs from Windows in ways the real runners do not show

These were seen in `mise run //package/music-player/desktop-app:test:windows-gnu`
 (cross-built GNU binaries run by `wine64` in `localhost/monochromatic/music-player-windows-gnu`).
The same tests pass on the real Windows runners (1383 tests run, 1382 passed, 1 skipped).

- Without system fonts in the Wine prefix, Slint's software renderer panics in `systemfonts.rs:71`
  ("no system font") in three `ui_focus_ring_pages_tests`.
  The image installs the `wine-*-winefonts` packages.
- A deleted-but-open file stays visible under Wine, so two tests that assert playback and selection react to a removed
  file fail (`controller_flow::...removing_the_selected_file_reports_it_and_stops_playback` and
  `controller_measures::refresh_tests::flow::the_selected_track_follows_its_path_...`).
  The cause was not proven.
- The test timed out waiting for the event (Wine's `ReadDirectoryChangesW` is the suspect, not proven) for
  `watch::tests::a_file_written_in_place_is_reported_by_its_own_path` within its timeout.
- `refresh_scale_tests::one_replaced_file_in_a_million_tracks_costs_milliseconds_not_a_walk` failed with
  "the folder is created: File not found" under Wine only.

A Wine failure that the real runners do not reproduce is not a defect of the Windows build.
Treat the real runners as the authority, and Wine as a cross-compile proof that the binary starts and mostly passes.

## Upstream filing decision

- `.out-of-scope/` has no entry for `notify` or GitHub Actions policy.
- Duplicate search: `gh search issues --repo notify-rs/notify "FILE_ACTION_MODIFIED ModifyKind::Any windows"` returned
  no result on 2026-10-15.
- The `Modify(Any)` mapping is the backend's coarse design, not a defect with a clear fix; no minimal fix was
  prototyped, and the read-triggers-modified event lacks a proven mechanism.
  The default policy is not to file, so nothing is filed.
