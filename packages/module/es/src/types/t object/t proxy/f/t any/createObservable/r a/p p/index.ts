// oxlint-disable eslint/require-await, typescript/require-await -- async wrapper enables top-level await construction
/**
 * Observable value container type returned by the $ function.
 *
 * Setting `value` triggers the registered change handler.
 */
export type ObservableAsync<T,> = {
  value: T;
};

/**
 * Creates an observable value container that calls a handler when `value` is set.
 *
 * Returns a promise that resolves to an object with a `value` getter/setter.
 * Writing to `value` stores the new value and invokes the change handler
 * with the new and previous values. The handler may be synchronous or asynchronous.
 *
 * The async wrapper allows callers to `await` the observable construction in
 * top-level module code, even though the observable itself is created synchronously.
 *
 * @param initialValue - Starting value for the observable
 *
 * @param onChange - Callback invoked after each value change (may return a Promise)
 *
 * @returns Promise resolving to an observable container
 *
 * @example
 * ```ts
 * const feeds = await $({
 *   initialValue: [],
 *   onChange: async (next, prev) => {
 *     await updateUI(next);
 *   },
 * });
 * feeds.value = await fetchFeeds();
 * ```
 *
 * @example
 * Top-level module observable:
 * ```ts
 * export const itemsObservable = await $({ initialValue: [], onChange: onItemsChange });
 * ```
 */
export async function $<T,>({
  initialValue,
  onChange,
}: {
  initialValue: T;
  onChange: (
    newValue: T,
    oldValue: T,
  ) => void | Promise<void>;
},): Promise<ObservableAsync<T>> {
  /** Internal store backing the value getter and setter; held in an object so mutation lives on a property, not a function-root `let`. */
  const state: { current: T; } = { current: initialValue, };
  return {
    /** Retrieves the current observed value. */
    get value(): T {
      return state.current;
    },
    /** Sets the observed value and triggers the onChange callback. */
    set value(newValue: T,) {
      /** Snapshot of the prior value preserved for the change handler call. */
      const old = state.current;
      state.current = newValue;
      void onChange(
        newValue,
        old,
      );
    },
  };
}
// oxlint-enable eslint/require-await, typescript/require-await
