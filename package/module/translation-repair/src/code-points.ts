import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Code points
// One counter, shared by everything that compares a Chinese size against an
// English one, and the two readers that take the whole code point at or before
// an offset, shared by every scan that tests a character whose class reaches
// past the first plane.
//
// EXTRACTED RATHER THAN COPIED. The refusal guard in `translate-alignment.ts`
// and the corroboration gate in `coverage-corroboration.ts` both divide one of
// these counts by another, and a copy that drifted would let the two disagree
// about the same page while both looked right. The readers lived in
// `quote-neighbours.ts` (class ninety-six) with a private copy of the forward
// one in `mdx-tag-start.ts`, until the scans of ledger B21 needed them too.

/**
 Highest code point one UTF-16 unit can carry; anything above it is a
 surrogate pair.
 */
const BMP_MAX = 0xFF_FF;

/**
 First UTF-16 unit that can only be the FIRST half of a surrogate pair.
 */
const HIGH_SURROGATE_FIRST = 0xD8_00;

/**
 Last such unit.
 */
const HIGH_SURROGATE_LAST = 0xDB_FF;

/**
 First UTF-16 unit that can only be the SECOND half of a surrogate pair.
 */
const LOW_SURROGATE_FIRST = 0xDC_00;

/**
 Last such unit.
 */
const LOW_SURROGATE_LAST = 0xDF_FF;

/**
 Counts code points rather than UTF-16 units.
 
 `length` counts surrogate halves, so a rare CJK character measures twice on
 one side of a ratio and once on the other. Every comparison this serves runs
 between a Chinese source and an English translation, which is exactly where
 that asymmetry lands, and it lands in the unsafe direction: a doubled source
 size halves a ratio and passes a pairing a guard would otherwise refuse.
 
 An index scan rather than spreading or `Array.from`, both of which the linter
 refuses over strings for breaking grapheme clusters. Every code point
 contributes exactly one unit that is not a low surrogate, so counting those
 counts code points without materializing an array.
 
 @param text - text to measure
 
 @returns Code points after trimming surrounding whitespace
 
 @example
 ```ts
 const count = codePointCount({ text: '其一：', },);
 ```
 */
export function codePointCount({ text, }: { readonly text: string; },): number {
  /**
   Trimmed text, since surrounding whitespace is content on neither side.
   */
  const trimmed = text.trim();

  /**
   Running count, mutated only inside this function.
   */
  const counted = { points: 0, };
  for (let index = 0; index < trimmed.length; index += 1) {
    /**
     Unit at the cursor.
     */
    const unit = nonNullishOrThrow(trimmed.codePointAt(index,),);
    if ((unit < LOW_SURROGATE_FIRST) || (unit > LOW_SURROGATE_LAST))
      counted.points += 1;
  }
  return counted.points;
}

/**
 Whole code point starting at an offset, empty past either end of the text.

 @param text - text being read

 @param at - offset of the code point wanted

 @returns The code point there, as a string of one or two units

 @example
 ```ts
 const after = codePointAt({ text: 'ab', at: 1, },); // 'b'
 ```
 */
export function codePointAt({
  text,
  at,
}: {
  readonly text: string;
  readonly at: number;
},): string {
  if (at >= text.length)
    return '';
  /**
   Code point there, read by the string's own decoding.
   */
  const point = text.codePointAt(at,);
  if (point === undefined)
    return '';
  return String.fromCodePoint(point,);
}

/**
 Whole code point ending just before an offset, empty at the text's start.

 @param text - text being read

 @param at - offset of the character whose predecessor is wanted

 @returns The code point before, as a string of one or two units

 @example
 ```ts
 const before = codePointBefore({ text: 'ab', at: 1, },); // 'a'
 ```
 */
export function codePointBefore({
  text,
  at,
}: {
  readonly text: string;
  readonly at: number;
},): string {
  if (at <= 0)
    return '';
  /**
   Code point starting two units back, which ends just before the offset
   when it is a surrogate pair.
   */
  const paired = (at >= 2) ? text.codePointAt(at - 2,) : undefined;
  if ((paired !== undefined) && (paired > BMP_MAX))
    return text.slice(
      at - 2,
      at,
    );
  return text.charAt(at - 1,);
}

/**
 The opening of a text, at most a number of UTF-16 units long, that never
 ends inside a character: where the limit falls between the two halves of a
 surrogate pair, the first half is left out too (ledger B21). A cut by
 `slice` alone kept half an emoji in an error's excerpt, a stream's opening
 and a refused reply's opening, and the log showed `\ud83d` or a
 replacement character.

 @param text - text to cut

 @param units - most UTF-16 units the opening may run to

 @returns The whole text where it fits, else its longest opening within the
 limit that ends on a whole character

 @example
 ```ts
 wholeOpening({ text: 'nap\u{1F431}', units: 4, },); // 'nap'
 ```
 */
export function wholeOpening({
  text,
  units,
}: {
  readonly text: string;
  readonly units: number;
},): string {
  if (text.length <= units)
    return text;
  /**
   The opening cut by units.
   */
  const cut = text.slice(
    0,
    units,
  );
  /**
   Its last unit, none for an empty cut.
   */
  const last = cut.codePointAt(cut.length - 1,) ?? 0;
  return ((last >= HIGH_SURROGATE_FIRST) && (last <= HIGH_SURROGATE_LAST))
    ? cut.slice(
      0,
      -1,
    )
    : cut;
}

//endregion Code points
