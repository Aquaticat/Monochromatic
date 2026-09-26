/**
 Forwarding of a command that no commit transaction handled:
 alias resolution,
 index-writer coordination with landings,
 then real Git with ignored-state synchronization for worktree creation.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { resolveForwardedCommand, } from './forwarded-command.ts';
import type { GitWorktreeIdentity, } from './git-worktree-identity.ts';
import { coordinateIndexWriter, } from './index-lock/index-writer-coordination.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';
import { runGitWithWorktreeCopy, } from './worktree-copy/lifecycle.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Forwards a command to real Git under landing coordination when it writes the real index.

 @param args - final transformed Git argv

 @param gitPath - absolute real-Git executable

 @param identity - optional repository identity retained before config-free forwarding

 @param unprovenOwnerTimeoutMs - `indexLock.unprovenOwnerTimeoutMs`

 @throws {@link IndexLockUnprovenOwnerError} when a foreign `index.lock` blocks an index writer past the budget

 @throws {@link SubprocessError} when real Git fails

 @example
 ```ts
 await forwardToRealGit({ args: ['add', '--', 'a.txt'], gitPath: '/usr/bin/git', unprovenOwnerTimeoutMs: 1_000 });
 ```
 */
export async function forwardToRealGit({
  args,
  gitPath,
  identity,
  unprovenOwnerTimeoutMs,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  identity?: GitWorktreeIdentity;
  unprovenOwnerTimeoutMs: number;
}>,): Promise<void> {
  /**
   Tagged forwarding logger.
   */
  const rl = tagged({
    tag: forwardToRealGit.name,
    l,
  },);
  if (parseGlobalOptions(args,).willShortCircuit) {
    rl.debug('global help or version form; forwarding without coordination',);
    await runGitWithWorktreeCopy({
      args,
      gitPath,
      ...(identity === undefined ? {} : { identity, }),
    },);
    return;
  }
  /**
   Command after alias resolution.
   */
  const command = await resolveForwardedCommand({
    args,
    gitPath,
  },);
  /**
   Landing coordination held until real Git returns.
   */
  await using coordination = await coordinateIndexWriter({
    command,
    gitPath,
    timeoutMs: unprovenOwnerTimeoutMs,
  },);
  await runGitWithWorktreeCopy({
    args,
    gitPath,
    command,
    environment: coordination.environment,
    ...(identity === undefined ? {} : { identity, }),
  },);
}
