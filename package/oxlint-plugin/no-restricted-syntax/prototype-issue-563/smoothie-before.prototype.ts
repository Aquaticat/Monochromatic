// PROTOTYPE (issue #563), throwaway: the ambiguous spellings the rule must catch.
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
  const firstTwo = [...order.toppings.slice(0, 2,),];
  const doubled = [...order.scoopGrams.map(double,),];
  const codes = [...order.menuCode.slice(0, 2,),];
  const next = [...order.queue.take(3,),];
  const allergenList = [...order.allergens,];
  const fromTyped = Array.from(order.scoopGrams.map(double,),);
  const combined = [...order.toppings, 'ice',];
  const range = Array.from({ length: 3, }, function index(_, at,) { return at; },);
  const needlessSlice = order.toppings.map(String,).slice();
  return [firstTwo, doubled, codes, next, allergenList, fromTyped, combined, range, needlessSlice,];
}
