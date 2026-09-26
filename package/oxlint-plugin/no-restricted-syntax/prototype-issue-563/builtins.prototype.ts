// PROTOTYPE (issue #563), throwaway: built-in explicit conversions, no helpers.
// Every `@ts-expect-error` line is a positive control: tsc fails if it compiles.

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
  // Correct built-in spellings.
  const firstTwo = order.toppings.slice(0, 2,);
  const doubled: number[] = order.scoopGrams.map(double,).values().toArray();
  const next: string[] = order.queue.take(3,).toArray();
  const allergenList: string[] = order.allergens.values().toArray();
  // TypeScript requires a start argument, so the array-only copy reads toSpliced(0,).
  const toppingCopy: string[] = order.toppings.toSpliced(0,);

  // Wrong pairings.
  // @ts-expect-error strings have no values(); use string APIs or Intl.Segmenter
  order.menuCode.values();
  // @ts-expect-error arrays have no toArray(); drop the conversion
  order.toppings.toArray();
  // @ts-expect-error typed arrays have no toArray(); use values().toArray()
  order.scoopGrams.toArray();
  // @ts-expect-error strings have no toArray()
  order.menuCode.toArray();
  // @ts-expect-error typed arrays have no toSpliced(); toSpliced() copies arrays only
  order.scoopGrams.toSpliced(0,);
  // @ts-expect-error strings have no toSpliced()
  order.menuCode.toSpliced(0,);

  return [firstTwo, doubled, next, allergenList, toppingCopy,];
}
