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

Current work queue:

- Finish container tests and inspect exact results.
- Finish the mutation campaign and classify every survivor,
  timeout,
  and unviable mutant.
  Its initial snapshot predates the fuzz-construction changes.
- Execute feature-gated construction success and failure tests.
- Verify exported cache-warning propagation through isolated public consumers.
- Execute protected/disabled real-executable and public-loader panic fixtures.
- Reconcile final source inventories with tests,
  Clippy,
  mutation,
  and fuzz campaigns.
- Update scanner and sidecar READMEs,
  then render-check all changed Markdown.

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
