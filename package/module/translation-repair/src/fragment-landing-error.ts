//region Fragment landing error
// A LANDING THAT LIES OUTSIDE ITS SLICE, OR ENDS BEFORE IT STARTS (n160, Y7). A fragment of a slice is read in the slice with the
// fragment written over the region it replaces (`fragmentProseMask`, `typography-prose-mask.ts`). The region is the slice's own,
// found by `apply-patch.ts` only after the envelope's current text matched its base text, so no run reaches a bad landing; a mask
// built from one would be read as the mask of no prose at all, or as a refusal of the page grammar about a slice that parses, and a
// typography rule would then stay silent or log a wrong cause. Throwing names the broken invariant instead.

/**
 A landing of a fragment that lies outside its slice or ends before it starts.

 @example
 ```ts
 throw new FragmentLandingError({ slice: 24, start: 30, end: 31, },);
 ```
 */
export class FragmentLandingError extends Error {
  /**
   Message names offsets and lengths only, never text of the page.
   */
  readonly messageNamesOnly: true = true;

  /**
   @param slice - length of the slice the fragment lands in

   @param start - offset where the replaced region starts

   @param end - exclusive offset where it ends
   */
  constructor(
    {
      slice,
      start,
      end,
    }: {
      readonly slice: number;
      readonly start: number;
      readonly end: number;
    },
  ) {
    super(
      `unreachable: a fragment lands at ${String(start,)} to ${String(end,)} in a slice of ${
        String(slice,)
      } units, and a landing starts at 0 or later, ends at or after its start, and ends within the slice`,
    );
    this.name = 'FragmentLandingError';
  }
}

/**
 Throws when a landing lies outside its slice or ends before it starts.

 @param slice - length of the slice the fragment lands in

 @param start - offset where the replaced region starts

 @param end - exclusive offset where it ends

 @throws {@link FragmentLandingError} when the region starts before the slice, ends before it starts, or ends past the slice

 @example
 ```ts
 assertLandingInside({ slice: 24, start: 8, end: 20, },);
 ```
 */
export function assertLandingInside(
  {
    slice,
    start,
    end,
  }: {
    readonly slice: number;
    readonly start: number;
    readonly end: number;
  },
): void {
  /**
   Whether the region reaches before the slice or past it.
   */
  const outside = (start < 0) || (end > slice);
  if (outside || (end < start)) {
    throw new FragmentLandingError({
      slice,
      start,
      end,
    },);
  }
}

//endregion Fragment landing error
