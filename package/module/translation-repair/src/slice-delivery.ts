import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { LaneSliceText, } from './lane-slice-text.ts';

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
// SHIPMENT IS ITS OWN VOCABULARY, deliberately not reusing either lane's. A
// repair disposition is the fate of ONE ISSUE's targeted edit, and a translate
// disposition is a slice-local acceptance decision; both can hold several
// values inside one slice whose text ships once. This names the fate of the
// slice TEXT and nothing else.

/**
 * Why a slice's shipped text is what it is.
 *
 * @example
 * ```ts
 * const shipment: SliceShipment = { kind: 'replacement-shipped', };
 * ```
 */
export type SliceShipment = {
  /**
   * Lane examined the slice and the document carries the archive's own wording:
   * either the lane chose it, or its own decision was to leave it alone.
   */
  readonly kind: 'incumbent-shipped';
} | {
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
   * Lane never reached this slice, so nothing was decided for it and the
   * archive wording stands by default rather than by choice.
   */
  readonly kind: 'not-evaluated';
} | {
  /**
   * Passage is MISSING from the document, and no lane decision could have put
   * it there: the slice is an anchor, so the archive holds no wording for it,
   * and this lane wrote none.
   *
   * A DISTINCT KIND rather than either neighbour, because both would read
   * falsely. `incumbent-shipped` says the document carries the archive's own
   * wording, and here there is none to carry; `not-evaluated` says the lane
   * never reached the slice, which is a different fact with a different
   * remedy, and is what a grader would count as unexamined rather than as
   * still missing.
   */
  readonly kind: 'unfilled';
};

/**
 * One slice as a grader needs to read it.
 *
 * @example
 * ```ts
 * const record: SliceDeliveryRecord = {
 *   chunkIndex: 3,
 *   sourceText: '猫猫在睡觉。',
 *   incumbentText: 'The cat sleeps.',
 *   acceptedText: 'The cat is asleep.',
 *   shippedText: 'The cat is asleep.',
 *   shipment: { kind: 'replacement-shipped', },
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
   * Archive's own English for this slice.
   */
  readonly incumbentText: string;

  /**
   * Wording the lane decided on, absent where it never reached the slice.
   */
  readonly acceptedText?: string;

  /**
   * Wording the returned document carries for this slice.
   */
  readonly shippedText: string;

  /**
   * Why the shipped wording is the one it is.
   */
  readonly shipment: SliceShipment;
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
 * Decides one slice's shipment from what the lane reported about it.
 *
 * @param chunkIndex - slice being described
 *
 * @param wording - what the lane decided for it
 *
 * @param shipped - whether the document carries this slice's change
 *
 * @param withdrawn - whether the assembly guard took that change back
 *
 * @param blocked - whether the whole run refused before assembly
 *
 * @param anchored - whether this slice names a place rather than covering
 * existing text, which decides whether an undecided or unchanged slice leaves
 * the archive's wording standing or leaves a passage missing
 *
 * @returns Shipment naming why the shipped wording is what it is
 *
 * @throws {@link SliceDeliveryError} when the reports contradict each other
 *
 * @example
 * ```ts
 * const shipment = decideShipment({ chunkIndex, wording, shipped, withdrawn, blocked, },);
 * ```
 */
function decideShipment(
  {
    chunkIndex,
    wording,
    shipped,
    withdrawn,
    blocked,
    anchored,
  }: {
    readonly chunkIndex: number;
    readonly wording: LaneSliceText;
    readonly shipped: boolean;
    readonly withdrawn: boolean;
    readonly blocked: boolean;
    readonly anchored: boolean;
  },
): SliceShipment {
  if (wording.acceptedText === undefined) {
    if (shipped || withdrawn) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is named as ${
          shipped ? 'shipped' : 'withdrawn'
        } and reports no decision, so the lane both did and did not reach it`,
      },);
    }
    // An anchor with no decision is not an unexamined slice: there is nothing
    // to examine and nothing to fall back on, so what the document carries
    // there is a gap either way.
    return anchored
      ? { kind: 'unfilled', }
      : { kind: 'not-evaluated', };
  }

  /**
   * Whether the lane's decision moved off the archive at all.
   */
  const decided = wording.acceptedText !== wording.incumbentText;
  if (shipped) {
    if (!decided) {
      throw new SliceDeliveryError({
        message: `slice ${String(chunkIndex,)} is named as shipped and its decision is the archive's `
          + 'own wording, so the document would carry a change nobody made',
      },);
    }
    return { kind: 'replacement-shipped', };
  }
  if (withdrawn) {
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
    // which `incumbent-shipped` would report as the archive being carried.
    return anchored
      ? { kind: 'unfilled', }
      : { kind: 'incumbent-shipped', };
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
 * Reads the accepted wording of a slice whose shipment says it has one.
 *
 * A separate step rather than an assertion at the use site, because the
 * shipment already proves it: `replacement-shipped` is only ever returned for a
 * wording that decided something. This turns that proof into a value without
 * the non-null assertion the repo forbids.
 *
 * @param wording - lane record whose decision is being read
 *
 * @returns That wording
 *
 * @throws {@link SliceDeliveryError} when it is absent, which the shipment
 * decision makes unreachable
 *
 * @example
 * ```ts
 * const text = nonNullishAccepted({ wording, },);
 * ```
 */
function nonNullishAccepted(
  { wording, }: { readonly wording: LaneSliceText; },
): string {
  if (wording.acceptedText === undefined) {
    throw new SliceDeliveryError({
      message: `slice ${String(wording.chunkIndex,)} ships a replacement and reports no decision`,
    },);
  }
  return wording.acceptedText;
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
  for (const chunkIndex of [
    ...shipped,
    ...withdrawn,
  ]) {
    if ((chunkIndex < 0) || (chunkIndex >= slices.length)) {
      throw new SliceDeliveryError({
        message: `an index set names slice ${String(chunkIndex,)} of ${
          String(slices.length,)
        } prepared`,
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

    /**
     * Why this slice's text is what the document carries.
     *
     * READS THE CHUNK for whether the archive holds any wording here, rather
     * than taking a caller's word for it or testing the text for emptiness: the
     * prepared pair is in hand, and it is the only place that distinguishes an
     * anchor from a content span that happens to be blank.
     */
    const shipment = decideShipment({
      chunkIndex,
      wording,
      shipped: shipped.has(chunkIndex,),
      withdrawn: withdrawn.has(chunkIndex,),
      blocked,
      anchored: isInsertionChunk(slice.target,),
    },);

    return {
      chunkIndex,
      sourceText: slice.source
        .text,
      incumbentText: wording.incumbentText,
      ...(wording.acceptedText === undefined ? {} : { acceptedText: wording.acceptedText, }),
      shippedText: (shipment.kind === 'replacement-shipped')
        ? nonNullishAccepted({ wording, },)
        : wording.incumbentText,
      shipment,
    };
  },);
}

//endregion Slice delivery
