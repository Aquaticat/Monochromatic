/**
 * Runtime diagnostic factories whose return annotations define static wording.
 *
 * Type-level validation reads these return types, while runtime validation calls
 * the same functions. A wording change must therefore satisfy both contexts.
 *
 * @module
 */

import type {
  BeforeStartDiagnostic,
  EmptyArrayDiagnostic,
  NonSafeIntegerDiagnostic,
  PastEndDiagnostic,
  UnassignedSlotDiagnostic,
} from './diagnostic-types.ts';
import type { NegativeNumber, } from './type-arithmetic-number.ts';

//region Independent diagnostics

/**
 * Creates non-safe-integer diagnostic.
 *
 * @param options - Index rejected by safe-integer predicate
 *
 * @returns Structured safe-integer diagnostic
 *
 * @example
 * ```ts
 * const diagnostic = createNonSafeIntegerDiagnostic({ index: 1.5, });
 * ```
 */
export function createNonSafeIntegerDiagnostic<const Index extends number>({
  index,
}: {
  readonly index: Index;
}): NonSafeIntegerDiagnostic<Index> {
  return {
    code: 'non-safe-integer',
    message: `Index ${index} is not a safe integer.`,
    hint: 'Use an integer from -9007199254740991 through 9007199254740991.',
    index,
  };
}

/**
 * Creates empty-array diagnostic.
 *
 * @returns Structured empty-array diagnostic
 *
 * @example
 * ```ts
 * const diagnostic = createEmptyArrayDiagnostic();
 * ```
 */
export function createEmptyArrayDiagnostic(): EmptyArrayDiagnostic {
  return {
    code: 'empty-array',
    message: 'Cannot read from an empty array.',
    hint: 'Assign at least one element before reading by index.',
    length: 0,
  };
}

//endregion Independent diagnostics

//region Range diagnostics

/**
 * Shared range diagnostic factory options.
 *
 * @example
 * ```ts
 * const options: RangeDiagnosticOptions<3, 1, 2, 3> = {
 *   distance: 1,
 *   index: 3,
 *   lastIndex: 2,
 *   length: 3,
 * };
 * ```
 */
type RangeDiagnosticOptions<
  Index extends number,
  Distance extends number,
  LastIndex extends number,
  Length extends number,
> = {
  readonly index: Index;
  readonly distance: Distance;
  readonly lastIndex: LastIndex;
  readonly length: Length;
};

/**
 * Creates diagnostic for index past array end.
 *
 * @param options - Index, exact overshoot, and valid bounds
 *
 * @returns Structured past-end diagnostic
 *
 * @example
 * ```ts
 * const diagnostic = createPastEndDiagnostic({
 *   distance: 1,
 *   index: 3,
 *   lastIndex: 2,
 *   length: 3,
 * });
 * ```
 */
export function createPastEndDiagnostic<
  const Index extends number,
  const Distance extends number,
  const LastIndex extends number,
  const Length extends number,
>({
  index,
  distance,
  lastIndex,
  length,
}: RangeDiagnosticOptions<Index, Distance, LastIndex, Length>): PastEndDiagnostic<
  Index,
  Distance,
  LastIndex,
  Length
> {
  return {
    code: 'out-of-range',
    message: `Index ${index} is past the end by ${distance}.`,
    hint: `Use 0 through ${lastIndex}, or -1 through -${length}.`,
    index,
    length,
    direction: 'past-end',
    distance,
    minimumPositiveIndex: 0,
    maximumPositiveIndex: lastIndex,
    minimumNegativeIndex: -length as NegativeNumber<Length>,
    maximumNegativeIndex: -1,
  };
}

/**
 * Creates diagnostic for index before array start.
 *
 * @param options - Index, exact overshoot, and valid bounds
 *
 * @returns Structured before-start diagnostic
 *
 * @example
 * ```ts
 * const diagnostic = createBeforeStartDiagnostic({
 *   distance: 1,
 *   index: -4,
 *   lastIndex: 2,
 *   length: 3,
 * });
 * ```
 */
export function createBeforeStartDiagnostic<
  const Index extends number,
  const Distance extends number,
  const LastIndex extends number,
  const Length extends number,
>({
  index,
  distance,
  lastIndex,
  length,
}: RangeDiagnosticOptions<Index, Distance, LastIndex, Length>): BeforeStartDiagnostic<
  Index,
  Distance,
  LastIndex,
  Length
> {
  return {
    code: 'out-of-range',
    message: `Index ${index} is before the start by ${distance}.`,
    hint: `Use 0 through ${lastIndex}, or -1 through -${length}.`,
    index,
    length,
    direction: 'before-start',
    distance,
    minimumPositiveIndex: 0,
    maximumPositiveIndex: lastIndex,
    minimumNegativeIndex: -length as NegativeNumber<Length>,
    maximumNegativeIndex: -1,
  };
}

//endregion Range diagnostics

//region Slot diagnostics

/**
 * Creates diagnostic for in-range unassigned slot.
 *
 * @param options - Requested index, resolved slot, and array length
 *
 * @returns Structured unassigned-slot diagnostic
 *
 * @example
 * ```ts
 * const diagnostic = createUnassignedSlotDiagnostic({
 *   index: -1,
 *   length: 2,
 *   resolvedIndex: 1,
 * });
 * ```
 */
export function createUnassignedSlotDiagnostic<
  const Index extends number,
  const ResolvedIndex extends number,
  const Length extends number,
>({
  index,
  length,
  resolvedIndex,
}: {
  readonly index: Index;
  readonly length: Length;
  readonly resolvedIndex: ResolvedIndex;
}): UnassignedSlotDiagnostic<Index, ResolvedIndex, Length> {
  return {
    code: 'unassigned-slot',
    message: `Index ${index} resolves to unassigned array slot ${resolvedIndex}.`,
    hint: 'Assign a value to that slot before reading it.',
    index,
    length,
    resolvedIndex,
  };
}

//endregion Slot diagnostics
