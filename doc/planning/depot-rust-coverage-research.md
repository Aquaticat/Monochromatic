# Depot frozen Rust coverage research

## Research boundary

The coordinator transferred this area after the completed
[reuse campaign](depot-reuse-strategy-research.md).
The source remains `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Main-worktree changes are documentation and evidence only;
executable harnesses use the retained,
solely owned `research/depot-reuse-20261018` worktree.

The cumulative conservative compute proxy begins at USD 1.407,
leaving USD 3.593 beneath the USD 5 ceiling.
At most two owned cloud jobs may run simultaneously.
Each new bounded profile must retain its declared resources,
published-rate reservation,
source/tool hashes and actual provider identifiers before results are compared.
The initial current-source linter profile is admitted at USD 0.36,
bringing the conservative forecast to USD 1.767.
The first run is `j50kf2jlqx`,
from harness `21883c2409b5bb9a7556f869a37cfd43b6045f12`.

## Source catalog checkpoint

An uncapped `rg --files --hidden --no-ignore --glob Cargo.toml package`
returns 23 manifests in the isolated frozen checkout.
The tracked immutable tree contains the same manifest paths and no root `Cargo.toml`.
Those are source inventory facts,
not passing test or build credit.

The first metadata pass stopped when Python 3.14's `tomllib` rejected
`package/desktop-app/ide/Cargo.toml:68` with
`Invalid initial character for a key part (at line 68, column 105)`.
That line uses an inline-table trailing comma.
The repository already documents this
[TOML version boundary](../troubleshooting/taplo-toml-1-1-inline-table-trailing-comma.md).
The inventory must use Cargo's actual parser before classifying that source as invalid.
The installed `cargo read-manifest --help` exposes a frozen,
offline manifest-reader invocation and marks it deprecated in favor of metadata.
Any use here is an inventory probe,
not a proposed production tooling replacement.

Cargo 1.98.1 accepts all four manifests rejected by Python 3.14.8's TOML parser.
The complete [source catalog](../audit/depot-rust-coverage-2026-10-18.catalog.json.gz)
retains raw manifests,
owning Mise tasks,
lock identities and tracked source hashes.
Cargo-normalized absolute paths are paired with resolved repository-relative dependencies.
An empty or self-member `[workspace]` still describes a standalone crate;
it does not establish membership in a missing root workspace.

The manifest inventory contains five fuzz sidecars,
two benchmark sidecars and sixteen other packages.
The declared `fuzz_targets/` binaries total 35:
five scanner,
five regex,
four JSONC,
fifteen Git-policy and six linter targets.
Actual `cargo fuzz list` and executed target receipts remain separate runtime gates.
Committed seed files total 46 for scanner,
65 for Git-policy,
10 for linter and three for JSONC.
No tracked regex seed files exist at this source.
The first inventory matcher omitted singular `seed/` directories;
that scope error was corrected before assigning seed counts or execution credit.

### Manifest execution boundaries

The catalog records each manifest,
source closure,
lockfile,
path dependency and actual owning Mise configuration.
Its execution classifications are:

- `package/cli/forbidden-strings`:
  the same frozen source passed its complete 237-case release Nextest owner
  in producer `v7njncr47d` and fresh reader `zq7cc1nd4b`.
  The [reuse evidence](../audit/depot-reuse-strategy-2026-10-18.evidence.json)
  retains its source/tool admission and independent mutation control.
- `package/git-policy/cli`:
  the same frozen source executed 1,951 cases with 1,949 passed and two failed,
  plus five skipped out of 1,956 enumerated in `n2zlbh5gpb`.
  Its Git 2.56 and published-linter prerequisites,
  filesystem controls and later selected 34-case archive replays remain separate boundaries.
  It does not have a passing full-suite result.
- `package/linter/monochromatic-lint`,
  `package/rust-module/jsonc-edit`,
  `package/rust-module/forbidden-regex`,
  `package/cli/wg-quicker-exempt` and `package/codex-plugin/bash-limit`:
  this campaign retains their actual Nextest results.
  Privileged BPF cases and the installed Codex host are separately gated.
- `package/cli/forbidden-strings.fuzz`,
  `package/git-policy/cli.fuzz`,
  `package/linter/monochromatic-lint.fuzz`,
  `package/rust-module/forbidden-regex.fuzz` and `package/rust-module/jsonc-edit.fuzz`:
  their GNU/AddressSanitizer,
  generator,
  seed and planted-control boundaries are the active queue.
  Listing targets does not count as executing them.
- `package/music-player/truepeak-core`:
  the [BuildKit campaign](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json)
  retains exact-source AMD64 release library production and offline registry/target-cache controls.
  That producer uses Rust/Cargo `1.97.1` with `--no-default-features`,
  whereas the owning `test` task requires release Nextest with `--all-features`.
  No unit-test,
  `service` or `fingerprint` credit transfers from that producer.
- `package/music-player/android-app/rust`:
  [Android producer receipts](depot-complete-coverage-android-junit-execution.json.gz)
  retain JNI/ELF/APK production at the frozen source.
  Its 1,289 JVM cases and
  [headful device consumer](../audit/depot-android-consumer-2026-10-18.evidence.json)
  are consumer boundaries,
  not standalone Rust unit-test counts.
- `package/cli/nested-wayland-session`,
  `package/desktop-app/file-manager`,
  `package/desktop-app/file-manager-gtk-sticky`,
  `package/desktop-app/file-manager-qt`,
  `package/desktop-app/ide`,
  `package/desktop-app/terminal` and `package/music-player/desktop-app`:
  the catalog retains their actual desktop owners and dependency graphs.
  They involve Smithay/Wayland,
  GTK,
  Qt,
  Slint,
  Ghostty or platform audio dependencies respectively.
  Source-specific desktop orchestration belongs to the separate native/routing investigation.
  Historical desktop tests do not enter this campaign's current-source denominator.
- `package/music-player/truepeak-core.bench` and `package/rust-module/forbidden-regex.bench`:
  these are benchmark sidecars with independent build/run owners.
  No benchmark or parent-package test pass transfers merely from their manifest presence.

The [historical feature audit](../audit/depot-test-feature-2026-10-16.md),
[prepared desktop record](../audit/depot-prepared-desktop-2026-10-16.md)
and [expanded execution record](../audit/depot-expanded-execution-2026-10-16.md)
remain historical evidence until their source,
dependency and tool identities match the requested boundary.

## Initial current-source linter profile

The isolated workflow is `.depot/workflows/rust-coverage-linter.yml`,
with an 8 CPU,
32 GB allocation,
15-minute job limit and 12-minute application-step limit.
The reservation uses USD 0.00005 per CPU-second:
`8 * 900 * 0.00005 = USD 0.36`.
This is a timestamp-compute research guard,
not an account bill.

The prepared native image is `research-reuse-20261018:tools-r2-git256`,
bound to `sha256:fb197837831d438592d9455b3a31d808a20ad8bdc2ae76b05d8b36f6656419cd`.
The profile installs no replacement application binary.
It prepares the source linter's locked dependencies,
then executes `cargo nextest run --locked --offline --all-targets --no-fail-fast`.
The owning Mise configuration's compiler fan-out remains two.
Development debug symbols and incremental compilation are disabled,
matching the existing tested container preparation settings;
Nextest retains default test concurrency.

The produced current-source CLI must answer its real help and rule-list commands.
The profile also builds the library artifact,
compiles the existing `src/processors_consumer.rs` against it,
and runs that consumer.
JUnit includes skipped cases and failure output.
Application source,
locks and owner configuration are checked against the frozen tree before and after execution.
Failures remain failures while receipts upload independently.
The source linter's Cargo lock contains 294 packages and pins the rust-analyzer family to `0.0.336`.
That compilation and its own tests are distinct from using the published `0.1.3` prerequisite.

## Standalone and native prerequisite profile

The next isolated workflow is `.depot/workflows/rust-coverage-core.yml`,
with 4 CPU,
16 GB,
a 15-minute job limit and a 12-minute application-step limit.
Its USD 0.18 reservation brings the still-conservative forecast,
including the full initial linter reservation,
to USD 1.947.
The reviewed owner boundaries are release Nextest for `forbidden-regex`,
`jsonc-edit` and `codex-plugin/bash-limit`,
plus ordinary debug unit tests for `wg-quicker-exempt` adapted from Cargo test to Nextest.
Build and test concurrency retain their defaults.
Privileged ignored BPF cases and the installed Codex host case remain explicit separate prerequisites.

The profile also builds the frozen `wg-quicker-exempt` release executable,
checks its actual usage and invalid-zero-mark boundary,
and retains the ELF with source and tool hashes.
That artifact is the missing producer for the routing investigation's
`finds repository sibling release outside secure path` consumer.
Release-file presence by itself is not counted as that consumer passing.

## Completed consumers and retained failures

The [evidence ledger](../audit/depot-rust-coverage-2026-10-18.evidence.json)
binds provider run metadata,
command logs,
source hashes,
JUnit and artifact member hashes.
Both downloaded artifact ZIPs match the provider-reported upload SHA-256 and pass CRC validation.
The [compressed receipts](../audit/depot-rust-coverage-2026-10-18.receipts.json.gz)
retain full command logs and JUnit rather than converting the owning task into a fictional inner test.

Run `j50kf2jlqx` compiled the current linter and passed 415 Nextest cases,
with zero failures,
one skipped case and 416 enumerated cases.
The produced CLI passed actual help and rule-list assertions.
Its SHA-256 is `e698c16275e71a142cd95538c59c0543ab94a6ce3a382727c889e0dbe58da88d`.
The job remains failed because the separate existing library consumer's direct Rust invocation reported:

```text
// existing-processor-consumer-build.log
error: only metadata stub found for `rlib` dependency `monochromatic_lint`
please provide path to the corresponding .rmeta file with full metadata
```

The application tests passed;
the standalone consumer did not run.
The source was unchanged before and after execution.
Rust `1.101.0-nightly`,
commit `5d8fec0669a64607db9ccbf663e7c23125bf4748`,
contains an explicit compiler control passing both the link archive and its matching full metadata.
The next harness-only recovery will test that exact calling convention.
The first run retains an executable hash,
not a downloadable executable handoff.

Run `lwp0vbb2vq` completed successfully from harness `3a7e85d395cb67a5d189224963782c9b45527c71`:

- `wg-quicker-exempt`:
  15 cases run and passed,
  zero failed,
  11 skipped and 26 enumerated.
- `jsonc-edit`:
  81 cases run and passed,
  zero failed or skipped and 81 enumerated.
- `forbidden-regex`:
  235 cases run and passed,
  zero failed,
  one skipped and 236 enumerated.
- `codex-plugin/bash-limit`:
  five cases run and passed,
  zero failed,
  one skipped and six enumerated.

The native release producer also passed its usage and zero-mark controls.
Artifact `01a14e69-58c8-7104-88fd-fea5620fbe2f` retains the 473,368-byte executable,
SHA-256 `02053fc5338835abb4d6a7812a3b71244a2190512724040219cdd68595dee921`,
with its source and tool manifest.
The routing consumer has received this concrete handoff;
its result belongs to that separate investigation.

The completed requested-to-provider-finish proxies add USD 0.0536 and USD 0.0314 respectively.
The cumulative owned compute proxy is USD 1.492,
leaving USD 3.508 beneath the research guard.
This calculation rounds each observed interval upward to whole seconds and includes startup,
checkout and artifact upload;
it is not an invoice or measured CPU utilization.

## Next admitted preparation and recovery

The next profile reserves another USD 0.36 at 8 CPU,
32 GB and 15 minutes,
bringing the conservative forecast to USD 1.852.
It will verify lock-bound `cargo-fuzz 0.13.2`,
prepare the official `codex-cli 0.163.0` release for the separate deterministic host fixture,
repeat the real source-linter tests and existing library consumer with full metadata,
and retain the actual tested CLI bytes.
It will then seal a distinct native tool snapshot,
excluding the source checkout and synthetic secret fixture before capture.
The image is preparation evidence,
not an ordinary OCI container image or proof of general credential exclusion.

The Codex release's GitHub tag is not immutable.
The official compressed asset and signature bundle are therefore bound by their fetched SHA-256 values;
source and signature provenance remain explicit gates before any host-fixture execution.
Version and help inspection do not constitute a model turn.
The installed-host case must use its owned home,
local deterministic response provider and recursion guard.
Actual ASan/GNU fuzz targets,
existing planted controls and seed immutability remain in the owned queue.

## Owned work queue

### Recovered ordinary consumer

Run `zxlt43t7g1`,
from harness `ee873be6f753c611b15cbfd0e925d0048a631dbb`,
finished successfully.
The unchanged `processors_consumer.rs` compiled against Cargo-discovered archive and matching full metadata,
then printed `processor artifact consumer passed`.
The fresh sandbox verified the prepared cargo-fuzz and Codex bytes,
registry manifest digest,
synthetic source/secret exclusion markers,
and unchanged source before and after execution.
This gives `tools-r3-fuzz-codex` ordinary-consumer evidence;
it does not represent a Codex model turn or fuzz execution.

Artifact `01a14e95-7e1f-70e2-a82d-b8ea65ea6fd7` passed its upload SHA-256 and ZIP CRC checks.
The recovery retains the preceding failed runs separately.
Its 197-second requested-to-finish upper bound adds USD 0.0394,
bringing the cumulative compute proxy to USD 1.6564,
with USD 3.3436 remaining.

The next profiles reserve USD 0.36 each:
bounded GNU/AddressSanitizer fuzz execution and the deterministic installed Codex host fixture,
each limited to 8 CPU,
32 GB and 15 minutes.
Their combined conservative forecast is USD 2.3764.
Runtime fuzz processes remain mount-free,
network-disabled containers with 2 CPU,
2 GiB memory and 128 tasks.
Committed corpora remain source inputs;
only owned copies receive generated units and crash artifacts.

### First bounded fuzz and host attempts

`bl31brxwpm` passed the official Rust AddressSanitizer stack-overflow positive control
inside the bounded mount-free runtime.
It then stopped before application compilation:
the harness had merged Mise's `WARN missing:` stderr into `cargo fuzz list` stdout
and rejected the warning as an unexpected target.
That is a research admission failure,
not a failed fuzz target.
Harness `43977f1cca` preserves each stream independently and parses only target stdout.

`c4p5g7lx48` exercised the existing ignored Codex host case with the signature-admitted `0.163.0` executable.
Its local deterministic provider accepted all expected payload responses,
and the host reported 40 completed hooks.
The actual Nextest case nevertheless failed at `tests/native_host.rs:142`,
the final membership-file PID assertion.
No full installed-host pass is claimed.
The next diagnostic consumer retains the unchanged fixture's wire messages and synthetic home;
it does not change application source or substitute an external model.

The two failed jobs add USD 0.05 and USD 0.0182 respectively.
The cumulative proxy is USD 1.7246,
leaving USD 3.2754.
The corrected fuzz retry reserves USD 0.36,
and the host diagnostic reserves USD 0.18,
for a combined forecast of USD 2.2646.
Separate Git-policy fuzz,
linter fuzz and their existing planted controls remain required work.

The tool-preparation run `jf0c9llb1v` finished with the same 415 passing Nextest cases,
1 skipped and 416 enumerated,
and retained a real executable transport artifact.
Its separate consumer recovery stopped at the harness's fixed `debug/deps` directory lookup,
before compilation.
The [compiler metadata trace](../troubleshooting/rustc-full-metadata-artifact-consumer.md)
keeps that failure distinct from the archive-only compiler diagnostic.
Tool preparation and source/synthetic-secret sealing passed;
the resulting native snapshot is `tools-r3-fuzz-codex`,
manifest `sha256:1c2b469a9d7fae8bc364e6392f771c28565647a04c40847f345bc140dfce4e88`.
Its fresh ordinary consumer remains a separate required check.

The completed run adds a conservative USD 0.1148 timestamp proxy,
bringing the cumulative proxy to USD 1.6068.
The next ordinary library consumer reserves USD 0.18 at 4 CPU,
16 GB and 15 minutes,
for a forecast of USD 1.7868.
It will discover the actual archive,
full metadata and dependency directories from Cargo's compiler-artifact JSON,
execute the unchanged public processor consumer,
and verify prepared tool identities plus the image's synthetic exclusion controls.
This focused profile does not rerun the already measured 415-case linter suite.

The exact core `wg-quicker-exempt` ELF was consumed in routing run `39118628603`:
routing reports 44 passing owning invocations,
including the actual default tests.
The one-object signed URL was retained only in an owned mode-0600 file,
then removed after consumption.
Routing verified exact temporary Actions-secret deletion with HTTP 404.
Its per-case assertion and artifact bindings belong to the separate routing evidence.

- Classify every standalone manifest,
  its actual Mise owners,
  source/dependency/toolchain hashes,
  targets and runtime prerequisites.
- Match prior exact-source evidence by its input hashes and command boundary before assigning carryover credit.
- Build and consume the current rust-analyzer-backed `monochromatic-lint` source,
  including its actual Nextest and executable consumers.
  The published `0.1.3` tool in the preceding campaign was a prerequisite,
  not current-source linter coverage.
- Exercise applicable active standalone crate owners through Nextest,
  retaining real failures,
  ignored cases and compilation prerequisites separately.
- Exercise `cli/forbidden-strings.fuzz`,
  `git-policy/cli.fuzz`,
  `linter/monochromatic-lint.fuzz`,
  `rust-module/forbidden-regex.fuzz` and `rust-module/jsonc-edit.fuzz`.
  Inspect the actual owning tasks and target bodies first;
  preserve the GNU target,
  AddressSanitizer,
  planted controls and explicit runtime limits.
- Hash committed seed corpora before and after;
  direct generated seeds,
  mutations and crash artifacts only into owned writable state.
- Reconcile raw command,
  source,
  artifact and cleanup receipts;
  lint and render the resulting documents before closing the campaign.

The separate platform investigation's `depot cargo` command configures local Cargo with sccache.
It does not introduce another remote compiler pool.
Its [wrapper source audit](../troubleshooting/depot-cargo-cache-wrapper.md)
also records authentication precedence and removal of inherited `SCCACHE_*` tuning.
Any use must preserve this campaign's isolated cache namespace and job-scoped credential boundary.

### Retained installed-host diagnostic

Diagnostic `xdv4v475fq` at harness `ecacdf9e31810fa5961f3fe4351141a7dbf9f8c1`
retains the unchanged failing installed-host Nextest case,
40 synchronous hook completions and an empty synthetic membership file.
The transparent protocol tee records no `commandExecution` items.
The retained Codex SQLite log records 30 filesystem sandbox `policy_denied` events before its final flush.
Codex also reports its missing external `bubblewrap` and bundled fallback.
These observations do not yet identify the shell launch failure.

`tests/host_support/server.rs` checks whether each raw provider request contains `host-payload-executed`.
That check can match the preceding function-call arguments,
so it does not establish successful tool output.
The next diagnostic captures the same localhost provider traffic without modifying frozen application or test source.
The host used an unauthenticated local Responses fixture;
no paid provider request was admitted.
Its fresh home also fetched the default public plugin catalog and received an unauthenticated featured-catalog 401.
The artifact retains that background behavior,
while durable raw receipts omit downloaded plugin payloads and retain their individual hashes.

Completed conservative compute proxy is USD 1.7458 of the USD 5 ceiling.
The only active reservations are `jwg2cmvwd1` (small fuzz retry) and `8rh0797pqx` (Git-policy fuzz),
each bounded to 8 CPUs,
32 GB and 15 minutes with a USD 0.36 reservation.
The reservation-inclusive bound is USD 2.4658.
Truepeak all-features,
the remaining fuzz/planted owners,
transparent host capture,
benchmark repetitions and privileged WG prerequisite probes remain the explicitly tracked queue.

### Bounded fuzz checkpoint and sandbox prerequisite

`jwg2cmvwd1` completed all four JSONC and five regex fuzz targets,
plus four scanner targets before the 12-minute step limit terminated `fuzz_scan_format`.
The completed targets report nonzero libFuzzer executed-unit counts,
clean exit status and final statistics.
The ASan stack-overflow positive control failed as expected inside the same resource isolation.
JSONC generator Nextest passed 13 cases;
scanner generator Nextest passed six.
The regex sidecar enumerates zero generator tests and earns no such credit.

`8rh0797pqx` passed 38 generator cases and completed 14 Git-policy fuzz targets.
Its last target,
`wrapper_controls`,
was also interrupted by the 12-minute step limit.
Neither interrupted run reaches the final source admission or complete runtime cleanup.
Their initial frozen-source hashes,
completed per-target container state,
corpus copies,
raw logs and provider-verified ZIP digests remain durable.
The owned sandbox terminates after each job.
The targeted `fuzz-tails` profile replays only these interrupted targets and retains final source admission.

The [Codex sandbox prerequisite diagnosis](../troubleshooting/codex-standalone-bubblewrap-prerequisite.md)
records why hook completions did not prove shell execution.
`mwwmknc37b` captured 41 localhost provider requests;
all 40 returned shell tool outputs have code `101` with a missing Bubblewrap launcher panic.
The signed standalone binary and application sources remain unchanged.
The owning fixture is being retried with distribution Bubblewrap installed only in the disposable job.

The reconciled completed compute proxy is USD 2.3972.
The host prerequisite rerun and combined tail replay reserve USD 0.54 together,
keeping the declared bound at USD 2.9372 of USD 5.
The remaining admitted queue is linter fuzz,
Git-policy and linter planted controls,
truepeak release all-features Nextest,
privileged WG namespaces and the bounded repeated benchmark owners.

### Passing installed Codex boundary

`1h6qf8j86f` passed the unchanged installed-host Nextest case after admitting
`bubblewrap 0.9.0-1ubuntu0.3` in its owned disposable sandbox.
The package verification,
`/usr/bin/bwrap` SHA-256 and actual namespace probe are retained.
The signed Codex `0.163.0` executable is unchanged.

The final captured localhost request contains all 40 actual `function_call_output` items.
Each has code `0` and exactly the expected `host-payload-executed` output.
The native test independently passes its rewritten command membership-file assertion.
All 40 host-reported hook durations are `1 ms`;
this is one fixture sample at the host reporting resolution,
not a comparative overhead estimate.
The structured `consumerSummaries.installedCodex` receipt records this boundary.
It exercises trusted hooks and a synthetic membership file through the real installed host,
not real kernel cgroup placement or paid model execution.

Completed compute proxy is USD 2.418.
The active fuzz tails `w96195cl04` and linter fuzz `v17djp58z3` reserve USD 0.72,
for a reservation-inclusive bound of USD 3.138.

### Admitted remaining native and benchmark prerequisites

The [truepeak owner](../../package/music-player/truepeak-core/mise.toml) is
`cargo nextest run --release --all-features`.
Its `service` graph enables Turso,
Tokio and the `branches` standard-library workaround;
`fingerprint` enables XXH3.
`src/service_tests.rs` supplies fake decoded samples.
`src/cache_tests.rs` uses `:memory:` databases and uniquely named disposable temporary files.
Its crash tests own and kill their writer children after bounded progress,
with four cycles for each batched synchronization setting and 12 row-write control cycles.
The ignored `crash_writer_child` is invoked only by those parents.
The ignored `bench_cold_write` is a distinct disk benchmark needing `CACHE_BENCH_DIR`;
it is not selected by the ordinary all-features test owner.
The admitted profile preserves default Nextest build and test concurrency.
The previous no-default-features BuildKit producer does not exercise this feature graph.

The [WG functional owner](../../package/cli/wg-quicker-exempt/mise.toml) selects 11 ignored tests.
`src/pin_tests.rs` names their requirements explicitly:
root and writable cgroup v2 for protocol/partial-attach and application-watcher cases,
plus a distinct bpffs mount for persisted links,
replacement,
process-owner identity and transition recovery.
`src/bpf.rs` uses `BPF_PROG_TYPE_CGROUP_SOCK_ADDR`,
`BPF_PROG_LOAD` and `BPF_LINK_CREATE`,
with IPv4/IPv6 connect and UDP sendmsg hooks.
`src/pin.rs` requires bpffs magic `0xcafe4a11` at `/sys/fs/bpf`.
The admitted harness first builds the normal debug CLI and test artifacts,
then enters private mount,
network,
cgroup and PID namespaces under root in its owned ephemeral Depot sandbox.
It mounts new cgroup2 and bpffs views,
raises only loopback,
records actual capabilities/mounts and runs the same ignored cases through Nextest.
No user namespace or real account cgroup is used.
Before/after cgroup inventories and exact owned cleanup remain required evidence.
Namespace,
mount or BPF admission failures will remain prerequisite failures.

The [regex benchmark owner](../../package/rust-module/forbidden-regex.bench/mise.toml)
keeps its release LTO and single-codegen-unit build.
`src/main.rs` has eight ten-second throughput loops;
`src/kernels.rs` has 33 four-second bucket loops,
two four-second set loops and three four-second attribution loops.
That totals at least 232 timed seconds per complete repetition,
plus setup,
parity and complete corpus passes.
Whole-pass work can exceed a timer budget.
The real ruleset builder raises both regex memory limits to `1 << 30`;
the bounded container must report any OOM or time termination separately.
The corpus walker reads non-ignored text lines up to 4,096 bytes,
with no overall line-count cap.
The admitted input is a baked exact frozen `git archive`,
its frozen ignore policy and an empty `.git` root marker,
with no local runtime caches or untracked files.
Two unchanged repetitions keep every existing loop intact.
Each receives a native 300-second container lifetime limit,
2 CPUs,
2 GiB,
128 processes,
no network and no host mounts.
Only completed repetitions can establish observed spread.

The [truepeak benchmark owner](../../package/music-player/truepeak-core.bench/mise.toml)
reads tracks JSONL rather than decoded audio.
The collector is a separate executable needing actual audio and `ffmpeg`.
The search executable takes the complete track measurements,
then applies its fixed exhaustive policy grids.
The admitted repetitions use the exact release executable,
unchanged default grids and 24 deterministic synthetic tracks,
with output files confined to each fresh container.
They establish fixture execution and repeated behavior,
not production audio quality or real-library performance.
The crate declares two executables and no `default-run`;
its existing `cargo run --release --` selection is probed separately before explicit-binary execution.
Its existing debug Nextest owner is also included.
Both benchmark sidecars remain separate from the truepeak all-features library tests.

### Planted Git-policy controls and attribution correction

`gm2drnx19m` ran the unchanged Git-policy fuzz sidecar planted-control owner against disposable copies.
The actual Nextest baseline passed all 38 generator cases.
All 29 planted faults produced real failed Rust tests in the corresponding retained JUnit reports.
These 29 expected failures are controls,
not new product failures or extra distinct test cases.

The first adapter incorrectly attributed failure names when a self-closing passing JUnit case preceded a failing case.
Its greedy attribute capture could consume that passing case and pair its name with a later failure body.
The synthetic identity regression was committed at `2d32fbe86f`,
then reproduced exactly that mismatch before the parser correction.
An independent Python `xml.etree.ElementTree` parse of every actual report confirms 38 cases per report,
a clean baseline and real failures in all 29 planted variants.
`consumerSummaries.gitPolicyPlanted` rebuilds exact failure names from that preserved XML.
Original adapter names remain retained but are explicitly superseded.
No application test was rerun during this correction,
and no source or receipt was discarded.

Linter fuzz `v17djp58z3` passed its generator controls and completed `configuration`,
`markdown`,
`merge_values` and `orchestration` before its step limit interrupted the next target.
The exact frozen target list names the remaining targets `rust_explicit_types` and `rust_style`.
A prior commentary mislabeled the latter as TypeScript;
that scope error was corrected from the actual CLI listing and frozen filenames before dispatch.
The target-filter assertion would reject an incomplete selection.
The dedicated replay is `6z1fwznlrx` at `43a51584d0f3ab389490fbe010ec733aafc05cc9`.
It does not repeat already-passed generator tests.

Completed compute proxy is USD 3.0884,
with USD 1.9116 remaining.
The replay reserves USD 0.36.
The tracked queue is corrected-parser linter planted controls,
truepeak all-features Nextest,
WG privileged namespaces,
bounded benchmark repetitions and one final Codex stderr-retention pass.
The last pass retains successful shutdown stderr,
which the original passing fixture deletes with its temporary home.
