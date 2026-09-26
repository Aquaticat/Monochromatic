# cli-git concurrent commits handover

Updated 2026-09-25.

## Goal

cli-git lets several `git commit` invocations against the same worktree and branch run at the same time,
and every one lands as its own sequential commit,
instead of all but the first failing on `index.lock` `EEXIST` (issue #560 was a real collision).

## Status

- Design grilling finished;
  the owner confirmed shared understanding on 2026-09-25.
- Canonical design record:
  [`doc/planning/cli-git-concurrent-commits.md`](../planning/cli-git-concurrent-commits.md).
  Every decision,
  the evidence behind it,
  rejected options,
  and the owner's recommendation calibration live there.
- Owner instruction after confirmation:
  do the changes in a new worktree,
  then merge to `main` after verification.
- Worktree:
  `/var/home/user/worktrees/cli-git-concurrent-commits`,
  branch `feat/cli-git-concurrent-commits`,
  created from `4044f7d40`.
  `mise run prepare:pnpm:install` completed there.
  cli-git skips ignored-state copying for worktrees created from the main worktree,
  so dependencies had to be installed separately.
  The worktree's `cli-git.config.ts` was byte-identical to the trusted main copy
  and was enrolled with `git cli-git trust --yes`.
  The `forbidden-strings` scanner binary had to be built there
  (`mise run //package/cli/forbidden-strings:build`)
  before commits passed the `security/forbidden-strings` policy.
- Decision record committed on the branch as `d322d083e`
  (`doc/decision/cli-git-concurrent-commits.md`).
- Implementation issue:
   #571.
- Implementation plan committed on the branch:
  `package/git-policy/cli/doc/concurrent-commits-implementation-plan.md`.
- The owner went to sleep on 2026-09-25 and asked for autonomous work,
  building both options when two look equally good.
  Agent-made decisions are recorded,
  veto open,
  in the decision record section "Implementation-time decisions".
- Running in parallel on the branch
  (each commits with explicit pathspecs and retries on `index.lock`):
  the `SPEC.md` and `README.md` rewrite,
  slice 1 (per-transaction journals and live-owner-skipping recovery),
  and the container end-to-end suite
  (expected to fail its concurrency scenarios until later slices land,
  which is its positive control).
- A prototype in disposable repositories compares private `HEAD` shapes
  (detached,
  symbolic pending ref,
  per-worktree ref,
  shadow repository with private refs and the real object store)
  so hooks see the real branch name,
  plus sequencer-conclusion state copying and replay header preservation
  (`git commit-tree` against `git replay`).
  Slice 2 waits on it.

## Evidence produced this session

- Private `HEAD` prototype,
  hook environment probe,
  and `index.lock` holder research:
  summarized in the planning doc sections of the same names.
- Git hook quirks,
  with source traces,
  upstream filing decisions,
  and a prototype Git patch:
  [`doc/troubleshooting/git-hook-disable-switches.md`](../troubleshooting/git-hook-disable-switches.md)
  and
  [`doc/troubleshooting/git-private-admin-dir-hook-environment.md`](../troubleshooting/git-private-admin-dir-hook-environment.md).
- Planning doc commits:
  `4b0335b1b` through `c56b7e6c5` on `main`;
  troubleshooting docs `4044f7d40`.

## Next actions

1.  Review the `SPEC.md`,
    slice 1,
    and end-to-end suite results as they arrive.
2.  Choose the private `HEAD` shape from the prototype,
    then implement slice 2.
3.  Implement the remaining slices in the plan's order:
    per-transaction journals and recovery,
    private `HEAD` preparation with the hook dispatcher shim,
    landing critical section with replay,
    policy read-set tracking and `inputs`,
    starvation reservation,
    foreign `index.lock` classification and index-writer waits,
    single-flight auto-push,
    concurrent fixtures and benchmarks,
    and the container end-to-end suite replaying realistic workloads against fresh dummy repositories
    (see the decision record section "Container end-to-end verification";
    inherent to this design,
    omitted until the owner pointed it out,
    agent-behavior gap tracked in #572).
4.  Verify at the user boundary with the packed shadow-bin fixtures,
    then merge `feat/cli-git-concurrent-commits` into `main`.

## Open items for the owner

- Upstream Git report for the hook disable switches:
  all six filing constraints hold,
  but Git rejects mail that looks AI generated,
  so the owner must rewrite it,
  rerun the reproduction,
  and sign off before sending.
  Nothing was filed.

## Cautions

- Other sessions commit to `main` concurrently
  (AGENTS.md batches,
  issue 570);
  touch only this task's files.
- The shim executables must follow SCR:
  no shell scripts.
