# cli-git native landing (slice 7, first half)

## Purpose

This lane ports the landing critical section of the incumbent TypeScript commit path
(`package/git-policy/cli/src/policy-engine/commit-landing.ts`, `commit-landing-index.ts`,
`commit-landing-objects.ts`, `commit-landing-support.ts`, `commit-landing-index-lock.ts`,
`commit-landing-findings.ts`, `commit-transaction-test-phase.ts`) into the native Rust wrapper under
`package/git-policy/cli/src/native/`.
It runs on branch `feat/cli-git-native-landing`, based on `c2f4219acb`
(the transactions branch head with slices 0 to 5, 8 core, hooks, capture, signals, auto-push and worktree-copy).

Paths starting with `src/` are relative to `package/git-policy/cli/`; every other path is repository-relative.

## Scope

In scope:

- the phase markers (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL`), compiled into the release executable;
- one landing attempt without replay: real `index.lock` with its journal record, branch-switch and head-moved checks,
  object migration into a kept pack, the post-index against the then-current real index, `landing-<n>.json`,
  compare-and-swap with the nonce reflog message, `ref-updated.json`, `.keep` removal, owner-preserving install,
  `index-installed`, conclusion cleanup, landed-capture recording;
- the `concurrent-commit` finding for a landing that landed nothing, as a pure function.

Out of scope (owned by other lanes or slices):

- the landing lock and the starvation reservation: the caller takes the landing lock
  (`replay_reservation::acquire_reserved_landing_lock` or `recovery_scan::acquire_registry_lock`)
  and passes it to the attempt as a witness;
- replay and the landing loop's replay branch (slice 8): the attempt returns `HeadMoved` with `replayable`;
- post-landing completion (added-path copies, shadow and transaction removal, maintenance, `post-commit`,
  capture-record pruning), including disposal of the transaction directory;
- slice 6 preparation policies;
- wiring into the commit refusal (`Unported::CommitTransaction` stays).

## Status

Done, gated and committed on this branch.
Steps 1 to 4 of the lane plan are complete; mutation results are below.

### Built

Commits, oldest first:

- `a3e65b4dea`, `e71143ce51`: `transaction_phase.rs`, the phase markers.
- `2ec23af3fa`: `landing_support.rs` (target comparison, nonce reflog message, compare-and-swap),
  `landing_objects.rs` (shadow objects into a kept pack), `landing_index.rs` (post-index).
- `626382ebca`: `real_index_lock.rs` gains `acquire_landing_index_lock`, `RealIndexLock::install`
  and `RealIndexLock::release_after_landing`.
- `d7f390002c`: lint fixes (implicit return, shadowing) in the files above.
- `ee925b3955`: `landing_attempt.rs`, `landing_findings.rs`, the acceptance tests
  (`binary_landing_support.rs`, `binary_landing_tests.rs`, `binary_landing_crash_tests.rs`) and five planted controls.

### API for the integrator

`landing_attempt::land_transaction(context, cwd, landing_lock, workspace, request)` runs one attempt.

- `landing_lock: &OwnerLock` is a witness that the caller holds the landing lock; it is not read.
- `workspace: &mut LandingWorkspace` carries the transaction ID, directory, shadow, captured index and commit index.
  Its `preserved` flag is the incumbent's `preserveForRecovery()` / `finishTransaction()`:
  the attempt sets it before writing `landing-<n>.json` and clears it when the compare-and-swap is lost.
  The caller's disposal leaves the directory in place while it is set.
  After `Landed` it stays set until the post-landing step finishes the transaction.
- `request: &LandingRequest` carries the capture, mode, payload (`LandingPayload::Commit` or `NormalizeOnly`),
  committed paths, added and selected-worktree records, the `index.lock` backoff budget and the attempt number.
- The result is `Ok(LandingOutcome)`: `Landed { oid }` (for a normalization the base commit, empty when unborn),
  `HeadMoved { current, replayable }`, or `BranchSwitched { current }`; or `Err(LandingError)`.
- A non-`Landed` outcome becomes the finding through `landing_findings::landing_finding(outcome, capture,
  prepared_oid, replay_plumbing_missing)`, rendered by `policy_events::render_policy_event`,
  and the commit exits with `landing_findings::LANDING_FINDING_EXIT_CODE` (1).
  Nothing renders it yet because the commit path is not wired.
- Lock handling: the real `index.lock` is released on every exit except an install and except a failure after the
  target advanced (or, for a normalization, once its record is durable), where recovery installs through it.

### Tests

Host runs use Git 2.55.0 (`/usr/bin/git`); container runs use Git 2.56.0.

- Unit: `real_index_lock` 13 tests (9 added), `landing_findings` 6, `landing_attempt` 2.
- Binary (`native_binary`, filter `landing`): 25 passed, 1 ignored (the child helper `landing_crash::child_lands`).
  - `landing::*` (17): landed commit and journal bytes, second process's staged path survives, unborn and detached
    targets, conclusion cleanup, branch switch (to a branch and to detached `HEAD`) with the rendered
    `concurrent-commit/branch-switched` line, head-moved with `replayable` for an ordinary commit, amend, merge,
    cherry-pick and revert conclusions, a deleted target and a normalization, normalization landed and on an
    unborn branch, a failed migration, a failed landing record, a foreign lock of a dead owner.
  - `landing_crash::*` (7 plus the helper): a SIGKILL at each of `landing-locked`, `objects-migrated`, `ref-updated`
    and `index-installed` in a child process running the landing API, then the built wrapper's `git status`
    recovers it (exit 0, branch, index tree, status output, nonce once or never in the branch and `HEAD` reflogs,
    no lock, no PID file, no keep, no transaction directory, no shadow, `git fsck --strict` clean);
    a target moved while the child is paused after migration loses the compare-and-swap;
    an install failing after the branch advanced leaves the lock for recovery;
    a malformed marker variable fails the landing and releases the lock.
- Container gate (Git 2.56.0), tag `landing`, image `2561ecd96dfb3fd63a80fdf5435f9c9391056e311e51a1f87259446d473a7961`,
  tree at `ee925b3955`: 1365 library tests passed (5 ignored), 74 binary tests passed (1 ignored),
  1 candidate consumer test passed, Clippy clean.
- Host Clippy (`native:clippy`, all targets, `-D warnings`) clean.
  The Linux gates never compile the `#[cfg(not(unix))]` blocks; `native:clippy:windows` could not run because the
  host lacks the `x86_64-pc-windows-gnu` target (see the trailing gates).

### Mutation

MUTATION_PENDING

### Git 2.55.0

The host Git is 2.55.0, so every host run above is a 2.55.0 run of the same tests; no test needed a version branch.
Probe (`${HOME}/temp/agent/landing-reftable-probe.ts`, real Git 2.55.0): `update-ref -m` of a branch HEAD points at writes the
message once to the branch and `HEAD` reflogs, and `update-ref --no-deref HEAD` on a detached `HEAD` writes the `HEAD`
reflog, identically for the files and the reftable backends.
The container tests use the files backend only; the reftable behavior of the landing is probed, not tested.

## Choices open to veto

### Landing lock and reservation are the caller's

The attempt takes `&OwnerLock` instead of acquiring the lock, and does no reservation check.
The incumbent takes either `acquireLandingLock` or `acquireReservedLandingLock` inside `landTransaction`.
Slice 8 owns the reservation (`replay_reservation.rs`), and a lock acquired inside the attempt would force it to
reimplement the choice, so the caller chooses and the type witnesses the choice.

### The index lock stays in place after the target advanced

The incumbent's disposal always removes an uninstalled lock.
Recovery installs the recorded post-index through that exact lock and fails closed when it is absent,
so the incumbent turns a failed install after `ref-updated` into an unrecoverable repository.
The attempt keeps the lock from the moment the compare-and-swap succeeded (for a normalization, from the moment
its record is durable) and releases it on every earlier exit.
Cost: a plain Git process waits (or fails on `index.lock`) until the next wrapped command runs recovery.

### Install link name

`RealIndexLock::install` reuses `recovery_files::install_recovered_index`, which links the lock as `install.index`;
the incumbent's landing uses `install-<n>.index` and its recovery uses `install.index`.
`create_owned_file_link` removes an existing link first, so a stale `install.index` from a crash between link and
rename is harmless, and the transaction directory is removed whole afterwards.

### Journal before PID file, and an existing PID file

`acquire_landing_index_lock` creates the lock, writes `index-lock-<n>.json`, syncs the directory, fixes the mode
and only then writes the PID file, the incumbent's order.
An existing `index~pid.lock` is left alone (a debug line), as the incumbent does; `acquire_real_index_lock`
(used by the index-writer coordination) still fails on it and is unchanged.

### Release errors

`release_after_landing` warns for a lock that is gone or another process's, and still removes its own PID file,
as the incumbent's disposal does; any other operating-system error is returned as `LandingError::Release`
unless an earlier error already decided the result.

### Directory mark before the landing record

`preserved` is set before `landing-<n>.json` is written, as in the incumbent.
A failed write therefore leaves the directory marked for recovery, which finds no landing record and discards it.

### Wording kept from the incumbent

The head-moved finding says "an merge conclusion", "an cherry-pick conclusion" and "an revert conclusion",
because the incumbent builds that text from the conclusion name; the native text is identical.

## Trailing gates

Skipped on purpose, as the lane brief allows, and what remains:

- Mixed old-and-new wrapper matrix: the incumbent wrapper recovering a native crash (the plan's "under the incumbent"
  half of the crash test) and the native wrapper recovering an incumbent crash.
  The native side of every phase marker is covered; the incumbent side is not run.
- Windows: `mise run //package/git-policy/cli:native:clippy:windows` needs
  `rustup target add x86_64-pc-windows-gnu`; the attempt adds no `cfg(not(unix))` code,
  and `real_index_lock.rs` reuses the existing ones.
- Hook-point kills ("a kill at each hook point") need the hook lane's commit path and belong to the integration step.
- Fuzz: no target added, because the slice 7 plan names none; the journal record codecs that the landing writes
  (`encode_landing`, `encode_index_lock`, `encode_ref_updated`) are covered by the existing
  `package/git-policy/cli.fuzz/fuzz_targets/transaction_records.rs`.

## Rerun

```sh
# Unit tests of this lane on the host (Git 2.55.0).
mise run //package/git-policy/cli:native:test:host -- landing_ real_index_lock transaction_phase
# Binary acceptance tests on the host.
mise run //package/git-policy/cli:native:test:binary:host -- landing
# Gates, through the host slot limiter.
GIT_POLICY_NATIVE_IMAGE_TAG=landing node "${HOME}/temp/agent/gate-slot.ts" mise run //package/git-policy/cli:native:test:container
node "${HOME}/temp/agent/gate-slot.ts" mise run //package/git-policy/cli:native:clippy
# Mutation of this lane's files, after the container gate.
GIT_POLICY_NATIVE_IMAGE_TAG=landing node "${HOME}/temp/agent/gate-slot.ts" mise run //package/git-policy/cli:native:mutation:scoped -- --file src/native/real_index_lock.rs --file src/native/landing_attempt.rs --file src/native/landing_findings.rs --file src/native/landing_support.rs --file src/native/landing_objects.rs --file src/native/landing_index.rs --file src/native/transaction_phase.rs
```
