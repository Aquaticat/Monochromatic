import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type {
  LaneSliceOutcome,
  LaneSliceText,
} from './lane-slice-text.ts';
import { assertWordingCoherent, } from './wording-coherence.ts';

//region Slice delivery
// What became of every slice, in one row: the original, the archive's English,
// what the lane decided, what the document ends up carrying, and WHY those last
// two are what they are.
//
// The lane results already carry the pieces, and a reader cannot join them. A
// wording says what a lane decided and says nothing about whether the document
// kept it; an index set says which slices the document carries a change for and
// nothing about the wording; the source text is in neither, so a grader holding
// an artifact cannot see what was being translated without re-preparing the
// corpus at the right commit with the right budget.
//
// DELIVERY IS ITS OWN VOCABULARY, deliberately not reusing either lane's. A
// repair disposition is the fate of ONE ISSUE's targeted edit, and a translate
// disposition is a slice-local acceptance decision; both can hold several
// values inside one slice whose text ships once. This names the fate of the
// slice TEXT and nothing else.
//
// TWO AXES, since 2026-08-16, because one word could not carry both. What the
// LANE did is its outcome and what the DOCUMENT carries is its delivery, and a
// row states each separately: a run blocked before an anchor never evaluated
// that slice and also leaves a gap there, and the single vocabulary this
// replaced had to report one of those facts and drop the other.

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
 * One slice as a grader needs to read it.
 *
 * @example
 * ```ts
 * const record: SliceDeliveryRecord = {
 *   chunkIndex: 3,
 *   sourceText: '猫猫在睡觉。',
 *   incumbentKind: 'present',
 *   incumbentText: 'The cat sleeps.',
 *   outcome: { kind: 'decided', acceptedText: 'The cat is asleep.', },
 *   shippedText: 'The cat is asleep.',
 *   delivery: { kind: 'replacement-shipped', },
 * };
 * ```
 */
export type SliceDeliveryRecord = {
  /**
   * Global slice index, which every other per-slice record names it by.
   */
  readonly chunkIndex: number;

  /**
   * Original this slice was translated from.
   *
   * Stored as TEXT rather than as offsets, which is not a preference: the
   * artifact keeps neither document, only their lengths, so an offset would
   * need a matching corpus checkout, matching preparation code and a matching
   * slice budget before it meant anything, and could never recover an accepted
   * wording that did not ship.
   */
  readonly sourceText: string;

  /**
   * Whether the archive holds any wording at this slice at all, carried through
   * from the preparation so a reader need not guess it from blank text.
   */
  readonly incumbentKind: 'present' | 'absent';

  /**
   * Archive's own English for this slice.
   */
  readonly incumbentText: string;

  /**
   * What the LANE did about this slice, exactly as the lane reported it.
   */
  readonly outcome: LaneSliceOutcome;

  /**
   * Wording the returned document carries for this slice.
   *
   * Empty where {@link SliceDeliveryRecord.delivery} says the gap remains,
   * which is why that field and not this one answers whether a passage is
   * missing: an empty translation and no translation are the same string.
   */
  readonly shippedText: string;

  /**
   * What the DOCUMENT ends up carrying, and by which route.
   */
  readonly delivery: SliceDelivery;
};

/**
 * Raised when a lane's own reports cannot describe one delivery.
 *
 * @example
 * ```ts
 * throw new SliceDeliveryError({ message: 'slice 2 ships a change nobody accepted', },);
 * ```
 */
export class SliceDeliveryError extends Error {
  /**
   * Builds the failure naming the slice and the contradiction.
   *
   * @param message - what the lane's reports say that cannot both be true
   *
   * @example
   * ```ts
   * throw new SliceDeliveryError({ message: 'slice 2 is shipped and withdrawn', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'SliceDeliveryError';
  }
}

/**
 * Decides what one slice's document text is, from what the lane reported.
 *
 * READS THE LANE'S OWN OUTCOME. It used to infer this from whether the slice
 * was an anchor, which is a fact about the PREPARATION and cannot say whether
 * a lane ran: a repair lane blocked at an anchor was reported as reached and
 * unfillable when nobody had looked at it.
 *
 * @param chunkIndex - slice being described
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
 * const delivery = decideDelivery({ chunkIndex, wording, shipped, withdrawn, blocked, },);
 * ```
 */
function decideDelivery(
  {
    chunkIndex,
    wording,
    shipped,
    withdrawn,
    blocked,
  }: {
    readonly chunkIndex: number;
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
        message: `slice ${String(chunkIndex,)} is named as ${
          shipped ? 'shipped' : 'withdrawn'
        } and reports no decision, so the lane both did and did not reach it`,
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
        message: `slice ${String(chunkIndex,)} is named as shipped and its decision is the archive's `
          + 'own wording, so the document would carry a change nobody made',
      },);
    }
    // A BLOCKED RUN RETURNS THE ARCHIVE UNTOUCHED, whatever any slice decided,
    // so no slice of one can be carrying a replacement. Accepting this pair
    // reported a change as shipped by a document that was never assembled.
    if (blocked) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is named as shipped by a blocked run, which returns the `
          + 'archive untouched, so no slice of it carries a replacement',
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
        message: `slice ${String(chunkIndex,)} is named as withdrawn by assembly on a blocked run, `
          + 'which returns the archive without assembling anything',
      },);
    }

    // A WITHDRAWAL NEEDS SOMETHING TO WITHDRAW. Naming a slice whose decision
    // is the archive's own wording says assembly took back a replacement that
    // was never written, which reads downstream as a lane that tried and was
    // overruled rather than as one that left the slice alone.
    if (!decided) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is named as withdrawn and its decision is the archive's `
          + 'own wording, so there was no replacement for assembly to take back',
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
    message: `slice ${String(chunkIndex,)} decided wording of its own and is named as neither shipped `
      + 'nor withdrawn by a run that was not blocked, so what the document carries there is unstated',
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
function nonNullishAccepted(
  { wording, }: { readonly wording: LaneSliceText; },
): string {
  if (wording.outcome
    .kind
    !== 'decided') {
    throw new SliceDeliveryError({
      message: `slice ${String(wording.chunkIndex,)} ships a replacement and reports no decision`,
    },);
  }
  return wording.outcome
    .acceptedText;
}

/**
 * Refuses an index set that names one slice more than once.
 *
 * TAKES BOTH THE ARRAY AND THE SET rather than deriving the second here, so the
 * caller's own deduplicated set is what the length is compared against. Building
 * a second set to check the first would be checking this function's work instead
 * of the work that matters.
 *
 * @param indices - index set as the lane reported it
 *
 * @param unique - same indices deduplicated, which the caller already built
 *
 * @param named - which set this is, for the message
 *
 * @throws {@link SliceDeliveryError} when a slice is named twice
 *
 * @example
 * ```ts
 * assertNoRepeat({ indices: shippedChunkIndices, unique: shipped, named: 'shipped', },);
 * ```
 */
function assertNoRepeat(
  {
    indices,
    unique,
    named,
  }: {
    readonly indices: readonly number[];
    readonly unique: ReadonlySet<number>;
    readonly named: string;
  },
): void {
  if (indices.length === unique.size)
    return;
  throw new SliceDeliveryError({
    message: `the ${named} set names ${String(indices.length,)} slices and ${
      String(unique.size,)
    } of them are distinct, so it counts at least one slice twice`,
  },);
}

/**
 * Builds one delivery record per prepared slice.
 *
 * BUILT FROM WHAT THE LANE REPORTED rather than recomputed beside it. Every
 * field here is a join of the preparation, the lane's per-slice wordings and
 * its two index sets, so a ledger that disagrees with the returned document is
 * a contradiction inside one result rather than two independent derivations
 * drifting apart.
 *
 * @param slices - prepared slice pairs, which supply the original
 *
 * @param wordings - what the lane decided per slice
 *
 * @param shippedChunkIndices - slices the returned document carries a change
 * for
 *
 * @param withdrawnChunkIndices - slices whose change the assembly guard took
 * back
 *
 * @param blocked - whether the run refused the whole document before assembly,
 * which makes an unshipped decision a withdrawal rather than a contradiction
 *
 * @returns One record per prepared slice, in document order
 *
 * @throws {@link SliceDeliveryError} when the wordings do not cover the
 * preparation one for one, when an index set names a slice twice or names one
 * the preparation never produced, or when a slice's reports contradict
 *
 * @example
 * ```ts
 * const ledger = buildSliceDelivery({ slices, wordings, shippedChunkIndices, withdrawnChunkIndices, blocked, },);
 * ```
 */
export function buildSliceDelivery(
  {
    slices,
    wordings,
    shippedChunkIndices,
    withdrawnChunkIndices,
    blocked,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly wordings: readonly LaneSliceText[];
    readonly shippedChunkIndices: readonly number[];
    readonly withdrawnChunkIndices: readonly number[];
    readonly blocked: boolean;
  },
): readonly SliceDeliveryRecord[] {
  if (wordings.length !== slices.length) {
    throw new SliceDeliveryError({
      message: `lane reported ${String(wordings.length,)} slice wordings against ${
        String(slices.length,)
      } prepared slices, so the two describe different preparations`,
    },);
  }

  /**
   * Slices the document carries a change for.
   */
  const shipped = new Set(shippedChunkIndices,);

  /**
   * Slices whose change was taken back.
   */
  const withdrawn = new Set(withdrawnChunkIndices,);

  // CHECKED AGAINST THE ARRAYS, not the sets built from them. Building a set is
  // what makes a repeated index disappear, so a check that reads the set is
  // asking a question whose answer it has already thrown away, and this
  // function's own contract promised the throw while the sets quietly deduped.
  // A lane naming one slice twice has two derivations that disagree about how
  // many slices it changed, and neither the count nor the ledger would show it.
  assertNoRepeat({
    indices: shippedChunkIndices,
    unique: shipped,
    named: 'shipped',
  },);
  assertNoRepeat({
    indices: withdrawnChunkIndices,
    unique: withdrawn,
    named: 'withdrawn',
  },);

  for (const chunkIndex of shipped) {
    // SHIPPED AND WITHDRAWN AT ONCE is a contradiction rather than a precedence
    // question. The branch order used to answer it silently, in shipped's
    // favour, which reported a change the assembly guard had taken back as one
    // the document carries.
    if (withdrawn.has(chunkIndex,)) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is named as both shipped and withdrawn, so the lane `
          + 'reports the document both carrying its change and having taken it back',
      },);
    }
  }
  /**
   * Indices the preparation actually produced.
   *
   * MEMBERSHIP, not a numeric range. A range check assumes the prepared indices
   * are exactly `0` to `length - 1`, which is a property of today's stamping
   * rather than a contract, so a renumbered preparation would let an index that
   * names no slice pass as in range.
   */
  const preparedIndices = new Set(slices.map(function toIndex(slice,): number {
    return slice.target
      .chunkIndex;
  },),);
  for (const chunkIndex of [
    ...shipped,
    ...withdrawn,
  ]) {
    if (!preparedIndices.has(chunkIndex,)) {
      throw new SliceDeliveryError({
        message: `an index set names slice ${String(chunkIndex,)}, which this preparation of ${
          String(slices.length,)
        } slices never produced`,
      },);
    }
  }

  return slices.map(function toRecord(
    slice,
    position,
  ): SliceDeliveryRecord {
    /**
     * What the lane decided for this position.
     */
    const wording = wordings[position];
    if (wording === undefined)
      throw new SliceDeliveryError({ message: `no wording for slice at position ${String(position,)}`, },);

    /**
     * Index and archive wording this slice carries.
     */
    const {
      chunkIndex,
      text: incumbentText,
    } = slice.target;
    if (wording.chunkIndex !== chunkIndex) {
      throw new SliceDeliveryError({
        message: `slice at position ${String(position,)} is indexed ${
          String(chunkIndex,)
        } and its wording names slice ${String(wording.chunkIndex,)}`,
      },);
    }
    if (wording.incumbentText !== incumbentText) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} carries archive wording its own lane record disagrees `
          + 'with, so the two were built from different preparations',
      },);
    }

    // CHECKED RATHER THAN TAKEN, because the lane and the preparation are two
    // derivations of the same fact and this is the one place holding both. The
    // lane reads it off the prepared chunk today, which makes this agree by
    // construction; what it pins is that it keeps doing so.
    if (
      wording.incumbentKind
        !== (isInsertionChunk(slice.target,) ? 'absent' : 'present')
    ) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is ${
          wording.incumbentKind
        } of archive wording by its lane record and the other way by its prepared chunk`,
      },);
    }

    // THE TWO AXES AGAINST EACH OTHER, which the checks above do not cover:
    // they compare the lane record against the preparation, and this compares
    // the record against itself. `buildLaneSliceTexts` refuses all three of
    // these while building, and a wording reaching here need not have come from
    // it.
    assertWordingCoherent({ wording, },);

    /**
     * What the document carries here, and by which route.
     */
    const delivery = decideDelivery({
      chunkIndex,
      wording,
      shipped: shipped.has(chunkIndex,),
      withdrawn: withdrawn.has(chunkIndex,),
      blocked,
    },);

    return {
      chunkIndex,
      sourceText: slice.source
        .text,
      incumbentKind: wording.incumbentKind,
      incumbentText: wording.incumbentText,
      outcome: wording.outcome,
      shippedText: (delivery.kind === 'replacement-shipped')
        ? nonNullishAccepted({ wording, },)
        : wording.incumbentText,
      delivery,
    };
  },);
}

//endregion Slice delivery
