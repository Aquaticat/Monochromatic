/**
 Landed-or-not decision and index completion for a dead transaction's landing record.

 @module
 */
import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import { parseRefUpdatedRecord, } from './commit-transaction-journal-parse.ts';
import {
  type FileIdentity,
  INDEX_INSTALLED_MARKER_FILENAME,
  type LandingRecord,
  postIndexFilename,
  preLandingIndexFilename,
  type PreparingRecord,
  REF_UPDATED_RECORD_FILENAME,
} from './commit-transaction-journal-states.ts';
import { ownedLock, } from './commit-transaction-recovery-evidence.ts';
import {
  installRecoveredIndex,
  readRegularRecoveryFile,
  recoveryPathExists,
  releaseOwnedLock,
} from './commit-transaction-recovery-files.ts';
import { listNonceReflogOids, } from './commit-transaction-recovery-reflog.ts';
import type { CommitTransactionRecoveryAction, } from './commit-transaction-recovery-types.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Proves an artifact still has its recorded identity and pins it under a stable name.

 @param directory - transaction directory

 @param filename - artifact filename

 @param identity - recorded identity

 @returns stable link path
 */
async function stabilizeArtifact({
  directory,
  filename,
  identity,
}: Readonly<{
  directory: string;
  filename: string;
  identity: FileIdentity;
}>,): Promise<string> {
  /**
   Stable owner-preserving link.
   */
  const stablePath = join(
    directory,
    `${filename}.recovery`,
  );
  await rm(
    stablePath,
    { force: true, },
  );
  await createOwnedFileLink({
    sourcePath: join(
      directory,
      filename,
    ),
    linkedPath: stablePath,
    expectedDevice: identity.device,
    expectedInode: identity.inode,
  },);
  return stablePath;
}


/**
 Decides whether a commit landing record's attempt landed.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param directory - transaction directory

 @param preparing - invocation capture record

 @param landing - latest landing record

 @returns whether the commit landed

 @throws {@link CommitTransactionRecoveryError} when evidence is missing or contradictory

 @example
 ```ts
 await commitLanded({ gitPath: '/usr/bin/git', cwd: '/repo', directory, preparing, landing });
 ```
 */
export async function commitLanded({
  gitPath,
  cwd,
  directory,
  preparing,
  landing,
}: Readonly<{
  gitPath: string;
  cwd: string;
  directory: string;
  preparing: PreparingRecord;
  landing: LandingRecord;
}>,): Promise<boolean> {
  /**
   Durable landed marker path.
   */
  const markerPath = join(
    directory,
    REF_UPDATED_RECORD_FILENAME,
  );
  if (await recoveryPathExists(markerPath,)) {
    /**
     Marker contents.
     */
    const marker = parseRefUpdatedRecord(await readRegularRecoveryFile(markerPath,),);
    if (marker.landedOid !== landing.newOid)
      throw new CommitTransactionRecoveryError(`Landed marker names another commit than the landing record: ${directory}`,);
    return true;
  }
  /**
   Commits the target reflog's nonce entries name.
   */
  const nonceOids = await listNonceReflogOids({
    gitPath,
    cwd,
    ref: preparing.targetRef,
    subjectPrefix: `commit (cli-git ${preparing.transactionId}):`,
  },);
  if (nonceOids.length > 1)
    throw new CommitTransactionRecoveryError(`${preparing.targetRef} reflog names several commits for transaction ${preparing.transactionId}; recovery retained at ${directory}`,);
  if (nonceOids[0] !== undefined) {
    if (nonceOids[0] !== landing.newOid)
      throw new CommitTransactionRecoveryError(`${preparing.targetRef} reflog nonce names ${nonceOids[0]}, not the recorded ${String(landing.newOid,)}; recovery retained at ${directory}`,);
    return true;
  }
  /**
   Whether the recorded commit is reachable from the target anyway.
   */
  const reachable = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'merge-base',
      '--is-ancestor',
      String(landing.newOid,),
      preparing.targetRef,
    ],
    allowFailure: true,
  },);
  if (reachable.exitCode === 0)
    throw new CommitTransactionRecoveryError(`${preparing.targetRef} contains the transaction commit ${String(landing.newOid,)} but its reflog lacks the nonce entry; recovery retained at ${directory}`,);
  return false;
}

/**
 Installs or confirms the recorded post-index after a landing.

 @param directory - transaction directory

 @param preparing - invocation capture record

 @param landing - latest landing record

 @returns recovery action for the index

 @example
 ```ts
 await completeIndex({ directory, preparing, landing });
 ```
 */
export async function completeIndex({
  directory,
  preparing,
  landing,
}: Readonly<{
  directory: string;
  preparing: PreparingRecord;
  landing: LandingRecord;
}>,): Promise<CommitTransactionRecoveryAction> {
  /**
   Stable pre-landing snapshot.
   */
  const preLanding = await stabilizeArtifact({
    directory,
    filename: preLandingIndexFilename(landing.attempt,),
    identity: landing.preLandingIndex,
  },);
  /**
   Stable post-index.
   */
  const post = await stabilizeArtifact({
    directory,
    filename: postIndexFilename(landing.attempt,),
    identity: landing.postIndex,
  },);
  /**
   Lock path.
   */
  const lockPath = `${preparing.realIndexPath}.lock`;
  if ((await recoveryPathExists(join(
    directory,
    INDEX_INSTALLED_MARKER_FILENAME,
  ),)) || (await snapshotFilesEqual({
    leftPath: post,
    rightPath: preparing.realIndexPath,
  },))) {
    await releaseOwnedLock({
      journal: ownedLock(landing.lock,),
      lockPath,
    },);
    return 'already-installed';
  }
  if (!(await snapshotFilesEqual({
    leftPath: preLanding,
    rightPath: preparing.realIndexPath,
  },)))
    throw new CommitTransactionRecoveryError(`Real index no longer matches the pre-landing snapshot; recovery retained at ${directory}`,);
  await installRecoveredIndex({
    lockPath,
    realIndexPath: preparing.realIndexPath,
    postIndexPath: post,
    journal: ownedLock(landing.lock,),
  },);
  return 'index-installed';
}
