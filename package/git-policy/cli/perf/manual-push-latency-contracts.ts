/**
 * Contracts and constants for repository-scale manual-push latency measurement.
 *
 * @module
 */

/**
 * Result of one paired direct and wrapped push measurement.
 *
 * @example
 * ```ts
 * const sample: Sample = { directMs: 10, wrapperMs: 20, addedMs: 10 };
 * ```
 */
export type Sample = Readonly<{
  directMs: number;
  wrapperMs: number;
  addedMs: number;
}>;

/**
 * Optional command execution controls.
 *
 * @example
 * ```ts
 * const options: ExecuteOptions = { cwd: '/work', discardOutput: true };
 * ```
 */
export type ExecuteOptions = Readonly<{
  cwd?: string;
  discardOutput?: boolean;
}>;

/**
 * State accumulated while scheduling sequential benchmark pairs.
 *
 * @example
 * ```ts
 * const state: PairCollectionState = { samples: [], stable: false };
 * ```
 */
export type PairCollectionState = Readonly<{
  samples: readonly Sample[];
  stable: boolean;
}>;

/**
 * Reports benchmark setup, sample, or threshold failures.
 *
 * @example
 * ```ts
 * throw new BenchmarkError('Benchmark did not converge.');
 * ```
 */
export class BenchmarkError extends Error {
  /**
   * Stable error name for benchmark diagnostics.
   */
  public override readonly name = 'BenchmarkError';
}

/**
 * Number of recorded pairs after warm-up stability.
 */
export const RUNS = 30;
/**
 * Minimum number of warm-up pairs considered for stability.
 */
export const MINIMUM_WARMUPS = 6;
/**
 * Maximum number of warm-up pairs before benchmark failure.
 */
export const MAXIMUM_WARMUPS = 30;
/**
 * Number of samples in each compared warm-up window.
 */
export const WARMUP_WINDOW = 3;
/**
 * Maximum relative median drift accepted between warm-up windows.
 */
export const STABILITY_RATIO: number = 1 / ((2 + 2) * (2 + 2
  + 1));
/**
 * Maximum allowed wrapper-added latency in milliseconds.
 */
export const LIMIT_MS = 2_000;
/**
 * Nanoseconds in one millisecond.
 */
export const NANOSECONDS_PER_MILLISECOND = 1_000_000;
/**
 * Percentile represented by p95.
 */
export const NINETY_FIFTH_PERCENTILE: number = 1 - STABILITY_RATIO;
/**
 * Decimal places used in threshold failure messages.
 */
export const DECIMAL_PLACES = 3;
/**
 * Byte count for benchmark memory limit.
 */
export const MEMORY_LIMIT_BYTES = 2_147_483_648;
/**
 * CPU count for benchmark container limit.
 */
export const CPU_LIMIT = 2;
/**
 * Byte count for benchmark temporary filesystem limit.
 */
export const TEMPORARY_FILESYSTEM_LIMIT_BYTES = 1_073_741_824;
/**
 * Installed packed cli-git executable.
 */
export const PACKAGE_BIN = '/work/node_modules/.bin/git';
/**
 * Repository used for direct Git measurements.
 */
export const DIRECT_REPOSITORY = '/work/direct';
/**
 * Repository used for wrapper measurements.
 */
export const WRAPPED_REPOSITORY = '/work/wrapped';
/**
 * Bare remote used for direct Git measurements.
 */
export const DIRECT_REMOTE = '/work/direct.git';
/**
 * Bare remote used for wrapper measurements.
 */
export const WRAPPED_REMOTE = '/work/wrapped.git';
/**
 * Environment override that places packed cli-git before system Git.
 */
export const COMMAND_ENV: Readonly<Record<string, string>> = {
  PATH: `/work/node_modules/.bin:/usr/bin:${process.env
    .PATH
    ?? ''}`,
} as const;
