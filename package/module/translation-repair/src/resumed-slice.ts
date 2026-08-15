//region Resumed slice check
// Whether a cached slice record still describes the slice it is being resumed
// for, on the one question its own fields can answer.
//
// A resumed record is otherwise trusted on its chunk index alone. Both lanes
// store a decided text beside a boolean saying whether that text differs from
// the archive's, and those two can contradict each other: a truncated write
// that still parses, a hand edit, or a slicing that moved while the key did not
// all produce a record whose flag and text disagree.
//
// CHECKED WHERE THE RECORD IS ACCEPTED rather than only at assembly. The
// assembly assertions catch the same contradiction, but they catch it after
// every other slice has been bought, and they fail the whole document. One bad
// cache file should cost one slice: discarded here, the slice is simply
// recomputed, and the run settles normally.
//
// BOTH DIRECTIONS. A record claiming a change it did not make would ship a
// count nobody can reproduce; a record denying a change it DID make would have
// its text quietly dropped at assembly, since only `changed` records become
// replacements. The second is the quieter defect of the two.

/**
 * Lane a discarded record belonged to, which its finding names.
 *
 * @example
 * ```ts
 * const lane: ResumedSliceLane = 'translate';
 * ```
 */
export type ResumedSliceLane =
  /**
   * Repair lane, whose records are `ChunkRepairOutcome`.
   */
  | 'repair'
  /**
   * Translate lane, whose records are `TranslateSliceRecord`.
   */
  | 'translate';

/**
 * Whether a cached record's changed flag agrees with its own text.
 *
 * @param changed - what the record claims about itself
 *
 * @param decidedText - wording the record carries
 *
 * @param incumbentText - archive wording of the slice being resumed
 *
 * @returns Whether the record may be resumed
 *
 * @example
 * ```ts
 * const usable = resumedSliceAgrees({ changed, decidedText, incumbentText, },);
 * ```
 */
export function resumedSliceAgrees(
  {
    changed,
    decidedText,
    incumbentText,
  }: {
    readonly changed: boolean;
    readonly decidedText: string;
    readonly incumbentText: string;
  },
): boolean {
  return changed === (decidedText !== incumbentText);
}

/**
 * Names a discarded record so a reader can tell it from a cache miss.
 *
 * A slice recomputed because its cached record was refused costs the same calls
 * as one never cached, and the two are indistinguishable in a run log without
 * this. Which way the record contradicted itself is stated, since a record that
 * over-claims and one that under-claims fail for different reasons.
 *
 * @param lane - which lane's cache the record came from
 *
 * @param chunkIndex - slice it was resumed for
 *
 * @param changed - what the record claimed, which the wording explains
 *
 * @returns Finding in scorecard-stable wording
 *
 * @example
 * ```ts
 * findings.push(resumedSliceDiscardFinding({ lane: 'translate', chunkIndex, changed, },),);
 * ```
 */
export function resumedSliceDiscardFinding(
  {
    lane,
    chunkIndex,
    changed,
  }: {
    readonly lane: ResumedSliceLane;
    readonly chunkIndex: number;
    readonly changed: boolean;
  },
): string {
  return `${lane}-discarded-contradictory-slice chunk ${
    String(chunkIndex,)
  }; cached record claims changed=${String(changed,)} and carries the ${
    changed ? 'archive wording' : 'wording of a change'
  }, so it was recomputed`;
}

//endregion Resumed slice check
