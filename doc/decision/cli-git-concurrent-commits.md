# cli-git concurrent commits

## Status

Accepted 2026-09-25 after a design grilling session.
The evidence,
probes,
rejected options,
and per-question rationale live in
[`doc/planning/cli-git-concurrent-commits.md`](../planning/cli-git-concurrent-commits.md).
The execution record is
[`doc/handover/cli-git-concurrent-commits.md`](../handover/cli-git-concurrent-commits.md).
The canonical implementation interface is `package/git-policy/cli/SPEC.md`.

## Decision

Several `git commit` invocations against the same worktree and branch run at the same time,
and each lands as its own sequential commit.
Native Git and today's cli-git reject every overlapping commit after the first with `index.lock` `EEXIST`;
issue #560 was a real collision.

The behavior is on in every repository the wrapper runs in,
with no configuration or environment opt-out:
a misbehaving wrapper is a bug to fix,
not a reason to disable parts of it.

## Parallel preparation

- Each commit prepares without the real index lock.
  Explicit-path commits capture selected worktree bytes at invocation;
  index commits capture the real index at invocation.
- Preparation runs native `git commit` against a private index and a private admin dir `HEAD`
  whose `commondir` names the real common dir,
  with `--work-tree` at the real worktree.
  Git then owns hooks,
  the editor,
  templates,
  message cleanup,
  and signing.
- A private ref under `refs/cli-git/` protects each pending commit from `gc`
  until landing,
  abort,
  or recovery deletes it.
  The private admin dir stays unregistered.
- Hooks run through a dispatcher shim passed with `-c core.hooksPath=<shim>`
  plus `-c hook.<event>.enabled=false` for each event.
  The shim resolves the repository's own `core.hooksPath`,
  respects user-disabled events,
  exports an absolute `GIT_WORK_TREE`,
  restores the caller's `GIT_CONFIG_PARAMETERS`,
  runs `git hook run` for `pre-commit`,
  `prepare-commit-msg`,
  and `commit-msg`,
  and omits `post-commit`.
  Shim executables are not shell scripts.
- A per-repository hook lock serializes preparation hooks and the post-landing `post-commit`
  unless `cli-git.config` sets `hooks: { concurrentCommits: true }`.

## Serial landing

- Landing holds the cli-git landing lock and the real `index.lock`,
  advances the target ref by compare-and-swap with a `-m` reflog message carrying the recovery nonce,
  installs the real index computed against the then-current real index,
  and releases.
- When `HEAD` did not move,
  the prepared commit itself lands,
  keeping its signature.
- When `HEAD` moved,
  replay uses `git merge-tree --write-tree --merge-base=<preparation base>`,
  then `git commit-tree`
  (with `-S` when the prepared commit was signed),
  preserving author,
  committer,
  and message.
- A replay conflict fails without landing,
  as a `core-finding` JSONL event with exit `1`
  naming the conflicting paths and the winning commit.
  cli-git never re-prepares from current worktree bytes.
- After a clean replay,
  cli-git policies re-run only when their recorded reads changed,
  and `pre-commit` re-runs outside the landing lock against the replayed index whenever the replayed tree differs.
  Landing then retries.
- Commits land in preparation completion order.
  After `landing.reserveAfterLostRaces` lost races
  (default 2),
  a commit reserves the next landing slot.
- `--amend`,
  merge,
  cherry-pick,
  and revert conclusions fail when `HEAD` moved.
  Every commit records the symbolic `HEAD` target at invocation
  and fails if a branch switch changed it.
- `post-commit` runs once after landing through `git hook run post-commit` in the real worktree
  with native-equivalent `GIT_INDEX_FILE`,
  `GIT_AUTHOR_*`,
  and `GIT_EDITOR=:`.

## Policy inputs

`PolicyDefinition` gains
`inputs?: 'unrestricted' | { readonly external: readonly PolicyInput[] }`,
default `'unrestricted'`.
An unrestricted policy always re-runs after a replay.
`{ external: [] }` declares context-only reads.
`PolicyInput` kinds are `worktree` (pathspecs),
`executable` (path),
`revision` (rev),
and `env` (name);
cli-git fingerprints them.
cli-git records each policy's lazy context reads
(candidate bytes,
`trackedFiles` pathspecs,
`headOid`)
and re-runs a declared policy only when a recorded read or declared input changed.
Precedent:
 Nx task `inputs`,
broad when absent.

## Locks

- cli-git injects `core.lockfilePid=true` into every forwarded and spawned Git,
  so native Git leaves an owner PID file.
- An `index.lock` owner proven alive
  (open holder matched by device and inode,
  or a PID file naming a live process started no later than the lock's ctime)
  gets an unbounded wait with one line naming the holder.
- A dead or evidence-free owner gets Git-style quadratic backoff with jitter
  up to `indexLock.unprovenOwnerTimeoutMs`
  (default 1000),
  then a diagnostic listing the evidence.
- cli-git never deletes a lock.
- Forwarded index writers
  (`add`,
  `rm`,
  `mv`,
  `restore --staged`,
  `reset`,
  and similar)
  wait under the same rules,
  and re-forward after a lock `EEXIST` only when a disposable fixture proves the command fails before side effects.
- `git cli-git fix` holds the landing lock across installation and real-index verification.
- Windows holder detection uses the PID file and Restart Manager,
  never a `DELETE`-access probe.

## Auto-push

Pushes are single-flight per branch.
A landed commit joins an in-flight push covering its OID or pushes the branch tip itself,
and exits only once the remote contains its OID.

## Recovery and compatibility

- Transaction journals are per transaction;
  recovery handles every prepared,
  reserved,
  or landing transaction,
  and a crashed owner releases its reservation through the owner-liveness check.
- Missing optional Git features degrade per feature;
  missing replay plumbing falls back to today's fail-fast behavior.

## Rejected

- A lock queue around today's unchanged transaction.
- Batch syntax creating several commits in one invocation.
- Path-level replay,
  automatic re-preparation on conflict,
  landing in invocation order,
  and hooks inside the landing lock.
- `extensions.worktreeConfig` for the hook work tree:
  it mutates every repository's config and still needs the shim to hold back `post-commit`.
- Opt-out config keys and environment variables.
