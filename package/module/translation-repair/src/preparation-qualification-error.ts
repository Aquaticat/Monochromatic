//region Preparation qualification refusals
// Qualification failures stop a frozen calibration plan without changing production preparation policy.

/**
 * Closed reasons why current preparation cannot certify a calibration recipe.
 *
 * @example
 * ```ts
 * const kind: PreparationQualificationFailure = 'usable-quorum';
 * ```
 */
export type PreparationQualificationFailure =
  | 'historical-cache'
  | 'usable-quorum'
  | 'fallback'
  | 'question'
  | 'result'
  | 'unclaimed-target'
  | 'fast-path';

/**
 * Fixed diagnostics name inputs and valid recovery without reproducing archive content.
 */
const QUALIFICATION_MESSAGES: Readonly<Record<PreparationQualificationFailure, string>> = {
  'historical-cache': 'Preparation used a historical pairing cache without current seat outcomes. Acquire current correspondence for the frozen parent; do not promote the cache record or replace the parent.',
  'usable-quorum': 'Preparation has fewer usable pairing replies than its configured quorum. Stop the frozen plan and retain the outcomes; any new acquisition needs a registered attempt.',
  fallback: 'Preparation has no endorsed relation and would use the scoring fallback. Stop the frozen plan rather than qualifying fallback scope or replacing the parent.',
  question: 'Preparation evidence names a different current block question. Rebuild the parent and its evidence from the frozen source and archive bytes.',
  result: 'Preparation results do not match replay of their current seat outcomes. Rebuild the recipe from the exact recorded question and outcomes; do not trust supplied summary fields.',
  'unclaimed-target': 'Preparation includes archive blocks without an endorsed relation or deterministic media claim. Existing decline policy does not remove these blocks; stop the plan rather than inventing correspondence.',
  'fast-path': 'Preparation claims a singleton or empty-side path that its current blocks do not support. Rebuild current parent preparation without bypassing its required question.',
};

/**
 * Refusal at the current-evidence qualification seam, not a production fallback policy change.
 *
 * @example
 * ```ts
 * throw new PreparationQualificationError({ kind: 'historical-cache', });
 * ```
 */
export class PreparationQualificationError extends Error {
  /**
   * Fixed diagnostics never contain source or archive passages.
   */
  public readonly messageNamesOnly: true = true;
  /**
   * Machine-readable operation that could not qualify.
   */
  public readonly kind: PreparationQualificationFailure;

  /**
   * Builds a refusal with its complete operation-specific recovery guidance.
   *
   * @param kind - failed qualification invariant
   *
   * @example
   * ```ts
   * new PreparationQualificationError({ kind: 'result', });
   * ```
   */
  public constructor({ kind, }: { readonly kind: PreparationQualificationFailure; },) {
    super(QUALIFICATION_MESSAGES[kind],);
    this.name = 'PreparationQualificationError';
    this.kind = kind;
  }
}

//endregion Preparation qualification refusals
