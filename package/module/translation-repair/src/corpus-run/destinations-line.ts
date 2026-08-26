import type { DestinationCheck, } from './dropped-destinations.ts';

//region Destinations line
// THE PER-ENTRY LINE THE PASS PRINTS BESIDE ITS TALLY, counts only. The
// addresses themselves are corpus content and stay in the run log, where the
// publisher writes them; stdout carries what a grep over a pass can total.

/**
 * Renders the `DESTINATIONS` line for one published entry.
 *
 * @param entryId - person entry the line is about
 *
 * @param destinations - what the publisher found on both sides
 *
 * @returns One line, `DESTINATIONS <id> source=N page=M dropped=K`, followed by
 * any finding
 *
 * @example
 * ```ts
 * console.log(destinationsLine({ entryId: 'BookshopCat', destinations, },),);
 * ```
 */
export function destinationsLine(
  {
    entryId,
    destinations,
  }: {
    readonly entryId: string;
    readonly destinations: DestinationCheck;
  },
): string {
  /**
   * Destinations the source carries.
   */
  const sourceCount = destinations
    .source
    .length;

  /**
   * Destinations the page carries.
   */
  const pageCount = destinations
    .page
    .length;

  /**
   * Source destinations the page lacks.
   */
  const droppedCount = destinations
    .dropped
    .length;

  /**
   * Findings, each set off by a space, empty when there are none.
   */
  const noted = destinations
    .findings
    .map(function spaced(finding,): string {
      return ` ${finding}`;
    },)
    .join('',);

  return `DESTINATIONS ${entryId} source=${String(sourceCount,)} page=${String(pageCount,)} `
    + `dropped=${String(droppedCount,)}${noted}`;
}

//endregion Destinations line
