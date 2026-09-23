//region Han-only text
// Character tests shared by the floors that ask whether a run of text is
// written in Han alone: the CJK unified ideograph block as the page-name
// glossary and the corpus name index read it, and ASCII letters as the mark
// of a Latin form.

/**
 First code point of the CJK unified ideograph block.
 */
const HAN_FIRST = '\u{4E00}';

/**
 Last code point of the CJK unified ideograph block.
 */
const HAN_LAST = '\u{9FFF}';

/**
 Whether a character is a Han ideograph of the unified block.

 @param character - one code point of a text

 @returns True inside the unified block

 @example
 ```ts
 isHanCharacter({ character: '猫', },); // true
 ```
 */
export function isHanCharacter({ character, }: { readonly character: string; },): boolean {
  return (character >= HAN_FIRST) && (character <= HAN_LAST);
}

/**
 Whether a character is an ASCII letter, which marks a text as carrying its
 own Latin form.

 @param character - one code point of a text

 @returns True for a to z in either case

 @example
 ```ts
 isLatinLetter({ character: 'N', },); // true
 ```
 */
export function isLatinLetter({ character, }: { readonly character: string; },): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Whether a text carries a Han ideograph and no Latin letter, so its only
 form is Han.

 @param text - run of text under the question

 @returns True for a run whose only form is Han

 @example
 ```ts
 isHanOnly({ text: '猫猫摇篮曲', },); // true
 isHanOnly({ text: 'Nyan物语', },); // false
 ```
 */
export function isHanOnly({ text, }: { readonly text: string; },): boolean {
  /**
   Whether a Han ideograph has been read.
   */
  let han = false;
  for (const character of text) {
    if (isLatinLetter({ character, },))
      return false;
    if (isHanCharacter({ character, },))
      han = true;
  }
  return han;
}

/**
 Whether a span of a text carries a Latin letter.

 @param text - text read

 @param from - offset the span starts at

 @param to - offset just past the span

 @returns True when some character of the span is a Latin letter

 @example
 ```ts
 carriesLatinLetter({ text: '猫 (cat)', from: 3, to: 6, },); // true
 ```
 */
export function carriesLatinLetter(
  {
    text,
    from,
    to,
  }: {
    readonly text: string;
    readonly from: number;
    readonly to: number;
  },
): boolean {
  for (let at = from; at < to; at += 1) {
    if (isLatinLetter({ character: text.charAt(at,), },))
      return true;
  }
  return false;
}

//endregion Han-only text
