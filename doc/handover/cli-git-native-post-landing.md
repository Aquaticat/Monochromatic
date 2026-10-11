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

Evidence is recorded slice by slice below as each commit lands.

## Progress

Nothing committed yet.

## Choices open to veto

None recorded yet.
