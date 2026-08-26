import type { LaneSliceText, } from './lane-slice-text.ts';
import { SliceDeliveryError, } from './slice-delivery-fault.ts';

//region Slice delivery decision
// What one slice's delivery is, decided from its wording, the two index sets
// and whether the run was blocked. Moved out of `slice-delivery.ts`, which
// keeps the ledger row and its builder, when that file crossed the length
// limit.

/**
 * What the returned document carries at one slice.
 *
 * ONE AXIS, and deliberately not the only one a record needs. This says what
 * the DOCUMENT ends up with; {@link LaneSliceOutcome} says what the LANE did,
 * and they are independent facts one word cannot hold. A repair lane blocked
 * before an anchor never evaluated that slice AND leaves a gap there; the
 * single vocabulary this replaced had to report one of those and lose the
 * other.
 *
 * @example
 * ```ts
 * const delivery: SliceDelivery = { kind: 'replacement-shipped', };
 * ```
 */
export type SliceDelivery = {
  /**
   * Document carries what the lane decided, which differs from the archive.
   */
  readonly kind: 'replacement-shipped';
} | {
  /**
   * Lane decided a replacement and the document does not carry it.
   */
  readonly kind: 'replacement-withdrawn';

  /**
   * Which mechanism took it back.
   *
   * `assembly-integrity` is the guard, per slice, after splicing.
   * `blocked-non-translation` is the whole-document refusal, which returns the
   * archive untouched whatever any slice decided.
   */
  readonly reason: 'assembly-integrity' | 'blocked-non-translation';
} | {
  /**
   * Document carries the archive's own wording for this slice.
   *
   * Says nothing about WHY, which is the outcome's job: the lane may have
   * examined the slice and kept it, may never have reached it, or may have
   * heard no voice at all. All three leave the same text in the document and
   * mean three different things about the run.
   */
  readonly kind: 'incumbent-retained';
} | {
  /**
   * Passage is MISSING from the document, and nothing could have kept it there:
   * the archive holds no wording for this slice and this lane wrote none.
   */
  readonly kind: 'gap-remains';
};

/**
 * Decides what one slice's document text is, from what the lane reported.
 *
 * READS THE LANE'S OWN OUTCOME. It used to infer this from whether the slice
 * was an anchor, which is a fact about the PREPARATION and cannot say whether
 * a lane ran: a repair lane blocked at an anchor was reported as reached and
 * unfillable when nobody had looked at it.
 *
 * @param sliceIndex - slice being described
 *
 * @param wording - what the lane reported for it
 *
 * @param shipped - whether the document carries this slice's change
 *
 * @param withdrawn - whether the assembly guard took that change back
 *
 * @param blocked - whether the whole run refused before assembly
 *
 * @returns What the document carries here, and by which route
 *
 * @throws {@link SliceDeliveryError} when the reports contradict each other
 *
 * @example
 * ```ts
 * const delivery = decideDelivery({ sliceIndex, wording, shipped, withdrawn, blocked, },);
 * ```
 */
export function decideDelivery(
  {
    sliceIndex,
    wording,
    shipped,
    withdrawn,
    blocked,
  }: {
    readonly sliceIndex: number;
    readonly wording: LaneSliceText;
    readonly shipped: boolean;
    readonly withdrawn: boolean;
    readonly blocked: boolean;
  },
): SliceDelivery {
  if (wording.outcome
    .kind
    !== 'decided') {
    if (shipped || withdrawn) {
      throw new SliceDeliveryError({
        fault: {
          kind: 'named-without-decision',
          sliceIndex,
          set: shipped ? 'shipped' : 'withdrawn',
        },
      },);
    }
    // WHAT THE DOCUMENT CARRIES, which the archive answers and the outcome does
    // not: an unreached slice and an unheard one both leave the incumbent
    // standing wherever there is one, and leave the gap wherever there is not.
    return (wording.incumbentKind === 'absent')
      ? { kind: 'gap-remains', }
      : { kind: 'incumbent-retained', };
  }

  /**
   * Whether the lane's decision moved off the archive at all.
   */
  const decided = wording.outcome
    .acceptedText
    !== wording.incumbentText;
  if (shipped) {
    if (!decided) {
      throw new SliceDeliveryError({
        fault: {
          kind: 'shipped-archive-wording',
          sliceIndex,
        },
      },);
    }
    // A BLOCKED RUN RETURNS THE ARCHIVE UNTOUCHED, whatever any slice decided,
    // so no slice of one can be carrying a replacement. Accepting this pair
    // reported a change as shipped by a document that was never assembled.
    if (blocked) {
      throw new SliceDeliveryError({
        fault: {
          kind: 'shipped-on-blocked',
          sliceIndex,
        },
      },);
    }
    return { kind: 'replacement-shipped', };
  }
  if (withdrawn) {
    // ASSEMBLY NEVER RAN. The blocked exit returns the archive before anything
    // is assembled, so nothing there can have been taken back BY assembly, and
    // the two withdrawals are the events a reader counting integrity damage has
    // to tell apart. Naming both files a refusal under the guard's name.
    if (blocked) {
      throw new SliceDeliveryError({
        fault: {
          kind: 'withdrawn-on-blocked',
          sliceIndex,
        },
      },);
    }

    // A WITHDRAWAL NEEDS SOMETHING TO WITHDRAW. Naming a slice whose decision
    // is the archive's own wording says assembly took back a replacement that
    // was never written, which reads downstream as a lane that tried and was
    // overruled rather than as one that left the slice alone.
    if (!decided) {
      throw new SliceDeliveryError({
        fault: {
          kind: 'withdrawn-archive-wording',
          sliceIndex,
        },
      },);
    }
    return {
      kind: 'replacement-withdrawn',
      reason: 'assembly-integrity',
    };
  }
  if (!decided) {
    // The archive's own wording stands, except where the archive has none:
    // agreeing with a blank incumbent at an anchor leaves the passage missing,
    // which `incumbent-retained` would report as the archive being carried.
    return (wording.incumbentKind === 'absent')
      ? { kind: 'gap-remains', }
      : { kind: 'incumbent-retained', };
  }
  if (blocked)
    return {
      kind: 'replacement-withdrawn',
      reason: 'blocked-non-translation',
    };
  throw new SliceDeliveryError({
    fault: {
      kind: 'decided-unstated',
      sliceIndex,
    },
  },);
}

/**
 * Reads the accepted wording of a slice whose delivery says it has one.
 *
 * A separate step rather than an assertion at the use site, because the
 * delivery already proves it: `replacement-shipped` is only ever returned for a
 * wording that decided something. This turns that proof into a value without
 * the non-null assertion the repo forbids.
 *
 * @param wording - lane record whose decision is being read
 *
 * @returns That wording
 *
 * @throws {@link SliceDeliveryError} when the outcome is not a decision, which
 * the delivery decision makes unreachable
 *
 * @example
 * ```ts
 * const text = nonNullishAccepted({ wording, },);
 * ```
 */
export function nonNullishAccepted(
  { wording, }: { readonly wording: LaneSliceText; },
): string {
  if (wording.outcome
    .kind
    !== 'decided') {
    throw new SliceDeliveryError({
      fault: {
        kind: 'ships-without-decision',
        sliceIndex: wording.sliceIndex,
      },
    },);
  }
  return wording.outcome
    .acceptedText;
}

//endregion Slice delivery decision
