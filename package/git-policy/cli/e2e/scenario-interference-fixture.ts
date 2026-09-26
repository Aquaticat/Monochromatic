/**
 Scenarios where other Git activity interferes with in-flight commits:
 amend attempts,
 branch switches,
 a foreign `index.lock` holder,
 and `gc --prune=now`.

 @module
 */

import { setTimeout as sleep, } from 'node:timers/promises';

import { synthesizeText, } from './content-fixture.ts';
import {
  amendReplacedBase,
  commitAmendBase,
} from './scenario-baseline-fixture.ts';
import {
  finishAll,
  repositoryOptions,
  rewritePaths,
  seedTexts,
  startWorkers,
  workerPaths,
} from './scenario-helper-fixture.ts';
import {
  allSucceeded,
  type ScenarioDefinition,
} from './scenario-model-fixture.ts';
import { realGit, } from './repository-fixture.ts';
import {
  holdAt,
  reached,
  releaseAt,
  runWrapper,
  startAttempt,
  startForeignCommit,
  writeWorktree,
} from './worker-fixture.ts';

//region Constants

/**
 Explicit-path agents running beside the interfering activity.
 */
const BYSTANDERS = 3;

/**
 Largest bystander start offset.
 */
const MAX_JITTER_MS = 40;

/**
 How long the foreign holder keeps `index.lock` after bystanders start.
 */
const FOREIGN_HOLD_MS = 1500;

/**
 Bystander plans.
 */
const BYSTANDER_PLANS = workerPaths({ prefix: 'w', count: BYSTANDERS, },).map(function plan(path, index,) {
  return { label: `w${String(index,)}`, paths: [path,], };
},);

//endregion Constants

//region Scenarios

/**
 Amend racing concurrent commits.
 */
const amendDuringCommits: ScenarioDefinition = {
  name: 'amend-during-commits',
  group: 'concurrency',
  summary: 'one agent amends while 3 agents commit; the amend may land only if HEAD did not move',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: [...workerPaths({ prefix: 'w', count: BYSTANDERS, },), 'amend.txt',], },), },);
  },
  async run(context,) {
    /**
     Token-free setup commit the amend targets.
     */
    const { parent, } = await commitAmendBase({ context, path: 'amend.txt', },);
    await rewritePaths({ context, plans: BYSTANDER_PLANS, },);
    await writeWorktree({ ...context, path: 'amend.txt', bytes: synthesizeText({ random: context.random.fork('amend',), size: 300, },), },);
    /**
     Bystanders and the amend started together.
     */
    const [bystanders, amend,] = await Promise.all([
      startWorkers({ context, plans: BYSTANDER_PLANS, maxJitterMs: MAX_JITTER_MS, },),
      startAttempt({ ...context, label: 'amend', paths: ['amend.txt',], mode: 'amend', },),
    ],);
    /**
     Finished bystanders.
     */
    const finished = await finishAll(bystanders,);
    return [
      allSucceeded({ name: 'bystanders-succeed', attempts: finished, },),
      await amendReplacedBase({ context, amend: await amend.finished, parent, },),
    ];
  },
};

/**
 Branch switch while a commit prepares.
 */
const branchSwitch: ScenarioDefinition = {
  name: 'branch-switch-during-commit',
  group: 'concurrency',
  summary: 'git switch to another branch while a commit is held in pre-commit; the commit must not land on the new branch',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['a.txt',], },), hooks: 'hookdir', hookEvents: ['pre-commit',], },);
  },
  async run(context,) {
    await realGit({ repository: context.repository, args: ['branch', 'side',], },);
    await realGit({ repository: context.repository, args: ['push', '--quiet', '--set-upstream', 'origin', 'side',], },);
    await writeWorktree({ ...context, path: 'a.txt', bytes: synthesizeText({ random: context.random.fork('a',), size: 300, },), },);
    /**
     Commit held while the switch runs.
     */
    const held = await startAttempt({ ...context, label: 'held', paths: ['a.txt',], mode: 'explicit', },);
    await holdAt({ repository: context.repository, token: held.token, event: 'pre-commit', },);
    await reached({ repository: context.repository, token: held.token, running: held.running, event: 'pre-commit', },);
    /**
     Branch switch through the wrapper.
     */
    const switched = await runWrapper({ ...context, label: 'switch side', args: ['switch', 'side',], mustSucceed: false, },);
    await releaseAt({ repository: context.repository, token: held.token, event: 'pre-commit', },);
    /**
     Finished held commit.
     */
    const record = await held.finished;
    return [{
      name: 'switch-invalidates-commit',
      holds: (switched.exitCode !== 0) || (record.outcome.exitCode !== 0),
      detail: 'both the branch switch and the held commit exited 0',
    },];
  },
};

/**
 Foreign `index.lock` holder.
 */
const foreignLock: ScenarioDefinition = {
  name: 'foreign-index-lock-holder',
  group: 'concurrency',
  summary: 'real Git by absolute path runs commit -a with a waiting editor (holding index.lock) while 3 agents commit',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: [...workerPaths({ prefix: 'w', count: BYSTANDERS, },), 'foreign.txt',], },), },);
  },
  async run(context,) {
    await writeWorktree({ ...context, path: 'foreign.txt', bytes: synthesizeText({ random: context.random.fork('foreign',), size: 300, },), },);
    /**
     Foreign holder.
     */
    const foreign = await startForeignCommit({ ...context, label: 'foreign', paths: ['foreign.txt',], },);
    /**
     Whether the editor started, so the lock is held.
     */
    const editor = await reached({ repository: context.repository, token: foreign.token, running: foreign.running, event: 'editor', },);
    await rewritePaths({ context, plans: BYSTANDER_PLANS, },);
    /**
     Bystanders started while the lock is held.
     */
    const bystanders = await startWorkers({ context, plans: BYSTANDER_PLANS, maxJitterMs: MAX_JITTER_MS, },);
    await sleep(FOREIGN_HOLD_MS,);
    await releaseAt({ repository: context.repository, token: foreign.token, event: 'editor', },);
    /**
     Finished attempts.
     */
    const finished = await finishAll([...bystanders, foreign,],);
    return [
      { name: 'foreign-holder-started', holds: editor === 'marker', detail: `editor wait ended with ${editor}`, },
      allSucceeded({ name: 'all-commits-succeed', attempts: finished, },),
    ];
  },
};

/**
 `gc --prune=now` during preparation.
 */
const gcPrune: ScenarioDefinition = {
  name: 'gc-prune-during-commits',
  group: 'concurrency',
  summary: 'git gc --prune=now runs while one commit is held in pre-commit and 3 others commit',
  repository(random,) {
    return repositoryOptions({
      seedFiles: seedTexts({ random, paths: [...workerPaths({ prefix: 'w', count: BYSTANDERS, },), 'held.txt',], },),
      hooks: 'hookdir',
      hookEvents: ['pre-commit',],
    },);
  },
  async run(context,) {
    await writeWorktree({ ...context, path: 'held.txt', bytes: synthesizeText({ random: context.random.fork('held',), size: 2000, },), },);
    /**
     Commit held in preparation during gc.
     */
    const held = await startAttempt({ ...context, label: 'held', paths: ['held.txt',], mode: 'explicit', },);
    await holdAt({ repository: context.repository, token: held.token, event: 'pre-commit', },);
    await reached({ repository: context.repository, token: held.token, running: held.running, event: 'pre-commit', },);
    await rewritePaths({ context, plans: BYSTANDER_PLANS, },);
    /**
     Bystanders and gc started together.
     */
    const [bystanders,] = await Promise.all([
      startWorkers({ context, plans: BYSTANDER_PLANS, maxJitterMs: MAX_JITTER_MS, },),
      runWrapper({ ...context, label: 'gc --prune=now', args: ['gc', '--quiet', '--prune=now',], mustSucceed: true, },),
    ],);
    await releaseAt({ repository: context.repository, token: held.token, event: 'pre-commit', },);
    /**
     Finished attempts.
     */
    const finished = await finishAll([held, ...bystanders,],);
    return [allSucceeded({ name: 'all-commits-succeed', attempts: finished, },),];
  },
};

/**
 Interference scenarios in report order.
 */
export const INTERFERENCE_SCENARIOS: readonly ScenarioDefinition[] = [
  amendDuringCommits,
  branchSwitch,
  foreignLock,
  gcPrune,
];

//endregion Scenarios
