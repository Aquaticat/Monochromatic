/**
 * Contracts for packed cli-git lifecycle latency measurements.
 *
 * @module
 */

/**
 * Stable lifecycle benchmark scenario identity.
 */
export type LifecycleScenarioId =
  | 'no-config'
  | 'read-only'
  | 'strict-mjs'
  | 'strict-typescript'
  | 'relaxed-rebuild'
  | 'validator'
  | 'scanner'
  | 'normalizer'
  | 'post-commit';

/**
 * Metric compared with measured scenario budget.
 */
export type LifecycleMetric = 'absolute' | 'wrapper-added';

/**
 * One command wall-time observation.
 */
export type CommandSample = Readonly<{
  /**
   * Direct Git duration when scenario has a native counterpart.
   */
  directMs?: number;
  /**
   * Wrapped or management-command duration.
   */
  wrapperMs: number;
  /**
   * Wrapper duration minus paired direct Git duration.
   */
  addedMs?: number;
}>;

/**
 * Measured scenario summary.
 */
export type ScenarioSummary = Readonly<{
  /**
   * Stable scenario identity.
   */
  id: LifecycleScenarioId;
  /**
   * Metric enforced for this scenario.
   */
  metric: LifecycleMetric;
  /**
   * Measured budget derived from recorded baseline.
   */
  budgetMs: number;
  /**
   * Largest enforced metric observation.
   */
  maximumMs: number;
  /**
   * Median enforced metric observation.
   */
  medianMs: number;
  /**
   * Nearest-rank ninety-fifth percentile observation.
   */
  p95Ms: number;
  /**
   * Complete ordered command samples.
   */
  samples: readonly CommandSample[];
}>;

/**
 * Scenario command execution request.
 */
export type CommandRequest = Readonly<{
  /**
   * Executable path.
   */
  command: string;
  /**
   * Literal process arguments.
   */
  args: readonly string[];
  /**
   * Process working directory.
   */
  cwd: string;
  /**
   * Additional environment values.
   */
  env?: Readonly<Record<string, string>>;
}>;

/**
 * Stable benchmark failure.
 */
export class LifecycleBenchmarkError extends Error {
  /**
   * Stable diagnostic class name.
   */
  public override readonly name = 'LifecycleBenchmarkError';
}

/**
 * Recorded samples per scenario after warm-up.
 */
export const RECORDED_RUNS = 7;
/**
 * Warm-up commands excluded from recorded summaries.
 */
export const WARMUP_RUNS = 2;
/**
 * Nanoseconds in one millisecond.
 */
export const NANOSECONDS_PER_MILLISECOND = 1_000_000;
/**
 * Packed cli-git executable after fixture installation.
 */
export const PACKAGE_BIN = '/work/node_modules/.bin/git';
/**
 * System Git executable inside benchmark container.
 */
export const REAL_GIT = '/usr/bin/git';
/**
 * Repository without policy configuration.
 */
export const NO_CONFIG_REPOSITORY = '/work/no-config';
/**
 * Repository with strict MJS configuration.
 */
export const MJS_REPOSITORY = '/work/strict-mjs';
/**
 * Repository with strict TypeScript configuration.
 */
export const TYPESCRIPT_REPOSITORY = '/work/strict-typescript';
/**
 * Direct-Git counterpart for commit measurements.
 */
export const DIRECT_COMMIT_REPOSITORY = '/work/direct-commit';
/**
 * Synthetic scanner executable.
 */
export const SCANNER_PATH = '/work/scanner.mjs';
/**
 * Canonical file changed by measured commands.
 */
export const BENCHMARK_FILE = 'benchmark.txt';
/**
 * Tracked files used to expose accidental repository-wide fan-out.
 */
export const TREE_FILE_COUNT = 2_048;
/**
 * Files written concurrently in one bounded setup batch.
 */
export const TREE_WRITE_BATCH_SIZE = 64;
/**
 * User-required upper ceiling for every scenario budget.
 */
export const MAXIMUM_BUDGET_MS = 2_000;

/**
 * Scenario budgets derived from the first bounded packed baseline run.
 * Values are replaced with measured headroom after collecting that run.
 */
export const SCENARIO_BUDGETS: Readonly<Record<LifecycleScenarioId, number>> = {
  'no-config': MAXIMUM_BUDGET_MS,
  'read-only': MAXIMUM_BUDGET_MS,
  'strict-mjs': MAXIMUM_BUDGET_MS,
  'strict-typescript': MAXIMUM_BUDGET_MS,
  'relaxed-rebuild': MAXIMUM_BUDGET_MS,
  'validator': MAXIMUM_BUDGET_MS,
  'scanner': MAXIMUM_BUDGET_MS,
  'normalizer': MAXIMUM_BUDGET_MS,
  'post-commit': MAXIMUM_BUDGET_MS,
};
