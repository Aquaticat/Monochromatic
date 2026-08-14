//region Shared controls

/**
 * Mutable state used by subject-rendering controls.
 */
type SubjectState = {
  value: string;
};

/**
 * Callable capability retained by readonly projection.
 */
type SubjectRunner = {
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
 * writeSubjectState({ value: 'before' });
 * ```
 */
function writeSubjectState(state: SubjectState,): void {
  state.value = 'changed';
}

//endregion Shared controls

//region Public rule subjects

/**
 * Reads destructured mutable state with proved readonly replacement.
 *
 * @param state - State read without mutation.
 *
 * @returns current value.
 *
 * @example
 * ```ts
 * preferSubjectReadonly({ state: { value: 'current' } });
 * ```
 */
export function preferSubjectReadonly(
  {
    state,
  }: {
    state: SubjectState;
  },
): string {
  return state.value;
}

/**
 * Sends destructured readonly declaration through proved mutation path.
 *
 * @param state - Readonly state reaching owned writer.
 *
 * @mutates state - Owned writer replaces value.
 *
 * @example
 * ```ts
 * mutateSubjectReadonly({ state: { value: 'before' } });
 * ```
 */
export function mutateSubjectReadonly(
  {
    state,
  }: {
    readonly state: Readonly<SubjectState>;
  },
): void {
  writeSubjectState(state,);
}

/**
 * Returns callable retained by destructured readonly projection.
 *
 * @param runner - Readonly projection retaining unresolved behavior.
 *
 * @returns callable capability from projection.
 *
 * @example
 * ```ts
 * projectSubjectCapability({ runner: { run() {} } });
 * ```
 */
export function projectSubjectCapability(
  {
    runner,
  }: {
    readonly runner: Readonly<SubjectRunner>;
  },
): SubjectRunner['run'] {
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
 * staleSubjectContract({ label: 'label' });
 * ```
 */
export function staleSubjectContract(
  {
    label,
  }: {
    readonly label: string;
  },
): string {
  return label;
}

//endregion Public rule subjects
