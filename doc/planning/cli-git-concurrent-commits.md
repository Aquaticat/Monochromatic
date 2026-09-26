# cli-git concurrent commits

Grilling session started 2026-09-25.
Status: design in progress; nothing implemented.

## Goal

Several `git commit` invocations against the same worktree and branch run at the same time,
and all of them land as separate sequential commits.
Native Git rejects the later ones with `index.lock` `EEXIST`;
issue #560 is a real collision.

## Evidence

- `package/git-policy/cli/src/policy-engine/commit-transaction-workspace.ts` opens `<index>.lock` with `wx`,
  so a second transaction fails immediately instead of waiting.
- The lock is held across every policy pass,
  the real `git commit` including its hooks,
  and post-commit index installation (`package/git-policy/cli/SPEC.md`, "Transaction protocol").
- Explicit-path commits already build the commit tree in a private index from `HEAD` plus selected paths.
- Policies may read `trackedFiles` for any pathspec and `headOid`,
  and candidate `change`/`revision` are relative to `HEAD`
  (`SPEC.md`, "Public authoring declarations"),
  so a verdict can depend on `HEAD` beyond the candidate bytes.
- Local real Git 2.55.0 has `git hook run` and `git merge-tree --write-tree --merge-base`.
- `git help git`, `GIT_OPTIONAL_LOCKS`: `git status` takes `index.lock` to refresh the index,
  so non-cli-git lock holders are routine.
- Wrapper-added commit latency in the fixture benchmark is roughly 0.3 to 0.45 seconds
  (`package/git-policy/cli/perf/lifecycle-latency-2026-07-16.json`);
  real-repo lock hold time with this repo's plugins is unmeasured.

## Decisions

- Meaning: concurrent separate invocations,
  not one invocation producing several commits.
- Scope: default on in every repository the wrapper runs in.
- Mechanism: parallel preparation,
  serial landing.
  The owner chose this over a lock queue because the engineering capacity exists now.

## Recommendation calibration

Owner, 2026-09-25:
engineering budget is not a constraint;
recommend the most correct and performant option,
never the cheapest to build.

## Settled by the decisions, veto open

- Same worktree and branch only;
  Git refuses one branch checked out in two worktrees.
- Each commit captures selected bytes at invocation,
  inherent in parallel preparation.
- The post-commit real index is computed at landing against the then-current real index,
  never against the invocation-time copy,
  or a landing would erase another commit's staging.
- Transaction journals become per transaction,
  so several prepared transactions coexist;
  recovery handles each.
- Replay onto a moved `HEAD` uses `git merge-tree --write-tree --merge-base`;
  cli-git declares a minimum Git version covering the plumbing it uses.

## Rejected

- Lock queue with the unchanged transaction:
  owner prefers parallel preparation now.
- Batch syntax producing several commits from one invocation.

## Open questions

- Replay granularity: path level or three-way content merge.
- Replay conflict: fail or re-prepare from current worktree bytes.
- Policy re-run after replay.
- Where hooks and the message editor run: preparation or landing.
- Landing order: completion order or invocation order.
- Waiting on landing owners and foreign `index.lock` holders.
- `--amend` and merge, cherry-pick, revert conclusions when `HEAD` moved.
- Index commits (`--no-only`, pathspec-less escape hatch).
- Auto-push when landings are close together.
- Pending fact: whether native `git commit` can run against a private index and a private `HEAD`
  with hooks running in the real worktree (prototype running).

## Next action

Collect answers to the open questions;
no implementation until the owner confirms shared understanding.
