/**
 Coordination of a forwarded index writer with concurrent landings.

 For a classified writer against the real index,
 cli-git takes the landing lock,
 pre-waits for a foreign `index.lock` under the classification rules,
 forwards the command with a landing lease in its environment,
 and releases the landing lock after real Git returns.
 cli-git does not capture Git's stderr to detect a lock failure and re-forward,
 because capturing stderr changes Git's color and progress output;
 a residual race remains only with processes that bypass the wrapper.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ResolvedGitCommand, } from '../forwarded-command.ts';
import { LANDING_LOCK_NAME, } from '../policy-engine/commit-landing-lock.ts';
import {
  LOCK_ABSENT,
  readLockMetadata,
} from './index-lock-evidence.ts';
import {
  LOCK_HELD,
  waitForIndexLock,
} from './index-lock-wait.ts';
import { isIndexWriter, } from './index-writer-commands.ts';
import {
  formatLandingLease,
  hasValidLandingLease,
  LANDING_LEASE_ENV,
} from './landing-lease.ts';
import {
  acquireLocationLandingLock,
  LANDING_LOCATION_ABSENT,
  resolveLandingLocation,
} from './landing-location.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Coordination held around one forwarded command.
 */
export type IndexWriterCoordination = AsyncDisposable & Readonly<{
  /**
   Variables the forwarded Git receives, such as the landing lease.
   */
  environment: Readonly<Record<string, string>>;
}>;

/**
 Coordination for commands that do not write the real index.
 */
export const NO_COORDINATION: IndexWriterCoordination = {
  environment: {},
  [Symbol.asyncDispose]: async function releaseNothing(): Promise<void> {
    l.debug('no index-writer coordination to release',);
  },
};

/**
 Prepares a forwarded command: a real-index writer receives the landing lock after any foreign `index.lock` clears.

 @param command - resolved forwarded command

 @param gitPath - real Git executable

 @param timeoutMs - `indexLock.unprovenOwnerTimeoutMs`

 @param environment - inherited environment carrying any landing lease

 @returns coordination to hold until real Git returns

 @throws {@link IndexLockUnprovenOwnerError} when a dead or unproven foreign owner outlasts the budget; nothing is forwarded

 @example
 ```ts
 await using coordination = await coordinateIndexWriter({ command, gitPath: '/usr/bin/git', timeoutMs: 1_000 });
 ```
 */
export async function coordinateIndexWriter({
  command,
  gitPath,
  timeoutMs,
  environment = process.env,
}: Readonly<{
  command: ResolvedGitCommand;
  gitPath: string;
  timeoutMs: number;
  environment?: Readonly<NodeJS.ProcessEnv>;
}>,): Promise<IndexWriterCoordination> {
  /**
   Tagged coordination logger.
   */
  const rl = tagged({
    tag: coordinateIndexWriter.name,
    l,
  },);
  if (!isIndexWriter(command,))
    return NO_COORDINATION;
  /**
   Landing and index paths of the command's repository selection.
   */
  const location = await resolveLandingLocation({
    gitPath,
    globalArgs: command.args.slice(0, command.subcommandIndex,),
  },);
  if (location === LANDING_LOCATION_ABSENT)
    return NO_COORDINATION;
  if (location.indexPath !== location.realIndexPath) {
    rl.debug(`git ${String(command.subcommand,)} writes ${location.indexPath}, not the real index`,);
    return NO_COORDINATION;
  }
  if (await hasValidLandingLease({
    environment,
    lockDirectory: join(
      location.registryRoot,
      LANDING_LOCK_NAME,
    ),
  },)) {
    rl.debug('an ancestor holds the landing lock; forwarding as native Git would run',);
    return NO_COORDINATION;
  }
  /**
   Landing lock held until real Git returns.
   */
  const lock = await acquireLocationLandingLock({
    gitPath,
    location,
  },);
  /**
   Whether ownership passed to the caller.
   */
  const handedOver = new Set<'handed-over'>();
  /**
   Releases the lock when the pre-wait fails before the caller receives it.
   */
  await using _releaseOnFailure = {
    [Symbol.asyncDispose]: async function releaseUnreturnedLock(): Promise<void> {
      if (handedOver.size === 0)
        await lock[Symbol.asyncDispose]();
    },
  };
  await waitForIndexLock({
    realIndexPath: location.realIndexPath,
    timeoutMs,
    consequence: `did not run git ${String(command.subcommand,)}`,
    attempt: async function lockCleared(): Promise<true | typeof LOCK_HELD> {
      return (await readLockMetadata(`${location.realIndexPath}.lock`,)) === LOCK_ABSENT ? true : LOCK_HELD;
    },
  },);
  handedOver.add('handed-over',);
  rl.debug(`holding the landing lock for git ${String(command.subcommand,)}`,);
  return {
    environment: {
      [LANDING_LEASE_ENV]: formatLandingLease({
        lockDirectory: lock.lockDirectory,
        token: lock.token,
      },),
    },
    [Symbol.asyncDispose]: async function releaseLandingLock(): Promise<void> {
      await lock[Symbol.asyncDispose]();
    },
  };
}
