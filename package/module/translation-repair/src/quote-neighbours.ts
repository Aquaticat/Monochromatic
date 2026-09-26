//region Quote neighbours
// WHAT STANDS BESIDE A STRAIGHT QUOTE, read by whole code point: whether a
// letter or digit binds it into a word, and whether an inline span closes
// before it. Shared by the apostrophe reading in `restore-typography.ts` and
// the nested quotation reading in `nested-single-quotes.ts`.

/**
 Highest code point one UTF-16 unit can carry; anything above it is a
 surrogate pair.
 */
const BMP_MAX = 0xFF_FF;

/**
 Whether one code point is a cased letter or an ASCII digit. Cased letters by
 general category, not by case mapping: the mathematical script letters the
 corpus writes handles in are cased letters with no case mapping, and Han is
 neither cased nor a word an apostrophe binds into (class ninety-six).
 */
// oxlint-disable-next-line no-restricted-syntax/no-regex -- the input is one code point, anchored at both ends, so the test is bounded and cannot backtrack; the Unicode general categories have no string API
const WORD_CODE_POINT = /^(?:\p{Lu}|\p{Ll}|\p{Lt}|[0-9])$/u;

/**
 Whether a character can sit beside an apostrophe inside one word.

 Restricted to letters and digits so a straight quote acting as a QUOTE, which
 has a space or punctuation on at least one side, is never mistaken for an
 apostrophe inside a contraction.

 @param character - character beside the quote, empty at a text boundary

 @returns Whether it binds the quote into a word

 @example
 ```ts
 const binds = bindsWord({ character: 't', },);
 ```
 */
export function bindsWord({ character, }: { readonly character: string; },): boolean {
  if (character === '')
    return false;

  return WORD_CODE_POINT.test(character,);
}

// CLASS NINETY-SIX (mikaela_khara, 2026-09-23). The archive writes a handle
// in mathematical script, every letter a surrogate pair, and the bench wrote
// its possessive with a straight apostrophe. The neighbours of a quote were
// read by UTF-16 unit, so the unit before the apostrophe was the low half of
// the last letter, which is no letter at all, and the apostrophe stayed
// straight on a curly page. THE NEIGHBOURS ARE WHOLE CODE POINTS.

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
 Whole code point starting at an offset, empty past the text's end.

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
 Characters that close an inline span the prose mask leaves in place: a
 link's `)`, a reference's `]`, an emphasis or strong `*` and `_`, a
 strikethrough `~`, a code span's backtick and a tag's `>`.

 CLASS SEVENTY (mikaela_khara, 2026-09-19). The archive's closing line reads
 `[name](url)’s chronicle`; the page shipped `)'s` straight on a curly page
 because only a letter or digit before the quote bound it into a word, and a
 possessive after a link, an emphasis span or a tag has a delimiter there.
 */
const SPAN_CLOSERS: ReadonlySet<string> = new Set([
  ')',
  ']',
  '*',
  '_',
  '~',
  '`',
  '>',
],);

/**
 Whether a character closes an inline span, so a possessive quote after it
 belongs to the word the span carries.

 @param character - character before the quote, empty at a text boundary

 @returns Whether a span ends there

 @example
 ```ts
 const closes = closesSpan({ character: ')', },);
 ```
 */
export function closesSpan({ character, }: { readonly character: string; },): boolean {
  return SPAN_CLOSERS.has(character,);
}

//endregion Quote neighbours
