import { isInsertionChunk, } from '../chunk-placement.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { ParsedTwoLaneArtifact, } from './artifact-two-lane-read-contract.ts';
import type { ArtifactDeliveryRow, } from './artifact-two-lane-vocabulary.ts';

//region Rebuild rows
// WHETHER A REBUILD IS THE RUN'S CARVE, read off the rows the artifact records
// (ledger A12). The recorded identity cannot answer it: it also hashes the
// identity context and the line-structure flags, which today's rules derive
// afresh, so every settled artifact tested differed from its rebuild while
// mikaela17's rows matched slice for slice. The rows are what the run carved:
// each slice's index, original, placement and archive span.

/**
 First way one recorded row differs from the rebuilt slice at its position.

 @param row - row the run recorded

 @param slice - slice the rebuild carved there

 @returns What differs, empty where nothing does

 @example
 ```ts
 const moved = rowDivergence({ row, slice, },);
 ```
 */
function rowDivergence(
  {
    row,
    slice,
  }: {
    readonly row: ArtifactDeliveryRow;
    readonly slice: ChunkPair;
  },
): string {
  /**
   Rebuilt original and archive sides.
   */
  const {
    source,
    target,
  } = slice;
  if (row.sliceIndex !== target.sliceIndex)
    return `index ${String(target.sliceIndex,)} where the run recorded ${String(row.sliceIndex,)}`;
  if (row.sourceText !== source.text)
    return 'another original';
  if ((row.incumbentKind === 'absent') !== isInsertionChunk(target,))
    return (row.incumbentKind === 'absent') ? 'archive text where the run had none' : 'no archive text where the run had some';
  if (row.incumbentText !== target.text)
    return 'another archive span';
  return '';
}

/**
 How a rebuilt carve departs from the one the artifact records.

 @param artifact - artifact whose repair ledger records the run's carve

 @param prepared - carve the rebuild produced

 @returns The first departure, empty when every row matches

 @example
 ```ts
 const divergence = carveDivergence({ artifact, prepared, },);
 ```
 */
export function carveDivergence(
  {
    artifact,
    prepared,
  }: {
    readonly artifact: ParsedTwoLaneArtifact;
    readonly prepared: PreparedDocumentPair;
  },
): string {
  /**
   Rows the run recorded, one per slice it carved.
   */
  const { delivery: rows, } = artifact.lanes
    .repair;
  /**
   Slices the rebuild carved.
   */
  const { slices, } = prepared;
  if (rows.length !== slices.length)
    return `${String(slices.length,)} slices rebuilt where the run recorded ${String(rows.length,)}`;
  /**
   Each position's departure, empty where it matches.
   */
  const departures = slices.map(function departureAt(
    slice,
    position,
  ): string {
    /**
     Row the run recorded at this position.
     */
    const row = rows[position];
    return (row === undefined)
      ? 'no recorded row'
      : rowDivergence({
        row,
        slice,
      },);
  },);
  /**
   First position that departs, -1 for none.
   */
  const first = departures.findIndex(function departs(departure,): boolean {
    return departure !== '';
  },);
  return (first === (-1))
    ? ''
    : `slice at position ${String(first,)} has ${departures[first] ?? ''}`;
}

//endregion Rebuild rows
