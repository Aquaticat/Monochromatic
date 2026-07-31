/**
 * Session-local judge call outcome history and derived model blocklist.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Number of recent logical judge calls required to blocklist one model.
 */
const NO_CONTENT_CALL_THRESHOLD = 3;

/**
 * Outcome relevant to no-content model health.
 */
type JudgeCallOutcome = 'noContent' | 'other';

/**
 * Encapsulated session-local judge call history.
 *
 * The blocklist is derived from each model's recent outcome window. Clearing
 * the history makes every model eligible again for a new session.
 */
type JudgeCallHistory = {
  /**
   * Return models whose complete recent window contains only no-content calls.
   *
   * @returns canonical model slugs currently excluded from judge selection
   */
  readonly blocklistedModelSlugs: () => readonly string[];
  /**
   * Clear every recorded model outcome at a session boundary.
   *
   * @returns nothing
   */
  readonly clear: () => void;
  /**
   * Record one completed logical call to one judge model.
   *
   * @param modelSlug - canonical provider and model identity
   *
   * @param outcome - whether complete judge call produced no content whatsoever
   *
   * @returns nothing
   */
  readonly record: (
    {
      modelSlug,
      outcome,
    }: {
      readonly modelSlug: string;
      readonly outcome: JudgeCallOutcome;
    },
  ) => void;
};

/**
 * Judge health logger.
 */
const l = tagged({ tag: 'auto-mode-judge-call-history', },);

/**
 * Test whether consecutive no-content count requires blocklisting.
 *
 * @param noContentCallCount - bounded consecutive no-content call count
 *
 * @returns whether count reached temporary blocklist threshold
 *
 * @example
 * ```ts
 * isBlocklistedCallCount(3);
 * ```
 */
function isBlocklistedCallCount(
  noContentCallCount: number,
): boolean {
  return noContentCallCount >= NO_CONTENT_CALL_THRESHOLD;
}

/**
 * Create isolated judge call history for one auto-mode extension instance.
 *
 * @returns mutable history facade with hidden outcome storage
 *
 * @example
 * ```ts
 * const history = createJudgeCallHistory();
 * history.record({ modelSlug: 'provider/model', outcome: 'noContent' });
 * ```
 */
function createJudgeCallHistory(): JudgeCallHistory {
  /**
   * Bounded consecutive no-content counts keyed by canonical model slug.
   */
  const noContentCallCounts = new Map<string, number>();

  /**
   * Derive current model exclusions from recent call counts.
   *
   * @returns canonical blocklisted model slugs
   *
   * @example
   * ```ts
   * history.blocklistedModelSlugs();
   * ```
   */
  function blocklistedModelSlugs(): readonly string[] {
    /**
     * Canonical slugs whose recent calls are wholly empty.
     */
    const blocklisted: string[] = [];
    for (const [modelSlug, noContentCallCount,] of noContentCallCounts.entries()) {
      if (isBlocklistedCallCount(noContentCallCount,))
        blocklisted.push(modelSlug,);
    }
    return blocklisted;
  }

  /**
   * Remove all model outcomes at a session boundary.
   *
   * @example
   * ```ts
   * history.clear();
   * ```
   */
  function clear(): void {
    if (noContentCallCounts.size > 0)
      l.debug('clearing session-local judge call history',);
    noContentCallCounts.clear();
  }

  /**
   * Append one outcome and retain bounded consecutive no-content count.
   *
   * @param modelSlug - canonical provider and model identity
   *
   * @param outcome - completed logical judge call classification
   *
   * @example
   * ```ts
   * history.record({ modelSlug: 'provider/model', outcome: 'other' });
   * ```
   */
  function record(
    {
      modelSlug,
      outcome,
    }: {
      readonly modelSlug: string;
      readonly outcome: JudgeCallOutcome;
    },
  ): void {
    /**
     * Previous consecutive no-content call count for selected model.
     */
    const previousCount = noContentCallCounts.get(modelSlug,) ?? 0;
    /**
     * Whether model was excluded before current outcome.
     */
    const wasBlocklisted = isBlocklistedCallCount(previousCount,);
    /**
     * Bounded consecutive no-content count ending at current logical call.
     */
    const recentCount = outcome === 'noContent'
      ? Math.min(
        previousCount + 1,
        NO_CONTENT_CALL_THRESHOLD,
      )
      : 0;
    noContentCallCounts.set(
      modelSlug,
      recentCount,
    );
    /**
     * Whether current recent call count now excludes model.
     */
    const isBlocklisted = isBlocklistedCallCount(recentCount,);
    l.debug(`recorded ${outcome} outcome for ${modelSlug}`,);
    if ((!wasBlocklisted) && isBlocklisted) {
      l.warn(
        `temporarily blocklisting ${modelSlug} after ${NO_CONTENT_CALL_THRESHOLD} no-content judge calls`,
      );
    }
    if (wasBlocklisted && (!isBlocklisted))
      l.info(`removing temporary judge blocklist for ${modelSlug}`,);
  }

  return {
    blocklistedModelSlugs,
    clear,
    record,
  };
}

export { createJudgeCallHistory, };
export type {
  JudgeCallHistory,
  JudgeCallOutcome,
};
