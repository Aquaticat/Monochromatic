import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { slicesInOrder, } from './assembly-page-text.ts';
import { monthFirstDates, } from './canadian-date.ts';
import { canadianSpellings, } from './canadian-spelling.ts';
import { protectedRanges, } from './prose-ranges.ts';

//region Canadian forms
// CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): the page is
// Canadian English (class one hundred thirty-two, owner 2026-09-25: "The
// convention is and should be en_CA."), yet the archive's day-first dates
// ("29th April", "On 4 May") and its "liquorice" stood on slices no lane
// rewrote, beside the bench's "March 13". The sheets tell the bench, but
// nothing reads a slice the lanes never replaced. This page-assembly pass
// reads every slice as the page will carry it and writes its dates month
// first and a closed list of words the Canadian way, outside markup, links,
// code and comments. The front matter is published as the archive has it,
// and a span sealed as the English original is carried byte for byte, so
// both stand aside.

/**
 One form the pass changed.
 */
type FormRewrite = {
  readonly start: number;
  readonly end: number;
  readonly from: string;
  readonly to: string;
};

/**
 Rewrites one text's dates and spellings the Canadian way.

 @param text - text as the page would carry it

 @returns Rewritten text and each change as "from" to "to"

 @example
 ```ts
 canadianizeText({ text: 'On 4 May the cat ate liquorice.', },).text; // 'On May 4 the cat ate licorice.'
 ```
 */
export function canadianizeText(
  { text, }: { readonly text: string; },
): {
  readonly text: string;
  readonly changed: readonly string[];
} {
  /**
   The text's non-prose ranges.
   */
  const ranges = protectedRanges({ text, },);
  /**
   Every rewrite, dates and spellings, in order; a date's span never holds a
   listed word, so the two never overlap.
   */
  const rewrites: readonly FormRewrite[] = [
    ...monthFirstDates({
      text,
      ranges,
    },),
    ...canadianSpellings({
      text,
      ranges,
    },),
  ].toSorted(function byStart(
    left,
    right,
  ): number {
    return left.start - right.start;
  },);
  /**
   Text rebuilt around the rewrites.
   */
  const rebuilt = rewrites.reduce(
    function splice(
      built,
      rewrite,
    ): {
      readonly parts: readonly string[];
      readonly from: number
    } {
      return {
        parts: [
          ...built.parts,
          text.slice(
            built.from,
            rewrite.start,
          ),
          rewrite.to,
        ],
        from: rewrite.end,
      };
    },
    {
      parts: [] as readonly string[],
      from: 0,
    },
  );
  return {
    text: [
      ...rebuilt.parts,
      text.slice(rebuilt.from,),
    ].join('',),
    changed: rewrites.map(function describe(rewrite,): string {
      return `"${rewrite.from}" to "${rewrite.to}"`;
    },),
  };
}

/**
 Whether a slice's archive span lies inside any span sealed as the English
 original.

 @param slice - prepared pair

 @param archiveOriginalSpans - sealed spans

 @returns Whether the slice overlaps a sealed span

 @example
 ```ts
 sealed({ slice, archiveOriginalSpans: [], },); // false
 ```
 */
function sealed(
  {
    slice,
    archiveOriginalSpans,
  }: {
    readonly slice: ChunkPair;
    readonly archiveOriginalSpans: readonly ArchiveOriginalSpan[];
  },
): boolean {
  return archiveOriginalSpans.some(function overlaps(span,): boolean {
    return (span.startOffset
      < slice.target
      .endOffset) && (span.endOffset
        > slice.target
        .startOffset);
  },);
}

/**
 Writes every slice's dates and listed spellings the Canadian way, the
 slices no lane replaced included.

 @param slices - prepared pairs, whose archive text stands where no row replaces it

 @param replacements - what the page would write per slice

 @param archiveOriginalSpans - spans sealed as the English original

 @returns Replacements with the forms rewritten (a row added for an archive
 slice the pass changed), the rewritten rows alone, and one finding per
 slice changed

 @example
 ```ts
 const page = canadianizePage({ slices, replacements, archiveOriginalSpans: [], },);
 ```
 */
export function canadianizePage(
  {
    slices,
    replacements,
    archiveOriginalSpans,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
    readonly archiveOriginalSpans: readonly ArchiveOriginalSpan[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   Replacement text by slice.
   */
  const replaced = new Map(replacements.map(function toEntry(row,): readonly [
    number,
    string,
  ] {
    return [
      row.sliceIndex,
      row.replacementText,
    ];
  },),);
  /**
   Rows the pass changed, with the finding each carries.
   */
  const changedRows = slicesInOrder({ slices, },)
    .filter(function eligible(slice,): boolean {
      return (slice.syntax !== 'front-matter') && (!sealed({
        slice,
        archiveOriginalSpans,
      },));
    },)
    .flatMap(function rewrite(slice,): readonly {
      readonly row: SliceReplacement;
      readonly finding: string
    }[] {
      /**
       Text the page carries at this slice.
       */
      const text = replaced.get(slice.target
        .sliceIndex,)
        ?? slice.target
        .text;
      /**
       That text in Canadian forms.
       */
      const canadian = canadianizeText({ text, },);
      if (canadian.changed
        .length
        === 0)
        return [];
      return [{
        row: {
          sliceIndex: slice.target
            .sliceIndex,
          replacementText: canadian.text,
        },
        finding: `canadian-form-rewritten (slice ${String(slice.target
          .sliceIndex,)}: ${canadian.changed
            .join(', ',)})`,
      },];
    },);
  /**
   Rewritten text by slice.
   */
  const rewritten = new Map(changedRows.map(function toEntry({ row, },): readonly [
    number,
    SliceReplacement,
  ] {
    return [
      row.sliceIndex,
      row,
    ];
  },),);
  return {
    replacements: [
      ...replacements.map(function swap(row,): SliceReplacement {
        return rewritten.get(row.sliceIndex,) ?? row;
      },),
      ...changedRows
        .filter(function added({ row, },): boolean {
          return !replaced.has(row.sliceIndex,);
        },)
        .map(function rowOf({ row, },): SliceReplacement {
          return row;
        },),
    ],
    restored: changedRows.map(function rowOf({ row, },): SliceReplacement {
      return row;
    },),
    findings: changedRows.map(function findingOf({ finding, },): string {
      return finding;
    },),
  };
}
//endregion Canadian forms
