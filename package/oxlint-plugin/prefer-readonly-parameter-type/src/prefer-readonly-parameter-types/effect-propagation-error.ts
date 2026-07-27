/**
 * Failure raised when effect propagation stops while summaries are still growing.
 *
 * @module
 */

/**
 * Raised when the propagation pass bound is exhausted before a fixed point.
 *
 * The bound counts mutable effect bits, while a pass also reports progress for callback
 * relations, element applications and uncertainty provenance, none of which contribute a
 * counted bit. Exhausting the bound therefore means some summary was still growing, and a
 * summary missing effects is what produces a `readonly` offer for written state. Reporting
 * it is the only honest option: returning the partial summaries would claim a proof that
 * nothing established.
 */
export class EffectPropagationError extends Error {
  /**
   * Passes run before the bound was reached.
   */
  readonly passCount: number;

  /**
   * Builds a failure naming the bound that was exhausted.
   *
   * @param passCount - Passes run before bound was reached.
   *
   * @param effectBitCount - Mutable effect bits bound was derived from.
   *
   * @param summaryCount - Callables in propagation set.
   *
   * @example
   * ```ts
   * throw new EffectPropagationError({ passCount: 9, effectBitCount: 8, summaryCount: 3 });
   * ```
   */
  constructor({
    passCount,
    effectBitCount,
    summaryCount,
  }: {
    readonly passCount: number;
    readonly effectBitCount: number;
    readonly summaryCount: number;
  },) {
    super(
      `Effect propagation ran ${String(passCount,)} passes over ${String(summaryCount,)} callables `
        + `without reaching a fixed point, exhausting a bound of ${String(effectBitCount,)} mutable `
        + 'effect bits. A pass reports progress for callback relations, element applications and '
        + 'uncertainty provenance as well as for the effect bits the bound counts, so the bound can '
        + 'be reached while summaries are still growing. Those summaries are missing effects, and a '
        + 'missing effect is what lets this rule offer readonly for a parameter something writes.',
    );
    this.name = 'EffectPropagationError';
    this.passCount = passCount;
  }
}
