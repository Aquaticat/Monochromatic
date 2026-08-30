import type { DestinationCheck, } from './dropped-destinations.ts';

//region Destination completeness

/**
 * Defensive invariant when would-ship page loses source destinations.
 *
 * @example
 * ```ts
 * throw new DroppedDestinationError({ entryId: 'Cat', droppedCount: 1, });
 * ```
 */
export class DroppedDestinationError extends Error {
  /**
   * Message contains operation names and counts only.
   */
  readonly messageNamesOnly: true = true;
  /**
   * Entry whose page failed invariant.
   */
  readonly entryId: string;
  /**
   * Source destinations absent from would-ship page.
   */
  readonly droppedCount: number;

  /**
   * @param entryId - affected entry
   *
   * @param droppedCount - missing destination count
   */
  public constructor(
    {
      entryId,
      droppedCount,
    }: {
      readonly entryId: string;
      readonly droppedCount: number;
    },
  ) {
    super(`entry ${entryId} would drop ${String(droppedCount,)} source destination(s)`,);
    this.name = 'DroppedDestinationError';
    this.entryId = entryId;
    this.droppedCount = droppedCount;
  }
}

/**
 * Refuses persistence when deterministic source floor failed upstream.
 *
 * @param entryId - entry about to publish
 *
 * @param destinations - source and would-ship destination comparison
 *
 * @throws {@link DroppedDestinationError} when any source destination is absent
 *
 * @example
 * ```ts
 * assertDestinationsComplete({ entryId: 'Cat', destinations, });
 * ```
 */
export function assertDestinationsComplete(
  {
    entryId,
    destinations,
  }: {
    readonly entryId: string;
    readonly destinations: DestinationCheck;
  },
): void {
  if (destinations.dropped
    .length
    === 0)
    return;
  throw new DroppedDestinationError({
    entryId,
    droppedCount: destinations.dropped
      .length,
  },);
}

//endregion Destination completeness
