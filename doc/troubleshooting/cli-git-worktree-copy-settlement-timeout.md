# cli-git 0.0.1: main-worktree status wrongly entered worktree-copy settlement and could exit 2

## Symptom

This command ran in the main worktree:

```sh
git status --short && git log -6 --oneline --decorate
```

Cli-git emitted:

```text
cli-git: timed out waiting for active worktree-copy settlement under
"/var/home/user/Monochromatic/.git".
```

The main-worktree identity is measurable:

```text
$ /usr/bin/git rev-parse --show-toplevel --git-dir --git-common-dir
/var/home/user/Monochromatic
.git
.git
```

Equal canonical Git and common directories identify the main worktree.
That target should not enter linked-worktree administrative observation,
journal recovery,
settlement locking,
or ignored-state synchronization.

The exact diagnostic comes from cli-git,
not real Git and not the command harness.
The harness's `(timeout 30s)` annotation is an outer limit;
cli-git exited first with its own code `2`.
Because `git status --short` failed,
shell `&&` did not start `git log`.

## Root cause

The earlier diagnosis in this file treated live lock contention as the problem.
That was incomplete.
Contention explained how the message was emitted,
but not why main-worktree `status` tried to acquire this lock.
The applicability bug was the cause at the user boundary.

### Pre-fix observer treated every effective repository as applicable

At pre-fix commit `8efcf4538799f792976ef0d761c60cd0f248a032`,
`package/git-policy/cli/src/worktree-copy/git-observer.ts:302-344` resolved only the common directory,
then immediately read linked-worktree administration and returned an observation:

```ts
const commonDir = await resolveCommonDir({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
},);
if ((typeof commonDir) === 'symbol') {
  return WORKTREE_COPY_NOT_APPLICABLE;
}
const adminRoot = join(
  commonDir,
  'worktrees',
);
const beforeAdminIds = await readAdminIds(adminRoot,);
const sourceRoot = await resolveSourceRoot({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
},);
return {
  adminRoot,
  beforeAdminIds,
  commonDir,
  effectiveCwd,
  ...((typeof sourceRoot) === 'symbol' ? {} : { sourceRoot, }),
};
```

No invocation-specific Git directory was resolved.
The observer therefore could not distinguish:

- main worktree:
   canonical Git directory equals canonical common directory;
- linked worktree:
   canonical Git directory differs from canonical common directory;
- bare repository:
   no source worktree root.

### Lifecycle locked every observation

`package/git-policy/cli/src/worktree-copy/lifecycle.ts:269` acquires settlement for every returned observation:

```ts
await using settlementLock = await acquireWorktreeCopyLock(initialObservation.commonDir,);
```

A plain main-worktree `status` therefore created
`.git/cli-git-worktree-copy/v1`,
acquired `settlement.lock`,
and became vulnerable to another invocation retaining that lock through the bounded acquisition loop.

### Fix excludes main worktrees before stateful worktree-copy operations

Commit `230f78959153195cbe01b0497d977dcac84fab71` changes
`package/git-policy/cli/src/worktree-copy/git-observer.ts:347-376` to resolve both source and invocation-specific Git
administration before reading linked identities:

```ts
const commonDir = await resolveCommonDir({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
},);
if ((typeof commonDir) === 'symbol')
  return WORKTREE_COPY_NOT_APPLICABLE;

const sourceRoot = await resolveSourceRoot({
  gitPath,
  preSubcommandArgs,
  invocationCwd,
},);
if ((typeof sourceRoot) === 'string') {
  const gitDir = await resolveGitDir({
    gitPath,
    preSubcommandArgs,
    invocationCwd,
  },);
  if (gitDir === commonDir)
    return WORKTREE_COPY_NOT_APPLICABLE;
}
```

Only after this gate does the observer read the linked-worktree administrative identity set.
The lifecycle receives the not-applicable sentinel for a main worktree and forwards real Git without worktree-copy
recovery,
locking,
or post-command synchronization.

Linked source worktrees remain applicable because their per-worktree Git directory differs from the common directory.
Bare repositories retain their explicit empty-source behavior.

## Verification

Verified on 2026-07-22 with:

- `@monochromatic-dev/git-policy-cli` `0.0.1`;
- real Git `2.55.0`;
- failing regression commit `8efcf4538799f792976ef0d761c60cd0f248a032`;
- fix commit `230f78959153195cbe01b0497d977dcac84fab71`;
- linked-source fixture commit `0ca54c3512879e16d8237ed26dd57fa41ff3dac6`;
- fixed bundle SHA-256
  `8135d032376ecc9dceef5bc67ab30f90e826c80b42c789893d516df7e6e8348c`.

### Regression harness

The built-wrapper test
`package/git-policy/cli/src/worktree-copy.unit.test.ts` creates a disposable main worktree,
runs wrapped `status`,
creates a linked worktree through wrapped `worktree add`,
and asserts all of these outcomes:

- `.git/cli-git-worktree-copy` is never created in the main repository;
- main-worktree status succeeds;
- worktree creation still forwards to real Git;
- ignored main-worktree state is not copied;
- no copy summary is emitted.

Before the fix,
the test failed at its first applicability assertion:

```text
AssertionError: expected [..., 'cli-git-worktree-copy', ...]
to not include 'cli-git-worktree-copy'
```

After the fix,
the same built-wrapper test passes.

A separate disposable boundary probe retained a live settlement lock from a linked source while invoking
`git -C <main> status --short` through the fixed bundle.
Main status returned exit `0` in `0.16` seconds,
and the linked holder process and exact `owner.json` record remained live afterward.
This directly verifies that main status no longer waits on linked-source settlement.

### Behaviors that now work cleanly

- Main-worktree `git status --short` forwards without creating worktree-copy state.
- Main-worktree `git worktree add` forwards without copying ignored state or acquiring settlement.
- A linked source worktree still copies ignored state for direct `worktree add` forms.
- A linked source worktree still detects ordinary aliases that create worktrees.
- Bare repositories still synchronize an empty source set.
- Interrupted journals still recover from a later applicable linked-worktree or bare-repository invocation.

### Pre-fix behavior that failed

- Main-worktree `status` created the worktree-copy journal root despite creating no worktree.
- Concurrent main-worktree commands could then hit the settlement timeout and exit `2`.
- Retrying could hide the applicability defect after contention ended.

## Verified workarounds

### Upgrade or rebuild cli-git with the applicability fix

This is the complete correction.
Main-worktree commands no longer enter settlement,
so they do not need a copy-specific flag or real-Git bypass.

Tradeoff:
main-worktree commands that create linked worktrees no longer bootstrap those destinations with ignored main-worktree
state.
Run creation from an applicable linked source when copying is wanted.

### Pre-fix read-only inspection with the wrapper opt-out

On an older artifact,
this avoids worktree-copy lifecycle for one read-only invocation:

```sh
git status --no-worktree-copy --short
git log --no-worktree-copy -6 --oneline --decorate
```

Tradeoff:
this requires callers to remember a flag for behavior that should be automatic,
and it also skips worktree-copy transaction recovery for that invocation.

### Pre-fix forensic real-Git bypass

```sh
/usr/bin/git status --short
/usr/bin/git log -6 --oneline --decorate
```

Tradeoff:
an absolute real-Git path bypasses all cli-git policies,
fixed transforms,
transaction recovery,
and auto-push behavior.
Use it only for deliberate inspection.

## What does not work

- **Explaining only the lock owner.
  **
  A live owner explains the timeout mechanism but does not justify main-worktree applicability.
- **Retrying until contention ends.
  **
  Retry can succeed while leaving the wrong lifecycle boundary intact.
- **Increasing the outer command timeout.
  **
  It does not change cli-git's internal acquisition constants or applicability.
- **Deleting `settlement.lock`.
  **
  Manual deletion races the live owner and can convert contention into an ownership failure.
- **Keeping copy tests rooted only in main repositories.
  **
  Those fixtures encoded the bug as expected behavior.
  Copy scenarios now use linked sources,
  while a separate regression test covers main-worktree bypass.

## Upstream filing artifact

### Upstream filing decision

No external upstream filing applies.
Cli-git and the fixed source are owned by this repository.
`.out-of-scope/` contains no matching exemption,
and searches across open and closed issues and pull requests in
`Aquaticat/Monochromatic` found no duplicate for the timeout or worktree-copy settlement terms.

The six constraints resolve as follows:

1. **Is it really upstream's fault?
   **
   No external upstream exists.
   The defect was this repository's applicability boundary.
2. **Can upstream fix it?
   **
   The owned implementation was fixed by comparing canonical invocation-specific Git and common directories.
3. **Are they supporting this use case?
   **
   Yes.
   Cli-git already classifies main and linked worktrees for other safeguards.
4. **Would the repo welcome our contribution?
   **
   This is the owning repository,
   with no external contribution or AI-assistance policy boundary involved.
5. **Will they likely fix it?
   **
   The fix and regression test are committed locally.
6. **Have we prototyped a minimal compatible fix?
   **
   Yes.
   The built artifact fails before the gate,
   passes after it,
   and retains linked-source and bare-source coverage.

Nothing should be posted to an external upstream.
The repository commits and this troubleshooting record are the filing artifact.
