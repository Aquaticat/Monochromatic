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
 * Test whether complete recent outcome window requires blocklisting.
 *
 * @param outcomes - recent logical judge call outcomes
 *
 * @returns whether window reached threshold and every call produced no content
 *
 * @example
 * ```ts
 * isNoContentWindow(['noContent', 'noContent', 'noContent']);
 * ```
 */
function isNoContentWindow(
  outcomes: readonly JudgeCallOutcome[],
): boolean {
  return (outcomes.length === NO_CONTENT_CALL_THRESHOLD)
    && outcomes.every(
      /**
       * Match one no-content call outcome.
       *
       * @param outcome - completed logical call outcome
       *
       * @returns whether call produced no content
       */
      function outcomeIsNoContent(outcome,) {
        return outcome === 'noContent';
      },
    );
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
   * Bounded recent outcome windows keyed by canonical model slug.
   */
  const outcomesByModel = new Map<string, readonly JudgeCallOutcome[]>();

  /**
   * Derive current model exclusions from recent outcome windows.
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
     * Canonical slugs whose recent windows are wholly empty.
     */
    const blocklisted: string[] = [];
    for (const [modelSlug, outcomes,] of outcomesByModel.entries()) {
      if (isNoContentWindow(outcomes,))
        blocklisted.push(modelSlug,);
    }
    return blocklisted;
  }

  /**
   * Remove all model outcomes at a session boundary.
   *
   * @returns nothing
   *
   * @example
   * ```ts
   * history.clear();
   * ```
   */
  function clear(): void {
    if (outcomesByModel.size > 0)
      l.debug('clearing session-local judge call history',);
    outcomesByModel.clear();
  }

  /**
   * Append one outcome and retain only bounded recent history.
   *
   * @param modelSlug - canonical provider and model identity
   *
   * @param outcome - completed logical judge call classification
   *
   * @returns nothing
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
     * Previous bounded window for selected model.
     */
    const previous = outcomesByModel.get(modelSlug,) ?? [];
    /**
     * Whether model was excluded before current outcome.
     */
    const wasBlocklisted = isNoContentWindow(previous,);
    /**
     * New bounded window ending at current logical call.
     */
    const recent = [
      ...previous,
      outcome,
    ].slice(-NO_CONTENT_CALL_THRESHOLD,);
    outcomesByModel.set(modelSlug, recent,);
    /**
     * Whether current recent window now excludes model.
     */
    const isBlocklisted = isNoContentWindow(recent,);
    l.debug(`recorded ${outcome} outcome for ${modelSlug}`,);
    if (!wasBlocklisted && isBlocklisted) {
      l.warn(
        `temporarily blocklisting ${modelSlug} after ${NO_CONTENT_CALL_THRESHOLD} no-content judge calls`,
      );
    }
    if (wasBlocklisted && !isBlocklisted)
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
