import { isAsciiDigits, } from './ascii-letters.ts';

//region Whole number text
// One rule for reading a count back out of text, shared by every reader of a
// count the package wrote itself (a log line, a sheet heading, a declaration)
// and every reader of a count an operator typed (ledger B73).
//
// `Number` IS NOT THAT RULE. It reads an empty or blank text as 0, takes a
// hexadecimal, binary, octal or exponent spelling, a sign and surrounding
// spaces, and reads a digit run past the largest whole number a double holds
// exactly as a neighbouring number. Each of those gave some reader here a
// number nobody wrote: an empty heard count read as a stage that heard nobody,
// a truncated duration as no time at all, a mistyped cap as the default.
//
// DIGITS ONLY, LEADING ZEROS READ AS WRITTEN. `04` names four to anyone who
// types it, and no writer here pads, so reading it costs nothing; a sign, a
// point, a radix prefix or a space is refused, since none is how a count is
// written here.

/**
 How a refusal names the numbers this rule takes, so every reader says the
 same thing about the same rule.
 */
export const WHOLE_NUMBER_RULE: string = `a whole number written in digits, at most ${String(Number.MAX_SAFE_INTEGER,)}`;

/**
 Whether text is a whole number written in ASCII digits that a double holds
 exactly, which is the only count text any reader here takes.

 @param text - count as written

 @returns Whether `Number` reads it as exactly the number written

 @example
 ```ts
 isWholeNumberText({ text: '12', },); // true
 isWholeNumberText({ text: '1e3', },); // false
 ```
 */
export function isWholeNumberText({ text, }: { readonly text: string; },): boolean {
  return isAsciiDigits({ text, },) && Number.isSafeInteger(Number(text,),);
}

//endregion Whole number text
