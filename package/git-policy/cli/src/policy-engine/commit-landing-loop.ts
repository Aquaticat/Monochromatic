/**
 The landing loop: land, and after each lost race replay and revalidate outside both locks,
 until the commit lands,
 its replay conflicts,
 revalidation rejects it,
 or the target cannot take it.

 Each replay rebuilds the prepared commit from the preparation base onto the target that won,
 so every replay starts from the same prepared change.
 A reservation after repeated lost races is a later slice;
 it plugs in before each landing attempt,
 where `lostRaces` is known.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  combineHookChanges,
  type HookChanges,
} from './commit-hook-changes.ts';
import { landingFindingResult, } from './commit-landing-findings.ts';
import { migrateShadowObjects, } from './commit-landing-objects.ts';
import {
  type LandingOutcome,
  landTransaction,
} from './commit-landing.ts';
import {
  NativeCommitFailedError,
  type PreparedCommit,
} from './commit-preparation-native.ts';
import {
  firstCommitTouching,
  mergeReplayTree,
  replayMergeBase,
  writeReplayedCommit,
} from './commit-replay.ts';
import type { ReplayOptions, } from './commit-replay-options.ts';
import {
  type RevalidationContext,
  revalidateReplay,
} from './commit-revalidation.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { loadIndexEntries, } from './commit-transaction-candidate-batch.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';
import type { TransactionMode, } from './commit-transaction-journal-states.ts';
import { transactionFailure, } from './commit-transaction-results.ts';
import type { PolicyEvent, } from './events.ts';
import {
  appendEvents,
  createCommitReplayedEvent,
  createLandingRaceLostEvent,
  createReplayConflictEvent,
  createReplayHeadersDroppedEvent,
} from './events-concurrency.ts';
import { withChangedFixSummary, } from './fix-summary.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 What the next landing attempt lands.
 */
type LandingCandidate = Readonly<{
  /**
   Commit to land.
   */
  newOid: string;
  /**
   Its tree.
   */
  treeOid: string;
  /**
   Target value its parent names.
   */
  expectedOld: PreparationBase;
  /**
   Private index holding its tree.
   */
  indexPath: string;
  /**
   Whether that index is the one native preparation committed.
   */
  exactPrivateIndex: boolean;
  /**
   Tree `pre-commit` last approved.
   */
  approvedTree: string;
  /**
   Paths an explicit-path landing resets.
   */
  committedPaths: readonly string[];
  /**
   Policy-added paths.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Selected, corrected, and hook-changed worktree completions.
   */
  worktreeRecords: readonly AddedPathRecord[];
  /**
   Everything commit hooks staged so far.
   */
  hookChanges: HookChanges;
  /**
   Events of lost races, replays, and revalidations so far.
   */
  events: readonly PolicyEvent[];
  /**
   Landing attempt number.
   */
  attempt: number;
  /**
   Lost races so far.
   */
  lostRaces: number;
}>;

/**
 Loop result.
 */
export type LandingLoopOutcome =
  | Readonly<{
    /**
     The commit landed.
     */
    kind: 'landed';
    /**
     Landed commit.
     */
    oid: string;
    /**
     Events to append after the settled preparation pass.
     */
    events: readonly PolicyEvent[];
    /**
     Worktree completions for the landed commit.
     */
    worktreeRecords: readonly AddedPathRecord[];
    /**
     Policy-added paths of the landed commit.
     */
    addedPaths: readonly AddedPathRecord[];
  }>
  | Readonly<{
    /**
     Nothing landed.
     */
    kind: 'failed';
    /**
     Complete blocking result.
     */
    result: PolicyEngineResult;
  }>;

/**
 Inputs of the loop.
 */
export type LandingLoopInput = Readonly<{
  /**
   Invocation facts replay and revalidation reuse.
   */
  context: RevalidationContext;
  /**
   Commit selection mode.
   */
  mode: TransactionMode;
  /**
   Verified prepared commit.
   */
  prepared: PreparedCommit;
  /**
   Settled preparation pass with its fix summary.
   */
  settled: PolicyEngineResult;
  /**
   Replay-relevant commit options.
   */
  options: ReplayOptions;
  /**
   Paths an explicit-path commit carries.
   */
  committedPaths: readonly string[];
  /**
   Policy-added paths.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Worktree completions.
   */
  worktreeRecords: readonly AddedPathRecord[];
  /**
   What preparation hooks staged.
   */
  hookChanges: HookChanges;
  /**
   Backoff budget for a foreign `index.lock`.
   */
  indexLockTimeoutMs: number;
}>;

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
    return (entry === undefined) || (entry.modeText !== record.gitMode) || (entry.stage !== '0')
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
 Result for a landing outcome that landed nothing and cannot replay.

 @param input - loop input

 @param candidate - candidate whose landing failed

 @param outcome - failed outcome

 @returns blocking result
 */
function unreplayableResult({
  input,
  candidate,
  outcome,
}: Readonly<{
  input: LandingLoopInput;
  candidate: LandingCandidate;
  outcome: Exclude<LandingOutcome, Readonly<{ kind: 'landed'; }>>;
}>,): LandingLoopOutcome {
  return {
    kind: 'failed',
    result: landingFindingResult({
      pass: {
        ...input.settled,
        events: appendEvents({
          events: input.settled
            .events,
          appended: candidate.events,
        },),
      },
      outcome,
      capture: input.context
        .capture,
      preparedOid: input.prepared
        .oid,
    },),
  };
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
   Clean merge or conflicting paths.
   */
  const merge = await mergeReplayTree({
    gitPath: context.gitPath,
    shadowPath: context.workspace
      .shadowPath,
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
    ...(input.options.signingKey === undefined ? {} : { signingKey: input.options.signingKey, }),
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
          === 'commit' ? { fromBase: context.capture.base.oid, } : {}),
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
      },).events,
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
 */
async function replayOrFail({
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
        message: `${input.context.capture.targetRef} moved while this commit was prepared, and replaying it onto ${onto} failed; nothing landed: ${caughtValueText(error,)}`,
      },),
    };
  }
}

/**
 Lands a prepared commit, replaying and revalidating after every lost race.

 @param input - loop input

 @returns landed commit or blocking result

 @throws {@link NativeCommitFailedError} when a re-run `pre-commit` rejects a replayed tree

 @example
 ```ts
 await landWithReplay({ context, mode: 'explicit-path', prepared, settled, options, committedPaths, addedPaths, worktreeRecords, hookChanges, indexLockTimeoutMs: 1_000 });
 ```
 */
export async function landWithReplay(input: LandingLoopInput,): Promise<LandingLoopOutcome> {
  /**
   Tagged loop logger.
   */
  const rl = tagged({
    tag: landWithReplay.name,
    l,
  },);
  /**
   Invocation facts.
   */
  const {
    context,
    prepared,
  } = input;
  /**
   Current candidate, replaced after each replay.
   */
  let candidate: LandingCandidate = {
    newOid: prepared.oid,
    treeOid: prepared.treeOid,
    expectedOld: context.capture
      .base,
    indexPath: context.workspace
      .commitIndexPath,
    exactPrivateIndex: true,
    approvedTree: prepared.treeOid,
    committedPaths: input.committedPaths,
    addedPaths: input.addedPaths,
    worktreeRecords: input.worktreeRecords,
    hookChanges: input.hookChanges,
    events: [],
    attempt: 1,
    lostRaces: 0,
  };
  for (;;) {
    /**
     Outcome of this attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each landing attempt follows the replay of the previous lost race.
    const outcome = await landTransaction({
      gitPath: context.gitPath,
      cwd: context.cwd,
      capture: context.capture,
      workspace: context.workspace,
      mode: input.mode,
      payload: {
        operation: 'commit',
        newOid: candidate.newOid,
        landedTreeOid: candidate.treeOid,
        expectedOld: candidate.expectedOld,
        landedIndexPath: candidate.indexPath,
        exactPrivateIndex: candidate.exactPrivateIndex,
        guardedPaths: candidate.hookChanges.paths,
      },
      committedPaths: candidate.committedPaths,
      addedPaths: candidate.addedPaths,
      selectedWorktreePaths: candidate.worktreeRecords,
      indexLockTimeoutMs: input.indexLockTimeoutMs,
      attempt: candidate.attempt,
    },);
    if (outcome.kind === 'landed')
      return {
        kind: 'landed',
        oid: outcome.oid,
        events: candidate.events,
        worktreeRecords: candidate.worktreeRecords,
        addedPaths: candidate.addedPaths,
      };
    if ((outcome.kind === 'branch-switched') || (!outcome.replayable) || (outcome.current.kind !== 'commit'))
      return unreplayableResult({
        input,
        candidate,
        outcome,
      },);
    rl.debug(`lost landing race ${String(candidate.lostRaces + 1,)} to ${outcome.current.oid}`,);
    /**
     Replayed candidate or final outcome.
     */
    // oxlint-disable-next-line no-await-in-loop -- Replay runs between ordered landing attempts.
    const next = await replayOrFail({
      input,
      candidate,
      onto: outcome.current.oid,
    },);
    if ('kind' in next)
      return next;
    candidate = next;
  }
}
