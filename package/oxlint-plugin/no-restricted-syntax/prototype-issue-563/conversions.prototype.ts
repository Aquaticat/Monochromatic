// PROTOTYPE (issue #563), throwaway: explicit, type-checked array conversions.
// Question: can named conversions with narrow parameter types let the TypeScript
// checker prove receiver kinds, so a type-free lint rule becomes exact?
// Every `@ts-expect-error` line is a positive control: tsc fails if it compiles.

type NumericTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float16Array
  | Float32Array
  | Float64Array;

// Array to array copy. Only arrays compile, so a copy of a fresh array-method
// result is provably useless and a syntax-only rule can remove it safely.
export function copyArray<const T,>(source: readonly T[],): T[] {
  return source.slice();
}

// Typed array to plain numbers: the conversion `[...typed.map(f)]` hid.
export function numbersOf(view: NumericTypedArray,): number[] {
  return view.values().toArray();
}

// Non-indexed iterable (Set, Map, iterator, generator) to array.
// `length?: never` rejects strings, arrays, and typed arrays.
export function collect<T,>(source: Iterable<T> & { readonly length?: "collect takes non-indexed iterables; use copyArray, numbersOf, or codePointsOf"; },): T[] {
  return Iterator.from(source,).toArray();
}

// Deliberate code-point split, named so readers see the Unicode decision.
export function codePointsOf(text: string,): string[] {
  return text[Symbol.iterator]().toArray();
}

type Order = {
  readonly toppings: readonly string[];
  readonly scoopGrams: Uint8Array;
  readonly menuCode: string;
  readonly queue: IteratorObject<string>;
  readonly allergens: ReadonlySet<string>;
};

function double(grams: number,): number {
  return grams * 2;
}

export function blend(order: Order,): readonly unknown[] {
  // Correct spellings: each compiles only for its receiver kind.
  const firstTwo = order.toppings.slice(0, 2,);
  const doubled = numbersOf(order.scoopGrams.map(double,),);
  const codes = codePointsOf(order.menuCode.slice(0, 2,),);
  const next = order.queue.take(3,).toArray();
  const allergenList = collect(order.allergens,);
  const toppingCopy = copyArray(order.toppings,);

  // Useless copy, still legal: the prototype lint rule must report it.
  const uselessCopy = copyArray(order.toppings.slice(0, 2,),);

  // Wrong pairings: every line must be a type error.
  // @ts-expect-error string is not an array
  copyArray(order.menuCode.slice(0, 2,),);
  // @ts-expect-error typed array map returns a typed array, not an array
  copyArray(order.scoopGrams.map(double,),);
  // @ts-expect-error iterator helpers return iterators, not arrays
  copyArray(order.queue.take(3,),);
  // @ts-expect-error string is indexed, use codePointsOf
  collect(order.menuCode,);
  // @ts-expect-error array is indexed, use copyArray
  collect(order.toppings,);
  // @ts-expect-error typed array is indexed, use numbersOf
  collect(order.scoopGrams,);
  // @ts-expect-error array of strings is not a typed array
  numbersOf(order.toppings,);
  // @ts-expect-error array is not a string
  codePointsOf(order.toppings,);

  return [firstTwo, doubled, codes, next, allergenList, toppingCopy, uselessCopy,];
}
