//region Produced volume bound
// How many characters one producing call may emit for a slice of a given size,
// so a generation that has stopped saying anything new is cut while it is still
// running rather than paid for in full and discarded afterwards.
//
// RELATIVE TO THE SOURCE, which is the whole point. The absolute bound in
// `stream-runaway-watch.ts` is 32000, and the emission that opened this was
// 10381 characters against a 56-character source: comfortably legal by volume
// and 185 times the size of the passage it was translating. No absolute number
// separates a long legitimate passage from a short line that ran away, because
// the two differ in ratio and not in size.
//
// WHY THE REPETITION DETECTORS DO NOT COVER THIS. Both are gated behind 131072
// characters, and this emission was 10381. Even with that bar removed they
// would miss it: the ratio detector samples 64-character windows on a
// 32-character grid, the duplication's period was 5053, and a period that is
// not a multiple of the stride never lands on the same grid offsets twice. The
// measured distinct share was 1.0000 on the grid against 0.5184 at every
// offset. This bound does not look at what the text says, only at how much of
// it there is, which is why phase cannot hide from it.

/**
 * Smallest emission this bound ever refuses, in characters.
 *
 * KEEPS THE RATIO AWAY FROM SHORT SOURCES. Three times a 22-character heading
 * is 66 characters, so a purely proportional bound would sit under any answer a
 * model could reasonably give and refuse ordinary work. Measured over 144
 * shipped emissions, moving this between 512 and 2048 changes how many are
 * refused by one, so the ratio does the deciding and this only keeps the bound
 * away from text too short to reason about proportionally.
 */
export const PRODUCED_VOLUME_FLOOR = 1_024;

/**
 * Largest produced-to-source ratio one call may reach before it is cut.
 *
 * MEASURED, over 947 candidate emissions in every settled run. The median holds
 * between 2.95 and 3.75 in every source-length bucket, so a correct translation
 * is about three times its Chinese source whatever its length. Taking the
 * legitimate maximum as the largest ratio the judges actually SELECTED, since a
 * candidate that lost is no evidence of a legitimate size, six shipped runaways
 * sit between 98.2 and 270.0 and the next shipped emission is 9.4. Every
 * setting from twelve to twenty-four cuts exactly those six.
 *
 * SIXTEEN because the codebase already carries sixteen for the sibling
 * incumbent-to-source ratio in `translate-alignment.ts`, so the pipeline holds
 * one number rather than two that mean nearly the same thing.
 *
 * DELIBERATELY LOOSER THAN THE SETTLED ENDPOINT of ten in
 * `slice-implausible.ts`. That one judges text already
 * finished and can afford to be strict; this one ends a call that might still
 * have recovered, so it must be the more forgiving of the two.
 */
export const MAX_PRODUCED_TO_SOURCE_RATIO = 16;

/**
 * Characters a call translating one slice may emit before it is cut.
 *
 * @param sourceChars - size of the passage being translated
 *
 * @returns Bound to hand the stream watch for this call
 *
 * @example
 * ```ts
 * const cap = producedVolumeBound({ sourceChars: 56, },);
 * ```
 */
export function producedVolumeBound(
  { sourceChars, }: { readonly sourceChars: number; },
): number {
  return Math.max(
    PRODUCED_VOLUME_FLOOR,
    sourceChars * MAX_PRODUCED_TO_SOURCE_RATIO,
  );
}

//endregion Produced volume bound
