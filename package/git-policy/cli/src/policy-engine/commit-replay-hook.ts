/**
 `pre-commit` re-run against a replayed private index, outside both landing locks.

 It runs through the transaction's dispatcher shim exactly as native preparation ran it:
 `git hook run` in the shadow repository with the shim as the hooks path and every commit event's config hooks disabled,
 so the shim takes the hook lock,
 restores the caller's config parameters,
 and runs the repository's own hooks.
 `prepare-commit-msg` and `commit-msg` do not re-run,
 because the message is fixed.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SILENCED_HOOK_EVENTS, } from '../hook-dispatch/hook-dispatch-plan.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  NATIVE_UNSET_VARIABLES,
  NativeCommitFailedError,
} from './commit-preparation-native.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Exit code of a commit whose `pre-commit` hook rejected it, as native `git commit` exits.
 */
const HOOK_REJECTION_EXIT = 1;

/**
 `pre-commit` rejected the replayed tree; nothing landed.
 */
export class ReplayedPreCommitRejectedError extends NativeCommitFailedError {
  /**
   Creates the rejection.

   @param hookExit - hook's exit status
   */
  public constructor(hookExit: number,) {
    super({
      exitCode: HOOK_REJECTION_EXIT,
      message: `pre-commit exited ${String(hookExit,)} when re-run against the commit replayed onto the moved branch; nothing landed.`,
    },);
    this.name = 'ReplayedPreCommitRejectedError';
  }
}

/**
 Re-runs `pre-commit` against a replayed private index.

 @param gitPath - real Git executable

 @param worktreeRoot - absolute worktree root, where native Git runs hooks

 @param globalArgs - caller's kept global options

 @param shadowPath - shadow repository whose `HEAD` names the replay parent

 @param hooksDirectory - dispatcher shim directory

 @param indexPath - replayed private index the hook sees as `GIT_INDEX_FILE`

 @throws {@link ReplayedPreCommitRejectedError} when the hook rejects

 @example
 ```ts
 await rerunPreCommit({ gitPath: '/usr/bin/git', worktreeRoot: '/repo', globalArgs: [], shadowPath, hooksDirectory, indexPath });
 ```
 */
export async function rerunPreCommit({
  gitPath,
  worktreeRoot,
  globalArgs,
  shadowPath,
  hooksDirectory,
  indexPath,
}: Readonly<{
  gitPath: string;
  worktreeRoot: string;
  globalArgs: readonly string[];
  shadowPath: string;
  hooksDirectory: string;
  indexPath: string;
}>,): Promise<void> {
  /**
   Tagged re-run logger.
   */
  const rl = tagged({
    tag: rerunPreCommit.name,
    l,
  },);
  /**
   Hook outcome with the user's terminal attached.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd: worktreeRoot,
    args: [
      ...globalArgs,
      `--git-dir=${shadowPath}`,
      `--work-tree=${worktreeRoot}`,
      '-c',
      `core.hooksPath=${hooksDirectory}`,
      ...SILENCED_HOOK_EVENTS.flatMap(function silence(event,): readonly string[] {
        return [
          '-c',
          `hook.${event}.enabled=false`,
        ];
      },),
      'hook',
      'run',
      '--ignore-missing',
      'pre-commit',
    ],
    indexPath,
    unsetEnvironment: NATIVE_UNSET_VARIABLES,
    // Native Git gives pre-commit `GIT_EDITOR=:` when no editor runs, and a replay never opens one.
    environment: { GIT_EDITOR: ':', },
    stdio: 'inherit',
    allowFailure: true,
  },);
  rl.debug(`pre-commit re-run exited ${String(result.exitCode,)}`,);
  if (result.exitCode !== 0)
    throw new ReplayedPreCommitRejectedError(result.exitCode,);
}
