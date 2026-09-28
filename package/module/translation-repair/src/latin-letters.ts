import {
  isAsciiDigit,
  isAsciiLetter,
} from './ascii-letters.ts';

//region Latin letters
// What a word of English prose is made of, for the scanners that split one:
// the glossary's form edges (`glossary-match.ts`, which set this definition
// when ledger C1 put Latin forms at word boundaries) and the Canadian
// spelling pass's combining marks. Every other prose scanner tested ASCII
// letters only (audit area six, 2026-09-28), so an accented letter ended a
// word: `Pokémon` read as `Pok` and `mon`, and a tone-marked pinyin syllable
// as two fragments. The ledger's B18 entry lists each scanner switched here
// and what it changed over the pinned corpus.
//
// LATIN SCRIPT, NOT EVERY CASED LETTER. A kaomoji an English page keeps
// (`(・ω・)`) carries Greek and Cyrillic letters that are no part of a word
// beside them. The blocks here are Latin-1's letters, Latin Extended-A and
// -B (every pinyin tone vowel sits in one of them) and Latin Extended
// Additional (Vietnamese); the two Latin-1 signs among them are excluded.

/**
 First code point of the Latin-1 letters and the Latin Extended blocks.
 */
const LATIN_EXTENDED_FIRST = '\u{00C0}';

/**
 Last code point of Latin Extended-B.
 */
const LATIN_EXTENDED_LAST = '\u{024F}';

/**
 First code point of Latin Extended Additional.
 */
const LATIN_ADDITIONAL_FIRST = '\u{1E00}';

/**
 Last code point of Latin Extended Additional.
 */
const LATIN_ADDITIONAL_LAST = '\u{1EFF}';

/**
 Signs inside the Latin-1 range that are not letters.
 */
const LATIN_SIGNS: ReadonlySet<string> = new Set([
  '\u{00D7}',
  '\u{00F7}',
],);

/**
 First combining diacritical mark, which continues the letter before it.
 */
const COMBINING_FIRST = '\u{0300}';

/**
 Last combining diacritical mark.
 */
const COMBINING_LAST = '\u{036F}';

/**
 Whether one character is a Latin letter: ASCII, or one of the Latin-1,
 Latin Extended-A, -B or Additional letters.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for a Latin letter, accented or not

 @example
 ```ts
 isLatinLetter({ character: 'é', },); // true
 isLatinLetter({ character: 'ω', },); // false
 ```
 */
export function isLatinLetter({ character, }: { readonly character: string; },): boolean {
  if (isAsciiLetter({ character, },))
    return true;
  if ((character >= LATIN_ADDITIONAL_FIRST) && (character <= LATIN_ADDITIONAL_LAST))
    return true;
  return (character >= LATIN_EXTENDED_FIRST)
    && (character <= LATIN_EXTENDED_LAST)
    && (!LATIN_SIGNS.has(character,));
}

/**
 Whether one character belongs to a Latin word: a Latin letter or an ASCII
 digit.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for a letter or digit a word may continue with

 @example
 ```ts
 isLatinWordCharacter({ character: '7', },); // true
 isLatinWordCharacter({ character: '，', },); // false
 ```
 */
export function isLatinWordCharacter({ character, }: { readonly character: string; },): boolean {
  return isLatinLetter({ character, },) || isAsciiDigit({ character, },);
}

/**
 Whether a character is a combining diacritical mark, which continues the
 letter before it (`idée` written with a separate accent).

 @param character - one UTF-16 unit

 @returns True inside the combining diacritical marks block

 @example
 ```ts
 isCombiningMark({ character: '\u{0301}', },); // true
 ```
 */
export function isCombiningMark({ character, }: { readonly character: string; },): boolean {
  return (character >= COMBINING_FIRST) && (character <= COMBINING_LAST);
}

/**
 Whether one character continues a run of Latin letters already begun: a
 Latin letter, or a combining mark. Digits end such a run, for the scanners
 that read words and not tokens.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for a letter or a combining mark

 @example
 ```ts
 isLatinLetterOrMark({ character: '\u{030C}', },); // true
 isLatinLetterOrMark({ character: '2', },); // false
 ```
 */
export function isLatinLetterOrMark({ character, }: { readonly character: string; },): boolean {
  return isLatinLetter({ character, },) || isCombiningMark({ character, },);
}

/**
 Whether one character continues a Latin word already begun: a word
 character, or a combining mark.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for a character a word runs on through

 @example
 ```ts
 continuesLatinWord({ character: '\u{0301}', },); // true
 ```
 */
export function continuesLatinWord({ character, }: { readonly character: string; },): boolean {
  return isLatinWordCharacter({ character, },) || isCombiningMark({ character, },);
}

//endregion Latin letters
