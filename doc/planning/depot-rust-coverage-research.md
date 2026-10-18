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
