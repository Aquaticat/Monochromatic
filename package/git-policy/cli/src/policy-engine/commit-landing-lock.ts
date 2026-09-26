/**
 The per-worktree landing lock and the recovery every acquisition runs first.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  acquireOwnerLock,
  type OwnerLock,
} from '../owner-lock/owner-lock.ts';
import {
  type InspectedEntry,
  inspectRegistryEntry,
} from './commit-transaction-recovery-inspect.ts';
import {
  hasLandingRecord,
  recoverDeadTransaction,
} from './commit-transaction-recovery-landing.ts';
import type { CommitTransactionRecoveryOutcome, } from './commit-transaction-recovery-types.ts';
import { listTransactionEntries, } from './commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Landing lock directory name inside the transaction registry.
 */
export const LANDING_LOCK_NAME = 'landing.lock';

/**
 Builds an entry's recovery-order key: creation time when attributed, otherwise a key after every ISO time.

 @param inspected - inspected entry

 @returns sortable key
 */
function creationKey(inspected: InspectedEntry,): string {
  /**
   Entry owner evidence.
   */
  const { owner, entry, } = inspected;
  return (typeof owner) === 'string' ? `~${entry.path}` : `${owner.record.createdAt} ${entry.path}`;
}

/**
 Orders inspected entries by owner creation time, oldest first.

 @param entries - inspected entries

 @returns ordered entries
 */
export function oldestFirst(entries: readonly InspectedEntry[],): readonly InspectedEntry[] {
  return entries.toSorted(function byCreation(left, right,): number {
    /**
     Left key.
     */
    const leftKey = creationKey(left,);
    /**
     Right key.
     */
    const rightKey = creationKey(right,);
    if (leftKey === rightKey)
      return 0;
    return leftKey < rightKey ? -1 : 1;
  },);
}

/**
 Recovers every dead-owner transaction holding a landing record; the caller holds the landing lock.

 @param root - transaction registry

 @param gitPath - real Git executable

 @param effectiveCwd - owning worktree directory

 @returns one outcome per recovered transaction

 @example
 ```ts
 await recoverDeadLandings({ root, gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverDeadLandings({
  root,
  gitPath,
  effectiveCwd,
}: Readonly<{
  root: string;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Tagged landing recovery logger.
   */
  const rl = tagged({
    tag: recoverDeadLandings.name,
    l,
  },);
  /**
   Published transactions with owner evidence.
   */
  const inspected = await Promise.all((await listTransactionEntries(root,))
    .filter(function isPublished(entry,): boolean {
      return entry.kind === 'transaction';
    },)
    .map(inspectRegistryEntry,),);
  /**
   Outcomes in recovery order.
   */
  const outcomes: CommitTransactionRecoveryOutcome[] = [];
  for (const item of oldestFirst(inspected,)) {
    /**
     Entry owner evidence.
     */
    const { owner, entry, } = item;
    if (((typeof owner) === 'string') || (owner.liveness === 'alive'))
      continue;
    // oxlint-disable-next-line no-await-in-loop -- Each recovery mutates the ref or index the next one validates.
    if (!(await hasLandingRecord(entry.path,)))
      continue;
    rl.debug(`recovering dead landing ${entry.path}`,);
    outcomes.push({
      directory: entry.path,
      // oxlint-disable-next-line no-await-in-loop -- Each recovery mutates the ref or index the next one validates.
      action: await recoverDeadTransaction({
        directory: entry.path,
        transactionId: entry.transactionId,
        ownerPid: owner.record.ownerPid,
        gitPath,
        effectiveCwd,
      },),
    },);
  }
  return outcomes;
}

/**
 Acquires the landing lock and first recovers dead transactions that hold a landing record,
 so a crashed landing is resolved before another landing moves the ref or index.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param registryRoot - transaction registry

 @returns held landing lock

 @example
 ```ts
 await using lock = await acquireLandingLock({ gitPath: '/usr/bin/git', cwd: '/repo', registryRoot });
 ```
 */
export async function acquireLandingLock({
  gitPath,
  cwd,
  registryRoot,
}: Readonly<{
  gitPath: string;
  cwd: string;
  registryRoot: string;
}>,): Promise<OwnerLock> {
  /**
   Held landing lock.
   */
  const lock = await acquireOwnerLock({
    lockDirectory: join(
      registryRoot,
      LANDING_LOCK_NAME,
    ),
  },);
  /**
   Whether ownership passed to the caller.
   */
  const handedOver = new Set<'handed-over'>();
  /**
   Releases the lock when recovery fails before the caller receives it.
   */
  await using _releaseOnFailure = {
    [Symbol.asyncDispose]: async function releaseUnreturnedLock(): Promise<void> {
      if (handedOver.size === 0)
        await lock[Symbol.asyncDispose]();
    },
  };
  await recoverDeadLandings({
    root: registryRoot,
    gitPath,
    effectiveCwd: cwd,
  },);
  handedOver.add('handed-over',);
  return lock;
}
