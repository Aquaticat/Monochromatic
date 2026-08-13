/**
 * Mutable state used by split-rule controls.
 */
type SplitState = {
  value: string;
};

/**
 * Callable capability retained by readonly projection.
 */
type SplitRunner = {
  run: () => void;
};

/**
 * Writes state through mutable contract.
 *
 * @param state - State whose value changes.
 *
 * @mutates state - Replaces value.
 *
 * @example
 * ```ts
 * writeSplitState({ value: 'before' });
 * ```
 */
function writeSplitState(state: SplitState,): void {
  state.value = 'changed';
}

/**
 * Reads mutable parameter with a proved readonly replacement.
 *
 * @param state - State read without mutation.
 *
 * @returns current value.
 *
 * @example
 * ```ts
 * preferSplitReadonly({ value: 'current' });
 * ```
 */
export function preferSplitReadonly(state: SplitState,): string {
  return state.value;
}

/**
 * Sends readonly declaration through a proved mutation path.
 *
 * @param state - Readonly declaration reaching owned writer.
 *
 * @mutates state - Owned writer replaces value.
 *
 * @example
 * ```ts
 * mutateSplitReadonly({ value: 'before' });
 * ```
 */
export function mutateSplitReadonly(state: Readonly<SplitState>,): void {
  writeSplitState(state,);
}

/**
 * Returns callable retained by a readonly projection.
 *
 * @param runner - Readonly projection retaining unresolved behavior.
 *
 * @returns callable capability from projection.
 *
 * @example
 * ```ts
 * projectSplitCapability({ run() {} });
 * ```
 */
export function projectSplitCapability(runner: Readonly<SplitRunner>,): SplitRunner['run'] {
  return runner.run;
}

/**
 * Carries mutation contract unsupported by implementation behavior.
 *
 * @param label - Primitive label returned unchanged.
 *
 * @returns unchanged label.
 *
 * @mutates label - Deliberately stale contract for rule isolation.
 *
 * @example
 * ```ts
 * staleSplitContract('label');
 * ```
 */
export function staleSplitContract(label: string,): string {
  return label;
}
