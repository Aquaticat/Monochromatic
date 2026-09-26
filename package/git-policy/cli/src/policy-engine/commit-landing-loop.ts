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
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { landingFindingResult, } from './commit-landing-findings.ts';
import type {
  LandingCandidate,
  LandingLoopInput,
  LandingLoopOutcome,
} from './commit-landing-loop-types.ts';
import { replayOrFail, } from './commit-landing-replay-step.ts';
import {
  type LandingOutcome,
  landTransaction,
} from './commit-landing.ts';
import { appendEvents, } from './events-concurrency.ts';

export type {
  LandingLoopInput,
  LandingLoopOutcome,
} from './commit-landing-loop-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

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
  // The candidate is replaced after each replay; it lives only inside the loop.
  for (let candidate: LandingCandidate = {
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
  };;) {
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
        guardedPaths: candidate.hookChanges
          .paths,
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
    if ((outcome.kind === 'branch-switched') || (!outcome.replayable)
      || (outcome.current
        .kind
        !== 'commit'))
      return unreplayableResult({
        input,
        candidate,
        outcome,
      },);
    rl.debug(`lost landing race ${String(candidate.lostRaces + 1,)} to ${outcome.current
      .oid}`,);
    /**
     Replayed candidate or final outcome.
     */
    // oxlint-disable-next-line no-await-in-loop -- Replay runs between ordered landing attempts.
    const next = await replayOrFail({
      input,
      candidate,
      onto: outcome.current
        .oid,
    },);
    if ('kind' in next)
      return next;
    candidate = next;
  }
}
