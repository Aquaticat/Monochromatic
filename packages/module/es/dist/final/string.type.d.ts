export type LowercaseLetters = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'w' | 'v' | 'u' | 'x' | 'y' | 'z';
export type UppercaseLetters = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'W' | 'V' | 'U' | 'X' | 'Y' | 'Z';
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
    'z'
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
    'Z'
];
export type DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0';
export type None0DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export declare const lowercaseLetters: LowercaseLettersTuple;
export declare const uppercaseLetters: UppercaseLettersTuple;
export type ShortLangString = `${LowercaseLetters}${LowercaseLetters}`;
export type LongLangString = `${ShortLangString}-${string}` & {
    length: 5;
};
export type LangString = ShortLangString | LongLangString;
