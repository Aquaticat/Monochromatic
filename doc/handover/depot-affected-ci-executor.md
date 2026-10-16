# Depot affected CI executor

## Purpose and boundary

Run the complete applicable CI surface for the historical TOML, native, logger,
and desktop changes, preserving each source revision and dependency lockfile.
Package Oxlint always receives the unchanged package task with no file arguments.
Partial waves remain partial evidence, never a complete-graph timing claim.

The isolated harness is branch `trial/depot-complete-ci-20261016`.
Its latest local commit is `faab5b65fb`; the current launched jobs use `aff6a49ca7`.
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
- TOML core `hgqj2nstwq` has failed; inspect attempt `811p86php8` before retrying.
- TOML remaining `d1jgjp62lg` is still being awaited by an existing terminal waiter.
- Executor controls `g57729x66d` ended with the passing fixture successful
  and the failure, Oxlint-argument, and Oxlint-scope fixtures failed as expected.
  Inspect each terminal log to confirm the intended assertion caused its outcome.

All attempts, including setup failures, remain part of provider cost accounting.

## Queue

1.  Inspect terminal TOML and control logs, retaining exact diagnostics and check records.
2.  Prepare native Linux core, Android, and desktop jobs with tools read directly
    from each source lockfile. Review concrete workflows with the main agent before launch.
3.  Publish Android APK evidence to the main agent for headed disposable-device validation.
4.  Execute the native feature matrix and full desktop runtime suite.
5.  Prepare and run bounded logger waves, including declared browser and integration surfaces.
6.  Complete generated-file and container/mutation TOML evidence.
7.  Update #1030 for the prerequisite correction, #1057 for the verified fetch remedy,
    #1012 for unavailable sidecar evidence, and #339 for cycle evidence.
    Deduplicate and document bootstrap, lock metadata, and trust incidents separately.
8.  Render-check this handover and all incident documentation.
9.  Remove disposable catalog worktrees only after inspecting ignored files and Git-directory hazards.

## Constraints and verification

The source `mise.lock` resolves Rust `nightly-2026-10-13`, but mise's installed-tool
selection probe chose `nightly-2026-10-15` without an explicit override.
The main agent verified `MISE_RUST_VERSION=nightly-2026-10-13` selects the required toolchain.
Install exact versions outside source, then verify actual executable versions inside source.

The main worktree's modified `mise.lock` belongs to concurrent work and must remain untouched.
Cloud jobs are bounded to the declared `16x64` runner with a 30-minute job limit.
Container wrappers retain the reviewed 2 GiB memory and 2 CPU limits per container.
No cloud Android emulator is authorized by this task arrangement.

Inspect manifest reach, complete check records, original diagnostics,
and source/input hashes when assessing the result. Report missing checks as missing evidence.
