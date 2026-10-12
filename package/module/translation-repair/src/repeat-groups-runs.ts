import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  BREAK,
  CLAUSE_BOUNDARY,
  MAXIMAL_REPEAT_MINIMUM,
  REFRAIN_CLAUSE_MINIMUM,
  REFRAIN_PREFIX_MINIMUM,
  REFRAIN_SLOT_MAXIMUM,
  REFRAIN_SLOT_MINIMUM,
  REFRAIN_SUFFIX_MINIMUM,
} from './repeat-groups-bounds.ts';
import type {
  Clause,
  WordingStream,
} from './repeat-groups-types.ts';

//region Repeat groups runs
// The finders: maximal runs over the wording stream, the clauses cut from it,
// and the refrain frames two clauses share.

/**
 Whether every occurrence reads the same wording character at one shift from
 its start, and that character is wording rather than a break or the end.

 @param stream - wording stream the occurrences index into

 @param positions - stream index where each occurrence starts

 @param shift - offset from each start, negative to read before it

 @returns Whether all occurrences agree on a wording character there

 @example
 ```ts
 const agrees = agreeAt({ stream, positions: [0, 12,], shift: 12, },);
 ```
 */
function agreeAt(
  {
    stream,
    positions,
    shift,
  }: {
    readonly stream: readonly string[];
    readonly positions: readonly number[];
    readonly shift: number;
  },
): boolean {
  /**
   Character each occurrence reads, a break where the read leaves the stream.
   */
  const reads = positions.map(function readAt(position,): string {
    /**
     Stream index read for this occurrence.
     */
    const index = position + shift;
    if ((index < 0) || (index >= stream.length))
      return BREAK;
    return nonNullishOrThrow(stream[index],);
  },);
  /**
   Character the first occurrence reads, which every other must match.
   */
  const [first,] = reads;
  return (first !== BREAK) && reads.every(function same(read,): boolean {
    return read === first;
  },);
}

/**
 Maximal runs of at least the minimum length that stand at two or more places,
 each with its occurrences as stream indices, the run extended as far as every
 occurrence agrees.

 @param stream - wording stream

 @returns Runs with their length and the stream index where each occurrence starts

 @example
 ```ts
 const runs = maximalRunsOf({ stream, },);
 ```
 */
export function maximalRunsOf(
  {
    stream,
  }: {
    readonly stream: readonly string[];
  },
): readonly {
  readonly length: number;
  readonly starts: readonly number[];
}[] {
  /**
   Stream indices at which each run of the minimum length begins.
   */
  const positionsOf = new Map<string, number[]>();
  for (let index = 0; (index + MAXIMAL_REPEAT_MINIMUM) <= stream.length; index++) {
    /**
     Run of the minimum length beginning at this index.
     */
    const run = stream.slice(
      index,
      index + MAXIMAL_REPEAT_MINIMUM,
    )
      .join('',);
    if (run.includes(BREAK,))
      continue;
    /**
     Positions of this run seen so far.
     */
    const positions = positionsOf.get(run,) ?? [];
    positions.push(index,);
    positionsOf.set(
      run,
      positions,
    );
  }

  /**
   Runs already reported, by length and start positions, since a run is found from each of its parts.
   */
  const reported = new Set<string>();

  /**
   Runs found, before the overlap pass.
   */
  const runs: {
    readonly length: number;
    readonly starts: readonly number[]
  }[] = [];
  for (const positions of positionsOf.values()) {
    if (positions.length < 2)
      continue;

    /**
     Characters the occurrences agree on after the minimum, on the right.
     */
    let right = 0;
    while (agreeAt({
      stream,
      positions,
      shift: MAXIMAL_REPEAT_MINIMUM + right,
    },))
      right++;

    /**
     Characters the occurrences agree on before the run, on the left.
     */
    let left = 0;
    while (agreeAt({
      stream,
      positions,
      shift: -(left + 1),
    },))
      left++;

    /**
     Non-space length of the extended run.
     */
    const length = MAXIMAL_REPEAT_MINIMUM + left
      + right;
    /**
     Occurrence starts after extension, in order, keeping only those that do not overlap the one before.
     */
    const starts = positions
      .map(function extendLeft(position,): number {
        return position - left;
      },)
      .toSorted(function ascending(
        a,
        b,
      ): number {
        return a - b;
      },);
    /**
     Occurrences kept, none overlapping the one before.
     */
    const kept: number[] = [];
    /**
     End of the last kept occurrence, before which the next one overlaps.
     */
    let end = -1;
    for (const start of starts) {
      if (start < end)
        continue;
      kept.push(start,);
      end = start + length;
    }
    if (kept.length < 2)
      continue;
    /**
     Identity of this run for de-duplication.
     */
    const key = `${String(length,)}:${kept.join(',',)}`;
    if (reported.has(key,))
      continue;
    reported.add(key,);
    runs.push({
      length,
      starts: kept,
    },);
  }
  return runs;
}

/**
 Clauses of the wording stream: runs of wording between clause boundaries,
 breaks and the end, of at least the clause minimum.

 @param wording - wording stream of the page

 @param stream - the characters of that stream, as one string per character

 @returns Clauses in page order

 @example
 ```ts
 const clauses = clausesOf({ wording, stream, },);
 ```
 */
export function clausesOf(
  {
    wording,
    stream,
  }: {
    readonly wording: WordingStream;
    readonly stream: readonly string[];
  },
): readonly Clause[] {
  /**
   Clauses found, in page order.
   */
  const clauses: Clause[] = [];

  /**
   Stream index where the clause being read begins.
   */
  let start = 0;
  for (let index = 0; index <= stream.length; index++) {
    /**
     Character ending the clause here, or the end of the stream.
     */
    const edge = (index === stream.length) ? BREAK : nonNullishOrThrow(stream[index],);
    if ((edge !== BREAK) && (!CLAUSE_BOUNDARY.includes(edge,)))
      continue;
    if ((index - start) >= REFRAIN_CLAUSE_MINIMUM) {
      /**
       Characters of the clause, one code point each.
       */
      const points = stream.slice(
        start,
        index,
      );
      clauses.push({
        start,
        end: index,
        points,
        text: points.join('',),
        quoted: nonNullishOrThrow(wording.depths[start],) > 0,
      },);
    }
    start = index + 1;
  }
  return clauses;
}

/**
 Length of the common prefix of two character lists.

 @param a - first list, one code point per element

 @param b - second list, one code point per element

 @returns Count of equal leading characters

 @example
 ```ts
 const shared = commonPrefixLength({ a: [...'猫咪',], b: [...'猫狗',], },);
 ```
 */
function commonPrefixLength({
  a,
  b,
}: {
  readonly a: readonly string[];
  readonly b: readonly string[]
},): number {
  /**
   Count of leading characters equal so far.
   */
  let length = 0;
  while ((length < a.length) && (length < b.length)
    && (a[length] === b[length]))
    length++;
  return length;
}

/**
 Length of the common suffix of two character lists.

 @param a - first list, one code point per element

 @param b - second list, one code point per element

 @returns Count of equal trailing characters

 @example
 ```ts
 const shared = commonSuffixLength({ a: [...'胖猫咪吧',], b: [...'瘦猫咪吧',], },);
 ```
 */
function commonSuffixLength({
  a,
  b,
}: {
  readonly a: readonly string[];
  readonly b: readonly string[]
},): number {
  /**
   Count of trailing characters equal so far.
   */
  let length = 0;
  while (
    (length < a.length)
    && (length < b.length)
      && (a[a.length - 1
        - length] === b[b.length - 1
          - length])
  )
    length++;
  return length;
}

/**
 Refrain frames: clauses that share a prefix and a suffix and differ only in a
 slot of the bounded length, grouped by frame, with the frames that hold at
 least two distinct clauses.

 @param clauses - clauses of the page in page order

 @returns Frames with the clauses carrying each, in page order

 @example
 ```ts
 const frames = refrainFramesOf({ clauses, },);
 ```
 */
export function refrainFramesOf(
  {
    clauses,
  }: {
    readonly clauses: readonly Clause[];
  },
): readonly {
  readonly prefix: string;
  readonly suffix: string;
  readonly prefixLength: number;
  readonly suffixLength: number;
  readonly members: readonly Clause[];
}[] {
  /**
   Clauses that share their first prefix-minimum characters, which is where a frame can begin.
   */
  const buckets = new Map<string, Clause[]>();
  for (const clause of clauses) {
    /**
     Leading characters the clause is bucketed under.
     */
    const lead = clause.points
      .slice(
        0,
        REFRAIN_PREFIX_MINIMUM,
      )
      .join('',);
    /**
     Clauses already in this bucket.
     */
    const bucket = buckets.get(lead,) ?? [];
    bucket.push(clause,);
    buckets.set(
      lead,
      bucket,
    );
  }

  /**
   Clauses carried by each frame, keyed by prefix length, prefix and suffix.
   */
  const frames = new Map<string, {
    readonly prefix: string;
    readonly suffix: string;
    readonly prefixLength: number;
    readonly suffixLength: number;
    readonly members: Set<Clause>;
  }>();
  for (const bucket of buckets.values()) {
    for (const [x, left,] of bucket.entries()) {
      for (const right of bucket.slice(x + 1,)) {
        if (left.text === right.text)
          continue;
        /**
         Shared prefix of the pair, at least the prefix minimum.
         */
        const prefixLength = commonPrefixLength({
          a: left.points,
          b: right.points,
        },);
        /**
         Shared suffix of the pair, capped so each slot keeps one character.
         */
        const suffixLength = Math.min(
          commonSuffixLength({
            a: left.points,
            b: right.points,
          },),
          Math.min(
            left.points
              .length,
            right.points
              .length,
          ) - 1
            - prefixLength,
        );
        if ((prefixLength < REFRAIN_PREFIX_MINIMUM) || (suffixLength < REFRAIN_SUFFIX_MINIMUM))
          continue;
        /**
         Slot length of the first clause.
         */
        const leftSlot = left.points
          .length
          - prefixLength
          - suffixLength;
        /**
         Slot length of the second clause.
         */
        const rightSlot = right.points
          .length
          - prefixLength
          - suffixLength;
        if (
          (leftSlot < REFRAIN_SLOT_MINIMUM)
          || (rightSlot < REFRAIN_SLOT_MINIMUM)
            || (leftSlot > REFRAIN_SLOT_MAXIMUM)
            || (rightSlot > REFRAIN_SLOT_MAXIMUM)
        )
          continue;
        /**
         Prefix the pair shares.
         */
        const prefix = left.points
          .slice(
            0,
            prefixLength,
          )
          .join('',);
        /**
         Suffix the pair shares.
         */
        const suffix = left.points
          .slice(left.points
            .length
            - suffixLength,)
          .join('',);
        /**
         Key of this frame, unambiguous because the prefix length leads it.
         */
        const key = `${String(prefixLength,)}:${prefix}:${suffix}`;
        /**
         Frame record, created on the first pair that forms it.
         */
        const frame = frames.get(key,) ?? {
          prefix,
          suffix,
          prefixLength,
          suffixLength,
          members: new Set<Clause>(),
        };
        frame.members
          .add(left,);
        frame.members
          .add(right,);
        frames.set(
          key,
          frame,
        );
      }
    }
  }

  return [...frames.values(),]
    .filter(function holdsTwo(frame,): boolean {
      return frame.members
        .size
        >= 2;
    },)
    .map(function inPageOrder(frame,) {
      return {
        prefix: frame.prefix,
        suffix: frame.suffix,
        prefixLength: frame.prefixLength,
        suffixLength: frame.suffixLength,
        members: [...frame.members,].toSorted(function byStart(
          a,
          b,
        ): number {
          return a.start - b.start;
        },),
      };
    },);
}

//endregion Repeat groups runs
