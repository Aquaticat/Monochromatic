// Fixture: every form prefer-spread reports inside a typed project.
// Each line's trailing comment names the expected message kind.

declare const toppings: readonly string[];
declare const scoopGrams: Uint8Array;
declare const loose: any;

export const copy = toppings.slice(); // preferSpreadOverCopy
export const copyFromZero = toppings.slice(0,); // preferSpreadOverCopy
export const joined = toppings.concat(['ice',],); // preferSpreadOverConcat
export const fromArray = Array.from(toppings,); // preferSpreadOverArrayFrom
export const fromTyped = Array.from(scoopGrams,); // preferSpreadOverArrayFrom
export const looseCopy = loose.slice(); // ambiguousCopy
export const looseJoin = loose.concat([1,],); // ambiguousConcat
