/**
 One replay step of the landing loop:
 merge the prepared change onto the target that won,
 report a conflict,
 revalidate,
 and rebuild the commit the next landing attempt lands.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { combineHookChanges, } from './commit-hook-changes.ts';
import type {
  LandingCandidate,
  LandingLoopInput,
  LandingLoopOutcome,
} from './commit-landing-loop-types.ts';
import { migrateShadowObjects, } from './commit-landing-objects.ts';
import { NativeCommitFailedError, } from './commit-preparation-native.ts';
import {
  firstCommitTouching,
  mergeReplayTree,
  replayMergeBase,
  writeReplayedCommit,
} from './commit-replay.ts';
import { subsumeLandedChanges, } from './commit-replay-subsumption.ts';
import {
  type RevalidationContext,
  revalidateReplay,
} from './commit-revalidation.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { loadIndexEntries, } from './commit-transaction-candidate-batch.ts';
import { transactionFailure, } from './commit-transaction-results.ts';
import {
  appendEvents,
  createCommitReplayedEvent,
  createLandingRaceLostEvent,
  createReplayConflictEvent,
  createReplayHeadersDroppedEvent,
} from './events-concurrency.ts';
import { withChangedFixSummary, } from './fix-summary.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Points worktree completions at the blobs a replayed tree holds, dropping paths it no longer holds as ordinary files.

 @param context - invocation facts

 @param indexPath - replayed private index

 @param records - completions before the replay

 @returns completions for the replayed tree
 */
async function retargetRecords({
  context,
  indexPath,
  records,
}: Readonly<{
  context: RevalidationContext;
  indexPath: string;
  records: readonly AddedPathRecord[];
}>,): Promise<readonly AddedPathRecord[]> {
  /**
   Replayed entries of every completion path.
   */
  const entries = await loadIndexEntries({
    gitPath: context.gitPath,
    cwd: context.cwd,
    indexPath,
    paths: records.map(function recordPath(record,): string {
      return record.path;
    },),
  },);
  return records.flatMap(function retarget(record,): readonly AddedPathRecord[] {
    /**
     Replayed entry.
     */
    const entry = entries.get(record.path,);
    return (entry === undefined) || (entry.modeText !== record.gitMode)
      || (entry.stage !== '0')
      ? []
      : [{
        ...record,
        intendedOid: entry.oid,
      },];
  },);
}

/**
 Merges added-path records, a later record replacing an earlier one for the same path.

 @param earlier - earlier records

 @param later - later records

 @returns merged records
 */
function mergeRecords({
  earlier,
  later,
}: Readonly<{
  earlier: readonly AddedPathRecord[];
  later: readonly AddedPathRecord[];
}>,): readonly AddedPathRecord[] {
  return [
    ...earlier.filter(function notReplaced(record,): boolean {
      return !later.some(function samePath(replacement,): boolean {
        return replacement.path === record.path;
      },);
    },),
    ...later,
  ];
}

/**
 Replays after a lost race: merge, conflict handling, revalidation, and the rebuilt commit.

 @param input - loop input

 @param candidate - candidate that lost

 @param onto - target that won

 @returns next candidate, or the loop outcome when nothing can land
 */
async function replayCandidate({
  input,
  candidate,
  onto,
}: Readonly<{
  input: LandingLoopInput;
  candidate: LandingCandidate;
  onto: string;
}>,): Promise<LandingCandidate | LandingLoopOutcome> {
  /**
   Invocation facts.
   */
  const {
    context,
    prepared,
  } = input;
  /**
   Events with this lost race.
   */
  const raced = [
    ...candidate.events,
    createLandingRaceLostEvent({
      sequence: 0,
      attempt: candidate.lostRaces + 1,
      winningOid: onto,
    },),
  ];
  /**
   Merge base under which every path whose prepared bytes already contain the landed change keeps them.
   */
  const subsumption = await subsumeLandedChanges({
    gitPath: context.gitPath,
    shadowPath: context.workspace
      .shadowPath,
    objectDirectory: context.workspace
      .objectDirectory,
    cwd: context.cwd,
    directory: context.workspace
      .directory,
    replay: candidate.lostRaces + 1,
    mergeBase: await replayMergeBase({
      gitPath: context.gitPath,
      shadowPath: context.workspace
        .shadowPath,
      base: context.capture
        .base,
      emptyTreeOid: context.capture
        .emptyTreeOid,
    },),
    current: onto,
    prepared: prepared.oid,
  },);
  l.debug(`replay onto ${onto} keeps the prepared entries of ${JSON.stringify(subsumption.subsumedPaths,)}`,);
  /**
   Clean merge or conflicting paths.
   */
  const merge = await mergeReplayTree({
    gitPath: context.gitPath,
    shadowPath: context.workspace
      .shadowPath,
    mergeBase: subsumption.mergeBase,
    current: onto,
    prepared: prepared.oid,
    worktreeRoot: context.repositoryRoot,
  },);
  if (merge.kind === 'conflict') {
    // Unkept: the prepared commit survives the shadow's removal until gc expires unreachable objects.
    await migrateShadowObjects({
      gitPath: context.gitPath,
      cwd: context.cwd,
      shadowPath: context.workspace
        .shadowPath,
      newOid: prepared.oid,
      oldBase: context.capture
        .base,
    },);
    return {
      kind: 'failed',
      result: {
        ...input.settled,
        events: appendEvents({
          events: input.settled
            .events,
          appended: [
            ...raced,
            createReplayConflictEvent({
              sequence: 0,
              paths: merge.paths,
              winningOid: await firstCommitTouching({
                gitPath: context.gitPath,
                cwd: context.cwd,
                base: context.capture
                  .base,
                current: onto,
                paths: merge.paths,
              },),
              preparedOid: prepared.oid,
              targetRef: context.capture
                .targetRef,
            },),
          ],
        },),
        patches: [],
        exitCode: 1,
        shouldForward: false,
      },
    };
  }
  /**
   Revalidated tree.
   */
  const revalidation = await revalidateReplay({
    context,
    replay: candidate.lostRaces + 1,
    mergedTree: merge.treeOid,
    onto,
    approvedTree: candidate.approvedTree,
  },);
  if (revalidation.kind === 'blocked')
    return {
      kind: 'failed',
      result: {
        ...revalidation.result,
        events: appendEvents({
          events: appendEvents({
            events: input.settled
              .events,
            appended: raced,
          },),
          appended: revalidation.result
            .events,
        },),
      },
    };
  /**
   Commit rebuilt from the prepared commit on the revalidated tree.
   */
  const replayed = await writeReplayedCommit({
    gitPath: context.gitPath,
    shadowPath: context.workspace
      .shadowPath,
    directory: context.workspace
      .directory,
    attempt: candidate.lostRaces + 1,
    commit: prepared.raw,
    treeOid: revalidation.treeOid,
    parentOid: onto,
    globalArgs: context.globalArgs,
    ...(input.options
      .signingKey
      === undefined ? {} : { signingKey: input.options
        .signingKey, }),
  },);
  /**
   Hook changes of preparation and of this revalidation; every replay starts again from the prepared commit.
   */
  const hookChanges = combineHookChanges({
    earlier: input.hookChanges,
    later: revalidation.hookChanges,
  },);
  return {
    newOid: replayed.oid,
    treeOid: revalidation.treeOid,
    expectedOld: {
      kind: 'commit',
      oid: onto,
    },
    indexPath: revalidation.indexPath,
    exactPrivateIndex: false,
    approvedTree: revalidation.treeOid,
    committedPaths: [
      ...new Set([
        ...input.committedPaths,
        ...revalidation.committedPaths,
      ],),
    ],
    addedPaths: mergeRecords({
      earlier: await retargetRecords({
        context,
        indexPath: revalidation.indexPath,
        records: input.addedPaths,
      },),
      later: revalidation.addedPaths,
    },),
    worktreeRecords: [
      ...(await retargetRecords({
        context,
        indexPath: revalidation.indexPath,
        records: input.worktreeRecords,
      },)),
      ...revalidation.hookChanges
        .worktreeRecords,
    ],
    hookChanges,
    events: [
      ...raced,
      createCommitReplayedEvent({
        sequence: 0,
        preparedOid: prepared.oid,
        ...(context.capture
          .base
          .kind
          === 'commit' ? { fromBase: context.capture
            .base
            .oid, } : {}),
        onto,
        oid: replayed.oid,
      },),
      ...(replayed.droppedHeaders
        .length
        === 0 ? [] : [createReplayHeadersDroppedEvent({
          sequence: 0,
          preparedOid: prepared.oid,
          oid: replayed.oid,
          headers: replayed.droppedHeaders,
        },),]),
      ...withChangedFixSummary({
        result: revalidation.pass,
        trigger: 'pre-forward',
        passes: revalidation.changedPasses,
        changedPaths: revalidation.changedPaths,
      },)
        .events,
    ],
    attempt: candidate.attempt + 1,
    lostRaces: candidate.lostRaces + 1,
  };
}

/**
 Replays after a lost race, converting an unexpected replay failure into a transaction failure.

 @param input - loop input

 @param candidate - candidate that lost

 @param onto - target that won

 @returns next candidate or final outcome

 @throws {@link NativeCommitFailedError} when the re-run `pre-commit` rejects the replayed tree

 @example
 ```ts
 const next = await replayOrFail({ input, candidate, onto: winnerOid });
 ```
 */
export async function replayOrFail({
  input,
  candidate,
  onto,
}: Readonly<{
  input: LandingLoopInput;
  candidate: LandingCandidate;
  onto: string;
}>,): Promise<LandingCandidate | LandingLoopOutcome> {
  try {
    return await replayCandidate({
      input,
      candidate,
      onto,
    },);
  }
  catch (error: unknown) {
    if (error instanceof NativeCommitFailedError)
      throw error;
    l.debug(`replay onto ${onto} failed: ${caughtValueText(error,)}`,);
    return {
      kind: 'failed',
      result: transactionFailure({
        previous: input.settled,
        message: `${input.context
          .capture
          .targetRef} moved while this commit was prepared, and replaying it onto ${onto} failed; nothing landed: ${caughtValueText(error,)}`,
      },),
    };
  }
}
