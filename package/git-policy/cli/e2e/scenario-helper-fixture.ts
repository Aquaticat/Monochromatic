/**
 Building blocks shared by scenario definitions.

 @module
 */

import { setTimeout as sleep, } from 'node:timers/promises';

import { synthesizeText, } from './content-fixture.ts';
import type { AttemptRecord, } from './ledger-fixture.ts';
import type { RepositoryOptions, } from './repository-fixture.ts';
import type { ScenarioContext, } from './scenario-model-fixture.ts';
import { planStartOffsets, } from './seeded-schedule-fixture.ts';
import type { SeededRandom, } from './seeded-random-fixture.ts';
import {
  type StartedAttempt,
  startAttempt,
  writeWorktree,
} from './worker-fixture.ts';

//region Repository options

/**
 Seed file text size in bytes.
 */
const SEED_TEXT_BYTES = 1200;

/**
 Builds seed files with synthetic text.

 @param random - seeded source

 @param paths - repository paths

 @returns seed files

 @example
 ```ts
 seedTexts({ random, paths: ['a.txt'] });
 ```
 */
export function seedTexts({
  random,
  paths,
}: Readonly<{
  random: SeededRandom;
  paths: readonly string[];
}>,): RepositoryOptions['seedFiles'] {
  return paths.map(function seedFile(path,) {
    return { path, bytes: synthesizeText({ random: random.fork(path,), size: SEED_TEXT_BYTES, },), };
  },);
}

/**
 Names `count` worker files with a prefix.

 @param prefix - file prefix

 @param count - number of files

 @returns repository paths

 @example
 ```ts
 workerPaths({ prefix: 'w', count: 2 }); // => ['w-0.txt', 'w-1.txt']
 ```
 */
export function workerPaths({
  prefix,
  count,
}: Readonly<{
  prefix: string;
  count: number;
}>,): readonly string[] {
  return Array.from({ length: count, }, function path(_unused, index,) {
    return `${prefix}-${String(index,)}.txt`;
  },);
}

/**
 Repository options with defaults:
 main worktree,
 no hooks,
 no signing.

 @param overrides - fields that differ

 @returns complete options

 @example
 ```ts
 repositoryOptions({ seedFiles: [] });
 ```
 */
export function repositoryOptions(overrides: Partial<RepositoryOptions> & Pick<RepositoryOptions, 'seedFiles'>,): RepositoryOptions {
  return {
    worktree: 'main',
    hooks: 'none',
    hookEvents: [],
    signing: false,
    ...overrides,
  };
}

//endregion Repository options

//region Workers

/**
 One worker's plan:
 rewrite its paths,
 then commit them explicitly.
 */
export type WorkerPlan = Readonly<{
  /**
   Unique label.
   */
  label: string;
  /**
   Tracked paths the worker rewrites and commits.
   */
  paths: readonly string[];
}>;

/**
 Rewrites each worker's paths with fresh text.

 @param context - scenario context

 @param plans - worker plans

 @example
 ```ts
 await rewritePaths({ context, plans });
 ```
 */
export async function rewritePaths({
  context,
  plans,
}: Readonly<{
  context: ScenarioContext;
  plans: readonly WorkerPlan[];
}>,): Promise<void> {
  await Promise.all(plans.flatMap(function planWrites(plan,) {
    return plan.paths.map(async function rewrite(path,) {
      await writeWorktree({
        ...context,
        path,
        bytes: synthesizeText({ random: context.random.fork(`${plan.label}:${path}`,), size: SEED_TEXT_BYTES, },),
      },);
    },);
  },),);
}

/**
 Starts explicit-path workers at seeded offsets.

 @param context - scenario context

 @param plans - worker plans; paths must already hold their new bytes

 @param maxJitterMs - largest start offset

 @returns started attempts in plan order

 @example
 ```ts
 await startWorkers({ context, plans, maxJitterMs: 30 });
 ```
 */
export async function startWorkers({
  context,
  plans,
  maxJitterMs,
}: Readonly<{
  context: ScenarioContext;
  plans: readonly WorkerPlan[];
  maxJitterMs: number;
}>,): Promise<readonly StartedAttempt[]> {
  /**
   Seeded start offsets.
   */
  const offsets = planStartOffsets({ random: context.random.fork('offsets',), count: plans.length, maxJitterMs, },);
  return await Promise.all(plans.map(async function startLater(plan, index,) {
    await sleep(offsets[index] ?? 0,);
    return await startAttempt({ ...context, label: plan.label, paths: plan.paths, mode: 'explicit', },);
  },),);
}

/**
 Awaits every started attempt.

 @param attempts - started attempts

 @returns finished records in the same order

 @example
 ```ts
 await finishAll(await startWorkers({ context, plans, maxJitterMs: 30 }));
 ```
 */
export async function finishAll(attempts: readonly StartedAttempt[],): Promise<readonly AttemptRecord[]> {
  return await Promise.all(attempts.map(async function finish(attempt,) {
    return await attempt.finished;
  },),);
}

/**
 Rewrites and commits disjoint files with seeded jitter.

 @param context - scenario context

 @param plans - worker plans

 @param maxJitterMs - largest start offset

 @returns finished records

 @example
 ```ts
 await runDisjointWorkers({ context, plans, maxJitterMs: 30 });
 ```
 */
export async function runDisjointWorkers({
  context,
  plans,
  maxJitterMs,
}: Readonly<{
  context: ScenarioContext;
  plans: readonly WorkerPlan[];
  maxJitterMs: number;
}>,): Promise<readonly AttemptRecord[]> {
  await rewritePaths({ context, plans, },);
  return await finishAll(await startWorkers({ context, plans, maxJitterMs, },),);
}

/**
 Runs workers one after another.

 @param context - scenario context

 @param plans - worker plans

 @returns finished records

 @example
 ```ts
 await runSequentialWorkers({ context, plans });
 ```
 */
export async function runSequentialWorkers({
  context,
  plans,
}: Readonly<{
  context: ScenarioContext;
  plans: readonly WorkerPlan[];
}>,): Promise<readonly AttemptRecord[]> {
  await rewritePaths({ context, plans, },);
  return await plans.reduce<Promise<readonly AttemptRecord[]>>(async function next(previous, plan,) {
    /**
     Records so far.
     */
    const done = await previous;
    /**
     This worker's record.
     */
    const record = await (await startAttempt({ ...context, label: plan.label, paths: plan.paths, mode: 'explicit', },)).finished;
    return [...done, record,];
  }, Promise.resolve([],),);
}

//endregion Workers
