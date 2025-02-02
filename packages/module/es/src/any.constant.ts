function constant<T,>(x: T): T | (() => T) {
  return function identity(): T {
    return x;
  };
}
