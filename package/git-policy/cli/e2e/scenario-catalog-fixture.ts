/**
 Complete scenario catalog in report order.

 @module
 */

import { BASELINE_SCENARIOS, } from './scenario-baseline-fixture.ts';
import { CONCURRENCY_SCENARIOS, } from './scenario-concurrency-fixture.ts';
import { INTERFERENCE_SCENARIOS, } from './scenario-interference-fixture.ts';
import type { ScenarioDefinition, } from './scenario-model-fixture.ts';
import { SIGKILL_SCENARIOS, } from './scenario-sigkill-fixture.ts';

/**
 Every scenario:
 baselines first,
 then concurrency,
 interference,
 and kill scenarios.
 */
export const SCENARIO_CATALOG: readonly ScenarioDefinition[] = [
  ...BASELINE_SCENARIOS,
  ...CONCURRENCY_SCENARIOS,
  ...INTERFERENCE_SCENARIOS,
  ...SIGKILL_SCENARIOS,
];
