# Native scanner embedding verification

## Purpose and scope

Complete the delegated Linux verification of the in-process scanner authorized with the Rust cli-git rewrite.
Changes are confined to `package/cli/forbidden-strings/`,
its fuzz sidecar,
and this document.
The linter and wrapper remain the main agent's work.
No installed production tool was published or replaced.

The scoped Linux queue is complete.
The full mutation campaign remains non-green on Linux because native Windows prefix detection is not exercised there.
Those survivors are retained,
not excluded.
A Windows-native follow-up caught both of them with an existing test.
`Windows-native follow-up` records that run and the separate Windows findings it left open.
Its device-namespace finding is now fixed and tested on Linux with supplied native prefixes;
native Windows confirmation of that fix is pending.
`Device-namespace pathnames` records the fix.

## Requirements preserved

- Caller-owned exact bytes,
  native logical paths,
  opaque candidate identity,
  typed findings,
  and structured cache warnings.
- Ordinary standalone output and exit codes.
- No partially constructed scanner returned after a caught load panic.
- Panic output suppression separate from unwind control flow.
  Libraries do not implicitly replace their host's hook.
- Bounded container,
  mutation,
  and fuzz verification with copied-source provenance and retained failure evidence.

## Terminal verification results

### Release consumers

`test:release:container` passed:
158 library tests,
2 binary-boundary tests,
2 embedding tests,
2 public cache-warning tests,
40 CLI integration tests,
and 8 pathname tests.
The complete suite included the shipped-corpus compiler conformance tests.

Evidence is `package/cli/forbidden-strings/target/verification/release-test-TsLNHP`.
Source snapshot is `6abe8fdc5f431d1c5da0845f64535a3a322e4012e876fea52cd86edd1ed22419`.
Image is `sha256:32bb9011eca6c543a4ce84ff6c8d6f63c1d96a54df2afc80afdde475393d8b55`.
The actual command was
`cargo test --release --offline --locked --all-targets --all-features -- --test-threads=1`.

Later Rust differences are a warning-test loop binding rename
and registration of process-isolated startup-filter tests.
The runtime scanner implementation is unchanged from that release snapshot.
The later startup mutation baseline executes the added tests too.

### Clippy

Both final long-form gates passed with warnings denied:

- Scanner:
  `package/cli/forbidden-strings/target/verification/clippy-Ae9y8s`.
  Snapshot `65022cd9cd6f681a84d7993cf3675c3cc164a57e9473b41e66affeb4544deed1`.
  Image `sha256:0ca233f906b8e0219600879b9d346ee59f8cd8988008ccd68cc8ad72eae591c2`.
  `cargo clippy --offline --locked --all-targets --all-features -- --deny warnings`.
- Fuzz sidecar:
  `package/cli/forbidden-strings.fuzz/target/verification/fuzz-clippy-d8dn93`.
  Snapshot `c81460818434133b193dc029310091db8a8d1954ff4b85bb09e8fec639372b16`.
  Image `sha256:ef3e1ae994ab8eba518ea2eab99210aa7e14fb37f6444b69087f89c8da103839`.
  `cargo clippy --offline --locked --all-targets -- --deny warnings`.

No lint policy was loosened and no suppression was added.
The first fixture lacked `cargo-clippy`;
the runner now bakes the installed compiler/Clippy into the image rather than mounting host tools.
Clippy exposed seven existing shadowing findings,
then one in the added cache-warning fixture.
Binding names were corrected.

### Coverage-guided embedding fuzzing

The strengthened `fuzz_embedding` ASan target passed 256,297 runs in 121 seconds.
LibFuzzer reported 1176 coverage edges,
6514 feature signals,
and a retained 840-input corpus.
Corpus and artifact retrieval both succeeded.

Evidence is `package/cli/forbidden-strings.fuzz/target/verification/embedding-fuzz-E8GGvr`.
Snapshot is `7d6c74c860a4fbb425578ebb7a729f750333729fd5aa65dd70b2e5f594255eeb`.
Image is `sha256:58c7fc36223bc580b21abff353a7eab74bfea77cb9699a23d445c3ac9730fb4f`.
The target compares every finding variant against independent fixed-rule content/name byte searches.
An unexpected `EngineError` cannot disappear through content-only filtering.
Positive controls cover both hybrid matcher subsets,
native invalid bytes,
protocol escaping,
and matching-name redaction.
Seeds place NUL at either side of the 8192-byte boundary and place a literal across the cutoff.

The fuzzer compiles the final runtime scanner and strengthened oracle.
Later warning/startup test files are not compiled by this target.
This is Unix-only fixed-rule scan coverage,
not arbitrary-rule compiler fuzzing or filesystem cache-loader fuzzing.

### Panic guards and exact observations

`test:guards:container` passed its protected fixture and all disabled-guard controls:
the protected consumer passed its 3 tests;
each of 5 source variants rebuilt and failed the expected consumer assertion.
The guards removed independently were output suppression,
process catch,
load catch,
content catch,
and pathname catch.
Fault triggers exist only in disposable copied source,
never production environment configuration.

An independent `test:guards:observe:container` campaign then passed on all 6 immutable guard images.
It checks precise consequences rather than accepting an arbitrary failed test:

- Host-hook invocation is counted immediately after each load/scan fault and deliberate post-operation probe.
  All 7 expected invocations occur,
  including after successful and recovered calls.
- Protected public load returns the fixed redacted error;
  removing its catch makes the same operation unwind instead.
- Protected content/name scans return explicit `EngineError` records without partial matcher hits;
  removing the corresponding catch makes that operation unwind.
  Unrelated healthy loads and later scans still have to pass.
- Startup and worker exit/payload observations are collected independently.
  Hook removal exposes synthetic payloads in both cases;
  process-catch removal changes both actual executable exits from `2` to `101`.
- Real CLI input files exercise its parallel per-file scan.
  Protected matcher faults produce the incumbent engine-error finding and exit `1`.
  Removing content/name catches lets the real worker unwind reach the process boundary,
  producing redacted exit `2`.
  Removing the output hook exposes the synthetic matcher payload in those real worker paths.

The first worker fixture explicitly joins and resumes a worker unwind.
That fixture alone is not proof of production worker propagation;
the additional real parallel CLI cases provide that evidence.
Guard campaigns use the test profile;
the ordinary release consumer suite is separate evidence.

Guard evidence directories are under `target/verification/guard-*` and `guard-observer-*`.
Every original consumer hash is checked before adding the independent observer.
`control.json` retains actual statuses and expected observations;
`manifest.json`,
`stdout.log`,
and `stderr.log` retain source/image/command provenance and complete output.

## Mutation outcomes and dispositions

### Full embedding campaign

`cargo-mutants 27.1.0` tested 147 mutants with all features enabled:
122 caught,
3 missed,
22 unviable,
and no timeouts.
The unmutated baseline passed.
The tool exited `2` because mutants survived;
the owning task retained the complete report and failed rather than labeling it green.

Report:
`package/cli/forbidden-strings/target/verification/mutation-fJH1Io/mutants.out`.
Snapshot:
`6abe8fdc5f431d1c5da0845f64535a3a322e4012e876fea52cd86edd1ed22419`.
Image:
`sha256:7ec6245d9f53cabf833643bc5b4ff4e38ab6654adc5edee4a407c290cd5489b2`.

The repeated mutant suite omits only the existing shipped-corpus compiler conformance tests.
The release suite runs those tests.
No surviving policy branch is excluded.

### Startup survivor closed by follow-up

`logging_filter -> Default::default()` survived the full campaign.
New process-isolated controls exercise missing,
invalid,
and explicitly configured `RUST_LOG` values.
The follow-up caught all 5 startup mutants,
including that survivor;
its full all-feature baseline passed.
There were no survivors,
unviable mutants,
or timeouts in the follow-up.

Evidence:
`package/cli/forbidden-strings/target/verification/startup-mutation-8JGRG5`.
Snapshot:
`ae2ed99e7eb6e8682862525f22956a2ba2cf024639bbec4049789c3e1ccd124a`.
Image:
`sha256:902996757c7cb9399a2b9794cb5edbff80f4e45924bc900b7326bd9dc293dc89`.
The historical full-campaign counts are not rewritten by this follow-up.

### Retained Windows-native survivors

- `src/path_name_bytes.rs:36`: replacing `prefix_parts` with `0` survives on Linux.
  Native Windows prefix detection is not reached on that target.
- `src/path_name_bytes.rs:36`: deleting the platform guard's `!` survives on Linux.
  Linux's path parser still produces no Windows prefix and the function returns `0`.
  This is tested-target equivalence,
  not Windows equivalence.

Pure Windows separator/counting helpers and supplied-prefix scan controls execute on Linux.
They do not replace Windows-native `Component::Prefix` verification.
Both survivors remain in the owning task and retained Linux reports,
whose counts are not rewritten.
The Windows-native run this limitation required has since been made:
both mutants are caught on native Windows by `path_scan::tests::windows_volume_prefix_is_not_name_segment`.
Controls,
provenance,
and the findings that run left open are in `Windows-native follow-up`.
The later device-namespace fix changes `src/path_scan.rs` but not `prefix_parts`;
a mutation rerun over the changed scan is pending.

### Unviable mutants

These are compiler rejections,
not test passes.
The retained logs classify 20 generated `Default` replacements as `rustc E0277`:

- `LoadedRules::cache_warnings`,
  `frx_load::load`,
  `load_from_text`,
  and `hybrid_from_text`.
- `frx_scan::scan_one_set` and `scan_content`.
- `load_request::execute_pending`,
  `protected_request`,
  and `load`.
- `Scanner::load`,
  `cache_warnings`,
  `scan`,
  and `scanner_from_text_for_fuzzing`.
- `path_scan::scan_path_records`,
  `scan_normalized_records`,
  and `scan_path`.
- `runtime_cache::load_or_compile` and `compile_and_repair`.
- `CacheWarning::compile_from_text` and `write_failed`.

The `LoadedRules::iter_sets` replacement produces `E0271`:
``expected `Once<&mut _>` to be an iterator that yields `&ScanSet`, but it yields `&mut _` ``.
The `logical_path` operator replacement produces:
`` `||` operators are not supported in let chain conditions ``.
Exact generated code,
compiler output,
and classification remain in `unviable.txt`,
`outcomes.json`,
and per-mutant `log/` and `diff/` files.

## Windows-native follow-up

### Purpose and outcome

This follow-up answers one question:
do the existing tests kill the two retained `prefix_parts` survivors on a real Windows target?
They do.
Both mutants are caught by `path_scan::tests::windows_volume_prefix_is_not_name_segment`,
an existing `#[cfg(windows)]` test that the Linux campaigns cannot execute.
No test code was added,
because neither mutant survived.

The same run produced two findings that it did not change:
the unmutated suite is not green on Windows,
and device-namespace pathnames are not name-scanned.
`Unmutated Windows baseline` and `Device-namespace pathnames` record them.
The baseline finding remains open.
The device-namespace finding was fixed afterwards,
pending native Windows confirmation.

### Target and toolchain

- Windows Server 2025 Standard Evaluation,
  version `10.0.26100.1742`,
  64-bit.
- `rustc 1.97.0 (2d8144b78 2026-07-07)` with host and target `x86_64-pc-windows-gnu`.
  This is the compiler commit of the Linux fixture.
- `cargo 1.97.0 (c980f4866 2026-06-30)`,
  Git `2.56.0.windows.1`,
  and WinLibs MinGW-w64 with GCC `16.2.0` and binutils `2.47`.
- A KVM virtual machine bounded to 4 virtual CPUs,
  8192 MiB of memory,
  and a 40 GiB disk.
- Commands ran as `nt authority\system` through the QEMU guest agent.
  The temporary directory was `C:\WINDOWS\SystemTemp\`.

Tests were built and run inside the VM,
the first route in the delegated order.
Cross-compilation and Wine were not used.
The rustup `x86_64-pc-windows-gnu` toolchain alone could not build the dependency graph:

- With only that toolchain,
  `windows-sys v0.61.2` failed with `error calling dlltool 'dlltool.exe': program not found`.
- With the toolchain's `self-contained` directory on `PATH`,
  its bundled `dlltool.exe` failed with `CreateProcess`.
  The toolchain ships no `as.exe`.
- With a complete MinGW-w64 on `PATH`,
  every dependency compiled.

### Controls and results

Each source variant replaced `src/path_name_bytes.rs` in a disposable copy inside the VM.
Mutant text is the retained `cargo-mutants 27.1.0` diff from `mutation-fJH1Io`,
reproduced byte for byte.
The guest verified each variant's SHA-256 before building,
and every campaign log shows the scanner being recompiled.

The command was `cargo test --locked --all-features --no-fail-fast`
with targets `--lib --bins --test embedding --test embedding_warnings --test path_names`
and harness argument `--test-threads=1`.
It ran in two forms for every variant:

- `suite`:
  adds the two shipped-corpus conformance `--skip` filters of the Linux mutation campaign.
- `green`:
  additionally skips exactly the six tests that fail on unmutated Windows source,
  so its baseline exits `0`.

Results,
in execution order:

- Unmutated source before the variants:
  `green` exits `0` with 164 passing tests;
  `suite` exits `101` with the six baseline failures only.
- `replace prefix_parts -> usize with 0`:
  caught.
  Both forms exit `101`.
  The only failure absent from the matching baseline is
  `path_scan::tests::windows_volume_prefix_is_not_name_segment` at `src\path_scan_tests.rs:155`.
  It observed `C\x3a/[REDACTED]/clean.txt:name:2 rule=0` where `name:1` is expected.
- `delete ! in prefix_parts`:
  caught by the same test with the same observed and expected values.
- Positive control `replace prefix_parts -> usize with 1`,
  a mutant the Linux campaign already caught:
  14 tests that pass in the matching baseline fail,
  8 library,
  1 embedding,
  and 5 pathname binary tests.
- Unmutated source after the variants:
  both forms reproduce their first baseline exactly.

On Windows both mutants make `prefix_parts` return `0` for every path,
so they are one behavior there.
Only that one library test distinguishes it.
The 8 binary-boundary tests in `tests/path_names.rs` pass under both mutants.

### Evidence and provenance

Evidence is `package/cli/forbidden-strings/target/verification/windows-native-8Wo0tM`.
Source snapshot is `f641523cda11a5ca4650b5b8374dccd170e95b234d2d22cf9021d6653a4ffe9e`,
taken at repository `HEAD` `eeb3f5e75` with last scanner or engine commit `f069f6576`.

- `manifest.json` hashes the 127 files sent to the VM and each variant,
  and records target,
  toolchain,
  VM bounds,
  and exact commands.
- `control.json` holds the expected observations and each campaign's exit code and failing tests.
- `logs/` holds the complete guest output of every provisioning step and campaign,
  including the three failed build attempts.
- `variant-*.diff` hold the hand-applied changes.

`src/path_name_bytes.rs`,
`src/path_scan.rs`,
and both pathname test files are byte-identical to the `mutation-fJH1Io` snapshot.
Only compiled inputs were sent:
the scanner's `Cargo.toml`,
`Cargo.lock`,
`build.rs`,
`src`,
`tests`,
and `data`;
the engine's `Cargo.toml`,
`Cargo.lock`,
and `src`;
and the tracked `forbidden-strings.append.txt` that a unit test embeds.
This snapshot hash covers a different file set than the Linux manifests and is not comparable with theirs.
`verify:evidence` reports one difference for this directory,
`clippy.toml`,
which was not sent because Clippy did not run in the VM.

### Unmutated Windows baseline

This finding is open.
The unmutated suite does not pass on Windows,
so the `green` form is a subset,
not the complete suite.

`tests/integration.rs` does not compile for Windows.
`tests\integration.rs:109` imports `std::os::unix::fs::PermissionsExt` without a platform gate
(`error[E0433]`),
and lines 110 and 124 call `Permissions::from_mode` (`error[E0599]`).
`--all-targets` therefore cannot build,
and the CLI integration tests,
40 on Linux,
did not run on Windows.

Six tests fail on unmutated source,
identically in every run:

- `path_scan::tests::absolute_path_under_root_uses_relative_name`:
  `logical_path` returned `C:\WINDOWS\SystemTemp\name-root-<pid>\nested/test.txt`,
  not `nested/test.txt`.
- `runtime_cache::path::tests::absolute_override_wins`:
  `absolute override: InvalidOverride`.
- `runtime_cache::path::tests::native_platform_roots_are_derived`:
  `macOS root: Unavailable`.
- `runtime_cache::path::tests::source_bytes_select_content_addressed_path`:
  the rendered path does not start with `/cache/forbidden-strings/v`.
- `runtime_cache::path::tests::xdg_resolution_follows_base_directory_spec`:
  `XDG root: Unavailable`.
- `public_warning_paths_preserve_scan_results_without_emitting_terminal_json`
  in `tests/embedding_warnings.rs`:
  the `blocked` mode reported reason `missing` where `unreadable` is expected.

No cause was established for any of them.
Unverified readings:
Unix-style absolute paths are not absolute to the Windows path parser;
`canonicalize` returns a verbatim `\\?\` root that the non-verbatim input does not start with;
and a file blocking the cache directory surfaces as not-found on Windows.
Whether each is a test assumption or scanner behavior is undecided.
The full form,
which also runs both conformance tests,
passed 151 library tests and failed the same six tests.

### Device-namespace pathnames

This finding was scanner behavior,
not a test artifact.
It is fixed and tested on Linux with supplied native prefixes;
native Windows confirmation is pending.
`Windows observation` keeps what the Windows run measured,
and the later subsections record the confirmed mechanism,
the fix,
its tests,
and what remains.

#### Windows observation

A disposable probe test,
never committed,
printed the scan of one forbidden directory name under each native path form on unmutated source.

These forms mask the name and report it as `name:1`:
`C:\`,
`C:/`,
drive-relative `C:name`,
`\\server\share\`,
`//server/share/`,
`\\?\C:\`,
`\\?\UNC\server\share\`,
`\\?\pictures\`,
relative,
and rooted without a drive.

Device-namespace forms do not:

- `\\.\COM1\VAULTTOKEN_LONG\clean.txt`:
  `prefix_parts` returned `2`,
  the display was `//./COM1/VAULTTOKEN_LONG/clean.txt`,
  and no finding was produced.
- `\\.\C:\VAULTTOKEN_LONG\clean.txt`:
  `prefix_parts` returned `2`,
  the display was `//./C\x3a/VAULTTOKEN_LONG/clean.txt`,
  and no finding was produced.

The forbidden name is neither reported nor masked.
Source reading,
not confirmed by a patched run:
`count_prefix_parts` at `src/path_name_bytes.rs:44` counts the `.` of `\\.\` as a prefix part,
while `scan_normalized_records` treats `.` as a navigation marker at `src/path_scan.rs:129`,
ahead of the prefix skip at `src/path_scan.rs:135`,
without consuming a prefix part.
The unconsumed part then skips the first real name.
Verbatim forms are unaffected because `?` is not a navigation marker.
The probe output is `logs/probe-baseline.log` in the evidence directory.
Those line numbers describe the tested snapshot.
Since the 2026-10-05 fix,
`count_prefix_parts` starts at `src/path_name_bytes.rs:51`,
the prefix skip is at `src/path_scan.rs:141`,
and the navigation-marker test follows it at `src/path_scan.rs:146`.

#### Confirmed mechanism

Linux tests that supply the native prefix bytes confirm that source reading's cause;
its scope was too narrow.
`count_prefix_parts` counts every non-empty run between `/` or `\` in the native prefix,
including the `.` of `\\.\`.
`scan_normalized_records` classified `.` and `..` as navigation markers before the prefix skip,
so a prefix part spelled that way was displayed without being consumed,
and the leftover count consumed the first real name.

The cause is not specific to `\\.\`:
any prefix part spelled `.` or `..` had the same effect,
including in verbatim forms.
`parse_prefix` in the standard library's `library/std/src/sys/path/windows_prefix.rs`,
read in the installed `nightly-2026-09-22` source,
produces such parts for these inputs,
each now a test case:

- `\\.\..\NAME`:
  `DeviceNS("..")`.
- `\\.\\NAME`:
  `DeviceNS("")`,
  whose 4-byte prefix `\\.\` has the single part `.`.
- `\\server\..\NAME`:
  `UNC("server", "..")`.
- `\\?\a/./b\NAME`:
  `Verbatim("a/./b")`,
  because verbatim parsing splits only at backslashes.
- `\\?\UNC\..\share\NAME`:
  `VerbatimUNC("..", "share")`.

So the recorded sentence that verbatim forms are unaffected
holds only when no verbatim prefix part is spelled `.` or `..`.

#### Fix

Commit `833483171` reorders the component loop of `scan_normalized_records` in `src/path_scan.rs`.
Empty components are still displayed and skipped first;
then every non-empty component consumes a prefix part while the counted prefix remains,
whatever its bytes;
only after the prefix are `.` and `..` classified as navigation markers.
A prefix part therefore means the same on both sides,
a non-empty run between separators,
and rustdoc on `count_prefix_parts` and `scan_normalized_records` states that contract.
The agreement relies on the standard library ending every prefix at a separator or the end of input
(`parse_next_component` and `parse_drive_exact` in the same file),
and on `normalize_bytes` inserting the separator after a drive-relative `C:`.
Linux behavior cannot change:
`prefix_parts` still returns `0` on non-Windows targets.

#### Tests

`src/path_scan_prefix_tests.rs` drives the production composition on every host:
`normalize_bytes` with Windows semantics,
`count_prefix_parts` on the raw native prefix bytes,
and `scan_normalized_records`.
Only native `Component::Prefix` detection is replaced:
each fixture supplies the byte prefix
that `parse_prefix` and `Prefix::len` in `library/std/src/path.rs` produce for its path,
and a helper rejects a fixture prefix that is not a byte prefix of its path.
`normalize_bytes` and `count_prefix_parts` became `pub(crate)` so this sibling module can call them.

Every form asserts that a forbidden name directly after the prefix is masked and reported as `name:1`,
and that a clean control under the same prefix stays visible with no finding.
Before-fix results come from the test-only tree,
after-fix results from the fixed tree;
`Fix verification runs` names both evidence directories.

Failed before the fix and pass after it:

- `device_namespace_port_prefix_form`:
  `\\.\COM1`.
- `device_namespace_drive_prefix_form`:
  `\\.\C:`.
- `device_namespace_pipe_name_with_dots`:
  `\\.\pipe\NAME.with.dots`,
  the pipe name following the `\\.\pipe` prefix.
- `device_name_containing_dots`:
  `\\.\device.with.dots\NAME`,
  a device name that is one prefix part.
- `navigation_markers_after_prefix_are_not_names`:
  `.` and `..` after `\\.\COM1` and after `\\server\share`.
- `empty_components_after_prefix_are_not_names`:
  repeated separators after `\\.\COM1`.
- `mixed_separators_keep_prefix_boundary`:
  `//.\COM1/NAME\…`,
  and `\\?/C:\NAME`,
  which the standard library parses as `UNC("?", "C:")` because a slash cancels verbatim parsing.
- `non_utf8_name_after_prefix`:
  the WTF-8 bytes of an unpaired surrogate after `\\.\COM1`,
  the non-UTF-8 form a Windows `OsStr` can hold.
- One test for each input in `Confirmed mechanism`:
  `device_name_spelled_parent_marker_is_prefix`,
  `empty_device_name_prefix_is_one_part`,
  `unc_share_spelled_parent_marker_is_prefix`,
  `verbatim_prefix_with_current_marker_run_is_prefix`,
  and `verbatim_unc_server_spelled_parent_marker_is_prefix`.
  They began as one combined test,
  which stopped at its first input before the fix;
  commit `38cb30dff` split them so a separate pre-fix run could show each input failing.

In `navigation_markers_after_prefix_are_not_names` and `mixed_separators_keep_prefix_boundary`,
the first input is the device-namespace case that failed before the fix;
their second input is a control that the old ordering also handled,
so a pre-fix run never reached it.

Passed before and after,
as controls for prefix forms the Windows run already found correct:
`drive_prefix_form`,
`drive_relative_prefix_form`,
`unc_backslash_prefix_form`,
`unc_slash_prefix_form`,
`verbatim_drive_prefix_form`,
`verbatim_unc_prefix_form`,
`verbatim_name_prefix_form`,
and `prefix_without_following_component`,
which covers `\\.\COM1`,
`\\.\COM1\`,
`\\?\UNC\server`,
`\\server\share`,
and `C:` with nothing after the prefix.

`path_name_bytes::tests::prefix_parts_count_navigation_spellings_and_device_markers`
pins the counting side of the contract for `\\.\COM1`,
`\\.\C:`,
`\\.\`,
`\\.\..`,
`\\server\..`,
and `\\?\a/./b`.
It passed before and after the fix,
because counting did not change.

`path_scan::tests::windows_device_namespace_prefix_is_not_name_segment`
is a `#[cfg(windows)]` test through the native parser:
`\\.\COM1`,
`\\.\C:`,
and `\\.\pipe\NAME.with.dots`,
plus a clean `\\.\COM1` control.
Only the Linux target is installed on this host,
so it has never been compiled.

The test files reached the repository inside concurrent commit `8fdbbded9`,
whose message describes only `desktop-app-ide` work;
that commit's tree holds exactly the test-only state,
without the fix.
A corrective GitHub comment on that commit names the omitted forbidden-strings part.

#### Fix verification runs

All runs used the package's own bounded container tasks on Linux.
Evidence directories are under `package/cli/forbidden-strings/target/verification/`
unless a fuzz path is named.

- Before the fix,
  `test:container` on the test-only tree:
  `test-gV0Dab`,
  snapshot `91310e945fa27ee624513d56c811c116ed7c902ad80d5aa7669e240b79e01d98`,
  image `sha256:b7d9943d3b97477971a3ff9d432625c04552520d4269274be6b740039e719d1f`.
  Its copied `src/path_scan.rs` and `src/path_scan_prefix_tests.rs` hash to the same bytes as commit `8fdbbded9`.
  The library suite reported 167 passed and 9 failed,
  and exited `101`;
  Cargo then stopped,
  so no other test target ran.
  Every failure is the masked-display assertion of a positive candidate:
  for example `//./COM1/VAULTTOKEN_LONG/clean.txt` where `//./COM1/[REDACTED]/clean.txt` is expected,
  and `//./C\x3a/VAULTTOKEN_LONG/clean.txt` where `//./C\x3a/[REDACTED]/clean.txt` is expected.
  Those two observed displays are byte-identical to the native Windows probe's.
- Before the fix,
  `test:container` on the split tests with only the fix reverted:
  `test-scZsf6`,
  snapshot `50cde2bef9648f6ea0dbf554866dc88585362fd1e623a38cbf80758e1109ec3f`,
  image `sha256:07acf355d3d57203e7a7ef1ad6b25302dedbbbaa478286c0216abcba196a2907`.
  It ran from a throwaway worktree at `f9d08ae79`
  whose `src/path_scan.rs` was replaced with the `8fdbbded9` version
  and whose test file was the split one;
  the worktree was removed and its evidence directory copied here.
  The library suite reported 167 passed and 13 failed,
  and exited `101`.
  Each of the five split tests failed on its own masked-display assertion,
  for example `//server/../VAULTTOKEN_LONG` where `//server/../[REDACTED]` is expected,
  and `//?/a/./b/VAULTTOKEN_LONG` where `//?/a/./b/[REDACTED]` is expected.
  The other eight failures are the tests that already failed in `test-gV0Dab`.
- After the fix,
  `lint:clippy:container` on the fixed tree before the test split:
  `clippy-DInplu`,
  snapshot `b2736ad4c2925e1afa9592700f2de8929af20ccc6eeceae265704889ec295ac8`,
  image `sha256:9270213fb34e7d73af29f3f029033abd0bee97f07a38fe89693e3ddc367cbb95`,
  exit `0` with no warning.
- After the fix,
  `lint:clippy:container` on the final tree with the split tests:
  `clippy-tHewn4`,
  snapshot `48ead60d3c715575d332a496ef0bda2714dce903cdd44c7b3db81ad90f4408c7`,
  image `sha256:167b707f83ff9e89580ad4fce5a391ec3a566b1edd2563e31cdd64ed841ad06f`,
  exit `0` with no warning.
- After the fix,
  `test:container` on the fixed tree before the test split:
  `test-nUgm3V`,
  snapshot `b2736ad4c2925e1afa9592700f2de8929af20ccc6eeceae265704889ec295ac8`,
  image `sha256:8cffcf36eee5b78652ef269a43883f66d54608baf3f69bcbcc8f546996d99f18`,
  exit `0`:
  176 library,
  4 executable unit tests in `src/main.rs`,
  2 embedding,
  2 public cache-warning,
  40 CLI integration,
  and 8 pathname tests passed,
  with none failed or ignored.
- After the fix,
  `test:container` on the final tree with the split tests:
  `test-Nm8ISE`,
  snapshot `48ead60d3c715575d332a496ef0bda2714dce903cdd44c7b3db81ad90f4408c7`,
  the same snapshot as `clippy-tHewn4`,
  image `sha256:9c1d8dbb303da6872c0413f16b1150f968ca48beb336effd5b36c3312cf9f393`,
  exit `0`:
  180 library,
  4 executable unit tests in `src/main.rs`,
  2 embedding,
  2 public cache-warning,
  40 CLI integration,
  and 8 pathname tests passed,
  with none failed or ignored.
  All 21 tests in `path_scan::prefix_tests` and the new counting test pass.
- After the fix,
  `smoke:embedding:container` in the fuzz sidecar:
  `package/cli/forbidden-strings.fuzz/target/verification/embedding-fuzz-HWNmVN`,
  snapshot `08fce78006d3b4ccb619345108503177d6631ed26dabac245cfa230c88a7672b`,
  image `sha256:f797ef626d32049c0a5cf08093b89a8211d173c05acc0b75d37c6c4d963c6730`.
  It passed 272,348 runs in 121 seconds,
  with 1181 coverage edges,
  6293 feature signals,
  a retained 835-file corpus,
  and no crash artifact;
  its copied `src/path_scan.rs` is the fixed file.
  The target builds native Unix paths,
  where `prefix_parts` is `0`,
  so the reordered prefix branch is never entered there:
  this shows no Linux pathname regression,
  not anything about Windows prefixes.

Package checks on the final tree:

- `verify:evidence` reports 0 compiled-input differences for `test-Nm8ISE` and `clippy-tHewn4`.
  The earlier runs differ by exactly the files changed after them:
  1 for `test-nUgm3V`,
  `clippy-DInplu`,
  `embedding-fuzz-HWNmVN`,
  and `test-scZsf6`;
  3 for `test-gV0Dab`;
  and 6 for `windows-native-8Wo0tM`,
  which now also differs in the five pathname source and test files.
- `lint:rust` exits nonzero with 8 `require-rustdoc` findings,
  all on `use` lines of files this fix does not touch:
  3 in `src/load_request.rs`,
  1 in `src/process_boundary.rs`,
  and 4 in `src/scanner.rs`.
  It reports nothing for the touched files,
  including no `max-lines` finding.
- `verify:markdown` renders both READMEs and this document without literal bold delimiters.
- The guard campaigns were not rerun.
  The only text anchor `bin/guard-container.mjs` substitutes in `src/path_scan.rs`,
  `catch_unwind(matcher)` for the `without-name-catch` variant,
  still occurs exactly once in the fixed file;
  `bin/observe-guards-container.mjs` substitutes no `path_scan.rs` text.
- No mutation campaign was run for the fix.
  The only scanner mutation tasks are the full embedding campaign and the startup-only campaign,
  so a rerun over the changed `src/path_scan.rs` is pending.

#### Pending Windows confirmation

- Rebuild and run the Windows `green` and `suite` forms at a snapshot that contains commit `833483171`,
  as in `Controls and results`,
  and confirm that `windows_device_namespace_prefix_is_not_name_segment` compiles and passes
  and `windows_volume_prefix_is_not_name_segment` still passes.
- Rerun the disposable probe at the same snapshot
  and expect `name:1` with a masked name for both device-namespace forms.
- The retained scratch drivers in the evidence directory
  (`prepare.mjs`,
  `drive.mjs`,
  and `sequence.mjs`)
  hash a fixed variant set and name a destroyed VM,
  so they need adapting rather than rerunning as-is.
  `Host bridges` and `doc/troubleshooting/mvm-libvirt-flatpak-only-host.md` describe what this host needs first.

### Host bridges

The `mvm` MCP tools could not reach libvirt on this host:
`list_vms` failed twice with `Command failed: virsh --connect 'qemu:///session' list --all`.
The host has no `virsh` or `qemu-img` on `PATH`;
libvirt `12.4.0` and QEMU `11.0.1` exist only inside the `org.virt_manager.virt-manager` Flatpak.

- Scratch `virsh` and `qemu-img` shims ran the Flatpak's tools,
  and the `mvm` CLI ran with them first on `PATH`.
- The session `virtqemud` was started explicitly.
  A daemon spawned by a piped `virsh` call held the pipe open for about 120 seconds.
- `mvm create --image windows` failed at start with `Unable to find a satisfying virtiofsd`.
  The Flatpak ships none,
  so the domain was redefined without its virtiofs share,
  and files reached the guest over HTTP from host loopback at `10.0.2.2`.
  `push_to_vm` and `pull_from_vm` depend on that share.
- The cached Windows template's evaluation period had lapsed.
  `slmgr.vbs /rearm` ran on the disposable overlay disk only;
  the template was not modified,
  and the license state was not read again after the reboot.

The VM `fsnative-20261005` was destroyed after evidence retrieval.
The file server and the session daemon started for this run were stopped.
The scratch drivers are retained in the evidence directory.

### Scope of this closure

- Closed:
  both retained survivors are caught on native Windows,
  with a passing subset baseline before and after,
  and a failing positive control.
- The Linux report is unchanged.
  Both mutants stay equivalent on that target and stay listed as missed there.
- The run used the GNU ABI target.
  The published Windows binaries are `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc`
  (`.github/workflows/cargo-publish.yml`),
  which were not exercised.
  In the installed `nightly-2026-09-22` standard library source,
  `library/std/src/sys/path/mod.rs` selects Windows path parsing by `target_os = "windows"` alone;
  the `1.97.0` source was not inspected.
- This is one manual run on one snapshot,
  not a recurring gate.
  The open baseline failures prevent an all-target Windows job from passing as the suite stands.

### Decisions left to the main agent

- Device-namespace name scanning is fixed in `scan_normalized_records`,
  with Linux supplied-prefix tests for every prefix form.
  Remaining:
  native Windows confirmation (`Pending Windows confirmation`)
  and a mutation rerun over the changed `src/path_scan.rs`,
  because the full campaign's report predates the fix and no package task mutates the pathname files alone.
- Triage of the non-compiling integration target and the six failing baseline tests.
- Whether to add a recurring Windows test job once the baseline is green.

`Windows baseline follow-up` takes up these three items.

## Windows baseline follow-up

### Purpose

This follow-up makes the scanner's test suite compile and run on native Windows,
triages every Windows baseline failure,
confirms the device-namespace prefix fix on native Windows,
and mutates the pathname files on their own.
It is in progress;
each subsection records a finished step.

### Linux-side changes

- `ea62f2558` makes `tests/integration.rs` compile for Windows.
  `read_error_surfaces_as_hit_and_nonzero_exit` is now `#[cfg(unix)]`,
  unchanged otherwise,
  because mode bits are a Unix permission model.
  The new `#[cfg(windows)]` test `windows_locked_file_read_error_surfaces_as_hit`
  holds the target open with share mode 0 while the scanner runs,
  so the scanner's own open fails with a sharing violation,
  and asserts a non-zero exit and `locked.txt: read error` on stderr.
  The README's "Read errors" list names such a file that cannot be opened.
- `16b52146e` adds rustdoc to the eight undocumented `use` lines.
  `lint:rust` now exits `0` with no finding.
- `3b85b4269` adds a `--pathname` scope to `bin/mutate-container.mjs`,
  mutating only `src/path_scan.rs` and `src/path_name_bytes.rs`
  with the same baseline,
  arguments,
  and consumer suite as the other scopes,
  and the task `test:mutation:pathname:container`.

The `x86_64-pc-windows-gnu` standard library was added to the host's `nightly-2026-09-22` toolchain
(`rustup target add`),
so Windows-only test code can be type-checked on Linux.
`cargo check --all-targets --all-features --target x86_64-pc-windows-gnu` passes on `ea62f2558`.
As a positive control,
the same check on a scratch copy holding the previous `tests/integration.rs`
reports exactly the errors the earlier Windows run recorded:
`` error[E0433]: cannot find `unix` in `os` `` and two `E0599` errors for `from_mode`.

### Pathname mutation scope on Linux

`test:mutation:pathname:container` tested 57 mutants in 12 minutes:
51 caught,
2 missed,
4 unviable,
and no timeouts.
The unmutated baseline passed.
`cargo-mutants` exited `2` because mutants survived,
so the task failed as designed rather than reporting green.

Evidence is `package/cli/forbidden-strings/target/verification/pathname-mutation-xxqPFq`.
Snapshot is `ac3fe2d101dde4ecc237dc798e51f260a13cecdf357429d45e5ffbe21d6183e1`.
Image is `sha256:e1e58fe4e4c43c209c798cf6aad70f92c880340a1236b07cca51711695458b03`.

The two missed mutants are the retained Windows-only survivors,
needing the Windows run:

- `src/path_name_bytes.rs:36:5: replace prefix_parts -> usize with 0`.
- `src/path_name_bytes.rs:36:8: delete ! in prefix_parts`.

Source evidence of their Linux equivalence:
`prefix_parts` returns `0` at its first line when `cfg!(windows)` is false;
with the `!` deleted it falls through to `path.components().next()`,
and the Unix path parser never yields `Component::Prefix`,
so it returns `0` again.

Every mutant of the reordered component loop in `scan_normalized_records` was caught,
including the prefix-skip comparison and decrement,
the navigation-marker comparisons after it,
and the name counter.
The unviable mutants are compiler rejections:
`E0277` for the `Default::default()` replacements of `scan_path_records`,
`scan_normalized_records`,
and `scan_path`,
and `` `||` operators are not supported in let chain conditions `` for `logical_path`.

## Matcher-state audit

Reuse is not inferred solely from `&self`.
`src/runtime_matcher.rs:163` owns the hit vector per call.
Engine paths under `package/rust-module/forbidden-regex/src/` show:

- `regex/batch.rs:369` and `regex/batch.rs:370`: per-call candidates and hits.
- `regex/batch.rs:521` and `regex/batch.rs:522`: fresh hit vector and `CheckedFull` scratch.
- `dfa/table.rs:236`: local DFA state.
- `counting/run.rs:50`: fresh current/next `State` buffers.
- `counting/product.rs:298`: local thread vector.
- `parallel.rs:160`: separate process-wide `CORE_COUNT: OnceLock<usize>` used for compilation scheduling.

The private malformed-offset test provokes a real internal bounds unwind and compares later scans.
Disposable public-scan controls fault after actual matcher work and compare later scans with pre-fault results.
These are distinct recovery proofs,
not a guarantee for every possible future engine defect.

## Export-to-evidence map

- `Scanner::load`:
  public embedding consumers cover runtime/cache-hit loads,
  explicit/implicit missing files,
  builtin selection,
  invalid rules,
  and non-UTF-8 Unix rule-file paths through cache publication/reload.
  Disposable controls cover partial construction,
  host-hook ownership,
  and subsequent same-thread loading.
- `Scanner::scan`,
  `CandidateScan`,
  and `ScanFinding`:
  snapshot/boundary tests cover identity,
  immutable bytes,
  colliding redacted labels,
  native paths,
  binary-prefix edges,
  explicit pathname failures,
  ordinary rendering,
  panic findings,
  and reuse.
  The strengthened fuzzer independently predicts every fixed-rule finding.
- `Scanner::cache_warnings` and `CacheWarning`:
  public consumers cover misses,
  hits,
  corruption repair,
  unreadable roots,
  write failures,
  unavailable roots,
  and invalid relative configuration.
  `warning_tests.rs` separately covers every closed reason/recovery token and exact JSON.
  Token constructor coverage is not conflated with public integration coverage.
- Feature-gated exports:
  all-feature tests execute accepted/rejected `load_from_text`
  and `scanner_from_text_for_fuzzing`,
  plus accepted/rejected/mismatched-source cache-codec controls.
- Load-request state:
  unit tests cover native-thread isolation,
  nested success,
  exact occupied-request restoration,
  panic before/after consumption,
  partial-construction disposal,
  and later same-thread recovery.

## Provenance and resource boundaries

All campaigns use the fixed Git 2.56.0 base
`6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`.
Runtime containers are network-disabled,
mount-free,
unprivileged user `1000:1000`,
and limited to 2 GiB,
2 CPUs,
128 PIDs,
and 4096 file descriptors.
Image builds have matching memory/CPU bounds.
The ASan campaign additionally has explicit input,
time,
and RSS budgets.

Manifests hash actual copied bytes and identify immutable images.
Repository `HEAD` is context only;
concurrent commits can differ from a copied snapshot.
`verify:evidence` compares both file sets,
including current files absent from an older manifest.
Later runner/docs edits do not become false evidence of a rerun.
Guard source comparisons distinguish intentional guard removals from test-only registrations.
Failed report retrieval retains its disposable container for recovery.

## Historical failures retained

- The inherited `proc_84b0` log passed 145 library,
  2 binary-boundary,
  2 embedding,
  40 CLI,
  and 8 pathname tests on its prior snapshot.
- `mutation-D4eD13` tested 134 mutants:
  91 caught,
  23 missed,
  18 unviable,
  and 2 timeouts.
  Feature-gated code was not enabled.
  Its complete reports remain intact.
- Those timeouts involve `prefix_parts` mutations at `36:35` and `38:19`.
  Logs stopped during builtin-name loading or binary integration tests.
  No cause is proven by those stopped lines.
  They did not recur in the all-feature campaign;
  that does not prove a root cause or a timeout fix.
- The initial ASan target passed 332,829 runs,
  but preceded the all-variant oracle strengthening.
  Final evidence uses the strengthened target.
- The first guard fixture expected `Usage:` instead of the established `USAGE:` header.
  Correcting that fixture produced the passing control;
  this was a test expectation error,
  not a scanner fix.
- An older active guard runner read an updated fixture between variants.
  That campaign is not final guard evidence.
  The current runner freezes the consumer once,
  and independent observations validate the terminal guard images.

## Commits and completion

Major scoped commits:

- `182853529`: nested loads,
  prefix edges,
  and caught-panic reuse tests.
- `d98920b10`: denied shadowing fixes without lint relaxation.
- `bdca1a82d`: native embedding ASan target and independent byte oracle.
- `df86d5963`: target-independent Windows policy and public cache-warning controls.
- `d03f6385a`: actual release consumer verification.
- `931d9b10d`: public matcher guard fixtures and rendered documentation.
- `e86fcbe96`: startup survivor controls and frozen consumer assertions.
- `c2a901e91`: per-operation hook observations and sidecar Clippy.
- `54a343dda`: verified long-form Clippy flags.
- `aa3f8ea6a` and `f069f6576`: final interface docs and source comparison refinement.
- `8fdbbded9`: the device-namespace prefix tests,
  committed inside a concurrent `desktop-app-ide` commit whose message does not mention them.
- `833483171`: prefix parts consumed before navigation classification.
- `c2c629313`: README statement that Windows prefix parts are not name segments.
- `38cb30dff`: one test per navigation-spelled prefix input,
  committed after the fix and shown failing against the reverted fix in `test-scZsf6`.
- `01029d830` through `42312f27a`: this document's device-namespace records.

Both READMEs and this evidence document are rendered through the installed CommonMark HTML-tree pipeline.
Trees and readable rendered text remain in `target/verification/docs`.
That check exposed and corrected README bold spans split across line endings.

The main agent should inspect the terminal results,
retained mutant classifications,
source inventories,
and the open findings in `Windows-native follow-up` before any production cutover.
No human response is needed to continue this scoped queue.
