// Fixture: spreads no-useless-spread must accept inside a typed project,
// because each one converts a value instead of copying a fresh array.

type Order = {
  readonly toppings: readonly string[];
  readonly scoopGrams: Uint8Array;
  readonly menuCode: string;
  readonly queue: IteratorObject<string>;
  readonly mixed: string | readonly string[];
};

declare const order: Order;
declare const prototype: object;

// Typed array result: the spread converts to number[].
export const doubled = [...order.scoopGrams.map(Number,),];
// String result: the spread splits code points (typescript/no-misused-spread owns this).
export const codes = [...order.menuCode.slice(0, 2,),];
// Iterator helper result: take() is not an array method, so nothing is ambiguous.
export const next = [...order.queue.take(3,),];
// Mixed union: the spread converts on the string branch.
export const mixed = [...order.mixed.slice(0, 1,),];
// Syntax-proven typed array receiver.
export const view = [...new Uint8Array(4,).slice(0, 2,),];
// Object.create keeps a prototype that the spread drops, so the spread is not a copy.
export const own = { ...Object.create(prototype,), };
// Spreads that combine values are not copies.
export const combined = [...order.toppings, 'ice',];
// Shadowed Array is not the global constructor.
export function shadowed({ Array, }: { readonly Array: { from(value: unknown,): readonly unknown[]; }; },): readonly unknown[] {
  return [...Array.from(order,),];
}
