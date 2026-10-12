//region Repeat census control
// The positive control of the census: the entry and the source lines the design
// reads as the live case, which every census of the pinned corpus must find.

/* oxlint-disable no-magic-numbers -- the control lines are the source lines the design cites for the live case, which are data rather than arithmetic */
/**
 Entry the design reads as the live case.
 */
export const CONTROL_ENTRY_ID = 'TianqiChen666';

/**
 Lines of the live case the positive check reads: the refrain's four lines.
 */
export const CONTROL_REFRAIN_LINES: readonly number[] = [
  17,
  25,
  33,
  37,
];

/**
 Lines of the live case the positive check reads for the repeated sentence.
 */
export const CONTROL_MAXIMAL_LINES: readonly number[] = [
  35,
  55,
];
/* oxlint-enable no-magic-numbers */

/**
 Lines a group's occurrences stand on.

 @param occurrences - places the group stands, each with its one-based line

 @returns The line of each occurrence, in the order given

 @example
 ```ts
 const held = occupiedLinesOf({ occurrences: [{ line: 17, },], },);
 ```
 */
export function occupiedLinesOf(
  { occurrences, }: { readonly occurrences: readonly { readonly line: number; }[]; },
): readonly number[] {
  return occurrences.map(function lineOfOccurrence(occurrence,): number {
    return occurrence.line;
  },);
}

/**
 Whether a group stands on every one of the given lines.

 @param held - lines the group has an occurrence on

 @param lines - lines every one of which must be occupied

 @returns Whether each line holds an occurrence of the group

 @example
 ```ts
 const covers = coversAllLines({ held: [17, 25,], lines: [17, 25,], },);
 ```
 */
export function coversAllLines(
  {
    held,
    lines,
  }: {
    readonly held: readonly number[];
    readonly lines: readonly number[];
  },
): boolean {
  return lines.every(function occupied(line,): boolean {
    return held.includes(line,);
  },);
}

//endregion Repeat census control
