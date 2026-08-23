import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Code points
// One counter, shared by everything that compares a Chinese size against an
// English one.
//
// EXTRACTED RATHER THAN COPIED. The refusal guard in `translate-alignment.ts`
// and the corroboration gate in `coverage-corroboration.ts` both divide one of
// these counts by another, and a copy that drifted would let the two disagree
// about the same page while both looked right.

/**
 * First UTF-16 unit that can only be the SECOND half of a surrogate pair.
 */
const LOW_SURROGATE_FIRST = 0xDC_00;

/**
 * Last such unit.
 */
const LOW_SURROGATE_LAST = 0xDF_FF;

/**
 * Counts code points rather than UTF-16 units.
 *
 * `length` counts surrogate halves, so a rare CJK character measures twice on
 * one side of a ratio and once on the other. Every comparison this serves runs
 * between a Chinese source and an English translation, which is exactly where
 * that asymmetry lands, and it lands in the unsafe direction: a doubled source
 * size halves a ratio and passes a pairing a guard would otherwise refuse.
 *
 * An index scan rather than spreading or `Array.from`, both of which the linter
 * refuses over strings for breaking grapheme clusters. Every code point
 * contributes exactly one unit that is not a low surrogate, so counting those
 * counts code points without materializing an array.
 *
 * @param text - text to measure
 *
 * @returns Code points after trimming surrounding whitespace
 *
 * @example
 * ```ts
 * const count = codePointCount({ text: '其一：', },);
 * ```
 */
export function codePointCount({ text, }: { readonly text: string; },): number {
  /**
   * Trimmed text, since surrounding whitespace is content on neither side.
   */
  const trimmed = text.trim();

  /**
   * Running count, mutated only inside this function.
   */
  const counted = { points: 0, };
  for (let index = 0; index < trimmed.length; index += 1) {
    /**
     * Unit at the cursor.
     */
    const unit = nonNullishOrThrow(trimmed.codePointAt(index,),);
    if ((unit < LOW_SURROGATE_FIRST) || (unit > LOW_SURROGATE_LAST))
      counted.points += 1;
  }
  return counted.points;
}

//endregion Code points
