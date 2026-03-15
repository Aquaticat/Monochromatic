/**
 * Type definitions and status helpers for the overview section.
 *
 * Shared between the overview renderer and its scatter point builders
 * to avoid circular imports.
 */

/** Aggregated model summary for the overview table */
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
 * Resolves a model summary to its status level data attribute value.
 *
 * @param summary - model summary to check
 *
 * @returns "failed", "degraded", or empty string for healthy models
 */
export function statusLevel(summary: ModelSummary,): string {
  if (summary.failed)
    return 'failed';
  if (summary.degraded)
    return 'degraded';
  return '';
}
