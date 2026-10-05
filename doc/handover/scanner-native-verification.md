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
Its device-namespace finding is fixed,
tested on Linux with supplied native prefixes,
and confirmed on native Windows on 2026-10-05.
`Device-namespace pathnames` records the fix.
`Windows baseline follow-up` records the confirmation,
the triage of every Windows baseline failure,
and the pathname-only mutation campaign.
The Windows suite is not green:
two tests that block the cache root with a regular file fail there,
pending a human decision on the warning reason such a root should report.

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
The later device-namespace fix changes `src/path_scan.rs` but not `prefix_parts`.
The mutation rerun over the changed scan was made on 2026-10-05:
`Pathname mutation scope on Linux` and `Pathname mutation scope on Windows` record it.

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
The device-namespace finding was fixed afterwards and confirmed on native Windows.
The baseline finding was triaged in `Windows baseline follow-up`:
the integration target compiles,
five of the six failing tests pass,
and the sixth,
with one integration test that had never compiled,
awaits a human decision.

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

This subsection is the record of the first Windows run.
`Triage of the Windows baseline failures` establishes the cause of each failure it lists,
and `Whole Windows suite after the test fixes` gives the current state.

At that run,
the unmutated suite does not pass on Windows,
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
It is fixed,
tested on Linux with supplied native prefixes,
and confirmed on native Windows on 2026-10-05 (`Prefix-fix confirmation`).
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
When it was written only the Linux target was installed on this host,
so it had never been compiled.
It compiled and passed on native Windows on 2026-10-05,
and fails there under both retained `prefix_parts` mutants
(`Positive controls and prefix mutants on Windows`).

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
- No mutation campaign was run for the fix at that time.
  The only scanner mutation tasks then were the full embedding campaign and the startup-only campaign.
  The task `test:mutation:pathname:container` now exists,
  and `Pathname mutation scope on Linux` records its run over the changed `src/path_scan.rs`.

#### Pending Windows confirmation

All three items were done on 2026-10-05;
`Windows baseline follow-up` records them.
The `green` form was not rerun,
because the whole unfiltered suite now compiles and runs instead.
The original list follows.

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
  After `Windows baseline follow-up` two failures remain,
  so that still holds.

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
The first is done.
The second is done except for the blocked-cache-root pair,
which `Decisions left after the Windows baseline follow-up` hands to the human.
The third stays open,
with a proposal in `What a recurring Windows job would need`.

## Windows baseline follow-up

### Purpose

This follow-up makes the scanner's test suite compile and run on native Windows,
triages every Windows baseline failure,
confirms the device-namespace prefix fix on native Windows,
and mutates the pathname files on their own.

Outcome:

- Every test target compiles on Windows and the whole suite runs there with no filter.
- Five of the six recorded baseline failures were tests assuming Unix paths and are fixed in the tests;
  no production defect was found in them.
- The Windows suite is not green.
  The sixth recorded failure and one integration test that had never compiled fail for one cause,
  and that cause needs the human's decision
  (`Reason reported for a cache root blocked by a regular file`).
- The prefix fix is confirmed on native Windows,
  with failing positive controls on the same guest.
- The pathname mutation scope leaves two survivors on Linux,
  both caught on Windows,
  where no mutant of the scope survives.
- The virtual machine was destroyed and every daemon and server started for the run was stopped.

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

That campaign ran before `fe805727c` changed two test files,
one of which holds the test that kills the `logical_path` mutants.
The campaign was therefore repeated on the final tree:
`pathname-mutation-N02NWa`,
snapshot `50920f5bb0079aaf5c55327d9384229fa51093dab9b61cc3d7050d8967935d58`,
image `sha256:6927cfce3f638491f1cbcc2c4f5b669ff1aef3d7e0f167af7c2f39f30b09f254`.
It tested the same 57 mutants in 10 minutes with identical outcome lists:
51 caught,
the same 2 missed,
the same 4 unviable,
and no timeouts.

### Windows virtual machine and bridges

The `mvm` MCP tools still cannot reach libvirt on this host,
so the run used the scratch bridges of `Host bridges` again,
adapted in `/home/user/temp/agent/scanner-windows-baseline-20261005/`:

- The `virsh` and `qemu-img` shims ran the virt-manager Flatpak's tools,
  first on `PATH` for the `mvm` CLI only.
- The session daemon was started explicitly with
  `flatpak run --command=virtqemud org.virt_manager.virt-manager --verbose`,
  in the background with both streams redirected to a log file rather than a pipe.
  A following `virsh list --all` through the shim returned at once.
- `mvm --verbose --backend libvirt create --image windows wbase-20261005` created the overlay disk
  from the cached template and defined the domain,
  then failed at start with `Unable to find a satisfying virtiofsd`, as before.
  The domain was undefined and redefined from a copy of the generated XML
  without its `filesystem` and `memoryBacking` elements,
  then started.
- Bounds: 4 virtual CPUs,
  8192 MiB of memory,
  and a 40 GiB qcow2 overlay over `template-windows.qcow2`,
  user-mode networking only.
  The template's SHA-256 before the run was
  `0ff984dc6b93c3b4577d0836bae5cf76b1b905e4a7ceecce16ee066e23c40cb9`.
- The guest reported `License Status: Notification` with reason `0xC004F00F`.
  `slmgr.vbs /rearm` ran on the overlay only,
  followed by a reboot;
  afterwards `slmgr.vbs /xpr` reported that time-based activation expires on 2027-04-03.
- Files reached the guest from a scratch Node server bound to host loopback port 18432,
  which the guest reaches at `10.0.2.2`.
  It serves only the run's private `serve/` directory,
  answers GET only,
  and refuses traversal outside that directory.
  The guest verified every download's SHA-256 before use.

`mvm exec` proved unreliable under guest load.
While the guest extracted MinGW-w64,
one status poll failed with
`error: guest agent command timed out: guest agent didn't respond to command within '5' seconds`,
and `mvm exec` exited `1`.
The guest command itself completed:
`guest-exec-status` for the same guest process later reported exit `0` and the verified archive hash.
The run therefore drives the guest agent directly
(`guest-exec` and `guest-exec-status` through the `virsh` shim,
with a 60-second agent timeout and retried polls)
instead of `mvm exec`.

The guest is the template's Windows Server 2025 Standard Evaluation,
version `10.0.26100.1742`,
with the earlier run's toolchain:
`rustc 1.97.0 (2d8144b78 2026-07-07)` and `cargo 1.97.0` for host `x86_64-pc-windows-gnu`,
MinGit `2.56.0.windows.1`,
and WinLibs MinGW-w64 with GCC `16.2.0` and binutils `2.47`.
The MinGit and MinGW-w64 archives were checked against the hashes the earlier run recorded;
`rustup-init.exe` hashed to
`6d5b5709addc0122c916d8c810da8d8a7b086a5d64fa805ef404d506392aadc8`,
the value the earlier run logged.
Commands run as `nt authority\system`;
the temporary directory is `C:\WINDOWS\SystemTemp\`.

### Whole Windows suite before triage

Snapshot `s1` holds the scanner and engine compiled inputs at `3b85b4269`
plus the tracked `forbidden-strings.append.txt`:
128 files,
source hash `14b251e8895d22367db75404df8b04d5841a1a122bfa78f31975e6be032a2a20`,
archive hash `1cef886be8041f2025f7257124e708bf63bccd0c68686715586a35b78196ca2e`,
with no uncommitted change under those paths.
The command was
`cargo test --locked --all-features --all-targets --no-fail-fast -- --test-threads=1`,
with no `--skip` filter.

It exited `101`.
Every target compiled,
including `tests/integration.rs` for the first time on Windows:

- Library:
  174 passed,
  5 failed.
- `src/main.rs`:
  4 passed.
- `tests/embedding.rs`:
  2 passed.
- `tests/embedding_warnings.rs`:
  1 passed,
  1 failed.
- `tests/integration.rs`:
  39 passed,
  1 failed.
- `tests/path_names.rs`:
  8 passed.

No test was ignored or filtered out,
and both shipped-corpus conformance tests passed.
`windows_device_namespace_prefix_is_not_name_segment` compiled and passed,
`windows_volume_prefix_is_not_name_segment` passed,
and the new `windows_locked_file_read_error_surfaces_as_hit` passed.
The failures were the six recorded by the earlier run
and `cache_write_failure_keeps_scan_correct` in `tests/integration.rs`,
which had never compiled there.

The library count differs from Linux's 180 by the platform-gated tests:
three `#[cfg(unix)]` tests are absent on Windows
(`symlink_name_is_not_replaced_by_target`,
`publication_enforces_private_modes`,
and `native_path_bytes_are_not_replaced_before_matching`),
and the two `#[cfg(windows)]` prefix tests are absent on Linux.
Each platform compiles one of the two read-error integration tests.

### Windows probe

A disposable probe,
appended to a copy of `src/path_scan_tests.rs` in the guest and removed afterwards,
printed the Windows behavior each failure depends on.
The restored file's hash was checked.

- `Path::is_absolute` is false for `/private/cache`,
  `/xdg/cache`,
  `/home/user`,
  and `/Users/alice`,
  each of which has a root but no prefix.
- `PathBuf::from("/cache")` joined with three names renders
  `/cache\forbidden-strings\v0\rules.bin`.
- `canonicalize` of the temporary directory returns `\\?\C:\Windows\SystemTemp`:
  a verbatim prefix,
  and `Windows` where the input spells `WINDOWS`.
  `current_dir` returns the non-verbatim `C:\w\src\s1\package\cli\forbidden-strings`.
- `logical_path` relativizes a file to `nested\test.txt`
  when file and root are both verbatim or both non-verbatim.
  It keeps the full input when one is verbatim and the other is not,
  and when the root differs only in letter case.
- `fs::metadata` and `fs::read` of a path under a regular file fail with `NotFound`,
  raw OS error `3`,
  "The system cannot find the path specified."
  A path under an absent directory fails with the same kind and code.
  `create_dir_all` through the regular file fails with `AlreadyExists`,
  raw OS error `183`.

The same probe printed every pathname form of `Windows observation`
and the five navigation-spelled forms of `Confirmed mechanism`;
`Prefix-fix confirmation` records those lines.

### Triage of the Windows baseline failures

- `runtime_cache::path::tests::absolute_override_wins`,
  `native_platform_roots_are_derived`,
  and `xdg_resolution_follows_base_directory_spec`.
  Cause:
  `platform_absolute_path` in `src/runtime_cache/path.rs` validates the XDG and macOS branches
  with the host's `Path::is_absolute`,
  and Windows rules make the tests' Unix paths relative,
  so those branches return `InvalidOverride` or `Unavailable`.
  `current_platform` selects the platform with `cfg!`,
  so a Windows build never reaches those branches.
  Classification:
  tests that assume Unix host path rules;
  not a production defect.
  Fix in `fe805727c`:
  the Unix-target assertions moved,
  unchanged,
  into `#[cfg(unix)]` tests
  (`absolute_unix_override_wins`,
  `xdg_resolution_follows_base_directory_spec`,
  and `macos_native_root_is_derived`),
  and the Windows-target assertions run on every host
  (`absolute_windows_override_wins` and `windows_native_root_is_derived`).
  The function's rustdoc,
  "Validates path with selected target semantics",
  is accurate only on Unix hosts;
  `Rustdoc of platform_absolute_path` proposes a byte-explicit Unix branch,
  not applied because no Windows defect requires it.
- `runtime_cache::path::tests::source_bytes_select_content_addressed_path`.
  Cause:
  the test compared the rendered artifact path with a `/`-separated string,
  and Windows renders the joined components with `\`.
  Classification:
  test assumes the Unix separator.
  Fix in `fe805727c`:
  the test strips the root and asserts the exact component sequence below it:
  `forbidden-strings`,
  `v` plus the package version,
  the compile target's operating system and architecture,
  a 64-character lowercase hexadecimal digest,
  and `rules.bin`.
  The version and platform are spelled independently of the helpers that build them.
  This asserts more on Linux than the two string-prefix checks it replaces.
- `path_scan::tests::absolute_path_under_root_uses_relative_name`.
  Cause:
  the test built its root with `canonicalize` but its file from the plain temporary path;
  on Windows the canonical root is verbatim and differently cased,
  so `strip_prefix` fails and `logical_path` returns the input.
  The expected value also assumed `/` in the relative name,
  while Windows returns `nested\test.txt`.
  Classification:
  test assumes Unix `canonicalize` and separators.
  Production takes its root from `current_dir`,
  which is non-verbatim on Windows.
  Fix in `fe805727c`:
  each of the canonical and the plain root is paired with a file path built from it,
  the expected name is `nested` joined with `test.txt` in the host's spelling,
  and the pathname scan of that name must display `nested/test.txt` on both platforms.
  The residual,
  recorded but not changed:
  a verbatim argument under a non-verbatim root,
  or a root differing only in letter case,
  is not relativized.
  Every supplied segment is then still scanned and masked,
  so it lengthens the display but does not skip a name
  (`Verbatim and differently cased repository-relative names on Windows`).
- `public_warning_paths_preserve_scan_results_without_emitting_terminal_json` (`blocked` mode),
  and `cache_write_failure_keeps_scan_correct`.
  Cause:
  both block the cache by making the cache root a regular file.
  `read_artifact` in `src/runtime_cache/publish.rs` maps only `NotFound` to `Missing`.
  Linux reports `ENOTDIR` for a path under a regular file,
  which becomes `unreadable`;
  Windows reports error `3`,
  `NotFound`,
  exactly as for an absent directory,
  which becomes `missing`.
  Both platforms then report `write-failed` and keep the correct scan result.
  Classification:
  needs the human's decision,
  because the reason tokens are a cross-package protocol
  (`package/git-policy/forbidden-strings/src/cache-warning.ts` enumerates them)
  and no documented reason clearly owns a blocked root:
  `Missing` is "Expected content-addressed artifact did not exist",
  `Unreadable` is "Existing artifact could not be read completely",
  and `CacheRootUnavailable` is "Per-user cache root could not be resolved or used".
  Neither source nor tests were changed for these two;
  `Reason reported for a cache root blocked by a regular file` lists the options.

### Prefix-fix confirmation

At `s1`,
which contains `833483171`,
the probe printed `name:1` with the name masked for all 18 forms:
the 12 forms of `Windows observation`,
`\\.\pipe\NAME.with.dots`,
and the five inputs of `Confirmed mechanism`.
For example `\\.\COM1\VAULTTOKEN_LONG\clean.txt` now displays `//./COM1/[REDACTED]/clean.txt`
with finding `//./COM1/[REDACTED]/clean.txt:name:1 rule=0`,
and `\\.\\VAULTTOKEN_LONG`,
whose native prefix is `\\.\` (`DeviceNS("")`, one part),
displays `//.//[REDACTED]`.
For each probed form that `src/path_scan_prefix_tests.rs` also covers,
the raw native prefix the probe printed equals the bytes that fixture supplies;
the verbatim-name fixture spells its prefix `\\?\name` where the probe used `\\?\pictures`.
Three fixture forms were not probed:
`\\.\device.with.dots`,
`//.\COM1`,
and `\\?/C:`.
`windows_device_namespace_prefix_is_not_name_segment` compiled and passed in the whole-suite run.

### Whole Windows suite after the test fixes

Snapshot `s2` holds the same inputs at `fe805727c`:
128 files,
source hash `22f0d6e7b2f0dee2608d20a58801d5538df331a0acfa937fb647b6ddb164f45c`,
archive hash `4dffb0eb55a5e72edde95ee50822d3c573e8939bce4c39ea7d104e3b5d30b8da`.
No scanner or engine commit is later than `fe805727c`.
It was extracted beside `s1` in the same guest and shares its Cargo target directory,
so registry dependencies were not rebuilt;
every campaign log shows `forbidden-strings` recompiled.

The same command,
again with no `--skip` filter,
exited `101`:

- Library:
  178 passed,
  none failed.
- `src/main.rs`:
  4 passed.
- `tests/embedding.rs`:
  2 passed.
- `tests/embedding_warnings.rs`:
  1 passed,
  1 failed.
- `tests/integration.rs`:
  39 passed,
  1 failed.
- `tests/path_names.rs`:
  8 passed.

No test was ignored or filtered out.
The two failures are the blocked-cache-root tests held for the human's decision.
The Windows baseline is therefore not green:
234 tests ran,
232 passed.
The five other baseline failures are fixed.
The library count is 178 because the three Unix-target cache-root tests are now `#[cfg(unix)]`,
alongside the three `#[cfg(unix)]` tests named in `Whole Windows suite before triage`,
and the two `#[cfg(windows)]` prefix tests are present;
Linux runs 182 library tests.

### Positive controls and prefix mutants on Windows

Each variant replaced `src/path_name_bytes.rs` in the `s2` tree,
with its hash checked in the guest,
and ran the whole unfiltered suite.
The mutant texts' changed lines equal those of the `cargo-mutants` diffs retained in `pathname-mutation-xxqPFq`.
In execution order:

- Unmutated before:
  the two blocked-cache-root failures only.
- Positive control `replace prefix_parts -> usize with 1`:
  14 additional tests fail,
  8 library,
  1 embedding,
  and 5 pathname binary tests.
  So a failing variant is visible on the same VM,
  toolchain,
  and command that report the passing tests.
- `replace prefix_parts -> usize with 0`:
  caught.
  Exactly two additional tests fail:
  `windows_volume_prefix_is_not_name_segment`
  (`C\x3a/[REDACTED]/clean.txt:name:2 rule=0` where `name:1` is expected)
  and `windows_device_namespace_prefix_is_not_name_segment`
  (`//./COM1/[REDACTED]/clean.txt:name:2 rule=0` where `name:1` is expected).
- `delete ! in prefix_parts`:
  caught by the same two tests with the same values.
- Unmutated after:
  identical to the first baseline.

The new Windows read-error test has its own control.
With the exclusive handle dropped before the scanner is spawned,
`windows_locked_file_read_error_surfaces_as_hit` fails at its `locked.txt: read error` assertion;
the exit-status assertion alone would not show the difference,
because the unlocked file's content matches the rule,
as in the Unix test.
With the snapshot's file restored and its hash checked,
it passes.
The test therefore passes because of the sharing violation,
not because the scanner fails for another reason.

### Pathname mutation scope on Windows

The package's runner cannot execute on Windows:
`bin/mutate-container.mjs` builds and runs a Linux container with `podman`.
`cargo-mutants` itself can,
so the scope ran in the guest with the runner's own arguments,
after the hand-planted variants of `Positive controls and prefix mutants on Windows`.

Bridges tried for the tool:

- The published `cargo-mutants-x86_64-pc-windows-msvc.zip` of release `v27.1.0`,
  its SHA-256 `2a2f00e47d4b458262a41501b0820aa26015fd35779903d2c8b30b2993f36791`
  matching the release's published digest,
  does not start in this guest:
  `cargo mutants --version` exits `-1073741515` (`0xC0000135`, a required DLL was not found),
  and `vcruntime140.dll` is absent from `System32`.
- `cargo install cargo-mutants --version 27.1.0 --locked` with the guest's GNU toolchain built it from source.
  `cargo mutants --version` prints `cargo-mutants 27.1.0`,
  the version of the Linux campaigns.

The command was the Linux runner's,
`cargo mutants --in-place --all-features --baseline run --no-config --no-shuffle --colors=never`
with `--build-timeout 300 --timeout 120`,
`--cargo-arg=--offline --cargo-arg=--locked`,
harness argument `--test-threads=1`,
and `--file src/path_scan.rs --file src/path_name_bytes.rs`,
on the `s2` tree.
Its test command skips four tests,
two more than on Linux:

- `rule::frx::compile_tests::builtin_ported_all_compile`
  and `rule::frx::compile_tests::append_ported_compiles_end_to_end`,
  the shipped-corpus conformance tests the Linux campaigns also skip.
- `public_warning_paths_preserve_scan_results_without_emitting_terminal_json`
  and `cache_write_failure_keeps_scan_correct`,
  which fail on unmutated Windows source;
  `cargo-mutants` stops when its unmutated baseline fails.
  Neither test exercises pathname code.

`cargo-mutants` runs `cargo test` without `--no-fail-fast`,
so a mutant's log ends at the first failing test target.

First,
restricted with `--re path_name_bytes.rs:36:` to the three mutants of the `prefix_parts` guard line:
the unmutated baseline passed,
and all three were caught in 59 seconds,
with none missed,
unviable,
or timed out.

- `replace prefix_parts -> usize with 0`
  and `delete ! in prefix_parts`,
  the two Linux survivors:
  each fails exactly `windows_volume_prefix_is_not_name_segment`
  and `windows_device_namespace_prefix_is_not_name_segment` in the library target.
- `replace prefix_parts -> usize with 1`,
  the positive control Linux also catches:
  8 library tests fail.

Afterwards the guest's `src/path_scan.rs` and `src/path_name_bytes.rs` hashed to the snapshot's values,
so the in-place mutation left the tree unmutated.

Then the whole scope,
without `--re`:
57 mutants tested in 12 minutes,
53 caught,
none missed,
4 unviable,
and no timeouts.
The unmutated baseline passed and `cargo-mutants` exited `0`.
The 57 mutant names are the same as in the Linux campaign `pathname-mutation-xxqPFq`.
The caught set is the Linux caught set plus the two Linux survivors,
and the 4 unviable mutants are the same compiler rejections.
Both source hashes matched the snapshot again afterwards.

So over the pathname files,
no mutant survives on both platforms:
Linux misses only the two that cannot differ on a non-Windows target,
and Windows catches those two with its `#[cfg(windows)]` prefix tests.
This holds for the GNU ABI target and the four skipped tests listed here;
it is one manual run,
not a recurring gate.

### Linux verification of the final tree

All through the package's tasks,
on the tree at `fe805727c` unless a snapshot says otherwise.
Evidence directories are under `package/cli/forbidden-strings/target/verification/`.

- `test:container` on the goal-one tree (`3b85b4269`,
  the `s1` inputs):
  `test-kA3nVK`,
  snapshot `ac3fe2d101dde4ecc237dc798e51f260a13cecdf357429d45e5ffbe21d6183e1`,
  image `sha256:dde7184e444fc99e8a881486a207889d5a7c0a25c9104e991c6929951d9d7e70`,
  exit `0`:
  180 library,
  4 executable unit,
  2 embedding,
  2 public cache-warning,
  40 CLI integration,
  and 8 pathname tests passed,
  none failed or ignored.
  It shares its snapshot hash with `pathname-mutation-xxqPFq`.
- `test:container` on the final tree:
  `test-g2VM7D`,
  snapshot `4db08892f6863495ebb678db876b7d30b238bc60e5a2e21a086c8fd7cbbcf65b`,
  image `sha256:4dfabc3fd31a0bd2316b1fc38f7524073175b6eeb55d38470bcc8d98ad4c3b4d`,
  exit `0`:
  182 library,
  4 executable unit,
  2 embedding,
  2 public cache-warning,
  40 CLI integration,
  and 8 pathname tests passed,
  none failed or ignored.
  The two added library tests come from splitting two cache-root tests by target platform.
- `lint:clippy:container` on the final tree:
  `clippy-wuZQ0I`,
  the same snapshot,
  image `sha256:836482282bba17b82c0b288e5e190a078a6fe3ef13644f486e7b429f3c0a2f44`,
  exit `0` with no warning.
- `lint:clippy:windows`,
  a task added in `11f20de74`,
  runs Clippy for `x86_64-pc-windows-gnu` over every target with warnings denied.
  It exits `0`.
  This is the only Linux-side check that compiles `#[cfg(windows)]` code;
  it runs no test.
- `lint:rust` exits `0` with no finding.

No test is skipped,
ignored,
or filtered on Linux in these runs.
On Linux the `#[cfg(windows)]` tests are not compiled:
`windows_volume_prefix_is_not_name_segment`,
`windows_device_namespace_prefix_is_not_name_segment`,
and `windows_locked_file_read_error_surfaces_as_hit`.
On Windows the `#[cfg(unix)]` tests are not compiled:
`symlink_name_is_not_replaced_by_target`,
`publication_enforces_private_modes`,
`native_path_bytes_are_not_replaced_before_matching`,
`absolute_unix_override_wins`,
`xdg_resolution_follows_base_directory_spec`,
`macos_native_root_is_derived`,
and `read_error_surfaces_as_hit_and_nonzero_exit`;
the `native_rule_path` helper of `tests/embedding.rs` is empty there.

Two raw `cargo` invocations preceded the Windows-target task,
both with a scratch target directory:
`cargo check --all-targets --all-features --target x86_64-pc-windows-gnu`
for the compile check and its positive control,
and one filtered `cargo test --lib` of the edited test modules.
The container runs,
not those,
are the evidence.

### Decisions left after the Windows baseline follow-up

#### Reason reported for a cache root blocked by a regular file

This needs the human's decision.
Two tests fail on Windows because of it,
and they are the only failures left there:
`public_warning_paths_preserve_scan_results_without_emitting_terminal_json` (`blocked` mode)
and `cache_write_failure_keeps_scan_correct`.
On both platforms the scan result stays correct and a `write-failed` warning follows;
only the first warning's reason differs,
`unreadable` on Linux and `missing` on Windows.
`package/git-policy/forbidden-strings/src/cache-warning.ts`
and `package/git-policy/cli/src/optional/forbidden-strings/cache-warning.ts`
accept either token.

Option A:
keep the behavior and assert the platform's reason in the two tests,
`missing` under `cfg!(windows)` and `unreadable` otherwise.

- For:
  no production or protocol change;
  the Linux assertions stay exactly as they are;
  it states what each operating system can report.
- Against:
  the same condition has a platform-dependent reason,
  now pinned by tests.

Option B:
report `unreadable` on Windows too.
When the artifact read fails with `NotFound`,
check whether the cache root or an application directory exists and is not a directory.

- For:
  one reason on every platform;
  both tests pass unchanged;
  Linux output does not change.
- Against:
  more filesystem probes in the loader on every cache miss,
  with a window between the probe and the read;
  Windows-only behavior that Linux tests cannot reach.

Option C:
report `missing` everywhere,
by mapping `NotADirectory` to `Missing` in `read_artifact`.

- For:
  the smallest code change;
  matches "Expected content-addressed artifact did not exist" literally.
- Against:
  changes the published Linux output for a blocked root
  (other Unix targets were not measured);
  both tests change on every platform.

Option D:
report `cache-root-unavailable` everywhere,
by checking that the root is a directory or absent before reading.

- For:
  matches "could not be resolved or used" most literally.
- Against:
  changes output on every platform;
  that reason currently returns before publication,
  so the `write-failed` warning would disappear unless the flow is reshaped too.

Ranking:
A > B > C > D.
A over B because the two tokens have the same recovery and the same consumer handling,
so B buys only uniform wording at the cost of loader probes and a race.
B over C because B leaves published Linux output unchanged and C does not.
C over D because C changes one mapping,
while D also changes how many warnings a blocked root produces.

#### Rustdoc of `platform_absolute_path`

Its rustdoc says it "Validates path with selected target semantics so every platform branch is host-testable".
That holds for the Windows branch on every host,
and for the XDG and macOS branches only on Unix hosts.
Checking those branches byte-explicitly,
absolute when the first byte is `/`,
would make the sentence true everywhere and let the three `#[cfg(unix)]` cache-root tests run on Windows.
On Unix that is what `Path::is_absolute` already computes,
so no shipped behavior would change.
It was not applied,
because this follow-up's source changes were limited to proven Windows defects and this is not one.

#### Verbatim and differently cased repository-relative names on Windows

`logical_path` compares path components exactly.
The probe shows that a verbatim argument under a non-verbatim root,
and a root differing from the argument only in letter case,
keep every supplied segment.
No name is skipped,
so this is not a fail-open,
but findings then name directories outside the repository.
No change was made;
whether Windows arguments should be normalized before the comparison is a product choice.

### Repeating the Windows run

The Windows baseline is not green,
so these steps reproduce a run with exactly two expected failures until the blocked-root decision lands.
Every step was executed as written on 2026-10-05.
The scratch drivers that implement them are retained in the evidence directory named in
`Evidence of the Windows baseline follow-up`;
they name this run's domain and need that name changed.

1.  Put the `virsh` and `qemu-img` Flatpak shims of
    `doc/troubleshooting/mvm-libvirt-flatpak-only-host.md` first on `PATH`.
    Start the session daemon in the background,
    with its output sent to a file:
    `flatpak run --command=virtqemud org.virt_manager.virt-manager --verbose`.
2.  Create the overlay and domain with
    `mvm --verbose --backend libvirt create --image windows <name>`.
    It fails at start with `Unable to find a satisfying virtiofsd`.
    Run `virsh --connect qemu:///session undefine mvm-<name>`,
    copy `~/.local/share/mvm/vms/<name>/domain.xml` without its `filesystem` and `memoryBacking` elements,
    then `virsh define` and `virsh start` that copy.
    The generated domain has 4 virtual CPUs and 8192 MiB of memory.
3.  Wait until `virsh qemu-agent-command mvm-<name> '{"execute":"guest-ping"}'` answers.
    Run guest commands with `guest-exec` and poll `guest-exec-status` with `--timeout 60`,
    retrying failed polls.
    Print a fresh nonce first in every guest command and discard a status whose output lacks it
    (`Guest agent findings`).
4.  Read the license with `cscript.exe //nologo C:\Windows\System32\slmgr.vbs /dli`.
    If it reports `Notification`,
    run `slmgr.vbs /rearm` and `shutdown.exe /r /t 10` in the guest,
    which changes only the overlay,
    and wait for the agent to stop and answer again.
5.  In the guest,
    with `CARGO_HOME=C:\w\cargo` and `RUSTUP_HOME=C:\w\rustup`,
    run `rustup-init.exe` with the options `-y --no-modify-path`,
    `--default-host x86_64-pc-windows-gnu`,
    `--default-toolchain 1.97.0`,
    and `--profile minimal`.
    Unpack `MinGit-2.56.0-64-bit.zip` to `C:\w\git`
    (SHA-256 `064b440ff870ed5198527e8f3a92cdf5bd2fd0fedf5e718af95e3fdaddeff718`)
    and `winlibs-x86_64-posix-seh-gcc-16.2.0-mingw-w64msvcrt-14.0.0-r2.zip` to `C:\w\mingw`
    (SHA-256 `1b90ec73c96e6905a913746b56fb6b20122422787029810d3afc6a3b440f2322`).
    Prefix `PATH` with `C:\w\cargo\bin;C:\w\git\cmd;C:\w\mingw\mingw64\bin`.
6.  On the host,
    copy only compiled inputs into a private directory:
    the scanner's `Cargo.toml`,
    `Cargo.lock`,
    `build.rs`,
    `src`,
    `tests`,
    and `data`;
    the engine's `Cargo.toml`,
    `Cargo.lock`,
    and `src`,
    at the same relative paths;
    and the root `forbidden-strings.append.txt`.
    Archive them with `tar` and serve that directory on host loopback only.
    The guest downloads from `10.0.2.2`,
    checks the archive's SHA-256,
    extracts it,
    and runs `cargo fetch --locked` in the scanner directory.
7.  With `CARGO_PROFILE_DEV_DEBUG=0` and `CARGO_INCREMENTAL=0`,
    run `cargo test --locked --all-features --all-targets --no-fail-fast -- --test-threads=1`
    in the scanner directory.
    Expected at `fe805727c`:
    exit `101` with 232 of 234 tests passing and only the two blocked-cache-root tests failing.
8.  Run the positive control:
    replace the body of `prefix_parts` in `src/path_name_bytes.rs` with `1`,
    rerun step 7,
    and expect 14 additional failures.
    Restore the file,
    check its hash,
    and rerun step 7 to see the first result again.
    A passing Windows result counts only beside this failing control from the same guest.
9.  Tear down:
    `virsh destroy` and `virsh undefine` the domain,
    remove `~/.local/share/mvm/vms/<name>`,
    stop the file server and the session daemon,
    and confirm that `template-windows.qcow2` still has its earlier hash.

Before any of that,
`mise run //package/cli/forbidden-strings:lint:clippy:windows` on Linux shows
whether every target still compiles for Windows.
It needs `rustup target add x86_64-pc-windows-gnu` and no virtual machine.

### Guest agent findings

Two behaviors of the guest-agent bridge can make a run report the wrong result.
Both happened in this run and neither reached the recorded results.

- `mvm exec` exits `1` when one status poll exceeds the agent's 5-second timeout,
  although the guest command keeps running.
  That happened once during MinGW-w64 extraction;
  the command's real status was read afterwards and was exit `0`.
- The agent keeps an exited command's status until it is read,
  keyed by process ID alone.
  One earlier `mvm exec` call lost its launch reply to the same timeout,
  so its status was never read.
  Windows later gave the same process ID,
  2440,
  to the full-scope mutation command,
  and the first status read returned the old command's output with exit `0`
  while the mutation was still running.
  The stale record is retained as `logs/stale-guest-exec-status-pid-2440.txt`.
  The client now prints a nonce at the start of every guest command
  and keeps polling when a status lacks it.
  Every campaign log recorded before that was checked by content:
  each names its own snapshot label,
  variant,
  and placed-file hash.

### What a recurring Windows job would need

This is a proposal,
not a workflow;
none was added.
A Windows gate cannot pass today,
because two tests fail on unmutated source until the blocked-root decision is made.

- A decision on `Reason reported for a cache root blocked by a regular file`,
  then a Windows suite that exits `0`.
- A Windows runner with the scanner's Rust toolchain,
  Git on `PATH` for `all_mode_skips_configured_rules_file`,
  and network access for `cargo fetch --locked`.
  `.github/workflows/cargo-publish.yml` already builds on `windows-latest` and `windows-11-arm`
  with `rustup target add` and `cargo build`,
  so those runners provide rustup and Cargo;
  Git on their `PATH` was not checked here.
- The command of step 7 in `Repeating the Windows run`,
  from `package/cli/forbidden-strings`,
  with no secret and no repository write permission.
  The shipped-corpus conformance tests dominate its time:
  the library target took 248 seconds on 4 virtual CPUs in the debug profile.
- A decision on the target.
  This run used `x86_64-pc-windows-gnu`,
  which needs a complete MinGW-w64 on `PATH`.
  The published binaries are `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc`,
  which no run has tested;
  a hosted job would test the MSVC target directly.
- A way to keep the positive control.
  A job that only passes cannot show it would fail;
  a second job step that plants the `prefix_parts` control and requires failure is one option,
  and a scheduled Windows mutation run of the pathname scope is another.
- On Linux runners,
  `lint:clippy:windows` as a cheap earlier gate for Windows compile errors.

### Teardown

- `mvm --verbose --backend libvirt destroy wbase-20261005` through the shims exited `0`.
  It ran `virsh destroy` and `virsh undefine --remove-all-storage`,
  which removed the overlay disk,
  and removed `~/.local/share/mvm/vms/wbase-20261005`.
  `virsh list --all` afterwards lists only the six domains that existed before the run.
- The file server was stopped by process ID;
  nothing listens on port 18432.
  Its log shows 13 requests,
  all from host loopback:
  the two snapshot archives,
  the variant,
  probe,
  and restore files,
  and two refused requests made from the host to test the server.
- The session `virtqemud` was stopped by process ID.
  Libvirt had spawned `virtlogd` and `virtstoraged` in the same Flatpak sandbox,
  each with a 120-second idle timeout;
  both were stopped too,
  and no virt-manager Flatpak instance remains.
- `template-windows.qcow2` has the SHA-256 and modification time it had before the run.

### Evidence of the Windows baseline follow-up

Evidence is `package/cli/forbidden-strings/target/verification/windows-baseline-phA1vT`.

- `manifest.json` lists the 128 files of snapshot `s2` with their hashes,
  each variant's hash,
  the earlier snapshot `s1`,
  the target,
  toolchain,
  VM bounds,
  bridges,
  exact commands,
  skipped tests,
  and teardown facts.
- `control.json` holds the expected observations beside each campaign's exit code,
  per-target counts,
  and failing tests.
- `logs/` holds the complete guest output of every provisioning step,
  campaign,
  probe,
  and control,
  the file server's request log,
  and the stale guest-agent record.
- `reports/s2-line36` and `reports/s2-full` hold the unpacked `cargo-mutants` reports from the guest,
  each archive checked against the hash the guest printed.
- The `.diff` files are the hand-applied variants.
- The scratch drivers are `prepare.mjs`,
  `serve.mjs`,
  `agent.mjs`,
  `drive.mjs`,
  `sequence.mjs`,
  `collect.mjs`,
  `resume-mutants.mjs`,
  `extract-report.mjs`,
  and `retain.mjs`.

`verify:evidence` reports one difference for this directory,
`clippy.toml`,
which was not sent because Clippy did not run in the guest,
and none for `test-g2VM7D`,
`clippy-wuZQ0I`,
and `pathname-mutation-N02NWa`.
It reports two for `pathname-mutation-xxqPFq` and `test-kA3nVK`,
the two test files `fe805727c` changed after those runs.
Only compiled inputs were sent to the guest,
the same file set as in `Evidence and provenance`;
no home-directory content or credential was served.

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
- `ea62f2558`: `tests/integration.rs` compiles for Windows,
  with a sharing-violation read-error test there.
- `16b52146e`: rustdoc on the eight undocumented imports.
- `3b85b4269`: the pathname-only mutation scope and its task.
- `fe805727c`: platform-correct cache-root,
  artifact-layout,
  and repository-relative name tests.
- `11f20de74`: the `lint:clippy:windows` task.
- `c5d3d04ea`: README entries for the pathname mutation scope and the `lint:clippy:windows` task.
- `e3cdee512`,
  `f7362e0d7`,
  and later `docs(handover)` commits:
  this document's `Windows baseline follow-up`.

Both READMEs and this evidence document are rendered through the installed CommonMark HTML-tree pipeline.
Trees and readable rendered text remain in `target/verification/docs`.
That check exposed and corrected README bold spans split across line endings.

The main agent should inspect the terminal results,
retained mutant classifications,
source inventories,
and the open findings in `Windows-native follow-up` before any production cutover.
No human response is needed to continue this scoped queue.
