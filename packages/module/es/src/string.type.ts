export type LowercaseLetters =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'w'
  | 'v'
  | 'u'
  | 'x'
  | 'y'
  | 'z';

export type UppercaseLetters =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'W'
  | 'V'
  | 'U'
  | 'X'
  | 'Y'
  | 'Z';

export type LowercaseLettersTuple = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'w',
  'v',
  'u',
  'x',
  'y',
  'z',
];

export type UppercaseLettersTuple = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'W',
  'V',
  'U',
  'X',
  'Y',
  'Z',
];

export type DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0';
export type No0DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export const lowercaseLetters: LowercaseLettersTuple = [
  ...'abcdefghijklmnopqrstuvwxyz',
] as LowercaseLettersTuple;

export const uppercaseLetters: UppercaseLettersTuple = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
] as UppercaseLettersTuple;

export type ShortLangString = `${LowercaseLetters}${LowercaseLetters}`;

// Expression produces a union type that's too complex to represent.
// export type longLangString = `${shortLangString}-${UppercaseLetters}${UppercaseLetters}`
export type LongLangString = `${ShortLangString}-${string}` & { length: 5; };

export type LangString = ShortLangString | LongLangString;

export type SingleDigitIntString = DigitString;

export type DoubleDigitIntString = `${No0DigitString}${DigitString}`;

export type TripleDigitIntString = `${No0DigitString}${DigitString}${DigitString}`;

export type QuadrupleDigitIntString =
  `${No0DigitString}${DigitString}${DigitString}${DigitString}`;

export type OneToFourDigitsIntString =
  | SingleDigitIntString
  | DoubleDigitIntString
  | TripleDigitIntString
  | QuadrupleDigitIntString;

export type PositiveIntString =
  | '0'
  | `${No0DigitString}${string & { length?: number; }}` & {
    __brand: 'PositiveIntString';
  };

// Float part: "0.xxx" or non-zero int followed by ".xxx"
export type PositiveFloatString =
  | `0.${DigitString}${string & { length?: number; }}`
  | `${No0DigitString}${string & { length?: number; }}.${DigitString}${string & {
    length?: number;
  }}`
    & {
      __brand: 'PositiveFloatString';
    };

// Negative versions
export type NegativeIntString =
  | `-0`
  | `-${No0DigitString}${string & { length?: number; }}` & {
    __brand: 'NegativeIntString';
  };

export type NegativeFloatString =
  | `-0.${DigitString}${string & { length?: number; }}`
  | `-${No0DigitString}${string & { length?: number; }}.${DigitString}${string & {
    length?: number;
  }}`
    & {
      __brand: 'NegativeFloatString';
    };

export type IntString = PositiveIntString | NegativeIntString;
export type FloatString = PositiveFloatString | NegativeFloatString;
export type NumberString = IntString | FloatString;
export type PositiveNumberString = PositiveIntString | PositiveFloatString;
export type NegativeNumberString = NegativeIntString | NegativeFloatString;
