import type { EntryCensus, } from './slice-census-entry.ts';
import { sliceCensusTotal, } from './slice-census-total.ts';

//region Slice census unpaired
// HOW MUCH OF THE CORPUS REACHES NO SLICE because the aligner would not pair
// its section, on either side. Those are the calls that never happen, so the
// census names the entries that hold the most.

/**
 How many entries the unpaired-section list names, which is enough to show
 whether that text is one outlier or spread across the corpus.
 */
const UNPAIRED_ENTRIES_LISTED = 5;

/**
 The census lines for the sections the aligner would not pair.

 @param rows - measured entries

 @returns The totals line, then one line for each of the entries holding the
 most unpaired source characters, at most five

 @example
 ```ts
 const lines = sliceCensusUnpairedLines({ rows, },);
 ```
 */
export function sliceCensusUnpairedLines(
  { rows, }: { readonly rows: readonly EntryCensus[]; },
): readonly string[] {
  /**
   Entries carrying a section the aligner would not pair, on either side.
   */
  const unpaired = rows.filter(function hasUnpaired(row,) {
    return (row.unpairedSourceSections > 0)
      || (row.unpairedTargetSections > 0);
  },);
  return [
    `CENSUS unpaired sections reaching no slice: source ${
      String(sliceCensusTotal({
        rows: unpaired,
        field: 'unpairedSourceSections',
      },),)
    }, target ${
      String(sliceCensusTotal({
        rows: unpaired,
        field: 'unpairedTargetSections',
      },),)
    }; entries: ${String(unpaired.length,)}; chars: source ${
      String(sliceCensusTotal({
        rows: unpaired,
        field: 'unpairedSourceChars',
      },),)
    }, target ${
      String(sliceCensusTotal({
        rows: unpaired,
        field: 'unpairedTargetChars',
      },),)
    }`,
    ...unpaired
      .toSorted(function byUnpairedChars(
        left,
        right,
      ): number {
        return right.unpairedSourceChars - left.unpairedSourceChars;
      },)
      .slice(
        0,
        UNPAIRED_ENTRIES_LISTED,
      )
      .map(function unpairedLine(row,): string {
        return `CENSUS   ${row.entryId}: source sections ${
          String(row.unpairedSourceSections,)
        } (chars: ${String(row.unpairedSourceChars,)}), target sections ${
          String(row.unpairedTargetSections,)
        } (chars: ${String(row.unpairedTargetChars,)})`;
      },),
  ];
}

//endregion Slice census unpaired
