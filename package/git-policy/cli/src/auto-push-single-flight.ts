/**
 Single-flight auto-push per branch.

 A per-branch owner lock at `<git-common-dir>/cli-git/push/<encoded ref>.lock` serializes pushes,
 and a `last-pushed` record beside it names the most recent attempt.
 A landed commit that a recorded successful push already covers finishes without pushing.
 Otherwise it waits for the lock,
 which a live pusher holds for its whole push,
 and re-reads the record:
 a push that finished meanwhile either covers the commit (joined success),
 or covered it and failed (joined failure).
 Only when neither holds does the commit resolve the current branch tip and push it itself.
 A dead pusher's lock is retired by the owner-lock liveness check,
 and since a dead pusher records nothing,
 the next waiter pushes.

 @module
 */
import { mkdir, } from 'node:fs/promises';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { encodeBranchKey, } from './auto-push-branch-key.ts';
import {
  LAST_PUSHED_ABSENT,
  LAST_PUSHED_SUFFIX,
  type LastPushedRecord,
  readLastPushedRecord,
  writeLastPushedRecord,
} from './auto-push-record.ts';
import { acquireOwnerLock, } from './owner-lock/owner-lock.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private coordination directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Exit code `git merge-base --is-ancestor` uses for "not an ancestor".
 */
const NOT_ANCESTOR_EXIT_CODE = 1;

/**
 One push a coordinator ran itself.
 */
export type PushAttempt = Readonly<{
  /**
   Push exit code, `0` on success.
   */
  exitCode: number;
  /**
   Complete interleaved push output.
   */
  output: string;
}>;

/**
 How a landed commit's auto-push finished.
 */
export type SingleFlightOutcome = Readonly<{
  /**
   `pushed` or `failed` for a push this invocation ran,
   `joined-pushed` or `joined-failed` for one another invocation ran that covered this commit.
   */
  kind: 'pushed' | 'failed' | 'joined-pushed' | 'joined-failed';
  /**
   Branch tip the deciding push resolved.
   */
  tip: string;
  /**
   Deciding push exit code.
   */
  exitCode: number;
  /**
   Complete output of the deciding push; empty for a joined success.
   */
  output: string;
  /**
   Whether the deciding push's tip contains the landed commit.
   */
  covered: boolean;
}>;

/**
 Paths of one branch's coordination files.
 */
export type PushCoordinationPaths = Readonly<{
  /**
   Owner-lock directory.
   */
  lockDirectory: string;
  /**
   `last-pushed` record file.
   */
  recordPath: string;
}>;

/**
 Runs a read-only Git query and returns its trimmed standard output.

 @param gitPath - real Git executable

 @param cwd - directory the commit landed in

 @param args - Git arguments

 @returns trimmed standard output
 */
async function gitOutput({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<string> {
  return (await nanoSpawn(
    gitPath,
    [...args,],
    { cwd, },
  )).stdout
    .trim();
}

/**
 Resolves one branch's coordination file paths under the common Git directory, creating their directory.

 @param gitPath - real Git executable

 @param cwd - directory the commit landed in

 @param branchRef - full branch ref name

 @returns lock and record paths

 @example
 ```ts
 await resolvePushCoordinationPaths({ gitPath: '/usr/bin/git', cwd: '/repo', branchRef: 'refs/heads/main' });
 ```
 */
export async function resolvePushCoordinationPaths({
  gitPath,
  cwd,
  branchRef,
}: Readonly<{
  gitPath: string;
  cwd: string;
  branchRef: string;
}>,): Promise<PushCoordinationPaths> {
  /**
   Common Git directory, absolute when Git supports `--path-format`.
   */
  const reported = await gitOutput({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ],
  },);
  /**
   Per-branch coordination directory.
   */
  const directory = join(
    isAbsolute(reported,) ? reported : resolve(
      cwd,
      reported,
    ),
    'cli-git',
    'push',
  );
  await mkdir(
    directory,
    {
      recursive: true,
      mode: PRIVATE_DIRECTORY_MODE,
    },
  );
  /**
   Flat file name stem for the branch.
   */
  const key = encodeBranchKey(branchRef,);
  return {
    lockDirectory: join(
      directory,
      `${key}.lock`,
    ),
    recordPath: join(
      directory,
      `${key}${LAST_PUSHED_SUFFIX}`,
    ),
  };
}

/**
 Reports whether a commit is the given tip or one of its ancestors.

 @param gitPath - real Git executable

 @param cwd - directory the commit landed in

 @param oid - landed commit

 @param tip - pushed or resolved branch tip

 @returns whether the tip contains the commit

 @throws {@link SubprocessError} when Git fails for a reason other than "not an ancestor"

 @example
 ```ts
 await tipContains({ gitPath: '/usr/bin/git', cwd: '/repo', oid, tip });
 ```
 */
export async function tipContains({
  gitPath,
  cwd,
  oid,
  tip,
}: Readonly<{
  gitPath: string;
  cwd: string;
  oid: string;
  tip: string;
}>,): Promise<boolean> {
  try {
    await nanoSpawn(
      gitPath,
      [
        'merge-base',
        '--is-ancestor',
        oid,
        tip,
      ],
      { cwd, },
    );
    return true;
  }
  catch (error: unknown) {
    if ((error instanceof SubprocessError) && (error.exitCode === NOT_ANCESTOR_EXIT_CODE))
      return false;
    throw error;
  }
}

/**
 Converts a record into the outcome of a commit that joined it.

 @param record - deciding attempt

 @returns joined outcome
 */
function joinedOutcome(record: LastPushedRecord,): SingleFlightOutcome {
  return {
    kind: record.outcome === 'pushed' ? 'joined-pushed' : 'joined-failed',
    tip: record.tip,
    exitCode: record.exitCode,
    output: record.output,
    covered: true,
  };
}

/**
 Finishes auto-push of one landed commit: joins a push that covers it or pushes the branch tip itself.

 @param gitPath - real Git executable

 @param cwd - directory the commit landed in

 @param branchRef - full ref of the branch `HEAD` names

 @param landedOid - commit the landing wrote

 @param push - runs today's push argument selection against real Git

 @param onWait - called once when a live pusher holds the branch's push lock, after the first record read

 @returns how auto-push finished

 @example
 ```ts
 await runSingleFlightPush({ gitPath: '/usr/bin/git', cwd: '/repo', branchRef: 'refs/heads/main', landedOid, push });
 ```
 */
export async function runSingleFlightPush({
  gitPath,
  cwd,
  branchRef,
  landedOid,
  push,
  onWait,
}: Readonly<{
  gitPath: string;
  cwd: string;
  branchRef: string;
  landedOid: string;
  push: () => Promise<PushAttempt>;
  onWait?: () => void;
}>,): Promise<SingleFlightOutcome> {
  /**
   Tagged coordinator logger.
   */
  const rl = tagged({
    tag: runSingleFlightPush.name,
    l,
  },);
  /**
   Branch coordination files.
   */
  const {
    lockDirectory,
    recordPath,
  } = await resolvePushCoordinationPaths({
    gitPath,
    cwd,
    branchRef,
  },);
  /**
   Attempt recorded before this commit waited.
   */
  const before = await readLastPushedRecord(recordPath,);
  if ((before !== LAST_PUSHED_ABSENT) && (before.outcome === 'pushed')
    && (await tipContains({
      gitPath,
      cwd,
      oid: landedOid,
      tip: before.tip,
    },))) {
    rl.debug(`${landedOid} already delivered by the push of ${before.tip}`,);
    return joinedOutcome(before,);
  }
  /**
   Per-branch push lock, held across this invocation's own push.
   */
  await using lock = await acquireOwnerLock({
    lockDirectory,
    onWait: function reportWait(): void {
      rl.debug(`waiting for the in-flight push of ${branchRef}`,);
      onWait?.();
    },
  },);
  /**
   Attempt recorded once this commit holds the lock.
   */
  const after = await readLastPushedRecord(recordPath,);
  if (after !== LAST_PUSHED_ABSENT) {
    /**
     Whether a push finished after this commit first read the record.
     */
    const finishedWhileWaiting = (before === LAST_PUSHED_ABSENT) || (before.ownerToken !== after.ownerToken);
    if (((after.outcome === 'pushed') || finishedWhileWaiting)
      && (await tipContains({
        gitPath,
        cwd,
        oid: landedOid,
        tip: after.tip,
      },))) {
      rl.debug(`${landedOid} joined the ${after.outcome} push of ${after.tip}`,);
      return joinedOutcome(after,);
    }
  }
  /**
   Branch tip this invocation pushes.
   */
  const tip = await gitOutput({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      `${branchRef}^{commit}`,
    ],
  },);
  rl.debug(`pushing ${branchRef} at ${tip} for ${landedOid}`,);
  /**
   This invocation's push.
   */
  const attempt = await push();
  await writeLastPushedRecord({
    recordPath,
    record: {
      schemaVersion: 1,
      tip,
      outcome: attempt.exitCode === 0 ? 'pushed' : 'failed',
      ownerToken: lock.token,
      ownerPid: process.pid,
      exitCode: attempt.exitCode,
      output: attempt.exitCode === 0 ? '' : attempt.output,
    },
  },);
  return {
    kind: attempt.exitCode === 0 ? 'pushed' : 'failed',
    tip,
    exitCode: attempt.exitCode,
    output: attempt.output,
    covered: await tipContains({
      gitPath,
      cwd,
      oid: landedOid,
      tip,
    },),
  };
}
