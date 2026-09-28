import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import type { DestinationCheck, } from './dropped-destinations.ts';

//region Destination completeness
// THE REFUSAL TRACES WHAT IT REFUSES (ledger E1). It used to say only how many
// destinations a page would drop, after every stage had spent; XingZ6011 lost
// 96 minutes on 2026-09-26 to a refusal its log could not identify. Each
// dropped address is traced to the slices whose original carries it, whose
// archive span carries it, and whose shipped text carries it: the address
// itself is corpus content and goes to the run log, the slice indices go into
// the message.

/**
 Where one dropped destination sits among the slices.

 @example
 ```ts
 const trace: DroppedDestinationTrace = { sourceSlices: [4,], archiveSlices: [], shippedSlices: [], };
 ```
 */
export type DroppedDestinationTrace = Readonly<{
  /**
   Slices whose original carries it; empty when it sits outside every slice.
   */
  sourceSlices: readonly number[];

  /**
   Slices whose archive span carries it.
   */
  archiveSlices: readonly number[];

  /**
   Slices whose shipped text carries it, empty since the page drops it.
   */
  shippedSlices: readonly number[];
}>;

/**
 Whether a text carries an address, a trailing slash aside, as
 `sameAddress` treats two spellings.

 @param text - text to search

 @param address - destination to look for

 @returns Whether it is there

 @example
 ```ts
 carries({ text: 'see https://example.org/', address: 'https://example.org', },); // true
 ```
 */
function carries(
  {
    text,
    address,
  }: {
    readonly text: string;
    readonly address: string;
  },
): boolean {
  /**
   The address less a trailing slash.
   */
  const bare = address.endsWith('/',)
    ? address.slice(
      0,
      -1,
    )
    : address;
  return text.includes(bare,);
}

/**
 One side of one slice: its index and the text that side carries.

 @example
 ```ts
 const side: SliceText = { sliceIndex: 4, text: 'She naps.', };
 ```
 */
type SliceText = Readonly<{
  /**
   Slice the text belongs to.
   */
  sliceIndex: number;

  /**
   What that side carries there.
   */
  text: string;
}>;

/**
 Slices whose text on one side carries an address.

 @param side - every slice's text on that side

 @param address - destination to look for

 @returns Slice indices, in slice order

 @example
 ```ts
 const sources = slicesCarrying({ side: originals, address, },);
 ```
 */
function slicesCarrying(
  {
    side,
    address,
  }: {
    readonly side: readonly SliceText[];
    readonly address: string;
  },
): readonly number[] {
  return side
    .filter(function carriesIt({ text, },): boolean {
      return carries({
        text,
        address,
      },);
    },)
    .map(function indexOf({ sliceIndex, },): number {
      return sliceIndex;
    },);
}

/**
 Traces every dropped destination to the slices that carry it on each side.

 @param dropped - destinations the page does not carry

 @param slices - preparation the page was spliced over

 @param replacements - rows the page writes, by slice

 @returns One trace per dropped destination, in the order given

 @example
 ```ts
 const traces = traceDroppedDestinations({ dropped: destinations.dropped, slices, replacements, },);
 ```
 */
export function traceDroppedDestinations(
  {
    dropped,
    slices,
    replacements,
  }: {
    readonly dropped: readonly string[];
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): readonly DroppedDestinationTrace[] {
  /**
   Every slice's original.
   */
  const originals = slices.map(function originalOf({
    source,
    target,
  },): SliceText {
    return {
      sliceIndex: target.sliceIndex,
      text: source.text,
    };
  },);
  /**
   Every slice's archive span.
   */
  const archives = slices.map(function archiveOf({ target, },): SliceText {
    return {
      sliceIndex: target.sliceIndex,
      text: target.text,
    };
  },);
  /**
   What every slice ships: its row where one is written, else its archive span.
   */
  const shipped = archives.map(function shippedOf(archive,): SliceText {
    /**
     The row written at this slice, if any.
     */
    const row = replacements.find(function writesHere({ sliceIndex, },): boolean {
      return sliceIndex === archive.sliceIndex;
    },);
    return (row === undefined)
      ? archive
      : {
        sliceIndex: archive.sliceIndex,
        text: row.replacementText,
      };
  },);
  return dropped.map(function trace(address,): DroppedDestinationTrace {
    return {
      sourceSlices: slicesCarrying({
        side: originals,
        address,
      },),
      archiveSlices: slicesCarrying({
        side: archives,
        address,
      },),
      shippedSlices: slicesCarrying({
        side: shipped,
        address,
      },),
    };
  },);
}

/**
 Says where the original carries the dropped destinations, for a message.

 @param traces - one trace per dropped destination

 @returns A clause naming the slices, or saying they sit outside every slice

 @example
 ```ts
 whereCarried({ traces, },); // 'carried by the original in slice 4'
 ```
 */
function whereCarried(
  { traces, }: { readonly traces: readonly DroppedDestinationTrace[]; },
): string {
  /**
   Every slice whose original carries one, once each, in order.
   */
  const slices = [...new Set(traces.flatMap(function sourcesOf({ sourceSlices, },): readonly number[] {
    return sourceSlices;
  },),),].toSorted(function ascending(
    left,
    right,
  ): number {
    return left - right;
  },);
  return (slices.length === 0)
    ? 'carried by the original outside every slice'
    : `carried by the original in slice ${slices.map(String,)
      .join(', ',)}`;
}

/**
 Defensive invariant when would-ship page loses source destinations.

 @example
 ```ts
 throw new DroppedDestinationError({ entryId: 'Cat', droppedCount: 1, traces, });
 ```
 */
export class DroppedDestinationError extends Error {
  /**
   Message contains operation names, counts and slice indices only.
   */
  readonly messageNamesOnly: true = true;
  /**
   Entry whose page failed invariant.
   */
  readonly entryId: string;
  /**
   Source destinations absent from would-ship page.
   */
  readonly droppedCount: number;
  /**
   Where each dropped destination sits among the slices.
   */
  readonly traces: readonly DroppedDestinationTrace[];

  /**
   @param entryId - affected entry

   @param droppedCount - missing destination count

   @param traces - where each dropped destination sits
   */
  public constructor(
    {
      entryId,
      droppedCount,
      traces,
    }: {
      readonly entryId: string;
      readonly droppedCount: number;
      readonly traces: readonly DroppedDestinationTrace[];
    },
  ) {
    super(
      `entry ${entryId} would drop ${String(droppedCount,)} source destination(s), ${whereCarried({ traces, },)}`,
    );
    this.name = 'DroppedDestinationError';
    this.entryId = entryId;
    this.droppedCount = droppedCount;
    this.traces = traces;
  }
}

/**
 Refuses persistence when deterministic source floor failed upstream.

 @param entryId - entry about to publish

 @param destinations - source and would-ship destination comparison

 @param traces - where each dropped destination sits, for the refusal

 @throws {@link DroppedDestinationError} when any source destination is absent

 @example
 ```ts
 assertDestinationsComplete({ entryId: 'Cat', destinations, traces, });
 ```
 */
export function assertDestinationsComplete(
  {
    entryId,
    destinations,
    traces,
  }: {
    readonly entryId: string;
    readonly destinations: DestinationCheck;
    readonly traces: readonly DroppedDestinationTrace[];
  },
): void {
  if (destinations.dropped
    .length
    === 0)
    return;
  throw new DroppedDestinationError({
    entryId,
    droppedCount: destinations.dropped
      .length,
    traces,
  },);
}

//endregion Destination completeness
