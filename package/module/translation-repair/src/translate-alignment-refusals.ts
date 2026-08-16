import { alignmentRefusalFinding, } from './translate-alignment.ts';
import type { TranslateSliceRecord, } from './translate-document-contract.ts';

//region Translate alignment refusals
// The sentence a reader gets for every slice whose replacement the alignment
// guard refused.
//
// Split out of the driver with the assembly it belongs to: it reads settled
// records and builds prose, which is reporting rather than translating, and the
// driver was over its line budget with both.

/**
 * Names what the alignment guard measured, for callers building a report.
 *
 * DERIVED RATHER THAN STORED. The sentence names a slice by its index, and a
 * settled record is keyed by what the models were asked, which since translate
 * version 2 excludes the index. The same record can therefore be resumed at a
 * different position, so the only trustworthy index is the one the record
 * carries after the driver stamps it, which is the one this reads.
 *
 * @param records - settled slice records
 *
 * @returns Refusal findings in the order the slices appear
 *
 * @example
 * ```ts
 * const refusals = alignmentRefusals({ records: result.slices, },);
 * ```
 */
export function alignmentRefusals(
  { records, }: { readonly records: readonly TranslateSliceRecord[]; },
): readonly string[] {
  return records
    .filter(function wasRefused(record,): boolean {
      return record.disposition === 'refused-alignment';
    },)
    .map(function toFinding(record,): string {
      return alignmentRefusalFinding({
        chunkIndex: record.chunkIndex,
        assessment: record.alignment,
      },);
    },);
}

//endregion Translate alignment refusals
