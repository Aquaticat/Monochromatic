# Native scanner embedding verification

## Purpose and scope

Complete the delegated Linux verification of the in-process scanner authorized with the Rust cli-git rewrite.
Changes are confined to `package/cli/forbidden-strings/`,
its fuzz sidecar,
and this document.
The linter and wrapper remain the main agent's work.
No installed production tool was published or replaced.

The scoped Linux queue is complete.
The full mutation campaign remains non-green because native Windows prefix detection is not exercised on Linux.
Those survivors are retained,
not excluded.

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
Both survivors remain in the owning task and retained reports.
A Windows-native run is needed to close this limitation.

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

Both READMEs and this evidence document are rendered through the installed CommonMark HTML-tree pipeline.
Trees and readable rendered text remain in `target/verification/docs`.
That check exposed and corrected README bold spans split across line endings.

The main agent should inspect the terminal results,
retained mutant classifications,
source inventories,
and Windows-native limitation before any production cutover.
No human response is needed to continue this scoped queue.
