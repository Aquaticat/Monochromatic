/**
 The single `post-commit` run after a landing, outside both landing locks.

 It runs through `git hook run post-commit` in the real worktree with the environment native `git commit` gives it,
 under the hook lock unless `hooks.concurrentCommits` is `true` or an outer preparation lease is inherited.
 Its exit status is ignored,
 as in native Git.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { HookDispatchPlan, } from '../hook-dispatch/hook-dispatch-plan.ts';
import { acquireOwnerLock, } from '../owner-lock/owner-lock.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Reads the landed commit's author identity as native `git commit` exports it to hooks.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param landedOid - landed commit

 @returns `GIT_AUTHOR_*` values
 */
async function authorEnvironment({
  gitPath,
  cwd,
  landedOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  landedOid: string;
}>,): Promise<Readonly<Record<string, string>>> {
  /**
   NUL-separated name, email, and raw date with Git's terminating newline.
   */
  const output = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'show',
      '--no-patch',
      '--date=raw',
      '--format=%an%x00%ae%x00%ad',
      landedOid,
    ],
  },)).stdout,);
  /**
   Identity fields.
   */
  const [name = '', email = '', date = '',] = (output.endsWith('\n',) ? output.slice(
    0,
    -1,
  ) : output)
    .split('\0',);
  return {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_AUTHOR_DATE: `@${date}`,
  };
}

/**
 Runs `post-commit` once for a landed commit.

 @param gitPath - real Git executable

 @param cwd - owning worktree root

 @param globalArgs - caller's kept global options

 @param realIndexPath - real index native Git names in `GIT_INDEX_FILE`

 @param landedOid - landed commit

 @param plan - dispatch plan holding user-disabled events and the hook lock

 @example
 ```ts
 await runPostCommitHook({ gitPath: '/usr/bin/git', cwd: '/repo', globalArgs: [], realIndexPath: '/repo/.git/index', landedOid, plan });
 ```
 */
export async function runPostCommitHook({
  gitPath,
  cwd,
  globalArgs,
  realIndexPath,
  landedOid,
  plan,
}: Readonly<{
  gitPath: string;
  cwd: string;
  globalArgs: readonly string[];
  realIndexPath: string;
  landedOid: string;
  plan: HookDispatchPlan;
}>,): Promise<void> {
  /**
   Tagged post-commit logger.
   */
  const rl = tagged({
    tag: runPostCommitHook.name,
    l,
  },);
  if (plan.disabledEvents
    .includes('post-commit',)) {
    rl.debug('post-commit disabled by hook.post-commit.enabled=false',);
    return;
  }
  /**
   Native-equivalent hook environment.
   */
  const environment = {
    ...(await authorEnvironment({
      gitPath,
      cwd,
      landedOid,
    },)),
    GIT_INDEX_FILE: realIndexPath,
    GIT_EDITOR: ':',
  };
  /**
   Hook lock, absent when hooks may overlap.
   */
  await using hookLock = plan.skipHookLock ? undefined : await acquireOwnerLock({ lockDirectory: plan.hookLockPath, },);
  rl.debug(`running post-commit for ${landedOid}${hookLock === undefined ? ' without the hook lock' : ''}`,);
  /**
   Hook outcome; the exit status is ignored as native Git ignores it.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      ...globalArgs,
      'hook',
      'run',
      '--ignore-missing',
      'post-commit',
    ],
    environment,
    stdio: 'inherit',
    allowFailure: true,
  },);
  rl.debug(`post-commit exited ${String(result.exitCode,)}`,);
}
