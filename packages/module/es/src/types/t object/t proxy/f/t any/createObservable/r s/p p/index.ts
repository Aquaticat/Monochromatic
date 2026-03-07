/**
 * Observable value container type returned by {@link $}.
 *
 * Setting `value` triggers the registered change handler synchronously.
 */
export type Observable<T,> = {
  value: T;
};

/**
 * Creates an observable value container that calls a synchronous handler when `value` is set.
 *
 * Returns an object with a `value` getter/setter. Writing to `value` stores the new
 * value and invokes the change handler with the new and previous values.
 *
 * @param initialValue - Starting value for the observable
 * @param onChange - Synchronous callback invoked after each value change
 * @returns Observable container whose `value` property triggers onChange on assignment
 *
 * @example
 * ```ts
 * const counter = $(0, (next, prev) => {
 *   console.log(`Changed from ${prev} to ${next}`);
 * });
 * counter.value = 1; // logs "Changed from 0 to 1"
 * ```
 *
 * @example
 * Reactive pipeline:
 * ```ts
 * const items = $([], onItemsChange);
 * items.value = [...items.value, newItem];
 * ```
 */
export function $<T,>(
  initialValue: T,
  onChange: (newValue: T, oldValue: T,) => void,
): Observable<T> {
  let current: T = initialValue;
  return {
    get value(): T {
      return current;
    },
    set value(newValue: T,) {
      const old = current;
      current = newValue;
      onChange(newValue, old,);
    },
  };
}
