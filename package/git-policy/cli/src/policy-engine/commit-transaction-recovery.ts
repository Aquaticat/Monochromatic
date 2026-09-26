/**
 Startup recovery for interrupted private-index commit transactions.

 Recovery examines the legacy single per-index journal that earlier builds wrote,
 then every per-transaction directory.
 Transactions whose owner still runs are skipped;
 dead owners are recovered by their durable evidence or fail closed.

 @module
 */
import {
  lstat,
  readdir,
} from 'node:fs/promises';
import { dirname, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { GitWorktreeIdentity, } from '../git-worktree-identity.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { pruneLandedCaptures, } from './commit-capture-order-prune.ts';
import { classifyTransactionOwner, } from './commit-transaction-owner.ts';
import { recoveryPathExists, } from './commit-transaction-recovery-files.ts';
import {
  loadTransactionJournal,
  recoverJournaledTransaction,
} from './commit-transaction-recovery-journaled.ts';
import { recoverRegisteredTransactions, } from './commit-transaction-recovery-scan.ts';
import {
  RECOVERY_TARGET_NOT_APPLICABLE,
  resolveCommitTransactionTargets,
} from './commit-transaction-recovery-target.ts';
import type { CommitTransactionRecoveryOutcome, } from './commit-transaction-recovery-types.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

export type {
  CommitTransactionRecoveryAction,
  CommitTransactionRecoveryOutcome,
} from './commit-transaction-recovery-types.ts';
export { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Recovers the single per-index journal directory earlier builds wrote, when one was retained.

 @param directory - legacy transaction directory

 @param gitPath - resolved real Git executable

 @param effectiveCwd - invocation repository location

 @returns zero or one outcome

 @throws {@link CommitTransactionRecoveryError} when the directory is unsafe, empty, incomplete, or conflicts
 */
async function recoverLegacyTransaction({
  directory,
  gitPath,
  effectiveCwd,
}: Readonly<{
  directory: string;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Tagged legacy recovery logger.
   */
  const rl = tagged({
    tag: recoverLegacyTransaction.name,
    l,
  },);
  if (!(await recoveryPathExists(directory,)))
    return [];
  /**
   Non-followed transaction directory metadata.
   */
  const directoryMetadata = await lstat(directory,);
  if ((!directoryMetadata.isDirectory()) || directoryMetadata.isSymbolicLink())
    throw new CommitTransactionRecoveryError(`Unsafe transaction recovery directory: ${directory}`,);
  if ((await readdir(directory,)).length === 0)
    throw new CommitTransactionRecoveryError(`Empty pre-journal transaction directory: ${directory}. Setup may still be active; retry after its owner exits. If no owner remains, inspect the empty directory before removing it.`,);
  /**
   Prepared journal naming the legacy owner.
   */
  const journal = await loadTransactionJournal(directory,);
  if ((await classifyTransactionOwner({
    ownerPid: journal.ownerPid,
    ownerIdentity: journal.ownerIdentity,
  },)) === 'alive') {
    rl.debug(`legacy transaction owner ${String(journal.ownerPid,)} is active; skipping ${directory}`,);
    return [{
      directory,
      action: 'owner-active',
    },];
  }
  return [{
    directory,
    action: await recoverJournaledTransaction({
      directory,
      journal,
      gitPath,
      effectiveCwd,
    },),
  },];
}

/**
 Recovers every interrupted transaction for the invocation worktree before config execution.

 @param args - exact wrapper arguments

 @param gitPath - resolved real Git executable

 @param identity - optional repository identity retained by config-free forwarding

 @returns one outcome per examined transaction directory; empty when none exist

 @throws CommitTransactionRecoveryError when current state conflicts

 @example
 ```ts
 await recoverCommitTransaction({ args: ['status'], gitPath: '/usr/bin/git' });
 ```
 */
export async function recoverCommitTransaction({
  args,
  gitPath,
  identity,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  identity?: GitWorktreeIdentity;
}>,): Promise<readonly CommitTransactionRecoveryOutcome[]> {
  /**
   Tagged startup recovery logger.
   */
  const rl = tagged({
    tag: recoverCommitTransaction.name,
    l,
  },);
  /**
   Absolute invocation-specific transaction locations when any can exist.
   */
  const targets = await resolveCommitTransactionTargets({
    args,
    gitPath,
    ...(identity === undefined ? {} : { identity, }),
  },);
  if (targets === RECOVERY_TARGET_NOT_APPLICABLE)
    return [];
  /**
   Effective invocation cwd retained for journal verification Git requests.
   */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  /**
   Legacy journal outcome, recovered first because it predates every registry transaction.
   */
  const legacy = await recoverLegacyTransaction({
    directory: targets.legacyDirectory,
    gitPath,
    effectiveCwd,
  },);
  /**
   Per-transaction outcomes.
   */
  const registered = await recoverRegisteredTransactions({
    root: targets.registryRoot,
    gitPath,
    effectiveCwd,
  },);
  /**
   Every examined transaction.
   */
  const outcomes = [
    ...legacy,
    ...registered,
  ];
  if (outcomes.length > 0)
    rl.debug(`transaction recovery outcomes: ${JSON.stringify(outcomes,)}`,);
  if (outcomes.some(function recovered(outcome,): boolean {
    return outcome.action !== 'owner-active';
  },))
    // A recovered transaction no longer pins landed-capture records.
    await pruneLandedCaptures({
      gitDir: dirname(targets.registryRoot,),
      registryRoot: targets.registryRoot,
    },);
  return outcomes;
}
