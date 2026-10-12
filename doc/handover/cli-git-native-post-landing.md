# cli-git native post-landing lane

## Purpose and scope

This lane ports the post-landing completion half of slice 7 in `doc/handover/cli-git-native-transactions.md`
(the module entry starting `post-landing completion:`) from the incumbent TypeScript wrapper into the native Rust wrapper.
Branch `feat/cli-git-native-post-landing`, worktree `.claude/worktrees/cli-git-lane-post-landing`,
based on `feat/cli-git-native-transactions` at `c2f4219acb`.

The lane covers:
added-path worktree copies,
shadow and transaction removal,
capture-record pruning,
automatic maintenance,
the `post-commit` hook under the hook lock,
and the orchestration that runs them in the incumbent's order after a landing.

The landing loop itself belongs to the landing lane.
The orchestration takes a `LandedTransaction` value that the integrator fills from landing's outcome.
The commit refusal (`Unported::CommitTransaction`) is not wired by this lane.

Incumbent sources:
`package/git-policy/cli/src/policy-engine/commit-transaction-conclusion.ts` (the order of steps),
`commit-transaction-workspace.ts` (shadow, directory, then pruning on disposal),
`commit-transaction-added-paths.ts` (`installAddedWorktreeFiles`),
`commit-landing-auto-maintenance.ts`,
`commit-landing-post-commit-hook.ts`.

## Status

In progress.
The three modules and their tests are written; the host test run is waiting on the forbidden-strings build script (regex precompile) under host load.
Nothing is committed beyond the skeleton yet.

## Progress

Modules written, not yet green:

`landed_disposal` (shadow removal, directory removal, capture pruning, in that order).
`post_commit_hook` (disabled check, author environment, hook lock, `hook run --ignore-missing post-commit` with inherited streams).
`post_landing` (added-path copies, disposal, maintenance, post-commit, and the `PostLandingError` mapping).

Each module is registered in `src/native/lib.rs` with its `*_tests.rs` file.

## Choices open to veto

The orchestration does not call `run_post_commit` (the post-commit policy gate and auto-push).
That gate belongs to slice 9, needs the policy configuration the integrator holds, and exits 2 when blocked.
The integrator runs it after `complete_landed_transaction` returns, which keeps the incumbent order.

The post-commit child inherits stdio and is not wrapped in `SignalGuard::run_child`.
The integrator wraps the whole command, as the signal relay contract describes.

After a landing, a copy, disposal or hook failure exits 1 with its message, as the incumbent prints a thrown error.
A maintenance failure is logged and never fails the commit.
