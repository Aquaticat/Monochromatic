# Native scanner embedding verification

## Purpose and scope

Finish verification of the in-process scanner authorized with the Rust cli-git rewrite.
Changes are confined to `package/cli/forbidden-strings/`,
its fuzz sidecar,
and this evidence document.
The linter and wrapper remain the main agent's work.
No installed production tool is published or replaced.

## Requirements and verification boundaries

- Preserve exact caller-owned bytes,
  native logical paths,
  opaque candidate identity,
  typed findings,
  and structured cache warnings.
- Preserve ordinary standalone output and exit codes.
- Prove load failures never return a partial scanner.
- Separate payload suppression from unwind control flow.
  Libraries do not silently replace their host's panic hook.
- Run container,
  mutation,
  and fuzz verification with source provenance and retained failure evidence.
  Surviving policy branches are not excluded to manufacture a pass.

## Evidence already established

The inherited `proc_84b0` log at `/tmp/pi-processes-NE5h3a/proc_84b0-combined.log`
records the latest delegated load-request implementation passing:
145 library tests,
2 binary-boundary tests,
2 embedding consumer tests,
40 binary integration tests,
and 8 pathname integration tests.
This is prior-snapshot evidence,
not proof of later edits.

The added bounded Clippy gate initially failed because the fixed Git fixture lacked `cargo-clippy`.
The runner now bakes the installed nightly toolchain into the image,
without host mounts.
Clippy then reported seven `clippy::shadow_reuse`/`clippy::shadow_unrelated` findings.
Binding names were corrected without suppressions or policy changes in commit `d98920b10`.

`proc_dff9` passed the all-target,
all-feature,
warnings-denied gate on its copied snapshot.
Evidence lives in `package/cli/forbidden-strings/target/verification/clippy-ANwTiA`.
Later test and runner changes still require snapshot reconciliation.

## Implementation and controls

- `182853529` adds nested-request success,
  exact occupied-state restoration,
  partial-construction panic recovery,
  empty/short snapshots,
  NUL positions at the binary probe boundary,
  cutoff-crossing matches,
  and matcher reuse after an actual malformed-offset bounds unwind.
- `bdca1a82d` adds `fuzz_embedding`,
  a cache-free production hybrid construction path,
  native byte inputs,
  an independent literal/regex byte oracle,
  and committed binary-boundary seeds.
- `2532c59cf` adds disposable public-loader and real-executable fault fixtures.
  The protected fixture must pass;
  removing the output hook,
  process catch,
  or load catch must fail its previously passing test.
  Fault triggers exist only in copied source,
  never production environment configuration.
- Container runners retain exact copied-source hashes,
  immutable image IDs,
  commands,
  tool metadata,
  resource limits,
  and exit evidence.
  Transcript retention was strengthened after independent review.
  Report-copy failures now retain their disposable containers for recovery.

All runs use the fixed Git 2.56.0 base image
`6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`.
Runtime limits are 2 GiB,
2 CPUs,
128 PIDs,
no network,
no host mounts,
and user `1000:1000`.
Builds have the same memory/CPU bounds.

## Matcher-state inspection

`src/runtime_matcher.rs::line_matches` owns its hit vector per call.
`package/rust-module/forbidden-regex/src/regex/batch.rs::line_matches`
owns candidate and hit vectors per call,
and `resolve_matches` owns fresh `CheckedFull` scratch.
The engine's separate process-wide `CORE_COUNT: OnceLock<usize>` is in `parallel.rs`;
its compilation scheduling role is distinct from scan hits/scratch.
This evidence is stronger than inferring immutability from `&self`.
The malformed-offset test establishes recovery from its injected bounds fault,
not from every possible future engine defect.
The audit also followed `Engine::matches` into its backends:
`dfa/table.rs:236` keeps DFA state local;
`counting/run.rs:50` creates current/next `State` buffers per call;
`counting/product.rs:298` creates its thread vector per call.
`regex/batch.rs:521` and `regex/batch.rs:522` allocate the hit vector and `CheckedFull` scratch locally.
The global CPU cache is at `parallel.rs:160`,
not in these matching paths.
All engine paths in this paragraph are under `package/rust-module/forbidden-regex/src/`.

## Independent review and remaining work

Advisor identified and the work addressed:
content-only fuzz filtering that could hide an `EngineError`,
missing arbitrary pathname finding expectations,
shared-tag image provenance races,
and failure-path evidence loss.
The revised fuzzer compares every finding variant,
uses a native pathname byte oracle,
and includes explicit safe-display controls.

The initial mutation campaign (`mutation-D4eD13`) completed with 134 mutants:
91 caught,
23 missed,
18 unviable,
and 2 timeouts.
All reports and per-mutant logs were copied.
Its feature-gated code ran without the feature enabled,
so the next campaign enables all features.
Pure Windows separator/prefix-counting helpers and supplied-prefix scan controls now execute those policy branches on Linux.
A direct source-revalidation test covers changed and missing authoritative text.
None of the missed branches was excluded.

The initial ASan campaign (`embedding-fuzz-P0HOh1`) completed 332,829 runs in 121 seconds.
It predates the all-variant oracle strengthening and is not final evidence for that strengthened target.

The first disposable guard fixture passed public partial-load recovery,
but its standalone help assertion expected `Usage:` instead of the scanner's actual `USAGE:`.
The fixture assertion was corrected from the existing binary contract tests.
This was a test expectation error,
not a production scanner failure.

The release consumer suite passed on snapshot `6abe8fdc5f431d1c5da0845f64535a3a322e4012e876fea52cd86edd1ed22419`:
158 library tests,
2 binary-boundary tests,
2 embedding tests,
2 public cache-warning tests,
40 CLI integration tests,
and 8 pathname tests.
Evidence is `package/cli/forbidden-strings/target/verification/release-test-TsLNHP`,
image `sha256:32bb9011eca6c543a4ce84ff6c8d6f63c1d96a54df2afc80afdde475393d8b55`.
`cargo test --release --offline --locked --all-targets --all-features` used the actual release profile.
Later differences are a test loop binding rename correcting `clippy::shadow_reuse`
and registration of process-isolated startup-filter tests.
The runtime scanner implementation is unchanged from this release snapshot.

`verify:markdown` rendered all changed Markdown through the installed CommonMark HTML-tree pipeline.
It exposed pre-existing README emphasis delimiters split across line endings;
those spans now render correctly.
Rendered trees and readable text are retained in `target/verification/docs`.

The strengthened ASan target passed 256,297 runs in 121 seconds,
with 1176 coverage edges,
6514 feature signals,
and a retained 840-input corpus.
Evidence is `package/cli/forbidden-strings.fuzz/target/verification/embedding-fuzz-E8GGvr`.
Snapshot digest is `7d6c74c860a4fbb425578ebb7a729f750333729fd5aa65dd70b2e5f594255eeb`;
image is `sha256:58c7fc36223bc580b21abff353a7eab74bfea77cb9699a23d445c3ac9730fb4f`.
Both corpus and artifact retrieval completed successfully.
This fuzzer compiles the final production scanner and strengthened oracle;
the inventory's later warning-test binding rename is not compiled by this target.

The all-target/all-feature Clippy gate passed with warnings denied
and zero compiled-input differences before the later startup-filter test registration.
A final recheck includes that test module.
Evidence is `package/cli/forbidden-strings/target/verification/clippy-NGxzJY`.

## Mutation outcomes and survivor dispositions

The all-feature embedding campaign used `cargo-mutants 27.1.0`
and snapshot `6abe8fdc5f431d1c5da0845f64535a3a322e4012e876fea52cd86edd1ed22419`.
Image was `sha256:7ec6245d9f53cabf833643bc5b4ff4e38ab6654adc5edee4a407c290cd5489b2`.
The complete report is
`package/cli/forbidden-strings/target/verification/mutation-fJH1Io/mutants.out`.
Its 147 mutants produced 122 caught,
3 missed,
22 unviable,
and no timeouts.
The unmutated baseline passed.
`cargo-mutants` exited `2` because mutants survived;
the owning task retained its report and failed rather than labeling this a green campaign.

### Surviving branches

- `src/main.rs:40`:
  replacing `logging_filter` with `Default::default()` survived.
  New process-isolated tests exercise missing,
  invalid,
  and configured `RUST_LOG` directives.
  A scoped startup mutation follow-up is running with the full all-feature baseline.
- `src/path_name_bytes.rs:36`:
  replacing `prefix_parts` with `0` survived on Linux.
  The native Windows parser branch is not reached on this host.
  Host-independent prefix counting and component-skip policy are tested,
  but native Windows `Component::Prefix` detection remains unverified here.
- `src/path_name_bytes.rs:36`:
  deleting the platform guard's `!` survived on Linux.
  Linux's native path parser then finds no Windows prefix and still returns `0`.
  This is equivalent on the tested target,
  not evidence of equivalence on Windows.

Neither Windows survivor is excluded from the owning mutation task.
A Windows-native run is required to close that platform limitation.

### Unviable mutants

The retained logs identify `rustc` failures,
not test passes.
Twenty generated replacements require `Default` implementations the affected domain types do not have (`E0277`):

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
`expected Once<&mut _> to be an iterator that yields &ScanSet, but it yields &mut _`.
The `logical_path` operator replacement produces:
`|| operators are not supported in let chain conditions`.
Exact generated code,
compiler output,
and classification remain in `unviable.txt`,
`outcomes.json`,
and per-mutant `log/` and `diff/` files.

### Historical timeout evidence

The first campaign's timeouts are retained in `mutation-D4eD13/mutants.out`:
`prefix_parts` mutations at `src/path_name_bytes.rs:36:35` and `src/path_name_bytes.rs:38:19`.
Their logs stopped during builtin-name loading or binary integration testing.
No cause is proven from those stopped test lines.
They did not recur in the all-feature campaign;
that later result does not establish a root cause or a timeout fix.

## Export-to-evidence map

- `Scanner::load`:
  `tests/embedding.rs` covers runtime/cache-hit loads,
  explicit missing files with and without builtins,
  implicit missing files with builtins,
  invalid runtime rules,
  and non-UTF-8 Unix rule-file paths through cache publication/reload.
  Disposable `panic_contract.rs` covers a panic after constructing runtime rules,
  rejection of the partial scanner,
  host-hook preservation,
  and later same-thread loading.
- `Scanner::scan` and `CandidateScan`:
  `scanner_tests.rs` and `scanner_boundary_tests.rs` cover identity,
  immutable snapshots,
  colliding redacted labels,
  native bytes,
  binary-prefix edges,
  and explicit pathname failures.
  `path_scan_tests.rs` and `path_name_bytes_tests.rs` execute supplied Windows prefix policy on Linux.
  The strengthened `fuzz_embedding` predicts every fixed-rule content/name finding independently.
- `ScanFinding` rendering:
  `frx_scan_tests.rs`,
  `path_scan_tests.rs`,
  and binary integration tests preserve ordinary line/name/error output.
  Disposable public-scan controls inject faults after actual matcher work,
  require explicit `EngineError` findings rather than partial hits,
  then compare later scans with their pre-fault result.
- `Scanner::cache_warnings` and `CacheWarning`:
  public consumer tests exercise missing artifacts,
  hits,
  corrupted-artifact repair,
  unreadable cache roots,
  write failures,
  unavailable roots,
  and invalid relative configuration.
  `warning_tests.rs` verifies every closed reason/recovery token and exact JSON rendering.
  `verification_tests.rs` exercises changed/missing source revalidation and both fuzz-codec verdicts.
- Feature-gated construction:
  all-feature release tests execute accepted/rejected `load_from_text`
  and `scanner_from_text_for_fuzzing` calls.
  The ASan target exercises the production hybrid matcher rather than the old regex-only in-memory loader.
- Standalone process boundary:
  binary integration tests check ordinary stdout/stderr and real exit codes.
  Disposable startup/worker fault controls check actual executable exit `2`,
  empty stdout,
  and exact redacted stderr.
  Independent output-hook and catch removal controls must fail after rebuilding.

## Terminal work queue

Current work queue:

- Finish the startup mutation follow-up and guarded/disabled consumer fixtures,
  then archive their terminal outcomes.
- Preserve both completed full mutation campaigns,
  including every survivor,
  timeout,
  and unviable mutant.
- Retain the completed feature-gated construction and public warning evidence in the final branch map.
- Execute protected/disabled real-executable and public-loader panic fixtures.
- Reconcile final source inventories with tests,
  Clippy,
  mutation,
  and fuzz campaigns.
- Replace progress wording with terminal campaign outcomes and rerender updated evidence.

## Limitations and rejected conclusions

The embedding fuzzer is Unix-only.
Windows native volume-prefix branches are not executed by a Linux container.
The initial mutation log already records surviving Windows-only branches and timeouts;
these are retained evidence,
not a pass.

The cache-free fuzz constructor does not exercise actual cache warnings.
Public consumer tests and closed-token warning tests must provide that coverage.

A dependency's release profile cannot force an embedding workspace to use `panic=unwind`.
The effective host panic strategy and its process-owned output hook remain consumer obligations.

A recorded repository `HEAD` is context only:
concurrent commits can differ from the copied source.
The per-file source inventory and immutable image ID are the tested snapshot authority.

## Next action

Complete the active campaigns and public-cache/feature controls,
then replace this progress section with exact final outcomes and remaining platform limitations.
The main agent should inspect the results and manifests,
not infer completion from this document's existence.
