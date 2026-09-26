/**
 A foreign `index.lock` holder that leaves no owner evidence:
 real Git by absolute path without `core.lockfilePid` runs `commit --all` with an editor holding the lock
 longer than `indexLock.unprovenOwnerTimeoutMs`.
 Bystanders either land after the holder finishes or fail with `index-lock-unproven-owner`,
 never with a raw `index.lock` collision.

 @module
 */

import { setTimeout as sleep, } from 'node:timers/promises';

import {
  reached,
  releaseAt,
} from './barrier-fixture.ts';
import { synthesizeText, } from './content-fixture.ts';
import { startForeignCommit, } from './foreign-commit-fixture.ts';
import { extractPolicyEvents, } from './jsonl-event-fixture.ts';
import type { AttemptRecord, } from './ledger-fixture.ts';
import { MAX_JITTER_MS, } from './scenario-concurrent-paths-fixture.ts';
import {
  disjointPlans,
  finishAll,
  repositoryOptions,
  rewritePaths,
  seedTexts,
  startWorkers,
  workerPaths,
} from './scenario-helper-fixture.ts';
import type { ScenarioDefinition, } from './scenario-model-fixture.ts';
import { writeWorktree, } from './worker-fixture.ts';

//region Constants

/**
 Explicit-path agents running beside the holder.
 */
const BYSTANDERS = 3;

/**
 How long the holder keeps `index.lock` after bystanders start, longer than the default 1000 ms budget.
 */
const FOREIGN_HOLD_MS = 1_500;

/**
 Text size of written files.
 */
const FILE_BYTES = 300;

//endregion Constants

//region Expectations

/**
 Describes a bystander that neither landed nor reported the unproven owner.

 @param attempt - finished bystander

 @returns problem, or empty when acceptable
 */
function bystanderProblem(attempt: AttemptRecord,): string {
  if (attempt.outcome
    .exitCode
    === 0)
    return '';
  /**
   Engine failure codes.
   */
  const codes = extractPolicyEvents(attempt.outcome
    .stderr,)
    .events
    .filter(function isFailure(event,): boolean {
      return event.type === 'engine-failure';
    },)
    .map(function codeOf(event,): string {
      return event.code ?? '';
    },);
  return (attempt.outcome
    .exitCode
    === 2) && (codes.join(',',) === 'index-lock-unproven-owner')
    ? ''
    : `${attempt.label} exited ${String(attempt.outcome
      .exitCode,)} with engine failures [${codes.join(', ',)}]`;
}

//endregion Expectations

//region Scenarios

/**
 Foreign holder without owner evidence.
 */
const unprovenForeignLock: ScenarioDefinition = {
  name: 'foreign-index-lock-unproven',
  group: 'concurrency',
  summary: 'real Git by absolute path without core.lockfilePid holds index.lock in its editor for 1.5 s while 3 agents commit',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({
      random,
      paths: [
        ...workerPaths({
          prefix: 'w',
          count: BYSTANDERS,
        },),
        'foreign.txt',
      ],
    },), },);
  },
  async run(context,) {
    await writeWorktree({
      ...context,
      path: 'foreign.txt',
      bytes: synthesizeText({
        random: context.random
          .fork('foreign',),
        size: FILE_BYTES,
      },),
    },);
    /**
     Foreign holder.
     */
    const foreign = await startForeignCommit({
      ...context,
      label: 'foreign',
      paths: ['foreign.txt',],
      lockfilePid: false,
    },);
    /**
     Whether the editor started, so the lock is held.
     */
    const editor = await reached({
      repository: context.repository,
      token: foreign.token,
      running: foreign.running,
      event: 'editor',
    },);
    /**
     Bystander plans, written only after `commit --all` staged its paths.
     */
    const plans = disjointPlans(BYSTANDERS,);
    await rewritePaths({
      context,
      plans,
    },);
    /**
     Bystanders started while the lock is held.
     */
    const bystanders = await startWorkers({
      context,
      plans,
      maxJitterMs: MAX_JITTER_MS,
    },);
    await sleep(FOREIGN_HOLD_MS,);
    await releaseAt({
      repository: context.repository,
      token: foreign.token,
      event: 'editor',
    },);
    /**
     Finished attempts, bystanders first.
     */
    const finished = await finishAll([
      ...bystanders,
      foreign,
    ],);
    /**
     Foreign attempt.
     */
    const foreignRecord = finished.at(-1,);
    /**
     Unacceptable bystander outcomes.
     */
    const problems = finished.slice(
      0,
      -1,
    )
      .map(bystanderProblem,)
      .filter(function nonEmpty(problem,): boolean {
        return problem !== '';
      },);
    return [
      {
        name: 'foreign-holder-started',
        holds: editor === 'marker',
        detail: `editor wait ended with ${editor}`,
      },
      {
        name: 'foreign-commit-succeeds',
        holds: foreignRecord?.outcome
          .exitCode
          === 0,
        detail: `foreign exited ${String(foreignRecord?.outcome
          .exitCode,)}`,
      },
      {
        name: 'bystanders-land-or-report-unproven-owner',
        holds: problems.length === 0,
        detail: problems.join('; ',),
      },
    ];
  },
};

/**
 Unproven foreign-holder scenarios in report order.
 */
export const FOREIGN_UNPROVEN_SCENARIOS: readonly ScenarioDefinition[] = [unprovenForeignLock,];

//endregion Scenarios
