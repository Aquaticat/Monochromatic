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
import { lstat, readdir, readFile, rm, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { removeShadowRepository, } from '../shadow-repository/shadow-repository.ts';
import { reproduceConclusionCleanup, } from '../shadow-repository/shadow-conclusion-state.ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import { installAddedWorktreeFiles, } from './commit-transaction-added-paths.ts';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import {
  resolveRefCommit,
  shadowRepositoryPath,
} from './commit-transaction-capture.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import {
  parseIndexLockRecord,
  parseLandingRecord,
  parsePreparingRecord,
  parseRefUpdatedRecord,
} from './commit-transaction-journal-parse.ts';
import {
  type FileIdentity,
  INDEX_INSTALLED_MARKER_FILENAME,
  type LandingRecord,
  type LockIdentity,
  postIndexFilename,
  PREPARING_FILENAME,
  preLandingIndexFilename,
  type PreparingRecord,
  REF_UPDATED_RECORD_FILENAME,
} from './commit-transaction-journal-states.ts';
import { removeTransactionKeeps, } from './commit-landing-objects.ts';
import { lockPidPath, } from './commit-landing-index-lock.ts';
import { removeTransactionDirectory, } from './commit-transaction-registry.ts';
import {
  installRecoveredIndex,
  readRegularRecoveryFile,
  recoveryPathExists,
  releaseOwnedLock,
} from './commit-transaction-recovery-files.ts';
import { listNonceReflogOids, } from './commit-transaction-recovery-reflog.ts';
import type { CommitTransactionRecoveryAction, } from './commit-transaction-recovery-types.ts';
import {
  CommitTransactionRecoveryError,
  type OwnedLockIdentity,
} from './commit-transaction-recovery-validation.ts';

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
 Record filename prefixes and suffix of numbered attempt records.
 */
const LANDING_RECORD_PREFIX = 'landing-';

/**
 Index lock record filename prefix.
 */
const INDEX_LOCK_RECORD_PREFIX = 'index-lock-';

/**
 Numbered record suffix.
 */
const RECORD_SUFFIX = '.json';

/**
 Legacy prepared journal filename written only by unreleased builds in registry directories.
 */
const UNRELEASED_JOURNAL_FILENAME = 'journal.json';

/**
 Converts a recorded lock identity to the owned-lock shape recovery files check.

 @param lock - recorded identity

 @returns owned-lock identity
 */
function ownedLock(lock: LockIdentity,): OwnedLockIdentity {
  return {
    lockDevice: lock.device,
    lockInode: lock.inode,
    lockFsId: lock.fsId,
  };
}

/**
 Lists attempt numbers of one numbered record kind.

 @param names - transaction directory entries

 @param prefix - record filename prefix

 @returns ascending attempt numbers
 */
function attemptNumbers({
  names,
  prefix,
}: Readonly<{
  names: readonly string[];
  prefix: string;
}>,): readonly number[] {
  return names
    .filter(function isRecord(name,): boolean {
      return name.startsWith(prefix,) && name.endsWith(RECORD_SUFFIX,);
    },)
    .map(function attemptOf(name,): number {
      return Number(name.slice(
        prefix.length,
        -RECORD_SUFFIX.length,
      ),);
    },)
    .filter(function isAttempt(attempt,): boolean {
      return Number.isSafeInteger(attempt,) && (attempt > 0);
    },)
    .toSorted(function ascending(left, right,): number {
      return left - right;
    },);
}

/**
 Reports whether a transaction directory holds a landing record.

 @param directory - transaction directory

 @returns whether any `landing-<n>.json` exists

 @example
 ```ts
 await hasLandingRecord('/repo/.git/cli-git-transactions/id');
 ```
 */
export async function hasLandingRecord(directory: string,): Promise<boolean> {
  return attemptNumbers({
    names: await readdir(directory,),
    prefix: LANDING_RECORD_PREFIX,
  },).length > 0;
}

/**
 Removes the dead owner's PID file beside the real index lock when it still names that owner.

 @param realIndexPath - real index path

 @param ownerPid - dead owner PID
 */
async function removeDeadPidFile({
  realIndexPath,
  ownerPid,
}: Readonly<{
  realIndexPath: string;
  ownerPid: number;
}>,): Promise<void> {
  /**
   Git's PID file path.
   */
  const pidPath = lockPidPath(realIndexPath,);
  try {
    if ((await readFile(pidPath, 'utf8',)) === `pid ${String(ownerPid,)}\n`)
      await rm(pidPath,);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
  }
}

/**
 Releases every real `index.lock` the transaction's lock records prove it created.

 @param directory - transaction directory

 @param names - directory entries

 @param realIndexPath - real index path

 @param ownerPid - dead owner PID
 */
async function releaseRecordedLocks({
  directory,
  names,
  realIndexPath,
  ownerPid,
}: Readonly<{
  directory: string;
  names: readonly string[];
  realIndexPath: string;
  ownerPid: number;
}>,): Promise<void> {
  /**
   Tagged lock release logger.
   */
  const rl = tagged({
    tag: releaseRecordedLocks.name,
    l,
  },);
  for (const attempt of attemptNumbers({
    names,
    prefix: INDEX_LOCK_RECORD_PREFIX,
  },)) {
    /**
     Recorded lock of one attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- Attempts are checked in order against the one lock path.
    const record = parseIndexLockRecord(await readRegularRecoveryFile(join(
      directory,
      `${INDEX_LOCK_RECORD_PREFIX}${String(attempt,)}${RECORD_SUFFIX}`,
    ),),);
    // oxlint-disable-next-line no-await-in-loop -- Attempts are checked in order against the one lock path.
    rl.debug(`attempt ${String(attempt,)} lock ${await releaseOwnedLock({
      journal: ownedLock(record.lock,),
      lockPath: `${realIndexPath}.lock`,
    },)}`,);
  }
  await removeDeadPidFile({
    realIndexPath,
    ownerPid,
  },);
}

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
 */
async function commitLanded({
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
 */
async function completeIndex({
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

/**
 Reports whether a path exists without following a final link.

 @param path - candidate path

 @returns existence
 */
async function pathPresent(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Reads the invocation capture record, or `undefined` when the owner died before writing it.

 @param directory - transaction directory

 @returns record or absence
 */
async function readPreparing(directory: string,): Promise<PreparingRecord | undefined> {
  /**
   Record path.
   */
  const path = join(
    directory,
    PREPARING_FILENAME,
  );
  if (!(await recoveryPathExists(path,)))
    return undefined;
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
  if (preparing === undefined) {
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
  const landing = parseLandingRecord(await readRegularRecoveryFile(join(
    directory,
    `${LANDING_RECORD_PREFIX}${String(latestAttempt,)}${RECORD_SUFFIX}`,
  ),),);
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
    if ((current.kind !== landing.expectedOld.kind)
      || ((current.kind === 'commit') && (landing.expectedOld.kind === 'commit') && (current.oid !== landing.expectedOld.oid)))
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
  await installAddedWorktreeFiles({
    gitPath,
    cwd: effectiveCwd,
    repositoryRoot: preparing.repositoryRoot,
    records: [
      ...landing.addedPaths,
      ...landing.selectedWorktreePaths,
    ],
  },);
  await removeShadowRepository(preparing.shadowPath,);
  await removeTransactionDirectory(directory,);
  return landing.operation === 'normalize-only' ? 'normalization-installed' : action;
}
