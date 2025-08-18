export type Arrayful<T = unknown,> = {
  array: T[];
};

// type guard cannot use destructured syntax.
export function isArrayful<const T = unknown,>(
  potentiallyArrayful: unknown,
): potentiallyArrayful is Arrayful<T> {
  if (typeof potentiallyArrayful !== 'object' || potentiallyArrayful === null)
    return false;
  return 'array' in potentiallyArrayful && Array.isArray(potentiallyArrayful.array,);
}
