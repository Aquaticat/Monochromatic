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
  | 'normalizer-change'
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
   * Median absolute deviation observation.
   */
  madMs: number;
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
export const RECORDED_RUNS = 30;
/**
 * Warm-up commands excluded from recorded summaries.
 */
export const WARMUP_RUNS = 6;
/**
 * Samples in each adjacent warm-up window.
 */
export const WARMUP_WINDOW = 3;
/**
 * Denominator producing accepted warm-up drift fraction.
 */
const WARMUP_STABILITY_DENOMINATOR = 5;
/**
 * Maximum relative drift between warm-up medians.
 */
export const WARMUP_STABILITY_RATIO: number = 1
  / WARMUP_STABILITY_DENOMINATOR;
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
 * Local bare remote for wrapped post-commit auto-push.
 */
export const WRAPPED_COMMIT_REMOTE = '/work/wrapped-commit.git';
/**
 * Local bare remote for direct commit baseline push.
 */
export const DIRECT_COMMIT_REMOTE = '/work/direct-commit.git';
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
 * Scenario budgets derived from `perf/lifecycle-latency-2026-07-11.json`.
 * Each ceiling is twice measured maximum rounded up to next 25 milliseconds;
 * every result remains below user-required 2,000-millisecond ceiling.
 */
export const SCENARIO_BUDGETS: Readonly<Record<LifecycleScenarioId, number>> = {
  'no-config': 250,
  'read-only': 225,
  'strict-mjs': 225,
  'strict-typescript': 250,
  'relaxed-rebuild': 250,
  'validator': 300,
  'scanner': 450,
  'normalizer': 375,
  'normalizer-change': 475,
  'post-commit': 500,
};
