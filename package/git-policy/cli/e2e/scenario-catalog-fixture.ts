/**
 Complete scenario catalog in report order.

 @module
 */

import { AMEND_SWITCH_SCENARIOS, } from './scenario-amend-switch-fixture.ts';
import { BASELINE_AMEND_SCENARIOS, } from './scenario-baseline-amend-fixture.ts';
import { BASELINE_COMMIT_SCENARIOS, } from './scenario-baseline-commit-fixture.ts';
import { BASELINE_HOOK_SCENARIOS, } from './scenario-baseline-hook-fixture.ts';
import { CONCURRENT_PATH_SCENARIOS, } from './scenario-concurrent-paths-fixture.ts';
import { HOOKED_SCENARIOS, } from './scenario-hooked-fixture.ts';
import { INDEX_WRITER_SCENARIOS, } from './scenario-index-writer-fixture.ts';
import { LOCK_GC_SCENARIOS, } from './scenario-lock-gc-fixture.ts';
import type { ScenarioDefinition, } from './scenario-model-fixture.ts';
import { SHARED_FILE_SCENARIOS, } from './scenario-shared-file-fixture.ts';
import { SIGKILL_SCENARIOS, } from './scenario-sigkill-fixture.ts';

/**
 Every scenario:
 baselines first,
 then the accepted design's concurrency,
 interference,
 and kill scenarios.
 */
export const SCENARIO_CATALOG: readonly ScenarioDefinition[] = [
  ...BASELINE_COMMIT_SCENARIOS,
  ...BASELINE_AMEND_SCENARIOS,
  ...BASELINE_HOOK_SCENARIOS,
  ...CONCURRENT_PATH_SCENARIOS,
  ...SHARED_FILE_SCENARIOS,
  ...INDEX_WRITER_SCENARIOS,
  ...HOOKED_SCENARIOS,
  ...AMEND_SWITCH_SCENARIOS,
  ...LOCK_GC_SCENARIOS,
  ...SIGKILL_SCENARIOS,
];
