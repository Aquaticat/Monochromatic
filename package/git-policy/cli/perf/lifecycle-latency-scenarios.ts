/**
 * Scenario collection for packed cli-git lifecycle latency benchmark.
 *
 * @module
 */

import { measure, } from './lifecycle-latency-command.ts';
import {
  collectPostCommit,
  collectWideCommit,
} from './lifecycle-latency-commit-scenarios.ts';
import {
  type CommandSample,
  type ScenarioSummary,
  WARMUP_RUNS,
} from './lifecycle-latency-contracts.ts';
import {
  PAIRED_SCENARIOS,
  PREPARED_PAIRED_SCENARIOS,
  type PairedScenario,
  type PreparedPairedScenario,
} from './lifecycle-latency-definitions.ts';
import type { LifecycleFixture, } from './lifecycle-latency-fixture.ts';
import {
  measurementIndices,
  metricValues,
  summarize,
} from './lifecycle-latency-summary.ts';
import { assertStableWarmups, } from './lifecycle-latency-warmup.ts';

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
   * Wide-commit summary collected over the same trusted commit repositories.
   */
  const wideCommit = await collectWideCommit();
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
    wideCommit,
    ...preparedPaired,
  ];
}
