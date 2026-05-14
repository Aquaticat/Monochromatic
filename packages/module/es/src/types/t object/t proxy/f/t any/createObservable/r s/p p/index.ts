/**
 * Observable value container type returned by the $ function.
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
 *
 * @param onChange - Synchronous callback invoked after each value change
 *
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
  /** Internal store backing the value getter and setter pair. */
  let current: T = initialValue;
  return {
    /** Retrieves the current observed value. */
    get value(): T {
      return current;
    },
    /** Sets the observed value and triggers the onChange callback. */
    set value(newValue: T,) {
      /** Snapshot of the prior value preserved for the change handler call. */
      const old = current;
      current = newValue;
      onChange(
        newValue,
        old,
      );
    },
  };
}
