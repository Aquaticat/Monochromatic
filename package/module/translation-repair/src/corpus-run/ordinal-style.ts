//region Ordinal style
// HOW A NUMBERED HEADING SPELLS ITS NUMBER. A source heading series such as
// `其一` to `其十` reaches the page one slice at a time, and each slice's
// judges settle on their own spelling: "One:", "IV:", "The Fifth:",
// "Part Six:". This module reads which style a rendered heading took and
// renders a number in any of them, so a page can put one series in one
// style.

/**
 Cardinal words for one to twenty, in order.
 */
const CARDINALS: readonly string[] = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/**
 Ordinal words for first to twentieth, in order.
 */
const ORDINALS: readonly string[] = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
];

/**
 Roman numeral steps, largest first.
 */
const ROMAN: readonly {
  readonly value: number;
  readonly letters: string;
}[] = [
  {
    value: 1_000,
    letters: 'M',
  },
  {
    value: 900,
    letters: 'CM',
  },
  {
    value: 500,
    letters: 'D',
  },
  {
    value: 400,
    letters: 'CD',
  },
  {
    value: 100,
    letters: 'C',
  },
  {
    value: 90,
    letters: 'XC',
  },
  {
    value: 50,
    letters: 'L',
  },
  {
    value: 40,
    letters: 'XL',
  },
  {
    value: 10,
    letters: 'X',
  },
  {
    value: 9,
    letters: 'IX',
  },
  {
    value: 5,
    letters: 'V',
  },
  {
    value: 4,
    letters: 'IV',
  },
  {
    value: 1,
    letters: 'I',
  },
];

/**
 Letters a roman numeral may carry.
 */
const ROMAN_LETTERS = 'IVXLCDM';

/**
 Han digits one to nine, in order.
 */
const HAN_DIGITS = '一二三四五六七八九';

/**
 Han ten.
 */
const HAN_TEN = '十';

/**
 Value of ten.
 */
const TEN = 10;

/**
 Words that lead a number in a heading ("Part Six", "The Fifth").
 */
const LEADERS: ReadonlySet<string> = new Set([
  'part',
  'chapter',
  'section',
  'the',
  'no.',
  'no',
],);

/**
 How a heading spells its number: a bare form, or a leader word before one;
 the form `none` where the heading carries no number.

 @example
 ```ts
 const style: OrdinalStyle = { leader: 'part', form: 'cardinal', };
 ```
 */
export type OrdinalStyle = {
  /**
   Word before the number, empty for none.
   */
  readonly leader: string;

  /**
   Spelling of the number itself, `none` for no number.
   */
  readonly form: 'cardinal' | 'ordinal' | 'roman' | 'arabic' | 'none';
};

/**
 Style of a heading that carries no number.
 */
export const NO_NUMBER: OrdinalStyle = {
  leader: '',
  form: 'none',
};

/**
 Key naming a style, for counting.

 @param style - style to name

 @returns Stable key

 @example
 ```ts
 styleKey({ style: { leader: 'part', form: 'cardinal', }, },); // 'part cardinal'
 ```
 */
export function styleKey({ style, }: { readonly style: OrdinalStyle; },): string {
  return `${style.leader} ${style.form}`.trim();
}

/**
 Capitalises one word.

 @param word - lowercase word

 @returns Word with its first letter uppercased

 @example
 ```ts
 capitalised({ word: 'six', },); // 'Six'
 ```
 */
function capitalised({ word, }: { readonly word: string; },): string {
  /**
   First letter, uppercased.
   */
  const head = word.slice(
    0,
    1,
  )
    .toUpperCase();
  return head + word.slice(1,);
}

/**
 Whether a word is a roman numeral.

 @param word - word as written

 @returns True when every letter is a roman letter

 @example
 ```ts
 isRoman({ word: 'IX', },); // true
 ```
 */
function isRoman({ word, }: { readonly word: string; },): boolean {
  if (word === '')
    return false;
  for (const letter of word) {
    if (!ROMAN_LETTERS.includes(letter,))
      return false;
  }
  return true;
}

/**
 Whether a word is all digits.

 @param word - word as written

 @returns True when every character is an ASCII digit

 @example
 ```ts
 isDigits({ word: '12', },); // true
 ```
 */
function isDigits({ word, }: { readonly word: string; },): boolean {
  if (word === '')
    return false;
  for (const character of word) {
    if ((character < '0') || (character > '9'))
      return false;
  }
  return true;
}

/**
 Spelling form of one number word, `none` when it is no number.

 @param word - word as written

 @returns Form

 @example
 ```ts
 formOf({ word: 'IV', },); // 'roman'
 ```
 */
function formOf({ word, }: { readonly word: string; },): OrdinalStyle['form'] {
  /**
   Word lowered for the word tables.
   */
  const lowered = word.toLowerCase();
  if (CARDINALS.includes(lowered,))
    return 'cardinal';
  if (ORDINALS.includes(lowered,))
    return 'ordinal';
  if (isDigits({ word, },))
    return 'arabic';
  if (isRoman({ word, },))
    return 'roman';
  return 'none';
}

/**
 Reads the style of the number a heading title opens with, before its colon.

 @param prefix - title text before the first colon, trimmed

 @returns Style, `NO_NUMBER` when the prefix is no number

 @example
 ```ts
 readOrdinalStyle({ prefix: 'Part Six', },); // { leader: 'part', form: 'cardinal', }
 ```
 */
export function readOrdinalStyle({ prefix, }: { readonly prefix: string; },): OrdinalStyle {
  /**
   Words of the prefix.
   */
  const words = prefix.split(' ',)
    .filter(function filled(word,): boolean {
      return word !== '';
    },);
  /**
   First and second words, absent on a short prefix.
   */
  const [first, second,] = words;
  if (first === undefined)
    return NO_NUMBER;
  if (words.length === 1) {
    /**
     Form of the one word.
     */
    const form = formOf({ word: first, },);
    return (form === 'none') ? NO_NUMBER : {
      leader: '',
      form,
    };
  }
  if ((words.length !== 2) || (second === undefined))
    return NO_NUMBER;
  /**
   Leader word, lowered.
   */
  const leader = first.toLowerCase();
  if (!LEADERS.has(leader,))
    return NO_NUMBER;
  /**
   Form of the word after the leader.
   */
  const form = formOf({ word: second, },);
  return (form === 'none') ? NO_NUMBER : {
    leader,
    form,
  };
}

/**
 Renders a number as a roman numeral.

 @param value - positive number

 @returns Roman letters

 @example
 ```ts
 roman({ value: 9, },); // 'IX'
 ```
 */
function roman({ value, }: { readonly value: number; },): string {
  /**
   What is left to render.
   */
  let left = value;
  /**
   Letters so far.
   */
  let out = '';
  for (const step of ROMAN) {
    while (left >= step.value) {
      out += step.letters;
      left -= step.value;
    }
  }
  return out;
}

/**
 Renders a number in one form, falling back to digits past the word tables.

 @param value - positive number

 @param form - spelling wanted

 @returns Number as written in that form

 @example
 ```ts
 renderForm({ value: 4, form: 'ordinal', },); // 'Fourth'
 ```
 */
function renderForm(
  {
    value,
    form,
  }: {
    readonly value: number;
    readonly form: OrdinalStyle['form'];
  },
): string {
  if (form === 'none')
    return '';
  if (form === 'roman')
    return roman({ value, },);
  if (form === 'arabic')
    return String(value,);
  /**
   Word table for the form.
   */
  const table = (form === 'cardinal') ? CARDINALS : ORDINALS;
  /**
   Word for this value, absent past the table.
   */
  const word = table[value - 1];
  return (word === undefined) ? String(value,) : capitalised({ word, },);
}

/**
 Renders a number in a heading's style, leader included; empty for the
 `none` style.

 @param value - positive number

 @param style - style the series takes

 @returns Number as the heading spells it

 @example
 ```ts
 renderOrdinal({ value: 6, style: { leader: 'part', form: 'cardinal', }, },); // 'Part Six'
 ```
 */
export function renderOrdinal(
  {
    value,
    style,
  }: {
    readonly value: number;
    readonly style: OrdinalStyle;
  },
): string {
  /**
   The number itself.
   */
  const number = renderForm({
    value,
    form: style.form,
  },);
  if (style.leader === '')
    return number;
  /**
   Leader as written: "No." keeps its stop, the rest are capitalised.
   */
  const leader = (style.leader === 'no') ? 'No.' : capitalised({ word: style.leader, },);
  return `${leader} ${number}`;
}

/**
 Value of a Han numeral from one to ninety-nine, zero when a character
 breaks it.

 @param text - numeral as the original writes it

 @returns Its value, or zero

 @example
 ```ts
 hanValue({ text: '二十一', },); // 21
 ```
 */
function hanValue({ text, }: { readonly text: string; },): number {
  /**
   Tens read so far.
   */
  let tens = 0;
  /**
   Ones read so far.
   */
  let ones = 0;
  /**
   Whether the ten mark has been read.
   */
  let pastTen = false;
  for (const character of text) {
    /**
     Digit value, zero when the character is no digit.
     */
    const digit = HAN_DIGITS.indexOf(character,) + 1;
    if (character === HAN_TEN) {
      if (pastTen)
        return 0;
      pastTen = true;
      tens = (ones === 0) ? 1 : ones;
      ones = 0;
    } else if ((digit > 0) && (ones === 0)) {
      ones = digit;
    } else {
      return 0;
    }
  }
  /**
   Value read.
   */
  const value = (tens * TEN) + ones;
  return value;
}

/**
 Reads a Han or digit numeral from one to ninety-nine.

 @param text - numeral as the original writes it

 @returns Its value, or zero when it is no numeral

 @example
 ```ts
 readHanNumeral({ text: '十二', },); // 12
 ```
 */
export function readHanNumeral({ text, }: { readonly text: string; },): number {
  if (isDigits({ word: text, },))
    return Number(text,);
  return hanValue({ text, },);
}

//endregion Ordinal style
