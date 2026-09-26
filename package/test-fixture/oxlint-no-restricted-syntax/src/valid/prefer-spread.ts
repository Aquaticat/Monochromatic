// Fixture: calls prefer-spread must accept inside a typed project.

declare const toppings: readonly string[];
declare const scoopGrams: Uint8Array;
declare const menuCode: string;
declare const loose: any;
declare const arrayLike: ArrayLike<number>;

// Typed-array copy stays a typed array; a spread would make number[] (issue 565).
export const scoopCopy = scoopGrams.slice();
// String copy and concatenation are text operations.
export const codeCopy = menuCode.slice();
export const codeJoin = menuCode.concat('!',);
// Array.from is the explicit conversion for strings, array-likes, and untyped values.
export const codePoints = Array.from(menuCode,);
export const fromArrayLike = Array.from(arrayLike,);
export const fromLoose = Array.from(loose,);
export const range = Array.from({ length: 3, },);
// Partial slices are not copies.
export const tail = toppings.slice(1,);
// Syntax-proven non-arrays.
export const literal = 'abc'.slice();
export const view = new Uint8Array(4,).slice();
