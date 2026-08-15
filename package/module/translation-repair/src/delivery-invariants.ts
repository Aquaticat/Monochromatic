import type { ChunkPair, } from './chunk-document.ts';
import type { SliceDeliveryRecord, } from './slice-delivery.ts';
import {
  type SliceReplacement,
  spliceSlices,
} from './splice-slices.ts';

//region Delivery invariants
// The two claims a delivery ledger makes about a document it does not contain.
//
// `buildSliceDelivery` joins three reports from one lane, and every check it
// makes is INSIDE that join: a row cannot say shipped and undecided at once,
// and a shipped row's text is its accepted text by construction. What no row
// can check is whether the join describes the document the lane returned, since
// the document is not one of its inputs.
//
// TWO CLAIMS, then, both of which need the document in hand: the rows marked
// shipped are exactly the slices the result names, and writing those rows over
// the archive reproduces the returned text.
//
// THE SECOND IS THE ONE THAT EARNS ITS KEEP. It crosses from what the lane
// DECIDED, which is where a row's text comes from, to what the document
// CARRIES, which the assembly guard decided; those are two derivations, they
// agree today by construction, and nothing until now made them say so.
//
// A ROW'S TEXT IS NOT A SUBSTRING OF THE DOCUMENT, and the reassembly here
// works because it re-splices through the same assembly rather than because it
// could search for one. Where several slices anchor at one boundary, the blank
// lines between their renderings are composed by assembly and belong to no
// slice, so a reader locating a row's shipped text by searching the document
// would find it for content slices and fail for anchored ones.

/**
 * Raised when a ledger and the document it describes disagree.
 *
 * SEPARATE FROM `SliceDeliveryError`, which is raised while building a ledger
 * from one lane's reports. This one is raised about a ledger that was built
 * successfully and does not describe the document it was joined to, which is a
 * different fault with a different remedy.
 *
 * @example
 * ```ts
 * throw new DeliveryInvariantError({ message: 'ledger does not reassemble the returned document', },);
 * ```
 */
export class DeliveryInvariantError extends Error {
  /**
   * Builds the failure naming what the ledger and the document disagree about.
   *
   * @param message - what the two say that cannot both be true
   *
   * @example
   * ```ts
   * throw new DeliveryInvariantError({ message: 'slice 4 is shipped by one and not the other', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'DeliveryInvariantError';
  }
}

/**
 * Names the indices one list holds and another does not.
 *
 * @param held - indices to check
 *
 * @param against - indices to check them against
 *
 * @returns Those of `held` that `against` does not name, in the order given
 *
 * @example
 * ```ts
 * const extra = indicesMissingFrom({ held: fromLedger, against: claimed, },);
 * ```
 */
function indicesMissingFrom(
  {
    held,
    against,
  }: {
    readonly held: readonly number[];
    readonly against: readonly number[];
  },
): readonly number[] {
  /**
   * Membership test for the list being checked against.
   */
  const known = new Set(against,);
  return held.filter(function isUnknown(index,): boolean {
    return !known.has(index,);
  },);
}

/**
 * Checks a ledger against the document its lane returned.
 *
 * PASS THE RESULT'S OWN REPORTS, not the values a ledger was built from. Where
 * the same index set is handed to both, the first claim holds by construction
 * and costs a comparison; it is worth making anyway, because the case it exists
 * for is a ledger read back from an artifact, or joined to the wrong result,
 * and neither of those can be distinguished from a correct one by reading the
 * rows alone. The second claim is not by construction in either case.
 *
 * @param ledger - delivery rows, one per prepared slice, in document order
 *
 * @param slices - preparation both the ledger and the document were built over
 *
 * @param incumbentText - archive's own translation, which the lane wrote into
 *
 * @param documentText - text that lane returned
 *
 * @param shippedChunkIndices - slices that result names as carrying a change
 *
 * @throws {@link DeliveryInvariantError} when the rows marked shipped are not
 * the slices the result names, or when writing those rows over the archive
 * produces some other document
 *
 * @example
 * ```ts
 * assertDeliveryAgreesWithDocument({
 *   ledger,
 *   slices: prepared.slices,
 *   incumbentText: prepared.targetText,
 *   documentText: repair.repairedText,
 *   shippedChunkIndices: repair.shippedChunkIndices,
 * },);
 * ```
 */
export function assertDeliveryAgreesWithDocument(
  {
    ledger,
    slices,
    incumbentText,
    documentText,
    shippedChunkIndices,
  }: {
    readonly ledger: readonly SliceDeliveryRecord[];
    readonly slices: readonly ChunkPair[];
    readonly incumbentText: string;
    readonly documentText: string;
    readonly shippedChunkIndices: readonly number[];
  },
): void {
  /**
   * Rows saying the document carries this slice's change, in document order.
   */
  const shipped = ledger.filter(function carriesAChange(record,): boolean {
    return record.shipment
      .kind
      === 'replacement-shipped';
  },);

  /**
   * Slices those rows name.
   */
  const fromLedger = shipped.map(function toIndex(record,): number {
    return record.chunkIndex;
  },);

  /**
   * Slices the result names, deduplicated so a repeated index is not read as
   * a disagreement about membership.
   */
  const claimed = [...new Set(shippedChunkIndices,),];

  /**
   * Slices the ledger ships that the result does not name.
   */
  const unclaimed = indicesMissingFrom({
    held: fromLedger,
    against: claimed,
  },);

  /**
   * Slices the result names that the ledger does not ship.
   */
  const unledgered = indicesMissingFrom({
    held: claimed,
    against: fromLedger,
  },);
  if (unclaimed.length > 0) {
    throw new DeliveryInvariantError({
      message: `ledger ships slices ${
        unclaimed.join(', ',)
      } that the result does not name as changed, so one of the two describes another run`,
    },);
  }
  if (unledgered.length > 0) {
    throw new DeliveryInvariantError({
      message: `result names slices ${
        unledgered.join(', ',)
      } as changed and the ledger ships none of them, so one of the two describes another run`,
    },);
  }

  /**
   * Writes those rows describe.
   */
  const replacements = shipped.map(function toReplacement(record,): SliceReplacement {
    return {
      chunkIndex: record.chunkIndex,
      replacementText: record.shippedText,
    };
  },);

  /**
   * Document the rows assemble to, computed here rather than trusted.
   *
   * Through the same assembly the lane used, which is what makes the comparison
   * byte-exact: the separators around an anchored insertion are composed rather
   * than carried by any row, so a concatenation of row texts would differ from
   * the document while nothing was wrong.
   */
  const reassembled = spliceSlices({
    targetText: incumbentText,
    slices,
    replacements,
  },);
  if (reassembled !== documentText) {
    throw new DeliveryInvariantError({
      message: `writing the ledger's ${
        String(replacements.length,)
      } shipped rows over the archive produces a different document than the lane returned, so the `
        + 'rows do not say what the document carries',
    },);
  }
}

//endregion Delivery invariants
