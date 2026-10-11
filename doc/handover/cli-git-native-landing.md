# cli-git native landing (slice 7, first half)

## Purpose

This lane ports the landing critical section of the incumbent TypeScript commit path
(`package/git-policy/cli/src/policy-engine/commit-landing.ts`, `commit-landing-index.ts`,
`commit-landing-objects.ts`, `commit-landing-support.ts`, `commit-landing-index-lock.ts`,
`commit-transaction-test-phase.ts`) into the native Rust wrapper under `package/git-policy/cli/src/native/`.
It runs on branch `feat/cli-git-native-landing`, based on `c2f4219acb`
(the transactions branch head with slices 0 to 5, 8 core, hooks, capture, signals, auto-push and worktree-copy).

Paths starting with `src/` are relative to `package/git-policy/cli/`; every other path is repository-relative.

## Scope

In scope:

- the phase markers (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL`), compiled into the release executable;
- the landing attempt without replay: landing lock, real `index.lock`, branch-switch and head-moved checks,
  object migration into a kept pack, the post-index against the then-current real index, `landing-<n>.json`,
  compare-and-swap with the nonce reflog message, `ref-updated.json`, `.keep` removal,
  owner-preserving install, `index-installed`, conclusion cleanup.

Out of scope (owned by other lanes or slices):

- post-landing completion (added-path copies, shadow and transaction removal, maintenance, `post-commit`,
  capture-record pruning);
- replay and the landing loop's replay branch (slice 8; the API returns `head-moved` with `replayable`);
- the starvation reservation (slice 8; the landing takes a gate seam, see below);
- slice 6 preparation policies;
- wiring into the commit refusal (`Unported::CommitTransaction` stays).

## Status

Evidence skeleton written; no implementation yet.

## Choices open to veto

(filled as decisions are made)

## Trailing gates

(filled at the end)

## Status

Done and verified (host `cargo test --lib -- landing_`, 36 passed; phase markers, 11 passed with 1 ignored child helper run by the kill control):
- `transaction_phase.rs`: phase markers.
- `landing_support.rs`: target comparison, nonce reflog message, compare-and-swap.
- `landing_objects.rs`: migration of shadow objects into a kept pack.
- `landing_index.rs`: post-index against the then-current real index, both modes.

Not started: real index lock install and `index-lock-<n>.json` (extend `real_index_lock.rs`; plan: reuse `recovery_files::install_recovered_index`, then remove the PID file), the landing attempt and outcome enum, `landing-<n>.json`, acceptance tests, container gate, Clippy, Git 2.55.0 probe, mutation.

Rerun: `cd -- <worktree>/package/git-policy/cli && cargo test --locked --offline --lib -- landing_` (through `gate-slot.ts`).
