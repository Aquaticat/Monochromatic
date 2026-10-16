# Depot affected CI executor

## Purpose and boundary

Run the complete applicable CI surface for the historical TOML, native, logger,
and desktop changes, preserving each source revision and dependency lockfile.
Package Oxlint always receives the unchanged package task with no file arguments.
Partial waves remain partial evidence, never a complete-graph timing claim.

The isolated harness is branch `trial/depot-complete-ci-20261016`.
Its latest local commit is `a65a41cd08`; the current launched jobs use `aff6a49ca7`.
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
- TOML remaining `d1jgjp62lg` is still being awaited by an existing terminal waiter.
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

All attempts, including setup failures, remain part of provider cost accounting.

## Queue

1.  Retain terminal TOML diagnostics and check records in the audit and incident trackers.
2.  Launch reviewed native Linux core and Android jobs with tools read directly
    from the source lockfile. The workflow is ready at `a65a41cd08`.
    Prepare and review the Linux desktop host-library bridge and runtime adapter.
3.  Publish Android APK evidence to the main agent for headed disposable-device validation.
4.  Execute the native feature matrix and full desktop runtime suite.
5.  Prepare and run bounded logger waves, including declared browser and integration surfaces.
6.  Complete generated-file and container/mutation TOML evidence.
7.  Update #1030 for the prerequisite correction, #1057 for the verified fetch remedy,
    #1012 for unavailable sidecar evidence, and #339 for cycle evidence.
    Deduplicate and document bootstrap, lock metadata, trust, tsgolint panic,
    and coverage incidents separately. Add resource metadata and event delimiter
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

The main worktree's modified `mise.lock` belongs to concurrent work and must remain untouched.
Cloud jobs are bounded to the declared `16x64` runner with a 30-minute job limit.
Container wrappers retain the reviewed 2 GiB memory and 2 CPU limits per container.
No cloud Android emulator is authorized by this task arrangement.

Inspect manifest reach, complete check records, original diagnostics,
and source/input hashes when assessing the result. Report missing checks as missing evidence.
