# cli-git 0.0.1: concurrent repository commands can exit 2 on worktree-copy settlement timeout

## Symptom

A repository command using the PATH-shadowing `git` wrapper can fail with:

```text
cli-git: timed out waiting for active worktree-copy settlement under
"/var/home/user/Monochromatic/.git".
```

The emitting tool is `@monochromatic-dev/git-policy-cli`,
 not real Git and not the command harness.
The exact text occurs at
`package/git-policy/cli/src/worktree-copy/journal-lock.ts:513-515`:

```ts
throw new WorktreeCopyError(
  `cli-git: timed out waiting for active worktree-copy settlement under ${JSON.stringify(commonDir,)}.`,
);
```

The harness annotation `(timeout 30s)` is its outer command limit.
It does not extend cli-git's own bounded lock wait.
Cli-git raised `WorktreeCopyError` first and mapped it to exit `2` at
`package/git-policy/cli/src/bin.ts:425-428`:

```ts
else if (error instanceof WorktreeCopyError) {
  console.error(error.message,);
  process.exitCode = 2;
}
```

For this command:

```sh
git status --short && git log -6 --oneline --decorate
```

`git status --short` failed.
Shell `&&` therefore did not start `git log`.

## Root cause

### Every forwarded repository command enters worktree-copy observation

This is not limited to `git worktree add`.
`package/git-policy/cli/README.md:33-35` states:

```text
Every forwarded Git invocation inside an effective repository observes linked-worktree administrative identities
before and after real Git runs.
```

The broad scope lets cli-git detect aliases or hooks that create a linked worktree.
It also means read-only commands such as `git status` participate in repository-wide settlement.

### The lifecycle acquires one repository-wide lock

After observing an effective repository,
`package/git-policy/cli/src/worktree-copy/lifecycle.ts:264-270` acquires the lock before recovery,
real Git execution,
and post-command worktree detection:

```ts
/**
 * Exclusive lease covering refreshed observation, real Git, and synchronization.
 */
await using settlementLock = await acquireWorktreeCopyLock(initialObservation.commonDir,);
```

The lock lives at
`<git-common-dir>/cli-git-worktree-copy/v1/settlement.lock`.
The `await using` scope retains it while the wrapped Git command and worktree-copy lifecycle settle.

### A live owner makes another invocation retry

`package/git-policy/cli/src/worktree-copy/journal-lock.ts:393-405` compares both PID and process birth identity.
A matching live owner returns the busy sentinel:

```ts
const publishedBirthIdentity = await resolveProcessBirthIdentity(publishedOwner.ownerPid,);
if ((publishedBirthIdentity !== PROCESS_IDENTITY_ABSENT)
  && (publishedBirthIdentity === publishedOwner.ownerBirthIdentity)) {
  return LOCK_BUSY;
}
return retireStaleLock(lockDirectory,);
```

This identity check distinguishes a live owner from a dead process or reused PID.
Dead-owner locks are renamed and removed by `retireStaleLock` rather than treated as permanent contention.

### The contender has a bounded internal wait

`package/git-policy/cli/src/worktree-copy/journal-lock.ts:23-30` configures the retry loop:

```ts
const LOCK_RETRY_DELAY_MS = 10;
const LOCK_RETRY_ATTEMPTS = 100;
```

`package/git-policy/cli/src/worktree-copy/journal-lock.ts:497-515` retries in order,
waits after each busy result,
and then throws:

```ts
for (const _attempt of Array.from({ length: LOCK_RETRY_ATTEMPTS, },)) {
  const result = await attemptAcquire({
    lockDirectory,
    owner,
  },);
  if (result !== LOCK_BUSY)
    return result;
  await wait(LOCK_RETRY_DELAY_MS,);
}
throw new WorktreeCopyError(
  `cli-git: timed out waiting for active worktree-copy settlement under ${JSON.stringify(commonDir,)}.`,
);
```

The diagnostic establishes that cli-git's published owner record named a process whose PID and birth identity
remained live throughout this retry budget.
It does not,
 by itself,
 identify that process's command or mean that `.git` is corrupt.

The owner record is removed when its process settles.
By the later probe,
the post-incident journal root was empty and a fresh wrapped `git status --short` succeeded.
This proves only that the lock was no longer blocking at probe time.
Because successful disposal removes `owner.json`,
the original owner process and command cannot be identified after the event from the journal alone.

## Verification

Verified on 2026-07-22 with:

- `@monochromatic-dev/git-policy-cli` `0.0.1`;
- repository commit `f4c02781b3a0f926628071037f87cb343152bf07`;
- installed artifact SHA-256
  `c5b388e8367d64ca8006eb35f73f8a3ee9adbd9f2db7320060db327c3e9be1b5`;
- real Git `2.55.0`;
- Linux process-birth identity from `/proc/<pid>/stat`.

The installed package resolves to the owned package directory
`package/git-policy/cli`,
so no third-party source clone applies.
The source excerpts explain the owned implementation.
The installed bundle independently contains the same retry constants at
`node_modules/@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs:31920-31924`,
the live-owner check at `:32146`,
and the bounded loop and exact diagnostic at `:32213-32224`.
This bundle inspection avoids assuming that the artifact was built from the current source revision.

### Runnable contention harness

The verification used a disposable repository.
One wrapped Git alias retained the lifecycle lock while real Git ran `sleep`:

```sh
ROOT="$(mktemp --directory)"
CLI_GIT="/var/home/user/Monochromatic/node_modules/.bin/git"
/usr/bin/git -C "$ROOT" init --quiet

# Run this holder in one process.
"$CLI_GIT" -C "$ROOT" -c 'alias.hold=!touch holder-started && sleep 30' hold

# Run this contender after holder-started exists.
"$CLI_GIT" -C "$ROOT" status --short
```

While the holder was live,
`owner.json` contained its PID and birth identity:

```json
{
  "leaseToken": "e48f2cfc-f85d-464f-9f8d-1e665a2a9d7d",
  "ownerBirthIdentity": "linux:1607979",
  "ownerPid": 307549,
  "schemaVersion": 1
}
```

The contender produced:

```text
cli-git: timed out waiting for active worktree-copy settlement under
"/home/user/temp/agent/cli-git-settlement.1jAesXfJ/.git".
Command exited with non-zero status 2
elapsed=1.39 exit=2
```

### Commands that work cleanly

- Wrapped `git status --short` with no live holder:
   exit `0`.
- Wrapped `git status --no-worktree-copy --short` with a live holder:
   exit `0`.
- `/usr/bin/git status --short` with a live holder:
   exit `0`.
- Wrapped `git status --short` after terminating the holder:
   exit `0`,
   with the stale lock removed automatically.

On the repository under diagnosis,
wrapped status completed in `0.21` seconds and real Git status completed in `0.03` seconds after contention ended.

### Commands that fail

- An ordinary wrapped invocation inside the same effective repository can exit `2` when it has no opt-out or inherited
  lease and a live holder remains through all configured acquisition attempts.
- The reproduced `status --short` contender exited `2` while a wrapped alias retained the lock.

## Live owner inspection

The owner can be identified only while the failure is active.
The following read-only probe was verified against the disposable holder:

```sh
COMMON_DIR="$(/usr/bin/git rev-parse --path-format=absolute --git-common-dir)"
OWNER="$COMMON_DIR/cli-git-worktree-copy/v1/settlement.lock/owner.json"
cat "$OWNER"
OWNER_PID="$(node --input-type=module -e \
  "import { readFileSync } from 'node:fs'; console.log(JSON.parse(readFileSync(process.argv[1], 'utf8')).ownerPid);" \
  "$OWNER")"
ps --pid "$OWNER_PID" --format pid,ppid,lstart,etime,args
```

The probe resolved the reproduced record's `ownerPid` to the running cli-git holder command.
The record can disappear between reads when its owner finishes;
that race means the contention has settled and the wrapped command can be retried.
Do not delete `settlement.lock` while the reported PID and birth identity are live.

## Verified workarounds

### Retry after the active command settles

For a read-only command,
run it again after the competing cli-git process has ended:

```sh
git status --short && git log -6 --oneline --decorate
```

This was verified after holder termination.
Cli-git detected the dead owner,
retired the stale lock,
and returned exit `0`.

Tradeoff:
retrying does not identify the competing process,
and it will fail again if another command retains the lock through the bounded wait.

### Opt out of worktree copying for this invocation

For read-only inspection:

```sh
git status --no-worktree-copy --short
git log --no-worktree-copy -6 --oneline --decorate
```

`package/git-policy/cli/src/worktree-copy/lifecycle.ts:207-225` strips the wrapper-only flag and forwards directly:

```ts
if (optOutStrippedArgs.length !== args.length) {
  const execution = await executeRealGit({
    args: optOutStrippedArgs,
    gitPath,
  },);
  if ('failure' in execution)
    throw execution.failure;
  return;
}
```

The status form returned exit `0` while the holder was live.

Tradeoff:
this invocation skips worktree-copy observation,
worktree-copy transaction recovery,
and synchronization.
It does not bypass policy processing or every other cli-git startup behavior,
because this return occurs inside `runGitWithWorktreeCopy` after the wrapper has reached that lifecycle.
Do not use the opt-out for a command or alias that might create a linked worktree when ignored-state copying is wanted.

### Bypass cli-git for forensic inspection

```sh
/usr/bin/git status --short
/usr/bin/git log -6 --oneline --decorate
```

The real-Git status form returned exit `0` while the holder was live.

Tradeoff:
`package/git-policy/cli/README.md:13-22` says an absolute real-Git path bypasses startup transaction recovery,
trusted policies,
fixed transforms,
and post-commit auto-push.
Use this only for deliberate inspection,
not as a general replacement for the wrapper.

## What does not work

- Increasing the command harness's outer `30s` limit does not change cli-git's internal acquisition constants.
- Inspecting the journal after a successful owner exits cannot reveal that owner,
  because lock disposal removes `settlement.lock`.
- A first reproduction with a four-second holder did not overlap the contender after tool-call handoff,
  so it succeeded and did not test contention.
  The thirty-second holder established overlap and reproduced exit `2`.
- Manually deleting a live owner's lock is not a valid workaround.
  The owner checks its lease token,
  PID,
  and birth identity again during disposal at
  `package/git-policy/cli/src/worktree-copy/journal-lock.ts:306-330`.
  Removing or replacing the lock can turn ordinary contention into an ownership error and can violate settlement
  serialization.

## Upstream filing artifact

### Upstream filing decision

No external upstream issue or comment should be filed.
Cli-git is owned by this repository,
and `.out-of-scope/` contains no matching exemption.
Searches across open and closed issues and pull requests in
`Aquaticat/Monochromatic` found no duplicate for `worktree-copy settlement` or the timeout text.

The six constraints resolve as follows:

1. **Is it really upstream's fault?
   ** No external upstream exists.
   The observed exit follows cli-git's documented repository-wide observation and source-defined bounded lock.
2. **Can upstream fix it?
   ** A local product change could improve waiting or diagnostics,
   but that would be a project design decision rather than an upstream defect correction.
3. **Are they supporting this use case?
   ** The README supports automatic worktree state copying and documents the
   recoverable lock.
   It does not promise indefinite waiting or concurrent read-only progress.
4. **Would the repo welcome our contribution?
   ** No `CONTRIBUTING.md`,
   issue template,
   pull request template,
   or AI-assistance ban was found.
   This is the same owned repository rather than a third-party contribution boundary.
5. **Will they likely fix it?
   ** There is no issue or maintainer decision requesting different behavior.
   The lock path was introduced by commit `7b63241b3cdd696926852c62905f64a6ebff3040`.
6. **Have we prototyped a minimal fix compatible with their architecture?
   ** No.
   Constraints one through five do not establish an upstream bug,
   so the auto-prototype gate does not apply.

Nothing should be posted upstream.
If the desired product behavior changes,
a local design issue should separately specify whether read-only commands bypass serialization,
wait longer,
or report live-owner details.
