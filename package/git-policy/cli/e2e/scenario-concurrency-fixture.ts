/**
 Concurrent-agent scenarios over disjoint and shared paths,
 trace replay,
 hooks,
 signing,
 and interleaved index writers.

 @module
 */

import {
  joinLines,
  splitLines,
  synthesizeText,
} from './content-fixture.ts';
import {
  ALL_HOOK_EVENTS,
  seedTracePaths,
  stagePartially,
  TRACE_MAX_CHANGES,
} from './scenario-baseline-fixture.ts';
import {
  finishAll,
  repositoryOptions,
  runDisjointWorkers,
  seedTexts,
  startWorkers,
  workerPaths,
} from './scenario-helper-fixture.ts';
import {
  allSucceeded,
  type ScenarioContext,
  type ScenarioDefinition,
} from './scenario-model-fixture.ts';
import { realGit, } from './repository-fixture.ts';
import { interleaveSequences, } from './seeded-schedule-fixture.ts';
import { runTraceOperations, } from './trace-execution-fixture.ts';
import {
  planTraceOperations,
  selectTraceWindow,
} from './trace-replay-fixture.ts';
import {
  holdAt,
  reached,
  readWorktree,
  releaseAt,
  runWrapper,
  startAttempt,
  writeWorktree,
} from './worker-fixture.ts';

//region Constants

/**
 Largest worker start offset for free-running scenarios.
 */
const MAX_JITTER_MS = 40;

/**
 Worker count range for disjoint-path scenarios.
 */
const WORKER_RANGE = { min: 4, max: 8, } as const;

/**
 Worker count for hook and signing scenarios.
 */
const HOOKED_WORKERS = 4;

/**
 Trace window length for concurrent replay.
 */
const CONCURRENT_TRACE_COMMITS = 16;

/**
 In-flight bound for concurrent trace replay.
 */
const TRACE_CONCURRENCY = 4;

/**
 Lines in the shared file.
 */
const SHARED_LINES = 60;

//endregion Constants

//region Disjoint and trace

/**
 Worker plans over disjoint seeded files.

 @param context - scenario context

 @param count - worker count

 @returns plans

 @example
 ```ts
 disjointPlans({ count: 4 });
 ```
 */
function disjointPlans(count: number,): readonly Readonly<{ label: string; paths: readonly string[]; }>[] {
  return workerPaths({ prefix: 'w', count, },).map(function plan(path, index,) {
    return { label: `w${String(index,)}`, paths: [path,], };
  },);
}

/**
 Concurrent explicit-path commits of disjoint files.
 */
const disjointPaths: ScenarioDefinition = {
  name: 'concurrent-disjoint-paths',
  group: 'concurrency',
  summary: '4 to 8 agents commit disjoint explicit paths at the same time',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: workerPaths({ prefix: 'w', count: WORKER_RANGE.max, },), },), },);
  },
  async run(context,) {
    /**
     Finished attempts.
     */
    const attempts = await runDisjointWorkers({
      context,
      plans: disjointPlans(context.random.integer(WORKER_RANGE,),),
      maxJitterMs: MAX_JITTER_MS,
    },);
    return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
  },
};

/**
 Concurrent trace replay.
 */
const traceConcurrent: ScenarioDefinition = {
  name: 'concurrent-trace-replay',
  group: 'concurrency',
  summary: `replay ${String(CONCURRENT_TRACE_COMMITS,)} trace commits with ${String(TRACE_CONCURRENCY,)} in flight`,
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: ['README.txt',], },), hooks: 'hookdir', hookEvents: ['pre-commit',], },);
  },
  async run(context,) {
    /**
     Window and its operations.
     */
    const { operations, seeds, } = planTraceOperations(selectTraceWindow({
      trace: context.trace,
      random: context.random.fork('window',),
      length: CONCURRENT_TRACE_COMMITS,
      maxChanges: TRACE_MAX_CHANGES,
    },),);
    await seedTracePaths({ context, seeds, },);
    /**
     Finished attempts.
     */
    const attempts = await runTraceOperations({ context, operations, concurrency: TRACE_CONCURRENCY, },);
    return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
  },
};

//endregion Disjoint and trace

//region Shared file

/**
 Rewrites lines of the shared file.

 @param context - scenario context

 @param from - first line index

 @param count - lines to replace

 @param label - text marking whose edit it is

 @example
 ```ts
 await editSharedLines({ context, from: 2, count: 3, label: 'a' });
 ```
 */
async function editSharedLines({
  context,
  from,
  count,
  label,
}: Readonly<{
  context: ScenarioContext;
  from: number;
  count: number;
  label: string;
}>,): Promise<void> {
  /**
   Current shared lines.
   */
  const lines = splitLines((await readWorktree({ repository: context.repository, path: 'shared.txt', },)).bytes ?? Buffer.from('\n',),);
  await writeWorktree({
    ...context,
    path: 'shared.txt',
    bytes: joinLines(lines.map(function edit(line, index,) {
      return (index >= from) && (index < from + count) ? `${label} edit ${String(index,)}` : line;
    },),),
  },);
}

/**
 Two agents edit one file:
 the first is held in `pre-commit` after capturing,
 the second edits and commits,
 then the first is released.

 @param context - scenario context

 @param secondFrom - first line the second agent edits

 @returns both finished attempts

 @example
 ```ts
 await runSharedFilePair({ context, secondFrom: 40 });
 ```
 */
async function runSharedFilePair({
  context,
  secondFrom,
}: Readonly<{
  context: ScenarioContext;
  secondFrom: number;
}>,): Promise<Awaited<ReturnType<typeof finishAll>>> {
  /**
   First line the first agent edits.
   */
  const firstFrom = context.random.integer({ min: 2, max: 8, },);
  await editSharedLines({ context, from: firstFrom, count: 3, label: 'first', },);
  /**
   First agent.
   */
  const first = await startAttempt({ ...context, label: 'first', paths: ['shared.txt',], mode: 'explicit', },);
  await holdAt({ repository: context.repository, token: first.token, event: 'pre-commit', },);
  await reached({ repository: context.repository, token: first.token, running: first.running, event: 'pre-commit', },);
  await editSharedLines({ context, from: secondFrom, count: 3, label: 'second', },);
  /**
   Second agent.
   */
  const second = await startAttempt({ ...context, label: 'second', paths: ['shared.txt',], mode: 'explicit', },);
  await releaseAt({ repository: context.repository, token: first.token, event: 'pre-commit', },);
  return await finishAll([first, second,],);
}

/**
 Shared-file repository setup.

 @param random - seeded source

 @returns options with a hooked `pre-commit` and the shared file

 @example
 ```ts
 sharedRepository(random);
 ```
 */
function sharedRepository(random: Parameters<ScenarioDefinition['repository']>[0],): ReturnType<ScenarioDefinition['repository']> {
  return repositoryOptions({
    seedFiles: [{
      path: 'shared.txt',
      bytes: joinLines(Array.from({ length: SHARED_LINES, }, function line(_unused, index,) {
        return `shared base line ${String(index,)} ${String(random.integer({ min: 0, max: 9999, },),)}`;
      },),),
    },],
    hooks: 'hookdir',
    hookEvents: ['pre-commit',],
  },);
}

/**
 Non-overlapping hunks in one file.
 */
const sharedNonOverlapping: ScenarioDefinition = {
  name: 'shared-file-non-overlapping-hunks',
  group: 'concurrency',
  summary: 'two agents commit the same file with far-apart hunks while the first is still preparing',
  repository: sharedRepository,
  async run(context,) {
    /**
     Finished attempts.
     */
    const attempts = await runSharedFilePair({ context, secondFrom: context.random.integer({ min: 40, max: 50, },), },);
    return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
  },
};

/**
 Overlapping hunks in one file.
 */
const sharedOverlapping: ScenarioDefinition = {
  name: 'shared-file-overlapping-hunks',
  group: 'concurrency',
  summary: 'two agents rewrite the same lines; one may fail only as a reported replay conflict',
  repository: sharedRepository,
  async run(context,) {
    /**
     Finished attempts.
     */
    const attempts = await runSharedFilePair({ context, secondFrom: 4, },);
    /**
     Attempts that failed.
     */
    const failed = attempts.filter(function nonZero(attempt,) {
      return attempt.outcome.exitCode !== 0;
    },);
    return [
      {
        name: 'one-lands',
        holds: failed.length < attempts.length,
        detail: 'no attempt landed',
      },
      {
        name: 'conflict-reported',
        holds: failed.every(function reported(attempt,) {
          return (attempt.outcome.exitCode === 1) && attempt.outcome.stderr.includes('"type":"core-finding"',);
        },),
        detail: failed.map(function describe(attempt,) {
          return `${attempt.label} exited ${String(attempt.outcome.exitCode,)} without a core-finding: ${attempt.outcome.stderr.trim().split('\n',).at(-1,) ?? ''}`;
        },).join('; ',),
      },
    ];
  },
};

//endregion Shared file

//region Hooks, signing, index writers

/**
 Hooked concurrent commits.

 @param context - scenario context

 @returns expectations

 @example
 ```ts
 await runHookedConcurrent(context);
 ```
 */
async function runHookedConcurrent(context: ScenarioContext,): Promise<Awaited<ReturnType<ScenarioDefinition['run']>>> {
  /**
   Finished attempts.
   */
  const attempts = await runDisjointWorkers({ context, plans: disjointPlans(HOOKED_WORKERS,), maxJitterMs: MAX_JITTER_MS, },);
  return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
}

/**
 Repository setup for hooked or signed concurrent commits.

 @param overrides - hook or signing options

 @returns setup function

 @example
 ```ts
 hookedRepository({ hooks: 'hookdir', hookEvents: ALL_HOOK_EVENTS });
 ```
 */
function hookedRepository(overrides: Partial<ReturnType<ScenarioDefinition['repository']>>,): ScenarioDefinition['repository'] {
  return function setup(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: workerPaths({ prefix: 'w', count: HOOKED_WORKERS, },), },), ...overrides, },);
  };
}

/**
 Hookdir hooks under concurrency.
 */
const hookdirConcurrent: ScenarioDefinition = {
  name: 'hooks-hookdir-concurrent',
  group: 'concurrency',
  summary: `${String(HOOKED_WORKERS,)} agents commit at once with all four commit hooks in the hooks directory`,
  repository: hookedRepository({ hooks: 'hookdir', hookEvents: ALL_HOOK_EVENTS, },),
  run: runHookedConcurrent,
};

/**
 Config-based hooks under concurrency.
 */
const configConcurrent: ScenarioDefinition = {
  name: 'hooks-config-concurrent',
  group: 'concurrency',
  summary: `${String(HOOKED_WORKERS,)} agents commit at once with all four commit hooks registered in config`,
  minimumGit: '2.54.0',
  repository: hookedRepository({ hooks: 'config', hookEvents: ALL_HOOK_EVENTS, },),
  run: runHookedConcurrent,
};

/**
 SSH signing under concurrency.
 */
const signingConcurrent: ScenarioDefinition = {
  name: 'ssh-signing-concurrent',
  group: 'concurrency',
  summary: `${String(HOOKED_WORKERS,)} agents make SSH-signed commits at once`,
  repository: hookedRepository({ signing: true, },),
  run: runHookedConcurrent,
};

/**
 lint-staged hooks under concurrency in a linked worktree.
 */
const lintStagedConcurrent: ScenarioDefinition = {
  name: 'lint-staged-stash-concurrent',
  group: 'concurrency',
  summary: 'lint-staged backup-stash hook while 3 explicit-path agents and 1 partially staged index commit run at once (linked worktree)',
  repository: hookedRepository({ worktree: 'linked', hooks: 'hookdir', hookEvents: ['pre-commit',], hookMode: 'lint-staged', },),
  async run(context,) {
    await stagePartially({ context, path: 'w-3.txt', },);
    /**
     Explicit-path plans for the other files.
     */
    const plans = disjointPlans(HOOKED_WORKERS - 1,);
    await Promise.all(plans.map(async function rewrite(plan,) {
      await writeWorktree({ ...context, path: plan.paths[0] ?? '', bytes: synthesizeText({ random: context.random.fork(plan.label,), size: 500, },), },);
    },),);
    /**
     All agents started together.
     */
    const started = await Promise.all([
      startWorkers({ context, plans, maxJitterMs: MAX_JITTER_MS, },),
      startAttempt({ ...context, label: 'index', paths: ['w-3.txt',], mode: 'index', },),
    ],);
    /**
     Finished attempts.
     */
    const attempts = await finishAll([...started[0], started[1],],);
    return [allSucceeded({ name: 'all-commits-succeed', attempts, },),];
  },
};

/**
 Commits interleaved with `git add` index writers.
 */
const indexWriters: ScenarioDefinition = {
  name: 'interleaved-index-writers',
  group: 'concurrency',
  summary: '4 committing agents interleaved with 4 agents staging new files through git add',
  repository(random,) {
    return repositoryOptions({ seedFiles: seedTexts({ random, paths: workerPaths({ prefix: 'w', count: HOOKED_WORKERS, },), },), },);
  },
  async run(context,) {
    /**
     Commit plans.
     */
    const plans = disjointPlans(HOOKED_WORKERS,);
    /**
     New files the writers stage.
     */
    const staged = workerPaths({ prefix: 'staged', count: HOOKED_WORKERS, },);
    await Promise.all([...plans.map(function planPath(plan,) {
      return plan.paths[0] ?? '';
    },), ...staged,].map(async function write(path,) {
      await writeWorktree({ ...context, path, bytes: synthesizeText({ random: context.random.fork(path,), size: 400, },), },);
    },),);
    /**
     Seeded order of commit starts and add runs.
     */
    const order = interleaveSequences({ random: context.random.fork('interleave',), lengths: [plans.length, staged.length,], },);
    /**
     Commits started so far, and add runs in flight.
     */
    const running = await order.reduce<Promise<readonly (Promise<unknown>)[]>>(async function launch(previous, step,) {
      /**
       Work launched so far.
       */
      const launched = await previous;
      if (step.actor === 0) {
        /**
         Plan for this commit.
         */
        const plan = plans[step.position];
        return plan === undefined ? launched : [...launched, (await startAttempt({ ...context, label: plan.label, paths: plan.paths, mode: 'explicit', },)).finished,];
      }
      /**
       Path this writer stages.
       */
      const path = staged[step.position] ?? '';
      context.ledger.recordStaged({ path, staged: true, },);
      return [...launched, runWrapper({ ...context, label: `add ${path}`, args: ['add', '--', path,], mustSucceed: true, },),];
    }, Promise.resolve([],),);
    await Promise.all(running,);
    /**
     Staged paths whose add succeeded but whose entry no longer matches the added bytes.
     */
    const lost = await Promise.all(staged.map(async function lostEntry(path,) {
      /**
       Whether this path's add exited 0.
       */
      const added = context.ledger.snapshot().auxiliaries.some(function addSucceeded(auxiliary,) {
        return (auxiliary.label === `add ${path}`) && (auxiliary.outcome.exitCode === 0);
      },);
      return added && !(await indexHoldsWorktree({ context, path, },)) ? [path,] : [];
    },),);
    return [
      allSucceeded({ name: 'all-commits-succeed', attempts: context.ledger.snapshot().attempts, },),
      { name: 'staged-entries-kept', holds: lost.flat().length === 0, detail: `staged entries lost: ${lost.flat().join(', ',)}`, },
    ];
  },
};

/**
 Reports whether the real index holds exactly the worktree bytes of a path.

 @param context - scenario context

 @param path - repository path

 @returns whether the stage-0 blob equals the worktree blob

 @example
 ```ts
 await indexHoldsWorktree({ context, path: 'staged-0.txt' });
 ```
 */
async function indexHoldsWorktree({
  context,
  path,
}: Readonly<{
  context: ScenarioContext;
  path: string;
}>,): Promise<boolean> {
  /**
   Stage-0 entry.
   */
  const listed = await realGit({ repository: context.repository, args: ['ls-files', '--stage', '--', path,], },);
  /**
   Worktree blob ID.
   */
  const worktreeOid = (await realGit({ repository: context.repository, args: ['hash-object', '--', path,], },)).trim();
  return listed.split(' ',)[1] === worktreeOid;
}

//endregion Hooks, signing, index writers

/**
 Concurrency scenarios in report order.
 */
export const CONCURRENCY_SCENARIOS: readonly ScenarioDefinition[] = [
  disjointPaths,
  traceConcurrent,
  sharedNonOverlapping,
  sharedOverlapping,
  indexWriters,
  hookdirConcurrent,
  configConcurrent,
  signingConcurrent,
  lintStagedConcurrent,
];
