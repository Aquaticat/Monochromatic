/**
 * Type definitions and status helpers for the overview section.
 *
 * Shared between the overview renderer and its scatter point builders
 * to avoid circular imports.
 */

/**
 * Aggregated model summary for the overview table
 */
export type ModelSummary = {
  readonly model: string;
  readonly label: string;
  readonly latestScore: number;
  readonly latestTimestamp: string;
  readonly runCount: number;
  readonly failed: boolean;
  readonly threshold: number;
  readonly degraded: boolean;
};

/**
 * Model health status: a failure, a degradation, or a healthy run.
 */
export type StatusLevel = 'failed' | 'degraded' | 'healthy';

/**
 * Resolves a model summary to its health status level.
 *
 * Healthy runs report the explicit `'healthy'` member rather than an empty
 * string, so callers branch on a real domain value instead of an absence sentinel.
 *
 * @param summary - model summary to check
 *
 * @returns `'failed'`, `'degraded'`, or `'healthy'`
 *
 * @example
 * ```ts
 * statusLevel({ failed: true, degraded: false } as ModelSummary); // "failed"
 * statusLevel({ failed: false, degraded: true } as ModelSummary); // "degraded"
 * statusLevel({ failed: false, degraded: false } as ModelSummary); // "healthy"
 * ```
 */
export function statusLevel(summary: ModelSummary,): StatusLevel {
  if (summary.failed)
    return 'failed';
  if (summary.degraded)
    return 'degraded';
  return 'healthy';
}
