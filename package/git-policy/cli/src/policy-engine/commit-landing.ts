/**
 Landing critical section: serial under the landing lock and the real `index.lock`.

 A landing checks the branch and the target ref,
 migrates the prepared commit's objects into a kept pack,
 computes the real index against the current real index,
 journals the attempt,
 advances the target by compare-and-swap in the owning worktree's context,
 installs the index,
 and reproduces native conclusion cleanup.
 It never runs hooks,
 the editor,
 signing,
 network operations,
 or the hook lock.
 A moved target ends the attempt with `head-moved`;
 when `replayable`,
 the caller replays and revalidates outside both locks and lands again (`commit-landing-loop.ts`).

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { reproduceConclusionCleanup, } from '../shadow-repository/shadow-conclusion-cleanup.ts';
import { recordLandedCaptureOrWarn, } from './commit-capture-order-records.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import {
  baseRevision,
  type InvocationCapture,
  type PreparationBase,
  type SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import {
  resolveRefCommit,
  resolveSymbolicHead,
} from './commit-transaction-capture-refs.ts';
import {
  type FileIdentity,
  JOURNAL_SCHEMA_VERSION,
  landingRecordFilename,
  postIndexFilename,
  preLandingIndexFilename,
  REF_UPDATED_RECORD_FILENAME,
  type TransactionMode,
  writeIndexInstalledMarker,
  writeJournalRecord,
} from './commit-transaction-journal-states.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { computeLandingPostIndex, } from './commit-landing-index.ts';
import { acquireLandingLock, } from './commit-landing-lock.ts';
import {
  acquireReservedLandingLock,
  type LandingReservation,
} from './commit-landing-reservation.ts';
import { acquireRealIndexLock, } from './commit-landing-index-lock.ts';
import {
  migrateShadowObjects,
  removePackKeep,
  transactionKeepMessage,
} from './commit-landing-objects.ts';
import { reachTransactionPhase, } from './commit-transaction-test-phase.ts';
import { copyIndexFile, } from './index-file-timestamps.ts';
import {
  compareAndSwapTarget,
  expectedOldTarget,
  fileIdentity,
  sameTarget,
} from './commit-landing-support.ts';

export {
  landingReflogMessage,
  landingReflogPrefix,
} from './commit-landing-support.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Result of one landing attempt.
 */
export type LandingOutcome =
  | Readonly<{
    /**
     The target advanced, or a normalization installed its index.
     */
    kind: 'landed';
    /**
     Landed commit; the base for a normalization.
     */
    oid: string;
  }>
  | Readonly<{
    /**
     The target moved since preparation; nothing landed.
     */
    kind: 'head-moved';
    /**
     Target value that won.
     */
    current: PreparationBase;
    /**
     Whether replay can land this commit on the new target; amends, conclusions, normalizations, and a deleted target never replay.
     */
    replayable: boolean;
  }>
  | Readonly<{
    /**
     `HEAD` names another branch or detached state than at invocation; nothing landed.
     */
    kind: 'branch-switched';
    /**
     Current symbolic `HEAD` target.
     */
    current: SymbolicHeadTarget;
  }>;

/**
 What one landing installs.
 */
export type LandingPayload =
  | Readonly<{
    /**
     A prepared commit.
     */
    operation: 'commit';
    /**
     Prepared commit.
     */
    newOid: string;
    /**
     Prepared or replayed tree.
     */
    landedTreeOid: string;
    /**
     Target value the commit's parent names: the preparation base, or the replay parent.
     */
    expectedOld: PreparationBase;
    /**
     Private index the commit's tree came from.
     */
    landedIndexPath: string;
    /**
     Whether `landedIndexPath` is the exact index native preparation committed, false after a replay.
     */
    exactPrivateIndex: boolean;
    /**
     Paths a commit hook changed, reconciled only while their real index entry is unchanged since invocation.
     */
    guardedPaths: readonly string[];
  }>
  | Readonly<{
    /**
     A normalization whose settled tree equals the base.
     */
    operation: 'normalize-only';
    /**
     Base tree the index settles to.
     */
    landedTreeOid: string;
  }>;

/**
 Runs one landing attempt.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param capture - invocation capture

 @param workspace - transaction workspace

 @param mode - commit selection mode

 @param payload - commit or normalization to land

 @param committedPaths - paths an explicit-path commit carries

 @param addedPaths - policy-added path records

 @param selectedWorktreePaths - selected newline correction records

 @param indexLockTimeoutMs - backoff budget for a foreign `index.lock`

 @param attempt - landing attempt number

 @param reservation - landing reservation the attempt yields to; absent for a landing that never waits for one, such as a normalization

 @returns outcome

 @example
 ```ts
 await landTransaction({ gitPath: '/usr/bin/git', cwd: '/repo', capture, workspace, mode: 'index', payload, committedPaths: [], addedPaths: [], selectedWorktreePaths: [], indexLockTimeoutMs: 1_000, attempt: 1 });
 ```
 */
export async function landTransaction({
  gitPath,
  cwd,
  capture,
  workspace,
  mode,
  payload,
  committedPaths,
  addedPaths,
  selectedWorktreePaths,
  indexLockTimeoutMs,
  attempt,
  reservation,
}: Readonly<{
  gitPath: string;
  cwd: string;
  capture: InvocationCapture;
  workspace: CommitTransactionWorkspace;
  mode: TransactionMode;
  payload: LandingPayload;
  committedPaths: readonly string[];
  addedPaths: readonly AddedPathRecord[];
  selectedWorktreePaths: readonly AddedPathRecord[];
  indexLockTimeoutMs: number;
  attempt: number;
  reservation?: Pick<LandingReservation, 'awaitSlot' | 'heldByAnother'>;
}>,): Promise<LandingOutcome> {
  /**
   Tagged landing logger.
   */
  const rl = tagged({
    tag: landTransaction.name,
    l,
  },);
  /**
   Landing lock, held until the attempt returns.
   */
  await using _landingLock = reservation === undefined
    ? await acquireLandingLock({
      gitPath,
      cwd,
      registryRoot: capture.registryRoot,
    },)
    : await acquireReservedLandingLock({
      gitPath,
      cwd,
      registryRoot: capture.registryRoot,
      reservation,
    },);
  /**
   Real `index.lock`, consumed by the install or released when the attempt lands nothing.
   */
  await using indexLock = await acquireRealIndexLock({
    realIndexPath: capture.realIndexPath,
    transactionDirectory: workspace.directory,
    attempt,
    timeoutMs: indexLockTimeoutMs,
  },);
  await reachTransactionPhase({ phase: 'landing-locked', },);
  /**
   Symbolic `HEAD` target now.
   */
  const symbolicHead = await resolveSymbolicHead({
    gitPath,
    cwd,
  },);
  if ((symbolicHead.kind
    !== capture.symbolicHead
    .kind)
    || ((symbolicHead.kind === 'branch') && (capture.symbolicHead
      .kind
      === 'branch')
      && (symbolicHead.ref
        !== capture.symbolicHead
        .ref))) {
    rl.debug('HEAD names another target than at invocation',);
    return {
      kind: 'branch-switched',
      current: symbolicHead,
    };
  }
  /**
   Target value the commit's parent names.
   */
  const expectedOld = expectedOldTarget({
    payload,
    capture,
  },);
  /**
   Target value now.
   */
  const current = await resolveRefCommit({
    gitPath,
    cwd,
    ref: capture.targetRef,
  },);
  if (!sameTarget({
    left: current,
    right: expectedOld,
  },)) {
    rl.debug(`${capture.targetRef} moved since preparation`,);
    return {
      kind: 'head-moved',
      current,
      replayable: (payload.operation === 'commit') && (capture.conclusion === 'none')
        && (current.kind === 'commit'),
    };
  }
  /**
   Migrated pack, kept until the compare-and-swap settles.
   */
  const packName = payload.operation === 'commit'
    ? await migrateShadowObjects({
      gitPath,
      cwd,
      shadowPath: workspace.shadowPath,
      newOid: payload.newOid,
      oldBase: expectedOld,
      keepMessage: transactionKeepMessage(workspace.transactionId,),
    },)
    : undefined;
  await reachTransactionPhase({ phase: 'objects-migrated', },);
  /**
   Exact pre-landing real index snapshot.
   */
  const preLandingIndexPath = join(
    workspace.directory,
    preLandingIndexFilename(attempt,),
  );
  /**
   Post-index artifact.
   */
  const postIndexPath = join(
    workspace.directory,
    postIndexFilename(attempt,),
  );
  await copyIndexFile({
    sourcePath: capture.realIndexPath,
    destinationPath: preLandingIndexPath,
  },);
  await computeLandingPostIndex({
    gitPath,
    cwd,
    mode,
    preLandingIndexPath,
    capturedIndexPath: workspace.capturedIndexPath,
    postIndexPath,
    landedTreeOid: payload.landedTreeOid,
    baseRevision: baseRevision(capture,),
    committedPaths,
    ...(payload.operation === 'commit'
      ? {
        landedIndexPath: payload.landedIndexPath,
        exactPrivateIndex: payload.exactPrivateIndex,
        guardedPaths: payload.guardedPaths,
      }
      : { landedIndexPath: workspace.commitIndexPath, }),
  },);
  workspace.preserveForRecovery();
  await writeJournalRecord({
    directory: workspace.directory,
    filename: landingRecordFilename(attempt,),
    record: {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      state: 'landing',
      attempt,
      operation: payload.operation,
      expectedOld,
      ...(payload.operation === 'commit' ? { newOid: payload.newOid, } : {}),
      landedTreeOid: payload.landedTreeOid,
      preLandingIndex: await fileIdentity(preLandingIndexPath,),
      postIndex: await fileIdentity(postIndexPath,),
      lock: indexLock.identity,
      ...(packName === undefined ? {} : { packName, }),
      addedPaths,
      selectedWorktreePaths,
    },
  },);
  if (payload.operation === 'commit') {
    /**
     Compare-and-swap in the owning worktree's context, which also writes the real `HEAD` reflog.
     */
    const swap = await compareAndSwapTarget({
      gitPath,
      cwd,
      capture,
      transactionId: workspace.transactionId,
      newOid: payload.newOid,
      expectedOld,
    },);
    if (swap.exitCode !== 0) {
      rl.debug(`compare-and-swap lost: ${swap.stderr
        .trim()}`,);
      await removePackKeep({
        objectDirectory: capture.objectDirectory,
        packName: packName ?? '',
      },);
      workspace.finishTransaction();
      /**
       Target value that won the compare-and-swap.
       */
      const winner = await resolveRefCommit({
        gitPath,
        cwd,
        ref: capture.targetRef,
      },);
      return {
        kind: 'head-moved',
        current: winner,
        replayable: (capture.conclusion === 'none') && (winner.kind === 'commit'),
      };
    }
    await writeJournalRecord({
      directory: workspace.directory,
      filename: REF_UPDATED_RECORD_FILENAME,
      record: {
        schemaVersion: JOURNAL_SCHEMA_VERSION,
        state: 'ref-updated',
        landedOid: payload.newOid,
      },
    },);
    await reachTransactionPhase({ phase: 'ref-updated', },);
    await removePackKeep({
      objectDirectory: capture.objectDirectory,
      packName: packName ?? '',
    },);
    await recordLandedCaptureOrWarn({
      gitDir: capture.gitDir,
      transactionDirectory: workspace.directory,
      transactionId: workspace.transactionId,
      landedOid: payload.newOid,
    },);
  }
  await indexLock.installIndex(postIndexPath,);
  await writeIndexInstalledMarker(workspace.directory,);
  await reachTransactionPhase({ phase: 'index-installed', },);
  if (payload.operation === 'commit')
    await reproduceConclusionCleanup({
      gitPath,
      cwd,
      gitDir: capture.gitDir,
      shadowPath: workspace.shadowPath,
      transactionDirectory: workspace.directory,
      refFormat: capture.refFormat,
    },);
  rl.debug(`landed ${payload.operation} attempt ${String(attempt,)}`,);
  return {
    kind: 'landed',
    oid: payload.operation === 'commit'
      ? payload.newOid
      : (capture.base
        .kind
        === 'commit' ? capture.base
          .oid : ''),
  };
}
