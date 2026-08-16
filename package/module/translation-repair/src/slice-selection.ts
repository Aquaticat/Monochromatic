import type { CandidateProducer, } from './candidate-select-model.ts';
import type { TranslateSliceRecord, } from './translate-document-contract.ts';

//region Slice selection
// Who won each slice, and whether the document kept it.
//
// WHY A COUNT WAS NOT ENOUGH. The lane already reported how many slices changed
// and which indices shipped, and neither says who the text came from or how the
// judges got there. Every question anyone has asked of this lane since is per
// slice and per producer: how often the archive's English was kept, whether a
// producer favours its own rendering, whether ballot position moves a verdict.
// `#83` asked for this, and `#84` could only answer its half on a bench because
// no settled artifact carries it.
//
// TWO FACTS THAT COME APART, and keeping them apart is the point. "The incumbent
// won selection" is a decision the judges made. "The incumbent shipped
// unchanged" is what the document ended up carrying, and the assembly guard can
// withdraw a replacement the judges chose. A reader with one number cannot tell
// a slice the archive won from a slice where it lost and was reinstated.

/**
 * What one slice decided, and what the document did with it.
 *
 * @example
 * ```ts
 * const selection: SliceSelection = { chunkIndex: 7, origin: 'fresh', decision: 'judged', voteWeight: 2, shipped: true, producer, };
 * ```
 */
export type SliceSelection = {
  /**
   * Slice this describes, in document order.
   */
  readonly chunkIndex: number;

  /**
   * Whether the winning text was the archive's or freshly written.
   */
  readonly origin: string;

  /**
   * Who wrote the winning text, carrying every model with a stake in it.
   */
  readonly producer: CandidateProducer;

  /**
   * How the round ended: judged, sole candidate, no candidate, or which decline.
   */
  readonly decision: string;

  /**
   * Weight the winner drew, zero on every path that did not reach a ballot.
   */
  readonly voteWeight: number;

  /**
   * Whether the DOCUMENT carries this slice's decision.
   *
   * False on two different slices and the difference matters: one whose judges
   * kept the archive, so there was never anything to ship, and one whose
   * replacement the assembly guard withdrew. {@link SliceSelection.origin}
   * separates them, which is why both fields are here.
   */
  readonly shipped: boolean;
};

/**
 * Pairs every settled record with whether the document carries its decision.
 *
 * TAKES THE SHIPPED SET RATHER THAN RE-DERIVING IT, because the set is derived
 * from the assembled bytes and a second derivation from the records would
 * answer a different question: a record says what the slice CHOSE, and the
 * document says what it CARRIES. Those disagree exactly where the assembly
 * guard intervened, which is the case this ledger exists to make visible.
 *
 * @param records - settled slice records in document order
 *
 * @param shippedChunkIndices - slices the assembled document carries a
 * replacement for
 *
 * @returns One entry per record, in the order the records arrived
 *
 * @example
 * ```ts
 * const selections = buildSliceSelections({ records: settled, shippedChunkIndices: ordered.shipped, },);
 * ```
 */
export function buildSliceSelections(
  {
    records,
    shippedChunkIndices,
  }: {
    readonly records: readonly TranslateSliceRecord[];
    readonly shippedChunkIndices: readonly number[];
  },
): readonly SliceSelection[] {
  /**
   * Shipped indices keyed for membership, since a document of any size makes
   * repeated scans of an array the wrong shape.
   */
  const shipped = new Set(shippedChunkIndices,);

  return records.map(function toSelection(record,): SliceSelection {
    return {
      chunkIndex: record.chunkIndex,
      origin: record.stageResult
        .origin,
      producer: record.stageResult
        .producer,
      decision: record.stageResult
        .decision,
      voteWeight: record.stageResult
        .voteWeight,
      shipped: shipped.has(record.chunkIndex,),
    };
  },);
}

//endregion Slice selection
