export function trimIterable<T,>(iterable: Iterable<T>): T[] {
  const arr = [...iterable];
  const firstNonEmptyIndex = arr.findIndex(Boolean);
  if (firstNonEmptyIndex === -1) {
    return [];
  }

  const lastNonEmptyIndex = arr.toReversed().findIndex(Boolean);

  const lastIndex = arr.length - lastNonEmptyIndex - 1;

  return arr.slice(firstNonEmptyIndex, lastIndex + 1);
}
