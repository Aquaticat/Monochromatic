/**
 Commit transactions stopped at an exact phase, built from the shipped capture, workspace, shadow, preparation, and landing code.

 Every phase leaves exactly the durable artifacts a `SIGKILL` right after it leaves:
 records, snapshots, the shadow repository, the kept pack, the real `index.lock` and its PID file,
 the target ref, and the real index.

 @module
 */
import {
  copyFile,
  lstat,
  open,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  type OwnerIdentity,
  REAL_GIT,
  reassignOwner,
  runFixtureGit,
} from './commit-transaction-recovery-fixture.unit.test.ts';

const {
  baseRevision,
  captureInvocation,
  computeLandingPostIndex,
  createCommitTransactionWorkspace,
  createShadowRepository,
  indexLockRecordFilename,
  JOURNAL_SCHEMA_VERSION,
  landingRecordFilename,
  landingReflogMessage,
  lockPidPath,
  migrateShadowObjects,
  postIndexFilename,
  PREPARED_FILENAME,
  PREPARING_FILENAME,
  preLandingIndexFilename,
  readPreparedCommit,
  REF_UPDATED_RECORD_FILENAME,
  removeTransactionKeeps,
  runNativePreparation,
  transactionKeepMessage,
  writeIndexInstalledMarker,
  writeJournalRecord,
} = internalTestExports;

/**
 Built invocation capture shape.
 */
type InvocationCapture = Awaited<ReturnType<typeof captureInvocation>>;

/**
 Built workspace shape.
 */
type CommitTransactionWorkspace = Awaited<ReturnType<typeof createCommitTransactionWorkspace>>;

/**
 Built prepared commit shape.
 */
type PreparedCommit = Awaited<ReturnType<typeof readPreparedCommit>>;

/**
 Ordered phases a crash can follow.
 */
export const TRANSACTION_PHASES = [
  'published',
  'captured',
  'shadowed',
  'prepared',
  'index-locked',
  'migrated',
  'landing-recorded',
  'swapped',
  'ref-updated',
  'index-installed',
  'marked',
] as const;

/**
 Last phase completed before the crash.
 */
export type TransactionPhase = typeof TRANSACTION_PHASES[number];

/**
 Transaction stopped after one phase.
 */
export type StoppedTransaction = Readonly<{
  /**
   Transaction directory.
   */
  directory: string;
  /**
   Transaction ID.
   */
  transactionId: string;
  /**
   Shadow repository.
   */
  shadowPath: string;
  /**
   Prepared commit; empty before preparation.
   */
  preparedOid: string;
  /**
   Post-index the landing installs; empty before the landing record.
   */
  postIndexPath: string;
}>;

/**
 Reports whether a phase was completed once another was reached.

 @param phase - last completed phase

 @param step - phase asked about

 @returns whether `step` is done
 */
function reached({
  phase,
  step,
}: Readonly<{
  phase: TransactionPhase;
  step: TransactionPhase;
}>,): boolean {
  return TRANSACTION_PHASES.indexOf(phase,) >= TRANSACTION_PHASES.indexOf(step,);
}

/**
 Reads a file's device and inode.

 @param path - file

 @returns identity strings
 */
async function fileIdentity(path: string,): Promise<Readonly<{ device: string; inode: string; }>> {
  /**
   Non-followed metadata.
   */
  const metadata = await lstat(path, { bigint: true, },);
  return { device: String(metadata.dev,), inode: String(metadata.ino,), };
}

/**
 Writes `preparing.json` and the captured and private index copies for an index-mode commit.

 @param capture - invocation capture

 @param workspace - published workspace
 */
async function recordCapture({
  capture,
  workspace,
}: Readonly<{
  capture: InvocationCapture;
  workspace: CommitTransactionWorkspace;
}>,): Promise<void> {
  await writeJournalRecord({
    directory: workspace.directory,
    filename: PREPARING_FILENAME,
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'preparing',
      transactionId: workspace.transactionId,
      mode: 'index',
      base: capture.base,
      symbolicHead: capture.symbolicHead,
      targetRef: capture.targetRef,
      conclusion: capture.conclusion,
      repositoryRoot: capture.repositoryRoot,
      gitDir: capture.gitDir,
      commonDir: capture.commonDir,
      realIndexPath: capture.realIndexPath,
      objectDirectory: capture.objectDirectory,
      refFormat: capture.refFormat,
      emptyTreeOid: capture.emptyTreeOid,
      shadowPath: workspace.shadowPath,
      selectedPathspecs: [],
      invokedAt: capture.invokedAt,
    },
  },);
  await copyFile(capture.realIndexPath, workspace.capturedIndexPath,);
  await copyFile(capture.realIndexPath, workspace.commitIndexPath,);
}

/**
 Runs native `git commit` in the shadow with an empty hooks directory and records `prepared.json`.

 @param repository - repository root

 @param workspace - workspace holding the shadow

 @param message - commit message

 @returns prepared commit
 */
async function prepareCommit({
  repository,
  workspace,
  message,
}: Readonly<{
  repository: string;
  workspace: CommitTransactionWorkspace;
  message: string;
}>,): Promise<PreparedCommit> {
  await runNativePreparation({
    gitPath: REAL_GIT,
    cwd: repository,
    globalArgs: [],
    commitArgs: ['--quiet', '--allow-empty', `--message=${message}`,],
    shadowPath: workspace.shadowPath,
    worktreeRoot: repository,
    hooksDirectory: workspace.hooksDirectory,
    commitIndexPath: workspace.commitIndexPath,
  },);
  /**
   Prepared commit.
   */
  const prepared = await readPreparedCommit({ gitPath: REAL_GIT, shadowPath: workspace.shadowPath, },);
  await writeJournalRecord({
    directory: workspace.directory,
    filename: PREPARED_FILENAME,
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'prepared',
      shadowPath: workspace.shadowPath,
      preparedOid: prepared.oid,
      signed: prepared.signed,
      intendedTreeOid: prepared.treeOid,
      committedPaths: [],
      addedPaths: [],
      selectedWorktreePaths: [],
    },
  },);
  return prepared;
}

/**
 Creates the real `index.lock` exclusively, records it, and writes the owner's PID file, as the landing does.

 @param capture - invocation capture

 @param workspace - transaction workspace

 @param owner - owner whose PID the PID file names

 @returns lock identity
 */
async function lockRealIndex({
  capture,
  workspace,
  owner,
}: Readonly<{
  capture: InvocationCapture;
  workspace: CommitTransactionWorkspace;
  owner: OwnerIdentity;
}>,): Promise<Readonly<{ device: string; inode: string; fsId: string; }>> {
  /**
   Lock path.
   */
  const lockPath = `${capture.realIndexPath}.lock`;
  {
    /**
     Exclusive lock handle, closed as a crash closes it.
     */
    await using _handle = await open(lockPath, 'wx', 0o600,);
  }
  /**
   Created lock identity.
   */
  const lock = {
    ...(await fileIdentity(lockPath,)),
    fsId: (await resolveFsId({ path: lockPath, emitDiagnostics: false, },)).value,
  };
  await writeJournalRecord({
    directory: workspace.directory,
    filename: indexLockRecordFilename(1,),
    record: { schemaVersion: JOURNAL_SCHEMA_VERSION, state: 'index-locked', attempt: 1, lock, },
  },);
  await writeFile(lockPidPath(capture.realIndexPath,), `pid ${String(owner.ownerPid,)}\n`,);
  return lock;
}

/**
 Performs landing steps after the lock up to a phase.

 @param repository - repository root

 @param capture - invocation capture

 @param workspace - transaction workspace

 @param prepared - prepared commit

 @param lock - created lock identity

 @param phase - last completed phase

 @returns post-index path; empty before the landing record
 */
async function landUntil({
  repository,
  capture,
  workspace,
  prepared,
  lock,
  phase,
}: Readonly<{
  repository: string;
  capture: InvocationCapture;
  workspace: CommitTransactionWorkspace;
  prepared: PreparedCommit;
  lock: Readonly<{ device: string; inode: string; fsId: string; }>;
  phase: TransactionPhase;
}>,): Promise<string> {
  if (!reached({ phase, step: 'migrated', },))
    return '';
  /**
   Kept pack holding the prepared objects.
   */
  const packName = await migrateShadowObjects({
    gitPath: REAL_GIT,
    cwd: repository,
    shadowPath: workspace.shadowPath,
    newOid: prepared.oid,
    oldBase: capture.base,
    keepMessage: transactionKeepMessage(workspace.transactionId,),
  },);
  if (!reached({ phase, step: 'landing-recorded', },))
    return '';
  /**
   Pre-landing snapshot.
   */
  const preLanding = join(workspace.directory, preLandingIndexFilename(1,),);
  /**
   Post-index artifact.
   */
  const post = join(workspace.directory, postIndexFilename(1,),);
  await copyFile(capture.realIndexPath, preLanding,);
  await computeLandingPostIndex({
    gitPath: REAL_GIT,
    cwd: repository,
    mode: 'index',
    preLandingIndexPath: preLanding,
    capturedIndexPath: workspace.capturedIndexPath,
    landedIndexPath: workspace.commitIndexPath,
    postIndexPath: post,
    landedTreeOid: prepared.treeOid,
    baseRevision: baseRevision(capture,),
    committedPaths: [],
  },);
  await writeJournalRecord({
    directory: workspace.directory,
    filename: landingRecordFilename(1,),
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'landing',
      attempt: 1,
      operation: 'commit',
      expectedOld: capture.base,
      newOid: prepared.oid,
      landedTreeOid: prepared.treeOid,
      preLandingIndex: await fileIdentity(preLanding,),
      postIndex: await fileIdentity(post,),
      lock,
      packName,
      addedPaths: [],
      selectedWorktreePaths: [],
    },
  },);
  if (!reached({ phase, step: 'swapped', },))
    return post;
  await runFixtureGit({
    repository,
    args: [
      'update-ref',
      '-m',
      await landingReflogMessage({ gitPath: REAL_GIT, cwd: repository, nonce: workspace.transactionId, oid: prepared.oid, },),
      capture.targetRef,
      prepared.oid,
      baseRevision(capture,),
    ],
  },);
  if (!reached({ phase, step: 'ref-updated', },))
    return post;
  await writeJournalRecord({
    directory: workspace.directory,
    filename: REF_UPDATED_RECORD_FILENAME,
    record: { schemaVersion: JOURNAL_SCHEMA_VERSION, state: 'ref-updated', landedOid: prepared.oid, },
  },);
  await removeTransactionKeeps({ objectDirectory: capture.objectDirectory, transactionId: workspace.transactionId, },);
  if (!reached({ phase, step: 'index-installed', },))
    return post;
  await copyFile(post, capture.realIndexPath,);
  await rm(`${capture.realIndexPath}.lock`,);
  await rm(lockPidPath(capture.realIndexPath,),);
  if (reached({ phase, step: 'marked', },))
    await writeIndexInstalledMarker(workspace.directory,);
  return post;
}

/**
 Runs one index-mode commit transaction and stops after a phase, owned by `owner` created at `createdAt`.

 @param repository - repository root

 @param phase - last completed phase

 @param message - commit message

 @param owner - recorded owner; a dead one models a crash

 @param createdAt - recorded creation time ordering recovery

 @returns stopped transaction

 @example
 ```ts
 await stopTransaction({ repository, phase: 'prepared', message: 'x', owner: await exitedProcessIdentity(), createdAt: '2026-01-01T00:00:01.000Z' });
 ```
 */
export async function stopTransaction({
  repository,
  phase,
  message,
  owner,
  createdAt,
}: Readonly<{
  repository: string;
  phase: TransactionPhase;
  message: string;
  owner: OwnerIdentity;
  createdAt: string;
}>,): Promise<StoppedTransaction> {
  /**
   Invocation capture.
   */
  const capture = await captureInvocation({ gitPath: REAL_GIT, cwd: repository, amend: false, },);
  /**
   Published workspace, handed to recovery rather than disposed.
   */
  const workspace = await createCommitTransactionWorkspace({ capture, },);
  workspace.preserveForRecovery();
  await reassignOwner({ directory: workspace.directory, owner, createdAt, },);
  /**
   Stopped transaction before preparation.
   */
  const stopped = {
    directory: workspace.directory,
    transactionId: workspace.transactionId,
    shadowPath: workspace.shadowPath,
    preparedOid: '',
    postIndexPath: '',
  };
  if (reached({ phase, step: 'captured', },))
    await recordCapture({ capture, workspace, },);
  if (reached({ phase, step: 'shadowed', },)) {
    await createShadowRepository({
      gitPath: REAL_GIT,
      cwd: repository,
      capture,
      transactionId: workspace.transactionId,
      transactionDirectory: workspace.directory,
    },);
  }
  if (!reached({ phase, step: 'prepared', },))
    return stopped;
  /**
   Prepared commit.
   */
  const prepared = await prepareCommit({ repository, workspace, message, },);
  if (!reached({ phase, step: 'index-locked', },))
    return { ...stopped, preparedOid: prepared.oid, };
  return {
    ...stopped,
    preparedOid: prepared.oid,
    postIndexPath: await landUntil({
      repository,
      capture,
      workspace,
      prepared,
      lock: await lockRealIndex({ capture, workspace, owner, },),
      phase,
    },),
  };
}
