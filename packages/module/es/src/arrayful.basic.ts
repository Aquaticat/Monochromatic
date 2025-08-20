export type Arrayful<T = unknown,> = {
  readonly array: T[];
};

// type guard cannot use destructured syntax.
export function isArrayful<const MyArrayful extends Arrayful = Arrayful,>(
  potentiallyArrayful: MyArrayful,
): potentiallyArrayful is MyArrayful extends Arrayful<infer A> ? (MyArrayful & Arrayful<A>) : never {
  if (typeof potentiallyArrayful !== 'object' || potentiallyArrayful === null)
    return false;
  if (!( 'array' in potentiallyArrayful)) {
    return false;
  }
  return Array.isArray(potentiallyArrayful.array,);
}
