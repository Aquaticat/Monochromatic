export function constant<T,>(x: T): () => T {
  return function identity(): T {
    return x;
  };
}
