/**
 * Shared "value or absent" sentinel for the doodle widget client.
 *
 * The workspace bans `T | null` and `T | undefined` union types
 * (`no-restricted-syntax/no-nullish-union`). Object fields express
 * absence with an optional `?:` property, but function return values
 * and reassignable state slots cannot use `?:` under
 * `exactOptionalPropertyTypes`, so they signal "no value" with the
 * {@link ABSENT} symbol instead. A unique symbol is a genuine sentinel:
 * it can never collide with a real stroke, point, snapshot, or timer
 * handle and never widens a slot to a nullish union.
 *
 * @example
 * ```ts
 * function undo(pageIndex: number): Maybe<Snapshot> {
 *   const snapshot = lookup(pageIndex);
 *   return snapshot === undefined ? ABSENT : snapshot;
 * }
 * const restored = undo(0);
 * if (restored !== ABSENT) {
 *   restoreSnapshot(restored);
 * }
 * ```
 */

/**
 * Sentinel used in place of a value that is genuinely absent.
 *
 * Annotated `unique symbol` so {@link Maybe} can reference its type via
 * `typeof ABSENT` and so identity stays stable across module boundaries.
 */
export const ABSENT: unique symbol = Symbol('doodle-widget:absent',);

/**
 * Type for a value that may be absent, narrowed by `=== ABSENT`.
 *
 * @typeParam T - present-value type
 */
export type Maybe<T,> = T | typeof ABSENT;
