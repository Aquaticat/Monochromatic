/**
 Recovery of one dead-owner transaction from its schema-version-2 records.

 Without a landing record the real index and real refs were never touched:
 recovery releases a real `index.lock` the transaction provably created,
 removes the transaction's `.keep` files and shadow repository,
 and then removes the transaction directory.
 With a landing record,
 recovery runs only while holding the landing lock,
 decides from `ref-updated.json` or the target reflog's nonce entry whether the commit landed,
 and either discards the attempt or completes it:
 index installation,
 conclusion cleanup from the shadow,
 and added-path worktree copies.
 Missing evidence fails closed and preserves the directory.

 @module
 */
import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { removeShadowRepository, } from '../shadow-repository/shadow-repository.ts';
import { reproduceConclusionCleanup, } from '../shadow-repository/shadow-conclusion-cleanup.ts';
import { installAddedWorktreeFiles, } from './commit-transaction-added-paths.ts';
import {
  resolveRefCommit,
  shadowRepositoryPath,
} from './commit-transaction-capture.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  parseLandingRecord,
  parsePreparingRecord,
} from './commit-transaction-journal-parse.ts';
import {
  PREPARING_FILENAME,
  type PreparingRecord,
} from './commit-transaction-journal-states.ts';
import { removeTransactionKeeps, } from './commit-landing-objects.ts';
import { removeTransactionDirectory, } from './commit-transaction-registry.ts';
import {
  commitLanded,
  completeIndex,
} from './commit-transaction-recovery-completion.ts';
import {
  attemptNumbers,
  LANDING_RECORD_PREFIX,
  pathPresent,
  RECORD_SUFFIX,
  releaseRecordedLocks,
  removeDeadPidFile,
} from './commit-transaction-recovery-evidence.ts';
import {
  readRegularRecoveryFile,
  recoveryPathExists,
} from './commit-transaction-recovery-files.ts';
import type { CommitTransactionRecoveryAction, } from './commit-transaction-recovery-types.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

export { hasLandingRecord, } from './commit-transaction-recovery-evidence.ts';

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
 The owner died before writing its invocation capture.
 */
const PREPARING_ABSENT: unique symbol = Symbol('transaction preparing record absent',);

/**
 Legacy prepared journal filename written only by unreleased builds in registry directories.
 */
const UNRELEASED_JOURNAL_FILENAME = 'journal.json';

/**
 Removes everything a dead transaction left: `.keep` files, the shadow, and finally the directory.

 @param directory - transaction directory

 @param transactionId - transaction ID

 @param objectDirectory - real object directory

 @param shadowPath - shadow repository
 */
async function discardTransaction({
  directory,
  transactionId,
  objectDirectory,
  shadowPath,
}: Readonly<{
  directory: string;
  transactionId: string;
  objectDirectory: string;
  shadowPath: string;
}>,): Promise<void> {
  await removeTransactionKeeps({
    objectDirectory,
    transactionId,
  },);
  await removeShadowRepository(shadowPath,);
  await removeTransactionDirectory(directory,);
}


/**
 Reads the invocation capture record, or the absence marker when the owner died before writing it.

 @param directory - transaction directory

 @returns record or the absence marker
 */
async function readPreparing(directory: string,): Promise<PreparingRecord | typeof PREPARING_ABSENT> {
  /**
   Record path.
   */
  const path = join(
    directory,
    PREPARING_FILENAME,
  );
  if (!(await recoveryPathExists(path,)))
    return PREPARING_ABSENT;
  return parsePreparingRecord(await readRegularRecoveryFile(path,),);
}

/**
 Resolves the common Git directory of the invocation repository.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @returns absolute common directory
 */
async function commonDirectory({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<string> {
  return DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ],
  },)).stdout,)
    .trim();
}

/**
 Recovers one dead-owner transaction.
 A caller recovering a transaction with a landing record must hold the landing lock.

 @param directory - published transaction directory

 @param transactionId - transaction ID

 @param ownerPid - dead owner PID

 @param gitPath - real Git executable

 @param effectiveCwd - owning worktree directory

 @returns recovery action

 @throws {@link CommitTransactionRecoveryError} when evidence is missing, malformed, or contradictory

 @example
 ```ts
 await recoverDeadTransaction({ directory, transactionId, ownerPid, gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverDeadTransaction({
  directory,
  transactionId,
  ownerPid,
  gitPath,
  effectiveCwd,
}: Readonly<{
  directory: string;
  transactionId: string;
  ownerPid: number;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<CommitTransactionRecoveryAction> {
  /**
   Tagged recovery logger.
   */
  const rl = tagged({
    tag: recoverDeadTransaction.name,
    l,
  },);
  /**
   Directory entries.
   */
  const names = await readdir(directory,);
  if (names.includes(UNRELEASED_JOURNAL_FILENAME,))
    throw new CommitTransactionRecoveryError(`Transaction directory uses an unreleased journal format; inspect it before removing it: ${directory}`,);
  /**
   Invocation capture, absent when the owner died first.
   */
  const preparing = await readPreparing(directory,);
  if (preparing === PREPARING_ABSENT) {
    rl.debug(`dead owner stopped before capture: ${directory}`,);
    await removeShadowRepository(shadowRepositoryPath({
      commonDir: await commonDirectory({
        gitPath,
        cwd: effectiveCwd,
      },),
      transactionId,
    },),);
    await removeTransactionDirectory(directory,);
    return 'commit-not-created';
  }
  /**
   Latest landing attempt.
   */
  const latestAttempt = attemptNumbers({
    names,
    prefix: LANDING_RECORD_PREFIX,
  },)
    .at(-1,);
  if (latestAttempt === undefined) {
    await releaseRecordedLocks({
      directory,
      names,
      realIndexPath: preparing.realIndexPath,
      ownerPid,
    },);
    await discardTransaction({
      directory,
      transactionId,
      objectDirectory: preparing.objectDirectory,
      shadowPath: preparing.shadowPath,
    },);
    return 'commit-not-created';
  }
  /**
   Latest landing record.
   */
  const landing = parseLandingRecord(
    await readRegularRecoveryFile(join(
    directory,
    `${LANDING_RECORD_PREFIX}${String(latestAttempt,)}${RECORD_SUFFIX}`,
  ),),
  );
  if ((landing.operation === 'commit') && (!(await commitLanded({
    gitPath,
    cwd: effectiveCwd,
    directory,
    preparing,
    landing,
  },)))) {
    rl.debug(`landing attempt ${String(latestAttempt,)} never advanced ${preparing.targetRef}: ${directory}`,);
    await releaseRecordedLocks({
      directory,
      names,
      realIndexPath: preparing.realIndexPath,
      ownerPid,
    },);
    await discardTransaction({
      directory,
      transactionId,
      objectDirectory: preparing.objectDirectory,
      shadowPath: preparing.shadowPath,
    },);
    return 'commit-not-created';
  }
  if (landing.operation === 'normalize-only') {
    /**
     Target now, which a normalization never moved.
     */
    const current = await resolveRefCommit({
      gitPath,
      cwd: effectiveCwd,
      ref: preparing.targetRef,
    },);
    if ((current.kind
      !== landing.expectedOld
      .kind)
      || ((current.kind === 'commit') && (landing.expectedOld
        .kind
        === 'commit')
        && (current.oid
          !== landing.expectedOld
          .oid)))
      throw new CommitTransactionRecoveryError(`${preparing.targetRef} moved after an interrupted normalization; recovery retained at ${directory}`,);
  }
  await removeTransactionKeeps({
    objectDirectory: preparing.objectDirectory,
    transactionId,
  },);
  /**
   Index completion.
   */
  const action = await completeIndex({
    directory,
    preparing,
    landing,
  },);
  await removeDeadPidFile({
    realIndexPath: preparing.realIndexPath,
    ownerPid,
  },);
  if ((landing.operation === 'commit') && (await pathPresent(preparing.shadowPath,)))
    await reproduceConclusionCleanup({
      gitPath,
      cwd: effectiveCwd,
      gitDir: preparing.gitDir,
      shadowPath: preparing.shadowPath,
      transactionDirectory: directory,
      refFormat: preparing.refFormat,
    },);
  // Completion precedes shadow removal, so a missing shadow means an earlier run already finished the copies;
  // the shadow store still holds originals that never landed, such as a pre-correction worktree blob.
  if (await pathPresent(preparing.shadowPath,))
    await installAddedWorktreeFiles({
      gitPath,
      cwd: effectiveCwd,
      repositoryRoot: preparing.repositoryRoot,
      records: [
        ...landing.addedPaths,
        ...landing.selectedWorktreePaths,
      ],
      objectDirectory: join(
        preparing.shadowPath,
        'objects',
      ),
    },);
  await removeShadowRepository(preparing.shadowPath,);
  await removeTransactionDirectory(directory,);
  return landing.operation === 'normalize-only' ? 'normalization-installed' : action;
}
