import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type { ContentChunk, } from './chunk-placement.ts';
import { parseDocument, } from './parse-document.ts';
import {
  REFRAIN_SLOT_MAXIMUM,
  REFRAIN_SLOT_MINIMUM,
} from './repeat-groups-bounds.ts';
import {
  clausesOf,
  maximalRunsOf,
  refrainFramesOf,
} from './repeat-groups-runs.ts';
import type {
  FoundRepeat,
  LocatedSpan,
  Placement,
  RepeatGroup,
  RepeatOccurrence,
  Span,
  UnplacedOccurrence,
} from './repeat-groups-types.ts';
import {
  wordingEndAt,
  wordingStreamOf,
} from './repeat-groups-wording.ts';

//region Repeat groups entry
// The public lookup: every repeat of body wording in a page, placed in the
// slices that hold it. Detection is deterministic and judges nothing.

/**
 The slice holding a span whole, or the reason none does.

 @param slices - chunks of the page

 @param span - source span of the occurrence

 @returns The holding slice's index, or why no slice holds the span whole

 @example
 ```ts
 const placement = placementOf({ slices, span, },);
 ```
 */
function placementOf(
  {
    slices,
    span,
  }: {
    readonly slices: readonly ContentChunk[];
    readonly span: Span;
  },
): Placement {
  for (const slice of slices) {
    if ((slice.startOffset > span.startOffset) || (span.startOffset >= slice.endOffset))
      continue;
    if (span.endOffset > slice.endOffset) {
      return {
        kind: 'unplaced',
        reason: 'crosses-slice-end',
      };
    }
    return {
      kind: 'placed',
      sliceIndex: slice.sliceIndex,
    };
  }
  return {
    kind: 'unplaced',
    reason: 'in-no-slice',
  };
}

/**
 One-based line a source offset falls on.

 @param text - full page text

 @param offset - absolute offset in that text

 @returns Line number counted from one

 @example
 ```ts
 const line = lineOf({ text: 'a\nb', offset: 2, },);
 ```
 */
function lineOf(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): number {
  return text.slice(
    0,
    offset,
  )
    .split('\n',)
    .length;
}

/**
 Whether a repeat counts: no occurrence begins inside quoted speech, and its
 occurrences do not all sit on one line.

 @param spans - places the repeat stands

 @param text - full page text, which the line numbers index into

 @returns Whether the repeat is reported

 @example
 ```ts
 const reported = isReported({ spans, text, },);
 ```
 */
function isReported(
  {
    spans,
    text,
  }: {
    readonly spans: readonly Span[];
    readonly text: string;
  },
): boolean {
  if (spans.some(function isQuoted(span,): boolean {
    return span.quoted;
  },))
    return false;
  /**
   Lines the occurrences start on, each once.
   */
  const lines = new Set(spans.map(function lineOfSpan(span,): number {
    return lineOf({
      text,
      offset: span.startOffset,
    },);
  },),);
  return lines.size > 1;
}

/**
 Start offset of a found repeat's first occurrence, which orders the groups.

 @param repeat - found repeat with at least one occurrence

 @returns Absolute offset of its first occurrence

 @example
 ```ts
 const start = firstStartOf(repeat,);
 ```
 */
function firstStartOf(repeat: FoundRepeat,): number {
  return Math.min(...repeat.spans
    .map(function startOf(span,): number {
    return span.startOffset;
  },),);
}

/**
 Places one found repeat in the slices, giving its public shape. An occurrence
 no slice holds whole is reported beside the placed ones, never dropped.

 @param repeat - repeat found in the wording stream, reported

 @param slices - chunks of the page

 @param text - full page text

 @returns Repeat group with each occurrence placed in its slice, or listed as unplaced

 @example
 ```ts
 const group = placedRepeat({ repeat, slices, text, },);
 ```
 */
function placedRepeat(
  {
    repeat,
    slices,
    text,
  }: {
    readonly repeat: FoundRepeat;
    readonly slices: readonly ContentChunk[];
    readonly text: string;
  },
): RepeatGroup {
  /**
   Each span with where the slices put it.
   */
  const located = repeat.spans
    .map(function withPlacement(span,): LocatedSpan {
    return {
      span,
      placement: placementOf({
        slices,
        span,
      },),
      line: lineOf({
        text,
        offset: span.startOffset,
      },),
    };
  },);

  /**
   Occurrences a slice holds whole, with the slot a refrain leaves open.
   */
  const placed = located.flatMap(function placedOnly(here,): readonly (RepeatOccurrence & {
    readonly slotStartOffset: number;
    readonly slotEndOffset: number;
  })[] {
    if (here.placement
      .kind
      !== 'placed')
      return [];
    return [{
      sliceIndex: here.placement
        .sliceIndex,
      startOffset: here.span
        .startOffset,
      endOffset: here.span
        .endOffset,
      line: here.line,
      slotStartOffset: here.span
        .slotStartOffset,
      slotEndOffset: here.span
        .slotEndOffset,
    },];
  },);

  /**
   Occurrences no slice holds whole, with why.
   */
  const unplaced = located.flatMap(function unplacedOnly(here,): readonly UnplacedOccurrence[] {
    if (here.placement
      .kind
      !== 'unplaced')
      return [];
    return [{
      startOffset: here.span
        .startOffset,
      endOffset: here.span
        .endOffset,
      line: here.line,
      reason: here.placement
        .reason,
    },];
  },);
  if (repeat.kind === 'maximal') {
    return {
      kind: 'maximal',
      length: repeat.length,
      occurrences: placed.map(function maximalOccurrence(occurrence,): RepeatOccurrence {
        return {
          sliceIndex: occurrence.sliceIndex,
          startOffset: occurrence.startOffset,
          endOffset: occurrence.endOffset,
          line: occurrence.line,
        };
      },),
      unplaced,
    };
  }
  return {
    kind: 'refrain',
    prefix: repeat.prefix,
    suffix: repeat.suffix,
    slotBounds: {
      minimum: REFRAIN_SLOT_MINIMUM,
      maximum: REFRAIN_SLOT_MAXIMUM,
    },
    occurrences: placed,
    unplaced,
  };
}

/**
 Finds every repeat of source wording in a page, body paragraphs only, and
 places each occurrence in the slice that holds it.

 Repeats are returned in page order of their first occurrence. A group holding
 a quoted occurrence, or whose occurrences all sit on one line, is left out.
 A repeat contained in a longer one is reported on its own where its occurrences
 differ, as the design's census counts them.

 AN OCCURRENCE NO SLICE HOLDS WHOLE IS LISTED, NOT DROPPED AND NOT REFUSED.
 The slices a pass reads cover a page only in part: a section the alignment
 refused has none, and an original the archive's note seals reaches none. Such
 an occurrence lies in `unplaced` with its offsets and why, so a caller sees the
 group's full count and can leave those places as they stand. A group can hold
 fewer than two placed occurrences.

 @param text - full source page text, front matter included

 @param slices - chunks of that page, such as the sources of a pass's slice pairs

 @returns Repeat groups in page order

 @example
 ```ts
 const groups = repeatGroupsOf({ text, slices: chunkByHeadings({ document: parseDocument({ text, },), },), },);
 ```
 */
export function repeatGroupsOf(
  {
    text,
    slices,
  }: {
    readonly text: string;
    readonly slices: readonly ContentChunk[];
  },
): readonly RepeatGroup[] {
  /**
   Parsed page, whose body paragraphs are the only wording read.
   */
  const document = parseDocument({ text, },);

  /**
   Wording stream of the body paragraphs.
   */
  const wording = wordingStreamOf({
    text,
    document,
  },);

  /**
   Wording characters as one string element each, for slicing runs.
   */
  const stream = wording.chars;

  /**
   Maximal repeats, each place a run stands with its quotation flag.
   */
  const maximal: FoundRepeat[] = maximalRunsOf({ stream, },)
    .map(function maximalFound(run,): FoundRepeat {
    return {
      kind: 'maximal',
      prefix: '',
      suffix: '',
      length: run.length,
      spans: run.starts
        .map(function runSpan(start,) {
        /**
         Stream index of the run's last character.
         */
        const last = (start + run.length) - 1;
        return {
          startOffset: nonNullishOrThrow(wording.offsets[start],),
          endOffset: wordingEndAt({
            wording,
            index: last,
          },),
          quoted: nonNullishOrThrow(wording.depths[start],) > 0,
          slotStartOffset: nonNullishOrThrow(wording.offsets[start],),
          slotEndOffset: wordingEndAt({
            wording,
            index: last,
          },),
        };
      },),
    };
  },);

  /**
   Refrain frames, each clause with the slot it leaves open.
   */
  const refrain: FoundRepeat[] = refrainFramesOf({ clauses: clausesOf({
    wording,
    stream,
  },), },)
    .map(
    function refrainFound(frame,): FoundRepeat {
      return {
        kind: 'refrain',
        prefix: frame.prefix,
        suffix: frame.suffix,
        length: 0,
        spans: frame.members
          .map(function clauseSpan(clause,) {
          /**
           Stream index of the clause's last character.
           */
          const last = clause.end - 1;
          return {
            startOffset: nonNullishOrThrow(wording.offsets[clause.start],),
            endOffset: wordingEndAt({
              wording,
              index: last,
            },),
            quoted: clause.quoted,
            slotStartOffset: nonNullishOrThrow(wording.offsets[clause.start + frame.prefixLength],),
            slotEndOffset: wordingEndAt({
              wording,
              index: last - frame.suffixLength,
            },),
          };
        },),
      };
    },
  );

  return [
    ...maximal,
    ...refrain,
  ]
    .filter(function reportedOnly(repeat,): boolean {
      return isReported({
        spans: repeat.spans,
        text,
      },);
    },)
    .toSorted(function inPageOrder(
      a,
      b,
    ): number {
      return firstStartOf(a,) - firstStartOf(b,);
    },)
    .map(function placed(repeat,): RepeatGroup {
      return placedRepeat({
        repeat,
        slices,
        text,
      },);
    },);
}

//endregion Repeat groups entry
