# Concurrent-commit container suite

End-to-end workload replay for cli-git concurrent commits.
It is the "Container end-to-end verification" part of
[`doc/decision/cli-git-concurrent-commits.md`](../../../../doc/decision/cli-git-concurrent-commits.md)
and slice 8 of
[`doc/concurrent-commits-implementation-plan.md`](../doc/concurrent-commits-implementation-plan.md).
Fresh dummy repositories replay realistic concurrent-agent workloads through the packed shadow `git`,
and an invariant checker judges every run.

## How to run

```sh
# package/git-policy/cli: run from the repository root
mise run //package/git-policy/cli:test:e2e:concurrent
mise run //package/git-policy/cli:test:e2e:concurrent --seed 1
mise run //package/git-policy/cli:test:e2e:concurrent --seed 1 --scenario shared-file-overlapping-hunks --git 2.55.0
```

- `test:e2e:concurrent` depends on `test:e2e:concurrent:image`,
  which depends on `pack:npm`.
  Every run therefore tests the current build.
- Every run prints its seed and a replay command first,
  then one line per scenario and Git version,
  then a summary.
  The task exits non-zero when any scenario fails or errors.
- `--scenario` takes comma-separated scenario names;
  `--git` takes `2.40.0`,
  `2.55.0`,
  or both.

Regenerate the committed trace with real Git on the host.
It mines this checkout by default;
`--repository <path>` selects another checkout of the same history,
and `--limit` and `--revision` adjust the window.

```sh
# package/git-policy/cli: bypasses the wrapper through /usr/bin/git
mise run //package/git-policy/cli:e2e:concurrent:trace
```

## Container

`concurrent-commits.Containerfile` builds `cli-git-concurrent-e2e`:

- Node 24.11.0,
  the floor of `engines.node` in `package.json`;
- Git 2.40.0 and Git 2.55.0,
  built from checksum-pinned kernel.org tarballs,
  installed under `/opt/git/<version>`;
- no Git on the default `PATH`,
  so each scenario picks its Git by `PATH` order;
- the packed tarball installed with npm at build time under `/opt/cli-git`.

Git 2.40.0 is the declared minimum because it is the first release whose `git merge-tree` accepts `--merge-base`:
`Documentation/RelNotes/2.40.0.adoc` says "`merge-tree` learns a new `--merge-base` option",
and `--write-tree` itself arrived in 2.38.0.
Git 2.55.0 is the current release;
it builds with its default Rust support enabled.
Config-based hooks (`hook.<name>.command`) arrived in Git 2.54.0,
so the config-hook scenarios skip on 2.40.0.

The run uses `podman run --memory=2g --cpus=2 --rm --network=none`.
`e2e/` is mounted read-only at `/fixture/e2e`,
and `package/module/caught-value` is mounted read-only at `/fixture/caught-value`
for `@monochromatic-dev/module-caught-value/ts`,
which the image resolves through a `/node_modules` symlink.
No host repository is mounted writable,
and no credentials enter the container.
Every scenario creates its own repository and local bare remote under `/work/<git-version>/<scenario>/`.

Measured image build times on this host:
255 s for a build that compiles both Git versions
(base images already pulled),
and 12 to 19 s for the usual rebuild after `pack:npm`,
which only replaces the tarball layer.

## Workloads

### Commit-shape trace

`commit-shape-trace-generator.ts` runs `/usr/bin/git log --raw --numstat -M` over the newest 4000 non-merge commits
and writes `commit-shape-trace.json`.
The trace keeps shapes only:
files per commit,
path overlap through stable numeric path IDs,
blob sizes,
added and deleted line counts,
add,
modify,
delete,
and rename kinds,
file modes,
and binary flags.
It holds no file contents,
paths,
object IDs,
messages,
or author data.

Replay picks a seeded window of consecutive commits with 1 to 16 plain-file changes
and synthesizes content for each shape
(text sizes capped at 32 KiB,
binary sizes at 8 KiB).
Paths that must pre-exist are committed by real Git before the window.
Text always ends with exactly one LF,
so the default `final-newline` normalization never changes captured bytes.
A worker that touches a path another in-flight worker selected waits until that worker's `pre-commit` hook ran,
so every attempt commits exactly the bytes the harness wrote for it.

### Scenario catalog

Baselines prove the harness sound and must pass on today's build:

- `baseline-explicit-commit`:
  modify,
  add,
  and delete one path each through sequential explicit-path commits.
- `baseline-index-commit`:
  `git add` two paths,
  keep an unrelated unstaged edit,
  `commit --no-only`.
- `baseline-trace-sequential`:
  12 trace commits one at a time.
- `baseline-amend`:
  amend a token-free setup commit.
- `baseline-lint-staged`:
  lint-staged's backup stash and hide-unstaged sequence on a partially staged index commit,
  in a linked worktree.
- `baseline-hooks-hookdir` and `baseline-hooks-config`:
  `pre-commit`,
  `prepare-commit-msg`,
  `commit-msg`,
  and `post-commit` hooks on sequential commits.
- `baseline-ssh-signing`:
  sequential SSH-signed commits.
- `baseline-sigkill-post-commit`:
  `SIGKILL` inside `post-commit`,
  after native Git released every lock,
  then `git status` and a follow-up commit.
- `baseline-checker-positive-control`:
  one commit lands,
  then real Git amends it with other bytes,
  stages the replaced blob,
  and plants `refs/heads/stale.lock`.
  It passes only when the checker reports exactly
  `index-no-revert`,
  `landed-bytes`,
  `no-leftovers`,
  `remote-contains`,
  and `worktree-preserved`.

Design scenarios exercise the accepted concurrent-commit design:

- `concurrent-disjoint-paths`:
  4 to 8 agents commit disjoint files with seeded start jitter.
- `concurrent-trace-replay`:
  16 trace commits with 4 in flight.
- `shared-file-non-overlapping-hunks` and `shared-file-overlapping-hunks`:
  the first agent is held in `pre-commit` after capturing,
  the second edits the same file and gets a 1.5 s window to start,
  then the first is released.
  Far-apart hunks must both land;
  overlapping hunks may fail only with exit `1` and a `core-finding` event.
- `interleaved-index-writers`:
  4 commits and 4 `git add` runs of new files in a seeded interleaving;
  every add must succeed and its staged entry must survive.
- `hooks-hookdir-concurrent`,
  `hooks-config-concurrent`,
  and `ssh-signing-concurrent`:
  4 agents at once with all four hooks or with signing.
- `lint-staged-stash-concurrent`:
  the lint-staged hook while 3 explicit-path agents and 1 partially staged index commit run,
  in a linked worktree.
- `amend-during-commits`:
  an amend races 3 commits;
  it may land only on the parent it saw.
- `branch-switch-during-commit`:
  `git switch side` while a commit is held in `pre-commit`;
  the switch and the commit must not both succeed.
- `foreign-index-lock-holder`:
  real Git by absolute path runs `commit --all` with an editor that holds `index.lock` for 1.5 s
  while 3 agents commit.
- `gc-prune-during-commits`:
  `git gc --prune=now` while one commit is held in `pre-commit` and 3 others commit.
- `sigkill-pre-commit`,
  `sigkill-prepare-commit-msg`,
  `sigkill-commit-msg`,
  and `sigkill-post-commit`:
  `SIGKILL` to one agent's whole process group inside that hook while a bystander commits,
  then `git status` for recovery and a follow-up commit.
- `sigkill-offset`:
  the same with the kill at a seeded 20 to 600 ms offset instead of a hook.
- `sigkill-phase-preparation-done`,
  `sigkill-phase-landing-locked`,
  `sigkill-phase-objects-migrated`,
  `sigkill-phase-ref-updated`,
  and `sigkill-phase-index-installed`:
  the victim pauses at that landing phase through the test-only phase marker
  (see "Phase markers"),
  the bystander starts and gets 500 ms to reach its landing wait,
  then the victim's process group is killed,
  followed by `git status` for recovery and a follow-up commit.
  At `landing-locked` the victim holds the landing lock and the real `index.lock`,
  so the bystander must recover both from a dead owner.
  `victim-reached-phase` fails when the victim settled before its marker appeared.

Hooks and editors are Node programs (`hook-program-fixture.ts`),
not shell scripts.
Each hook logs its run,
writes a `<token>.<event>` marker,
and blocks while a `<token>.<event>.hold` file exists,
which is how scenarios pin interleavings and inject kills.

### Phase markers

Landing phases run no hook,
so the wrapper exposes them through a test-only environment variable
(`src/policy-engine/commit-transaction-test-phase.ts`,
`SPEC.md` "Container end-to-end suite"):

```sh
# package/git-policy/cli/e2e: environment of one wrapper invocation
CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill                # SIGKILL itself at the phase
CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill:<directory>    # write <directory>/<phase>.reached first
CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:pause:<directory>   # write the marker, wait for <directory>/<phase>.release
```

The phases,
in transaction order,
are `preparation-done`
(after `prepared.json`),
`landing-locked`
(landing lock and real `index.lock` held,
`index-lock-<n>.json` written),
`objects-migrated`
(kept pack written,
before `landing-<n>.json`),
`ref-updated`
(after `ref-updated.json`),
and `index-installed`
(after the `index-installed` marker,
before conclusion cleanup and worktree completion).
The variable name says it is for tests only,
nothing else sets it,
and a malformed value fails the invocation instead of being ignored.
A nested wrapper invocation from a hook inherits the variable,
so scenarios arm it only on commits whose hooks start no nested commit.
The kill scenarios use `pause` and kill the whole process group from the harness,
so the harness records the attempt as deliberately killed.

## Invariants

`invariant-fixture.ts` checks every run:

- `landed-once`:
  an attempt that exited `0` appears exactly once in local-branch history;
  a failed one never appears unless its `commit-landed` event names the commit;
  a killed one appears at most once.
- `landed-bytes`:
  each selected path holds the bytes captured at invocation,
  or a clean three-way merge of them onto the landed parent from a candidate preparation base.
- `landed-scope` and `landed-branch`:
  a landed commit changes only its selected paths
  and is reachable from the branch `HEAD` named at invocation.
- `worktree-preserved`:
  every path the harness wrote still holds the harness's last bytes.
- `index-no-revert` and `index-matches-head`:
  the real index differs from `HEAD` only where the harness staged on purpose,
  and never stages content a landed commit replaced.
- `remote-contains`:
  the remote branch reaches every commit whose wrapper exited `0` with auto-push applying
  (not amends,
  which auto-push cannot fast-forward,
  and not the foreign real-Git commit).
- `no-leftovers`:
  no `refs/cli-git/` ref,
  lock file or lock directory,
  transaction directory under `cli-git-transactions/`,
  legacy `cli-git-transaction` directory,
  or shadow repository under `cli-git/shadow/` remains;
  the persistent `cli-git-transactions/` root is allowed.
- `fsck-clean`:
  `git fsck --strict --no-dangling` exits `0` with no output.
- `exit-events`:
  wrapper stderr JSONL decodes,
  sequences start at `0`,
  and exit codes agree with the events (`SPEC.md` "Stream and exit contract").
- `commit-msg-hook`,
  `post-commit-once`,
  and `signature-valid`:
  in hooked or signed scenarios,
  the landed message carries the hook trailer,
  `post-commit` ran once per successful attempt,
  and `git verify-commit` accepts the commit.
- Scenario expectations such as `all-commits-succeed`,
  `command-succeeds`,
  `staged-entries-kept`,
  `conflict-reported`,
  `amend-safe`,
  and `switch-invalidates-commit` encode the accepted design's outcome for that scenario.

## Seeds and replay

All workload decisions
(worker counts,
start offsets,
interleavings,
trace windows,
synthesized content,
kill offsets)
come from a generator derived from the run seed and the scenario name plus Git version,
so filtering never shifts another scenario's decisions.
Each result line prints a workload digest over labels,
selections,
and captured bytes.
Two consecutive runs of seed 1 printed identical digests for all 54 non-skipped runs.
Hook barriers make the pinned interleavings identical on replay;
free-running starts and the `sigkill-offset` kill still depend on process scheduling,
so a replay reproduces the workload exactly but can land a free-running race differently.

## Results on the current build

Seed 1,
2026-09-26,
packed from `feat/cli-git-concurrent-commits` at `51d21a221`
(slice 3:
replay,
revalidation,
hook-staged trees,
shadow-store preparation,
phase markers,
and the zombie and dead-lander recovery fixes),
66 scenario runs.

### Passing

- Every baseline on both Git versions:
  19 passes,
  plus `baseline-hooks-config` skipped on 2.40.0.
- On both versions:
  `concurrent-disjoint-paths`,
  both shared-file scenarios
  (non-overlapping hunks land through replay;
  overlapping hunks end with one `concurrent-commit/replay-conflict`),
  `hooks-hookdir-concurrent`,
  `ssh-signing-concurrent`,
  `lint-staged-stash-concurrent`,
  `branch-switch-during-commit`,
  `foreign-index-lock-holder`,
  `gc-prune-during-commits`,
  every `sigkill-*` hook and offset scenario,
  and every `sigkill-phase-*` scenario;
  `hooks-config-concurrent` on 2.55.0.
- `concurrent-trace-replay` on 2.40.0 and `interleaved-index-writers` on 2.55.0.

The slice 2 build hung until the scenario timeout in the three `sigkill-*` hook scenarios:
the harness is PID 1 in the container and never reaps the killed group's orphans,
and a zombie still answers `kill(pid, 0)` with its start time,
so lock liveness checks kept waiting on it.
Owner liveness now treats Linux states `Z` and `X` as exited.

### Failing, and why

- `amend-during-commits` on both versions (`remote-contains`):
  the amend won the race and landed,
  and the three commits replayed onto it and exited `0`.
  The amended history cannot fast-forward the remote,
  so auto-push cannot publish the three commits on top of it.
  `remote-contains` exempts amends but not their descendants;
  this is an invariant question for the auto-push slice,
  not a lost commit.
- `concurrent-trace-replay` on 2.55.0 (`all-commits-succeed`):
  two or three in-flight trace commits edit `trace/p1538`,
  each writing its edit on top of the worktree bytes that already hold an earlier in-flight commit's edit.
  Replay merges from each commit's preparation base,
  so adjacent edits conflict and the later commits exit `1` with `concurrent-commit/replay-conflict`,
  as the accepted design specifies for overlapping hunks.
  The scenario expects every commit to land;
  whether it should accept replay conflicts on shared paths,
  as the shared-file scenario does,
  is open.
- `interleaved-index-writers` on 2.40.0 (`command-succeeds`):
  a `git add` exited `128` on `index.lock` while a landing held it.
  Waiting index writers are the index-lock classification slice.

## Open problems

- The shared-file scenarios give the second agent a fixed 1.5 s start window,
  because the accepted design has no hook-visible point between capture and the hook lock.
  A heavily loaded host could release the first agent before the second captured.
- No phase marker sits between a lost race and its replay or revalidation,
  so a kill there is reached only through `sigkill-offset`.
- The lint-staged scenarios run in a linked worktree,
  because the `linked-worktree-only` core policy rejects the hook's `git stash` in a main worktree.
  lint-staged in a main worktree is therefore blocked by cli-git today,
  independent of concurrency.
- The container consumer writes its report with `console`:
  the tagged logger is a workspace package with its own dependencies and is not installed in the container.
- `remote-contains` is checked only after the run,
  not at each wrapper exit.
- The trace has few binary changes (12 of 12,984) and renames (42),
  so windows often contain none;
  the synthetic scenarios do not add binary or rename cases of their own.
