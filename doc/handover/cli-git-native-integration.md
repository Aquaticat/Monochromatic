# cli-git native integration

## Purpose and how to respond

This branch integrates the lanes of the native commit path (`package/git-policy/cli/src/native/`) and wires
`git commit` to the full transaction, so the native executable replaces the incumbent TypeScript wrapper.
Branch `feat/cli-git-native-integration`, worktree `.claude/worktrees/cli-git-lane-integration`,
created from the transactions head `fd26b74a99`.
Paths starting with `src/`, `bin/` or `e2e/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Respond by merging the branch into `main` and by vetoing any item under `Choices open to veto`.

## State

The native executable commits for real.
`git commit` (anything but a dry run) runs the transaction in `src/native/commit_transaction.rs` and
`commit_conclusion.rs`; `Unported::CommitTransaction` and its refusal are gone.
The incumbent's end-to-end suite passes against the native executable on Git 2.55.0 (seed 1): 36 of 38 scenarios pass
and 2 skip by design.
The commit differential against the incumbent (from source) finds 10 of 10 cases equal.
The container gate, Clippy and the fuzz smoke are green on the final head; the mutation campaigns are recorded under
`Mutation` (see `Remaining` for what is still running).

### Merged lanes

Merged into this branch, in order:

- `main` (`30cdbc2311`): the dependent-version wiring and the `mise.lock` revision 2 upgrade.
- `feat/cli-git-native-landing`: slice 7a, merged again at `13fe865399` (its mutation record).
- `feat/cli-git-native-post-landing`: slice 7b, merged again at `b1d14c268c` (the commit path calls
  `post_landing.rs` for the after-landing order; there is no second ordering).
- `feat/cli-git-native-config` (`1bc75f16fd`): `cli-git.config.jsonc` and the differential.
- `feat/cli-git-native-e2e`: the `E2E_WRAPPER` selector, merged again at its finished head `b307a723d0`.
- `feat/cli-git-native-transactions`: merged at `44abe6639a`, its head when the final gates ran.

### What was built here

New modules (each with its `*_tests.rs` where it has pure logic; the transaction itself is covered by
`binary_commit_tests.rs` and the end-to-end suite):

- `commit_transaction.rs`: layout capture, published workspace, `preparing.json`, shadow repository, private index
  under capture order, interactive selection, unmerged-path check, convergence. It takes no landing lock.
- `commit_conclusion.rs`: intended tree, selected worktree records, no-change path, hook dispatcher, native
  preparation in the shadow, hook changes, `prepared.json`, the landing loop, post-landing completion.
- `commit_landing_loop.rs`, `commit_revalidation.rs`, `commit_landing_lock.rs`: the replay-and-reland loop around
  `landing_attempt::land_transaction`; the lock is taken for one attempt and released before replay; the starvation
  reservation is requested after the configured lost races and honored before every attempt.
- `commit_no_change.rs`: a correction that restores the base lands as a normalization through the landing attempt.
- `commit_workspace.rs`, `commit_facts.rs`, `commit_worktree_records.rs`, `commit_replay_options.rs`,
  `commit_command.rs`: the owned workspace, rule facts from the real repository with candidates from the private
  index, hook and selected-correction records, replay options, and the command (events, post-commit gate, backup).
- `replay_commit.rs` gained `merge_replay` and `rebuild_replay` (the incumbent revalidates the merged tree before it
  rebuilds the commit); `policy_events.rs` gained the concurrent-commit events; `candidate_prediction.rs` and
  `candidate_store.rs` gained `StagedAtBase` (candidates against the recorded base, never the moved `HEAD`);
  `capture_order.rs` reaches the `capture-locked` marker; `owner_lock.rs` gained a view of an ancestor's lock.
- Wiring: `wrapped_command.rs` runs the transaction for a real commit; a valid preparation lease lets a hook's nested
  Git command through and skips recovery (`refusal_frontier.rs` keeps refusing only the worktree-copy lease).

### Decisions with reasons

- The commit region is parsed by Git's table; a region the table refuses falls through to the policy pass and is
  forwarded, so Git reports its own refusal (`an_unknown_option_is_refused_by_git_and_nothing_lands`).
- Candidates are the index entries of the paths the private index changes against the recorded base, passed as
  `:(top,literal)` pathspecs; an empty scope is answered without asking Git, because an empty pathspec list would
  make every tracked file a candidate.
- The native floor is Git 2.55.0 (settled), so the replay-plumbing probe is not ported and the two
  `replay-unavailable-*` scenarios never run natively; the native e2e runs use `--git 2.55.0`.
- Signals: the preparation `git commit` and the replayed `pre-commit` run under the signal guard, so a `TERM` during a
  hook ends the commit with 143 and leaves no transaction (`a_termination_signal_during_a_hook_ends_the_commit...`).
- The Markdown autofix finding now reads `monochromatic-lint --fix (markdown/<rule>) rewrites <path>.`, the words of
  the incumbent's source; the config differential showed the older wording differed.

## Results

- Config differential: `mise run //package/git-policy/cli:native:config:differential -- --require-all-equal` reports
  72 rows, 0 failing (the 36 pending rows were the two policies main wires). Under host load the incumbent's logger
  sometimes prints `logger internal error: sink verification failed ... Timed out after 5000ms` on its standard error,
  which makes unrelated rows differ for that run; rerun when a row differs only by that line.
- Commit differential: `mise run //package/git-policy/cli:native:differential:commit` (after `native:build`): final
  newline correction, pre-commit restage, no-change normalization, amend, `-a`, `--include`, `--pathspec-from-file`,
  `--allow-empty`, a concurrent replay with the phase marker, and a commit blocked by commit-only are equal in exit
  code, events, resulting commit, index and worktree. With `--native /usr/bin/git` the same run reports the expected
  differences, so the comparison can fail.
- End-to-end, seeds 1 and 2, Git 2.55.0, image tag `integration`: 36 pass, 2 skip each (about 33 minutes under load).
  Including `sigkill-phase-*`, `reservation-after-lost-races`, `branch-switch-during-commit` (now a real pass),
  the hook and lint-staged scenarios.
- Container gate (`native:test:container`, Git 2.56.0 image tag `integration`, Clippy `-D warnings` included): green on
  the final head: 1608 library tests, 98 binary tests. Two earlier runs on a host with load average 40 to 75 failed
  `markdown::the_real_linter_rewrites_through_add_check_and_fix` (and once
  `coordination::a_dead_foreign_lock_is_refused_and_left_in_place`) on the 5-second command bound; both pass when the
  host is quieter, and the bound was not changed.
- Git 2.55.0 probe (host Git 2.55.0): the library tests fail only the 2.56.0 comparisons
  (`command_options::git_tests`, `command_branch_create::git_tests`, `command_add` table, `git_metadata`, `global_arguments`)
  and the test that needs the built linter; the binary tests fail only `forwarding::version_is_identical_to_native_git`,
  the three `resolution::` tests (all compare the `git version` text with 2.56.0) and the real-linter test. Every
  `commit::` and `coordination::` test passes, and the end-to-end suite above runs on Git 2.55.0.
- Fuzz smoke (`mise run //package/git-policy/cli.fuzz:smoke`): green, 15 targets exit 0. The generator control
  `generated_arguments_reach_every_frontier_ending` needed two changes: a real commit prints its own text, so its
  ending carries none, and a commit region that Git's option table refuses is forwarded so Git reports the refusal.
- Clippy: `mise run //package/git-policy/cli:native:clippy` clean.

## Choices open to veto

- `src/native/commit_policy_preparation.rs` and its tests are superseded by `commit_conclusion.rs` (they still
  compile and are tested by the transactions agent's mutation controls); delete them when that agent stops.
- The incumbent's `replayOptions` reads no signing key from an attached `-S<key>` (its normalization splits the key
  into a separate token); the native port reproduces that and pins it with a control. A signed commit that lost a
  race and was given `-S<key>` is re-signed with the configured key in both wrappers.
- Deleted paths are not candidates (the content layer lists present index entries only).

## Remaining

- Merge `feat/cli-git-native-transactions` again, then run on the final head: the container gate
  (`GIT_POLICY_NATIVE_IMAGE_TAG=integration`), `native:clippy`, the Git 2.55.0 probe, `cli.fuzz:smoke`.
- Mutation of the files created or changed here (`native:mutation:scoped`).
- Further e2e seeds.

## Rerun commands

```sh
# repository root, native check and Clippy
mise run //package/git-policy/cli:native:check
node "${HOME}/temp/agent/gate-slot.ts" mise run //package/git-policy/cli:native:clippy

# the commit controls on the host
mise run //package/git-policy/cli:native:test:binary:host -- commit::

# the differentials (build first)
mise run //package/git-policy/cli:native:build
mise run //package/git-policy/cli:native:differential:commit
mise run //package/git-policy/cli:native:config:differential -- --require-all-equal

# the end-to-end suite, as its own unit with a memory cap
systemd-run --user --unit=int-e2e --collect --property=MemoryMax=10G \
  --property=StandardOutput=file:"$HOME/temp/agent/int-e2e.log" --property=StandardError=file:"$HOME/temp/agent/int-e2e.log" \
  --working-directory="$PWD/package/git-policy/cli" --setenv=PATH="$PATH" --setenv=HOME="$HOME" \
  --setenv=GIT_POLICY_NATIVE_IMAGE_TAG=integration node "$HOME/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native --seed 1 --git 2.55.0

# the container gate
GIT_POLICY_NATIVE_IMAGE_TAG=integration node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:native:test:container
```
