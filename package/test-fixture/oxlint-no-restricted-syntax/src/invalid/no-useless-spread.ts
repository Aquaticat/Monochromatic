// Fixture: every form no-useless-spread reports inside a typed project.
// Each line's trailing comment names the expected message kind.

type Order = {
  readonly toppings: readonly string[];
  readonly scoopGrams: Uint8Array;
  readonly loose: any;
};

declare const order: Order;
declare const source: Iterable<number>;
declare const pairs: Iterable<readonly [string, number,]>;
declare const items: readonly number[];

export const inArray = [1, ...[2, 3,], 4,]; // spreadArrayInArray
export const inArguments = Math.max(...[1, 2,],); // spreadArrayInArguments
export const inObject = { a: 1, ...{ b: 2, }, }; // spreadObjectInObject
export const set = new Set([...source,],); // iterableToArray
export const all = Promise.all([...source,],); // iterableToArray
export const entries = Object.fromEntries([...pairs,],); // iterableToArray
export const fromArray = [...Array.from(source,),]; // cloneArray
export const keys = [...Object.keys(order,),]; // cloneArray
export const sized = [...new Array(3,),]; // cloneArray
export const fromEntriesCopy = { ...Object.fromEntries(pairs,), }; // cloneObject
export const toppingCopy = [...order.toppings.slice(0, 2,),]; // cloneArray (typed: array)
export const looseCopy = [...order.loose.slice(),]; // ambiguousConversion (any)

export function* delegate(): Generator<number> {
  yield* [...source,]; // iterableInYieldStar
}

export function sum(): number {
  let total = 0;
  for (const item of [...items,]) // iterableInForOf
    total += item;
  return total;
}
