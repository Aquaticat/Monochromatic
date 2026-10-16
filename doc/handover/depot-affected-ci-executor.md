# Depot affected CI executor

## Purpose and boundary

Run the complete applicable CI surface for the historical TOML, native, logger,
and desktop changes, preserving each source revision and dependency lockfile.
Package Oxlint always receives the unchanged package task with no file arguments.
Partial waves remain partial evidence, never a complete-graph timing claim.

The isolated harness is branch `trial/depot-complete-ci-20261016`.
Its latest feature-suite harness commit is `2288fcec22`.
Manifests live under `.depot/manifests/` on that branch.
The executor records selected and deferred checks, per-check exit status,
source and manifest identity, expected unit files, and input hashes.

## Cases and ownership

- TOML: `525d2e09f8168a3bdd7e513e26d4c80b363123e5`, six affected owners.
  This executor owns package checks, container and mutation checks,
  and generated-file consistency.
- Native: `cb95cf6d785c3073c192b95f0632cdae7b910894`, four affected owners.
  This executor owns Linux core, Android APK producers, Linux desktop,
  and feature combinations. The main agent owns the disposable Android consumer
  and Windows/macOS dispatch.
- Logger: the manifest records the historical source revision and 158 owners.
  This executor owns package checks and bounded scheduling.
- Desktop: `3434eaa455d569c18b52cf15100f77f9db251d21`.
  The main agent owns its Windows and Alpine workflow replay.
- The main agent owns changed-file scanner workflows.
  The scheduling agent owns Scorecard and provider accounting.

## Run ledger

- Preparation `1v4l9tglbt` failed because its shallow checkout lacked the requested ancestor.
  Preparation `tg907s5kfs` passed after full history was fetched.
  Issue #1057 tracks the observed ancestry failure and verified remedy.
- TOML `54sv5gl5l7` was cancelled after review found unnecessary prerequisite edges
  that could suppress independent checks. The corrected manifest removes those edges.
- TOML `zn4q03mh59` failed before checks because the fresh historical checkout's
  Git policy executable had not been built. The harness now invokes its existing build task.
- TOML `zgsc58pmfc` and remaining checks `zxdc83cpbp` failed during setup:
  mise changed historical lock metadata, and a generated-file fixture needed policy trust.
  The next harness uses `MISE_LOCKED=1` for source commands and explicitly trusts
  the reviewed historical repository policy after building its executable.
- TOML core `hgqj2nstwq`, attempt `811p86php8`, completed every selected core check:
  16 passed, 5 failed, and 3 container/mutation checks were explicitly deferred.
  All four full-package Oxlint checks failed.
  The `tsgolint` diagnostic includes `panic: unknown rule: no-generated-empty-object-type`.
  The coverage gate reports `src/values.ts: 332 -> 304 covered lines`.
  Builds, declared unit files, fuzz campaigns, conformance, and the live-source plugin test passed.
- TOML remaining `d1jgjp62lg` failed.
  Container tests failed after 88.057 seconds.
  TOML mutation failed after 957.015 seconds with manifest-read `EACCES` errors
  under the rootful container bridge; it reported 3062 runtime errors.
  File-enforcer mutation failed after 0.323 seconds because its package argument
  was resolved beneath its package working directory a second time.
  Generated consistency failed before generation because Git LFS tried an obsolete endpoint.
  Retain these failures separately from product-check failures.
- Executor controls `g57729x66d` ended with the passing fixture successful
  and the failure, Oxlint-argument, and Oxlint-scope fixtures failed as expected.
  Each terminal log confirms the intended assertion boundary:
  passing task exit 0, deliberate task exit 1, forbidden Oxlint arguments,
  and forbidden Oxlint file scope.

The control result metadata incorrectly reported 16 CPUs and 64 GiB;
its immutable workflow allocates 2 CPUs and 8 GiB.
Use workflow allocation for accounting. Commit `e84911e320` corrects future control records.
Some TypeScript output omitted a final newline, joining an executor event to a `TSFILE` path.
Commit `a65a41cd08` starts every structured executor event with a newline.
The original aggregate case record remains the reconciliation source for that attempt.

- Native setup `5tbb7qftkw` failed because the older JavaScript bootstrap was copied
  to a revision using a published native Git wrapper. Its unrelated offline source build
  lacked the `ignore` registry package. The published-tool bootstrap replaces that step.
- Native `j80v9dqfb4` reached the selected core and Android checks.
  Core build, default build, all-feature tests, benchmark build, and benchmark Clippy passed.
  Core Clippy rejected `clippy::assertions_on_constants` at `cache_tests.rs:300`;
  changed-Rust style also failed.
  Android passed all eight selected producer checks, including both native ABIs,
  debug/release APKs, lint, Clippy, Detekt, JVM tests, and instrumented APK assembly.
  Its artifact is `01a142b1-8fab-7b97-a8fe-257a04d5c35d`,
  SHA-256 `0021a6cda4b4848ec4fc96280894800b3899329f05bfe94e5bfaf58c8cf33d51`.
- Desktop `xg3znh2j0p` failed before checks at an overly strict existing-Clang-directory assertion,
  followed by a harness-relative import of an uninstalled workspace dependency.
  Commit `43c0fb4e8f` verifies the existing headers using Clang
  and resolves the utility from its installed source consumer.
- Scheduler controls `7vqccn47nx` passed their intended boundaries:
  independent build ran despite another check failing,
  the failed dependency suppressed its consumer,
  and the passing consumer read the build marker.
- Virtualization probe `1dg9t9znbj` passed its read-only probe.
  `/dev/kvm` exists and is readable/writable; `virsh` and guest images are absent.
  The `mvm` executable resolves to an unbuilt historical workspace entry point.
  No guest was created. The main agent owns disposable VM fixture preparation and execution.
- Logger static `qm7w64tmhj` reached terminal failure after completing its selected wave.
  The full aggregate record is retained for independent reconciliation.
- Corrected native desktop `w6ln4j09fz` remains running.
- Desktop-case Linux `t4x6r3tb5x` runs source `3434eaa455d569c18b52cf15100f77f9db251d21`
  with harness `9b5dc7cb79`; its runtime records use the desktop manifest identity.
- Expanded controls `dxk4v3s0w3` reached their expected provider statuses:
  passing and deferred-prerequisite succeeded; failure, Oxlint-argument,
  and Oxlint-scope controls failed. Terminal assertion logs remain to be reconciled.

The Android archive was downloaded and its provider SHA-256 verified.
The main agent received debug, release, and instrumentation APK paths plus their individual hashes
for the disposable headed emulator consumer check.
Issue comments now record the ancestry remedy on #1057,
graph and metadata corrections on #1030, and sidecar-ignore evidence on #1012.

The executor now closes every selected wave over its prerequisites.
Deferred checks cannot satisfy selected consumers.
The fifth control specifically selects a type consumer whose build falls outside
the initial static wave and requires that build's actual marker.
The independently reviewed native manifest removes false core-build barriers:
the app and benchmark Cargo tasks compile their path dependencies themselves.
Logger Oxlint depends on the shared configuration build inside the graph;
configuration failure does not suppress independent type checks.

All attempts, including setup failures, remain part of provider cost accounting.

## Queue

1.  Retain terminal TOML diagnostics and check records in the audit and incident trackers.
2.  Collect the running logger, desktop, virtualization, and control results.
3.  Collect the main agent's headed Android consumer result.
4.  Execute the native feature matrix and full desktop runtime suite.
5.  Complete bounded logger waves, including declared browser and integration surfaces.
    The coverage agent owns the offline configured-Pi extension,
    notification, terminal, and tmux consumer adapters.
6.  Complete generated-file and container/mutation TOML evidence.
7.  Update #339 for cycle evidence and collect terminal scheduler-control assertions.
    Deduplicate and document bootstrap, lock metadata, trust, tsgolint panic,
    coverage, rootful mutation permissions, duplicated mutation package path,
    obsolete LFS endpoint, and desktop setup incidents separately.
    Add resource metadata and event delimiter
    corrections to the existing execution-evidence issue.
8.  Render-check this handover and all incident documentation.
9.  Remove disposable catalog worktrees only after inspecting ignored files and Git-directory hazards.

## Constraints and verification

The source `mise.lock` resolves Rust `nightly-2026-10-13`, but mise's installed-tool
selection probe chose `nightly-2026-10-15` without an explicit override.
The main agent verified `MISE_RUST_VERSION=nightly-2026-10-13` selects the required toolchain.
Install exact versions outside source, then verify actual executable versions inside source.
The native workflow installs Rust and `cargo-binstall` before dependent Cargo tools.
The mise action runs in the harness directory because its environment activation
must not alter historical source lock metadata.

The `cb95cf6` desktop E2E source selects six sessions when `E2E_ONLY` is empty:
wide, narrow, dialog, quit, states, and visual.
Its authored host build overrides `LIBCLANG_PATH` to `/usr/lib64` and chooses
Clang resources from `/usr/lib/clang/*`.
Ubuntu preparation must bridge those filesystem paths after probing installed libraries.
The runtime requires a disposable systemd user manager, parent Wayland compositor,
PipeWire services, ImageMagick, and the repository compositor artifact.
The private runtime uses 2 CPUs, 2 GiB, and a 512-process limit.
Successful suite exit is insufficient: audio sinks, user units, processes,
container removal, and overlay isolation must also pass before its record reports success.

The main worktree's modified `mise.lock` belongs to concurrent work and must remain untouched.
Cloud jobs are bounded to the declared `16x64` runner with a 30-minute job limit.
Container wrappers retain the reviewed 2 GiB memory and 2 CPU limits per container.
No cloud Android emulator is authorized by this task arrangement.

Inspect manifest reach, complete check records, original diagnostics,
and source/input hashes when assessing the result. Report missing checks as missing evidence.
