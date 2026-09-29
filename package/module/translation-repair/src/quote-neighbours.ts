import { codePointBefore, } from './code-points.ts';

//region Quote neighbours
// WHAT STANDS BESIDE A STRAIGHT QUOTE, read by whole code point: whether a
// letter or digit binds it into a word, and whether an inline span closes
// before it. Shared by the apostrophe reading in `restore-typography.ts` and
// the nested quotation reading in `nested-single-quotes.ts`.
//
// BEFORE A QUOTE, A COMBINING MARK IS READ WITH the character it sits on
// (audit area six, 2026-09-28; ledger B18): `café's` written with a combining
// acute has the mark, not the `e`, beside the quote, and a mark is no cased
// letter, so the composed spelling curled and the combining one stayed
// straight on a curly page.

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

 @param character - code point after the quote, or the combining sequence
 before it (`sequenceBefore`), whose first code point is its base; empty at
 a text boundary

 @returns Whether it binds the quote into a word

 @example
 ```ts
 const binds = bindsWord({ character: 't', },);
 ```
 */
export function bindsWord({ character, }: { readonly character: string; },): boolean {
  /**
   First code point: the character itself, or a sequence's base.
   */
  const base = character.codePointAt(0,);
  if (base === undefined)
    return false;

  return WORD_CODE_POINT.test(String.fromCodePoint(base,),);
}

// CLASS NINETY-SIX (mikaela_khara, 2026-09-23). The archive writes a handle
// in mathematical script, every letter a surrogate pair, and the bench wrote
// its possessive with a straight apostrophe. The neighbours of a quote were
// read by UTF-16 unit, so the unit before the apostrophe was the low half of
// the last letter, which is no letter at all, and the apostrophe stayed
// straight on a curly page. THE NEIGHBOURS ARE WHOLE CODE POINTS, read by
// `code-points.ts`.

/**
 Whether one code point is a combining mark (general category M, variation
 selectors included), which belongs to the character before it rather than
 standing as one.
 */
// oxlint-disable-next-line no-restricted-syntax/no-regex -- the input is one code point, anchored at both ends with no quantifier, so the test is bounded and cannot backtrack; the Unicode general category has no string API
const MARK_CODE_POINT = /^\p{M}$/u;

/**
 Offset where the run of combining marks ending at an offset starts: the
 offset itself when no mark ends there.

 @param text - text being read

 @param at - offset the marks end at

 @returns Offset just after the code point the marks sit on

 @example
 ```ts
 const start = marksStart({ text: 'cafe\u{0301}\'s', at: 5, },); // 4
 ```
 */
function marksStart({
  text,
  at,
}: {
  readonly text: string;
  readonly at: number;
},): number {
  /**
   Offset moved back past each mark.
   */
  let start = at;
  /**
   Code point ending at that offset.
   */
  let before = codePointBefore({
    text,
    at: start,
  },);
  while (MARK_CODE_POINT.test(before,)) {
    start -= before.length;
    before = codePointBefore({
      text,
      at: start,
    },);
  }
  return start;
}

/**
 The combining character sequence ending just before an offset: the whole
 code point there, with every combining mark before the offset read back to
 the code point they sit on, so a letter written with a combining accent
 stands before a quote as its composed spelling does.

 WHOLE, NOT THE BASE ALONE: a mark on a space is a standalone accent, not
 a space, and a mark on a span's closing `)` makes it no closer, so each
 test reads the sequence and only `bindsWord` reads its base.

 @param text - text being read

 @param at - offset of the quote

 @returns The base code point and its marks, empty at the text's start;
 marks alone where nothing but marks precedes them

 @example
 ```ts
 const before = sequenceBefore({ text: 'cafe\u{0301}\'s', at: 5, },); // 'e' plus U+0301
 ```
 */
export function sequenceBefore({
  text,
  at,
}: {
  readonly text: string;
  readonly at: number;
},): string {
  /**
   Offset where the sequence's marks start.
   */
  const start = marksStart({
    text,
    at,
  },);
  /**
   Code point the marks sit on, empty at the text's start.
   */
  const base = codePointBefore({
    text,
    at: start,
  },);
  return text.slice(
    start - base.length,
    at,
  );
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
