export function* echo<T,>(x: T): Generator<T> {
  while (true) { yield x; }
}
