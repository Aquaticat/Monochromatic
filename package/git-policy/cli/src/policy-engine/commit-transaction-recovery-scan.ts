/**
 Startup recovery across every per-transaction directory of one worktree.

 Live owners are skipped;
 dead owners are recovered oldest first,
 because a later transaction was prepared against the state an earlier one left.
 Dead transactions holding a landing record are recovered only while holding the landing lock,
 so recovery never races a live lander.

 @module
 */
import { rm, } from 'node:fs/promises';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { acquireOwnerLock, } from '../owner-lock/owner-lock.ts';
import { join, } from 'node:path';
import {
  LANDING_LOCK_NAME,
  oldestFirst,
  recoverDeadLandings,
} from './commit-landing-lock.ts';
import {
  type InspectedEntry,
  inspectRegistryEntry,
} from './commit-transaction-recovery-inspect.ts';
import {
  hasLandingRecord,
  recoverDeadTransaction,
} from './commit-transaction-recovery-landing.ts';
import type {
  CommitTransactionRecoveryAction,
  CommitTransactionRecoveryOutcome,
} from './commit-transaction-recovery-types.ts';
import { listTransactionEntries, } from './commit-transaction-registry.ts';

export {
  type InspectedEntry,
  inspectRegistryEntry,
} from './commit-transaction-recovery-inspect.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Recovers or skips one inspected entry without a landing record, or one whose landing the caller serializes.

 @param inspected - entry with owner evidence

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns action for the entry

 @example
 ```ts
 await recoverInspectedEntry({ inspected, gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverInspectedEntry({
  inspected,
  gitPath,
  effectiveCwd,
}: Readonly<{
  inspected: InspectedEntry;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<CommitTransactionRecoveryAction> {
  /**
   Tagged per-entry recovery logger.
   */
  const rl = tagged({
    tag: recoverInspectedEntry.name,
    l,
  },);
  /**
   Entry and its owner evidence.
   */
  const {
    entry,
    owner,
  } = inspected;
  if (owner === 'vanished') {
    rl.debug(`transaction finished while recovery listed it: ${entry.path}`,);
    return 'vanished';
  }
  if (owner === 'unattributed') {
    rl.debug(`staging candidate without a complete owner record left in place: ${entry.path}`,);
    return 'staging-unattributed';
  }
  if (owner.liveness === 'alive') {
    rl.debug(`transaction owner ${String(owner.record
      .ownerPid,)} is active; skipping ${entry.path}`,);
    return 'owner-active';
  }
  if (entry.kind === 'staging') {
    // An unpublished candidate never started capture, so it touched nothing outside itself and remains for diagnosis.
    rl.debug(`dead owner stopped before publishing; staging candidate kept: ${entry.path}`,);
    return 'staging-retained';
  }
  return await recoverDeadTransaction({
    directory: entry.path,
    transactionId: entry.transactionId,
    ownerPid: owner.record
      .ownerPid,
    gitPath,
    effectiveCwd,
  },);
}

/**
 Reports whether an inspected entry is a dead published transaction holding a landing record.

 @param inspected - inspected entry

 @returns whether its recovery needs the landing lock
 */
async function needsLandingLock(inspected: InspectedEntry,): Promise<boolean> {
  /**
   Entry owner evidence.
   */
  const {
    owner,
    entry,
  } = inspected;
  return (entry.kind === 'transaction')
    && ((typeof owner) !== 'string')
    && ((typeof owner) === 'object')
    && (owner.liveness === 'dead')
    && (await hasLandingRecord(entry.path,));
}

/**
 Recovers dead landings while holding the landing lock.

 @param root - transaction registry

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns landing outcomes
 */
async function recoverLandingsUnderLock({
  root,
  gitPath,
  effectiveCwd,
}: Readonly<{
  root: string;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Landing lock, so recovery never races a live lander.
   */
  await using _landingLock = await acquireOwnerLock({
    lockDirectory: join(
      root,
      LANDING_LOCK_NAME,
    ),
  },);
  return await recoverDeadLandings({
    root,
    gitPath,
    effectiveCwd,
  },);
}

/**
 Recovers every dead-owner transaction in one worktree registry and removes retired leftovers.

 @param root - absolute registry path

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns one outcome per registry entry

 @throws {@link CommitTransactionRecoveryError} at the first transaction whose evidence conflicts

 @example
 ```ts
 await recoverRegisteredTransactions({ root: '/repo/.git/cli-git-transactions', gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverRegisteredTransactions({
  root,
  gitPath,
  effectiveCwd,
}: Readonly<{
  root: string;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Every classified registry entry.
   */
  const entries = await listTransactionEntries(root,);
  /**
   Owner evidence for every published and staging entry, read concurrently because inspection never mutates.
   */
  const inspected = oldestFirst(
    await Promise.all(entries
    .filter(function ownsEvidence(entry,): boolean {
      return entry.kind !== 'retired';
    },)
      .map(function inspectEntry(entry,): Promise<InspectedEntry> {
        return inspectRegistryEntry(entry,);
      },),),
  );
  /**
   Whether each entry needs the landing lock, in the same order.
   */
  const lockNeeds = await Promise.all(inspected.map(function landingLockNeed(item,): Promise<boolean> {
    return needsLandingLock(item,);
  },),);
  /**
   Landing recoveries, run once under the landing lock when any dead landing exists.
   */
  const landingOutcomes: readonly CommitTransactionRecoveryOutcome[] = lockNeeds.includes(true,)
    ? await recoverLandingsUnderLock({
      root,
      gitPath,
      effectiveCwd,
    },)
    : [];
  /**
   Outcomes in recovery order.
   */
  const outcomes: CommitTransactionRecoveryOutcome[] = [...landingOutcomes,];
  for (const [index, item,] of inspected.entries()) {
    if (lockNeeds[index] === true)
      continue;
    outcomes.push({
      directory: item.entry
        .path,
      // oxlint-disable-next-line no-await-in-loop -- Each recovery mutates the shared ref, index, or lock the next one validates.
      action: await recoverInspectedEntry({
        inspected: item,
        gitPath,
        effectiveCwd,
      },),
    },);
  }
  /**
   Completed directories whose removal was interrupted; they hold no evidence.
   */
  const retired = entries.filter(function isRetired(entry,): boolean {
    return entry.kind === 'retired';
  },);
  await Promise.all(retired.map(async function removeRetired(entry,): Promise<void> {
    await rm(
      entry.path,
      {
        recursive: true,
        force: true,
      },
    );
  },),);
  return [
    ...outcomes,
    ...retired.map(function retiredOutcome(entry,): CommitTransactionRecoveryOutcome {
      return {
        directory: entry.path,
        action: 'retired-removed',
      };
    },),
  ];
}
