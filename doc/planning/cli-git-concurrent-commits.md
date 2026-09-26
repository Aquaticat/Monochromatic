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

## Private HEAD prototype, 2026-09-25

Disposable fixture,
real Git 2.55.0 at `/usr/bin/git`,
global and system config disabled,
SSH commit signing configured.

- Native `git commit` with `GIT_INDEX_FILE` private and `--git-dir` pointing at a private per-worktree admin dir
  (registered `git worktree add --detach --no-checkout`,
  or hand-built `HEAD` plus `commondir` file or `GIT_COMMON_DIR`)
  and `--work-tree` at the real worktree
  ran pre-commit,
  prepare-commit-msg,
  commit-msg,
  post-commit,
  the editor,
  template and cleanup,
  and signing.
- Hooks ran with the real worktree top level as cwd,
  saw the private index and private `HEAD`,
  and read real worktree files.
- Shared `HEAD`,
  `refs/heads/main`,
  their reflogs,
  and real `.git/index` bytes stayed unchanged.
- Replay with `git merge-tree --write-tree --merge-base`,
  `git commit-tree`,
  and compare-and-swap `git update-ref <ref> <new> <old>` produced the right tree,
  parent,
  author,
  and committer.
  Non-overlapping hunks in one file merged;
  overlapping hunks exited 1 and still printed a tree ID,
  so callers must check the exit status.

Measured caveats:

- The real index is stale after the ref moves;
  an ordinary commit afterwards committed a revert.
  The landing-time real index update is mandatory.
- Hooks inherit `GIT_DIR` and relative `GIT_WORK_TREE=.`;
  a hook that changes into a subdirectory and runs Git sees the wrong top level.
  Ordinary commits export neither.
- `git commit-tree` ignores `commit.gpgsign`;
  replay must pass `-S` when signing is configured.
- `git update-ref` without `-m` writes an empty reflog message.
- A registered no-checkout worktree protects its private commit from `gc`,
  appears in `git worktree list`,
  and needs `git worktree remove --force`.
  An unregistered admin dir is invisible,
  but `git gc --prune=now` deleted its commits.

Untested:
concurrency,
the wrapper on `PATH`,
hook frameworks,
GPG signing,
user config,
`--amend` and `--verbose` with a private `HEAD`,
sparse checkout,
submodules,
`core.hooksPath`,
`extensions.worktreeConfig`.

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
- Private `HEAD` mechanism details,
  after the hook placement answer:
  `gc` protection for pending commits,
  the `GIT_WORK_TREE=.` hook environment,
  and replay signing.
- Whether the budget calibration becomes an `AGENTS.md` rule.

## Next action

Collect answers to the open questions;
no implementation until the owner confirms shared understanding.
