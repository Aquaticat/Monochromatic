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
 A moved target fails fast here;
 replay is the next slice's seam (`LandingOutcome` kind `head-moved` with `replayable`).

 @module
 */
import { lstat, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { reproduceConclusionCleanup, } from '../shadow-repository/shadow-conclusion-state.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import {
  baseRevision,
  type InvocationCapture,
  type PreparationBase,
  resolveRefCommit,
  resolveSymbolicHead,
  type SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
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
import { acquireRealIndexLock, } from './commit-landing-index-lock.ts';
import {
  migrateShadowObjects,
  removePackKeep,
  transactionKeepMessage,
} from './commit-landing-objects.ts';
import { copyIndexFile, } from './index-file-timestamps.ts';

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
     Whether replay could land this commit once replay exists; amends and conclusions never replay.
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
     Prepared tree.
     */
    landedTreeOid: string;
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
 Reports whether two target values are equal.

 @param left - first value

 @param right - second value

 @returns equality
 */
function sameTarget({
  left,
  right,
}: Readonly<{
  left: PreparationBase;
  right: PreparationBase;
}>,): boolean {
  if ((left.kind === 'unborn') || (right.kind === 'unborn'))
    return left.kind === right.kind;
  return left.oid === right.oid;
}

/**
 Reads a file's device and inode.

 @param path - file path

 @returns identity
 */
async function fileIdentity(path: string,): Promise<FileIdentity> {
  /**
   Non-followed metadata.
   */
  const metadata = await lstat(
    path,
    { bigint: true, },
  );
  return {
    device: String(metadata.dev,),
    inode: String(metadata.ino,),
  };
}

/**
 Builds the nonce-bearing reflog message.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param nonce - transaction ID

 @param oid - landed commit

 @returns `commit (cli-git <nonce>): <subject>`

 @example
 ```ts
 await landingReflogMessage({ gitPath: '/usr/bin/git', cwd: '/repo', nonce, oid });
 ```
 */
export async function landingReflogMessage({
  gitPath,
  cwd,
  nonce,
  oid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  nonce: string;
  oid: string;
}>,): Promise<string> {
  /**
   Commit subject.
   */
  const subject = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'show',
      '--no-patch',
      '--format=%s',
      oid,
    ],
  },)).stdout,)
    .trim();
  return `${landingReflogPrefix(nonce,)} ${subject}`;
}

/**
 Reflog subject prefix carrying the transaction nonce.

 @param nonce - transaction ID

 @returns prefix before the subject

 @example
 ```ts
 landingReflogPrefix(id); // 'commit (cli-git <id>):'
 ```
 */
export function landingReflogPrefix(nonce: string,): string {
  return `commit (cli-git ${nonce}):`;
}

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
}>,): Promise<LandingOutcome> {
  /**
   Tagged landing logger.
   */
  const rl = tagged({
    tag: landTransaction.name,
    l,
  },);
  await using _landingLock = await acquireLandingLock({
    gitPath,
    cwd,
    registryRoot: capture.registryRoot,
  },);
  await using indexLock = await acquireRealIndexLock({
    realIndexPath: capture.realIndexPath,
    transactionDirectory: workspace.directory,
    attempt,
    timeoutMs: indexLockTimeoutMs,
  },);
  /**
   Symbolic `HEAD` target now.
   */
  const symbolicHead = await resolveSymbolicHead({
    gitPath,
    cwd,
  },);
  if ((symbolicHead.kind !== capture.symbolicHead.kind)
    || ((symbolicHead.kind === 'branch') && (capture.symbolicHead.kind === 'branch') && (symbolicHead.ref !== capture.symbolicHead.ref))) {
    rl.debug('HEAD names another target than at invocation',);
    return {
      kind: 'branch-switched',
      current: symbolicHead,
    };
  }
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
    right: capture.base,
  },)) {
    rl.debug(`${capture.targetRef} moved since preparation`,);
    return {
      kind: 'head-moved',
      current,
      replayable: (payload.operation === 'commit') && (capture.conclusion === 'none'),
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
      oldBase: capture.base,
      keepMessage: transactionKeepMessage(workspace.transactionId,),
    },)
    : undefined;
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
    landedIndexPath: workspace.commitIndexPath,
    postIndexPath,
    landedTreeOid: payload.landedTreeOid,
    baseRevision: baseRevision(capture,),
    committedPaths,
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
      expectedOld: capture.base,
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
    const swap = await runTransactionGit({
      gitPath,
      cwd,
      args: [
        'update-ref',
        '-m',
        await landingReflogMessage({
          gitPath,
          cwd,
          nonce: workspace.transactionId,
          oid: payload.newOid,
        },),
        ...(capture.symbolicHead.kind === 'detached' ? ['--no-deref',] : []),
        capture.targetRef,
        payload.newOid,
        capture.base.kind === 'commit' ? capture.base.oid : '0'.repeat(capture.emptyTreeOid.length,),
      ],
      allowFailure: true,
    },);
    if (swap.exitCode !== 0) {
      rl.debug(`compare-and-swap lost: ${swap.stderr.trim()}`,);
      await removePackKeep({
        objectDirectory: capture.objectDirectory,
        packName: packName ?? '',
      },);
      workspace.finishTransaction();
      return {
        kind: 'head-moved',
        current: await resolveRefCommit({
          gitPath,
          cwd,
          ref: capture.targetRef,
        },),
        replayable: capture.conclusion === 'none',
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
    await removePackKeep({
      objectDirectory: capture.objectDirectory,
      packName: packName ?? '',
    },);
  }
  await indexLock.installIndex(postIndexPath,);
  await writeIndexInstalledMarker(workspace.directory,);
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
      : (capture.base.kind === 'commit' ? capture.base.oid : ''),
  };
}
