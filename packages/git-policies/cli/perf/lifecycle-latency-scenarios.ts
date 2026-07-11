/**
 * Scenario collection for packed cli-git lifecycle latency benchmark.
 *
 * @module
 */

import { appendFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  execute,
  measure,
  median,
  medianAbsoluteDeviation,
  p95,
} from './lifecycle-latency-command.ts';
import {
  BENCHMARK_FILE,
  DIRECT_COMMIT_REPOSITORY,
  LifecycleBenchmarkError,
  MAXIMUM_BUDGET_MS,
  PACKAGE_BIN,
  REAL_GIT,
  RECORDED_RUNS,
  SCENARIO_BUDGETS,
  type CommandRequest,
  type CommandSample,
  type LifecycleMetric,
  type LifecycleScenarioId,
  type ScenarioSummary,
  TYPESCRIPT_REPOSITORY,
  WARMUP_RUNS,
} from './lifecycle-latency-contracts.ts';
import {
  PAIRED_SCENARIOS,
  PREPARED_PAIRED_SCENARIOS,
  type PairedScenario,
  type PreparedPairedScenario,
} from './lifecycle-latency-definitions.ts';
import type { LifecycleFixture, } from './lifecycle-latency-fixture.ts';
import { assertStableWarmups, } from './lifecycle-latency-warmup.ts';

/**
 * Decimal places in failure diagnostics.
 */
const DECIMAL_PLACES = 3;

/**
 * Creates zero-based measurement indices including warm-ups.
 *
 * @returns ordered indices
 */
function measurementIndices(): readonly number[] {
  return Array.from(
    { length: WARMUP_RUNS + RECORDED_RUNS, },
    function measurementIndex(
      _unused,
      index,
    ) {
      return index;
    },
  );
}

/**
 * Selects metric values from samples.
 *
 * @param samples - recorded paired samples
 *
 * @returns wrapper-added observations
 */
function metricValues({
  samples,
}: Readonly<{
  samples: readonly CommandSample[];
}>,): readonly number[] {
  return samples.map(function sampleMetric(sample,) {
    if (sample.addedMs === undefined)
      throw new LifecycleBenchmarkError('Paired scenario omitted wrapper-added latency.',);
    return sample.addedMs;
  },);
}

/**
 * Summarizes and enforces one measured scenario.
 *
 * @param id - stable scenario identity
 *
 * @param metric - enforced metric
 *
 * @param samples - recorded samples
 *
 * @returns measured summary
 */
function summarize({
  id,
  metric,
  samples,
}: Readonly<{
  id: LifecycleScenarioId;
  metric: LifecycleMetric;
  samples: readonly CommandSample[];
}>,): ScenarioSummary {
  /**
   * Values selected by scenario metric.
   */
  const values = metricValues({ samples, },);
  /**
   * Largest recorded metric value.
   */
  const maximumMs = Math.max(...values,);
  /**
   * Measured scenario budget.
   */
  const budgetMs = SCENARIO_BUDGETS[id];
  /**
   * Explicit baseline-capture mode used before budgets are written.
   */
  const capturesBaseline = process.env
    .CLI_GIT_CAPTURE_LATENCY_BASELINE
    === '1';
  if ((!capturesBaseline)
    && ((budgetMs >= MAXIMUM_BUDGET_MS) || (maximumMs >= budgetMs))) {
    throw new LifecycleBenchmarkError(
      `${id} ${metric} latency ${maximumMs.toFixed(DECIMAL_PLACES,)} ms reached ${String(budgetMs,)} ms budget.`,
    );
  }
  return {
    id,
    metric,
    budgetMs,
    maximumMs,
    medianMs: median(values,),
    p95Ms: p95(values,),
    madMs: medianAbsoluteDeviation(values,),
    samples,
  };
}

/**
 * Collects alternating paired direct and wrapper commands.
 *
 * @param scenario - paired command declaration
 *
 * @returns enforced wrapper-added summary
 */
async function collectPaired(scenario: PairedScenario,): Promise<ScenarioSummary> {
  /**
   * Complete sequential pair collection.
   */
  const allSamples = await measurementIndices()
    .reduce(
    async function appendPair(
      previousPromise,
      index,
    ) {
      /**
       * Earlier sequential pair samples.
       */
      const previous = await previousPromise;
      /**
       * Alternating execution order for systematic-noise control.
       */
      const wrapperFirst = (index % 2) === 1;
      /**
       * Optional wrapper duration measured before direct Git.
       */
      const firstWrapperMs = wrapperFirst ? await measure(scenario.wrapper,) : undefined;
      /**
       * Paired direct Git duration.
       */
      const directMs = await measure(scenario.direct,);
      /**
       * Wrapper duration from selected execution order.
       */
      const wrapperMs = firstWrapperMs ?? await measure(scenario.wrapper,);
      return [
        ...previous,
        {
          directMs,
          wrapperMs,
          addedMs: wrapperMs - directMs,
        },
      ];
    },
    Promise.resolve<readonly CommandSample[]>([],),
  );
  assertStableWarmups({
    id: scenario.id,
    values: metricValues({ samples: allSamples, },),
  },);
  return summarize({
    id: scenario.id,
    metric: 'wrapper-added',
    samples: allSamples.slice(WARMUP_RUNS,),
  },);
}

/**
 * Collects stateful pairs after preparing equivalent command state.
 *
 * @param scenario - prepared pair declaration
 *
 * @param fixture - prepared trust facts
 *
 * @returns enforced wrapper-added summary
 */
async function collectPreparedPaired({
  scenario,
  fixture,
}: Readonly<{
  scenario: PreparedPairedScenario;
  fixture: LifecycleFixture;
}>,): Promise<ScenarioSummary> {
  /**
   * Complete sequential prepared pair collection.
   */
  const allSamples = await measurementIndices()
    .reduce(
      async function appendPreparedPair(
        previousPromise,
        index,
      ) {
        /**
         * Earlier sequential prepared pairs.
         */
        const previous = await previousPromise;
        /**
         * Direct and wrapped requests over one newly prepared state.
         */
        const pair = await scenario.prepare({
          iteration: index,
          fixture,
        },);
        /**
         * Alternating execution order for systematic-noise control.
         */
        const wrapperFirst = (index % 2) === 1;
        /**
         * Optional wrapper duration measured before direct Git.
         */
        const firstWrapperMs = wrapperFirst ? await measure(pair.wrapper,) : undefined;
        /**
         * Paired direct Git duration.
         */
        const directMs = await measure(pair.direct,);
        /**
         * Wrapper duration from selected execution order.
         */
        const wrapperMs = firstWrapperMs ?? await measure(pair.wrapper,);
        return [
          ...previous,
          {
            directMs,
            wrapperMs,
            addedMs: wrapperMs - directMs,
          },
        ];
      },
      Promise.resolve<readonly CommandSample[]>([],),
    );
  assertStableWarmups({
    id: scenario.id,
    values: metricValues({ samples: allSamples, },),
  },);
  return summarize({
    id: scenario.id,
    metric: 'wrapper-added',
    samples: allSamples.slice(WARMUP_RUNS,),
  },);
}

/**
 * Prepares next commit command.
 *
 * @param repository - target repository
 *
 * @param command - Git executable
 *
 * @param iteration - unique content sequence
 *
 * @returns measured commit request
 */
async function commitRequest({
  repository,
  command,
  iteration,
}: Readonly<{
  repository: string;
  command: string;
  iteration: number;
}>,): Promise<CommandRequest> {
  await appendFile(
    join(
      repository,
      BENCHMARK_FILE,
    ),
    `commit-${String(iteration,)}\n`,
  );
  await execute({
    command: REAL_GIT,
    args: [
      'add',
      '--',
      BENCHMARK_FILE,
    ],
    cwd: repository,
  },);
  return {
    command,
    args: [
      'commit',
      `--message=benchmark-${String(iteration,)}`,
      '--',
      BENCHMARK_FILE,
    ],
    cwd: repository,
  };
}

/**
 * Collects post-commit pairs with equivalent prepared mutations.
 *
 * @returns enforced post-commit wrapper-added summary
 */
async function collectPostCommit(): Promise<ScenarioSummary> {
  /**
   * Complete sequential commit-pair collection.
   */
  const allSamples = await measurementIndices()
    .reduce(
    async function appendCommitPair(
      previousPromise,
      index,
    ) {
      /**
       * Earlier sequential commit samples.
       */
      const previous = await previousPromise;
      /**
       * Prepared direct commit request.
       */
      const direct = await commitRequest({
        repository: DIRECT_COMMIT_REPOSITORY,
        command: REAL_GIT,
        iteration: index,
      },);
      /**
       * Prepared wrapper commit request.
       */
      const wrapper = await commitRequest({
        repository: TYPESCRIPT_REPOSITORY,
        command: PACKAGE_BIN,
        iteration: index,
      },);
      /**
       * Direct commit duration.
       */
      const directCommitMs = await measure(direct,);
      /**
       * Direct local push duration paired with wrapper auto-push.
       */
      const directPushMs = await measure({
        command: REAL_GIT,
        args: ['push',],
        cwd: DIRECT_COMMIT_REPOSITORY,
      },);
      /**
       * Complete direct commit and push duration.
       */
      const directMs = directCommitMs + directPushMs;
      /**
       * Wrapper commit including local auto-push duration.
       */
      const wrapperMs = await measure(wrapper,);
      return [
        ...previous,
        {
          directMs,
          wrapperMs,
          addedMs: wrapperMs - directMs,
        },
      ];
    },
    Promise.resolve<readonly CommandSample[]>([],),
  );
  assertStableWarmups({
    id: 'post-commit',
    values: metricValues({ samples: allSamples, },),
  },);
  return summarize({
    id: 'post-commit',
    metric: 'wrapper-added',
    samples: allSamples.slice(WARMUP_RUNS,),
  },);
}

/**
 * Runs complete required lifecycle benchmark matrix.
 *
 * @param fixture - prepared trust facts
 *
 * @returns ordered scenario summaries
 *
 * @example
 * ```ts
 * await collectLifecycleScenarios(fixture);
 * ```
 */
export async function collectLifecycleScenarios(
  fixture: LifecycleFixture,
): Promise<readonly ScenarioSummary[]> {
  /**
   * Paired summaries collected sequentially to avoid cross-scenario contention.
   */
  const paired = await PAIRED_SCENARIOS.reduce(
    async function appendPaired(
      previousPromise,
      scenario,
    ) {
      return [
        ...await previousPromise,
        await collectPaired(scenario,),
      ];
    },
    Promise.resolve<readonly ScenarioSummary[]>([],),
  );
  /**
   * Post-commit summary collected before relaxed config mutation.
   */
  const postCommit = await collectPostCommit();
  /**
   * Stateful paired summaries collected sequentially over shared trusted state.
   */
  const preparedPaired = await PREPARED_PAIRED_SCENARIOS.reduce(
    async function appendPreparedPaired(
      previousPromise,
      scenario,
    ) {
      return [
        ...await previousPromise,
        await collectPreparedPaired({
          scenario,
          fixture,
        },),
      ];
    },
    Promise.resolve<readonly ScenarioSummary[]>([],),
  );
  return [
    ...paired,
    postCommit,
    ...preparedPaired,
  ];
}
