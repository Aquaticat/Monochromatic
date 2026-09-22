import { pinyin, } from 'pinyin-pro';

//region Handle reading
// CLASS EIGHTY-THREE (XingZ622, 2026-09-22). A signer the archive never
// rendered shipped in Han: 锦心 in the Part Ten heading and signature, where
// XingZ619 wrote "Jinxin", XingZ620 "Jin Xin" and XingZ616 "Brocade Heart";
// 雨狸 as "Yu Li" on one song attribution and 雨狸 on the next. The house
// rules had no sentence on a handle with no declared, archive or corpus
// form, and the judges filled the gap with "keep the original form".
// Owner, 2026-09-22: pinyin as one capitalised word, with the literal
// translation in parentheses. The rule reaches every sheet through the
// house policy; this module is the deterministic half the page assembly
// applies where a rendering still carries Han: the reading of the handle,
// and the tolerance for a rendering that carries its gloss.

/**
 First character of the CJK unified ideographs.
 */
const HAN_FIRST = '\u{4E00}';

/**
 Last character of the CJK unified ideographs.
 */
const HAN_LAST = '\u{9FFF}';

/**
 Whether a character is a Han ideograph.

 @param character - one code point as a string

 @returns Whether it is in the CJK unified block

 @example
 ```ts
 isHan({ character: '锦', },); // true
 ```
 */
function isHan({ character, }: { readonly character: string; },): boolean {
  return (character >= HAN_FIRST) && (character <= HAN_LAST);
}

/**
 Whether a rendering still carries a Han ideograph.

 @param text - rendering as the page wrote it

 @returns Whether any character of it is Han

 @example
 ```ts
 carriesHan({ text: '锦心', },); // true
 ```
 */
export function carriesHan({ text, }: { readonly text: string; },): boolean {
  for (const character of text) {
    if (isHan({ character, },))
      return true;
  }
  return false;
}

/**
 Whether a character is a Latin letter or a digit, which a romanised run is
 kept apart from by a space.

 @param character - one code point as a string

 @returns Whether it is ASCII alphanumeric

 @example
 ```ts
 isLatinOrDigit({ character: 'O', },); // true
 ```
 */
function isLatinOrDigit({ character, }: { readonly character: string; },): boolean {
  /**
   Whether it is a lower-case letter.
   */
  const lower = (character >= 'a') && (character <= 'z');
  /**
   Whether it is an upper-case letter.
   */
  const upper = (character >= 'A') && (character <= 'Z');
  /**
   Whether it is a digit.
   */
  const digit = (character >= '0') && (character <= '9');
  return lower
    || upper
    || digit;
}

/**
 Pinyin of one run of Han as one capitalised word.

 @param run - consecutive Han characters

 @returns Their toneless syllables joined and capitalised

 @example
 ```ts
 romanisedRun({ run: '锦心', },); // 'Jinxin'
 ```
 */
function romanisedRun({ run, }: { readonly run: string; },): string {
  /**
   Toneless syllables, one per character.
   */
  const syllables = pinyin(
    run,
    {
      toneType: 'none',
      type: 'array',
    },
  );
  /**
   Syllables joined into one word.
   */
  const word = syllables.join('',);
  return `${word.slice(
    0,
    1,
  )
    .toUpperCase()}${word.slice(1,)}`;
}

/**
 Reads a handle the archive never rendered: every run of Han becomes one
 capitalised word of pinyin, everything else stays as written, and a
 romanised run is kept a space apart from Latin letters or digits the
 original wrote against it (洁澄天奏Official reads "Jiechengtianzou Official").

 @param name - handle as the original signs it

 @returns Handle as the page renders it

 @example
 ```ts
 handleReading({ name: '锦心', },); // 'Jinxin'
 ```
 */
export function handleReading({ name, }: { readonly name: string; },): string {
  /**
   Rendering built so far.
   */
  let rendered = '';
  /**
   Han run gathered so far.
   */
  let run = '';
  /**
   Whether the character last written out was a Latin letter or a digit,
   which a run opening right after it is kept apart from.
   */
  let afterLatin = false;
  for (const character of name) {
    if (isHan({ character, },)) {
      if ((run === '') && afterLatin)
        rendered += ' ';
      run += character;
      continue;
    }
    if (run !== '') {
      rendered += romanisedRun({ run, },);
      run = '';
      if (isLatinOrDigit({ character, },))
        rendered += ' ';
    }
    rendered += character;
    afterLatin = isLatinOrDigit({ character, },);
  }
  if (run !== '')
    rendered += romanisedRun({ run, },);
  return rendered;
}

/**
 Rendering without a trailing parenthetical gloss, which the house rule puts
 after a romanised handle at its first appearance.

 @param rendering - rendering as the page wrote it

 @returns Rendering before its gloss, trimmed

 @example
 ```ts
 withoutGloss({ rendering: 'Jinxin (Brocade Heart)', },); // 'Jinxin'
 ```
 */
export function withoutGloss({ rendering, }: { readonly rendering: string; },): string {
  if (!rendering.endsWith(')',))
    return rendering;
  /**
   Where the gloss opens, -1 for none.
   */
  const open = rendering.lastIndexOf(' (',);
  if (open <= 0)
    return rendering;
  return rendering.slice(
    0,
    open,
  )
    .trim();
}

/**
 Whether a written name already carries the rendering, alone or with its
 gloss in parentheses.

 @param written - name as the page wrote it

 @param rendering - rendering the page uses everywhere

 @returns Whether the line needs no rewrite

 @example
 ```ts
 carriesRendering({ written: 'Jinxin (Brocade Heart)', rendering: 'Jinxin', },); // true
 ```
 */
export function carriesRendering(
  {
    written,
    rendering,
  }: {
    readonly written: string;
    readonly rendering: string;
  },
): boolean {
  return (written === rendering) || (withoutGloss({ rendering: written, },) === rendering);
}

//endregion Handle reading
