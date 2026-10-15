/**
 Internal recorded failure tokens distinguish propagation from a fresh original occurrence. @module
 */
import type { GroupFailureOccurrence } from './group-failure-types.ts';

/**
 Internal delivery token preserves the original retained occurrence without replacing its error value.
 */
export class RecordedGroupFailureError extends Error {
  /**
   Stable diagnostic category names the internal recorded token rather than the underlying failure.
   */
  override readonly name: string = 'RecordedGroupFailureError';

  /**
   Original public occurrence field is read by the collector when rejecting pending delivery.
   */
  readonly occurrence: GroupFailureOccurrence;

  /**
   Bind one already recorded occurrence to an internal control-flow token.

   @param occurrence - original failure identity, ordinal, boundary, and caught value
   */
  constructor(occurrence: GroupFailureOccurrence) {
    super('Declared group failure already recorded');
    this.occurrence = occurrence;
  }
}
