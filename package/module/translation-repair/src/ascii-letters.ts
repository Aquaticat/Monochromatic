//region ASCII letters
// The ASCII letter and digit tests the package's scanners share. Six modules
// kept their own letter test and two their own letter-or-digit test (audit
// area six, 2026-09-28), several of them named for Latin while testing ASCII
// only, which hid what they do: an accented letter such as `é` ends a word
// for every one of them.
//
// ASCII IS RIGHT WHERE A FORMAT SAYS SO: an HTML tag or attribute name starts
// with an ASCII letter, a corpus directory id is ASCII, and the signer-handle
// floor reads a rendering's basic letters after NFD has split its tone marks
// off. Where a scanner reads English prose, an ASCII test is a choice the
// scanner states; the name here says what is tested so that choice is visible.

/**
 Whether one character is an ASCII letter, `a` to `z` in either case.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for an ASCII letter only; an accented letter is not one

 @example
 ```ts
 isAsciiLetter({ character: 'N', },); // true
 isAsciiLetter({ character: 'é', },); // false
 ```
 */
export function isAsciiLetter({ character, }: { readonly character: string; },): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Whether one character is an ASCII digit.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for `0` to `9`

 @example
 ```ts
 isAsciiDigit({ character: '7', },); // true
 ```
 */
export function isAsciiDigit({ character, }: { readonly character: string; },): boolean {
  return (character >= '0') && (character <= '9');
}

/**
 Whether one character is an ASCII letter or digit.

 @param character - one UTF-16 unit, empty past a text's edge

 @returns True for `a` to `z`, `A` to `Z` and `0` to `9`

 @example
 ```ts
 isAsciiAlphanumeric({ character: '9', },); // true
 isAsciiAlphanumeric({ character: '_', },); // false
 ```
 */
export function isAsciiAlphanumeric({ character, }: { readonly character: string; },): boolean {
  return isAsciiLetter({ character, },) || isAsciiDigit({ character, },);
}

//endregion ASCII letters
